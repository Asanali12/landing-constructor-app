// Merge desktop and mobile editor documents into one self-contained HTML
// string. Each viewport's body is wrapped in a scope div, its <style> blocks
// are prefixed with that scope class, and a single media query toggles which
// scope is visible at runtime.
//
//   <body>
//     <div class="lc-view-desktop"> …desktop body… </div>
//     <div class="lc-view-mobile">  …mobile body…  </div>
//   </body>
//
// The desktop scope is shown by default; the mobile scope appears below the
// configured breakpoint. Authors can keep using whatever class names / nested
// media queries they want — the prefixer narrows specificity without altering
// rule semantics.

import { MOBILE_BREAKPOINT_PX } from "./constants";
import { prefixCss } from "./css-prefix";
import type { EditorDocument, EditorNode, ElementNode } from "./types";
import { isElement } from "./types";

export const DESKTOP_SCOPE = "lc-view-desktop";
export const MOBILE_SCOPE = "lc-view-mobile";

export function scopeClassFor(viewport: "desktop" | "mobile"): string {
  return viewport === "desktop" ? DESKTOP_SCOPE : MOBILE_SCOPE;
}

export type MergeOptions = {
  // Pixel width at which the mobile scope takes over.
  breakpointPx?: number;
};

export function serializeMerged(
  desktop: EditorDocument,
  mobile: EditorDocument,
  options: MergeOptions = {}
): string {
  const breakpoint = options.breakpointPx ?? MOBILE_BREAKPOINT_PX;

  const desktopParts = splitHeadAndBody(desktop);
  const mobileParts = splitHeadAndBody(mobile);

  const scopedDesktopCss = scopeStyles(desktopParts.styleNodes, DESKTOP_SCOPE);
  const scopedMobileCss = scopeStyles(mobileParts.styleNodes, MOBILE_SCOPE);

  const headLinks = mergeStylesheetLinks([
    ...desktopParts.linkNodes,
    ...mobileParts.linkNodes,
  ]);

  const desktopBodyHtml = serializeChildrenToHtml(desktopParts.body);
  const mobileBodyHtml = serializeChildrenToHtml(mobileParts.body);

  const switcherCss = `
.${DESKTOP_SCOPE} { display: block; }
.${MOBILE_SCOPE}  { display: none; }
@media (max-width: ${breakpoint}px) {
  .${DESKTOP_SCOPE} { display: none; }
  .${MOBILE_SCOPE}  { display: block; }
}`.trim();

  const lines: string[] = [];
  lines.push("<!DOCTYPE html>");
  lines.push('<html lang="en">');
  lines.push("  <head>");
  lines.push('    <meta charset="utf-8">');
  lines.push(
    '    <meta name="viewport" content="width=device-width, initial-scale=1">'
  );
  for (const link of headLinks) lines.push("    " + link);
  lines.push("    <style>");
  lines.push(indent(switcherCss, 6));
  if (scopedDesktopCss.trim()) {
    lines.push("");
    lines.push(`      /* ===== Desktop (.${DESKTOP_SCOPE}) ===== */`);
    lines.push(indent(scopedDesktopCss, 6));
  }
  if (scopedMobileCss.trim()) {
    lines.push("");
    lines.push(`      /* ===== Mobile (.${MOBILE_SCOPE}) ===== */`);
    lines.push(indent(scopedMobileCss, 6));
  }
  lines.push("    </style>");
  lines.push("  </head>");
  lines.push("  <body>");
  lines.push(`    <div class="${DESKTOP_SCOPE}">`);
  lines.push(indent(desktopBodyHtml, 6));
  lines.push("    </div>");
  lines.push(`    <div class="${MOBILE_SCOPE}">`);
  lines.push(indent(mobileBodyHtml, 6));
  lines.push("    </div>");
  lines.push("  </body>");
  lines.push("</html>");
  lines.push("");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Splitting head bits out of a flat children array
// ---------------------------------------------------------------------------

export type Split = {
  styleNodes: ElementNode[];
  linkNodes: ElementNode[];
  body: EditorNode[];
};

// parseHtml puts <style> and <link rel=stylesheet> elements at the start of
// doc.children (parse.ts gathers them from <head> first, then appends the
// body). We strip the leading run of those tags wherever they appear in the
// tree (top-level only — nested style tags inside body content are left where
// they are and get scoped along with everything else).
export function splitHeadAndBody(doc: EditorDocument): Split {
  const styleNodes: ElementNode[] = [];
  const linkNodes: ElementNode[] = [];
  const body: EditorNode[] = [];

  for (const node of doc.children) {
    if (isElement(node) && node.tag === "style") {
      styleNodes.push(node);
      continue;
    }
    if (isElement(node) && node.tag === "link") {
      const rel = (node.attributes.rel ?? "").toLowerCase();
      if (rel.includes("stylesheet")) {
        linkNodes.push(node);
        continue;
      }
    }
    body.push(node);
  }

  return { styleNodes, linkNodes, body };
}

export function scopeStyles(styleNodes: ElementNode[], scope: string): string {
  const parts: string[] = [];
  for (const node of styleNodes) {
    const css = node.children
      .map((c) => (c.kind === "text" ? c.text : ""))
      .join("");
    if (!css.trim()) continue;
    parts.push(prefixCss(css, scope));
  }
  return parts.join("\n");
}

// Dedup external stylesheet links by href so the same font CSS isn't requested
// twice when desktop and mobile import the same external sheet.
function mergeStylesheetLinks(nodes: ElementNode[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const node of nodes) {
    const href = node.attributes.href ?? "";
    if (href && seen.has(href)) continue;
    if (href) seen.add(href);
    out.push(serializeOpenVoid(node));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Tiny HTML serializer (subset — used only for body output and link dedup)
// ---------------------------------------------------------------------------

const VOID = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta",
  "param", "source", "track", "wbr",
]);
const RAW = new Set(["style", "script"]);

function serializeChildrenToHtml(nodes: EditorNode[]): string {
  return nodes.map((n) => serializeNodeToHtml(n)).join("");
}

function serializeNodeToHtml(node: EditorNode): string {
  if (node.kind === "text") return escapeText(node.text);
  const open = serializeOpenTag(node);
  if (VOID.has(node.tag)) return open.replace(/>$/, " />");
  if (RAW.has(node.tag)) {
    const raw = node.children
      .map((c) => (c.kind === "text" ? c.text : ""))
      .join("");
    return `${open}${raw}</${node.tag}>`;
  }
  const inner = node.children.map((c) => serializeNodeToHtml(c)).join("");
  return `${open}${inner}</${node.tag}>`;
}

function serializeOpenTag(node: ElementNode): string {
  const attrs = Object.entries(node.attributes)
    .map(([k, v]) => (v === "" ? k : `${k}="${escapeAttr(v)}"`))
    .join(" ");
  return attrs ? `<${node.tag} ${attrs}>` : `<${node.tag}>`;
}

function serializeOpenVoid(node: ElementNode): string {
  const tag = serializeOpenTag(node);
  return tag.replace(/>$/, " />");
}

function escapeText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function indent(text: string, spaces: number): string {
  const pad = " ".repeat(spaces);
  return text
    .split("\n")
    .map((line) => (line ? pad + line : line))
    .join("\n");
}
