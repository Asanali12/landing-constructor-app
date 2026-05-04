"use client";

import { useEffect, useState } from "react";

import { parseHtml } from "../parse";
import { isElement } from "../types";
import { COMPONENT_REGISTRY } from "../components-kit/registry";
import type {
  Binding,
  ComponentDef,
  PropSchema,
  PropType,
} from "../components-kit/types";
import {
  addUserComponent,
  deleteUserComponent,
  loadUserComponents,
  uniqueIdFor,
  updateUserComponent,
} from "../components-kit/user-registry";

const PROP_TYPES: PropType[] = ["text", "longText", "url", "image"];
const BINDINGS: Binding[] = ["text", "href", "src", "alt"];

const COMPONENT_ATTR = "data-component";
const LOCKED_ATTR = "data-locked";

// Modal for creating or editing a user component. `def` non-null = edit
// mode (saves over the existing id, exposes Delete). `def` null = create.
export function ComponentEditorModal({
  def,
  onClose,
}: {
  def: ComponentDef | null;
  onClose: () => void;
}) {
  const isEdit = def !== null;
  const [label, setLabel] = useState(def?.label ?? "");
  const [description, setDescription] = useState(def?.description ?? "");
  const [template, setTemplate] = useState(def?.template ?? "");
  const [locked, setLocked] = useState(def ? hasLockedRoot(def.template) : true);
  const [props, setProps] = useState<PropSchema[]>(def?.props ?? []);
  const [error, setError] = useState<string | null>(null);

  const onAutoDetect = () => {
    setError(null);
    try {
      const detected = autoDetectProps(template);
      // Merge: keep manually-edited rows that already match a detected
      // name; add rows for newly-discovered names; drop rows no longer
      // present in the HTML so the form stays in sync with the template.
      const byName = new Map(props.map((p) => [p.name, p]));
      const merged = detected.map(
        (d) => byName.get(d.name) ?? d
      );
      setProps(merged);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const onSave = () => {
    setError(null);
    if (!label.trim()) {
      setError("Name is required.");
      return;
    }
    if (!template.trim()) {
      setError("HTML template is required.");
      return;
    }
    let normalised: string;
    let id: string;
    try {
      const result = normaliseTemplate(template, locked, def?.id, label);
      normalised = result.html;
      id = result.id;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return;
    }
    const cleanedProps = props
      .map((p) => ({
        ...p,
        name: p.name.trim(),
        label: p.label.trim() || titleCase(p.name.trim()),
      }))
      .filter((p) => p.name);

    const newDef: ComponentDef = {
      id,
      label: label.trim(),
      description: description.trim(),
      template: normalised,
      props: cleanedProps,
    };

    if (isEdit) {
      updateUserComponent(def!.id, newDef);
    } else {
      addUserComponent(newDef);
    }
    onClose();
  };

  const onDelete = () => {
    if (!isEdit || !def) return;
    if (
      !window.confirm(
        `Delete "${def.label}"? Existing instances on the canvas will keep working but lose their prop schema.`
      )
    ) {
      return;
    }
    deleteUserComponent(def.id);
    onClose();
  };

  return (
    <Modal onClose={onClose} title={isEdit ? `Edit ${def!.label}` : "Create component"}>
      <div className="text-xs space-y-3 max-h-[70vh] overflow-y-auto pr-1">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-zinc-500">Name</label>
            <input
              value={label}
              autoFocus
              onChange={(e) => setLabel(e.target.value)}
              placeholder="My card"
              className={inputCls}
            />
          </div>
          <div className="space-y-1">
            <label className="text-zinc-500">Description</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this component is for"
              className={inputCls}
            />
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-zinc-500">HTML template</label>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={locked}
                  onChange={(e) => setLocked(e.target.checked)}
                />
                <span className="text-zinc-500">Lock children</span>
              </label>
              <button
                type="button"
                onClick={onAutoDetect}
                disabled={!template.trim()}
                className={btnTertiary}
              >
                Auto-detect props
              </button>
            </div>
          </div>
          <textarea
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            placeholder={SAMPLE_TEMPLATE_HINT}
            spellCheck={false}
            className="w-full h-48 p-2 font-mono text-[11px] rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 focus:outline-none focus:border-blue-400"
          />
          <p className="text-[10px] text-zinc-500 leading-snug">
            Must be exactly one root element. Mark editable spots with{" "}
            <code className="px-0.5 rounded bg-zinc-100 dark:bg-zinc-800">
              data-prop-text=&quot;name&quot;
            </code>
            ,{" "}
            <code className="px-0.5 rounded bg-zinc-100 dark:bg-zinc-800">
              data-prop-href=&quot;name&quot;
            </code>
            ,{" "}
            <code className="px-0.5 rounded bg-zinc-100 dark:bg-zinc-800">
              data-prop-src=&quot;name&quot;
            </code>
            , or{" "}
            <code className="px-0.5 rounded bg-zinc-100 dark:bg-zinc-800">
              data-prop-alt=&quot;name&quot;
            </code>
            . Click <strong>Auto-detect props</strong> to populate the form
            below from those tags.
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-zinc-500">Prop slots</label>
            <button
              type="button"
              onClick={() =>
                setProps((p) => [
                  ...p,
                  { name: "", label: "", type: "text" },
                ])
              }
              className={btnTertiary}
            >
              + Add slot
            </button>
          </div>
          {props.length === 0 && (
            <div className="text-zinc-400 italic">
              No slots yet. Either click Auto-detect, or add rows manually
              for each editable spot.
            </div>
          )}
          {props.map((p, i) => (
            <div
              key={i}
              className="grid grid-cols-[1.4fr_1.4fr_0.9fr_0.9fr_auto] gap-2 items-center"
            >
              <input
                value={p.name}
                onChange={(e) => updateProp(setProps, i, { name: e.target.value })}
                placeholder="prop-name"
                className={`${inputCls} font-mono`}
              />
              <input
                value={p.label}
                onChange={(e) => updateProp(setProps, i, { label: e.target.value })}
                placeholder="Label shown in sidebar"
                className={inputCls}
              />
              <select
                value={p.type}
                onChange={(e) =>
                  updateProp(setProps, i, { type: e.target.value as PropType })
                }
                className={inputCls}
              >
                {PROP_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <select
                value={p.binding ?? defaultBinding(p.type)}
                onChange={(e) => {
                  const v = e.target.value as Binding;
                  updateProp(
                    setProps,
                    i,
                    v === defaultBinding(p.type)
                      ? { binding: undefined }
                      : { binding: v }
                  );
                }}
                className={inputCls}
              >
                {BINDINGS.map((b) => (
                  <option key={b} value={b}>
                    bind: {b}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() =>
                  setProps((arr) => arr.filter((_, idx) => idx !== i))
                }
                className="text-zinc-400 hover:text-red-500 px-1"
                title="Remove slot"
              >
                ×
              </button>
            </div>
          ))}
        </div>

        {error && (
          <div className="p-2 rounded border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300">
            {error}
          </div>
        )}
      </div>
      <div className="flex justify-between items-center mt-4">
        <div>
          {isEdit && (
            <button
              type="button"
              onClick={onDelete}
              className="text-red-600 hover:text-red-700 text-xs"
            >
              Delete component
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <button type="button" className={btnSecondary} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={btnPrimary} onClick={onSave}>
            {isEdit ? "Save changes" : "Create"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── helpers ───────────────────────────────────────────────────────────

function updateProp(
  setProps: React.Dispatch<React.SetStateAction<PropSchema[]>>,
  index: number,
  patch: Partial<PropSchema>
): void {
  setProps((arr) =>
    arr.map((p, i) => (i === index ? { ...p, ...patch } : p))
  );
}

function defaultBinding(type: PropType): Binding {
  switch (type) {
    case "text":
    case "longText":
      return "text";
    case "url":
      return "href";
    case "image":
      return "src";
  }
}

function autoDetectProps(html: string): PropSchema[] {
  // Walk the parsed tree once and collect every data-prop-<binding>="name"
  // attribute on any element. Same regex isn't reliable on raw HTML
  // because a single element can carry multiple bindings — using the
  // editor's own parser keeps the auto-detect aligned with how
  // findSlot() will actually look up these attributes at insert time.
  const parsed = parseHtml(html, { collapseWhitespace: true });
  const found = new Map<string, PropSchema>();
  const walk = (node: { kind: string; children?: unknown[]; attributes?: Record<string, string>; tag?: string }): void => {
    if (node.kind !== "element") return;
    const attrs = node.attributes ?? {};
    for (const binding of BINDINGS) {
      const value = attrs[`data-prop-${binding}`];
      if (typeof value !== "string" || !value) continue;
      // Choose a default type per binding. Authors can change it later.
      const type: PropType =
        binding === "href" ? "url" : binding === "src" ? "image" : "text";
      // First binding wins per name; later bindings on the same name go
      // to a separate prop with the binding override.
      if (!found.has(value)) {
        found.set(value, {
          name: value,
          label: titleCase(value),
          type,
          ...(binding === "alt" ? { binding: "alt" } : {}),
        });
      }
    }
    for (const c of (node.children as Array<typeof node>) ?? []) {
      walk(c);
    }
  };
  for (const child of parsed.children) walk(child as Parameters<typeof walk>[0]);
  return Array.from(found.values());
}

// Validates the template parses to exactly one root element, mints an
// id (or reuses the existing one when editing), and ensures
// `data-component="<id>"` (and optionally `data-locked="true"`) sit on
// the root. Returns the rewritten HTML.
function normaliseTemplate(
  rawHtml: string,
  locked: boolean,
  existingId: string | undefined,
  label: string
): { html: string; id: string } {
  const parsed = parseHtml(rawHtml, { collapseWhitespace: true });
  const elements = parsed.children.filter(isElement);
  if (elements.length === 0) {
    throw new Error(
      "Template has no root element (or only text). Wrap your HTML in a single tag."
    );
  }
  if (elements.length > 1) {
    throw new Error(
      `Template has ${elements.length} root elements. Wrap them in a single <div> or <section>.`
    );
  }
  if (parsed.children.some((c) => c.kind === "text" && c.text.trim().length > 0)) {
    throw new Error(
      "Template has stray text outside the root element. Move it inside the root."
    );
  }

  // Resolve the id. On edit, keep the existing one so external instances
  // continue to resolve. On create, mint a unique slug.
  const existingIds = new Set([
    ...COMPONENT_REGISTRY.map((d) => d.id),
    ...loadUserComponents().map((d) => d.id),
  ]);
  if (existingId) existingIds.delete(existingId);
  const id =
    existingId ??
    uniqueIdFor(label, (candidate) => existingIds.has(candidate));

  // We only need to inject the data-component / data-locked attributes;
  // the body of the template can be re-emitted as the user typed it via
  // a small HTML rewrite. Cheaper and less lossy than re-serialising
  // through our editor's serializer (which canonicalises whitespace and
  // attribute order).
  const html = injectRootAttrs(rawHtml, id, locked);

  return { html, id };
}

function injectRootAttrs(rawHtml: string, id: string, locked: boolean): string {
  // Find the first opening tag — assume well-formed HTML (parseHtml
  // succeeded above). Replace the data-component and data-locked
  // attributes on it; insert if absent.
  const openTagRegex = /<([a-zA-Z][a-zA-Z0-9-]*)([^>]*)>/;
  const match = openTagRegex.exec(rawHtml);
  if (!match) return rawHtml;
  const [full, tag, attrs] = match;

  let next = stripAttr(attrs, "data-component");
  next = stripAttr(next, "data-locked");
  next = `${next.trimEnd()} data-component="${escapeAttr(id)}"`;
  if (locked) next += ` data-locked="true"`;

  const replacement = `<${tag}${next}>`;
  return rawHtml.replace(full, replacement);
}

function stripAttr(attrs: string, name: string): string {
  const regex = new RegExp(
    `\\s+${name}(?:\\s*=\\s*("[^"]*"|'[^']*'|[^\\s>]+))?`,
    "g"
  );
  return attrs.replace(regex, "");
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function hasLockedRoot(html: string): boolean {
  // Look only at the first opening tag — same heuristic injectRootAttrs
  // uses, so the round-trip is consistent.
  const match = /<[a-zA-Z][a-zA-Z0-9-]*([^>]*)>/.exec(html);
  if (!match) return false;
  return /\bdata-locked\s*=\s*"true"/.test(match[1]);
}

function titleCase(name: string): string {
  return name
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part, i) =>
      i === 0
        ? part.charAt(0).toUpperCase() + part.slice(1)
        : part.toLowerCase()
    )
    .join(" ");
}

const SAMPLE_TEMPLATE_HINT = `<section style="padding: 24px; background: #f4f4f5; border-radius: 12px;">
  <h2 data-prop-text="title" style="margin:0 0 8px;">Title</h2>
  <p data-prop-text="body" style="margin:0;">Body text</p>
  <a data-prop-text="cta-text" data-prop-href="cta-link" href="#">Click</a>
</section>`;

// ─── styling primitives mirroring the existing modal palette ──────────

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  // Close on Escape so the modal feels like the rest of the editor.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl bg-white dark:bg-zinc-950 rounded-lg shadow-xl p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-sm">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-700"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const inputCls =
  "w-full px-2 py-1.5 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 focus:outline-none focus:border-blue-400";
const btnPrimary =
  "h-8 px-3 text-xs font-medium rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed";
const btnSecondary =
  "h-8 px-3 text-xs font-medium rounded border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900";
const btnTertiary =
  "h-7 px-2 text-[11px] rounded border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed";
