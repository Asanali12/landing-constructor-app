// Per-tag list of DOM events the user can bind actions to. Curated rather
// than exhaustive — the goal is "what events does this element actually fire
// in normal use", not the full DOM event surface. Tags not listed get the
// COMMON_EVENTS list.

const COMMON_EVENTS = [
  "click",
  "dblclick",
  "contextmenu",
  "mouseenter",
  "mouseleave",
  "mouseover",
  "mouseout",
  "mousedown",
  "mouseup",
  "mousemove",
  "wheel",
  "pointerdown",
  "pointerup",
  "pointerenter",
  "pointerleave",
  "keydown",
  "keyup",
  "keypress",
  "focus",
  "blur",
  "focusin",
  "focusout",
  "touchstart",
  "touchmove",
  "touchend",
];

const FORM_INPUT_EVENTS = ["input", "change", "invalid", "select"];
const SCROLLABLE_EVENTS = ["scroll"];
const MEDIA_EVENTS = [
  "play",
  "pause",
  "ended",
  "volumechange",
  "timeupdate",
  "loadeddata",
  "loadedmetadata",
  "canplay",
  "canplaythrough",
  "seeking",
  "seeked",
  "ratechange",
  "stalled",
  "waiting",
];

const PER_TAG: Record<string, string[]> = {
  input: [...COMMON_EVENTS, ...FORM_INPUT_EVENTS],
  textarea: [...COMMON_EVENTS, ...FORM_INPUT_EVENTS],
  select: [...COMMON_EVENTS, ...FORM_INPUT_EVENTS],
  form: [...COMMON_EVENTS, "submit", "reset"],
  // Body and large containers can scroll; allow scroll on most layout tags.
  body: [...COMMON_EVENTS, ...SCROLLABLE_EVENTS],
  main: [...COMMON_EVENTS, ...SCROLLABLE_EVENTS],
  div: [...COMMON_EVENTS, ...SCROLLABLE_EVENTS],
  section: [...COMMON_EVENTS, ...SCROLLABLE_EVENTS],
  article: [...COMMON_EVENTS, ...SCROLLABLE_EVENTS],
  aside: [...COMMON_EVENTS, ...SCROLLABLE_EVENTS],
  ul: [...COMMON_EVENTS, ...SCROLLABLE_EVENTS],
  ol: [...COMMON_EVENTS, ...SCROLLABLE_EVENTS],
  pre: [...COMMON_EVENTS, ...SCROLLABLE_EVENTS],
  // Media tags get media events on top of common ones.
  video: [...COMMON_EVENTS, ...MEDIA_EVENTS],
  audio: [...COMMON_EVENTS, ...MEDIA_EVENTS],
  // <img> fires load/error.
  img: [...COMMON_EVENTS, "load", "error"],
  // <a> often used as a click handler — same surface as common.
  a: COMMON_EVENTS,
  button: COMMON_EVENTS,
};

export function eventsForTag(tag: string): string[] {
  return PER_TAG[tag.toLowerCase()] ?? COMMON_EVENTS;
}
