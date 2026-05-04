import type { ComponentDef } from "./types";
import { findUserComponent } from "./user-registry";

// Curated component templates. Each template:
//   - has exactly one root element with data-component="<id>" and
//     data-locked="true",
//   - carries inline styles so it renders the same regardless of the
//     surrounding page CSS,
//   - tags every editable element with data-prop-text / data-prop-href /
//     data-prop-src / data-prop-alt so the sidebar form can find slots.
//
// Components whose root carries data-component matching one of the
// runtime's selectors (swiper / sidebar / accordion) get behavior wired
// up at render time by app/host-runtime/component-runtime.ts. The
// template only describes structure + appearance; the runtime adds
// click handlers and animation.

const HERO: ComponentDef = {
  id: "hero",
  label: "Hero",
  description: "Heading, subtitle, and a primary call-to-action button.",
  template: `<section data-component="hero" data-locked="true" style="padding: 80px 32px; text-align: center; background: linear-gradient(135deg, #6366f1 0%, #ec4899 100%); color: white; border-radius: 12px;">
  <h1 data-prop-text="title" style="font-size: 40px; font-weight: 700; margin: 0 0 12px; letter-spacing: -0.02em;">Build something delightful</h1>
  <p data-prop-text="subtitle" style="font-size: 18px; opacity: 0.9; margin: 0 0 24px; max-width: 560px; margin-left: auto; margin-right: auto;">A short pitch that hooks the reader in one breath.</p>
  <a data-prop-text="cta-text" data-prop-href="cta-link" href="#start" style="display: inline-block; background: white; color: #6366f1; padding: 12px 24px; border-radius: 999px; text-decoration: none; font-weight: 600;">Get started</a>
</section>`,
  props: [
    { name: "title", label: "Title", type: "text" },
    { name: "subtitle", label: "Subtitle", type: "longText" },
    { name: "cta-text", label: "CTA text", type: "text" },
    { name: "cta-link", label: "CTA link", type: "url" },
  ],
};

const FEATURE_GRID: ComponentDef = {
  id: "feature-grid",
  label: "Feature grid",
  description: "Two columns highlighting key features.",
  template: `<section data-component="feature-grid" data-locked="true" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-top: 24px;">
  <div style="padding: 24px; background: #f4f4f5; border-radius: 12px;">
    <h2 data-prop-text="title-1" style="margin: 0 0 8px; font-size: 18px; font-weight: 600;">Fast</h2>
    <p data-prop-text="body-1" style="margin: 0; color: #52525b; font-size: 14px;">Click an element, change its props.</p>
  </div>
  <div style="padding: 24px; background: #f4f4f5; border-radius: 12px;">
    <h2 data-prop-text="title-2" style="margin: 0 0 8px; font-size: 18px; font-weight: 600;">Lossless</h2>
    <p data-prop-text="body-2" style="margin: 0; color: #52525b; font-size: 14px;">Round-trip your markup through JSON and back.</p>
  </div>
</section>`,
  props: [
    { name: "title-1", label: "Card 1 title", type: "text" },
    { name: "body-1", label: "Card 1 body", type: "longText" },
    { name: "title-2", label: "Card 2 title", type: "text" },
    { name: "body-2", label: "Card 2 body", type: "longText" },
  ],
};

// Carousel-style swiper. Three slides with prev/next arrows; the runtime
// shifts the track by one slide-width on click and wraps cyclically. Slide
// width is fixed (280px) so multiple slides can be visible when the swiper
// is wider than one slide. To add/remove slides, unlock the component.
const SWIPER: ComponentDef = {
  id: "swiper",
  label: "Swiper",
  description: "Horizontal carousel with prev/next arrows and cyclical wrap.",
  template: `<section data-component="swiper" data-locked="true" style="position: relative; overflow: hidden; width: 100%; max-width: 720px; margin: 24px auto; padding: 0 56px; box-sizing: border-box;">
  <div data-swiper-track style="display: flex; gap: 16px; transition: transform 400ms cubic-bezier(.22,.61,.36,1); will-change: transform;">
    <div data-swiper-slide style="flex: 0 0 280px; min-height: 200px; padding: 24px; background: #f4f4f5; border-radius: 12px; box-sizing: border-box; display: flex; flex-direction: column; gap: 8px;">
      <h3 data-prop-text="slide-1-title" style="margin: 0; font-size: 18px; font-weight: 600;">Slide one</h3>
      <p data-prop-text="slide-1-body" style="margin: 0; color: #52525b; font-size: 14px;">Description for the first slide.</p>
    </div>
    <div data-swiper-slide style="flex: 0 0 280px; min-height: 200px; padding: 24px; background: #f4f4f5; border-radius: 12px; box-sizing: border-box; display: flex; flex-direction: column; gap: 8px;">
      <h3 data-prop-text="slide-2-title" style="margin: 0; font-size: 18px; font-weight: 600;">Slide two</h3>
      <p data-prop-text="slide-2-body" style="margin: 0; color: #52525b; font-size: 14px;">Description for the second slide.</p>
    </div>
    <div data-swiper-slide style="flex: 0 0 280px; min-height: 200px; padding: 24px; background: #f4f4f5; border-radius: 12px; box-sizing: border-box; display: flex; flex-direction: column; gap: 8px;">
      <h3 data-prop-text="slide-3-title" style="margin: 0; font-size: 18px; font-weight: 600;">Slide three</h3>
      <p data-prop-text="slide-3-body" style="margin: 0; color: #52525b; font-size: 14px;">Description for the third slide.</p>
    </div>
  </div>
  <button data-swiper-prev type="button" aria-label="Previous slide" style="position: absolute; left: 8px; top: 50%; transform: translateY(-50%); width: 40px; height: 40px; border-radius: 50%; background: white; border: 1px solid #e4e4e7; box-shadow: 0 2px 8px rgba(0,0,0,0.08); cursor: pointer; font-size: 20px; line-height: 1; color: #18181b;">‹</button>
  <button data-swiper-next type="button" aria-label="Next slide" style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); width: 40px; height: 40px; border-radius: 50%; background: white; border: 1px solid #e4e4e7; box-shadow: 0 2px 8px rgba(0,0,0,0.08); cursor: pointer; font-size: 20px; line-height: 1; color: #18181b;">›</button>
</section>`,
  props: [
    { name: "slide-1-title", label: "Slide 1 title", type: "text" },
    { name: "slide-1-body", label: "Slide 1 body", type: "longText" },
    { name: "slide-2-title", label: "Slide 2 title", type: "text" },
    { name: "slide-2-body", label: "Slide 2 body", type: "longText" },
    { name: "slide-3-title", label: "Slide 3 title", type: "text" },
    { name: "slide-3-body", label: "Slide 3 body", type: "longText" },
  ],
};

