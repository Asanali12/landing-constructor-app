// Export-time event wiring. Walks an EditorDocument, collects every element
// that has bindings, returns a doc with `data-lc-events="<id>"` injected on
// those elements plus a serializable config list. The runtime <script>
// embedded in the export uses the config to attach addEventListener handlers
// at DOMContentLoaded.

import type { Action, EditorNode, ElementNode } from "./types";
import { isElement } from "./types";

const DATA_ATTR = "data-lc-events";

export type EventConfig = {
  // CSS selector that identifies the element at runtime.
  selector: string;
  bindings: Array<{
    event: string;
    actions: Action[];
  }>;
};

export type AnnotateResult = {
  nodes: EditorNode[];
  configs: EventConfig[];
};

// Walk a node array and:
//   1. Collect every element that has at least one binding into `configs`.
//   2. Return new nodes where those elements carry data-lc-events="<id>".
// Pass `selectorPrefix` to scope the runtime selector (e.g. ".lc-view-desktop ")
// so merged exports don't cross-fire desktop bindings into mobile DOM.
export function annotateAndCollect(
  nodes: EditorNode[],
  selectorPrefix = ""
): AnnotateResult {
  const configs: EventConfig[] = [];

  function walk(input: EditorNode[]): EditorNode[] {
    return input.map((n) => {
      if (!isElement(n)) return n;
      const newChildren = walk(n.children);
      const hasBindings = (n.events?.length ?? 0) > 0;
      if (!hasBindings) {
        return newChildren === n.children ? n : { ...n, children: newChildren };
      }
      configs.push({
        selector: `${selectorPrefix}[${DATA_ATTR}="${n.id}"]`,
        bindings: (n.events ?? []).map((b) => ({
          event: b.event,
          actions: b.actions,
        })),
      });
      const next: ElementNode = {
        ...n,
        children: newChildren,
        attributes: { ...n.attributes, [DATA_ATTR]: n.id },
      };
      return next;
    });
  }

  return { nodes: walk(nodes), configs };
}

// Self-contained runtime. Reads window.__lcEventsConfig and wires handlers.
// Written as plain ES5 so it runs without transpilation in any browser the
// user's exported page would target.
const RUNTIME_JS = `(function () {
  var configs = window.__lcEventsConfig || [];
  function evalExpr(code, ev) {
    try {
      return new Function("event", "return (" + code + ");")(ev);
    } catch (e) {
      console.error("[lc-events] expression error:", e);
      return undefined;
    }
  }
  function runActions(list, ev) {
    for (var i = 0; i < list.length; i++) runAction(list[i], ev);
  }
  function runAction(a, ev) {
    try {
      switch (a.kind) {
        case "analytics": {
          var props = {};
          if (a.properties) {
            try { props = JSON.parse(a.properties); } catch (e) {}
          }
          var payload = { event: a.eventName };
          for (var k in props) if (Object.prototype.hasOwnProperty.call(props, k)) payload[k] = props[k];
          window.dataLayer = window.dataLayer || [];
          window.dataLayer.push(payload);
          break;
        }
        case "writeUserData": {
          /* Stub — cookie write to be implemented. */
          break;
        }
        case "httpRequest": {
          var headers = {};
          if (a.headers) {
            try { headers = JSON.parse(a.headers); } catch (e) {}
          }
          var init = { method: a.method, headers: headers };
          if (a.method !== "GET" && a.method !== "DELETE") init.body = a.body;
          fetch(a.url, init).catch(function (e) {
            console.error("[lc-events] http error:", e);
          });
          break;
        }
        case "ifElse": {
          var truthy = !!evalExpr(a.condition, ev);
          runActions(truthy ? a["then"] : a["else"], ev);
          break;
        }
        case "setTimeout": {
          setTimeout(function () { runActions(a.actions, ev); }, a.delayMs);
          break;
        }
        case "goToLink": {
          if (a.newTab) window.open(a.url, "_blank");
          else window.location.href = a.url;
          break;
        }
        case "scrollTo": {
          var el = document.querySelector(a.selector);
          if (el && el.scrollIntoView) el.scrollIntoView({ behavior: a.behavior || "auto" });
          break;
        }
        case "customJs": {
          new Function("event", a.code)(ev);
          break;
        }
      }
    } catch (e) {
      console.error("[lc-events] action error:", e);
    }
  }
  function attach() {
    for (var i = 0; i < configs.length; i++) {
      var c = configs[i];
      var els = document.querySelectorAll(c.selector);
      for (var j = 0; j < els.length; j++) {
        (function (el, bindings) {
          for (var k = 0; k < bindings.length; k++) {
            (function (b) {
              el.addEventListener(b.event, function (ev) {
                runActions(b.actions, ev);
              });
            })(bindings[k]);
          }
        })(els[j], c.bindings);
      }
    }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", attach);
  } else {
    attach();
  }
})();`;

// Returns the full <script>…</script> block to append at the end of <body>.
// If `configs` is empty, returns "" so we don't ship dead code.
export function serializeEventsScript(configs: EventConfig[]): string {
  if (configs.length === 0) return "";
  // JSON.stringify is safe to embed inside a <script> tag as long as we
  // escape "</" so a closing tag in a string can't break out of the script.
  const json = JSON.stringify(configs).replace(/<\/(script)/gi, "<\\/$1");
  return (
    `<script>window.__lcEventsConfig=${json};</script>` +
    `<script>${RUNTIME_JS}</script>`
  );
}
