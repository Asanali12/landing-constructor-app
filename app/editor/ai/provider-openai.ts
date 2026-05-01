// OpenAI adapter. Same shape as the Anthropic adapter — converts internal
// {Message, ToolDef} to OpenAI's chat-completions format and streams deltas
// back as normalized StreamEvents.

import OpenAI from "openai";
import type {
  Message,
  RunChatArgs,
  StreamEvent,
  ToolCall,
  ToolDef,
} from "./types";

type OAITextContent = { role: "user" | "assistant"; content: string };
type OAIToolMessage = {
  role: "tool";
  tool_call_id: string;
  content: string;
};
type OAIAssistantWithCalls = {
  role: "assistant";
  content: string | null;
  tool_calls: {
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }[];
};

type OAIMessage = OAITextContent | OAIToolMessage | OAIAssistantWithCalls;

function toOpenAIMessages(messages: Message[]): OAIMessage[] {
  const out: OAIMessage[] = [];
  for (const m of messages) {
    if (m.role === "user") {
      out.push({ role: "user", content: m.content });
    } else if (m.role === "assistant") {
      if (m.toolCalls && m.toolCalls.length) {
        out.push({
          role: "assistant",
          content: m.content || null,
          tool_calls: m.toolCalls.map((tc) => ({
            id: tc.id,
            type: "function",
            function: { name: tc.name, arguments: tc.args || "{}" },
          })),
        });
      } else {
        out.push({ role: "assistant", content: m.content });
      }
    } else {
      out.push({ role: "tool", tool_call_id: m.toolCallId, content: m.content });
    }
  }
  return out;
}

function toOpenAITools(tools: ToolDef[]) {
  return tools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.inputSchema,
    },
  }));
}

export async function* runOpenAI(
  args: RunChatArgs
): AsyncGenerator<StreamEvent, void, void> {
  const client = new OpenAI({
    apiKey: args.apiKey,
    dangerouslyAllowBrowser: true,
  });

  // Buffer per-tool-call args by index. OpenAI streams tool calls as a series
  // of partial chunks where the function name shows up once and arguments
  // accumulate; the full call isn't valid until finish_reason fires.
  const calls = new Map<number, ToolCall>();
  type StopReason =
    | "end_turn"
    | "tool_use"
    | "max_tokens"
    | "stop_sequence"
    | "other";
  let stopReason: StopReason = "end_turn";

  let stream;
  try {
    // Cast tools/messages to the SDK's expected union — our types are
    // structurally identical but the SDK's narrow type pulls in many
    // generated subtypes we don't need to mirror.
    stream = await client.chat.completions.create(
      {
        model: args.model,
        // OpenAI takes the system prompt as the first message rather than a
        // top-level field.
        messages: [
          { role: "system", content: args.system },
          ...toOpenAIMessages(args.messages),
        ] as Parameters<typeof client.chat.completions.create>[0]["messages"],
        tools: toOpenAITools(args.tools) as Parameters<
          typeof client.chat.completions.create
        >[0]["tools"],
        stream: true,
      },
      { signal: args.signal }
    );
  } catch (err) {
    yield { type: "error", message: errMessage(err) };
    return;
  }

  try {
    for await (const chunk of stream) {
      const choice = chunk.choices[0];
      if (!choice) continue;
      const delta = choice.delta;
      if (delta.content) {
        yield { type: "text-delta", delta: delta.content };
      }
      if (delta.tool_calls) {
        for (const tcd of delta.tool_calls) {
          const idx = tcd.index;
          let call = calls.get(idx);
          if (!call) {
            call = {
              id: tcd.id ?? "",
              name: tcd.function?.name ?? "",
              args: "",
            };
            calls.set(idx, call);
          } else {
            if (tcd.id) call.id = tcd.id;
            if (tcd.function?.name) call.name = tcd.function.name;
          }
          if (tcd.function?.arguments) {
            call.args += tcd.function.arguments;
          }
        }
      }
      const finish = choice.finish_reason;
      if (finish) {
        if (finish === "tool_calls") {
          stopReason = "tool_use";
          for (const call of calls.values()) {
            yield { type: "tool-call", call };
          }
          calls.clear();
        } else if (finish === "stop") {
          stopReason = "end_turn";
        } else if (finish === "length") {
          stopReason = "max_tokens";
        } else {
          stopReason = "other";
        }
      }
    }
    yield { type: "done", stopReason };
  } catch (err) {
    if (args.signal?.aborted) return;
    yield { type: "error", message: errMessage(err) };
  }
}

function errMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
