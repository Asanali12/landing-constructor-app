// Self-contained types for the LandingPageHost runtime.
//
// Copy this folder (app/host-runtime/) into any Next.js project that needs
// to render landing pages exported by the constructor app. The runtime has
// no imports from the editor — it depends only on React.
//
// IMPORTANT: these types must stay in sync with the constructor's exporter
// (app/editor/types.ts > Action, app/editor/events-runtime.ts > EventConfig).
// A mismatch will silently break event handling because the host runtime
// won't recognise the action shape.

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export type ScrollBehavior = "auto" | "smooth";

export type Action =
  | {
      id: string;
      kind: "analytics";
      eventName: string;
      // JSON object string — parsed at runtime.
      properties: string;
    }
  | { id: string; kind: "writeUserData"; field: string; value: string }
  | {
      id: string;
      kind: "httpRequest";
      url: string;
      method: HttpMethod;
      headers: string;
      body: string;
    }
  | {
      id: string;
      kind: "ifElse";
      condition: string;
      then: Action[];
      else: Action[];
    }
  | { id: string; kind: "setTimeout"; delayMs: number; actions: Action[] }
  | { id: string; kind: "goToLink"; url: string; newTab: boolean }
  | {
      id: string;
      kind: "scrollTo";
      selector: string;
      behavior: ScrollBehavior;
    }
  | { id: string; kind: "customJs"; code: string };

export type EventConfig = {
  // CSS selector that identifies the element(s) whose bindings live below.
  // The exporter scopes this to a viewport-specific class for merged exports.
  selector: string;
  bindings: Array<{
    event: string;
    actions: Action[];
  }>;
};
