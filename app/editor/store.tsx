"use client";

import {
  createContext,
  useContext,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";
import {
  DEFAULT_DESKTOP_WIDTH_PX,
  MOBILE_BREAKPOINT_PX,
  VOID_ELEMENTS,
  type PaletteItem,
} from "./constants";
import { makeId } from "./id";
import { parseHtml } from "./parse";
import {
  buildElementFromPalette,
  deleteNode as deleteNodeOp,
  duplicateNode as duplicateNodeOp,
  findNode,
  findParent,
  insertChildLast,
  insertSibling,
  updateNode,
} from "./tree-ops";
import type {
  EditorDocument,
  EditorNode,
  EventBinding,
  NodeId,
} from "./types";
import { isElement } from "./types";

export type Viewport = "desktop" | "mobile";

type State = {
  // Two parallel documents — one per viewport. The user edits one at a time;
  // merged export combines them into a single responsive HTML file.
  docs: Record<Viewport, EditorDocument>;
  // Single source of truth for "what size is the canvas". activeViewport is
  // derived from this — picking a width at or below MOBILE_BREAKPOINT_PX
  // switches the editor to the mobile doc, and vice versa.
  viewportWidth: number;
  activeViewport: Viewport;
  // Mirror of docs[activeViewport] so existing consumers can keep using
  // state.doc unchanged.
  doc: EditorDocument;
  selectedId: NodeId | null;
  expanded: Record<NodeId, boolean>;
};

type Action =
  | { type: "load_html"; html: string; viewport?: Viewport }
  | { type: "set_document"; doc: EditorDocument; viewport?: Viewport }
  | { type: "set_viewport_width"; width: number }
  | { type: "select"; id: NodeId | null }
  | { type: "insert_palette"; item: PaletteItem }
  | { type: "update_text"; id: NodeId; text: string }
  | { type: "update_tag"; id: NodeId; tag: string }
  | { type: "set_attr"; id: NodeId; key: string; value: string }
  | { type: "rename_attr"; id: NodeId; oldKey: string; newKey: string }
  | { type: "remove_attr"; id: NodeId; key: string }
  | { type: "delete_node"; id: NodeId }
  | { type: "duplicate_node"; id: NodeId }
  | { type: "wrap_text"; id: NodeId; text: string }
  | { type: "set_events"; id: NodeId; events: EventBinding[] }
  | { type: "toggle_expanded"; id: NodeId }
  | { type: "expand"; id: NodeId };

const emptyDoc: EditorDocument = { children: [] };

const initialState: State = {
  docs: { desktop: emptyDoc, mobile: emptyDoc },
  viewportWidth: DEFAULT_DESKTOP_WIDTH_PX,
  activeViewport: "desktop",
  doc: emptyDoc,
  selectedId: null,
  expanded: {},
};

function viewportFromWidth(width: number): Viewport {
  return width <= MOBILE_BREAKPOINT_PX ? "mobile" : "desktop";
}

// Replace the active doc and keep the docs map / mirror in sync. Used by every
// reducer case that mutates the current viewport's document.
function withActiveDoc(state: State, doc: EditorDocument): State {
  return {
    ...state,
    doc,
    docs: { ...state.docs, [state.activeViewport]: doc },
  };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "load_html": {
      const doc = parseHtml(action.html);
      const target = action.viewport ?? state.activeViewport;
      // If loading into the active viewport, also reset selection/expanded
      // (selected ids belong to the old document).
      if (target === state.activeViewport) {
        return {
          ...state,
          doc,
          docs: { ...state.docs, [target]: doc },
          selectedId: null,
          expanded: {},
        };
      }
      return {
        ...state,
        docs: { ...state.docs, [target]: doc },
      };
    }
    case "set_document": {
      const target = action.viewport ?? state.activeViewport;
      if (target === state.activeViewport) {
        return {
          ...state,
          doc: action.doc,
          docs: { ...state.docs, [target]: action.doc },
          selectedId: null,
          expanded: {},
        };
      }
      return {
        ...state,
        docs: { ...state.docs, [target]: action.doc },
      };
    }
    case "set_viewport_width": {
      const width = action.width;
      const next = viewportFromWidth(width);
      if (next === state.activeViewport) {
        return { ...state, viewportWidth: width };
      }
      // Crossing the breakpoint switches the active doc. Selection and
      // expansion are doc-specific, so they reset.
      return {
        ...state,
        viewportWidth: width,
        activeViewport: next,
        doc: state.docs[next],
        selectedId: null,
        expanded: {},
      };
    }
    case "select": {
      return { ...state, selectedId: action.id };
    }
    case "insert_palette": {
      const newNode = buildElementFromPalette(action.item);
      const sel = state.selectedId ? findNode(state.doc, state.selectedId) : null;

      let nextDoc: EditorDocument;
      let nextExpanded = state.expanded;

      if (sel && isElement(sel) && !VOID_ELEMENTS.has(sel.tag)) {
        nextDoc = insertChildLast(state.doc, sel.id, newNode);
        nextExpanded = { ...state.expanded, [sel.id]: true };
      } else if (sel) {
        // Selected node is a text node or void — insert as next sibling.
        nextDoc = insertSibling(state.doc, sel.id, newNode, "after");
      } else {
        nextDoc = insertChildLast(state.doc, null, newNode);
      }

      return {
        ...withActiveDoc(state, nextDoc),
        selectedId: newNode.id,
        expanded: nextExpanded,
      };
    }
    case "update_text": {
      const doc = updateNode(state.doc, action.id, (n) =>
        n.kind === "text" ? { ...n, text: action.text } : n
      );
      return withActiveDoc(state, doc);
    }
    case "update_tag": {
      const tag = action.tag.trim().toLowerCase();
      if (!tag) return state;
      const doc = updateNode(state.doc, action.id, (n) =>
        isElement(n) ? { ...n, tag } : n
      );
      return withActiveDoc(state, doc);
    }
    case "set_attr": {
      const doc = updateNode(state.doc, action.id, (n) =>
        isElement(n)
          ? { ...n, attributes: { ...n.attributes, [action.key]: action.value } }
          : n
      );
      return withActiveDoc(state, doc);
    }
    case "rename_attr": {
      if (action.oldKey === action.newKey) return state;
      const doc = updateNode(state.doc, action.id, (n) => {
        if (!isElement(n)) return n;
        const next: Record<string, string> = {};
        for (const [k, v] of Object.entries(n.attributes)) {
          if (k === action.oldKey) next[action.newKey] = v;
          else next[k] = v;
        }
        return { ...n, attributes: next };
      });
      return withActiveDoc(state, doc);
    }
    case "remove_attr": {
      const doc = updateNode(state.doc, action.id, (n) => {
        if (!isElement(n)) return n;
        const next = { ...n.attributes };
        delete next[action.key];
        return { ...n, attributes: next };
      });
      return withActiveDoc(state, doc);
    }
    case "delete_node": {
      const doc = deleteNodeOp(state.doc, action.id);
      const selectedId = state.selectedId === action.id ? null : state.selectedId;
      return { ...withActiveDoc(state, doc), selectedId };
    }
    case "duplicate_node": {
      const { doc, newId } = duplicateNodeOp(state.doc, action.id);
      return { ...withActiveDoc(state, doc), selectedId: newId ?? state.selectedId };
    }
    case "wrap_text": {
      // Replace entire children of the element with a single text child.
      const doc = updateNode(state.doc, action.id, (n) => {
        if (!isElement(n)) return n;
        if (action.text === "") return { ...n, children: [] };
        const existingText = n.children.find((c) => c.kind === "text");
        if (existingText) {
          return {
            ...n,
            children: n.children.map((c) =>
              c.kind === "text" && c.id === existingText.id
                ? { ...c, text: action.text }
                : c
            ),
          };
        }
        return {
          ...n,
          children: [
            ...n.children,
            { id: makeId("t"), kind: "text", text: action.text },
          ],
        };
      });
      return withActiveDoc(state, doc);
    }
    case "set_events": {
      // The editor UI owns all the nested-mutation logic for action trees and
      // dispatches a fully-replaced array. We just store it.
      const doc = updateNode(state.doc, action.id, (n) =>
        isElement(n) ? { ...n, events: action.events } : n
      );
      return withActiveDoc(state, doc);
    }
    case "toggle_expanded": {
      return {
        ...state,
        expanded: {
          ...state.expanded,
          [action.id]: !state.expanded[action.id],
        },
      };
    }
    case "expand": {
      return {
        ...state,
        expanded: { ...state.expanded, [action.id]: true },
      };
    }
    default:
      return state;
  }
}

