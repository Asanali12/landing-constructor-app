// Internal, provider-neutral chat shape. Both the Anthropic and OpenAI
// adapters convert to/from these types so the rest of the UI never branches
// on provider.

export type Provider = "anthropic" | "openai";

export type ModelInfo = {
  id: string;
  label: string;
};

export type Message =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; toolCalls?: ToolCall[] }
  | { role: "tool"; toolCallId: string; content: string; isError?: boolean };

export type ToolCall = {
  id: string;
  name: string;
  // Stringified JSON arguments. Stored as a string because providers stream
  // arguments as JSON deltas — the final string is the source of truth.
  args: string;
};

// JSON Schema for tool input. We use a permissive shape and cast it to each
// provider's expected type at the adapter boundary.
export type ToolInputSchema = {
  type: "object";
  properties?: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
};

export type ToolDef = {
  name: string;
  description: string;
  inputSchema: ToolInputSchema;
};

// Events the adapter yields to the chat loop.
export type StreamEvent =
  | { type: "text-delta"; delta: string }
  | { type: "tool-call"; call: ToolCall }
  | { type: "done"; stopReason: "end_turn" | "tool_use" | "max_tokens" | "stop_sequence" | "other" }
  | { type: "error"; message: string };

export type RunChatArgs = {
  provider: Provider;
  model: string;
  apiKey: string;
  system: string;
  messages: Message[];
  tools: ToolDef[];
  signal?: AbortSignal;
};
