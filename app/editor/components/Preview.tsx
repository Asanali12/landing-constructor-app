"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useEditor } from "../store";
import { renderNode } from "../react-render";
import { scopeClassFor, scopeStyles, splitHeadAndBody } from "../merge";
import { annotateAndCollect } from "../events-runtime";
import { serializeDocument } from "../serialize";
import { LandingPageHost } from "../../host-runtime/LandingPageHost";
import type { EventConfig } from "../../host-runtime/types";
import type { EditorDocument } from "../types";

const IFRAME_BASE_CSS = `
  html, body { margin: 0; padding: 0; }
  body { background: white; }
  /* Editor affordances. Kept tiny so they don't visually conflict with the
     user's design. */
  [data-edit-id] { transition: outline-color 80ms; }
  [data-edit-id]:hover { outline: 1px dashed rgba(59, 130, 246, 0.5); outline-offset: 1px; }
  .__lc-selected, .__lc-selected:hover {
    outline: 2px solid #3b82f6 !important;
    outline-offset: 1px;
  }
  /* Disable real navigation while editing. */
  a { cursor: default; }
`;

const HOST_BASE_CSS = `
  html, body { margin: 0; padding: 0; }
  body { background: white; }
`;

type PreviewMode = "editor" | "host";

// Initialise an iframe doc once on mount, optionally inject a CSS block, and
// auto-grow the iframe to fit content height.
function useIframeBody(initCss: string) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [body, setBody] = useState<HTMLElement | null>(null);
  const [height, setHeight] = useState<number>(600);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const doc = iframe.contentDocument;
    if (!doc) return;

    doc.open();
    doc.write(
      `<!doctype html><html><head><meta charset="utf-8"><base target="_blank"></head><body></body></html>`
    );
    doc.close();

    if (initCss) {
      const style = doc.createElement("style");
      style.dataset.editorChrome = "true";
      style.textContent = initCss;
      doc.head.appendChild(style);
    }

    setBody(doc.body);

    const measure = () => {
      const next = Math.max(
        doc.body.scrollHeight,
        doc.documentElement.scrollHeight,
        400
      );
      setHeight(next);
    };
    const ro = new ResizeObserver(measure);
    ro.observe(doc.body);
    ro.observe(doc.documentElement);
    measure();

    return () => ro.disconnect();
  }, [initCss]);

  return { iframeRef, body, height };
}

// Build the artifacts that would land in S3 — body HTML (with
// data-lc-events annotations) and the JSON event manifest, scoped exactly
// the way `serializeMerged` would scope a single viewport. The scoping is
// load-bearing: Framer's exported CSS uses `body { … }` rules for global
// layout, which `prefixCss` rewrites to target the scope wrapper. Without
// this pipeline the rules would hit the iframe's actual body instead, and
// flex/positioning would diverge from the editor preview.
function buildHostArtifacts(
  doc: EditorDocument,
  viewport: "desktop" | "mobile"
): { html: string; events: EventConfig[] } {
  const scope = scopeClassFor(viewport);
  const split = splitHeadAndBody(doc);
  const scopedCss = scopeStyles(split.styleNodes, scope);
  // Scope event selectors too, so a binding on .lc-view-desktop only fires
  // for that scope's clone of the element.
  const { nodes, configs } = annotateAndCollect(split.body, `.${scope} `);

  const linkHtml = split.linkNodes.length
    ? serializeDocument(
        { children: split.linkNodes },
        { pretty: false }
      )
    : "";
  // Defang any literal `</style` inside the CSS so it can't break out of
  // the surrounding tag.
  const safeCss = scopedCss.replace(/<\/(style)/gi, "<\\/$1");
  const styleTag = scopedCss.trim() ? `<style>${safeCss}</style>` : "";
  // pretty:false on the body — pretty:true inserts whitespace text between
  // siblings, which becomes anonymous flex items in some browsers and can
  // skew the layout away from the production export.
  const bodyHtml = serializeDocument(
    { children: nodes },
    { pretty: false }
  );

  const html =
    `${linkHtml}${styleTag}` + `<div class="${scope}">${bodyHtml}</div>`;
  return { html, events: configs };
}

