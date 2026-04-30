import { RAW_TEXT_TAGS, VOID_ELEMENTS } from "./constants";
import type { EditorDocument, EditorNode } from "./types";

function escapeText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function serializeAttributes(attrs: Record<string, string>): string {
  const parts: string[] = [];
  for (const [name, value] of Object.entries(attrs)) {
    if (value === "") {
      parts.push(name);
    } else {
      parts.push(`${name}="${escapeAttr(value)}"`);
    }
  }
  return parts.length ? " " + parts.join(" ") : "";
}

function serializeNode(node: EditorNode, indent: number, pretty: boolean): string {
  const pad = pretty ? "  ".repeat(indent) : "";
  const nl = pretty ? "\n" : "";

  if (node.kind === "text") {
    if (!pretty) return escapeText(node.text);
    const trimmed = node.text.trim();
    if (!trimmed) return "";
    return pad + escapeText(trimmed) + nl;
  }

  const attrs = serializeAttributes(node.attributes);

  if (VOID_ELEMENTS.has(node.tag)) {
    return `${pad}<${node.tag}${attrs} />${nl}`;
  }

  // Raw-text elements (style): emit children verbatim, no escaping.
  if (RAW_TEXT_TAGS.has(node.tag)) {
    const raw = node.children
      .map((c) => (c.kind === "text" ? c.text : ""))
      .join("");
    if (!raw) return `${pad}<${node.tag}${attrs}></${node.tag}>${nl}`;
    if (!pretty) return `<${node.tag}${attrs}>${raw}</${node.tag}>`;
    if (!raw.includes("\n")) {
      return `${pad}<${node.tag}${attrs}>${raw}</${node.tag}>${nl}`;
    }
    const indented = raw
      .split("\n")
      .map((line) => (line ? "  ".repeat(indent + 1) + line : line))
      .join("\n");
    return `${pad}<${node.tag}${attrs}>\n${indented}\n${pad}</${node.tag}>${nl}`;
  }

  if (node.children.length === 0) {
    return `${pad}<${node.tag}${attrs}></${node.tag}>${nl}`;
  }

  // Single text child: keep it inline for readability.
  if (
    node.children.length === 1 &&
    node.children[0].kind === "text" &&
    !node.children[0].text.includes("\n")
  ) {
    const text = escapeText(node.children[0].text);
    return `${pad}<${node.tag}${attrs}>${text}</${node.tag}>${nl}`;
  }

  const inner = node.children
    .map((c) => serializeNode(c, indent + 1, pretty))
    .filter(Boolean)
    .join("");

  return `${pad}<${node.tag}${attrs}>${nl}${inner}${pad}</${node.tag}>${nl}`;
}

export type SerializeOptions = {
  pretty?: boolean;
};

export function serializeDocument(
  doc: EditorDocument,
  options: SerializeOptions = {}
): string {
  const { pretty = true } = options;
  return doc.children
    .map((c) => serializeNode(c, 0, pretty))
    .filter(Boolean)
    .join("");
}
