// AI tool surface. Each entry pairs a JSON-schema definition (sent to the
// model) with a client-side executor (run when the model emits a tool call).
// Executors talk to the editor through a `ToolContext` — a flyweight object
// the chat panel rebuilds on every render so it always closes over the
// freshest state and dispatchers.

import { VOID_ELEMENTS } from "../constants";
import type {
  EditorDocument,
  EditorNode,
  ElementNode,
  EventBinding,
  NodeId,
} from "../types";
import { isElement } from "../types";
import {
  findNode,
  findParent,
  insertChildLast,
  insertSibling,
  updateNode,
} from "../tree-ops";
import { makeId } from "../id";
import { parseFragment } from "./serialize-for-ai";
import type { ToolDef } from "./types";
import type { Viewport } from "../store";

// --- ToolContext ---------------------------------------------------------

export type ToolContext = {
  getDoc: (viewport?: Viewport) => EditorDocument;
  getSelectedId: () => NodeId | null;
  getActiveViewport: () => Viewport;

  loadHtml: (html: string, viewport?: Viewport) => void;
  applyDoc: (doc: EditorDocument, viewport?: Viewport) => void;
  setAttr: (id: NodeId, key: string, value: string) => void;
  removeAttr: (id: NodeId, key: string) => void;
  renameAttr: (id: NodeId, oldKey: string, newKey: string) => void;
  updateTag: (id: NodeId, tag: string) => void;
  setInnerText: (id: NodeId, text: string) => void;
  updateText: (id: NodeId, text: string) => void;
  deleteNode: (id: NodeId) => void;
  duplicateNode: (id: NodeId) => void;
  setEvents: (id: NodeId, events: EventBinding[]) => void;
  select: (id: NodeId | null) => void;
};

export type ToolExecutor = (
  args: Record<string, unknown>,
  ctx: ToolContext
) => Promise<string>;

// --- helpers -------------------------------------------------------------

function strArg(args: Record<string, unknown>, key: string): string | undefined {
  const v = args[key];
  return typeof v === "string" ? v : undefined;
}

function requireStr(
  args: Record<string, unknown>,
  key: string
): string | { err: string } {
  const v = strArg(args, key);
  if (typeof v !== "string") return { err: `Missing required arg "${key}".` };
  return v;
}

function vp(args: Record<string, unknown>): Viewport | undefined {
  const v = strArg(args, "viewport");
  if (v === "desktop" || v === "mobile") return v;
  return undefined;
}

function buildStyleNode(css: string): ElementNode {
  return {
    id: makeId("style"),
    kind: "element",
    tag: "style",
    attributes: {},
    children: [{ id: makeId("t"), kind: "text", text: css }],
  };
}

// --- definitions ---------------------------------------------------------