export function Preview() {
  const { state, select } = useEditor();
  const viewportWidth = state.viewportWidth;
  const [mode, setMode] = useState<PreviewMode>("editor");

  const editorIframe = useIframeBody(IFRAME_BASE_CSS);
  const hostIframe = useIframeBody(HOST_BASE_CSS);

  // Mirror the merged-export scoping pipeline so preview cascade matches the
  // exported HTML exactly. Hoist <style> blocks into a single prefixed block,
  // hoist external <link rel=stylesheet> as-is, and render the rest of the
  // body inside a div carrying the scope class.
  const scope = scopeClassFor(state.activeViewport);
  const { scopedCss, externalLinks, bodyNodes } = useMemo(() => {
    const split = splitHeadAndBody(state.doc);
    return {
      scopedCss: scopeStyles(split.styleNodes, scope),
      externalLinks: split.linkNodes,
      bodyNodes: split.body,
    };
  }, [state.doc, scope]);

  // Compute host-mode artifacts only when host mode is active so we don't
  // pay the serialize cost on every editor edit.
  const hostArtifacts = useMemo(() => {
    if (mode !== "host") return null;
    return buildHostArtifacts(state.doc, state.activeViewport);
  }, [mode, state.doc, state.activeViewport]);

  // Visible iframe by mode — both stay mounted so toggling is instant and
  // the doc init in useIframeBody only runs once per mount.
  const editorVisible = mode === "editor";

  return (
    <div className="flex flex-col flex-1 min-w-0 bg-zinc-100 dark:bg-zinc-900 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500">
        <span>Preview</span>
        <div className="flex rounded border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <button
            type="button"
            onClick={() => setMode("editor")}
            className={`px-2.5 h-6 ${
              mode === "editor"
                ? "bg-blue-600 text-white"
                : "hover:bg-zinc-100 dark:hover:bg-zinc-900"
            }`}
            title="Live editor preview with selection chrome."
          >
            Editor
          </button>
          <button
            type="button"
            onClick={() => setMode("host")}
            className={`px-2.5 h-6 border-l border-zinc-200 dark:border-zinc-800 ${
              mode === "host"
                ? "bg-blue-600 text-white"
                : "hover:bg-zinc-100 dark:hover:bg-zinc-900"
            }`}
            title="Render through LandingPageHost — what your Next.js host page would show. Events log to console."
          >
            Next.js mode
          </button>
        </div>
      </div>
      <div
        className="flex-1 min-h-0 overflow-auto p-6"
        onClick={() => {
          if (mode === "editor") select(null);
        }}
      >
        <div className="mx-auto" style={{ width: viewportWidth, maxWidth: "100%" }}>
          <iframe
            ref={editorIframe.iframeRef}
            title="Editor preview"
            className="bg-white dark:bg-zinc-950 shadow-sm rounded-md block"
            style={{
              width: viewportWidth,
              maxWidth: "100%",
              height: editorIframe.height,
              border: 0,
              display: editorVisible ? "block" : "none",
            }}
            onClick={(e) => e.stopPropagation()}
          />
          <iframe
            ref={hostIframe.iframeRef}
            title="Next.js mode preview"
            className="bg-white dark:bg-zinc-950 shadow-sm rounded-md block"
            style={{
              width: viewportWidth,
              maxWidth: "100%",
              height: hostIframe.height,
              border: 0,
              display: editorVisible ? "none" : "block",
            }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>

        {editorIframe.body &&
          createPortal(
            <div
              className={scope}
              data-lc-root="true"
              onClick={(e) => {
                if (e.target === e.currentTarget) select(null);
              }}
            >
              {scopedCss && (
                <style
                  data-lc-scope={scope}
                  dangerouslySetInnerHTML={{ __html: scopedCss }}
                />
              )}
              {externalLinks.map((link) =>
                renderNode(link, {
                  onSelect: () => {},
                  selectedId: null,
                })
              )}
              {bodyNodes.length === 0 ? (
                <div
                  style={{
                    padding: "80px 24px",
                    textAlign: "center",
                    color: "#a1a1aa",
                    fontFamily: "system-ui, -apple-system, sans-serif",
                    fontSize: 14,
                  }}
                >
                  Empty document. Import HTML or add elements from the
                  Components tab.
                </div>
              ) : (
                bodyNodes.map((node) =>
                  renderNode(node, {
                    onSelect: (id) => select(id),
                    selectedId: state.selectedId,
                  })
                )
              )}
            </div>,
            editorIframe.body
          )}

        {hostIframe.body &&
          hostArtifacts &&
          createPortal(
            <LandingPageHost
              html={hostArtifacts.html}
              events={hostArtifacts.events}
            />,
            hostIframe.body
          )}
      </div>
    </div>
  );
}
