"use client";

import { useState } from "react";
import { MODELS, defaultModel } from "../ai/provider";
import {
  clearChatHistory,
  loadCustomCommands,
  saveCustomCommands,
  type CustomCommand,
} from "../ai/storage";
import type { Provider } from "../ai/types";

const inputClass =
  "w-full px-2 py-1 text-xs rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 focus:outline-none focus:border-blue-400";

const btnPrimary =
  "h-8 px-3 text-xs font-medium rounded bg-blue-600 text-white hover:bg-blue-700";
const btnSecondary =
  "h-8 px-3 text-xs font-medium rounded border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900";

export type AISettings = {
  provider: Provider;
  model: string;
  anthropicKey: string;
  openaiKey: string;
};

export function AISettingsModal({
  initial,
  onClose,
  onSave,
  onCleared,
}: {
  initial: AISettings;
  onClose: () => void;
  onSave: (next: AISettings) => void;
  onCleared: () => void;
}) {
  const [provider, setProvider] = useState<Provider>(initial.provider);
  const [model, setModel] = useState<string>(
    MODELS[initial.provider].some((m) => m.id === initial.model)
      ? initial.model
      : defaultModel(initial.provider)
  );
  const [anthropicKey, setAnthropicKey] = useState(initial.anthropicKey);
  const [openaiKey, setOpenaiKey] = useState(initial.openaiKey);
  const [commands, setCommands] = useState<CustomCommand[]>(() =>
    loadCustomCommands()
  );

  const switchProvider = (p: Provider) => {
    setProvider(p);
    if (!MODELS[p].some((m) => m.id === model)) setModel(defaultModel(p));
  };

  const onSaveClick = () => {
    saveCustomCommands(commands);
    onSave({ provider, model, anthropicKey, openaiKey });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-white dark:bg-zinc-950 rounded-lg shadow-xl p-4 max-h-[85vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-sm">AI settings</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-700"
          >
            ✕
          </button>
        </div>

        <Section title="Provider">
          <div className="flex items-center gap-3 text-xs">
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="radio"
                name="lc-ai-provider"
                checked={provider === "anthropic"}
                onChange={() => switchProvider("anthropic")}
              />
              <span>Claude (Anthropic)</span>
            </label>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="radio"
                name="lc-ai-provider"
                checked={provider === "openai"}
                onChange={() => switchProvider("openai")}
              />
              <span>OpenAI</span>
            </label>
          </div>
        </Section>

        <Section title="Model">
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className={inputClass}
          >
            {MODELS[provider].map((m) => (
              <option key={m.id} value={m.id}>
                {m.label} ({m.id})
              </option>
            ))}
          </select>
        </Section>

        <Section title="API keys">
          <p className="text-[10px] text-zinc-500 mb-1.5">
            Keys are stored in this browser&apos;s localStorage and sent
            directly to the provider. Anyone with access to this profile can
            read them.
          </p>
          <label className="block text-[10px] text-zinc-500 mt-1">
            Anthropic
          </label>
          <input
            type="password"
            value={anthropicKey}
            onChange={(e) => setAnthropicKey(e.target.value)}
            placeholder="sk-ant-..."
            className={`${inputClass} font-mono`}
          />
          <label className="block text-[10px] text-zinc-500 mt-2">OpenAI</label>
          <input
            type="password"
            value={openaiKey}
            onChange={(e) => setOpenaiKey(e.target.value)}
            placeholder="sk-..."
            className={`${inputClass} font-mono`}
          />
        </Section>

        <Section
          title="Custom slash commands"
          action={
            <button
              type="button"
              className="text-blue-600 text-[10px]"
              onClick={() =>
                setCommands((c) => [
                  ...c,
                  { name: "new-command", template: "" },
                ])
              }
            >
              + Add
            </button>
          }
        >
          {commands.length === 0 && (
            <div className="text-[10px] text-zinc-400">
              None yet. Built-in commands like /hero, /cta, /explain are always
              available.
            </div>
          )}
          <div className="space-y-2">
            {commands.map((cmd, i) => (
              <CommandRow
                key={i}
                command={cmd}
                onChange={(next) =>
                  setCommands((cs) => cs.map((c, j) => (j === i ? next : c)))
                }
                onRemove={() =>
                  setCommands((cs) => cs.filter((_, j) => j !== i))
                }
              />
            ))}
          </div>
        </Section>

        <Section title="Chat history">
          <button
            type="button"
            className={btnSecondary}
            onClick={() => {
              clearChatHistory();
              onCleared();
            }}
          >
            Clear chat history
          </button>
        </Section>

        <div className="flex justify-end gap-2 mt-4">
          <button type="button" className={btnSecondary} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={btnPrimary} onClick={onSaveClick}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

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
    <section className="mb-3">
      <header className="flex items-center justify-between mb-1.5 text-[10px] uppercase tracking-wider text-zinc-500">
        <span>{title}</span>
        {action}
      </header>
      <div>{children}</div>
    </section>
  );
}

function CommandRow({
  command,
  onChange,
  onRemove,
}: {
  command: CustomCommand;
  onChange: (next: CustomCommand) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded border border-zinc-200 dark:border-zinc-800 p-2 space-y-1.5">
      <div className="flex items-center gap-1">
        <span className="text-zinc-400 text-xs">/</span>
        <input
          value={command.name}
          onChange={(e) => onChange({ ...command, name: e.target.value })}
          placeholder="command-name"
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
      <textarea
        value={command.template}
        onChange={(e) => onChange({ ...command, template: e.target.value })}
        placeholder="Prompt template. {selection} expands to the selected element's HTML."
        className={`${inputClass} h-16 font-mono`}
      />
    </div>
  );
}
