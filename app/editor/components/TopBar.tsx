"use client";

import { useEffect, useState } from "react";
import { useEditor, type Viewport } from "../store";
import type { EditorDocument } from "../types";
import {
  DEFAULT_DESKTOP_WIDTH_PX,
  DEFAULT_MOBILE_WIDTH_PX,
} from "../constants";
import { serializeDocument } from "../serialize";
import { serializeMerged } from "../merge";
import {
  annotateAndCollect,
  serializeEventsScript,
  type EventConfig,
} from "../events-runtime";
import { serializeComponentRuntimeScript } from "../../host-runtime/component-runtime";
import { EventPresetsModal } from "./EventPresetsModal";
import { SNAPSHOT_BOOKMARKLET, SNAPSHOT_SCRIPT } from "../snapshot-script";
import { parseHtml } from "../parse";
import { optimizeDocument, type OptimizationStats } from "../optimize";
const SAMPLE_HTML = `<style>
  .hero {
    padding: 64px 32px;
    background: linear-gradient(135deg, #6366f1 0%, #ec4899 100%);
    color: white;
    border-radius: 12px;
    text-align: center;
  }
  .hero h1 {
    font-size: 40px;
    font-weight: 700;
    margin: 0 0 12px;
    letter-spacing: -0.02em;
  }
  .hero p {
    font-size: 18px;
    opacity: 0.9;
    margin: 0 0 24px;
  }
  .cta {
    display: inline-block;
    background: white;
    color: #6366f1;
    padding: 12px 24px;
    border-radius: 999px;
    text-decoration: none;
    font-weight: 600;
  }
  .features {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
    margin-top: 24px;
  }
  .feature {
    padding: 24px;
    background: #f4f4f5;
    border-radius: 12px;
  }
  .feature h2 {
    margin: 0 0 8px;
    font-size: 18px;
    font-weight: 600;
  }
  .feature p {
    margin: 0;
    color: #52525b;
    font-size: 14px;
  }
</style>
<header class="hero">
  <h1>Build something delightful</h1>
  <p>Drop HTML in, edit visually, ship a landing page in minutes.</p>
  <a class="cta" href="#start">Get started</a>
</header>
<section class="features">
  <div class="feature">
    <h2>Fast</h2>
    <p>Click an element, change its props.</p>
  </div>
  <div class="feature">
    <h2>Lossless</h2>
    <p>Round-trip your markup through JSON and back.</p>
  </div>
</section>`;

export function TopBar() {
  const { state, loadHtml, setDocument, setViewportWidth } = useEditor();
  const [importOpen, setImportOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [loadOpen, setLoadOpen] = useState(false);
  const [presetsOpen, setPresetsOpen] = useState(false);

  const desktopCount = state.docs.desktop.children.length;
  const mobileCount = state.docs.mobile.children.length;

  // Clicking the pill snaps the canvas width to a representative size for that
  // side of the breakpoint — which in turn (via the reducer) flips the active
  // doc. Already-on-that-side clicks no-op so the user's chosen width sticks.
  const onPillChange = (v: Viewport) => {
    if (state.activeViewport === v) return;
    setViewportWidth(
      v === "desktop" ? DEFAULT_DESKTOP_WIDTH_PX : DEFAULT_MOBILE_WIDTH_PX
    );
  };

  return (
    <header className="flex items-center justify-between gap-3 px-4 h-12 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
      <div className="flex items-center gap-3">
        <div className="font-semibold text-sm">Landing Constructor</div>
        <ViewportPill
          active={state.activeViewport}
          desktopCount={desktopCount}
          mobileCount={mobileCount}
          onChange={onPillChange}
        />
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => loadHtml(SAMPLE_HTML)}
          className={btnSecondary}
        >
          Load sample
        </button>
        <button
          type="button"
          onClick={() => setImportOpen(true)}
          className={btnSecondary}
        >
          Import HTML
        </button>
        <button
          type="button"
          onClick={() => setExportOpen(true)}
          className={btnSecondary}
        >
          Export HTML
        </button>
        <button
          type="button"
          onClick={() => setLoadOpen(true)}
          className={btnSecondary}
          title="Reopen a previously saved page from the backend"
        >
          Load
        </button>
        <button
          type="button"
          onClick={() => setSaveOpen(true)}
          className={btnPrimary}
          title="Save to lc-backend so the funnel can render this page"
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => setPresetsOpen(true)}
          className={btnSecondary}
          title="Manage reusable event presets"
        >
          Presets
        </button>
      </div>

      {importOpen && (
        <ImportModal
          activeViewport={state.activeViewport}
          onClose={() => setImportOpen(false)}
          onImport={(doc, viewport) => setDocument(doc, viewport)}
        />
      )}
      {exportOpen && (
        <ExportModal
          activeHtml={buildActiveHtml(state.doc)}
          mergedHtml={serializeMerged(state.docs.desktop, state.docs.mobile)}
          activeViewport={state.activeViewport}
          onClose={() => setExportOpen(false)}
        />
      )}
      {saveOpen && (
        <SaveModal
          desktopDoc={state.docs.desktop}
          mobileDoc={state.docs.mobile}
          onClose={() => setSaveOpen(false)}
        />
      )}
      {loadOpen && (
        <LoadModal
          onClose={() => setLoadOpen(false)}
          onLoaded={(desktop, mobile) => {
            setDocument(desktop, "desktop");
            setDocument(mobile, "mobile");
          }}
        />
      )}
      {presetsOpen && (
        <EventPresetsModal
          onClose={() => setPresetsOpen(false)}
          onChange={() => {}}
        />
      )}
    </header>
  );
}

