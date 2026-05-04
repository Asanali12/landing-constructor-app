"use client";

import { useEffect, useState } from "react";

import { PALETTE, PALETTE_CATEGORIES, VOID_ELEMENTS } from "../constants";
import { useEditor } from "../store";
import { isElement } from "../types";
import { findNode } from "../tree-ops";
import { COMPONENT_REGISTRY } from "../components-kit/registry";
import { buildInstance } from "../components-kit/instance";
import type { ComponentDef } from "../components-kit/types";
import {
  CHANGE_EVENT,
  loadUserComponents,
} from "../components-kit/user-registry";
import { ComponentEditorModal } from "./ComponentEditorModal";

// Subscribe to user-component CRUD events so the palette re-renders
// whenever the modal saves a change.
function useUserComponents(): ComponentDef[] {
  const [list, setList] = useState<ComponentDef[]>([]);
  useEffect(() => {
    const refresh = () => setList(loadUserComponents());
    refresh();
    window.addEventListener(CHANGE_EVENT, refresh);
    // Cross-tab updates flow through localStorage's `storage` event.
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(CHANGE_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  return list;
}

export function ElementPalette() {
  const { state, insertFromPalette, insertNode } = useEditor();
  const userComponents = useUserComponents();
  // null = closed; ComponentDef = editing that one; "create" = create new.
  const [editorState, setEditorState] = useState<
    "create" | { kind: "edit"; def: ComponentDef } | null
  >(null);

  const insertComponent = (def: ComponentDef) => {
    const node = buildInstance(def);
    if (node) insertNode(node);
  };

  const selected = state.selectedId
    ? findNode(state.doc, state.selectedId)
    : null;

  let target: string;
  if (!selected) {
    target = "the page root";
  } else if (
    isElement(selected) &&
    !VOID_ELEMENTS.has(selected.tag)
  ) {
    target = `<${selected.tag}>`;
  } else {
    const tag =
      selected.kind === "element" ? `<${selected.tag}/>` : "(text node)";
    target = `next to ${tag}`;
  }

  return (
    <div className="text-xs">
      <div className="px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
        <div className="text-zinc-500">Insert into</div>
        <div className="font-medium truncate">{target}</div>
      </div>

      <div>
        <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-zinc-400 bg-zinc-50/50 dark:bg-zinc-900/50">
          Components Kit
        </div>
        <div className="grid grid-cols-1 gap-1 p-2">
          {COMPONENT_REGISTRY.map((def) => (
            <button
              key={def.id}
              type="button"
              onClick={() => insertComponent(def)}
              className="text-left px-2 py-2 rounded border border-zinc-200 dark:border-zinc-800 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
            >
              <div className="font-medium">{def.label}</div>
              <div className="text-zinc-400 text-[10px] mt-0.5 truncate">
                {def.description}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-zinc-400 bg-zinc-50/50 dark:bg-zinc-900/50 flex items-center justify-between">
          <span>User components</span>
          <button
            type="button"
            onClick={() => setEditorState("create")}
            className="text-blue-600 hover:underline normal-case tracking-normal text-[11px]"
            title="Paste HTML and define prop slots"
          >
            + Create
          </button>
        </div>
        {userComponents.length === 0 ? (
          <div className="px-3 py-3 text-zinc-400 text-[11px] italic">
            None yet. Click <strong>+ Create</strong> to paste some HTML
            and turn it into a reusable component.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-1 p-2">
            {userComponents.map((def) => (
              <div
                key={def.id}
                className="group relative rounded border border-zinc-200 dark:border-zinc-800 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
              >
                <button
                  type="button"
                  onClick={() => insertComponent(def)}
                  className="w-full text-left px-2 py-2 pr-12"
                  title="Insert into the canvas"
                >
                  <div className="font-medium">{def.label}</div>
                  <div className="text-zinc-400 text-[10px] mt-0.5 truncate">
                    {def.description || "(no description)"}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditorState({ kind: "edit", def });
                  }}
                  className="absolute right-1.5 top-1.5 px-1.5 py-0.5 text-[10px] rounded text-zinc-500 hover:text-blue-600 hover:bg-white dark:hover:bg-zinc-950 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Edit slots / template"
                >
                  Edit
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {editorState === "create" && (
        <ComponentEditorModal
          def={null}
          onClose={() => setEditorState(null)}
        />
      )}
      {editorState && typeof editorState === "object" && (
        <ComponentEditorModal
          def={editorState.def}
          onClose={() => setEditorState(null)}
        />
      )}

      {PALETTE_CATEGORIES.map((cat) => (
        <div key={cat}>
          <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-zinc-400 bg-zinc-50/50 dark:bg-zinc-900/50">
            {cat}
          </div>
          <div className="grid grid-cols-2 gap-1 p-2">
            {PALETTE.filter((p) => p.category === cat).map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => insertFromPalette(item)}
                className="text-left px-2 py-2 rounded border border-zinc-200 dark:border-zinc-800 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
              >
                <div className="font-medium">{item.label}</div>
                <div className="text-zinc-400 text-[10px] mt-0.5">
                  &lt;{item.tag}&gt;
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
