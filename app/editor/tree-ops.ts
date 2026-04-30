import { VOID_ELEMENTS, PALETTE, type PaletteItem } from "./constants";
import { makeId } from "./id";
import type {
  Action,
  EditorDocument,
  EditorNode,
  ElementNode,
  EventBinding,
  NodeId,
  TextNode,
} from "./types";
import { isElement } from "./types";

// Deep-clone an action tree with fresh ids at every level. Necessary so that
// duplicating an element doesn't leave the new node's actions sharing array
// references with the original.
function cloneActions(actions: Action[]): Action[] {
  return actions.map((a) => {
    const id = makeId("act");
    switch (a.kind) {
      case "ifElse":
        return {
          ...a,
          id,
          then: cloneActions(a.then),
          else: cloneActions(a.else),
        };
      case "setTimeout":
        return { ...a, id, actions: cloneActions(a.actions) };
      default:
        return { ...a, id };
    }
  });
}

function cloneEvents(events: EventBinding[] | undefined): EventBinding[] | undefined {
  if (!events) return undefined;
  return events.map((b) => ({
    id: makeId("evt"),
    event: b.event,
    actions: cloneActions(b.actions),
  }));
}

export function findNode(
  doc: EditorDocument,
  id: NodeId
): EditorNode | null {
  const stack: EditorNode[] = [...doc.children];
  while (stack.length) {
    const n = stack.shift()!;
    if (n.id === id) return n;
    if (isElement(n)) stack.push(...n.children);
  }
  return null;
}

export function findParent(
  doc: EditorDocument,
  id: NodeId
): { parent: ElementNode | null; index: number } | null {
  const topIdx = doc.children.findIndex((c) => c.id === id);
  if (topIdx >= 0) return { parent: null, index: topIdx };

  const stack: ElementNode[] = doc.children.filter(isElement);
  while (stack.length) {
    const el = stack.shift()!;
    const idx = el.children.findIndex((c) => c.id === id);
    if (idx >= 0) return { parent: el, index: idx };
    for (const c of el.children) if (isElement(c)) stack.push(c);
  }
  return null;
}

export function getAncestors(
  doc: EditorDocument,
  id: NodeId
): NodeId[] {
  const path: NodeId[] = [];
  let current = id;
  while (true) {
    const found = findParent(doc, current);
    if (!found || !found.parent) break;
    path.push(found.parent.id);
    current = found.parent.id;
  }
  return path;
}

function mapTree(
  nodes: EditorNode[],
  fn: (n: EditorNode) => EditorNode | null
): EditorNode[] {
  const out: EditorNode[] = [];
  for (const n of nodes) {
    if (isElement(n)) {
      const newChildren = mapTree(n.children, fn);
      const newNode: ElementNode = { ...n, children: newChildren };
      const result = fn(newNode);
      if (result) out.push(result);
    } else {
      const result = fn(n);
      if (result) out.push(result);
    }
  }
  return out;
}

export function updateNode(
  doc: EditorDocument,
  id: NodeId,
  updater: (n: EditorNode) => EditorNode
): EditorDocument {
  return {
    children: mapTree(doc.children, (n) => (n.id === id ? updater(n) : n)),
  };
}

export function deleteNode(doc: EditorDocument, id: NodeId): EditorDocument {
  return {
    children: mapTree(doc.children, (n) => (n.id === id ? null : n)),
  };
}

function cloneNode(node: EditorNode): EditorNode {
  if (node.kind === "text") {
    return { id: makeId("t"), kind: "text", text: node.text };
  }
  return {
    id: makeId(node.tag),
    kind: "element",
    tag: node.tag,
    attributes: { ...node.attributes },
    children: node.children.map(cloneNode),
    events: cloneEvents(node.events),
  };
}

export function duplicateNode(
  doc: EditorDocument,
  id: NodeId
): { doc: EditorDocument; newId: NodeId | null } {
  const found = findParent(doc, id);
  if (!found) return { doc, newId: null };

  const original = findNode(doc, id);
  if (!original) return { doc, newId: null };

  const clone = cloneNode(original);

  if (!found.parent) {
    const newChildren = [...doc.children];
    newChildren.splice(found.index + 1, 0, clone);
    return { doc: { children: newChildren }, newId: clone.id };
  }

  const newDoc = updateNode(doc, found.parent.id, (n) => {
    if (!isElement(n)) return n;
    const newChildren = [...n.children];
    newChildren.splice(found.index + 1, 0, clone);
    return { ...n, children: newChildren };
  });
  return { doc: newDoc, newId: clone.id };
}

export function buildElementFromPalette(item: PaletteItem): ElementNode {
  const node: ElementNode = {
    id: makeId(item.tag),
    kind: "element",
    tag: item.tag,
    attributes: { ...(item.defaultAttributes ?? {}) },
    children: [],
  };
  if (item.defaultText !== undefined && !VOID_ELEMENTS.has(item.tag)) {
    if (item.defaultText !== "") {
      const textNode: TextNode = {
        id: makeId("t"),
        kind: "text",
        text: item.defaultText,
      };
      node.children.push(textNode);
    }
  }
  return node;
}

export function paletteByLabel(label: string): PaletteItem | undefined {
  return PALETTE.find((p) => p.label === label);
}

export function insertChildLast(
  doc: EditorDocument,
  parentId: NodeId | null,
  newNode: EditorNode
): EditorDocument {
  if (!parentId) {
    return { children: [...doc.children, newNode] };
  }
  return updateNode(doc, parentId, (n) => {
    if (!isElement(n)) return n;
    if (VOID_ELEMENTS.has(n.tag)) return n;
    return { ...n, children: [...n.children, newNode] };
  });
}

export function insertSibling(
  doc: EditorDocument,
  refId: NodeId,
  newNode: EditorNode,
  position: "before" | "after"
): EditorDocument {
  const found = findParent(doc, refId);
  if (!found) return doc;

  const insertAt = position === "before" ? found.index : found.index + 1;

  if (!found.parent) {
    const next = [...doc.children];
    next.splice(insertAt, 0, newNode);
    return { children: next };
  }

  return updateNode(doc, found.parent.id, (n) => {
    if (!isElement(n)) return n;
    const next = [...n.children];
    next.splice(insertAt, 0, newNode);
    return { ...n, children: next };
  });
}

export function isDescendant(
  doc: EditorDocument,
  ancestorId: NodeId,
  candidateId: NodeId
): boolean {
  const node = findNode(doc, ancestorId);
  if (!node || !isElement(node)) return false;
  const stack: EditorNode[] = [...node.children];
  while (stack.length) {
    const n = stack.shift()!;
    if (n.id === candidateId) return true;
    if (isElement(n)) stack.push(...n.children);
  }
  return false;
}
