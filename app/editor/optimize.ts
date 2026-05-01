// Safe-pass document optimizer. Run on import to clean up Framer-style noise
// without touching anything CSS or runtime depends on.
//
// What it does (all reversible from the user's POV — preview still renders
// the same page, export still produces equivalent markup):
//
//   1. Dedupe identical <style> blocks across the whole document. CSS rules
//      are global; duplicate blocks are no-ops, so we keep the first and
//      drop the rest.
//   2. Strip framework-internal attributes (`parentsize`, `rotation`,
//      `shadows`, anything `_`-prefixed, `data-framer-*`, free-form
//      `name="..."`). These never affect rendering.
//   3. Remove genuinely empty elements — no children (after recursing),
//      no attributes (after stripping), no events, and not a void/replaced
//      element. Empty wrappers can't carry layout because they have no
//      class / no inline style.
//
// What it deliberately does NOT do (would need per-document review):
//   - Collapse non-empty wrapper <div> chains. Framer relies on wrapper
//     depth for grid/flex layout.
//   - Strip class / inline style. The kept <style> blocks are keyed off
//     those classnames.

import { serializeDocument } from "./serialize";
import type { EditorDocument, EditorNode, ElementNode } from "./types";
import { isElement } from "./types";

export type OptimizationStats = {
  beforeChars: number;
  beforeLines: number;
  afterChars: number;
  afterLines: number;
  duplicateStyleBlocksRemoved: number;
  attrsStripped: number;
  emptyElementsRemoved: number;
};

const FRAMEWORK_ATTR_NAMES = new Set(["parentsize", "rotation", "shadows"]);

const VOID_TAGS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

function isFrameworkAttr(key: string, value: string): boolean {
  if (FRAMEWORK_ATTR_NAMES.has(key)) return true;
  if (key.startsWith("_")) return true;
  if (key.startsWith("data-framer")) return true;
  // Free-form labels like name="Team Slides" — never used as form field
  // name (those are identifiers like "email" with no whitespace).
  if (key === "name" && /\s/.test(value)) return true;
  return false;
}

function isMeaninglessElement(node: ElementNode): boolean {
  if (VOID_TAGS.has(node.tag)) return false;
  if (node.children.length > 0) return false;
  if (node.events && node.events.length > 0) return false;
  if (Object.keys(node.attributes).length > 0) return false;
  return true;
}

function rawTextContent(node: ElementNode): string {
  return node.children.map((c) => (c.kind === "text" ? c.text : "")).join("");
}

type Counters = Pick<
  OptimizationStats,
  "duplicateStyleBlocksRemoved" | "attrsStripped" | "emptyElementsRemoved"
>;

function optimizeNodes(
  nodes: EditorNode[],
  styleSeen: Set<string>,
  counters: Counters
): EditorNode[] {
  const out: EditorNode[] = [];
  for (const n of nodes) {
    if (!isElement(n)) {
      out.push(n);
      continue;
    }

    // Style dedupe — whole-document scope.
    if (n.tag === "style") {
      const content = rawTextContent(n);
      if (content) {
        if (styleSeen.has(content)) {
          counters.duplicateStyleBlocksRemoved++;
          continue;
        }
        styleSeen.add(content);
      }
    }

    // Strip framework attributes.
    const newAttrs: Record<string, string> = {};
    for (const [k, v] of Object.entries(n.attributes)) {
      if (isFrameworkAttr(k, v)) {
        counters.attrsStripped++;
      } else {
        newAttrs[k] = v;
      }
    }

    // Recurse before testing emptiness — child cleanup can render a
    // wrapper-of-wrapper-of-nothing actually empty.
    const newChildren = optimizeNodes(n.children, styleSeen, counters);
    const cleaned: ElementNode = {
      ...n,
      attributes: newAttrs,
      children: newChildren,
    };

    if (isMeaninglessElement(cleaned)) {
      counters.emptyElementsRemoved++;
      continue;
    }
    out.push(cleaned);
  }
  return out;
}

export function optimizeDocument(
  doc: EditorDocument
): { doc: EditorDocument; stats: OptimizationStats } {
  const beforeHtml = serializeDocument(doc, { pretty: true });

  const styleSeen = new Set<string>();
  const counters: Counters = {
    duplicateStyleBlocksRemoved: 0,
    attrsStripped: 0,
    emptyElementsRemoved: 0,
  };
  const optimized: EditorDocument = {
    children: optimizeNodes(doc.children, styleSeen, counters),
  };

  const afterHtml = serializeDocument(optimized, { pretty: true });

  return {
    doc: optimized,
    stats: {
      beforeChars: beforeHtml.length,
      beforeLines: beforeHtml.split("\n").length,
      afterChars: afterHtml.length,
      afterLines: afterHtml.split("\n").length,
      ...counters,
    },
  };
}
