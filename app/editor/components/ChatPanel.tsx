"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useEditor } from "../store";
import { TOOL_DEFS, TOOL_EXECUTORS, type ToolContext } from "../ai/tools";
import {
  defaultModel,
  isValidModel,
  MODELS,
  runChat,
} from "../ai/provider";
import {
  loadApiKey,
  loadChatHistory,
  loadModel,
  loadProvider,
  saveApiKey,
  saveChatHistory,
  saveModel,
  saveProvider,
} from "../ai/storage";
import { expandTemplate, findCommand } from "../ai/commands";
import type { Message, Provider, ToolCall } from "../ai/types";
import { AISettingsModal, type AISettings } from "./AISettingsModal";

const MAX_TOOL_ITERATIONS = 12;

const SYSTEM_PROMPT = `You are an AI assistant embedded in a visual HTML landing-page editor. The user gives you a prompt; you generate HTML and paste it into the editor with the paste_html tool.

YOU DO NOT SEE THE EXISTING PAGE. Generate purely from the user's prompt.

WORKFLOW
1. Generate complete, ready-to-render HTML responding to the prompt. Embed CSS in <style> blocks within your HTML.
2. Call paste_html(html: ...) with the HTML. It pastes inside the user's currently-selected element; if nothing is selected, it appends to the active viewport's document root. Any <style> blocks you include are auto-hoisted to the document root for global scoping.
3. Briefly summarize what you generated.

SANITIZATION (parsed-out at paste time)
- <script>, <noscript>, <iframe>, <object>, <embed> tags are stripped.
- Inline event-handler attributes (onclick, onload, ...) are stripped.
- javascript: URLs in href / src / action are stripped.
- Generate static HTML and CSS only.

STYLE
- Be concise. Skip narration unless asked.
- Don't ask permission for routine prompts — just generate and paste.`;