// Active-viewport export. Annotates elements that own bindings with
// data-lc-events="<id>", serializes the doc, and appends the runtime script.
function buildActiveHtml(doc: EditorDocument): string {
  const { nodes, configs } = annotateAndCollect(doc.children);
  const html = serializeDocument({ ...doc, children: nodes }, { pretty: true });
  const eventsScript = serializeEventsScript(configs);
  const componentScript = serializeComponentRuntimeScript();
  const tail = [eventsScript, componentScript].filter(Boolean).join("\n");
  return tail ? html + "\n" + tail + "\n" : html;
}

function ViewportPill({
  active,
  desktopCount,
  mobileCount,
  onChange,
}: {
  active: Viewport;
  desktopCount: number;
  mobileCount: number;
  onChange: (v: Viewport) => void;
}) {
  return (
    <div className="flex items-center text-xs rounded border border-zinc-200 dark:border-zinc-800 overflow-hidden">
      <button
        type="button"
        onClick={() => onChange("desktop")}
        className={`px-2.5 h-7 ${
          active === "desktop"
            ? "bg-blue-600 text-white"
            : "hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-600 dark:text-zinc-300"
        }`}
        title="Edit desktop layout"
      >
        Desktop <span className="opacity-60">({desktopCount})</span>
      </button>
      <button
        type="button"
        onClick={() => onChange("mobile")}
        className={`px-2.5 h-7 border-l border-zinc-200 dark:border-zinc-800 ${
          active === "mobile"
            ? "bg-blue-600 text-white"
            : "hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-600 dark:text-zinc-300"
        }`}
        title="Edit mobile layout"
      >
        Mobile <span className="opacity-60">({mobileCount})</span>
      </button>
    </div>
  );
}