type EditorContextValue = {
  state: State;
  selectedNode: EditorNode | null;
  selectedParent: ReturnType<typeof findParent>;
  loadHtml: (html: string, viewport?: Viewport) => void;
  setDocument: (doc: EditorDocument, viewport?: Viewport) => void;
  setViewportWidth: (width: number) => void;
  select: (id: NodeId | null) => void;
  insertFromPalette: (item: PaletteItem) => void;
  updateText: (id: NodeId, text: string) => void;
  updateTag: (id: NodeId, tag: string) => void;
  setAttr: (id: NodeId, key: string, value: string) => void;
  renameAttr: (id: NodeId, oldKey: string, newKey: string) => void;
  removeAttr: (id: NodeId, key: string) => void;
  deleteNode: (id: NodeId) => void;
  duplicateNode: (id: NodeId) => void;
  setInnerText: (id: NodeId, text: string) => void;
  setEvents: (id: NodeId, events: EventBinding[]) => void;
  toggleExpanded: (id: NodeId) => void;
  expand: (id: NodeId) => void;
};

const EditorContext = createContext<EditorContextValue | null>(null);

export function EditorProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const selectedNode = useMemo(
    () => (state.selectedId ? findNode(state.doc, state.selectedId) : null),
    [state.doc, state.selectedId]
  );

  const selectedParent = useMemo(
    () => (state.selectedId ? findParent(state.doc, state.selectedId) : null),
    [state.doc, state.selectedId]
  );

  const value = useMemo<EditorContextValue>(
    () => ({
      state,
      selectedNode,
      selectedParent,
      loadHtml: (html, viewport) =>
        dispatch({ type: "load_html", html, viewport }),
      setDocument: (doc, viewport) =>
        dispatch({ type: "set_document", doc, viewport }),
      setViewportWidth: (width) =>
        dispatch({ type: "set_viewport_width", width }),
      select: (id) => dispatch({ type: "select", id }),
      insertFromPalette: (item) => dispatch({ type: "insert_palette", item }),
      updateText: (id, text) => dispatch({ type: "update_text", id, text }),
      updateTag: (id, tag) => dispatch({ type: "update_tag", id, tag }),
      setAttr: (id, key, value) => dispatch({ type: "set_attr", id, key, value }),
      renameAttr: (id, oldKey, newKey) =>
        dispatch({ type: "rename_attr", id, oldKey, newKey }),
      removeAttr: (id, key) => dispatch({ type: "remove_attr", id, key }),
      deleteNode: (id) => dispatch({ type: "delete_node", id }),
      duplicateNode: (id) => dispatch({ type: "duplicate_node", id }),
      setInnerText: (id, text) => dispatch({ type: "wrap_text", id, text }),
      setEvents: (id, events) => dispatch({ type: "set_events", id, events }),
      toggleExpanded: (id) => dispatch({ type: "toggle_expanded", id }),
      expand: (id) => dispatch({ type: "expand", id }),
    }),
    [state, selectedNode, selectedParent]
  );

  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>;
}

export function useEditor(): EditorContextValue {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error("useEditor must be used inside EditorProvider");
  return ctx;
}

