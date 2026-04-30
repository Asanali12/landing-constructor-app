// Render-time CSS scoping for the preview canvas.
//
// The preview canvas is a normal DOM subtree on the same page as the editor
// chrome, so a user-imported rule like `body { ... }` or `h1 { ... }` would
// otherwise leak across the whole document. To prevent that, we transform the
// rules so that:
//
//   • rules that target `body`, `html`, or `:root` become rules on the
//     canvas wrapper (which carries the `.lc-canvas` class)
//   • naked tag selectors (`h1`, `p > a`) are rewritten to class selectors
//     (`.__scope-h1`, `.__scope-p > .__scope-a`) and the renderer augments
//     each matching element's `class` attribute at render time
//   • @media / @supports / @container / @layer blocks are recursed into
//   • @keyframes / @font-face / @page / @import are kept verbatim
//
// Only renders are affected — the JSON tree and exported HTML keep the
// original CSS exactly as authored.

import type { EditorDocument, EditorNode } from "./types";
import { isElement } from "./types";

// HTML element names we're willing to rewrite to classes.
const HTML_TAGS = new Set([
  "a","abbr","address","area","article","aside","audio","b","base","bdi","bdo",
  "blockquote","br","button","canvas","caption","cite","code","col","colgroup",
  "data","datalist","dd","del","details","dfn","dialog","div","dl","dt","em",
  "embed","fieldset","figcaption","figure","footer","form","h1","h2","h3","h4",
  "h5","h6","header","hgroup","hr","i","iframe","img","input","ins","kbd",
  "label","legend","li","main","map","mark","menu","meter","nav","noscript",
  "object","ol","optgroup","option","output","p","param","picture","pre",
  "progress","q","rp","rt","ruby","s","samp","section","select","slot",
  "small","source","span","strong","sub","summary","sup","svg","table",
  "tbody","td","template","textarea","tfoot","th","thead","time","tr","track",
  "u","ul","var","video","wbr",
]);

// Targets that mean "the page root" — we redirect these to the canvas wrapper.
const ROOT_TARGETS = new Set(["body", "html", ":root"]);

// At-rules whose body contains nested rules (so we recurse).
const NESTED_AT_RULES = new Set(["media", "supports", "container", "layer"]);

const SCOPE_CLASS_PREFIX = "__scope-";
const CANVAS_CLASS = "lc-canvas";

export const scopeClassFor = (tag: string) => `${SCOPE_CLASS_PREFIX}${tag.toLowerCase()}`;

export type ScopeResult = {
  // Rewritten CSS to inject into the preview canvas.
  css: string;
  // For each lowercase tag, the class name to add to matching elements.
  tagClasses: Record<string, string>;
  // Whether body/html/:root rules were observed (for documentation; not used
  // by callers right now but kept on the result for potential future UI).
  rewroteRoot: boolean;
};

export function collectAndScope(doc: EditorDocument): ScopeResult {
  const allCss = collectStyleText(doc.children);
  return scopeCss(allCss);
}

function collectStyleText(nodes: EditorNode[]): string {
  const parts: string[] = [];
  for (const node of nodes) {
    if (!isElement(node)) continue;
    if (node.tag === "style") {
      for (const c of node.children) {
        if (c.kind === "text") parts.push(c.text);
      }
    }
    parts.push(collectStyleText(node.children));
  }
  return parts.filter(Boolean).join("\n");
}

// ---------------------------------------------------------------------------
// CSS rewriter
// ---------------------------------------------------------------------------

export function scopeCss(input: string): ScopeResult {
  if (!input.trim()) {
    return { css: "", tagClasses: {}, rewroteRoot: false };
  }

  const stripped = stripComments(input);
  const tagClasses: Record<string, string> = {};
  const state = { rewroteRoot: false };

  const out = walkRules(stripped, tagClasses, state);
  return { css: out, tagClasses, rewroteRoot: state.rewroteRoot };
}

