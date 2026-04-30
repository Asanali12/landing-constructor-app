"use client";

import { useEffect, useState } from "react";
import { useEditor } from "../store";
import type { ElementNode } from "../types";
import { isElement } from "../types";
import { VOID_ELEMENTS } from "../constants";

function ElementProps({ node }: { node: ElementNode }) {
  const {
    updateTag,
    setAttr,
    renameAttr,
    removeAttr,
    setInnerText,
  } = useEditor();

  const [tagDraft, setTagDraft] = useState(node.tag);
  useEffect(() => setTagDraft(node.tag), [node.id, node.tag]);

  // Inline text content (only meaningful for elements with a single text child).
  const onlyTextChild =
    node.children.length === 1 && node.children[0].kind === "text"
      ? node.children[0]
      : null;
  const noChildrenAndNotVoid =
    node.children.length === 0 && !VOID_ELEMENTS.has(node.tag);
  const showTextEditor = onlyTextChild !== null || noChildrenAndNotVoid;

  const [textDraft, setTextDraft] = useState(onlyTextChild?.text ?? "");
  useEffect(() => {
    setTextDraft(onlyTextChild?.text ?? "");
  }, [node.id, onlyTextChild?.id, onlyTextChild?.text]);

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

      <Section title="Events" action={<span className="text-[10px] text-zinc-400">coming soon</span>}>
        <p className="text-zinc-400 text-[10px]">
          Bind editor actions (e.g. open modal, navigate, submit) to interactive
          elements. The data model already supports an <code>events</code>{" "}
          array on each node.
        </p>
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
  const [keyDraft, setKeyDraft] = useState(attrKey);
  useEffect(() => setKeyDraft(attrKey), [attrKey]);

  return (
    <div className="flex items-center gap-1">
      <input
        value={keyDraft}
        onChange={(e) => setKeyDraft(e.target.value)}
        onBlur={() => {
          const next = keyDraft.trim();
          if (next && next !== attrKey) onRename(next);
          else setKeyDraft(attrKey);
        }}
        className={`${inputClass} w-1/3 font-mono`}
      />
      <input
        value={attrValue}
        onChange={(e) => onValue(e.target.value)}
        className={`${inputClass} flex-1 font-mono`}
      />
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

const inputClass =
  "w-full px-2 py-1 text-xs rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 focus:outline-none focus:border-blue-400";

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
  const { selectedNode, updateText } = useEditor();

  return (
    <aside
      style={{ width }}
      className="shrink-0 border-l border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex flex-col min-w-0"
    >
      <div className="px-3 py-2 border-b border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500">
        Properties
      </div>
      <div className="flex-1 overflow-auto p-3">
        {!selectedNode && (
          <div className="text-zinc-400 text-xs">
            Select an element to edit its properties.
          </div>
        )}
        {selectedNode && isElement(selectedNode) && <ElementProps node={selectedNode} />}
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
    </aside>
  );
}
