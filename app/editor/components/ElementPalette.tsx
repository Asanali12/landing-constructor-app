"use client";

import { PALETTE, PALETTE_CATEGORIES, VOID_ELEMENTS } from "../constants";
import { useEditor } from "../store";
import { isElement } from "../types";
import { findNode } from "../tree-ops";

export function ElementPalette() {
  const { state, insertFromPalette } = useEditor();

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
