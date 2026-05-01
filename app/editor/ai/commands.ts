// Slash commands. Built-ins ship with the app; user-defined commands merge
// in from localStorage and override built-ins on name collision.
//
// Templates may include placeholders that are expanded against the chat
// context at send time:
//   {selection}      → HTML of the selected node, or "(no selection)"
//   {selection_id}   → id of the selected node, or "(no selection)"
//   {selection_tag}  → tag of the selected node, or "(no selection)"

import type { CustomCommand } from "./storage";
import { loadCustomCommands } from "./storage";
import { serializeForAI } from "./serialize-for-ai";
import type { EditorNode } from "../types";
import { isElement } from "../types";

export type SlashCommand = {
  name: string;
  description: string;
  template: string;
};

export const BUILTIN_COMMANDS: SlashCommand[] = [
  {
    name: "hero",
    description: "Insert a hero section at the top of the page",
    template:
      "Insert a polished hero section at the top of the document. Include a heading, a subheading, and a primary CTA button. Use a `<style>` block (via add_style_block) for the visual design — gradient background, generous padding, modern typography.",
  },
  {
    name: "cta",
    description: "Add a call-to-action block",
    template:
      "Add a clearly-styled call-to-action block near the end of the document. Bold, large button with hover state defined in a `<style>` block.",
  },
  {
    name: "explain",
    description: "Explain the currently selected element",
    template:
      "Explain what this element does, its structure, and what design intent it implies:\n\n```html\n{selection}\n```",
  },
  {
    name: "dark-mode",
    description: "Apply a dark color scheme to the page",
    template:
      "Apply a tasteful dark color scheme across the page. Add a single `<style>` block that targets the existing elements without changing their structure. Maintain readable contrast.",
  },
  {
    name: "responsive-fix",
    description: "Make the layout responsive on mobile",
    template:
      "Audit the page for layout issues at mobile widths and fix them by adding responsive CSS rules in a single `<style>` block. Do not change the HTML structure unless absolutely necessary.",
  },
  {
    name: "cleanup",
    description: "Remove redundant attributes / dead nodes",
    template:
      "Inspect the document and clean up: remove redundant inline styles that duplicate stylesheet rules, drop empty elements that contribute nothing visually, and merge adjacent text nodes where safe. Report what you changed.",
  },
];

export function getAllCommands(): SlashCommand[] {
  const custom = loadCustomCommands();
  const customByName = new Map(custom.map((c) => [c.name, c]));
  // User commands override built-ins of the same name.
  const merged: SlashCommand[] = [];
  for (const b of BUILTIN_COMMANDS) {
    const override = customByName.get(b.name);
    if (override) {
      merged.push(toSlash(override, b.description));
      customByName.delete(b.name);
    } else {
      merged.push(b);
    }
  }
  for (const c of customByName.values()) {
    merged.push(toSlash(c));
  }
  return merged;
}

function toSlash(c: CustomCommand, fallbackDesc?: string): SlashCommand {
  return {
    name: c.name,
    description: c.description ?? fallbackDesc ?? "Custom command",
    template: c.template,
  };
}

export function expandTemplate(
  template: string,
  selection: EditorNode | null
): string {
  const sel = selection;
  const html = sel
    ? isElement(sel)
      ? serializeForAI({ children: [sel] }).trim()
      : sel.text
    : "(no selection)";
  const id = sel?.id ?? "(no selection)";
  const tag = sel && isElement(sel) ? sel.tag : "(no selection)";
  return template
    .replace(/\{selection\}/g, html)
    .replace(/\{selection_id\}/g, id)
    .replace(/\{selection_tag\}/g, tag);
}

export function findCommand(prefix: string): SlashCommand[] {
  const all = getAllCommands();
  if (!prefix) return all;
  const p = prefix.toLowerCase();
  return all.filter((c) => c.name.toLowerCase().startsWith(p));
}
