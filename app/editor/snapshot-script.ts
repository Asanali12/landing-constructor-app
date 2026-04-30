// User-facing snapshot script.
//
// Pasted into the DevTools console (or run via the bookmarklet) on the source
// page, this captures:
//
//   1. The live DOM after JS hydration / mutations
//   2. Every readable CSS rule from document.styleSheets (including ones the
//      framework injected at runtime via insertRule)
//   3. References to cross-origin stylesheets we can't read (kept as <link>)
//
// It bundles the result into a self-contained HTML document and copies it to
// the clipboard. The user pastes that into the editor's Import HTML dialog.
//
// Authored as plain-text JS so it can be inspected before running. The
// bookmarklet form below is just this script wrapped and URL-encoded.

export const SNAPSHOT_SCRIPT = `(async () => {
  try {
    const scroller = document.scrollingElement || document.documentElement;
    const orig = scroller.scrollTop;
    const total = scroller.scrollHeight;

    // Scroll through the page so reveal/scroll-triggered animations fire and
    // any lazy-rendered content mounts. Cap steps so a 50k-pixel doc doesn't
    // take forever.
    const stepSize = Math.max(
      Math.floor(window.innerHeight * 0.8),
      Math.ceil(total / 100)
    );
    for (let y = 0; y < total; y += stepSize) {
      scroller.scrollTop = y;
      await new Promise((r) => setTimeout(r, 120));
    }
    scroller.scrollTop = total;
    await new Promise((r) => setTimeout(r, 500));
    scroller.scrollTop = orig;
    await new Promise((r) => setTimeout(r, 200));

    // Serialize every readable stylesheet. Anything we can't read (CORS) is
    // left as a <link> so the iframe can re-fetch it.
    const cssChunks = [];
    const linkHrefs = [];
    let crossOrigin = 0;
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        const rules = Array.from(sheet.cssRules);
        for (const rule of rules) cssChunks.push(rule.cssText);
      } catch (_) {
        crossOrigin++;
        if (sheet.href) linkHrefs.push(sheet.href);
      }
    }

    const clone = document.documentElement.cloneNode(true);
    clone.querySelectorAll('script, noscript').forEach((n) => n.remove());

    const head = clone.querySelector('head');
    if (head) {
      if (cssChunks.length) {
        const s = document.createElement('style');
        s.setAttribute('data-lc-snapshot', 'true');
        s.textContent = cssChunks.join('\\n\\n');
        head.appendChild(s);
      }
      for (const href of linkHrefs) {
        if (head.querySelector('link[rel="stylesheet"][href="' + href + '"]')) continue;
        const l = document.createElement('link');
        l.rel = 'stylesheet';
        l.href = href;
        head.appendChild(l);
      }
    }

    const html = '<!doctype html>\\n' + clone.outerHTML;
    const summary =
      (html.length / 1024).toFixed(0) + ' KB, ' +
      cssChunks.length + ' CSS rules inlined' +
      (crossOrigin ? ', ' + crossOrigin + ' cross-origin sheet(s) linked' : '');

    try {
      await navigator.clipboard.writeText(html);
      alert('Snapshot copied to clipboard.\\n' + summary +
        '\\n\\nSwitch to the Landing Constructor and paste it into Import HTML.');
    } catch (_) {
      // Clipboard write needs user activation; fall back to a popup textarea.
      const w = window.open('', '_blank');
      if (!w) {
        console.log(html);
        alert('Could not copy or open a popup. HTML logged to console.\\n' + summary);
        return;
      }
      const ta = w.document.createElement('textarea');
      ta.value = html;
      ta.style.cssText =
        'width:100%;height:100vh;font-family:monospace;font-size:11px;' +
        'padding:12px;box-sizing:border-box;border:0;margin:0';
      w.document.body.style.margin = '0';
      w.document.body.appendChild(ta);
      ta.select();
    }
  } catch (err) {
    alert('Snapshot failed: ' + (err && err.message ? err.message : err));
    console.error(err);
  }
})();`;

// Bookmarklets need to evaluate to undefined, otherwise the browser tries to
// render the returned Promise. The trailing `;void 0` enforces that.
export const SNAPSHOT_BOOKMARKLET =
  "javascript:" + encodeURIComponent(SNAPSHOT_SCRIPT + ";void 0;");