function ImportModal({
  activeViewport,
  onClose,
  onImport,
}: {
  activeViewport: Viewport;
  onClose: () => void;
  onImport: (doc: EditorDocument, viewport: Viewport) => void;
}) {
  const [text, setText] = useState("");
  const [target, setTarget] = useState<Viewport>(activeViewport);
  const [snapshotOpen, setSnapshotOpen] = useState(false);
  // After successful import we swap the modal body to a stats view so the
  // user can see how much the safe-pass optimizer trimmed.
  const [result, setResult] = useState<
    { stats: OptimizationStats; viewport: Viewport } | null
  >(null);

  const runImport = () => {
    const parsed = parseHtml(text);
    const { doc, stats } = optimizeDocument(parsed);
    onImport(doc, target);
    setResult({ stats, viewport: target });
  };

  if (result) {
    return (
      <Modal onClose={onClose} title="Imported & optimized">
        <ImportStats stats={result.stats} viewport={result.viewport} />
        <div className="flex justify-end gap-2 mt-4">
          <button type="button" className={btnPrimary} onClick={onClose}>
            Close
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal onClose={onClose} title="Import HTML">
      <div className="flex items-center gap-2 mb-3 text-xs">
        <span className="text-zinc-500">Import as:</span>
        <label className="flex items-center gap-1 cursor-pointer">
          <input
            type="radio"
            name="lc-import-target"
            checked={target === "desktop"}
            onChange={() => setTarget("desktop")}
          />
          <span>Desktop</span>
        </label>
        <label className="flex items-center gap-1 cursor-pointer">
          <input
            type="radio"
            name="lc-import-target"
            checked={target === "mobile"}
            onChange={() => setTarget("mobile")}
          />
          <span>Mobile</span>
        </label>
      </div>
      <p className="text-xs text-zinc-500 mb-2">
        Paste any HTML below. Scripts, inline event handlers, and{" "}
        <code>javascript:</code> URLs are stripped. The selected viewport&apos;s
        document is replaced. A safe optimizer pass also runs on import —
        you&apos;ll see the savings after.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        autoFocus
        placeholder="<h1>Hello</h1>"
        className="w-full h-64 p-2 font-mono text-xs rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 focus:outline-none focus:border-blue-400"
      />

      <div className="mt-3">
        <button
          type="button"
          onClick={() => setSnapshotOpen((s) => !s)}
          className="text-xs text-blue-600 hover:underline"
        >
          {snapshotOpen ? "▾" : "▸"} Importing from a live page (Framer,
          scroll-animated, JS-rendered)?
        </button>
        {snapshotOpen && <SnapshotInstructions />}
      </div>

      <div className="flex justify-end gap-2 mt-3">
        <button type="button" className={btnSecondary} onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className={btnPrimary}
          disabled={!text.trim()}
          onClick={runImport}
        >
          Import into {target}
        </button>
      </div>
    </Modal>
  );
}

function ImportStats({
  stats,
  viewport,
}: {
  stats: OptimizationStats;
  viewport: Viewport;
}) {
  const linesSaved = stats.beforeLines - stats.afterLines;
  const charsSaved = stats.beforeChars - stats.afterChars;
  const linesPct = stats.beforeLines
    ? Math.round((linesSaved / stats.beforeLines) * 100)
    : 0;
  const charsPct = stats.beforeChars
    ? Math.round((charsSaved / stats.beforeChars) * 100)
    : 0;
  const fmt = (n: number) => n.toLocaleString();
  return (
    <div className="text-xs space-y-3">
      <p className="text-zinc-600 dark:text-zinc-300">
        Imported into <strong>{viewport}</strong>.
      </p>
      <div className="grid grid-cols-[auto_1fr_auto] gap-x-3 gap-y-1 font-mono text-[11px] items-baseline">
        <div className="text-zinc-500">Lines</div>
        <div className="text-right tabular-nums">
          {fmt(stats.beforeLines)} → {fmt(stats.afterLines)}
        </div>
        <div
          className={`text-right tabular-nums ${
            linesSaved > 0 ? "text-green-600" : "text-zinc-500"
          }`}
        >
          {linesSaved > 0 ? `−${fmt(linesSaved)} (${linesPct}%)` : "no change"}
        </div>

        <div className="text-zinc-500">Characters</div>
        <div className="text-right tabular-nums">
          {fmt(stats.beforeChars)} → {fmt(stats.afterChars)}
        </div>
        <div
          className={`text-right tabular-nums ${
            charsSaved > 0 ? "text-green-600" : "text-zinc-500"
          }`}
        >
          {charsSaved > 0 ? `−${fmt(charsSaved)} (${charsPct}%)` : "no change"}
        </div>
      </div>
      <ul className="text-[11px] text-zinc-600 dark:text-zinc-400 space-y-0.5 list-disc list-inside">
        <li>
          {fmt(stats.duplicateStyleBlocksRemoved)} duplicate{" "}
          <code>&lt;style&gt;</code> block
          {stats.duplicateStyleBlocksRemoved === 1 ? "" : "s"} removed
        </li>
        <li>
          {fmt(stats.attrsStripped)} framework attribute
          {stats.attrsStripped === 1 ? "" : "s"} stripped
        </li>
        <li>
          {fmt(stats.emptyElementsRemoved)} empty element
          {stats.emptyElementsRemoved === 1 ? "" : "s"} removed
        </li>
      </ul>
    </div>
  );
}

function SnapshotInstructions() {
  const [copied, setCopied] = useState(false);

  const onCopyScript = async () => {
    try {
      await navigator.clipboard.writeText(SNAPSHOT_SCRIPT);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard may be blocked */
    }
  };

  return (
    <div className="mt-2 p-3 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs space-y-2">
      <p className="text-zinc-600 dark:text-zinc-400">
        Source pages can mutate the DOM and inject CSS via JavaScript after
        load — copying outerHTML before that captures the wrong state. Run our
        snapshot tool on the source page to grab the post-hydration DOM plus
        every readable stylesheet.
      </p>
      <ol className="list-decimal pl-4 space-y-1 text-zinc-600 dark:text-zinc-400">
        <li>Open the source page in a new tab.</li>
        <li>
          Either drag the bookmarklet below to your bookmarks bar and click it
          while on the source page, or open DevTools (F12) → Console, paste
          the script, and press Enter.
        </li>
        <li>
          The script scrolls the page once, copies the snapshot to your
          clipboard, and shows an alert.
        </li>
        <li>Switch back here and paste it into the textarea above.</li>
      </ol>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <a
          href={SNAPSHOT_BOOKMARKLET}
          onClick={(e) => e.preventDefault()}
          draggable
          title="Drag to your bookmarks bar"
          className="inline-flex items-center gap-1 text-blue-600 hover:underline cursor-grab select-none"
        >
          📌 Snapshot live page
        </a>
        <button
          type="button"
          className={btnSecondary}
          onClick={onCopyScript}
        >
          {copied ? "Copied" : "Copy script"}
        </button>
      </div>
      <details>
        <summary className="cursor-pointer text-zinc-500 select-none">
          Show script source
        </summary>
        <pre className="mt-2 p-2 rounded bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 font-mono text-[10px] leading-relaxed overflow-auto max-h-40 whitespace-pre">
          {SNAPSHOT_SCRIPT}
        </pre>
      </details>
    </div>
  );
}

type ExportMode = "merged" | "active";

function ExportModal({
  activeHtml,
  mergedHtml,
  activeViewport,
  onClose,
}: {
  activeHtml: string;
  mergedHtml: string;
  activeViewport: Viewport;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<ExportMode>("merged");
  const [copied, setCopied] = useState(false);
  const html = mode === "merged" ? mergedHtml : activeHtml;
  return (
    <Modal onClose={onClose} title="Export HTML">
      <div className="flex items-center gap-2 mb-3 text-xs">
        <span className="text-zinc-500">Format:</span>
        <label className="flex items-center gap-1 cursor-pointer">
          <input
            type="radio"
            name="lc-export-mode"
            checked={mode === "merged"}
            onChange={() => setMode("merged")}
          />
          <span>Merged (desktop + mobile)</span>
        </label>
        <label className="flex items-center gap-1 cursor-pointer">
          <input
            type="radio"
            name="lc-export-mode"
            checked={mode === "active"}
            onChange={() => setMode("active")}
          />
          <span>Active viewport only ({activeViewport})</span>
        </label>
      </div>
      {mode === "merged" && (
        <p className="text-xs text-zinc-500 mb-2">
          Both layouts ship in one HTML file. Desktop shows above 768px; mobile
          below. Each layout&apos;s CSS is scoped so class names don&apos;t collide.
        </p>
      )}
      <textarea
        readOnly
        value={html}
        className="w-full h-72 p-2 font-mono text-xs rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 focus:outline-none"
      />
      <div className="flex justify-end gap-2 mt-3">
        <button type="button" className={btnSecondary} onClick={onClose}>
          Close
        </button>
        <button
          type="button"
          className={btnPrimary}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(html);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {
              /* clipboard may be blocked */
            }
          }}
        >
          {copied ? "Copied" : "Copy to clipboard"}
        </button>
      </div>
    </Modal>
  );
}

