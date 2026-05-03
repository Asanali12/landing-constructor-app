// Behavior runtime for built-in components (swiper / sidebar / accordion).
//
// Why two delivery forms:
//   - Standalone HTML export: an inline <script> tag at the end of <body>
//     runs `bindComponentRuntime(document)` after parse — same pattern the
//     events runtime uses.
//   - LandingPageHost (React, dangerouslySetInnerHTML): browsers don't
//     execute <script> tags injected via innerHTML, so the host calls
//     `bindComponentRuntime(containerRef.current)` from a useEffect and
//     stores the returned cleanup.
//
// Both consume the same source function via `Function.prototype.toString`,
// so behavior is guaranteed identical across the two paths.
//
// Hard constraint: `bindComponentRuntime` must be self-contained — no
// imports, no captured closures, no TypeScript-only constructs. The
// compiled JS body is what gets serialized into the inline <script>.

export function bindComponentRuntime(root: ParentNode = document): () => void {
  const cleanups: Array<() => void> = [];

  const on = (
    el: EventTarget,
    type: string,
    handler: (event: Event) => void
  ) => {
    el.addEventListener(type, handler);
    cleanups.push(() => el.removeEventListener(type, handler));
  };

  // ─── Swiper ────────────────────────────────────────────────────────────
  // Layout:
  //   <root data-component="swiper">
  //     <div data-swiper-track>
  //       <div data-swiper-slide>...</div> *N
  //     </div>
  //     <button data-swiper-prev>‹</button>
  //     <button data-swiper-next>›</button>
  //   </root>
  // Behavior: clicking next/prev shifts the track by one slide width
  // (including gap), wrapping around at the ends. Smooth via the track's
  // own `transition: transform <duration> ease`.
  root.querySelectorAll<HTMLElement>('[data-component="swiper"]').forEach((swiper) => {
    const track = swiper.querySelector<HTMLElement>("[data-swiper-track]");
    const slides = Array.from(
      swiper.querySelectorAll<HTMLElement>("[data-swiper-slide]")
    );
    const prev = swiper.querySelector<HTMLElement>("[data-swiper-prev]");
    const next = swiper.querySelector<HTMLElement>("[data-swiper-next]");
    if (!track || slides.length === 0) return;

    let index = 0;

    const computeStep = (): number => {
      const a = slides[0];
      const b = slides[1];
      // Gap is the visual distance between consecutive slides; if there's
      // only one slide, fall back to the slide's full offsetWidth.
      if (b) return b.getBoundingClientRect().left - a.getBoundingClientRect().left;
      return a.offsetWidth;
    };

    const update = () => {
      const step = computeStep();
      track.style.transform = `translateX(${-index * step}px)`;
    };

    if (prev) {
      on(prev, "click", (e) => {
        e.preventDefault();
        index = (index - 1 + slides.length) % slides.length;
        update();
      });
    }
    if (next) {
      on(next, "click", (e) => {
        e.preventDefault();
        index = (index + 1) % slides.length;
        update();
      });
    }

    on(window, "resize", update);
    // First paint can leave offsetWidth at 0 (font-load reflow, etc.) —
    // a microtask + a rAF cover the common cases.
    Promise.resolve().then(update);
    requestAnimationFrame(update);
  });

  // ─── Sidebar ───────────────────────────────────────────────────────────
  // Layout:
  //   <root data-component="sidebar">
  //     <button data-sidebar-trigger>...</button>
  //     <div data-sidebar-overlay></div>
  //     <aside data-sidebar-panel>
  //       <button data-sidebar-close>×</button>
  //       <!-- empty by default; user fills in -->
  //     </aside>
  //   </root>
  // Behavior: trigger click slides panel in, overlay fades in, click on
  // overlay or close button or Escape reverses. Inline transitions on
  // the panel/overlay handle the animation; runtime only flips
  // transform/opacity values.
  root.querySelectorAll<HTMLElement>('[data-component="sidebar"]').forEach((sidebar) => {
    const trigger = sidebar.querySelector<HTMLElement>("[data-sidebar-trigger]");
    const panel = sidebar.querySelector<HTMLElement>("[data-sidebar-panel]");
    const overlay = sidebar.querySelector<HTMLElement>("[data-sidebar-overlay]");
    const closeBtn = sidebar.querySelector<HTMLElement>("[data-sidebar-close]");
    if (!trigger || !panel) return;

    let isOpen = false;
    const open = () => {
      isOpen = true;
      panel.style.transform = "translateX(0)";
      panel.dataset.open = "true";
      if (overlay) {
        overlay.style.opacity = "1";
        overlay.style.pointerEvents = "auto";
        overlay.dataset.open = "true";
      }
    };
    const close = () => {
      isOpen = false;
      panel.style.transform = "";
      panel.dataset.open = "false";
      if (overlay) {
        overlay.style.opacity = "";
        overlay.style.pointerEvents = "";
        overlay.dataset.open = "false";
      }
    };

    on(trigger, "click", (e) => {
      e.preventDefault();
      open();
    });
    if (closeBtn) on(closeBtn, "click", (e) => { e.preventDefault(); close(); });
    if (overlay) on(overlay, "click", () => close());
    on(document, "keydown", (e) => {
      if (isOpen && (e as KeyboardEvent).key === "Escape") close();
    });
  });

  // ─── Accordion ─────────────────────────────────────────────────────────
  // Layout:
  //   <root data-component="accordion">
  //     <div data-accordion-item> *N
  //       <button data-accordion-trigger>...</button>
  //       <div data-accordion-panel>...</div>
  //     </div>
  //   </root>
  // Behavior: trigger click toggles the item's `data-open` and animates
  // the panel's max-height between 0 and scrollHeight. CSS `max-height`
  // transitions need a numeric target; `auto` doesn't transition.
  root.querySelectorAll<HTMLElement>('[data-component="accordion"]').forEach((accordion) => {
    const items = Array.from(
      accordion.querySelectorAll<HTMLElement>("[data-accordion-item]")
    );
    items.forEach((item) => {
      const trigger = item.querySelector<HTMLElement>("[data-accordion-trigger]");
      const panel = item.querySelector<HTMLElement>("[data-accordion-panel]");
      const icon = item.querySelector<HTMLElement>("[data-accordion-icon]");
      if (!trigger || !panel) return;

      // Closed initial state.
      panel.style.maxHeight = "0px";
      item.dataset.open = "false";

      on(trigger, "click", (e) => {
        e.preventDefault();
        const open = item.dataset.open !== "true";
        if (open) {
          panel.style.maxHeight = panel.scrollHeight + "px";
          item.dataset.open = "true";
          if (icon) icon.style.transform = "rotate(180deg)";
        } else {
          panel.style.maxHeight = "0px";
          item.dataset.open = "false";
          if (icon) icon.style.transform = "";
        }
      });
    });
  });

  return () => {
    for (const fn of cleanups) fn();
  };
}

// Inline <script> form for HTML export. The compiled JS body of
// `bindComponentRuntime` is serialized verbatim and immediately invoked
// with `document` as root. No JSON config to inject (unlike the events
// runtime) — all behavior is wired off `data-component-*` attributes
// already present in the markup.
export function serializeComponentRuntimeScript(): string {
  return `<script>(${bindComponentRuntime.toString()})(document);</script>`;
}
