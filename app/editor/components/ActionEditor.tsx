"use client";

import { makeId } from "../id";
import type { Action, ActionKind, HttpMethod, ScrollBehavior } from "../types";

const inputClass =
  "w-full px-2 py-1 text-xs rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 focus:outline-none focus:border-blue-400";

const textareaClass = inputClass + " font-mono leading-snug";

const ACTION_LABELS: Record<ActionKind, string> = {
  analytics: "Send analytics event",
  writeUserData: "Write user data",
  httpRequest: "HTTP request",
  ifElse: "If / else",
  setTimeout: "Set timeout",
  goToLink: "Go to link",
  scrollTo: "Scroll to",
  customJs: "Custom JS code",
};

const ACTION_KINDS: ActionKind[] = [
  "analytics",
  "writeUserData",
  "httpRequest",
  "ifElse",
  "setTimeout",
  "goToLink",
  "scrollTo",
  "customJs",
];

export function defaultActionFor(kind: ActionKind): Action {
  const id = makeId("act");
  switch (kind) {
    case "analytics":
      return { id, kind, eventName: "", properties: "" };
    case "writeUserData":
      return { id, kind, field: "", value: "" };
    case "httpRequest":
      return { id, kind, url: "", method: "POST", headers: "", body: "" };
    case "ifElse":
      return { id, kind, condition: "", then: [], else: [] };
    case "setTimeout":
      return { id, kind, delayMs: 1000, actions: [] };
    case "goToLink":
      return { id, kind, url: "", newTab: false };
    case "scrollTo":
      return { id, kind, selector: "", behavior: "smooth" };
    case "customJs":
      return { id, kind, code: "" };
  }
}

// Renders an ordered array of actions with an "Add action" button below.
export function ActionList({
  actions,
  onChange,
  depth = 0,
}: {
  actions: Action[];
  onChange: (next: Action[]) => void;
  depth?: number;
}) {
  const updateAt = (i: number, next: Action) => {
    const out = actions.slice();
    out[i] = next;
    onChange(out);
  };
  const removeAt = (i: number) => {
    onChange(actions.filter((_, idx) => idx !== i));
  };
  const add = (kind: ActionKind) => {
    onChange([...actions, defaultActionFor(kind)]);
  };

  return (
    <div className="space-y-1.5">
      {actions.map((a, i) => (
        <ActionEditor
          key={a.id}
          action={a}
          onChange={(next) => updateAt(i, next)}
          onDelete={() => removeAt(i)}
          depth={depth}
        />
      ))}
      <AddActionButton onPick={add} />
    </div>
  );
}

function AddActionButton({ onPick }: { onPick: (kind: ActionKind) => void }) {
  return (
    <select
      value=""
      onChange={(e) => {
        const v = e.target.value as ActionKind | "";
        if (v) onPick(v);
        e.target.value = "";
      }}
      className={inputClass + " text-zinc-500"}
    >
      <option value="">+ Add action…</option>
      {ACTION_KINDS.map((k) => (
        <option key={k} value={k}>
          {ACTION_LABELS[k]}
        </option>
      ))}
    </select>
  );
}