type SaveResult = {
  id: string;
  slug: string;
  title: string;
  html_url: string;
  events_url: string;
};

// localStorage key. Bumping the suffix invalidates everyone's saved page
// pointer — useful if the storage shape ever changes.
const SAVED_PAGE_KEY = "lc-saved-page-v1";

type SavedPagePointer = { id: string; slug: string; title: string };

function readSavedPointer(): SavedPagePointer | null {
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

function writeSavedPointer(pointer: SavedPagePointer | null): void {
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

function SaveModal({
  desktopDoc,
  mobileDoc,
  onClose,
}: {
  desktopDoc: EditorDocument;
  mobileDoc: EditorDocument;
  onClose: () => void;
}) {
  // Loaded from localStorage on mount. When non-null the modal saves over
  // the existing page (PUT). When null the modal creates a new one (POST).
  // Resolved in an effect so SSR and the first client render stay in sync.
  const [pointer, setPointer] = useState<SavedPagePointer | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SaveResult | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const found = readSavedPointer();
    setPointer(found);
    if (found) setTitle(found.title);
    setHydrated(true);
  }, []);

  // Pull NEXT_PUBLIC_* at module read time. Process.env on the client side
  // is statically inlined by Next at build, so missing values surface as
  // undefined here — show a friendly hint instead of a 404 from the browser.
  const backendUrl = process.env.NEXT_PUBLIC_LC_BACKEND_URL;
  const writeToken = process.env.NEXT_PUBLIC_LC_BACKEND_TOKEN;

  const buildPayload = (): {
    html: string;
    events: EventConfig[];
    editor_state: { desktop: EditorDocument; mobile: EditorDocument };
  } => {
    // Optimize before serializing so the saved HTML matches what the user
    // would see if they re-imported their own export. Imports already run
    // optimizeDocument; hand-edited or sample-loaded docs may not have, so
    // run it here unconditionally — it's idempotent on already-clean docs.
    const optimizedDesktop = optimizeDocument(desktopDoc).doc;
    const optimizedMobile = optimizeDocument(mobileDoc).doc;
    const html = serializeMerged(optimizedDesktop, optimizedMobile);
    const events = extractEventsFromHtml(html);
    return {
      html,
      events,
      // The editor_state blob lets the Load modal reopen this page later
      // without round-tripping through merged HTML (which is lossy for
      // editor metadata like attribute order, IDs, group memberships).
      editor_state: { desktop: optimizedDesktop, mobile: optimizedMobile },
    };
  };

  const onSave = async () => {
    setError(null);
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    if (!backendUrl) {
      setError(
        "NEXT_PUBLIC_LC_BACKEND_URL is not set — copy .env.example to .env.local and restart `npm run dev`."
      );
      return;
    }
    setSaving(true);
    try {
      const { html, events, editor_state } = buildPayload();
      const base = backendUrl.replace(/\/$/, "");
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (writeToken) headers.Authorization = `Bearer ${writeToken}`;

      let res: Response;
      let usedFallback = false;

      if (pointer) {
        // Update existing page in place. PUT preserves the slug.
        res = await fetch(
          `${base}/api/lc-pages/${encodeURIComponent(pointer.slug)}/`,
          {
            method: "PUT",
            headers,
            body: JSON.stringify({
              title: title.trim(),
              html,
              events,
              editor_state,
            }),
          }
        );
        // Backend may have lost the row (db reset, manual delete). Drop the
        // stale pointer and create a fresh page so the save still succeeds.
        if (res.status === 404) {
          writeSavedPointer(null);
          setPointer(null);
          usedFallback = true;
        }
      }

      if (!pointer || usedFallback) {
        res = await fetch(`${base}/api/lc-pages/`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            title: title.trim(),
            html,
            events,
            editor_state,
            ...(slug.trim() ? { slug: slug.trim() } : {}),
          }),
        });
      }

      if (!res!.ok) {
        const detail = await res!.text().catch(() => "");
        throw new Error(
          `Backend returned ${res!.status}: ${detail || res!.statusText}`
        );
      }
      const data = (await res!.json()) as SaveResult;
      writeSavedPointer({ id: data.id, slug: data.slug, title: data.title });
      setPointer({ id: data.id, slug: data.slug, title: data.title });
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const onResetSavedPointer = () => {
    writeSavedPointer(null);
    setPointer(null);
    setSlug("");
    setError(null);
  };

  if (result) {
    return (
      <Modal onClose={onClose} title="Saved">
        <div className="text-xs space-y-3">
          <p className="text-zinc-600 dark:text-zinc-300">
            Saved as <strong>{result.title}</strong> (slug{" "}
            <code className="px-1 rounded bg-zinc-100 dark:bg-zinc-800">
              {result.slug}
            </code>
            ). The funnel can now render it at{" "}
            <code className="px-1 rounded bg-zinc-100 dark:bg-zinc-800">
              /lc/{result.slug}
            </code>
            .
          </p>
          <div>
            <div className="text-zinc-500 mb-1">Public HTML URL</div>
            <div className="flex gap-2">
              <input
                readOnly
                value={result.html_url}
                onFocus={(e) => e.target.select()}
                className="flex-1 px-2 py-1 font-mono text-[11px] rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 focus:outline-none"
              />
              <button
                type="button"
                className={btnSecondary}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(result.html_url);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  } catch {
                    /* clipboard may be blocked */
                  }
                }}
              >
                {copied ? "Copied" : "Copy"}
              </button>
              <a
                href={result.html_url}
                target="_blank"
                rel="noreferrer"
                className={btnSecondary}
              >
                Open
              </a>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button type="button" className={btnPrimary} onClick={onClose}>
            Close
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      onClose={onClose}
      title={pointer ? `Update “${pointer.title}”` : "Save to backend"}
    >
      <div className="text-xs space-y-3">
        {pointer && hydrated && (
          <div className="p-2 rounded border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950 text-blue-800 dark:text-blue-200">
            Saving over slug{" "}
            <code className="px-1 rounded bg-white/60 dark:bg-black/30">
              {pointer.slug}
            </code>
            .{" "}
            <button
              type="button"
              onClick={onResetSavedPointer}
              className="underline hover:text-blue-900 dark:hover:text-blue-100"
            >
              Save as new instead
            </button>
          </div>
        )}
        <div className="space-y-1">
          <label className="text-zinc-500">Title</label>
          <input
            value={title}
            autoFocus
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Pricing v3"
            className="w-full px-2 py-1.5 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 focus:outline-none focus:border-blue-400"
          />
        </div>
        {!pointer && (
          <div className="space-y-1">
            <label className="text-zinc-500">
              Slug{" "}
              <span className="text-zinc-400">
                (optional — auto-generated when blank)
              </span>
            </label>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="pricing-v3"
              className="w-full px-2 py-1.5 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 font-mono focus:outline-none focus:border-blue-400"
            />
          </div>
        )}
        <p className="text-zinc-500">
          Optimizes both viewports (drops empty elements, dedupes
          <code className="mx-1 px-1 rounded bg-zinc-100 dark:bg-zinc-800">
            &lt;style&gt;
          </code>
          blocks, strips framework attributes), then ships merged HTML +
          events to{" "}
          <code className="px-1 rounded bg-zinc-100 dark:bg-zinc-800">
            {backendUrl ?? "(NEXT_PUBLIC_LC_BACKEND_URL unset)"}
          </code>
          .
        </p>
        {error && (
          <div className="p-2 rounded border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300">
            {error}
          </div>
        )}
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <button type="button" className={btnSecondary} onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className={btnPrimary}
          disabled={saving || !title.trim()}
          onClick={onSave}
        >
          {saving ? "Saving…" : pointer ? "Update" : "Save"}
        </button>
      </div>
    </Modal>
  );
}

