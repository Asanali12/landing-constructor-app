"use client";

import { useState } from "react";
import { eventsForTag } from "../events-catalog";
import { makeId } from "../id";
import { useEditor } from "../store";
import type { ElementNode, EventBinding } from "../types";
import { ActionList } from "./ActionEditor";

const inputClass =
  "w-full px-2 py-1 text-xs rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 focus:outline-none focus:border-blue-400";

export function EventsSection({ node }: { node: ElementNode }) {
  const { setEvents } = useEditor();
  const events = node.events ?? [];
  const eventOptions = eventsForTag(node.tag);

  const replace = (next: EventBinding[]) => setEvents(node.id, next);

  const addBinding = (eventName: string) => {
    if (!eventName) return;
    const binding: EventBinding = {
      id: makeId("evt"),
      event: eventName,
      actions: [],
    };
    replace([...events, binding]);
  };

  const updateBinding = (i: number, next: EventBinding) => {
    const out = events.slice();
    out[i] = next;
    replace(out);
  };

  const removeBinding = (i: number) => {
    replace(events.filter((_, idx) => idx !== i));
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
          />
        ))}
      </div>

      <AddBinding events={eventOptions} onAdd={addBinding} />
    </div>
  );
}

function AddBinding({
  events,
  onAdd,
}: {
  events: string[];
  onAdd: (name: string) => void;
}) {
  return (
    <select
      value=""
      onChange={(e) => {
        if (e.target.value) onAdd(e.target.value);
        e.target.value = "";
      }}
      className={inputClass + " text-zinc-500"}
    >
      <option value="">+ Add event…</option>
      {events.map((ev) => (
        <option key={ev} value={ev}>
          {ev}
        </option>
      ))}
    </select>
  );
}

function BindingEditor({
  binding,
  tagEvents,
  onChange,
  onDelete,
}: {
  binding: EventBinding;
  tagEvents: string[];
  onChange: (next: EventBinding) => void;
  onDelete: () => void;
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
