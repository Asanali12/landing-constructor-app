"use client";

import { useEffect } from "react";
import { useEditor } from "../store";
import { getAncestors } from "../tree-ops";
import type { EditorNode } from "../types";

function nodeLabel(node: EditorNode): string {
  if (node.kind === "text") {
    const trimmed = node.text.trim();
    return trimmed ? `"${trimmed.slice(0, 24)}${trimmed.length > 24 ? "…" : ""}"` : "(text)";
  }
  const id = node.attributes.id ? `#${node.attributes.id}` : "";
  const cls = node.attributes.class
    ? "." + node.attributes.class.split(/\s+/).filter(Boolean).slice(0, 2).join(".")
    : "";
  return `${node.tag}${id}${cls}`;
}

function TreeRow({
  node,
  depth,
}: {
  node: EditorNode;
  depth: number;
}) {
  const {
    state,
    select,
    toggleExpanded,
    deleteNode,
    duplicateNode,
  } = useEditor();
  const isElement = node.kind === "element";
  const hasChildren = isElement && node.children.length > 0;
  const expanded = state.expanded[node.id] ?? depth < 1;
  const isSelected = state.selectedId === node.id;

  return (
    <div>
      <div
        className={`group flex items-center gap-1 px-2 py-1 text-xs cursor-pointer select-none ${
          isSelected
            ? "bg-blue-500/20 text-blue-700 dark:text-blue-300"
            : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
        }`}
        style={{ paddingLeft: 8 + depth * 12 }}
        onClick={(e) => {
          e.stopPropagation();
          select(node.id);
        }}
      >
        {hasChildren ? (
          <button
            type="button"
            className="w-4 h-4 flex items-center justify-center text-zinc-400 hover:text-zinc-700"
            onClick={(e) => {
              e.stopPropagation();
              toggleExpanded(node.id);
            }}
          >
            {expanded ? "▾" : "▸"}
          </button>
        ) : (
          <span className="w-4 inline-block" />
        )}
        <span className="truncate flex-1">
          {node.kind === "element" ? (
            <>
              <span className="text-zinc-400">{"<"}</span>
              <span className="text-blue-600 dark:text-blue-400">{node.tag}</span>
              <span className="text-zinc-400">{">"}</span>
              <span className="ml-1 text-zinc-500">{nodeLabel(node).replace(node.tag, "")}</span>
            </>
          ) : (
            <span className="text-zinc-500 italic">{nodeLabel(node)}</span>
          )}
        </span>
        <button
          type="button"
          className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-zinc-700 px-1"
          title="Duplicate"
          onClick={(e) => {
            e.stopPropagation();
            duplicateNode(node.id);
          }}
        >
          ⎘
        </button>
        <button
          type="button"
          className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-red-600 px-1"
          title="Delete"
          onClick={(e) => {
            e.stopPropagation();
            deleteNode(node.id);
          }}
        >
          ✕
        </button>
      </div>
      {isElement && expanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <TreeRow key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export function LayersTree() {
  const { state, expand } = useEditor();

  useEffect(() => {
    if (!state.selectedId) return;
    const ancestors = getAncestors(state.doc, state.selectedId);
    for (const id of ancestors) {
      if (!state.expanded[id]) expand(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.selectedId]);

  if (state.doc.children.length === 0) {
    return (
      <div className="text-xs text-zinc-400 p-4">
        No elements yet. Add one from the Components tab or import HTML.
      </div>
    );
  }

  return (
    <div className="text-xs">
      {state.doc.children.map((node) => (
        <TreeRow key={node.id} node={node} depth={0} />
      ))}
    </div>
  );
}
