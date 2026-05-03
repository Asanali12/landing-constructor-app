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
import { annotateAndCollect, serializeEventsScript } from "../events-runtime";
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
