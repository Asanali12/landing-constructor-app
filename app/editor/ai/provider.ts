// Provider dispatcher + model catalog. Everything UI-side imports from here
// so the chat panel never touches a provider SDK directly.

import { runAnthropic } from "./provider-anthropic";
import { runOpenAI } from "./provider-openai";
import type { ModelInfo, Provider, RunChatArgs, StreamEvent } from "./types";

export const MODELS: Record<Provider, ModelInfo[]> = {
  anthropic: [
    { id: "claude-opus-4-7", label: "Claude Opus 4.7" },
    { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
    { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
  ],
  openai: [
    { id: "gpt-5", label: "GPT-5" },
    { id: "gpt-5-mini", label: "GPT-5 mini" },
    { id: "gpt-4.1", label: "GPT-4.1" },
  ],
};

export function defaultModel(p: Provider): string {
  return MODELS[p][0].id;
}

export function isValidModel(p: Provider, model: string): boolean {
  return MODELS[p].some((m) => m.id === model);
}

export function runChat(
  args: RunChatArgs
): AsyncGenerator<StreamEvent, void, void> {
  return args.provider === "anthropic" ? runAnthropic(args) : runOpenAI(args);
}
