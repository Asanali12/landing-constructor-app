"use client";

// Mounted by /edit/[slug]/page.tsx. On first render, fetches the
// editor_state blob for the slug and applies it to both viewports via
// setDocument. Also writes the saved-pointer so subsequent saves PUT
// to the same slug instead of POSTing a new row.
//
// Lives inside <EditorProvider> so it can call useEditor(). Returns null
// — it's a side-effect-only component.

import { useEffect, useRef, useState } from "react";

import { useEditor } from "../store";
import type { EditorDocument } from "../types";
import { writeSavedPointer } from "../saved-pointer";

type LoadStatus =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "loaded" }
  | { kind: "error"; message: string };

export function AutoLoader({ slug }: { slug: string }) {
  const { setDocument } = useEditor();
  const [status, setStatus] = useState<LoadStatus>({ kind: "loading" });
  // Strict-mode in dev mounts effects twice — guard so we don't fetch +
  // setDocument the saved page on top of itself.
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    const backendUrl = process.env.NEXT_PUBLIC_LC_BACKEND_URL;
    if (!backendUrl) {
      setStatus({
        kind: "error",
        message:
          "NEXT_PUBLIC_LC_BACKEND_URL is not set — copy .env.example to .env.local and restart `npm run dev`.",
      });
      return;
    }

    let cancelled = false;
    (async () => {
      const base = backendUrl.replace(/\/$/, "");
      const safeSlug = encodeURIComponent(slug);
      try {
        const [metaRes, stateRes] = await Promise.all([
          fetch(`${base}/api/lc-pages/${safeSlug}/`, { cache: "no-store" }),
          fetch(`${base}/api/lc-pages/${safeSlug}/state`, {
            cache: "no-store",
          }),
        ]);
        if (metaRes.status === 404) {
          throw new Error(`No saved page with slug "${slug}".`);
        }
        if (!metaRes.ok) {
          throw new Error(
            `Backend returned ${metaRes.status} for metadata: ${metaRes.statusText}`
          );
        }
        if (stateRes.status === 404) {
          throw new Error(
            `Saved page "${slug}" has no editor_state — open it from the editor's Load modal and re-save it once.`
          );
        }
        if (!stateRes.ok) {
          throw new Error(
            `Backend returned ${stateRes.status} for state: ${stateRes.statusText}`
          );
        }
        const meta = (await metaRes.json()) as {
          id: string;
          slug: string;
          title: string;
        };
        const state = (await stateRes.json()) as {
          desktop?: EditorDocument;
          mobile?: EditorDocument;
        };
        if (cancelled) return;
        if (!state.desktop || !state.mobile) {
          throw new Error(
            "Saved editor_state is missing desktop or mobile docs."
          );
        }
        setDocument(state.desktop, "desktop");
        setDocument(state.mobile, "mobile");
        writeSavedPointer({
          id: meta.id,
          slug: meta.slug,
          title: meta.title,
        });
        setStatus({ kind: "loaded" });
      } catch (err) {
        if (cancelled) return;
        setStatus({
          kind: "error",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [slug, setDocument]);

  if (status.kind === "loading") {
    // Top-stripe loader so the canvas isn't covered while we fetch. The
    // canvas already shows an empty / sample doc — the stripe disappears
    // as soon as the load lands.
    return (
      <div className="fixed top-0 left-0 right-0 z-50 h-0.5 bg-blue-500 animate-pulse" />
    );
  }

  if (status.kind === "error") {
    return (
      <div className="fixed top-12 right-4 z-50 max-w-sm p-3 rounded border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 text-xs shadow-lg">
        <div className="font-medium mb-1">
          Couldn&apos;t load <code>{slug}</code>
        </div>
        <div>{status.message}</div>
      </div>
    );
  }

  // status.kind === "idle" | "loaded" — render nothing
  return null;
}
