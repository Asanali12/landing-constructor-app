"use client";

import { useEditor } from "../store";
import type { EditorDocument, ElementNode } from "../types";
import { findComponentDef } from "../components-kit/registry";
import {
  bindingFor,
  componentIdOf,
  findSlot,
  findSwiperTrack,
  getSwiperSlides,
  isLocked,
  maxSlideNumber,
  readPropValue,
  schemaFor,
  slideNumberOf,
} from "../components-kit/instance";
import { findNode } from "../tree-ops";
import { parseHtml } from "../parse";
import { serializeDocument } from "../serialize";
import { isElement } from "../types";
import type { PropSchema } from "../components-kit/types";
import { insertChildLast, deleteNode as deleteNodeOp } from "../tree-ops";

const inputBase =
  "px-2 py-1 text-xs rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 focus:outline-none focus:border-blue-400";
const inputClass = `${inputBase} w-full`;

export function ComponentProps({ node }: { node: ElementNode }) {
  const { state, setAttr, setInnerText, removeAttr, applyDoc } = useEditor();
  const componentId = componentIdOf(node);
  const def = componentId ? findComponentDef(componentId) : null;
  const locked = isLocked(node);

  // Swiper has a dynamic slide count — the schema is computed from the DOM
  // rather than the registry's static def.props so we always show one
  // group of fields per actual slide.
  const isSwiper = componentId === "swiper";
  const swiperSlides = isSwiper ? getSwiperSlides(node) : [];
  const schema = isSwiper
    ? buildSwiperSchema(swiperSlides)
    : schemaFor(node);

  const handleLockToggle = () => {
    if (locked) removeAttr(node.id, "data-locked");
    else setAttr(node.id, "data-locked", "true");
  };

  const handleAddSlide = () => {
    const next = addSwiperSlide(state.doc, node.id);
    if (next) applyDoc(next);
  };

  const handleRemoveSlide = () => {
    if (swiperSlides.length <= 1) return;
    const last = swiperSlides[swiperSlides.length - 1];
    applyDoc(deleteNodeOp(state.doc, last.id));
  };

  return (
    <div className="text-xs space-y-3">
      <header className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="font-medium truncate">
            {def?.label ?? componentId ?? "Component"}
          </div>
          {def?.description && (
            <div className="text-[10px] text-zinc-500 truncate">
              {def.description}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={handleLockToggle}
          className={`shrink-0 h-6 px-2 rounded text-[10px] font-medium border ${
            locked
              ? "border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30"
              : "border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900"
          }`}
          title={
            locked
              ? "Locked — click to unlock and edit internal structure."
              : "Unlocked — click to lock structure again."
          }
        >
          {locked ? "🔒 Locked" : "🔓 Unlocked"}
        </button>
      </header>

      {locked && (
        <p className="text-[10px] text-zinc-500">
          Internal structure is locked. Fill in the fields below; click the lock
          button above to edit elements directly.
        </p>
      )}

      {isSwiper && (
        <div className="flex items-center justify-between gap-2 px-2 py-1.5 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-zinc-500">
              Slides
            </div>
            <div className="font-medium">{swiperSlides.length}</div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleRemoveSlide}
              disabled={swiperSlides.length <= 1}
              className="h-6 w-6 rounded border border-zinc-200 dark:border-zinc-800 hover:bg-white dark:hover:bg-zinc-950 disabled:opacity-40 disabled:cursor-not-allowed"
              title={
                swiperSlides.length <= 1
                  ? "Can't remove — at least one slide is required."
                  : "Remove the last slide."
              }
            >
              −
            </button>
            <button
              type="button"
              onClick={handleAddSlide}
              className="h-6 w-6 rounded border border-zinc-200 dark:border-zinc-800 hover:bg-white dark:hover:bg-zinc-950"
              title="Duplicate the last slide and append it. Edit the new slide's text below."
            >
              +
            </button>
          </div>
        </div>
      )}

      {!schema && (
        <p className="text-[10px] text-amber-600 dark:text-amber-400">
          Unknown component id <code>{componentId}</code>. No prop schema
          registered.
        </p>
      )}

      {schema && schema.length === 0 && (
        <p className="text-[10px] text-zinc-500">
          This component has no editable fields.
        </p>
      )}

      {schema && schema.length > 0 && (
        <PropList
          schema={schema}
          node={node}
          isSwiper={isSwiper}
          onChange={(slot, binding, next) => {
            if (binding === "text") setInnerText(slot.id, next);
            else setAttr(slot.id, binding, next);
          }}
        />
      )}
    </div>
  );
}

// ─── prop list ──────────────────────────────────────────────────────────

function PropList({
  schema,
  node,
  isSwiper,
  onChange,
}: {
  schema: PropSchema[];
  node: ElementNode;
  isSwiper: boolean;
  onChange: (slot: ElementNode, binding: ReturnType<typeof bindingFor>, next: string) => void;
}) {
  // For the swiper, group props by their slide-N prefix so the user sees
  // "Slide 1: video / name / description" together rather than all 3 of
  // each kind running down the list.
  if (isSwiper) {
    const groups = groupSwiperProps(schema);
    return (
      <div className="space-y-3">
        {groups.map((group) => (
          <div
            key={group.label}
            className="space-y-2 pt-2 border-t border-zinc-200 dark:border-zinc-800 first:pt-0 first:border-t-0"
          >
            <div className="text-[10px] uppercase tracking-wider font-medium text-zinc-600 dark:text-zinc-300">
              {group.label}
            </div>
            <PropFields schema={group.props} node={node} onChange={onChange} />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <PropFields schema={schema} node={node} onChange={onChange} />
    </div>
  );
}

function PropFields({
  schema,
  node,
  onChange,
}: {
  schema: PropSchema[];
  node: ElementNode;
  onChange: (slot: ElementNode, binding: ReturnType<typeof bindingFor>, next: string) => void;
}) {
  return (
    <>
      {schema.map((prop) => {
        const binding = bindingFor(prop);
        const slot = findSlot(node, prop.name, binding);
        const value = slot ? readPropValue(slot, binding) : "";
        return (
          <PropField
            key={prop.name}
            label={prop.label}
            hint={prop.hint}
            missing={!slot}
            multiline={prop.type === "longText"}
            value={value}
            onChange={(next) => slot && onChange(slot, binding, next)}
          />
        );
      })}
    </>
  );
}

function PropField({
  label,
  hint,
  missing,
  multiline,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  missing: boolean;
  multiline: boolean;
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-1">
        <label className="text-[10px] uppercase tracking-wider text-zinc-500">
          {label}
        </label>
        {missing && (
          <span
            className="text-[10px] text-red-600 dark:text-red-400"
            title="No element with the matching data-prop attribute was found in this component. The slot was probably deleted while unlocked — re-add an element with the correct data-prop attribute or re-insert the component."
          >
            ⚠ slot missing
          </span>
        )}
      </div>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={missing}
          className={`${inputClass} h-16 resize-none`}
          placeholder={missing ? "(slot missing)" : ""}
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={missing}
          className={inputClass}
          placeholder={missing ? "(slot missing)" : ""}
        />
      )}
      {hint && (
        <p className="text-[10px] text-zinc-400 mt-0.5">{hint}</p>
      )}
    </div>
  );
}

// ─── swiper schema + ops ────────────────────────────────────────────────

// Build a flat schema list matching the actual slides in the DOM. Each
// slide contributes three prop entries: video / name / description, with
// names derived from the slide's slide-N prefix.
function buildSwiperSchema(slides: ElementNode[]): PropSchema[] {
  const schema: PropSchema[] = [];
  for (const slide of slides) {
    const n = slideNumberOf(slide);
    if (n === null) continue;
    schema.push(
      {
        name: `slide-${n}-video`,
        label: `Slide ${n} video URL`,
        type: "url",
        binding: "src",
      },
      { name: `slide-${n}-title`, label: `Slide ${n} name`, type: "text" },
      {
        name: `slide-${n}-body`,
        label: `Slide ${n} description`,
        type: "longText",
      }
    );
  }
  return schema;
}

// Groups buildSwiperSchema's flat list back into per-slide buckets so the
// UI can render a "Slide N" header above each set of three fields.
function groupSwiperProps(
  schema: PropSchema[]
): Array<{ label: string; props: PropSchema[] }> {
  const map = new Map<number, PropSchema[]>();
  for (const prop of schema) {
    const m = /^slide-(\d+)-/.exec(prop.name);
    if (!m) continue;
    const n = parseInt(m[1], 10);
    const list = map.get(n) ?? [];
    list.push(prop);
    map.set(n, list);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a - b)
    .map(([n, props]) => ({ label: `Slide ${n}`, props }));
}

// Append a slide to the swiper. Strategy: take the last existing slide,
// serialize it to HTML, rewrite its slide-N prefix to the next free
// number, then re-parse so parseHtml mints fresh ids for every node.
// Returns the new doc — caller commits via applyDoc.
function addSwiperSlide(
  doc: EditorDocument,
  swiperRootId: string
): EditorDocument | null {
  const swiper = findNode(doc, swiperRootId);
  if (!swiper || !isElement(swiper)) return null;

  const track = findSwiperTrack(swiper);
  if (!track) return null;

  const slides = getSwiperSlides(swiper);
  if (slides.length === 0) return null;

  const lastSlide = slides[slides.length - 1];
  const oldN = slideNumberOf(lastSlide);
  if (oldN === null) return null;

  const nextN = maxSlideNumber(slides) + 1;

  // Round-trip the slide through serialise → text rewrite → parseHtml so
  // every node id is freshly minted (parseHtml assigns new ids on parse).
  // Skipping this step would clone the source slide's ids and the editor
  // would treat the duplicate as the same nodes.
  const html = serializeDocument({ children: [lastSlide] }, { pretty: false });
  const oldPrefix = new RegExp(`slide-${oldN}-`, "g");
  const rewritten = html.replace(oldPrefix, `slide-${nextN}-`);
  const parsed = parseHtml(rewritten, { collapseWhitespace: true });
  const newSlide = parsed.children.find(isElement);
  if (!newSlide) return null;

  return insertChildLast(doc, track.id, newSlide);
}