export const TOOL_DEFS: ToolDef[] = [
  {
    name: "paste_html",
    description:
      "Paste generated HTML into the user's currently-selected element (as appended children). If no element is selected, the HTML is appended to the active viewport's document root instead. <style> blocks inside the HTML are auto-hoisted to the document root for proper CSS scoping. Returns the ids assigned to the inserted top-level nodes.",
    inputSchema: {
      type: "object",
      properties: { html: { type: "string" } },
      required: ["html"],
    },
  },
  {
    name: "select_node",
    description:
      "Set the editor's selection to the given node id. Pass null to clear selection.",
    inputSchema: {
      type: "object",
      properties: {
        node_id: { type: ["string", "null"] },
      },
      required: ["node_id"],
    },
  },
  {
    name: "insert_html",
    description:
      "Insert an HTML fragment into the document. Always provide a `mode`. " +
      "mode=\"append\": append children to target_id (or to document root if target_id is null). " +
      "mode=\"prepend\": prepend children to target_id (or document root if null). " +
      "mode=\"after\": insert as next sibling(s) of target_id. " +
      "Returns the ids assigned to the new top-level nodes.",
    inputSchema: {
      type: "object",
      properties: {
        mode: { type: "string", enum: ["append", "prepend", "after"] },
        target_id: { type: ["string", "null"] },
        html: { type: "string" },
      },
      required: ["mode", "html"],
    },
  },
  {
    name: "replace_node",
    description:
      "Replace a node (and its entire subtree) with the given HTML. Returns the ids of the new top-level nodes.",
    inputSchema: {
      type: "object",
      properties: {
        node_id: { type: "string" },
        html: { type: "string" },
      },
      required: ["node_id", "html"],
    },
  },
  {
    name: "update_attr",
    description:
      "Set or update one attribute on an element. Use this for surgical edits like changing href, src, class, alt — cheaper than rewriting the whole element.",
    inputSchema: {
      type: "object",
      properties: {
        node_id: { type: "string" },
        key: { type: "string" },
        value: { type: "string" },
      },
      required: ["node_id", "key", "value"],
    },
  },
  {
    name: "remove_attr",
    description: "Remove a single attribute from an element.",
    inputSchema: {
      type: "object",
      properties: {
        node_id: { type: "string" },
        key: { type: "string" },
      },
      required: ["node_id", "key"],
    },
  },
  {
    name: "rename_attr",
    description: "Rename an attribute key on an element (preserves its value).",
    inputSchema: {
      type: "object",
      properties: {
        node_id: { type: "string" },
        old_key: { type: "string" },
        new_key: { type: "string" },
      },
      required: ["node_id", "old_key", "new_key"],
    },
  },
  {
    name: "remove_node",
    description: "Delete a node (and its subtree) from the document.",
    inputSchema: {
      type: "object",
      properties: { node_id: { type: "string" } },
      required: ["node_id"],
    },
  },
  {
    name: "duplicate_node",
    description:
      "Clone a node (with fresh ids for every descendant) and insert the copy as the next sibling.",
    inputSchema: {
      type: "object",
      properties: { node_id: { type: "string" } },
      required: ["node_id"],
    },
  },
  {
    name: "add_style_block",
    description:
      "Append a `<style>` block containing the given CSS to the document. The export pipeline hoists `<style>` blocks into <head> automatically.",
    inputSchema: {
      type: "object",
      properties: { css: { type: "string" } },
      required: ["css"],
    },
  },
  {
    name: "set_events",
    description:
      "Replace all event bindings on an element. Use this (NOT inline on* attributes — those are stripped at parse time) to attach behaviors. " +
      "Each binding is { id, event, actions[] } where event is a DOM event name (\"click\", \"submit\", ...) and actions[] is an array of typed actions. " +
      "Action shapes: " +
      "{kind:\"goToLink\", id, url, newTab:bool}, " +
      "{kind:\"scrollTo\", id, selector, behavior:\"auto\"|\"smooth\"}, " +
      "{kind:\"customJs\", id, code} (function body, receives `event`), " +
      "{kind:\"analytics\", id, eventName, properties} (properties is a JSON object string), " +
      "{kind:\"writeUserData\", id, field, value}, " +
      "{kind:\"httpRequest\", id, url, method, headers, body}, " +
      "{kind:\"setTimeout\", id, delayMs, actions[]}, " +
      "{kind:\"ifElse\", id, condition, then[], else[]}. " +
      "Pass an empty array to clear all events. Server will mint fresh ids if any are missing.",
    inputSchema: {
      type: "object",
      properties: {
        node_id: { type: "string" },
        events: {
          type: "array",
          items: { type: "object" },
        },
      },
      required: ["node_id", "events"],
    },
  },
  {
    name: "replace_document",
    description:
      "Replace the entire document with parsed HTML. Resets the user's selection — prefer surgical tools when the change is local. Defaults to active viewport.",
    inputSchema: {
      type: "object",
      properties: {
        html: { type: "string" },
        viewport: { type: "string", enum: ["desktop", "mobile"] },
      },
      required: ["html"],
    },
  },
];

// --- executors -----------------------------------------------------------