export function ChatPanel() {
  const editor = useEditor();
  // Stash the latest editor in a ref so tool executors fired from a long-running
  // async loop see fresh state and dispatchers without us re-creating the loop
  // every render.
  const editorRef = useRef(editor);
  editorRef.current = editor;

  const [messages, setMessages] = useState<Message[]>(() => loadChatHistory());
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [provider, setProvider] = useState<Provider>(() => loadProvider());
  const [model, setModel] = useState<string>(() => {
    const m = loadModel();
    const p = loadProvider();
    return m && isValidModel(p, m) ? m : defaultModel(p);
  });
  const [anthropicKey, setAnthropicKey] = useState(() => loadApiKey("anthropic"));
  const [openaiKey, setOpenaiKey] = useState(() => loadApiKey("openai"));

  // Slash-command autocomplete state.
  const [showCommands, setShowCommands] = useState(false);
  const [commandPrefix, setCommandPrefix] = useState("");

  const abortRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<HTMLDivElement | null>(null);

  const activeKey = provider === "anthropic" ? anthropicKey : openaiKey;
  const hasKey = activeKey.trim().length > 0;

  // Keep messages persisted as they grow.
  useEffect(() => {
    saveChatHistory(messages);
  }, [messages]);

  // Auto-scroll to bottom when content arrives.
  useEffect(() => {
    const el = messagesRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, streamingText]);

  const buildCtx = useCallback((): ToolContext => {
    const e = editorRef.current;
    return {
      getDoc: (vp) => (vp ? e.state.docs[vp] : e.state.doc),
      getSelectedId: () => e.state.selectedId,
      getActiveViewport: () => e.state.activeViewport,
      loadHtml: (html, vp) => editorRef.current.loadHtml(html, vp),
      applyDoc: (doc, vp) => editorRef.current.applyDoc(doc, vp),
      setAttr: (id, k, v) => editorRef.current.setAttr(id, k, v),
      removeAttr: (id, k) => editorRef.current.removeAttr(id, k),
      renameAttr: (id, ok, nk) => editorRef.current.renameAttr(id, ok, nk),
      updateTag: (id, t) => editorRef.current.updateTag(id, t),
      setInnerText: (id, t) => editorRef.current.setInnerText(id, t),
      updateText: (id, t) => editorRef.current.updateText(id, t),
      deleteNode: (id) => editorRef.current.deleteNode(id),
      duplicateNode: (id) => editorRef.current.duplicateNode(id),
      setEvents: (id, ev) => editorRef.current.setEvents(id, ev),
      select: (id) => editorRef.current.select(id),
    };
  }, []);

  const send = useCallback(
    async (userText: string) => {
      if (!userText.trim()) return;
      setError(null);

      const userMsg: Message = { role: "user", content: userText };
      let working: Message[] = [...messages, userMsg];
      setMessages(working);
      setInput("");

      if (!hasKey) {
        setError(`Please add a ${provider === "anthropic" ? "Anthropic" : "OpenAI"} API key in settings.`);
        return;
      }

      const ac = new AbortController();
      abortRef.current = ac;
      setStreaming(true);

      const ctx = buildCtx();
      // Single-tool surface: the AI just generates HTML and we paste it.
      const tools = TOOL_DEFS.filter((t) => t.name === "paste_html");

      try {
        for (let iter = 0; iter < MAX_TOOL_ITERATIONS; iter++) {
          if (ac.signal.aborted) break;

          let assistantText = "";
          const toolCalls: ToolCall[] = [];
          let sawError = false;

          setStreamingText("");

          for await (const ev of runChat({
            provider,
            model,
            apiKey: activeKey,
            system: SYSTEM_PROMPT,
            messages: working,
            tools,
            signal: ac.signal,
          })) {
            if (ev.type === "text-delta") {
              assistantText += ev.delta;
              setStreamingText(assistantText);
            } else if (ev.type === "tool-call") {
              toolCalls.push(ev.call);
            } else if (ev.type === "error") {
              setError(ev.message);
              sawError = true;
              break;
            } else if (ev.type === "done") {
              break;
            }
          }

          if (sawError) break;

          // Commit assistant turn (text + any tool calls).
          working = [
            ...working,
            {
              role: "assistant",
              content: assistantText,
              toolCalls: toolCalls.length ? toolCalls : undefined,
            },
          ];
          setMessages(working);
          setStreamingText("");

          if (toolCalls.length === 0) break;

          // Execute tools in order, append a tool-result message for each.
          for (const call of toolCalls) {
            if (ac.signal.aborted) break;
            const executor = TOOL_EXECUTORS[call.name];
            let result: string;
            let isError = false;
            if (!executor) {
              result = `Unknown tool: ${call.name}`;
              isError = true;
            } else {
              try {
                const parsed = call.args ? JSON.parse(call.args) : {};
                result = await executor(parsed, ctx);
              } catch (e) {
                result =
                  "Tool error: " +
                  (e instanceof Error ? e.message : String(e));
                isError = true;
              }
            }
            working = [
              ...working,
              {
                role: "tool",
                toolCallId: call.id,
                content: result,
                isError,
              },
            ];
            setMessages(working);
          }
        }
      } finally {
        setStreaming(false);
        setStreamingText("");
        abortRef.current = null;
      }
    },
    [activeKey, buildCtx, hasKey, messages, model, provider]
  );

  const stop = () => {
    abortRef.current?.abort();
  };

  // --- input + slash command handling ---

  const onInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value;
    setInput(v);
    // Show command popover only when the input starts with "/" (single line so
    // far) — keeps it out of the way once the user has typed paragraphs.
    const m = /^\/([^\s]*)$/.exec(v);
    if (m) {
      setShowCommands(true);
      setCommandPrefix(m[1]);
    } else {
      setShowCommands(false);
    }
  };

  const applyCommand = (template: string) => {
    const expanded = expandTemplate(template, editor.selectedNode);
    setInput(expanded);
    setShowCommands(false);
  };

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!streaming) send(input);
    } else if (e.key === "Escape" && showCommands) {
      setShowCommands(false);
    }
  };

  // --- settings ---

  const onSettingsSave = (next: AISettings) => {
    setProvider(next.provider);
    setModel(next.model);
    setAnthropicKey(next.anthropicKey);
    setOpenaiKey(next.openaiKey);
    saveProvider(next.provider);
    saveModel(next.model);
    saveApiKey("anthropic", next.anthropicKey);
    saveApiKey("openai", next.openaiKey);
    setSettingsOpen(false);
  };

  const modelLabel = useMemo(() => {
    const m = MODELS[provider].find((x) => x.id === model);
    return m?.label ?? model;
  }, [provider, model]);

  const commandMatches = useMemo(
    () => (showCommands ? findCommand(commandPrefix).slice(0, 8) : []),
    [showCommands, commandPrefix]
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-200 dark:border-zinc-800 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-zinc-500">Chat</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-900 text-zinc-500 truncate">
            {modelLabel}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className="text-zinc-400 hover:text-zinc-700 px-1"
          title="AI settings"
        >
          ⚙
        </button>
      </div>

      <div ref={messagesRef} className="flex-1 overflow-auto p-3 space-y-3 text-xs">
        {messages.length === 0 && !streaming && (
          <div className="text-zinc-400">
            Ask the AI to edit the page. Type / for shortcut commands.
            {!hasKey && (
              <div className="mt-2 text-amber-600 dark:text-amber-400">
                Add an API key via the gear icon to start.
              </div>
            )}
          </div>
        )}
        {messages.map((m, i) => (
          <MessageBubble key={i} message={m} />
        ))}
        {streaming && (
          <div className="text-zinc-700 dark:text-zinc-200 whitespace-pre-wrap">
            {streamingText}
            <span className="inline-block w-1.5 h-3 ml-0.5 bg-blue-500 animate-pulse align-middle" />
          </div>
        )}
        {error && (
          <div className="text-red-600 text-[11px] whitespace-pre-wrap rounded border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 p-2">
            {error}
          </div>
        )}
      </div>

      <div className="border-t border-zinc-200 dark:border-zinc-800 p-2 relative">
        {showCommands && commandMatches.length > 0 && (
          <div className="absolute left-2 right-2 bottom-full mb-1 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-lg max-h-48 overflow-auto z-10">
            {commandMatches.map((c) => (
              <button
                key={c.name}
                type="button"
                onClick={() => applyCommand(c.template)}
                className="block w-full text-left px-2 py-1.5 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-900"
              >
                <span className="font-mono text-blue-600">/{c.name}</span>
                <span className="ml-2 text-zinc-500 text-[10px]">
                  {c.description}
                </span>
              </button>
            ))}
          </div>
        )}
        <textarea
          value={input}
          onChange={onInputChange}
          onKeyDown={onInputKeyDown}
          placeholder={
            hasKey
              ? "Message… (Enter to send, Shift+Enter for newline, / for commands)"
              : "Add an API key via ⚙ to start"
          }
          rows={3}
          disabled={!hasKey && !streaming}
          className="w-full px-2 py-1.5 text-xs rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 focus:outline-none focus:border-blue-400 resize-none font-mono"
        />
        <div className="flex items-center justify-end gap-2 mt-1.5">
          {streaming ? (
            <button
              type="button"
              onClick={stop}
              className="h-7 px-3 text-xs font-medium rounded border border-red-200 dark:border-red-900 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
            >
              Stop
            </button>
          ) : (
            <button
              type="button"
              onClick={() => send(input)}
              disabled={!hasKey || !input.trim()}
              className="h-7 px-3 text-xs font-medium rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Send
            </button>
          )}
        </div>
      </div>

      {settingsOpen && (
        <AISettingsModal
          initial={{ provider, model, anthropicKey, openaiKey }}
          onClose={() => setSettingsOpen(false)}
          onSave={onSettingsSave}
          onCleared={() => setMessages([])}
        />
      )}
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] bg-blue-600 text-white rounded-lg px-2.5 py-1.5 whitespace-pre-wrap break-words">
          {message.content}
        </div>
      </div>
    );
  }
  if (message.role === "assistant") {
    return (
      <div className="text-zinc-700 dark:text-zinc-200 space-y-1">
        {message.content && (
          <div className="whitespace-pre-wrap break-words">{message.content}</div>
        )}
        {message.toolCalls?.map((c) => (
          <ToolCallLine key={c.id} call={c} />
        ))}
      </div>
    );
  }
  // tool
  return (
    <ToolResultLine
      result={message.content}
      isError={message.isError}
    />
  );
}

