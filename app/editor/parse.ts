import { STRIPPED_TAGS } from "./constants";
import { makeId } from "./id";
import type { EditorDocument, EditorNode, ElementNode, TextNode } from "./types";

const WHITESPACE_ONLY = /^\s*$/;

function parseAttributes(el: Element): Record<string, string> {
  const out: Record<string, string> = {};
  for (const attr of Array.from(el.attributes)) {
    const name = attr.name.toLowerCase();
    // Strip inline event handlers (onclick, onload, etc.) — interactivity is
    // expressed via the editor's own event-binding model, not user JS.
    if (name.startsWith("on")) continue;
    // Strip javascript: URLs — basic XSS protection during round-trip.
    const value = attr.value;
    if (
      (name === "href" || name === "src" || name === "action" || name === "formaction") &&
      /^\s*javascript:/i.test(value)
    ) {
      continue;
    }
    out[name] = value;
  }
  return out;
}

function convertNode(node: Node, options: { collapseWhitespace: boolean }): EditorNode | null {
  if (node.nodeType === Node.TEXT_NODE) {
    const raw = node.nodeValue ?? "";
    if (options.collapseWhitespace && WHITESPACE_ONLY.test(raw)) return null;
    const text: TextNode = {
      id: makeId("t"),
      kind: "text",
      text: raw,
    };
    return text;
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return null;

  const el = node as Element;
  const tag = el.tagName.toLowerCase();
  if (STRIPPED_TAGS.has(tag)) return null;

  const children: EditorNode[] = [];
  for (const child of Array.from(el.childNodes)) {
    const converted = convertNode(child, options);
    if (converted) children.push(converted);
  }

  const element: ElementNode = {
    id: makeId(tag),
    kind: "element",
    tag,
    attributes: parseAttributes(el),
    children,
  };
  return element;
}

export type ParseOptions = {
  collapseWhitespace?: boolean;
};

export function parseHtml(html: string, options: ParseOptions = {}): EditorDocument {
  const { collapseWhitespace = true } = options;
  const trimmed = html.trim();
  if (!trimmed) return { children: [] };

  const doc = new DOMParser().parseFromString(trimmed, "text/html");

  const headElements: EditorNode[] = [];
  for (const child of Array.from(doc.head.children)) {
    const tag = child.tagName.toLowerCase();
    if (
      tag === "style" ||
      (tag === "link" && (child.getAttribute("rel") ?? "").toLowerCase().includes("stylesheet"))
    ) {
      const converted = convertNode(child, { collapseWhitespace: false });
      if (converted) headElements.push(converted);
    }
  }

  // If the input was a fragment (no <html>/<body>), DOMParser still wraps it in
  // <html><head/><body>fragment</body></html>. So body is always the right
  // container regardless of input shape.
  const bodyChildren: EditorNode[] = [];
  for (const child of Array.from(doc.body.childNodes)) {
    const converted = convertNode(child, { collapseWhitespace });
    if (converted) bodyChildren.push(converted);
  }

  return { children: [...headElements, ...bodyChildren] };
}
