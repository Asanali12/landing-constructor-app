"use client";

import { useState } from "react";
import { EditorProvider } from "../store";
import { AutoLoader } from "./AutoLoader";
import { LeftSidebar } from "./LeftSidebar";
import { Preview } from "./Preview";
import { ResizeHandle } from "./ResizeHandle";
import { RightSidebar } from "./RightSidebar";
import { TopBar } from "./TopBar";

const LEFT_DEFAULT_WIDTH = 288;
const RIGHT_DEFAULT_WIDTH = 320;
const SIDEBAR_MIN_WIDTH = 200;
const SIDEBAR_MAX_WIDTH = 600;

// `slug` is set by /edit/[slug]/page.tsx — when present, AutoLoader
// fetches the saved editor_state on mount and replaces both viewports.
// On the bare `/` route slug is undefined and the editor opens with the
// default empty docs.
export function Editor({ slug }: { slug?: string }) {
  const [leftWidth, setLeftWidth] = useState(LEFT_DEFAULT_WIDTH);
  const [rightWidth, setRightWidth] = useState(RIGHT_DEFAULT_WIDTH);

  return (
    <EditorProvider>
      {slug && <AutoLoader slug={slug} />}
      {/* Pin the whole editor to dynamic viewport height and clip its overflow.
          Without this, a tall iframe in Preview makes the body grow past 100vh
          and the page itself scrolls — taking the sidebars with it. */}
      <div className="flex flex-col h-dvh max-h-dvh overflow-hidden">
        <TopBar />
        <div className="flex flex-1 min-h-0">
          <LeftSidebar width={leftWidth} />
          <ResizeHandle
            side="left"
            width={leftWidth}
            onWidthChange={setLeftWidth}
            min={SIDEBAR_MIN_WIDTH}
            max={SIDEBAR_MAX_WIDTH}
          />
          <Preview />
          <ResizeHandle
            side="right"
            width={rightWidth}
            onWidthChange={setRightWidth}
            min={SIDEBAR_MIN_WIDTH}
            max={SIDEBAR_MAX_WIDTH}
          />
          <RightSidebar width={rightWidth} />
        </div>
      </div>
    </EditorProvider>
  );
}
