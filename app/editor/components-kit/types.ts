// Component-kit types. A "component" here is a curated chunk of HTML with
// labelled prop slots — marketing users insert one from the palette, fill
// in fields like "Title" / "CTA link" in the right sidebar, and the slot
// elements get their text or attribute updated.
//
// Slots are bound via attributes on the descendant elements:
//   data-prop-text="<name>" → write to the element's inner text
//   data-prop-href="<name>" → write to the element's href attribute
//   data-prop-src="<name>"  → write to the element's src attribute
//   data-prop-alt="<name>"  → write to the element's alt attribute
//
// Each PropSchema declares which binding to use (defaulted from `type`).
// One DOM element can host multiple bindings — a single <a> can be both
// a "cta-text" text slot and a "cta-link" href slot at the same time.

export type PropType = "text" | "longText" | "url" | "image";

export type Binding = "text" | "href" | "src" | "alt";

export type PropSchema = {
  // Identifier — must match data-prop-<binding>="<name>" inside the template.
  name: string;
  // Human-readable label shown in the sidebar form.
  label: string;
  type: PropType;
  // Override the binding implied by `type`. Defaults: text/longText → "text",
  // url → "href", image → "src".
  binding?: Binding;
  default?: string;
  // Optional helper hint shown under the input.
  hint?: string;
};

export type ComponentDef = {
  // Stable id stored in `data-component="<id>"` on the root element.
  id: string;
  label: string;
  description: string;
  // HTML for the component, with one root element carrying
  // `data-component="<id>"` and `data-locked="true"`. Default values for
  // props should already be baked in (the schema's `default` is mostly for
  // documentation / placeholder).
  template: string;
  props: PropSchema[];
};

// Resolve which DOM attribute a prop writes to.
export function bindingFor(prop: PropSchema): Binding {
  if (prop.binding) return prop.binding;
  switch (prop.type) {
    case "text":
    case "longText":
      return "text";
    case "url":
      return "href";
    case "image":
      return "src";
  }
}
