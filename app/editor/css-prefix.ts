// Prefix every selector in a CSS string with a wrapper class. Used by the
// merged export to scope desktop/mobile CSS so the two stylesheets can coexist
// in one document without colliding.
//
// Rules:
//   • normal rules: each comma-separated selector gets `.${scope} ` prepended
//   • selectors that target the page root (body, html, :root) collapse to
//     `.${scope}` itself — that wrapper IS their root in the merged doc
//   • @media / @supports / @container / @layer: recurse into the body
//   • @keyframes / @font-face / @page / @import / @charset: keep verbatim
//
// The lexer follows the same shape as scope-css.ts but with simpler semantics.

const NESTED_AT_RULES = new Set(["media", "supports", "container", "layer"]);
const ROOT_TARGETS = new Set(["body", "html", ":root"]);

export function prefixCss(input: string, scope: string): string {
  if (!input.trim()) return "";
  const cls = "." + scope;
  return walkRules(input, cls);
}

function walkRules(css: string, cls: string): string {
  let i = 0;
  let out = "";

  while (i < css.length) {
    const wsEnd = skipWhile(css, i, (c) => /\s/.test(c));
    out += css.slice(i, wsEnd);
    i = wsEnd;
    if (i >= css.length) break;

    if (css[i] === "/" && css[i + 1] === "*") {
      const end = css.indexOf("*/", i + 2);
      const stop = end < 0 ? css.length : end + 2;
      out += css.slice(i, stop);
      i = stop;
      continue;
    }

    if (css[i] === "@") {
      const end = findAtRuleEnd(css, i);
      out += rewriteAtRule(css.slice(i, end), cls);
      i = end;
      continue;
    }

    const open = findUnquoted(css, i, "{");
    if (open < 0) {
      out += css.slice(i);
      break;
    }
    const close = findMatchingBrace(css, open);
    const selector = css.slice(i, open);
    const body = css.slice(open + 1, close);
    out += prefixSelectorList(selector, cls) + "{" + body + "}";
    i = close + 1;
  }

  return out;
}

function rewriteAtRule(block: string, cls: string): string {
  const nameMatch = block.match(/^@([\w-]+)/);
  const name = nameMatch?.[1]?.toLowerCase() ?? "";

  // Body-less at-rule (@import, @charset, @namespace) — keep verbatim.
  const semi = findUnquoted(block, 0, ";");
  const open = findUnquoted(block, 0, "{");
  if (open < 0 || (semi >= 0 && semi < open)) return block;

  const close = findMatchingBrace(block, open);
  const prelude = block.slice(0, open + 1);
  const body = block.slice(open + 1, close);
  const tail = block.slice(close);

  if (NESTED_AT_RULES.has(name)) {
    return prelude + walkRules(body, cls) + tail;
  }
  // @keyframes / @font-face / @page / unknown — keep verbatim.
  return block;
}

function prefixSelectorList(raw: string, cls: string): string {
  const parts = splitTopLevel(raw, ",");
  return parts.map((p) => prefixOneSelector(p, cls)).join(",");
}

function prefixOneSelector(selector: string, cls: string): string {
  const trimmedStart = selector.match(/^\s*/)?.[0] ?? "";
  const trimmedEnd = selector.match(/\s*$/)?.[0] ?? "";
  const core = selector.slice(trimmedStart.length, selector.length - trimmedEnd.length);

  if (!core) return selector;

  // If the entire selector targets the page root, the wrapper IS the root.
  const lower = core.toLowerCase();
  if (ROOT_TARGETS.has(lower)) {
    return trimmedStart + cls + trimmedEnd;
  }

  // If the selector starts with one of the root targets followed by a
  // combinator, replace just that leading token.
  const m = core.match(/^(:root|html|body)\b/i);
  if (m) {
    return trimmedStart + cls + core.slice(m[0].length) + trimmedEnd;
  }

  return trimmedStart + cls + " " + core + trimmedEnd;
}

// ---------------------------------------------------------------------------
// Low-level scanning (mirrors scope-css.ts)
// ---------------------------------------------------------------------------

function skipWhile(s: string, start: number, pred: (c: string) => boolean): number {
  let j = start;
  while (j < s.length && pred(s[j])) j++;
  return j;
}

function skipString(s: string, start: number): number {
  const quote = s[start];
  let j = start + 1;
  while (j < s.length) {
    if (s[j] === "\\") { j += 2; continue; }
    if (s[j] === quote) return j + 1;
    j++;
  }
  return s.length;
}

function findUnquoted(s: string, start: number, target: string): number {
  let j = start;
  while (j < s.length) {
    const c = s[j];
    if (c === '"' || c === "'") { j = skipString(s, j); continue; }
    if (c === "/" && s[j + 1] === "*") {
      const end = s.indexOf("*/", j + 2);
      j = end < 0 ? s.length : end + 2;
      continue;
    }
    if (c === target) return j;
    j++;
  }
  return -1;
}

function findAtRuleEnd(s: string, start: number): number {
  let j = start;
  while (j < s.length) {
    const c = s[j];
    if (c === '"' || c === "'") { j = skipString(s, j); continue; }
    if (c === ";") return j + 1;
    if (c === "{") return findMatchingBrace(s, j) + 1;
    j++;
  }
  return s.length;
}

function findMatchingBrace(s: string, openIdx: number): number {
  let depth = 0;
  let j = openIdx;
  while (j < s.length) {
    const c = s[j];
    if (c === '"' || c === "'") { j = skipString(s, j); continue; }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return j;
    }
    j++;
  }
  return s.length - 1;
}

function splitTopLevel(s: string, sep: string): string[] {
  const out: string[] = [];
  let buf = "";
  let parenDepth = 0;
  let bracketDepth = 0;
  let j = 0;
  while (j < s.length) {
    const c = s[j];
    if (c === '"' || c === "'") {
      const end = skipString(s, j);
      buf += s.slice(j, end);
      j = end;
      continue;
    }
    if (c === "(") parenDepth++;
    else if (c === ")") parenDepth--;
    else if (c === "[") bracketDepth++;
    else if (c === "]") bracketDepth--;
    else if (c === sep && parenDepth === 0 && bracketDepth === 0) {
      out.push(buf);
      buf = "";
      j++;
      continue;
    }
    buf += c;
    j++;
  }
  if (buf) out.push(buf);
  return out;
}
