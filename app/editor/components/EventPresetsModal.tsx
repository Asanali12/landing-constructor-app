"use client";

import { useState } from "react";
import {
  usePresets,
  type EventPreset,
  type PresetsSyncStatus,
} from "../event-presets";
import { makeId } from "../id";
import { ActionList } from "./ActionEditor";

const inputClass =
  "w-full px-2 py-1 text-xs rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 focus:outline-none focus:border-blue-400";

const btnPrimary =
  "h-8 px-3 text-xs font-medium rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed";
const btnSecondary =
  "h-8 px-3 text-xs font-medium rounded border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900";

// Common event triggers for the preset's event dropdown. We don't tie this
// to a specific tag — presets are tag-agnostic and applied wherever the user
// chooses. `view` is a synthesized lifecycle trigger (fires once when the
// element first scrolls into view) — same as in events-catalog.ts.
const EVENT_OPTIONS = [
  "click",
  "view",
  "dblclick",
  "mouseenter",
  "mouseleave",
  "focus",
  "blur",
  "input",
  "change",
  "submit",
  "keydown",
  "keyup",
  "scroll",
];

export function EventPresetsModal({
  initialPreset,
  onClose,
  onChange,
}: {
  // Optional preset to scroll to / pre-select on open. Used by the "Manage
  // presets…" entry in the binding dropdown to surface the active row.
  initialPreset?: EventPreset;
  onClose: () => void;
  // Kept as a no-op-friendly callback for parity with the previous API.
  // The hook now syncs via a global change-event so the parent doesn't
  // need to re-read on close.
  onChange: () => void;
}) {
  const { presets, status, setPresets } = usePresets();
  const [editing, setEditing] = useState<EventPreset | null>(
    initialPreset ?? null
  );

  const persist = (next: EventPreset[]) => {
    setPresets(next);
    onChange();
  };

  const addBlank = () => {
    const fresh: EventPreset = {
      id: makeId("preset"),
      name: "New preset",
      event: "click",
      actions: [],
    };
    persist([...presets, fresh]);
    setEditing(fresh);
  };

  const updateEditing = (next: EventPreset) => {
    setEditing(next);
    persist(presets.map((p) => (p.id === next.id ? next : p)));
  };

  const deletePreset = (id: string) => {
    persist(presets.filter((p) => p.id !== id));
    if (editing?.id === id) setEditing(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl bg-white dark:bg-zinc-950 rounded-lg shadow-xl flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-sm">Event presets</h2>
            <SyncBadge status={status} />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-700"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-[200px_1fr]">
          <aside className="border-r border-zinc-200 dark:border-zinc-800 overflow-y-auto p-2 space-y-1">
            {presets.length === 0 && (
              <div className="text-[11px] text-zinc-400 px-2 py-2">
                No presets yet.
              </div>
            )}
            {presets.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setEditing(p)}
                className={`w-full text-left px-2 py-1.5 rounded text-xs ${
                  editing?.id === p.id
                    ? "bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800"
                    : "hover:bg-zinc-50 dark:hover:bg-zinc-900 border border-transparent"
                }`}
              >
                <div className="font-medium truncate">{p.name}</div>
                <div className="text-[10px] text-zinc-500">
                  on {p.event} · {p.actions.length}
                  {p.actions.length === 1 ? " action" : " actions"}
                </div>
              </button>
            ))}
            <button
              type="button"
              onClick={addBlank}
              className={`${btnSecondary} w-full mt-1`}
            >
              + New preset
            </button>
          </aside>

          <main className="overflow-y-auto p-4">
            {!editing && (
              <div className="text-xs text-zinc-500">
                Select a preset on the left, or create a new one.
              </div>
            )}
            {editing && (
              <PresetEditor
                preset={editing}
                onChange={updateEditing}
                onDelete={() => deletePreset(editing.id)}
              />
            )}
          </main>
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t border-zinc-200 dark:border-zinc-800">
          <button type="button" className={btnPrimary} onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// Tiny inline badge surfacing the backend-sync state of the preset
// library. Presets are global across users / pages, so the user wants
// immediate confirmation that their change made it to the server.
function SyncBadge({ status }: { status: PresetsSyncStatus }) {
  let dotCls = "bg-zinc-400";
  let label = "Loading…";
  if (status.kind === "synced") {
    dotCls = "bg-emerald-500";
    label = "Saved";
  } else if (status.kind === "saving") {
    dotCls = "bg-blue-500 animate-pulse";
    label = "Saving…";
  } else if (status.kind === "error") {
    dotCls = "bg-red-500";
    label = status.message;
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11px] text-zinc-500 max-w-[280px]"
      title={status.kind === "error" ? status.message : label}
    >
      <span
        className={`inline-block w-2 h-2 rounded-full ${dotCls}`}
        aria-hidden
      />
      <span className="truncate">{label}</span>
    </span>
  );
}

function PresetEditor({
  preset,
  onChange,
  onDelete,
}: {
  preset: EventPreset;
  onChange: (next: EventPreset) => void;
  onDelete: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label className="text-[10px] uppercase tracking-wider text-zinc-500 block mb-1">
            Name
          </label>
          <input
            value={preset.name}
            onChange={(e) => onChange({ ...preset, name: e.target.value })}
            className={inputClass}
          />
        </div>
        <button
          type="button"
          onClick={onDelete}
          className="h-[26px] px-2 text-xs rounded border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
        >
          Delete
        </button>
      </div>

      <div>
        <label className="text-[10px] uppercase tracking-wider text-zinc-500 block mb-1">
          Trigger
        </label>
        <select
          value={preset.event}
          onChange={(e) => onChange({ ...preset, event: e.target.value })}
          className={inputClass}
        >
          {/* Allow the saved value through even if it's not in our list. */}
          {!EVENT_OPTIONS.includes(preset.event) && (
            <option value={preset.event}>{preset.event}</option>
          )}
          {EVENT_OPTIONS.map((ev) => (
            <option key={ev} value={ev}>
              {ev}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-[10px] uppercase tracking-wider text-zinc-500 block mb-1">
          Actions
        </label>
        <ActionList
          actions={preset.actions}
          onChange={(next) => onChange({ ...preset, actions: next })}
        />
      </div>
    </div>
  );
}