// Off-canvas sidebar with a built-in trigger button. The panel content
// is intentionally empty by default — the user fills it in by unlocking
// the component or adding children to the panel via the layers tree.
const SIDEBAR: ComponentDef = {
  id: "sidebar",
  label: "Sidebar menu",
  description: "Off-canvas panel that slides in from the right when the trigger is clicked.",
  template: `<div data-component="sidebar" data-locked="true" style="display: inline-block;">
  <button data-sidebar-trigger type="button" style="padding: 10px 16px; background: #18181b; color: white; border: 0; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 500;">
    <span data-prop-text="trigger-text">Open menu</span>
  </button>
  <div data-sidebar-overlay style="position: fixed; inset: 0; background: rgba(0,0,0,0.4); opacity: 0; pointer-events: none; transition: opacity 300ms ease; z-index: 99;"></div>
  <aside data-sidebar-panel style="position: fixed; top: 0; right: 0; width: 320px; max-width: 90vw; height: 100vh; background: white; box-shadow: -4px 0 24px rgba(0,0,0,0.12); transform: translateX(100%); transition: transform 320ms cubic-bezier(.22,.61,.36,1); z-index: 100; padding: 24px; box-sizing: border-box; overflow-y: auto;">
    <button data-sidebar-close type="button" aria-label="Close menu" style="position: absolute; top: 12px; right: 12px; width: 32px; height: 32px; border: 0; background: transparent; cursor: pointer; font-size: 20px; line-height: 1; color: #52525b;">×</button>
    <div data-prop-text="panel-title" style="font-size: 18px; font-weight: 600; margin-bottom: 12px;">Menu</div>
  </aside>
</div>`,
  props: [
    { name: "trigger-text", label: "Trigger button text", type: "text" },
    { name: "panel-title", label: "Panel title", type: "text" },
  ],
};

