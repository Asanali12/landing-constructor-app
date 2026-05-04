// localStorage-tracked pointer to the saved page currently in the editor.
//
// Read/written by:
//   - SaveModal — on first save, writes; subsequent saves PUT to the
//     stored slug rather than POSTing a new row.
//   - LoadModal — when the user picks a saved page, writes so the next
//     save updates that page in place.
//   - AutoLoader — when the editor opens at /edit/<slug>, writes after a
//     successful fetch so SaveModal also updates in place.
//
// Bumping the version suffix invalidates everyone's pointer at once —
// only do that if the storage shape ever changes.

export const SAVED_PAGE_KEY = "lc-saved-page-v1";

export type SavedPagePointer = {
  id: string;
  slug: string;
  title: string;
};

export function readSavedPointer(): SavedPagePointer | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SAVED_PAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof parsed.slug === "string" &&
      typeof parsed.id === "string"
    ) {
      return parsed as SavedPagePointer;
    }
  } catch {
    // corrupted or unavailable — fall through to null
  }
  return null;
}

export function writeSavedPointer(pointer: SavedPagePointer | null): void {
  if (typeof window === "undefined") return;
  try {
    if (pointer) {
      window.localStorage.setItem(SAVED_PAGE_KEY, JSON.stringify(pointer));
    } else {
      window.localStorage.removeItem(SAVED_PAGE_KEY);
    }
  } catch {
    // private mode / quota — saving in-memory still works for this session
  }
}