export const TOOL_EXECUTORS: Record<string, ToolExecutor> = {
  paste_html: async (args, ctx) => {
    const html = strArg(args, "html") ?? "";
    if (!html.trim()) return "ERROR: html is required.";
    const fragment = parseFragment(html);
    if (fragment.length === 0) return "No nodes parsed from the given HTML.";

    // Split: <style> blocks go to the document root so their CSS scopes
    // globally; everything else lands inside the selected element.
    const styleBlocks: EditorNode[] = [];
    const bodyNodes: EditorNode[] = [];
    for (const n of fragment) {
      if (isElement(n) && n.tag === "style") styleBlocks.push(n);
      else bodyNodes.push(n);
    }

    const selId = ctx.getSelectedId();
    let nextDoc = ctx.getDoc();

    for (const s of styleBlocks) {
      nextDoc = insertChildLast(nextDoc, null, s);
    }

    let where: string;
    if (bodyNodes.length === 0) {
      where = "";
    } else if (selId) {
      const selNode = findNode(nextDoc, selId);
      if (!selNode) return `ERROR: selected node ${selId} not found.`;
      if (!isElement(selNode)) {
        return `ERROR: selected node ${selId} is text, cannot paste into it.`;
      }
      if (VOID_ELEMENTS.has(selNode.tag)) {
        return `ERROR: selected element <${selNode.tag}> is void and cannot contain children. Pick a different element.`;
      }
      nextDoc = updateNode(nextDoc, selId, (n) => {
        if (!isElement(n)) return n;
        return { ...n, children: [...n.children, ...bodyNodes] };
      });
      where = ` inside selected element ${selId}`;
    } else {
      for (const n of bodyNodes) {
        nextDoc = insertChildLast(nextDoc, null, n);
      }
      where = " at document root";
    }

    ctx.applyDoc(nextDoc);
    const ids = [...styleBlocks, ...bodyNodes].map((n) => n.id).join(", ");
    const styleNote =
      styleBlocks.length > 0
        ? ` (${styleBlocks.length} <style> block${styleBlocks.length === 1 ? "" : "s"} hoisted to doc root)`
        : "";
    return `Pasted ${bodyNodes.length} node${bodyNodes.length === 1 ? "" : "s"}${where}${styleNote}. New ids: ${ids}`;
  },

  select_node: async (args, ctx) => {
    const v = args["node_id"];
    if (v === null) {
      ctx.select(null);
      return "Cleared selection.";
    }
    if (typeof v !== "string") return "ERROR: node_id must be a string or null.";
    ctx.select(v);
    return `Selected ${v}.`;
  },

  insert_html: async (args, ctx) => {
    const mode = strArg(args, "mode");
    const html = requireStr(args, "html");
    if (typeof html !== "string") return html.err;
    if (mode !== "append" && mode !== "prepend" && mode !== "after") {
      return "ERROR: mode must be 'append', 'prepend', or 'after'.";
    }
    const targetIdRaw = args["target_id"];
    const targetId =
      typeof targetIdRaw === "string" ? targetIdRaw : null;

    const fragment = parseFragment(html);
    if (fragment.length === 0) return "No nodes parsed from the given HTML.";

    const doc = ctx.getDoc();
    let nextDoc: EditorDocument = doc;

    if (mode === "after") {
      if (!targetId)
        return "ERROR: target_id is required when mode is 'after'.";
      // Insert right-to-left so the original order is preserved at target+1, target+2, ...
      for (let i = fragment.length - 1; i >= 0; i--) {
        nextDoc = insertSibling(nextDoc, targetId, fragment[i], "after");
      }
    } else if (mode === "append") {
      for (const n of fragment) {
        nextDoc = insertChildLast(nextDoc, targetId, n);
      }
    } else {
      // prepend
      if (targetId === null) {
        nextDoc = { children: [...fragment, ...doc.children] };
      } else {
        nextDoc = updateNode(doc, targetId, (n) => {
          if (!isElement(n)) return n;
          return { ...n, children: [...fragment, ...n.children] };
        });
      }
    }

    ctx.applyDoc(nextDoc);
    return `Inserted ${fragment.length} node(s). New ids: ${fragment
      .map((n) => n.id)
      .join(", ")}`;
  },

  replace_node: async (args, ctx) => {
    const nodeId = requireStr(args, "node_id");
    if (typeof nodeId !== "string") return nodeId.err;
    const html = requireStr(args, "html");
    if (typeof html !== "string") return html.err;

    const fragment = parseFragment(html);
    if (fragment.length === 0) return "No nodes parsed from the given HTML.";

    const doc = ctx.getDoc();
    const found = findParent(doc, nodeId);
    if (!found) return `ERROR: node ${nodeId} not found.`;

    let nextDoc: EditorDocument;
    if (!found.parent) {
      const newChildren = [...doc.children];
      newChildren.splice(found.index, 1, ...fragment);
      nextDoc = { children: newChildren };
    } else {
      const parentId = found.parent.id;
      nextDoc = updateNode(doc, parentId, (n) => {
        if (!isElement(n)) return n;
        const newChildren = [...n.children];
        newChildren.splice(found.index, 1, ...fragment);
        return { ...n, children: newChildren };
      });
    }

    // If the user had the replaced node selected, drop the now-stale selection.
    if (ctx.getSelectedId() === nodeId) ctx.select(null);
    ctx.applyDoc(nextDoc);
    return `Replaced node ${nodeId} with ${fragment.length} node(s). New ids: ${fragment
      .map((n) => n.id)
      .join(", ")}`;
  },

  update_attr: async (args, ctx) => {
    const id = requireStr(args, "node_id");
    if (typeof id !== "string") return id.err;
    const key = requireStr(args, "key");
    if (typeof key !== "string") return key.err;
    const value = strArg(args, "value") ?? "";
    ctx.setAttr(id, key, value);
    return `Set ${key}="${value}" on ${id}.`;
  },

  remove_attr: async (args, ctx) => {
    const id = requireStr(args, "node_id");
    if (typeof id !== "string") return id.err;
    const key = requireStr(args, "key");
    if (typeof key !== "string") return key.err;
    ctx.removeAttr(id, key);
    return `Removed ${key} from ${id}.`;
  },

  rename_attr: async (args, ctx) => {
    const id = requireStr(args, "node_id");
    if (typeof id !== "string") return id.err;
    const oldKey = requireStr(args, "old_key");
    if (typeof oldKey !== "string") return oldKey.err;
    const newKey = requireStr(args, "new_key");
    if (typeof newKey !== "string") return newKey.err;
    ctx.renameAttr(id, oldKey, newKey);
    return `Renamed ${oldKey} → ${newKey} on ${id}.`;
  },

  remove_node: async (args, ctx) => {
    const id = requireStr(args, "node_id");
    if (typeof id !== "string") return id.err;
    ctx.deleteNode(id);
    return `Removed ${id}.`;
  },

  duplicate_node: async (args, ctx) => {
    const id = requireStr(args, "node_id");
    if (typeof id !== "string") return id.err;
    ctx.duplicateNode(id);
    return `Duplicated ${id}.`;
  },

  add_style_block: async (args, ctx) => {
    const css = strArg(args, "css") ?? "";
    if (!css.trim()) return "ERROR: css is empty.";
    const styleNode = buildStyleNode(css);
    const doc = ctx.getDoc();
    // Append to root so it sits alongside existing <style> nodes; merge.ts
    // will hoist it into <head> at export time.
    const nextDoc = insertChildLast(doc, null, styleNode);
    ctx.applyDoc(nextDoc);
    return `Added <style> block (id=${styleNode.id}, ${css.length} chars).`;
  },

  set_events: async (args, ctx) => {
    const id = requireStr(args, "node_id");
    if (typeof id !== "string") return id.err;
    const raw = args["events"];
    if (!Array.isArray(raw)) return "ERROR: events must be an array.";
    const events = raw.map(normalizeBinding).filter(
      (b): b is EventBinding => b !== null
    );
    ctx.setEvents(id, events);
    return `Set ${events.length} event binding(s) on ${id}.`;
  },

  replace_document: async (args, ctx) => {
    const html = requireStr(args, "html");
    if (typeof html !== "string") return html.err;
    ctx.loadHtml(html, vp(args));
    return "Replaced document.";
  },
};

