import { createElement, type CSSProperties, type ReactNode } from "react";
import { BOOLEAN_ATTRS, RAW_TEXT_TAGS, REACT_ATTR_MAP, VOID_ELEMENTS } from "./constants";
import type { EditorNode } from "./types";

type ImportantDecl = { name: string; value: string };

type ParsedStyle = {
  // Properties to feed React's style prop. Custom properties (--*) keep their
  // original kebab-case names; React passes those through to the DOM verbatim.
  // Standard properties are camelCased so React can apply them.
  object: CSSProperties;
  // !important declarations can't ride React's style prop (React doesn't
  // emit !important). They're applied later via a ref callback.
  important: ImportantDecl[];
};

function parseStyleString(style: string): ParsedStyle {
  const obj: Record<string, string> = {};
  const important: ImportantDecl[] = [];
  for (const decl of style.split(";")) {
    const idx = decl.indexOf(":");
    if (idx < 0) continue;
    const prop = decl.slice(0, idx).trim();
    let value = decl.slice(idx + 1).trim();
    if (!prop || !value) continue;

    // Strip !important and remember it for ref-time application.
    const importantMatch = /\s*!important\s*$/i.exec(value);
    const isImportant = importantMatch !== null;
    if (isImportant) value = value.slice(0, importantMatch.index).trimEnd();
    if (!value) continue;

    if (isImportant) {
      important.push({ name: prop, value });
      continue;
    }

    if (prop.startsWith("--")) {
      // CSS custom properties — preserve verbatim. React supports `--var`
      // keys directly on the style object.
      obj[prop] = value;
      continue;
    }

    const camel = prop.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
    obj[camel] = value;
  }
  return { object: obj as CSSProperties, important };
}

function attrsToProps(
  attributes: Record<string, string>
): { props: Record<string, unknown>; important: ImportantDecl[] } {
  const props: Record<string, unknown> = {};
  let important: ImportantDecl[] = [];
  for (const [rawKey, value] of Object.entries(attributes)) {
    const key = rawKey.toLowerCase();
    if (key === "style") {
      const parsed = parseStyleString(value);
      props.style = parsed.object;
      important = parsed.important;
      continue;
    }
    const reactKey = REACT_ATTR_MAP[key] ?? key;
    if (BOOLEAN_ATTRS.has(key)) {
      props[reactKey] = value !== "false";
    } else {
      props[reactKey] = value;
    }
  }
  return { props, important };
}

function makeImportantRef(important: ImportantDecl[]) {
  if (important.length === 0) return undefined;
  return (el: HTMLElement | null) => {
    if (!el) return;
    for (const { name, value } of important) {
      el.style.setProperty(name, value, "important");
    }
  };
}

export type RenderHandlers = {
  onSelect: (id: string, e: React.MouseEvent) => void;
  selectedId: string | null;
  // Map from lowercase tag name to a class to append to every element of
  // that tag, used by the preview's render-time CSS scoping. Optional.
  tagClasses?: Record<string, string>;
};

export function renderNode(
  node: EditorNode,
  handlers: RenderHandlers
): ReactNode {
  if (node.kind === "text") {
    return node.text;
  }

  // Render <style> via dangerouslySetInnerHTML so React doesn't escape CSS
  // characters like ">" in selectors. Skip selection wiring — style tags
  // don't have a render box. The preview iframe loads these styles natively.
  if (RAW_TEXT_TAGS.has(node.tag)) {
    const { props: rawProps } = attrsToProps(node.attributes);
    const text = node.children
      .map((c) => (c.kind === "text" ? c.text : ""))
      .join("");
    return createElement(node.tag, {
      ...rawProps,
      key: node.id,
      "data-edit-id": node.id,
      dangerouslySetInnerHTML: { __html: text },
    });
  }

  const { props, important } = attrsToProps(node.attributes);

  // Mark for selection / highlight.
  props["data-edit-id"] = node.id;
  const baseClass =
    typeof props.className === "string" ? props.className : "";
  const isSelected = handlers.selectedId === node.id;
  const scopeClass = handlers.tagClasses?.[node.tag] ?? "";
  // Selection marker class only — do not inject __lc-node. The chrome's CSS
  // targets [data-edit-id] for hover/transition affordances, so the data
  // attribute alone is enough. Touching `class` would interfere with user CSS
  // that uses [class="..."] exact-match selectors.
  const cls = [baseClass, scopeClass, isSelected ? "__lc-selected" : ""]
    .filter(Boolean)
    .join(" ");
  if (cls) props.className = cls;
  else delete props.className;

  const importantRef = makeImportantRef(important);
  if (importantRef) props.ref = importantRef;

  // Block forms / nav from causing real navigation inside the preview.
  props.onClick = (e: React.MouseEvent) => {
    if (
      node.tag === "a" ||
      node.tag === "button" ||
      node.tag === "form"
    ) {
      e.preventDefault();
    }
    e.stopPropagation();
    handlers.onSelect(node.id, e);
  };

  if (node.tag === "a") {
    // Disable real navigation while editing.
    delete props.target;
  }
  if (node.tag === "form") {
    props.onSubmit = (e: React.FormEvent) => e.preventDefault();
  }

  props.key = node.id;

  if (VOID_ELEMENTS.has(node.tag)) {
    return createElement(node.tag, props);
  }

  // textarea: React requires defaultValue, not children, for uncontrolled use
  if (node.tag === "textarea") {
    const text = node.children
      .filter((c) => c.kind === "text")
      .map((c) => (c.kind === "text" ? c.text : ""))
      .join("");
    return createElement(node.tag, { ...props, defaultValue: text });
  }

  const children = node.children.map((c) => renderNode(c, handlers));
  return createElement(node.tag, props, ...children);
}