// Vertical accordion with three items. Runtime animates each item's
// max-height between 0 and the panel's scrollHeight on click. To add
// items, unlock and copy an existing data-accordion-item.
const ACCORDION: ComponentDef = {
  id: "accordion",
  label: "Accordion",
  description: "Stack of expandable items with a smooth open/close transition.",
  template: `<div data-component="accordion" data-locked="true" style="display: flex; flex-direction: column; gap: 8px; width: 100%; max-width: 600px; margin: 16px auto;">
  <div data-accordion-item style="border: 1px solid #e4e4e7; border-radius: 8px; overflow: hidden; background: white;">
    <button data-accordion-trigger type="button" style="display: flex; justify-content: space-between; align-items: center; width: 100%; padding: 16px; background: white; border: 0; cursor: pointer; font-size: 14px; font-weight: 500; text-align: left; color: #18181b;">
      <span data-prop-text="item-1-title">Question one</span>
      <span data-accordion-icon style="display: inline-block; transition: transform 220ms ease; font-size: 12px; color: #71717a;">▼</span>
    </button>
    <div data-accordion-panel style="overflow: hidden; max-height: 0; transition: max-height 320ms ease;">
      <div style="padding: 0 16px 16px;">
        <p data-prop-text="item-1-body" style="margin: 0; color: #52525b; font-size: 14px; line-height: 1.5;">Answer to the first question.</p>
      </div>
    </div>
  </div>
  <div data-accordion-item style="border: 1px solid #e4e4e7; border-radius: 8px; overflow: hidden; background: white;">
    <button data-accordion-trigger type="button" style="display: flex; justify-content: space-between; align-items: center; width: 100%; padding: 16px; background: white; border: 0; cursor: pointer; font-size: 14px; font-weight: 500; text-align: left; color: #18181b;">
      <span data-prop-text="item-2-title">Question two</span>
      <span data-accordion-icon style="display: inline-block; transition: transform 220ms ease; font-size: 12px; color: #71717a;">▼</span>
    </button>
    <div data-accordion-panel style="overflow: hidden; max-height: 0; transition: max-height 320ms ease;">
      <div style="padding: 0 16px 16px;">
        <p data-prop-text="item-2-body" style="margin: 0; color: #52525b; font-size: 14px; line-height: 1.5;">Answer to the second question.</p>
      </div>
    </div>
  </div>
  <div data-accordion-item style="border: 1px solid #e4e4e7; border-radius: 8px; overflow: hidden; background: white;">
    <button data-accordion-trigger type="button" style="display: flex; justify-content: space-between; align-items: center; width: 100%; padding: 16px; background: white; border: 0; cursor: pointer; font-size: 14px; font-weight: 500; text-align: left; color: #18181b;">
      <span data-prop-text="item-3-title">Question three</span>
      <span data-accordion-icon style="display: inline-block; transition: transform 220ms ease; font-size: 12px; color: #71717a;">▼</span>
    </button>
    <div data-accordion-panel style="overflow: hidden; max-height: 0; transition: max-height 320ms ease;">
      <div style="padding: 0 16px 16px;">
        <p data-prop-text="item-3-body" style="margin: 0; color: #52525b; font-size: 14px; line-height: 1.5;">Answer to the third question.</p>
      </div>
    </div>
  </div>
</div>`,
  props: [
    { name: "item-1-title", label: "Item 1 title", type: "text" },
    { name: "item-1-body", label: "Item 1 body", type: "longText" },
    { name: "item-2-title", label: "Item 2 title", type: "text" },
    { name: "item-2-body", label: "Item 2 body", type: "longText" },
    { name: "item-3-title", label: "Item 3 title", type: "text" },
    { name: "item-3-body", label: "Item 3 body", type: "longText" },
  ],
};

// Blue stat-card matching the screenshot: oversized number, tight title,
// small body. No interactivity.
const BLUE_CARD: ComponentDef = {
  id: "blue-card",
  label: "Blue stat card",
  description: "Bright blue card with a large stat, title, and supporting copy.",
  template: `<div data-component="blue-card" data-locked="true" style="background: #2563eb; color: white; padding: 32px; border-radius: 20px; max-width: 360px; display: flex; flex-direction: column; gap: 16px; box-sizing: border-box;">
  <div data-prop-text="stat" style="font-size: 72px; font-weight: 800; line-height: 1; letter-spacing: -0.03em;">30+</div>
  <div style="display: flex; flex-direction: column; gap: 4px;">
    <div data-prop-text="title" style="font-weight: 600; font-size: 14px;">AI tools at your fingertips</div>
    <p data-prop-text="body" style="margin: 0; font-size: 14px; line-height: 1.5; opacity: 0.9;">Speed up your work and handle 80% of the routine with top tools and GPT-powered bots.</p>
  </div>
</div>`,
  props: [
    { name: "stat", label: "Stat", type: "text", hint: "e.g. 30+, 250k, 99%" },
    { name: "title", label: "Title", type: "text" },
    { name: "body", label: "Body", type: "longText" },
  ],
};

// Tilted pill badge matching the screenshot. Rotation is baked in as
// `transform: rotate(-3deg)`; to change it, unlock the component and edit
// the inline `transform` style on the root <span>.
const BADGE: ComponentDef = {
  id: "badge",
  label: "Tilted badge",
  description: "Black pill badge with an emoji, label, and a slight tilt.",
  template: `<span data-component="badge" data-locked="true" style="display: inline-flex; align-items: center; gap: 8px; padding: 10px 18px; background: #18181b; color: white; border-radius: 999px; font-size: 16px; font-weight: 600; transform: rotate(-3deg); transform-origin: center; box-shadow: 0 6px 20px rgba(0,0,0,0.15);">
  <span data-prop-text="emoji" style="font-size: 18px;">🚀</span>
  <span data-prop-text="label">AI Automations</span>
</span>`,
  props: [
    { name: "emoji", label: "Emoji", type: "text", hint: "Single emoji or icon glyph." },
    { name: "label", label: "Label", type: "text" },
  ],
};

export const COMPONENT_REGISTRY: ComponentDef[] = [
  HERO,
  FEATURE_GRID,
  SWIPER,
  SIDEBAR,
  ACCORDION,
  BLUE_CARD,
  BADGE,
];

export function findComponentDef(id: string): ComponentDef | undefined {
  // Built-ins first so a user can't shadow a built-in id by accident.
  // user-registry only resolves on the client (returns [] under SSR).
  const builtin = COMPONENT_REGISTRY.find((c) => c.id === id);
  if (builtin) return builtin;
  return findUserComponent(id);
}
