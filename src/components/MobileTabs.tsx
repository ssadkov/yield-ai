"use client";
import { useState } from "react";
import Sidebar from "./Sidebar";
import DashboardPanel from "./DashboardPanel";
import ChatPanel from "./ChatPanel";

export default function MobileTabs() {
  const [tab, setTab] = useState<"dashboard" | "assets" | "chat">("dashboard");

  return (
    <div className="h-screen flex flex-col">
      <div className="flex-1 overflow-y-auto">
        {tab === "dashboard" && <DashboardPanel />}
        {tab === "assets" && <Sidebar />}
        {tab === "chat" && <ChatPanel />}
      </div>
      <div className="border-t flex">
        <button className="flex-1 p-2" onClick={() => setTab("dashboard")}>Dashboard</button>
        <button className="flex-1 p-2" onClick={() => setTab("assets")}>Assets</button>
        <button className="flex-1 p-2" onClick={() => setTab("chat")}>Chat</button>
      </div>
    </div>
  );
} 