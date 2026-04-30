"use client";

import { useCallback } from "react";

type Side = "left" | "right";

export function ResizeHandle({
  side,
  width,
  onWidthChange,
  min = 200,
  max = 600,
}: {
  // "left": handle sits on the right edge of a left-side panel — dragging
  // right grows the panel. "right": handle sits on the left edge of a
  // right-side panel — dragging right shrinks the panel.
  side: Side;
  width: number;
  onWidthChange: (next: number) => void;
  min?: number;
  max?: number;
}) {
  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = width;
      const direction = side === "left" ? 1 : -1;

      const onMove = (ev: MouseEvent) => {
        const delta = (ev.clientX - startX) * direction;
        const next = Math.max(min, Math.min(max, startWidth + delta));
        onWidthChange(next);
      };
      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
      // Prevent text selection while dragging across the layout.
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [side, width, onWidthChange, min, max]
  );

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      onMouseDown={onMouseDown}
      className="w-1 shrink-0 cursor-col-resize bg-transparent hover:bg-blue-500/40 active:bg-blue-500/60 transition-colors"
    />
  );
}
