"use client";

import { useState } from "react";
import { useEditor } from "../store";
import type { EditorNode, ElementNode } from "../types";
import { isElement } from "../types";
import { VOID_ELEMENTS } from "../constants";
import { EventsSection } from "./EventsSection";
import { ComponentProps } from "./ComponentProps";
import { isComponentRoot, isLocked } from "../components-kit/instance";

// Routes a selected element to the right panel:
//   - Component root + locked → component prop form only.
//   - Component root + unlocked → component prop form + raw element editor.
//   - Plain element → raw element editor.
function SelectedElementPanel({ node }: { node: ElementNode }) {
  const isComponent = isComponentRoot(node);
  const locked = isComponent && isLocked(node);
  return (
    <div className="space-y-4">
      {isComponent && <ComponentProps node={node} />}
      {!locked && <ElementProps node={node} />}
    </div>
  );
}

function ElementProps({ node }: { node: ElementNode }) {
  const {
    updateTag,
    setAttr,
    renameAttr,
    removeAttr,
    setInnerText,
  } = useEditor();

  // tagDraft / textDraft initialize once on mount. Selecting a different
  // element causes the parent to render this component with key={node.id},
  // which remounts and reinitializes — so we don't need setState-in-effect
  // to track prop changes. (The old effect pattern was cascading on every
  // keystroke and breaking attribute-value editing under React 19.)
  const [tagDraft, setTagDraft] = useState(node.tag);

  // Inline text content (only meaningful for elements with a single text child).
  const onlyTextChild =
    node.children.length === 1 && node.children[0].kind === "text"
      ? node.children[0]
      : null;
  const noChildrenAndNotVoid =
    node.children.length === 0 && !VOID_ELEMENTS.has(node.tag);
  const showTextEditor = onlyTextChild !== null || noChildrenAndNotVoid;

  const [textDraft, setTextDraft] = useState(onlyTextChild?.text ?? "");

  const className = node.attributes.class ?? "";
  const idAttr = node.attributes.id ?? "";
  const styleAttr = node.attributes.style ?? "";

  const otherAttrs = Object.entries(node.attributes).filter(
    ([k]) => k !== "class" && k !== "id" && k !== "style"
  );

  return (
    <div className="text-xs space-y-4">
      <Section title="Element">
        <Field label="Tag">
          <input
            value={tagDraft}
            onChange={(e) => setTagDraft(e.target.value)}
            onBlur={() => {
              if (tagDraft && tagDraft !== node.tag) {
                updateTag(node.id, tagDraft);
              } else {
                setTagDraft(node.tag);
              }
            }}
            className={inputClass}
          />
        </Field>
        <Field label="ID">
          <input
            value={idAttr}
            onChange={(e) => setAttr(node.id, "id", e.target.value)}
            className={inputClass}
            placeholder="(none)"
          />
        </Field>
      </Section>

      <Section title="Class">
        <input
          value={className}
          onChange={(e) => setAttr(node.id, "class", e.target.value)}
          className={inputClass}
          placeholder="space-separated classes"
        />
      </Section>

      <Section title="Inline style">
        <textarea
          value={styleAttr}
          onChange={(e) => setAttr(node.id, "style", e.target.value)}
          className={`${inputClass} h-20 font-mono`}
          placeholder="color: red; padding: 8px;"
        />
      </Section>

      {showTextEditor && (
        <Section title="Text content">
          <textarea
            value={textDraft}
            onChange={(e) => setTextDraft(e.target.value)}
            onBlur={() => setInnerText(node.id, textDraft)}
            className={`${inputClass} h-20`}
            placeholder="(empty)"
          />
          {!onlyTextChild && noChildrenAndNotVoid && (
            <p className="text-zinc-400 mt-1 text-[10px]">
              This will add a single text child to the element.
            </p>
          )}
          {node.children.length > 1 && (
            <p className="text-zinc-400 mt-1 text-[10px]">
              Element has multiple children — text editor disabled.
            </p>
          )}
        </Section>
      )}

      <Section
        title="Attributes"
        action={
          <button
            type="button"
            className="text-blue-600 text-[10px]"
            onClick={() => {
              let key = "data-attr";
              let i = 1;
              while (key in node.attributes) {
                key = `data-attr-${i++}`;
              }
              setAttr(node.id, key, "");
            }}
          >
            + Add
          </button>
        }
      >
        {otherAttrs.length === 0 && (
          <div className="text-zinc-400 text-[10px]">No other attributes.</div>
        )}
        <div className="space-y-1.5">
          {otherAttrs.map(([key, value]) => (
            <AttrRow
              key={key}
              attrKey={key}
              attrValue={value}
              onRename={(newKey) => renameAttr(node.id, key, newKey)}
              onValue={(newValue) => setAttr(node.id, key, newValue)}
              onRemove={() => removeAttr(node.id, key)}
            />
          ))}
        </div>
      </Section>

      <Section title="Events">
        <EventsSection node={node} />
      </Section>
    </div>
  );
}