function stripComments(css: string): string {
  // Strip /* ... */ comments. CSS doesn't allow nesting so a single regex is
  // safe here (we're not running on hostile input).
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

type ScopeState = { rewroteRoot: boolean };

function walkRules(
  css: string,
  tagClasses: Record<string, string>,
  state: ScopeState
): string {
  let i = 0;
  let out = "";

  while (i < css.length) {
    // Copy whitespace verbatim.
    const wsEnd = skipWhile(css, i, (c) => /\s/.test(c));
    out += css.slice(i, wsEnd);
    i = wsEnd;
    if (i >= css.length) break;

    if (css[i] === "@") {
      const end = findAtRuleEnd(css, i);
      const block = css.slice(i, end);
      out += rewriteAtRule(block, tagClasses, state);
      i = end;
      continue;
    }

    // A normal rule: <selector list> { <decls> }
    const braceIdx = findUnquoted(css, i, "{");
    if (braceIdx < 0) {
      // Malformed tail — keep verbatim.
      out += css.slice(i);
      break;
    }
    const closeIdx = findMatchingBrace(css, braceIdx);
    const selector = css.slice(i, braceIdx);
    const body = css.slice(braceIdx + 1, closeIdx);
    out += rewriteSelectorList(selector, tagClasses, state) + "{" + body + "}";
    i = closeIdx + 1;
  }

  return out;
}

function rewriteAtRule(
  block: string,
  tagClasses: Record<string, string>,
  state: ScopeState
): string {
  const nameMatch = block.match(/^@([\w-]+)/);
  const name = nameMatch?.[1]?.toLowerCase() ?? "";

  // Body-less at-rule (e.g. @import, @charset) — copy verbatim.
  const semi = findUnquoted(block, 0, ";");
  const open = findUnquoted(block, 0, "{");
  if (open < 0 || (semi >= 0 && semi < open)) {
    return block;
  }

  const close = findMatchingBrace(block, open);
  const prelude = block.slice(0, open + 1);
  const body = block.slice(open + 1, close);
  const tail = block.slice(close);

  if (NESTED_AT_RULES.has(name)) {
    return prelude + walkRules(body, tagClasses, state) + tail;
  }
  // @keyframes / @font-face / @page / unknown — keep as-is.
  return block;
}

function rewriteSelectorList(
  raw: string,
  tagClasses: Record<string, string>,
  state: ScopeState
): string {
  const parts = splitTopLevel(raw, ",");
  return parts.map((p) => rewriteOneSelector(p, tagClasses, state)).join(",");
}

function rewriteOneSelector(
  selector: string,
  tagClasses: Record<string, string>,
  state: ScopeState
): string {
  let i = 0;
  let out = "";
  let parenDepth = 0;
  let bracketDepth = 0;

  while (i < selector.length) {
    const ch = selector[i];

    if (ch === "(" ) { parenDepth++; out += ch; i++; continue; }
    if (ch === ")" ) { parenDepth--; out += ch; i++; continue; }
    if (ch === "[" ) { bracketDepth++; out += ch; i++; continue; }
    if (ch === "]" ) { bracketDepth--; out += ch; i++; continue; }

    if (parenDepth > 0 || bracketDepth > 0) {
      out += ch;
      i++;
      continue;
    }

    if (isTagStartHere(selector, i)) {
      const j = readIdentEnd(selector, i);
      const ident = selector.slice(i, j).toLowerCase();

      if (ROOT_TARGETS.has(ident)) {
        out += "." + CANVAS_CLASS;
        state.rewroteRoot = true;
        i = j;
        continue;
      }
      if (HTML_TAGS.has(ident)) {
        const cls = scopeClassFor(ident);
        tagClasses[ident] = cls;
        out += "." + cls;
        i = j;
        continue;
      }
      // Unknown identifier — keep verbatim. This covers things like custom
      // elements (`my-widget`) and unknown bare words.
      out += selector.slice(i, j);
      i = j;
      continue;
    }

    // Handle ":root" pseudo-class which starts at depth-0 with `:`.
    if (ch === ":" && selector.slice(i, i + 5).toLowerCase() === ":root") {
      const next = selector[i + 5];
      const isEnd = next === undefined || /[\s,>+~().[\]:#]/.test(next);
      if (isEnd) {
        out += "." + CANVAS_CLASS;
        state.rewroteRoot = true;
        i += 5;
        continue;
      }
    }

    out += ch;
    i++;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Low-level scanning helpers
// ---------------------------------------------------------------------------

function isTagStartHere(s: string, i: number): boolean {
  // A bare element selector either starts the selector or follows a
  // combinator/whitespace.
  const ch = s[i];
  if (!/[a-zA-Z]/.test(ch)) return false;
  if (i === 0) return true;
  const prev = s[i - 1];
  return /\s/.test(prev) || prev === ">" || prev === "+" || prev === "~" || prev === ",";
}

function readIdentEnd(s: string, start: number): number {
  let j = start;
  while (j < s.length && /[a-zA-Z0-9_-]/.test(s[j])) j++;
  return j;
}

function skipWhile(s: string, start: number, pred: (c: string) => boolean): number {
  let j = start;
  while (j < s.length && pred(s[j])) j++;
  return j;
}

// Skip strings, e.g. `"abc { def"`. Returns index after closing quote.
function skipString(s: string, start: number): number {
  const quote = s[start];
  let j = start + 1;
  while (j < s.length) {
    if (s[j] === "\\") { j += 2; continue; }
    if (s[j] === quote) return j + 1;
    j++;
  }
  return s.length;
}

function findUnquoted(s: string, start: number, target: string): number {
  let j = start;
  while (j < s.length) {
    const c = s[j];
    if (c === '"' || c === "'") { j = skipString(s, j); continue; }
    if (c === target) return j;
    j++;
  }
  return -1;
}

function findAtRuleEnd(s: string, start: number): number {
  // Returns the index just past the at-rule's terminating ; or }.
  let j = start;
  while (j < s.length) {
    const c = s[j];
    if (c === '"' || c === "'") { j = skipString(s, j); continue; }
    if (c === ";") return j + 1;
    if (c === "{") {
      const close = findMatchingBrace(s, j);
      return close + 1;
    }
    j++;
  }
  return s.length;
}

function findMatchingBrace(s: string, openIdx: number): number {
  let depth = 0;
  let j = openIdx;
  while (j < s.length) {
    const c = s[j];
    if (c === '"' || c === "'") { j = skipString(s, j); continue; }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return j;
    }
    j++;
  }
  return s.length - 1;
}

function splitTopLevel(s: string, sep: string): string[] {
  const out: string[] = [];
  let buf = "";
  let parenDepth = 0;
  let bracketDepth = 0;
  let j = 0;
  while (j < s.length) {
    const c = s[j];
    if (c === '"' || c === "'") {
      const end = skipString(s, j);
      buf += s.slice(j, end);
      j = end;
      continue;
    }
    if (c === "(") parenDepth++;
    else if (c === ")") parenDepth--;
    else if (c === "[") bracketDepth++;
    else if (c === "]") bracketDepth--;
    else if (c === sep && parenDepth === 0 && bracketDepth === 0) {
      out.push(buf);
      buf = "";
      j++;
      continue;
    }
    buf += c;
    j++;
  }
  if (buf) out.push(buf);
  return out;
}
