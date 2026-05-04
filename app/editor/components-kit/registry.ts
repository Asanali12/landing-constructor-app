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

// Team Slides–style swiper: 3 cards visible on desktop with a tall video
// at the top of each card, then name + description underneath. Modeled
// after the Framer template in importMarkup.html (search
// data-framer-name="Team Slides"). The runtime in
// app/host-runtime/component-runtime.ts still shifts the track by one
// slide-width on click and wraps cyclically — same selectors as before
// (data-swiper-track / -slide / -prev / -next).
//
// Per-slide media is a real <video controls> element. Default sources
// point at Big Buck Bunny on Google's public CDN so the slot has
// something to play before the user pastes their own URL. To add /
// remove slides, unlock and copy a data-swiper-slide.
const SWIPER: ComponentDef = {
  id: "swiper",
  label: "Swiper",
  description:
    "Three video cards with prev/next arrows and cyclical wrap. Modeled on Framer's Team Slides.",
  template: `<section data-component="swiper" data-locked="true" style="position: relative; width: 100%; max-width: 1320px; margin: 24px auto; padding: 16px 56px; box-sizing: border-box;">
  <div style="overflow: hidden;">
    <div data-swiper-track style="display: flex; align-items: stretch; gap: 16px; transition: transform 400ms cubic-bezier(.22,.61,.36,1); will-change: transform;">
      <div data-swiper-slide style="flex: 0 0 calc(33.3333% - 11px); display: flex; box-sizing: border-box;">
        <div style="flex: 1; background: white; border-radius: 20px; padding: 20px; box-shadow: 0 6px 28px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04); display: flex; flex-direction: column; gap: 20px; box-sizing: border-box;">
          <div style="aspect-ratio: 4 / 5; border-radius: 14px; overflow: hidden; background: #18181b;">
            <video data-prop-src="slide-1-video" controls preload="metadata" playsinline src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4" style="width: 100%; height: 100%; object-fit: cover; display: block; background: #18181b;"></video>
          </div>
          <div style="display: flex; flex-direction: column; gap: 14px; flex: 1;">
            <h3 data-prop-text="slide-1-title" style="margin: 0; font-size: 22px; font-weight: 600; letter-spacing: -0.02em; color: #18181b; line-height: 1.25;">Business man &ndash; Mike</h3>
            <div style="height: 1px; background: rgba(0,0,0,0.08); border-radius: 1px;"></div>
            <p data-prop-text="slide-1-body" style="margin: 0; color: #555; font-size: 16px; line-height: 1.55;">&ldquo;It&rsquo;s saving me about 10 hours a week and I&rsquo;ve already seen my response rates jump.&rdquo;</p>
          </div>
        </div>
      </div>
      <div data-swiper-slide style="flex: 0 0 calc(33.3333% - 11px); display: flex; box-sizing: border-box;">
        <div style="flex: 1; background: white; border-radius: 20px; padding: 20px; box-shadow: 0 6px 28px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04); display: flex; flex-direction: column; gap: 20px; box-sizing: border-box;">
          <div style="aspect-ratio: 4 / 5; border-radius: 14px; overflow: hidden; background: #18181b;">
            <video data-prop-src="slide-2-video" controls preload="metadata" playsinline src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4" style="width: 100%; height: 100%; object-fit: cover; display: block; background: #18181b;"></video>
          </div>
          <div style="display: flex; flex-direction: column; gap: 14px; flex: 1;">
            <h3 data-prop-text="slide-2-title" style="margin: 0; font-size: 22px; font-weight: 600; letter-spacing: -0.02em; color: #18181b; line-height: 1.25;">Ex-office worker &ndash; Ella</h3>
            <div style="height: 1px; background: rgba(0,0,0,0.08); border-radius: 1px;"></div>
            <p data-prop-text="slide-2-body" style="margin: 0; color: #555; font-size: 16px; line-height: 1.55;">&ldquo;Now I&rsquo;m working for myself, I set my own hours, and I&rsquo;m making more than I did at my desk job.&rdquo;</p>
          </div>
        </div>
      </div>
      <div data-swiper-slide style="flex: 0 0 calc(33.3333% - 11px); display: flex; box-sizing: border-box;">
        <div style="flex: 1; background: white; border-radius: 20px; padding: 20px; box-shadow: 0 6px 28px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04); display: flex; flex-direction: column; gap: 20px; box-sizing: border-box;">
          <div style="aspect-ratio: 4 / 5; border-radius: 14px; overflow: hidden; background: #18181b;">
            <video data-prop-src="slide-3-video" controls preload="metadata" playsinline src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4" style="width: 100%; height: 100%; object-fit: cover; display: block; background: #18181b;"></video>
          </div>
          <div style="display: flex; flex-direction: column; gap: 14px; flex: 1;">
            <h3 data-prop-text="slide-3-title" style="margin: 0; font-size: 22px; font-weight: 600; letter-spacing: -0.02em; color: #18181b; line-height: 1.25;">Ex-uber driver &ndash; Jamie</h3>
            <div style="height: 1px; background: rgba(0,0,0,0.08); border-radius: 1px;"></div>
            <p data-prop-text="slide-3-body" style="margin: 0; color: #555; font-size: 16px; line-height: 1.55;">&ldquo;...for the first time, I&rsquo;m actually excited about what I do.&rdquo;</p>
          </div>
        </div>
      </div>
    </div>
  </div>
  <button data-swiper-prev type="button" aria-label="Previous slide" style="position: absolute; left: 8px; top: 50%; transform: translateY(-50%); width: 40px; height: 40px; border-radius: 50%; background: white; border: 1px solid #e4e4e7; box-shadow: 0 2px 8px rgba(0,0,0,0.08); cursor: pointer; font-size: 20px; line-height: 1; color: #18181b; z-index: 2;">&lsaquo;</button>
  <button data-swiper-next type="button" aria-label="Next slide" style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); width: 40px; height: 40px; border-radius: 50%; background: white; border: 1px solid #e4e4e7; box-shadow: 0 2px 8px rgba(0,0,0,0.08); cursor: pointer; font-size: 20px; line-height: 1; color: #18181b; z-index: 2;">&rsaquo;</button>
</section>`,
  props: [
    // type: "url" with binding "src" override — the prop is a video URL,
    // so the sidebar should label it as such, but the renderer needs to
    // write to <video src=…>, not <a href=…>.
    { name: "slide-1-video", label: "Slide 1 video URL", type: "url", binding: "src" },
    { name: "slide-1-title", label: "Slide 1 name", type: "text" },
    { name: "slide-1-body", label: "Slide 1 description", type: "longText" },
    { name: "slide-2-video", label: "Slide 2 video URL", type: "url", binding: "src" },
    { name: "slide-2-title", label: "Slide 2 name", type: "text" },
    { name: "slide-2-body", label: "Slide 2 description", type: "longText" },
    { name: "slide-3-video", label: "Slide 3 video URL", type: "url", binding: "src" },
    { name: "slide-3-title", label: "Slide 3 name", type: "text" },
    { name: "slide-3-body", label: "Slide 3 description", type: "longText" },
  ],
};

