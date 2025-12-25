"use client";
import Sidebar from "@/components/Sidebar";
import DashboardPanel from "@/components/DashboardPanel";
import ChatPanel from "@/components/ChatPanel";
import MobileTabs from "@/components/MobileTabs";
import { ChunkErrorBoundary } from "@/components/ChunkErrorBoundary";
import { ResourcePreloader } from "@/components/ResourcePreloader";
import { Theme } from "@radix-ui/themes";

export default function Home() {
  return (
    <ChunkErrorBoundary>
      <Theme>
        <ResourcePreloader />
        <div className="h-screen md:flex overflow-hidden">
          <div className="hidden md:block border-r h-screen">
            <Sidebar />
          </div>

          <div className="block md:hidden h-full">
            <MobileTabs />
          </div>

          <div className="flex-1 hidden md:flex flex-row overflow-hidden">
            <div className="flex-1 border-r h-full overflow-y-auto">
              <DashboardPanel />
            </div>
            <div className="w-[200px] h-full overflow-y-auto">
              <ChatPanel />
            </div>
          </div>
        </div>
      </Theme>
    </ChunkErrorBoundary>
  );
}
