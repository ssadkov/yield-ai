"use client";

import { useMediaQuery } from "react-responsive";
import Sidebar from "@/components/Sidebar";
import DashboardPanel from "@/components/DashboardPanel";
import ChatPanelWrapper from "@/components/ChatPanelWrapper";
import MobileTabs from "@/components/MobileTabs";
import { ChunkErrorBoundary } from "@/components/ChunkErrorBoundary";
import { ResourcePreloader } from "@/components/ResourcePreloader";
import { Theme } from "@radix-ui/themes";

const DESKTOP_BREAKPOINT_PX = 768;

export default function Home() {
  const isDesktop = useMediaQuery({ minWidth: DESKTOP_BREAKPOINT_PX });

  return (
    <ChunkErrorBoundary>
      <Theme accentColor="sky">
        <ResourcePreloader />
        <div className="h-screen overflow-hidden flex">
          {isDesktop ? (
            <>
              <div className="border-r h-screen shrink-0">
                <Sidebar />
              </div>
              <div className="flex-1 flex flex-row overflow-hidden min-w-0">
                <div className="flex-1 border-r h-full overflow-y-auto scrollbar-hide">
                  <DashboardPanel />
                </div>
                <div className="w-[200px] shrink-0 h-full overflow-y-auto">
                  <ChatPanelWrapper />
                </div>
              </div>
            </>
          ) : (
            <div className="h-full w-full min-w-0 overflow-x-hidden flex flex-col">
              <MobileTabs />
            </div>
          )}
        </div>
      </Theme>
    </ChunkErrorBoundary>
  );
}