// Standalone <video controls> wrapped in a rounded container. Doesn't
// participate in the swiper's runtime — drop it anywhere you want a
// single autoplay-friendly video player.
const VIDEO: ComponentDef = {
  id: "video",
  label: "Video",
  description: "Single video player with native controls.",
  template: `<div data-component="video" data-locked="true" style="aspect-ratio: 16 / 9; max-width: 720px; width: 100%; margin: 24px auto; border-radius: 16px; overflow: hidden; background: #18181b;">
  <video data-prop-src="src" controls preload="metadata" playsinline src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4" style="width: 100%; height: 100%; object-fit: cover; display: block;"></video>
</div>`,
  props: [
    { name: "src", label: "Video URL", type: "url", binding: "src" },
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
// max-height between 0 and the panel's scrollHeight on click, and
// rotates the [data-accordion-icon] by 180deg via inline transform.
// Visual style: no per-item box — items are separated by 1px dividers,
// with a rounded gray-square holder for the chevron on the right. To
// add items, unlock and copy an existing data-accordion-item.
const ACCORDION: ComponentDef = {
  id: "accordion",
  label: "Accordion",
  description: "Stack of expandable items separated by thin dividers.",
  template: `<div data-component="accordion" data-locked="true" style="display: flex; flex-direction: column; width: 100%; max-width: 800px; margin: 16px auto;">
  <div data-accordion-item style="border-bottom: 1px solid rgba(0,0,0,0.1);">
    <button data-accordion-trigger type="button" style="display: flex; justify-content: space-between; align-items: center; width: 100%; padding: 20px 4px; background: transparent; border: 0; cursor: pointer; font-size: 18px; font-weight: 600; text-align: left; color: #18181b; gap: 16px;">
      <span data-prop-text="item-1-title">What Jobescape is?</span>
      <span data-accordion-icon style="display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; background: #f4f4f5; border-radius: 8px; flex-shrink: 0; transition: transform 220ms ease; font-size: 14px; color: #18181b;">▾</span>
    </button>
    <div data-accordion-panel style="overflow: hidden; max-height: 0; transition: max-height 320ms ease;">
      <div style="padding: 0 4px 20px;">
        <p data-prop-text="item-1-body" style="margin: 0; color: #555; font-size: 15px; line-height: 1.6;">Jobescape is your path to freedom through freelancing and AI. Learn at your own pace, work from anywhere, and gain in-demand skills. Build a career that matches your goals and values. We offer flexibility, growth, and the chance to turn work into true fulfillment.</p>
      </div>
    </div>
  </div>
  <div data-accordion-item style="border-bottom: 1px solid rgba(0,0,0,0.1);">
    <button data-accordion-trigger type="button" style="display: flex; justify-content: space-between; align-items: center; width: 100%; padding: 20px 4px; background: transparent; border: 0; cursor: pointer; font-size: 18px; font-weight: 600; text-align: left; color: #18181b; gap: 16px;">
      <span data-prop-text="item-2-title">How does it work?</span>
      <span data-accordion-icon style="display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; background: #f4f4f5; border-radius: 8px; flex-shrink: 0; transition: transform 220ms ease; font-size: 14px; color: #18181b;">▾</span>
    </button>
    <div data-accordion-panel style="overflow: hidden; max-height: 0; transition: max-height 320ms ease;">
      <div style="padding: 0 4px 20px;">
        <p data-prop-text="item-2-body" style="margin: 0; color: #555; font-size: 15px; line-height: 1.6;">A short quiz tailors the experience to your goals. You learn the AI tools that real freelancers are using, then apply them to live briefs the platform matches you against — earning while you learn.</p>
      </div>
    </div>
  </div>
  <div data-accordion-item style="border-bottom: 1px solid rgba(0,0,0,0.1);">
    <button data-accordion-trigger type="button" style="display: flex; justify-content: space-between; align-items: center; width: 100%; padding: 20px 4px; background: transparent; border: 0; cursor: pointer; font-size: 18px; font-weight: 600; text-align: left; color: #18181b; gap: 16px;">
      <span data-prop-text="item-3-title">Who is it for?</span>
      <span data-accordion-icon style="display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; background: #f4f4f5; border-radius: 8px; flex-shrink: 0; transition: transform 220ms ease; font-size: 14px; color: #18181b;">▾</span>
    </button>
    <div data-accordion-panel style="overflow: hidden; max-height: 0; transition: max-height 320ms ease;">
      <div style="padding: 0 4px 20px;">
        <p data-prop-text="item-3-body" style="margin: 0; color: #555; font-size: 15px; line-height: 1.6;">Anyone trading desk-job hours for something they own. No prior tech background required — the program is designed to take you from "I&rsquo;ve heard of AI" to landing your first paid project.</p>
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
  VIDEO,
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