type SavedPageRow = {
  id: string;
  slug: string;
  title: string;
  html_url: string;
  events_url: string;
  editor_state_url: string;
  has_editor_state: boolean;
  size_bytes: number;
  created_at: string;
  updated_at: string;
};

function LoadModal({
  onClose,
  onLoaded,
}: {
  onClose: () => void;
  onLoaded: (desktop: EditorDocument, mobile: EditorDocument) => void;
}) {
  const [items, setItems] = useState<SavedPageRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingSlug, setLoadingSlug] = useState<string | null>(null);

  const backendUrl = process.env.NEXT_PUBLIC_LC_BACKEND_URL;

  useEffect(() => {
    if (!backendUrl) {
      setError(
        "NEXT_PUBLIC_LC_BACKEND_URL is not set — copy .env.example to .env.local and restart `npm run dev`."
      );
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `${backendUrl.replace(/\/$/, "")}/api/lc-pages/`,
          { cache: "no-store" }
        );
        if (!res.ok) {
          throw new Error(
            `Backend returned ${res.status}: ${res.statusText || "(no body)"}`
          );
        }
        const data = (await res.json()) as { items: SavedPageRow[] };
        if (!cancelled) setItems(data.items);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [backendUrl]);

  const onPick = async (row: SavedPageRow) => {
    if (!row.has_editor_state) {
      setError(
        `"${row.title}" was saved before editor_state existed — re-save it from the editor first.`
      );
      return;
    }
    setError(null);
    setLoadingSlug(row.slug);
    try {
      const res = await fetch(row.editor_state_url, { cache: "no-store" });
      if (!res.ok) {
        throw new Error(
          `Couldn't fetch editor_state (${res.status} ${res.statusText}).`
        );
      }
      const state = (await res.json()) as {
        desktop?: EditorDocument;
        mobile?: EditorDocument;
      };
      if (!state.desktop || !state.mobile) {
        throw new Error("Saved editor_state is missing desktop or mobile.");
      }
      onLoaded(state.desktop, state.mobile);
      // Same pointer the SaveModal reads so subsequent saves overwrite the
      // page we just loaded.
      writeSavedPointer({ id: row.id, slug: row.slug, title: row.title });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingSlug(null);
    }
  };

  return (
    <Modal onClose={onClose} title="Load a saved page">
      <div className="text-xs space-y-3">
        {error && (
          <div className="p-2 rounded border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300">
            {error}
          </div>
        )}
        {!items && !error && (
          <div className="text-zinc-500">Loading list…</div>
        )}
        {items && items.length === 0 && (
          <div className="text-zinc-500">
            No saved pages yet. Build one and click Save.
          </div>
        )}
        {items && items.length > 0 && (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800 rounded border border-zinc-200 dark:border-zinc-800 max-h-80 overflow-auto">
            {items.map((row) => {
              const disabled =
                !row.has_editor_state || loadingSlug === row.slug;
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onPick(row)}
                    className="w-full text-left px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-between gap-3"
                    title={
                      row.has_editor_state
                        ? "Replace current editor docs with this saved page"
                        : "This page has no editor_state — re-save from the editor to enable Load"
                    }
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{row.title}</div>
                      <div className="text-zinc-500 font-mono">
                        {row.slug}
                        {!row.has_editor_state && (
                          <span className="ml-2 text-amber-600 dark:text-amber-400">
                            (no editor state)
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-zinc-400 whitespace-nowrap">
                      {loadingSlug === row.slug
                        ? "Loading…"
                        : new Date(row.updated_at).toLocaleString()}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <button type="button" className={btnSecondary} onClick={onClose}>
          Close
        </button>
      </div>
    </Modal>
  );
}

// Pull events config out of the inline <script>window.__lcEventsConfig=…</script>
// that serializeMerged appends. Mirrors the funnel-side logic in
// funnel/src/widgets/lc-page/api/get-lc-page.ts so the two sides agree on
// canonical events shape regardless of who reads the HTML directly.
function extractEventsFromHtml(html: string): EventConfig[] {
  const cfgRegex =
    /<script\b[^>]*>\s*window\.__lcEventsConfig\s*=\s*([\s\S]*?);\s*<\/script>/i;
  const match = cfgRegex.exec(html);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[1]);
    return Array.isArray(parsed) ? (parsed as EventConfig[]) : [];
  } catch {
    return [];
  }
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white dark:bg-zinc-950 rounded-lg shadow-xl p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-sm">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-700"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const btnPrimary =
  "h-8 px-3 text-xs font-medium rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed";
const btnSecondary =
  "h-8 px-3 text-xs font-medium rounded border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900";
