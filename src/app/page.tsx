"use client";
import Sidebar from "@/components/Sidebar";
import DashboardPanel from "@/components/DashboardPanel";
import ChatPanel from "@/components/ChatPanel";
import MobileTabs from "@/components/MobileTabs";

export default function Home() {
  return (
    <div className="h-screen flex flex-col md:flex-row">
      <div className="hidden md:block w-1/5 border-r">
        <Sidebar />
      </div>

      <div className="block md:hidden">
        <MobileTabs />
      </div>

      <div className="flex-1 hidden md:flex flex-row">
        <div className="w-3/5 border-r">
          <DashboardPanel />
        </div>
        <div className="w-2/5">
          <ChatPanel />
        </div>
      </div>
    </div>
  );
}
