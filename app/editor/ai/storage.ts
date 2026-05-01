// Namespaced localStorage wrappers. All AI-panel state lives under "lc-ai/".
// Reads are SSR-safe (return defaults when window is undefined).

import type { Message, Provider } from "./types";

export type CustomCommand = {
  name: string;
  template: string;
  description?: string;
};

const KEY_PROVIDER = "lc-ai/provider";
const KEY_MODEL = "lc-ai/model";
const KEY_KEY_ANTHROPIC = "lc-ai/key/anthropic";
const KEY_KEY_OPENAI = "lc-ai/key/openai";
const KEY_CUSTOM_COMMANDS = "lc-ai/custom-commands";
const KEY_CHAT_HISTORY = "lc-ai/chat-history";
const HISTORY_CAP = 50;

function safeRead(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeWrite(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* quota / private mode — silently drop */
  }
}

function safeRemove(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function loadProvider(): Provider {
  const v = safeRead(KEY_PROVIDER);
  return v === "openai" ? "openai" : "anthropic";
}

export function saveProvider(p: Provider): void {
  safeWrite(KEY_PROVIDER, p);
}

export function loadModel(): string | null {
  return safeRead(KEY_MODEL);
}

export function saveModel(m: string): void {
  safeWrite(KEY_MODEL, m);
}

export function loadApiKey(p: Provider): string {
  return safeRead(p === "anthropic" ? KEY_KEY_ANTHROPIC : KEY_KEY_OPENAI) ?? "";
}

export function saveApiKey(p: Provider, key: string): void {
  const k = p === "anthropic" ? KEY_KEY_ANTHROPIC : KEY_KEY_OPENAI;
  if (key) safeWrite(k, key);
  else safeRemove(k);
}

export function loadCustomCommands(): CustomCommand[] {
  const raw = safeRead(KEY_CUSTOM_COMMANDS);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (c): c is CustomCommand =>
        c && typeof c.name === "string" && typeof c.template === "string"
    );
  } catch {
    return [];
  }
}

export function saveCustomCommands(commands: CustomCommand[]): void {
  safeWrite(KEY_CUSTOM_COMMANDS, JSON.stringify(commands));
}

export function loadChatHistory(): Message[] {
  const raw = safeRead(KEY_CHAT_HISTORY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as Message[];
  } catch {
    return [];
  }
}

export function saveChatHistory(messages: Message[]): void {
  // Cap to the most recent HISTORY_CAP messages so localStorage doesn't grow
  // unbounded across long sessions.
  const capped = messages.slice(-HISTORY_CAP);
  safeWrite(KEY_CHAT_HISTORY, JSON.stringify(capped));
}

export function clearChatHistory(): void {
  safeRemove(KEY_CHAT_HISTORY);
}
