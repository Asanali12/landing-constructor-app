export type NodeId = string;
export type ActionId = string;
export type BindingId = string;

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export type ScrollBehavior = "auto" | "smooth";

// Discriminated union of supported action kinds. Each action knows how to
// serialize itself to a runtime payload that the generated <script> in the
// export interprets at page load.
export type Action =
  | {
      id: ActionId;
      kind: "analytics";
      eventName: string;
      // Free-form JSON object string (validated at edit time via JSON.parse).
      properties: string;
    }
  | {
      id: ActionId;
      kind: "writeUserData";
      // Cookie name + value template. Runtime is a stub for now.
      field: string;
      value: string;
    }
  | {
      id: ActionId;
      kind: "httpRequest";
      url: string;
      method: HttpMethod;
      // JSON object string for headers (e.g. {"Content-Type":"application/json"}).
      headers: string;
      // Raw body string. Sent as-is (after template substitution).
      body: string;
    }
  | {
      id: ActionId;
      kind: "ifElse";
      // JS expression evaluated against the event. Truthy → runs `then`.
      condition: string;
      then: Action[];
      else: Action[];
    }
  | {
      id: ActionId;
      kind: "setTimeout";
      delayMs: number;
      actions: Action[];
    }
  | {
      id: ActionId;
      kind: "goToLink";
      url: string;
      newTab: boolean;
    }
  | {
      id: ActionId;
      kind: "scrollTo";
      // CSS selector to scroll to.
      selector: string;
      behavior: ScrollBehavior;
    }
  | {
      id: ActionId;
      kind: "customJs";
      // Function body. Receives `event` as its only argument.
      code: string;
    };

export type ActionKind = Action["kind"];

export type EventBinding = {
  id: BindingId;
  // The DOM event name (e.g. "click", "mouseenter", "submit"). Wired up at
  // runtime via addEventListener.
  event: string;
  actions: Action[];
};

export type ElementNode = {
  id: NodeId;
  kind: "element";
  tag: string;
  attributes: Record<string, string>;
  children: EditorNode[];
  events?: EventBinding[];
};

export type TextNode = {
  id: NodeId;
  kind: "text";
  text: string;
};

export type EditorNode = ElementNode | TextNode;

export type EditorDocument = {
  children: EditorNode[];
};

export const isElement = (n: EditorNode): n is ElementNode => n.kind === "element";
export const isText = (n: EditorNode): n is TextNode => n.kind === "text";