function AttrRow({
  attrKey,
  attrValue,
  onRename,
  onValue,
  onRemove,
}: {
  attrKey: string;
  attrValue: string;
  onRename: (key: string) => void;
  onValue: (value: string) => void;
  onRemove: () => void;
}) {
  // Drafts for both fields — edits stay local until the user clicks Update.
  // The parent passes `key={attrKey}` on this row, so a successful rename
  // remounts the row and useState reinitializes from the new prop (no effect
  // needed — the previous prop-sync-in-effect pattern was tripping React 19's
  // cascading-render warning and breaking value-input editing on every
  // keystroke).
  const [keyDraft, setKeyDraft] = useState(attrKey);
  const [valueDraft, setValueDraft] = useState(attrValue);

  const trimmedKey = keyDraft.trim();
  const dirty =
    trimmedKey !== "" &&
    (trimmedKey !== attrKey || valueDraft !== attrValue);

  const commit = () => {
    if (!dirty) return;
    // Write the value first (under the old key) so the rename carries it
    // forward — rename_attr preserves the existing value.
    if (valueDraft !== attrValue) onValue(valueDraft);
    if (trimmedKey !== attrKey) onRename(trimmedKey);
  };

  return (
    <div className="flex items-center gap-1">
      <input
        value={keyDraft}
        onChange={(e) => setKeyDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
        }}
        className={`${inputBase} w-1/3 min-w-0 font-mono`}
      />
      <input
        value={valueDraft}
        onChange={(e) => setValueDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
        }}
        className={`${inputBase} flex-1 min-w-0 font-mono`}
      />
      <button
        type="button"
        onClick={commit}
        disabled={!dirty}
        className={`px-1 ${
          dirty
            ? "text-blue-600 hover:text-blue-800"
            : "text-zinc-300 dark:text-zinc-700 cursor-default"
        }`}
        title={dirty ? "Update" : "No changes"}
      >
        ✓
      </button>
      <button
        type="button"
        className="text-zinc-400 hover:text-red-600 px-1"
        onClick={onRemove}
        title="Remove"
      >
        ✕
      </button>
    </div>
  );
}

// Base input styling without a width — width is set per usage. Inputs that sit
// in a flex row (the AttrRow key/value pair) need to share space via w-1/3 /
// flex-1, and Tailwind's w-full would otherwise win the cascade and crush the
// value input to a tiny square.
const inputBase =
  "px-2 py-1 text-xs rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 focus:outline-none focus:border-blue-400";
const inputClass = `${inputBase} w-full`;

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <header className="flex items-center justify-between mb-1.5 text-[10px] uppercase tracking-wider text-zinc-500">
        <span>{title}</span>
        {action}
      </header>
      <div>{children}</div>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 mb-1.5">
      <span className="text-zinc-500 w-12 shrink-0">{label}</span>
      <div className="flex-1">{children}</div>
    </div>
  );
}

export function RightSidebar({ width }: { width: number }) {
  const { selectedNode, updateText, deleteNode } = useEditor();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <aside
      style={{ width }}
      className="shrink-0 border-l border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex flex-col min-w-0"
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500">
        <span>Properties</span>
        {selectedNode && (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            title="Delete this element"
            className="h-6 px-2 rounded text-[11px] font-medium border border-zinc-200 dark:border-zinc-800 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 hover:border-red-200 dark:hover:border-red-900"
          >
            Delete
          </button>
        )}
      </div>
      <div className="flex-1 overflow-auto p-3">
        {!selectedNode && (
          <div className="text-zinc-400 text-xs">
            Select an element to edit its properties.
          </div>
        )}
        {selectedNode && isElement(selectedNode) && (
          <SelectedElementPanel
            key={selectedNode.id}
            node={selectedNode}
          />
        )}
        {selectedNode && selectedNode.kind === "text" && (
          <div className="text-xs space-y-2">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500">
              Text node
            </div>
            <textarea
              defaultValue={selectedNode.text}
              onBlur={(e) => updateText(selectedNode.id, e.target.value)}
              className={`${inputClass} h-32`}
            />
          </div>
        )}
      </div>
      {confirmingDelete && selectedNode && (
        <ConfirmDelete
          summary={describeNodeForConfirm(selectedNode)}
          onCancel={() => setConfirmingDelete(false)}
          onConfirm={() => {
            deleteNode(selectedNode.id);
            setConfirmingDelete(false);
          }}
        />
      )}
    </aside>
  );
}

function describeNodeForConfirm(node: EditorNode): string {
  if (node.kind === "text") {
    const trimmed = node.text.trim();
    return trimmed
      ? `text "${trimmed.slice(0, 40)}${trimmed.length > 40 ? "…" : ""}"`
      : "empty text node";
  }
  const id = node.attributes.id ? `#${node.attributes.id}` : "";
  const cls = node.attributes.class
    ? "." + node.attributes.class.split(/\s+/).filter(Boolean).slice(0, 2).join(".")
    : "";
  return `<${node.tag}${id}${cls}>`;
}

function ConfirmDelete({
  summary,
  onCancel,
  onConfirm,
}: {
  summary: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm bg-white dark:bg-zinc-950 rounded-lg shadow-xl p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-semibold text-sm mb-2">Delete element?</h2>
        <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-4">
          This will remove <span className="font-mono">{summary}</span> and all
          of its children. This can&apos;t be undone.
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-8 px-3 text-xs font-medium rounded border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            autoFocus
            className="h-8 px-3 text-xs font-medium rounded bg-red-600 text-white hover:bg-red-700"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
