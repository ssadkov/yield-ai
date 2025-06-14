"use client";
import Sidebar from "@/components/Sidebar";
import DashboardPanel from "@/components/DashboardPanel";
import ChatPanel from "@/components/ChatPanel";
import MobileTabs from "@/components/MobileTabs";
import { WalletConnect } from "@/components/WalletConnect";
import { PositionsList } from "@/components/protocols/hyperion/PositionsList";
import { YieldIdeas } from "@/components/InvestmentsDashboard";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function Home() {
  return (
    <div className="h-screen flex flex-col md:flex-row">
      <div className="hidden md:block border-r">
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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Yield Ideas</CardTitle>
          </CardHeader>
          <CardContent>
            <YieldIdeas />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