function ToolCallLine({ call }: { call: ToolCall }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="text-[10px] text-zinc-500 font-mono">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="hover:text-zinc-700"
      >
        {open ? "▾" : "▸"} {call.name}
      </button>
      {open && (
        <pre className="mt-0.5 p-1.5 bg-zinc-50 dark:bg-zinc-900 rounded overflow-auto max-h-32 whitespace-pre-wrap break-words">
          {prettyJson(call.args)}
        </pre>
      )}
    </div>
  );
}

function ToolResultLine({
  result,
  isError,
}: {
  result: string;
  isError?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const preview = result.length > 80 ? result.slice(0, 80) + "…" : result;
  return (
    <div
      className={`text-[10px] font-mono ${
        isError ? "text-red-600" : "text-zinc-500"
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="hover:text-zinc-700 text-left w-full break-words"
      >
        {open ? "▾" : "▸"} {isError ? "✗" : "→"} {open ? "" : preview}
      </button>
      {open && (
        <pre className="mt-0.5 p-1.5 bg-zinc-50 dark:bg-zinc-900 rounded overflow-auto max-h-48 whitespace-pre-wrap break-words">
          {result}
        </pre>
      )}
    </div>
  );
}

function prettyJson(s: string): string {
  try {
    return JSON.stringify(JSON.parse(s || "{}"), null, 2);
  } catch {
    return s;
  }
}
