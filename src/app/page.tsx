"use client";
import Sidebar from "@/components/Sidebar";
import DashboardPanel from "@/components/DashboardPanel";
import ChatPanel from "@/components/ChatPanel";
import MobileTabs from "@/components/MobileTabs";
import { WalletConnect } from "@/components/WalletConnect";
import { PositionsList } from "@/components/protocols/hyperion/PositionsList";

export default function Home() {
  return (
    <div className="h-screen md:flex overflow-hidden">
      <div className="hidden md:block border-r h-screen">
        <Sidebar />
      </div>

      <div className="block md:hidden h-full">
        <MobileTabs />
      </div>

      <div className="flex-1 hidden md:flex flex-row overflow-hidden">
        <div className="w-3/5 border-r h-full overflow-y-auto">
          <DashboardPanel />
        </div>
        <div className="w-2/5 h-full overflow-y-auto">
          <ChatPanel />
        </div>
      </div>
    </div>
  );
}
