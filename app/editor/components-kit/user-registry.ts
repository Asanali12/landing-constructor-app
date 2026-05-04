// localStorage-backed registry for user-authored components.
//
// Same shape as the built-in COMPONENT_REGISTRY (ComponentDef), but
// editable from the UI and persisted per browser. Components created
// here flow through the same insertion / prop-editing path as built-ins
// because findComponentDef() falls through to this registry when an id
// isn't in the static list.
//
// Change notifications are dispatched as a custom window event so the
// palette can re-render after a create / update / delete without
// plumbing prop drilling through every render path.

import type { ComponentDef } from "./types";

export const STORAGE_KEY = "lc-user-components-v1";
export const CHANGE_EVENT = "lc-user-components-changed";

export function loadUserComponents(): ComponentDef[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isComponentDef);
  } catch {
    return [];
  }
}

export function saveUserComponents(defs: ComponentDef[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(defs));
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  } catch {
    // private mode / quota — failures are silent; the in-memory state
    // still works for the current session.
  }
}

export function addUserComponent(def: ComponentDef): void {
  const list = loadUserComponents();
  list.push(def);
  saveUserComponents(list);
}

export function updateUserComponent(id: string, def: ComponentDef): void {
  const list = loadUserComponents();
  const index = list.findIndex((d) => d.id === id);
  if (index === -1) {
    list.push(def);
  } else {
    list[index] = def;
  }
  saveUserComponents(list);
}

export function deleteUserComponent(id: string): void {
  const list = loadUserComponents();
  saveUserComponents(list.filter((d) => d.id !== id));
}

export function findUserComponent(id: string): ComponentDef | undefined {
  return loadUserComponents().find((d) => d.id === id);
}

// Slug a label and append a numeric suffix until it doesn't collide with
// any existing builtin or user component id. Pure — caller decides where
// to look for collisions.
export function uniqueIdFor(label: string, taken: (id: string) => boolean): string {
  const base = slug(label) || "component";
  if (!taken(base)) return base;
  for (let i = 2; i < 1000; i += 1) {
    const candidate = `${base}-${i}`;
    if (!taken(candidate)) return candidate;
  }
  // Fallback — extremely unlikely. Use a timestamp suffix.
  return `${base}-${Date.now()}`;
}

function slug(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isComponentDef(value: unknown): value is ComponentDef {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.label === "string" &&
    typeof v.description === "string" &&
    typeof v.template === "string" &&
    Array.isArray(v.props)
  );
}
