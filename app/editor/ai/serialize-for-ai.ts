// Bridge between the editor's internal node tree and the HTML view exposed
// to the AI. Two operations:
//
//   serializeForAI(doc)  → HTML with `data-edit-id` on every element, with
//                          class/style/data-* and other framework noise
//                          stripped, identical <style> blocks deduped, and
//                          <svg> emptied. Used by slash-command {selection}
//                          expansion in commands.ts.
//   parseFragment(html)  → EditorNode[] from arbitrary HTML the AI sends,
//                          with incoming data-edit-id attrs stripped (parse
//                          already mints fresh ids).
//
// We deliberately reuse `parseHtml` and `serializeDocument` rather than
// reimplement traversal — that way every sanitization rule (STRIPPED_TAGS,
// inline `on*` handlers, javascript: URLs) and every serializer detail
// (void-element handling, raw-text tags, attribute escaping) stays in one
// place.

import { parseHtml } from "../parse";
import { serializeDocument } from "../serialize";
import type { EditorDocument, EditorNode } from "../types";
import { isElement } from "../types";

const ID_ATTR = "data-edit-id";
const SAME_AS_ATTR = "data-same-as";

// Framework-internal attribute names we always drop before the AI sees them.
// Framer adds these to most elements; they tell the AI nothing useful about
// structure and add up across hundreds of nodes.
const DENY_ATTR_NAMES = new Set(["parentsize", "rotation", "shadows"]);

// Cosmetic / framework-noise attributes are dropped before the AI sees them.
// `class` and `style` on Framer-imported pages can be hundreds of characters
// per element and the AI doesn't need them to reason about structure or to
// emit edits (when it inserts new HTML, parseFragment accepts class/style as
// usual). All non-id `data-*` attrs go too — they're typically JS hooks.
// Underscore-prefixed names (`_constraints`) are framer-internal too.
// `name="..."` with whitespace is almost always a free-form layout label
// (e.g. name="Team Slides") rather than a form-control name; we drop those
// but keep `name="email"`-style identifiers intact for real form inputs.
//
// Round-trip note: this is a *view* transformation only. The editor's
// internal node still has every original attribute; we never mutate the
// real doc, just the copy we hand to the model.
function filterAttrsForAI(attrs: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(attrs)) {
    if (key === "class" || key === "style") continue;
    if (key.startsWith("data-") && key !== ID_ATTR) continue;
    if (key.startsWith("_")) continue;
    if (DENY_ATTR_NAMES.has(key)) continue;
    if (key === "name" && /\s/.test(value)) continue;
    out[key] = value;
  }
  return out;
}

// Concatenate every text child of a raw-text element (e.g. <style>) into a
// single string for dedupe-keying. Whitespace is preserved verbatim so we
// only collapse blocks that are genuinely identical.
function rawTextContent(node: EditorNode): string {
  if (!isElement(node)) return "";
  return node.children
    .map((c) => (c.kind === "text" ? c.text : ""))
    .join("");
}

function annotateNode(
  node: EditorNode,
  styleByContent: Map<string, string>
): EditorNode {
  if (!isElement(node)) return node;
  const attrs = { ...filterAttrsForAI(node.attributes), [ID_ATTR]: node.id };

  // SVGs can balloon to thousands of bytes of path data that tells the AI
  // nothing useful about page structure. Collapse to an empty element so the
  // model still sees "there's an svg here with id=X" but pays no token cost
  // for the contents. The editor's real node is untouched.
  if (node.tag === "svg") {
    return { ...node, attributes: attrs, children: [] };
  }
  // Dedupe identical <style> blocks. Framer-imported pages frequently repeat
  // the same multi-hundred-line CSS inside every card / slide. The first
  // occurrence keeps its text; later identical ones become empty with a
  // data-same-as pointer back to the original id.
  if (node.tag === "style") {
    const content = rawTextContent(node);
    if (content) {
      const firstId = styleByContent.get(content);
      if (firstId && firstId !== node.id) {
        return {
          ...node,
          attributes: { ...attrs, [SAME_AS_ATTR]: firstId },
          children: [],
        };
      }
      styleByContent.set(content, node.id);
    }
    return { ...node, attributes: attrs };
  }
  return {
    ...node,
    attributes: attrs,
    children: node.children.map((c) => annotateNode(c, styleByContent)),
  };
}

export function serializeForAI(doc: EditorDocument): string {
  // One map per call so dedupe scope == "this serialize_for_ai output". A
  // selection serialized again later starts fresh, which is fine: we always
  // want at least one full copy of the CSS in whatever the AI sees this turn.
  const styleByContent = new Map<string, string>();
  const annotated: EditorDocument = {
    children: doc.children.map((n) => annotateNode(n, styleByContent)),
  };
  return serializeDocument(annotated, { pretty: true });
}

function stripIdAttr(node: EditorNode): EditorNode {
  if (!isElement(node)) return node;
  // Drop any data-edit-id the AI included; parseHtml already gave us a fresh id.
  const { [ID_ATTR]: _omit, ...rest } = node.attributes;
  void _omit;
  return {
    ...node,
    attributes: rest,
    children: node.children.map(stripIdAttr),
  };
}

export function parseFragment(html: string): EditorNode[] {
  const parsed = parseHtml(html, { collapseWhitespace: false });
  return parsed.children.map(stripIdAttr);
}
