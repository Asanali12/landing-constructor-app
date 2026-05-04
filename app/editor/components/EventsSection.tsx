"use client";

import { useState } from "react";
import { eventsForTag } from "../events-catalog";
import {
  applyPreset,
  presetFromBinding,
  usePresets,
  type EventPreset,
} from "../event-presets";
import { makeId } from "../id";
import { useEditor } from "../store";
import type { ElementNode, EventBinding } from "../types";
import { ActionList } from "./ActionEditor";
import { EventPresetsModal } from "./EventPresetsModal";

const inputClass =
  "w-full px-2 py-1 text-xs rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 focus:outline-none focus:border-blue-400";

// Sentinel value emitted by the "+ Add…" dropdown to open the manage
// modal. Distinct from any real event name or preset id.
const MANAGE_SENTINEL = "__manage_presets__";
const PRESET_PREFIX = "preset:";

export function EventsSection({ node }: { node: ElementNode }) {
  const { setEvents } = useEditor();
  const events = node.events ?? [];
  const eventOptions = eventsForTag(node.tag);

  // Backend-synced preset library. The hook keeps localStorage in step as
  // a cache + offline fallback. Cross-component updates flow through a
  // CustomEvent so the modal and this section stay aligned without prop
  // drilling.
  const { presets, status, setPresets } = usePresets();
  // Kept as a no-op for parity with the previous API — the hook now
  // refreshes itself via the change-event subscription.
  const refreshPresets = () => {};

  const [modalOpen, setModalOpen] = useState(false);

  const replace = (next: EventBinding[]) => setEvents(node.id, next);

  const addRawEvent = (eventName: string) => {
    const binding: EventBinding = {
      id: makeId("evt"),
      event: eventName,
      actions: [],
    };
    replace([...events, binding]);
  };

  const addFromPreset = (presetId: string) => {
    const preset = presets.find((p) => p.id === presetId);
    if (!preset) return;
    replace([...events, applyPreset(preset)]);
  };

  const handleAddSelection = (value: string) => {
    if (!value) return;
    if (value === MANAGE_SENTINEL) {
      setModalOpen(true);
      return;
    }
    if (value.startsWith(PRESET_PREFIX)) {
      addFromPreset(value.slice(PRESET_PREFIX.length));
      return;
    }
    addRawEvent(value);
  };

  const updateBinding = (i: number, next: EventBinding) => {
    const out = events.slice();
    out[i] = next;
    replace(out);
  };

  const removeBinding = (i: number) => {
    replace(events.filter((_, idx) => idx !== i));
  };

  const saveAsPreset = (binding: EventBinding) => {
    const name = window.prompt("Preset name?", `on ${binding.event}`);
    if (!name) return;
    setPresets([...presets, presetFromBinding(binding, name.trim())]);
  };

  return (
    <div className="space-y-2">
      <div className="text-[10px] uppercase tracking-wider text-zinc-500">
        Events
      </div>

      {events.length === 0 && (
        <div className="text-xs text-zinc-400">
          No event handlers yet. Add one below.
        </div>
      )}

      <div className="space-y-2">
        {events.map((b, i) => (
          <BindingEditor
            key={b.id}
            binding={b}
            tagEvents={eventOptions}
            onChange={(next) => updateBinding(i, next)}
            onDelete={() => removeBinding(i)}
            onSaveAsPreset={() => saveAsPreset(b)}
          />
        ))}
      </div>

      <AddBinding
        events={eventOptions}
        presets={presets}
        onSelect={handleAddSelection}
      />

      {modalOpen && (
        <EventPresetsModal
          onClose={() => {
            setModalOpen(false);
            refreshPresets();
          }}
          onChange={refreshPresets}
        />
      )}
    </div>
  );
}

function AddBinding({
  events,
  presets,
  onSelect,
}: {
  events: string[];
  presets: EventPreset[];
  onSelect: (value: string) => void;
}) {
  return (
    <select
      value=""
      onChange={(e) => {
        const v = e.target.value;
        e.target.value = "";
        onSelect(v);
      }}
      className={inputClass + " text-zinc-500"}
    >
      <option value="">+ Add event…</option>
      <optgroup label="Events">
        {events.map((ev) => (
          <option key={ev} value={ev}>
            {ev}
          </option>
        ))}
      </optgroup>
      {presets.length > 0 && (
        <optgroup label="Presets">
          {presets.map((p) => (
            <option key={p.id} value={`${PRESET_PREFIX}${p.id}`}>
              {p.name} (on {p.event})
            </option>
          ))}
        </optgroup>
      )}
      <option value={MANAGE_SENTINEL}>⚙ Manage presets…</option>
    </select>
  );
}

function BindingEditor({
  binding,
  tagEvents,
  onChange,
  onDelete,
  onSaveAsPreset,
}: {
  binding: EventBinding;
  tagEvents: string[];
  onChange: (next: EventBinding) => void;
  onDelete: () => void;
  onSaveAsPreset: () => void;
}) {
  const [open, setOpen] = useState(true);

  // The user may have added a binding for an event that's not in the tag's
  // common list (or changed the tag after). Make sure the current event is
  // selectable in the dropdown.
  const eventOptions = tagEvents.includes(binding.event)
    ? tagEvents
    : [binding.event, ...tagEvents];

  return (
    <div className="rounded border border-zinc-200 dark:border-zinc-800">
      <div className="flex items-center gap-1 px-2 py-1.5 bg-zinc-50 dark:bg-zinc-900">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="text-zinc-400 hover:text-zinc-700 w-4 text-left"
          aria-label={open ? "Collapse" : "Expand"}
        >
          {open ? "▾" : "▸"}
        </button>
        <span className="text-[10px] uppercase tracking-wider text-zinc-500">
          on
        </span>
        <select
          value={binding.event}
          onChange={(e) => onChange({ ...binding, event: e.target.value })}
          className={inputClass + " flex-1"}
        >
          {eventOptions.map((ev) => (
            <option key={ev} value={ev}>
              {ev}
            </option>
          ))}
        </select>
        <span className="text-[10px] text-zinc-400">
          {binding.actions.length}
          {binding.actions.length === 1 ? " action" : " actions"}
        </span>
        <button
          type="button"
          onClick={onSaveAsPreset}
          title="Save this binding as a preset"
          className="text-zinc-400 hover:text-blue-600 px-1"
        >
          ☆
        </button>
        <button
          type="button"
          onClick={onDelete}
          title="Delete event binding"
          className="text-zinc-400 hover:text-red-600 px-1"
        >
          ✕
        </button>
      </div>
      {open && (
        <div className="p-2">
          <ActionList
            actions={binding.actions}
            onChange={(next) => onChange({ ...binding, actions: next })}
          />
        </div>
      )}
    </div>
  );
}
