"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useEditor } from "../store";
import { renderNode } from "../react-render";
import { scopeClassFor, scopeStyles, splitHeadAndBody } from "../merge";

const VIEWPORTS: Array<{ label: string; width: number }> = [
  { label: "Desktop", width: 1280 },
  { label: "Laptop", width: 1024 },
  { label: "Tablet", width: 768 },
  { label: "Mobile", width: 390 },
];

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

export function Preview() {
  const { state, select, setViewportWidth } = useEditor();
  const viewportWidth = state.viewportWidth;
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [iframeBody, setIframeBody] = useState<HTMLElement | null>(null);
  const [iframeHeight, setIframeHeight] = useState<number>(600);

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

  // (Re)initialize the iframe document once the iframe element is mounted.
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

    const editorStyle = doc.createElement("style");
    editorStyle.dataset.editorChrome = "true";
    editorStyle.textContent = IFRAME_BASE_CSS;
    doc.head.appendChild(editorStyle);

    setIframeBody(doc.body);

    // Auto-grow the iframe to fit content height.
    const measure = () => {
      const next = Math.max(
        doc.body.scrollHeight,
        doc.documentElement.scrollHeight,
        400
      );
      setIframeHeight(next);
    };

    const ro = new ResizeObserver(measure);
    ro.observe(doc.body);
    ro.observe(doc.documentElement);
    measure();

    return () => ro.disconnect();
  }, []);

  return (
    <div className="flex flex-col flex-1 min-w-0 bg-zinc-100 dark:bg-zinc-900 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500">
        <span>Preview</span>
        <div className="flex items-center gap-3">
          <select
            value={viewportWidth}
            onChange={(e) => setViewportWidth(Number(e.target.value))}
            className="bg-transparent text-xs border border-zinc-200 dark:border-zinc-800 rounded px-1.5 py-1 focus:outline-none"
          >
            {VIEWPORTS.map((v) => (
              <option key={v.width} value={v.width}>
                {v.label} ({v.width}px)
              </option>
            ))}
          </select>
          <span className="text-zinc-400">click to select</span>
        </div>
      </div>
      <div
        className="flex-1 min-h-0 overflow-auto p-6"
        onClick={() => select(null)}
      >
        <div className="mx-auto" style={{ width: viewportWidth, maxWidth: "100%" }}>
          <iframe
            ref={iframeRef}
            title="Preview"
            className="bg-white dark:bg-zinc-950 shadow-sm rounded-md block"
            style={{
              width: viewportWidth,
              maxWidth: "100%",
              height: iframeHeight,
              border: 0,
            }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
        {iframeBody &&
          createPortal(
            <div
              className={scope}
              data-lc-root="true"
              onClick={(e) => {
                // A click that reaches the root means no descendant element
                // claimed it (they all stopPropagation), so deselect.
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
            iframeBody
          )}
      </div>
    </div>
  );
}
