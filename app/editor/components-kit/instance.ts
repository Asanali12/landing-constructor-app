// Helpers for working with component instances in the editor's document.
// A component instance is just an ElementNode with data-component="<id>"
// (and optionally data-locked="true"); these helpers walk the subtree,
// resolve prop slots, and read/write their values.

import { parseHtml } from "../parse";
import type { EditorDocument, EditorNode, ElementNode } from "../types";
import { isElement } from "../types";
import type { Binding, ComponentDef, PropSchema } from "./types";
import { bindingFor } from "./types";
import { findComponentDef } from "./registry";

const COMPONENT_ATTR = "data-component";
const LOCKED_ATTR = "data-locked";

export function isComponentRoot(node: EditorNode): node is ElementNode {
  return isElement(node) && COMPONENT_ATTR in node.attributes;
}

export function isLocked(node: ElementNode): boolean {
  return node.attributes[LOCKED_ATTR] === "true";
}

export function componentIdOf(node: ElementNode): string | null {
  return node.attributes[COMPONENT_ATTR] ?? null;
}

// Walk up from `id` looking for the innermost ancestor with data-component;
// if it's locked, return its id (so callers can redirect selection there).
// Returns null if no such ancestor exists or the nearest one is unlocked.
export function findLockedComponentAncestor(
  doc: EditorDocument,
  startId: string
): string | null {
  // Build parent index lazily.
  const parentOf = new Map<string, ElementNode>();
  const stack: ElementNode[] = doc.children.filter(isElement);
  while (stack.length > 0) {
    const el = stack.shift()!;
    for (const c of el.children) {
      if (isElement(c)) {
        parentOf.set(c.id, el);
        stack.push(c);
      } else {
        parentOf.set(c.id, el);
      }
    }
  }
  let cur = parentOf.get(startId) ?? null;
  while (cur) {
    if (isComponentRoot(cur) && isLocked(cur)) return cur.id;
    cur = parentOf.get(cur.id) ?? null;
  }
  return null;
}

// Find the first descendant element (or the root itself) that carries
// data-prop-<binding>="<name>". Returns null if no slot is present —
// the sidebar form will surface this as a missing-slot warning.
export function findSlot(
  root: ElementNode,
  propName: string,
  binding: Binding
): ElementNode | null {
  const attr = `data-prop-${binding}`;
  const stack: ElementNode[] = [root];
  while (stack.length > 0) {
    const el = stack.shift()!;
    if (el.attributes[attr] === propName) return el;
    for (const c of el.children) {
      if (isElement(c)) stack.push(c);
    }
  }
  return null;
}

// Read the current value of a prop from the slot. For text bindings, joins
// all direct text-child content; for attr bindings, reads the attribute.
export function readPropValue(slot: ElementNode, binding: Binding): string {
  if (binding === "text") {
    return slot.children
      .map((c) => (c.kind === "text" ? c.text : ""))
      .join("");
  }
  return slot.attributes[binding] ?? "";
}

// Build a fresh component instance from a registry def. Parses the
// template, mints fresh ids (parseHtml already does this), and asserts
// that the result has exactly one element root.
export function buildInstance(def: ComponentDef): ElementNode | null {
  const parsed = parseHtml(def.template, { collapseWhitespace: true });
  const elements = parsed.children.filter(isElement);
  if (elements.length !== 1) return null;
  return elements[0];
}

// Convenience: the schema list for a node, if it's a recognised component.
export function schemaFor(node: ElementNode): PropSchema[] | null {
  const id = componentIdOf(node);
  if (!id) return null;
  const def = findComponentDef(id);
  return def ? def.props : null;
}

// ─── Swiper-specific helpers ──────────────────────────────────────────
//
// The swiper component's slide count is editable from the right sidebar.
// These helpers make it easy to walk the swiper's DOM to find the track,
// list slides, and figure out the next slide-N number to mint when the
// user clicks "+ Add slide".
//
// They're swiper-specific (look for data-swiper-track / data-swiper-slide)
// rather than a generic "repeatable group" abstraction — the latter would
// be cleaner architecture but a much larger change. If accordion or
// feature-grid ever need the same feature, factor up at that point.

export function findSwiperTrack(swiperRoot: ElementNode): ElementNode | null {
  // BFS for descendant carrying data-swiper-track. The track sits one or
  // two levels below the root depending on whether the template wraps the
  // track in an overflow:hidden div (the testimonial template does).
  const stack: ElementNode[] = [swiperRoot];
  while (stack.length > 0) {
    const cur = stack.shift()!;
    if ("data-swiper-track" in cur.attributes) return cur;
    for (const c of cur.children) if (isElement(c)) stack.push(c);
  }
  return null;
}

export function getSwiperSlides(swiperRoot: ElementNode): ElementNode[] {
  const track = findSwiperTrack(swiperRoot);
  if (!track) return [];
  return track.children
    .filter(isElement)
    .filter((c) => "data-swiper-slide" in c.attributes);
}

// Extract the slide-N prefix used inside this slide's data-prop-* attrs.
// Returns null if no slide-N attribute exists (e.g. user renamed slots
// while unlocked) — the caller then falls back to picking the next free
// number across all slides.
export function slideNumberOf(slide: ElementNode): number | null {
  const stack: ElementNode[] = [slide];
  while (stack.length > 0) {
    const cur = stack.shift()!;
    for (const value of Object.values(cur.attributes)) {
      const match = /^slide-(\d+)-/.exec(value);
      if (match) return parseInt(match[1], 10);
    }
    for (const c of cur.children) if (isElement(c)) stack.push(c);
  }
  return null;
}

// Highest slide-N referenced anywhere across the given slides. Used to
// pick the next mintable slide number when adding a slide — robust to
// gaps in numbering (e.g. slide-1, slide-3 → next is 4, not 3).
export function maxSlideNumber(slides: ElementNode[]): number {
  let max = 0;
  for (const slide of slides) {
    const n = slideNumberOf(slide);
    if (n !== null && n > max) max = n;
  }
  return max;
}

export { bindingFor };
