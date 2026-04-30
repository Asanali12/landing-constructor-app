// Viewport width (inclusive) at or below which the merged export switches to
// the mobile layout, and the editor switches the active doc to "mobile". Kept
// as a single constant so merge.ts and the editor agree on where the line is.
export const MOBILE_BREAKPOINT_PX = 768;

// Default canvas widths used when the user clicks the Desktop/Mobile pill —
// snaps the preview to a representative size for that side of the breakpoint.
export const DEFAULT_DESKTOP_WIDTH_PX = 1280;
export const DEFAULT_MOBILE_WIDTH_PX = 390;

export const VOID_ELEMENTS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

export const STRIPPED_TAGS = new Set([
  "script",
  "noscript",
  "iframe",
  "object",
  "embed",
]);

// Tags whose text content is raw (not HTML) and must not be HTML-escaped
// during serialization, nor mounted as React children (use innerHTML instead).
export const RAW_TEXT_TAGS = new Set(["style"]);

export const REACT_ATTR_MAP: Record<string, string> = {
  class: "className",
  for: "htmlFor",
  tabindex: "tabIndex",
  readonly: "readOnly",
  maxlength: "maxLength",
  minlength: "minLength",
  cellpadding: "cellPadding",
  cellspacing: "cellSpacing",
  colspan: "colSpan",
  rowspan: "rowSpan",
  usemap: "useMap",
  frameborder: "frameBorder",
  contenteditable: "contentEditable",
  crossorigin: "crossOrigin",
  datetime: "dateTime",
  enctype: "encType",
  formaction: "formAction",
  formenctype: "formEncType",
  formmethod: "formMethod",
  formnovalidate: "formNoValidate",
  formtarget: "formTarget",
  hreflang: "hrefLang",
  marginheight: "marginHeight",
  marginwidth: "marginWidth",
  novalidate: "noValidate",
  spellcheck: "spellCheck",
  srcdoc: "srcDoc",
  srclang: "srcLang",
  srcset: "srcSet",
  autoplay: "autoPlay",
  autofocus: "autoFocus",
  autocomplete: "autoComplete",
  acceptcharset: "acceptCharset",
  classid: "classID",
  itemid: "itemID",
  itemprop: "itemProp",
  itemref: "itemRef",
  itemscope: "itemScope",
  itemtype: "itemType",
};

export const BOOLEAN_ATTRS = new Set([
  "checked",
  "disabled",
  "readonly",
  "required",
  "autofocus",
  "autoplay",
  "controls",
  "default",
  "defer",
  "hidden",
  "loop",
  "multiple",
  "muted",
  "novalidate",
  "open",
  "selected",
  "reversed",
  "ismap",
  "nomodule",
  "playsinline",
]);

export type PaletteItem = {
  label: string;
  tag: string;
  defaultAttributes?: Record<string, string>;
  defaultText?: string;
  category: string;
};

export const PALETTE: PaletteItem[] = [
  { label: "Section", tag: "section", category: "Layout" },
  { label: "Container (div)", tag: "div", category: "Layout" },
  { label: "Header", tag: "header", category: "Layout" },
  { label: "Footer", tag: "footer", category: "Layout" },
  { label: "Main", tag: "main", category: "Layout" },
  { label: "Article", tag: "article", category: "Layout" },
  { label: "Nav", tag: "nav", category: "Layout" },
  { label: "Aside", tag: "aside", category: "Layout" },

  { label: "Heading 1", tag: "h1", defaultText: "Heading 1", category: "Text" },
  { label: "Heading 2", tag: "h2", defaultText: "Heading 2", category: "Text" },
  { label: "Heading 3", tag: "h3", defaultText: "Heading 3", category: "Text" },
  { label: "Paragraph", tag: "p", defaultText: "Lorem ipsum dolor sit amet.", category: "Text" },
  { label: "Span", tag: "span", defaultText: "text", category: "Text" },
  { label: "Strong", tag: "strong", defaultText: "bold", category: "Text" },
  { label: "Em", tag: "em", defaultText: "emphasis", category: "Text" },
  { label: "Blockquote", tag: "blockquote", defaultText: "Quote", category: "Text" },

  {
    label: "Link",
    tag: "a",
    defaultAttributes: { href: "#" },
    defaultText: "Link",
    category: "Interactive",
  },
  { label: "Button", tag: "button", defaultText: "Button", category: "Interactive" },
  {
    label: "Input",
    tag: "input",
    defaultAttributes: { type: "text", placeholder: "Type here" },
    category: "Interactive",
  },
  {
    label: "Textarea",
    tag: "textarea",
    defaultAttributes: { rows: "4" },
    defaultText: "",
    category: "Interactive",
  },
  { label: "Label", tag: "label", defaultText: "Label", category: "Interactive" },

  {
    label: "Image",
    tag: "img",
    defaultAttributes: {
      src: "https://placehold.co/400x200",
      alt: "image",
    },
    category: "Media",
  },
  { label: "Figure", tag: "figure", category: "Media" },
  { label: "Figcaption", tag: "figcaption", defaultText: "Caption", category: "Media" },

  { label: "Unordered list", tag: "ul", category: "Lists" },
  { label: "Ordered list", tag: "ol", category: "Lists" },
  { label: "List item", tag: "li", defaultText: "Item", category: "Lists" },

  {
    label: "Style block",
    tag: "style",
    defaultText: "/* CSS rules here */\n",
    category: "Code",
  },
  {
    label: "Stylesheet link",
    tag: "link",
    defaultAttributes: { rel: "stylesheet", href: "" },
    category: "Code",
  },
];

export const PALETTE_CATEGORIES = Array.from(new Set(PALETTE.map((p) => p.category)));
