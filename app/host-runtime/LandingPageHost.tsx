"use client";

// LandingPageHost — drop-in component for rendering a landing page exported
// by the constructor app inside a Next.js page.
//
// Usage from a host project:
//
//   // app/landing/[slug]/page.tsx
//   import { LandingPageHost } from "@/host-runtime/LandingPageHost";
//
//   export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
//     const { slug } = await params;
//     // Fetch the artifacts (HTML + events JSON) from S3, your DB, etc.
//     const { html, events } = await loadFromS3(slug);
//     return <LandingPageHost html={html} events={events} />;
//   }
//
// Stub mode: every action handler currently logs to the console with the
// action payload and the originating DOM event. Replace each branch in
// `executeAction` with a real implementation when integrating into your app
// — `goToLink` should usually call `router.push`, `httpRequest` should hit
// a Next.js API route or invoke a server action with auth headers attached,
// `analytics` should plug into your tracking SDK, etc.

import { useEffect, useRef } from "react";
import type { Action, EventConfig } from "./types";
import { bindComponentRuntime } from "./component-runtime";

export type LandingPageHostProps = {
  // The HTML emitted by the constructor's exporter — body markup with
  // `data-lc-events="<id>"` injected on every element that owns event
  // bindings, but no inline runtime <script>.
  html: string;
  // The companion event-bindings manifest. One entry per element with
  // bindings; selector matches the data-lc-events attribute.
  events: EventConfig[];
};

export function LandingPageHost({ html, events }: LandingPageHostProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // (Re)wire all bindings whenever the html or events change. We
  // dangerouslySetInnerHTML the markup synchronously and let the effect
  // attach handlers on the freshly-mounted DOM.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    type Cleanup = () => void;
    const cleanups: Cleanup[] = [];

    for (const cfg of events) {
      const elements = container.querySelectorAll(cfg.selector);
      elements.forEach((el) => {
        for (const binding of cfg.bindings) {
          const handler: EventListener = (event) => {
            // Block default semantics where the host should own navigation:
            // links and buttons that would otherwise navigate or submit
            // forms and trigger a page reload.
            const target = el as HTMLElement;
            if (
              event.type === "click" &&
              (target.tagName === "A" || target.tagName === "BUTTON")
            ) {
              event.preventDefault();
            }
            if (event.type === "submit") event.preventDefault();
            for (const action of binding.actions) executeAction(action, event);
          };
          el.addEventListener(binding.event, handler);
          cleanups.push(() => el.removeEventListener(binding.event, handler));
        }
      });
    }

    // Built-in component behaviors (swiper / sidebar / accordion). Same
    // function the standalone HTML export inlines as a <script>; here we
    // call it directly because innerHTML-injected scripts don't execute.
    const unbindComponents = bindComponentRuntime(container);
    cleanups.push(unbindComponents);

    return () => {
      for (const fn of cleanups) fn();
    };
  }, [html, events]);

  return (
    <div ref={containerRef} dangerouslySetInnerHTML={{ __html: html }} />
  );
}

// Stub action runner. Each branch logs the action payload and the
// triggering DOM event so you can see what the page is dispatching while
// you wire the real implementations.
function executeAction(action: Action, event: Event): void {
  switch (action.kind) {
    case "analytics":
      console.log("[lc-host] analytics", {
        eventName: action.eventName,
        properties: action.properties,
        domEvent: event.type,
      });
      break;
    case "writeUserData":
      console.log("[lc-host] writeUserData", {
        field: action.field,
        value: action.value,
        domEvent: event.type,
      });
      break;
    case "httpRequest":
      console.log("[lc-host] httpRequest", {
        method: action.method,
        url: action.url,
        headers: action.headers,
        body: action.body,
        domEvent: event.type,
      });
      break;
    case "goToLink":
      console.log("[lc-host] goToLink", {
        url: action.url,
        newTab: action.newTab,
        domEvent: event.type,
      });
      break;
    case "scrollTo":
      console.log("[lc-host] scrollTo", {
        selector: action.selector,
        behavior: action.behavior,
        domEvent: event.type,
      });
      break;
    case "customJs":
      console.log("[lc-host] customJs", {
        code: action.code,
        domEvent: event.type,
      });
      break;
    case "ifElse":
      // Stub: log the condition and run the `then` branch unconditionally
      // so nested actions still surface in the console.
      console.log("[lc-host] ifElse (stub: running 'then' branch)", {
        condition: action.condition,
        domEvent: event.type,
      });
      for (const sub of action.then) executeAction(sub, event);
      break;
    case "setTimeout":
      // Stub: log the delay and run nested actions immediately so the user
      // can see the chain without waiting.
      console.log("[lc-host] setTimeout (stub: running immediately)", {
        delayMs: action.delayMs,
        domEvent: event.type,
      });
      for (const sub of action.actions) executeAction(sub, event);
      break;
  }
}
