"use client";

import { useEditor } from "../store";
import type { ElementNode } from "../types";
import { findComponentDef } from "../components-kit/registry";
import {
  bindingFor,
  componentIdOf,
  findSlot,
  isLocked,
  readPropValue,
  schemaFor,
} from "../components-kit/instance";

const inputBase =
  "px-2 py-1 text-xs rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 focus:outline-none focus:border-blue-400";
const inputClass = `${inputBase} w-full`;

export function ComponentProps({ node }: { node: ElementNode }) {
  const { setAttr, setInnerText, removeAttr } = useEditor();
  const componentId = componentIdOf(node);
  const def = componentId ? findComponentDef(componentId) : null;
  const schema = schemaFor(node);
  const locked = isLocked(node);

  const handleLockToggle = () => {
    if (locked) removeAttr(node.id, "data-locked");
    else setAttr(node.id, "data-locked", "true");
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
        <div className="space-y-2">
          {schema.map((prop) => {
            const binding = bindingFor(prop);
            const slot = findSlot(node, prop.name, binding);
            const value = slot ? readPropValue(slot, binding) : "";
            const onChange = (next: string) => {
              if (!slot) return;
              if (binding === "text") setInnerText(slot.id, next);
              else setAttr(slot.id, binding, next);
            };
            return (
              <PropField
                key={prop.name}
                label={prop.label}
                hint={prop.hint}
                missing={!slot}
                multiline={prop.type === "longText"}
                value={value}
                onChange={onChange}
              />
            );
          })}
        </div>
      )}
    </div>
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