// Best-effort coercion of an AI-supplied event binding into our EventBinding
// shape. Mints fresh ids where missing; keeps unknown action kinds as-is so
// the runtime can ignore them rather than crashing the chat loop.
function normalizeBinding(raw: unknown): EventBinding | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const event = typeof r.event === "string" ? r.event : null;
  if (!event) return null;
  const actions = Array.isArray(r.actions)
    ? r.actions.map(normalizeAction).filter((a): a is EventBinding["actions"][number] => a !== null)
    : [];
  return {
    id: typeof r.id === "string" ? r.id : makeId("evt"),
    event,
    actions,
  };
}

function normalizeAction(raw: unknown): EventBinding["actions"][number] | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const kind = r.kind;
  if (typeof kind !== "string") return null;
  const id = typeof r.id === "string" ? r.id : makeId("act");
  // Recursive nest for ifElse / setTimeout.
  if (kind === "ifElse") {
    return {
      id,
      kind: "ifElse",
      condition: typeof r.condition === "string" ? r.condition : "",
      then: Array.isArray(r.then)
        ? r.then.map(normalizeAction).filter(
            (a): a is EventBinding["actions"][number] => a !== null
          )
        : [],
      else: Array.isArray(r.else)
        ? r.else.map(normalizeAction).filter(
            (a): a is EventBinding["actions"][number] => a !== null
          )
        : [],
    };
  }
  if (kind === "setTimeout") {
    return {
      id,
      kind: "setTimeout",
      delayMs: typeof r.delayMs === "number" ? r.delayMs : 0,
      actions: Array.isArray(r.actions)
        ? r.actions.map(normalizeAction).filter(
            (a): a is EventBinding["actions"][number] => a !== null
          )
        : [],
    };
  }
  // Pass-through other kinds. We trust the AI to provide the right fields;
  // bad payloads are surfaced as runtime no-ops by events-runtime.ts.
  return { ...(r as object), id, kind } as EventBinding["actions"][number];
}