function ActionEditor({
  action,
  onChange,
  onDelete,
  depth,
}: {
  action: Action;
  onChange: (next: Action) => void;
  onDelete: () => void;
  depth: number;
}) {
  // Switching action kind: replace with a fresh default of the new kind so
  // we don't carry stale fields from the previous shape.
  const onKindChange = (next: ActionKind) => {
    if (next === action.kind) return;
    const fresh = defaultActionFor(next);
    onChange({ ...fresh, id: action.id });
  };

  return (
    <div
      className="rounded border border-zinc-200 dark:border-zinc-800 p-2 space-y-1.5 bg-zinc-50/40 dark:bg-zinc-900/40"
      style={depth > 0 ? { marginLeft: 4 } : undefined}
    >
      <div className="flex items-center gap-1">
        <select
          value={action.kind}
          onChange={(e) => onKindChange(e.target.value as ActionKind)}
          className={inputClass + " flex-1"}
        >
          {ACTION_KINDS.map((k) => (
            <option key={k} value={k}>
              {ACTION_LABELS[k]}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onDelete}
          title="Delete action"
          className="text-zinc-400 hover:text-red-600 px-1"
        >
          ✕
        </button>
      </div>

      <ActionFields action={action} onChange={onChange} depth={depth} />
    </div>
  );
}

function ActionFields({
  action,
  onChange,
  depth,
}: {
  action: Action;
  onChange: (next: Action) => void;
  depth: number;
}) {
  switch (action.kind) {
    case "analytics":
      return (
        <>
          <Labeled label="Event name">
            <input
              className={inputClass}
              value={action.eventName}
              onChange={(e) => onChange({ ...action, eventName: e.target.value })}
              placeholder="cta_click"
            />
          </Labeled>
          <Labeled label="Properties (JSON)">
            <textarea
              className={textareaClass + " h-16"}
              value={action.properties}
              onChange={(e) => onChange({ ...action, properties: e.target.value })}
              placeholder='{"page": "home"}'
            />
          </Labeled>
        </>
      );

    case "writeUserData":
      return (
        <>
          <Labeled label="Field">
            <input
              className={inputClass}
              value={action.field}
              onChange={(e) => onChange({ ...action, field: e.target.value })}
              placeholder="user_id"
            />
          </Labeled>
          <Labeled label="Value">
            <input
              className={inputClass}
              value={action.value}
              onChange={(e) => onChange({ ...action, value: e.target.value })}
              placeholder="abc123"
            />
          </Labeled>
          <p className="text-[10px] text-zinc-400">
            Cookie write is stubbed in the runtime — no behavior emitted yet.
          </p>
        </>
      );

    case "httpRequest":
      return (
        <>
          <Labeled label="URL">
            <input
              className={inputClass}
              value={action.url}
              onChange={(e) => onChange({ ...action, url: e.target.value })}
              placeholder="https://api.example.com/track"
            />
          </Labeled>
          <Labeled label="Method">
            <select
              className={inputClass}
              value={action.method}
              onChange={(e) =>
                onChange({ ...action, method: e.target.value as HttpMethod })
              }
            >
              {(["GET", "POST", "PUT", "PATCH", "DELETE"] as HttpMethod[]).map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </Labeled>
          <Labeled label="Headers (JSON)">
            <textarea
              className={textareaClass + " h-16"}
              value={action.headers}
              onChange={(e) => onChange({ ...action, headers: e.target.value })}
              placeholder='{"Content-Type":"application/json"}'
            />
          </Labeled>
          <Labeled label="Body">
            <textarea
              className={textareaClass + " h-20"}
              value={action.body}
              onChange={(e) => onChange({ ...action, body: e.target.value })}
              placeholder='{"foo":"bar"}'
            />
          </Labeled>
        </>
      );

    case "ifElse":
      return (
        <>
          <Labeled label="Condition (JS expression)">
            <input
              className={inputClass + " font-mono"}
              value={action.condition}
              onChange={(e) => onChange({ ...action, condition: e.target.value })}
              placeholder="event.target.matches('a')"
            />
          </Labeled>
          <NestedBlock label="Then">
            <ActionList
              actions={action.then}
              onChange={(next) => onChange({ ...action, then: next })}
              depth={depth + 1}
            />
          </NestedBlock>
          <NestedBlock label="Else">
            <ActionList
              actions={action.else}
              onChange={(next) => onChange({ ...action, else: next })}
              depth={depth + 1}
            />
          </NestedBlock>
        </>
      );

    case "setTimeout":
      return (
        <>
          <Labeled label="Delay (ms)">
            <input
              type="number"
              min={0}
              className={inputClass}
              value={action.delayMs}
              onChange={(e) =>
                onChange({ ...action, delayMs: Math.max(0, Number(e.target.value) || 0) })
              }
            />
          </Labeled>
          <NestedBlock label="Actions">
            <ActionList
              actions={action.actions}
              onChange={(next) => onChange({ ...action, actions: next })}
              depth={depth + 1}
            />
          </NestedBlock>
        </>
      );

    case "goToLink":
      return (
        <>
          <Labeled label="URL">
            <input
              className={inputClass}
              value={action.url}
              onChange={(e) => onChange({ ...action, url: e.target.value })}
              placeholder="/signup"
            />
          </Labeled>
          <label className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={action.newTab}
              onChange={(e) => onChange({ ...action, newTab: e.target.checked })}
            />
            Open in new tab
          </label>
        </>
      );

    case "scrollTo":
      return (
        <>
          <Labeled label="Selector">
            <input
              className={inputClass + " font-mono"}
              value={action.selector}
              onChange={(e) => onChange({ ...action, selector: e.target.value })}
              placeholder="#section-pricing"
            />
          </Labeled>
          <Labeled label="Behavior">
            <select
              className={inputClass}
              value={action.behavior}
              onChange={(e) =>
                onChange({ ...action, behavior: e.target.value as ScrollBehavior })
              }
            >
              <option value="smooth">smooth</option>
              <option value="auto">auto (instant)</option>
            </select>
          </Labeled>
        </>
      );

    case "customJs":
      return (
        <Labeled label="Code (receives `event`)">
          <textarea
            className={textareaClass + " h-24"}
            value={action.code}
            onChange={(e) => onChange({ ...action, code: e.target.value })}
            placeholder="event.preventDefault();"
          />
        </Labeled>
      );
  }
}

function Labeled({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-0.5">
        {label}
      </div>
      {children}
    </div>
  );
}

function NestedBlock({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-l border-zinc-200 dark:border-zinc-800 pl-2">
      <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">
        {label}
      </div>
      {children}
    </div>
  );
}
