"use client";

import { useState } from "react";
import { LayersTree } from "./LayersTree";
import { ElementPalette } from "./ElementPalette";
import { ChatPanel } from "./ChatPanel";

type Tab = "layers" | "components" | "chat";

const TABS: { id: Tab; label: string }[] = [
  { id: "layers", label: "Layers" },
  { id: "components", label: "Components" },
  { id: "chat", label: "Chat" },
];

export function LeftSidebar({ width }: { width: number }) {
  const [tab, setTab] = useState<Tab>("layers");

  return (
    <aside
      style={{ width }}
      className="shrink-0 border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex flex-col min-w-0"
    >
      <div className="flex border-b border-zinc-200 dark:border-zinc-800 text-xs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2 ${
              tab === t.id
                ? "border-b-2 border-blue-500 font-medium"
                : "text-zinc-500"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {/* The Chat panel needs to keep its scroll position and streaming buffer
          when the user flips tabs — render it always and toggle visibility,
          rather than unmounting on tab change. */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <div className={`h-full overflow-auto ${tab === "layers" ? "" : "hidden"}`}>
          <LayersTree />
        </div>
        <div className={`h-full overflow-auto ${tab === "components" ? "" : "hidden"}`}>
          <ElementPalette />
        </div>
        <div className={`h-full ${tab === "chat" ? "" : "hidden"}`}>
          <ChatPanel />
        </div>
      </div>
    </aside>
  );
}
