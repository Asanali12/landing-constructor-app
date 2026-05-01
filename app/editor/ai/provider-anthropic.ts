// Anthropic adapter. Translates our internal {Message, ToolDef} shape to
// Anthropic's content-block format, then streams `messages.stream(...)` events
// back as normalized StreamEvents.

import Anthropic from "@anthropic-ai/sdk";
import type {
  Message,
  RunChatArgs,
  StreamEvent,
  ToolCall,
  ToolDef,
} from "./types";

const DEFAULT_MAX_TOKENS = 4096;

type AnthropicContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean };

type AnthropicMessage = {
  role: "user" | "assistant";
  content: AnthropicContentBlock[];
};

// Internal -> Anthropic. Consecutive `tool` messages collapse into a single
// user turn carrying multiple tool_result blocks, which is what Anthropic's
// API wants between assistant turns.
function toAnthropicMessages(messages: Message[]): AnthropicMessage[] {
  const out: AnthropicMessage[] = [];
  let pendingToolResults: AnthropicContentBlock[] = [];

  const flushToolResults = () => {
    if (pendingToolResults.length) {
      out.push({ role: "user", content: pendingToolResults });
      pendingToolResults = [];
    }
  };

  for (const m of messages) {
    if (m.role === "tool") {
      pendingToolResults.push({
        type: "tool_result",
        tool_use_id: m.toolCallId,
        content: m.content,
        is_error: m.isError,
      });
      continue;
    }
    flushToolResults();
    if (m.role === "user") {
      out.push({ role: "user", content: [{ type: "text", text: m.content }] });
    } else {
      const blocks: AnthropicContentBlock[] = [];
      if (m.content) blocks.push({ type: "text", text: m.content });
      for (const tc of m.toolCalls ?? []) {
        let input: unknown = {};
        try {
          input = tc.args ? JSON.parse(tc.args) : {};
        } catch {
          // If args couldn't parse as JSON, send the raw string — better to
          // round-trip something than to drop the call.
          input = { _raw: tc.args };
        }
        blocks.push({ type: "tool_use", id: tc.id, name: tc.name, input });
      }
      out.push({ role: "assistant", content: blocks });
    }
  }
  flushToolResults();
  return out;
}

function toAnthropicTools(tools: ToolDef[]) {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema,
  }));
}

export async function* runAnthropic(
  args: RunChatArgs
): AsyncGenerator<StreamEvent, void, void> {
  const client = new Anthropic({
    apiKey: args.apiKey,
    dangerouslyAllowBrowser: true,
  });

  // Track in-progress tool_use blocks by their stream index so input_json
  // deltas can be appended to the right call.
  const inFlightCalls = new Map<number, ToolCall>();
  type StopReason =
    | "end_turn"
    | "tool_use"
    | "max_tokens"
    | "stop_sequence"
    | "other";
  let stopReason: StopReason = "end_turn";

  let stream;
  try {
    stream = client.messages.stream(
      {
        model: args.model,
        max_tokens: DEFAULT_MAX_TOKENS,
        system: args.system,
        messages: toAnthropicMessages(args.messages),
        tools: toAnthropicTools(args.tools),
      },
      { signal: args.signal }
    );
  } catch (err) {
    yield { type: "error", message: errMessage(err) };
    return;
  }

  try {
    for await (const event of stream) {
      switch (event.type) {
        case "content_block_start": {
          const block = event.content_block;
          if (block.type === "tool_use") {
            inFlightCalls.set(event.index, {
              id: block.id,
              name: block.name,
              args: "",
            });
          }
          break;
        }
        case "content_block_delta": {
          const delta = event.delta;
          if (delta.type === "text_delta") {
            yield { type: "text-delta", delta: delta.text };
          } else if (delta.type === "input_json_delta") {
            const call = inFlightCalls.get(event.index);
            if (call) call.args += delta.partial_json;
          }
          break;
        }
        case "content_block_stop": {
          const call = inFlightCalls.get(event.index);
          if (call) {
            inFlightCalls.delete(event.index);
            yield { type: "tool-call", call };
          }
          break;
        }
        case "message_delta": {
          const r = event.delta.stop_reason;
          if (r === "end_turn" || r === "tool_use" || r === "max_tokens" || r === "stop_sequence") {
            stopReason = r;
          } else if (r) {
            stopReason = "other";
          }
          break;
        }
        // message_start / message_stop — nothing to surface.
      }
    }
    yield { type: "done", stopReason };
  } catch (err) {
    if (args.signal?.aborted) return; // user pressed stop
    yield { type: "error", message: errMessage(err) };
  }
}

function errMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
