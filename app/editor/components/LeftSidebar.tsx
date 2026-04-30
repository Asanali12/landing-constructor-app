"use client";

import { useState } from "react";
import { LayersTree } from "./LayersTree";
import { ElementPalette } from "./ElementPalette";

type Tab = "layers" | "components";

export function LeftSidebar({ width }: { width: number }) {
  const [tab, setTab] = useState<Tab>("layers");

  return (
    <aside
      style={{ width }}
      className="shrink-0 border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex flex-col min-w-0"
    >
      <div className="flex border-b border-zinc-200 dark:border-zinc-800 text-xs">
        <button
          type="button"
          onClick={() => setTab("layers")}
          className={`flex-1 py-2 ${
            tab === "layers"
              ? "border-b-2 border-blue-500 font-medium"
              : "text-zinc-500"
          }`}
        >
          Layers
        </button>
        <button
          type="button"
          onClick={() => setTab("components")}
          className={`flex-1 py-2 ${
            tab === "components"
              ? "border-b-2 border-blue-500 font-medium"
              : "text-zinc-500"
          }`}
        >
          Components
        </button>
      </div>
      <div className="flex-1 overflow-auto">
        {tab === "layers" ? <LayersTree /> : <ElementPalette />}
      </div>
    </aside>
  );
}
