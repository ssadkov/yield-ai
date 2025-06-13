"use client";
import { useState, useEffect } from "react";
import DashboardPanel from "./DashboardPanel";
import ChatPanel from "./ChatPanel";
import { WalletSelector } from "./WalletSelector";
import { PortfolioCard } from "./portfolio/PortfolioCard";
import { PositionsList as HyperionPositionsList } from "./protocols/hyperion/PositionsList";
import { PositionsList as EchelonPositionsList } from "./protocols/echelon/PositionsList";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { AptosPortfolioService } from "@/lib/services/aptos/portfolio";
import { Token } from "@/lib/types/token";

export default function MobileTabs() {
  const [tab, setTab] = useState<"dashboard" | "assets" | "chat">("dashboard");
  const { account } = useWallet();
  const [tokens, setTokens] = useState<Token[]>([]);
  const [totalValue, setTotalValue] = useState<string>("0");
  const [hyperionValue, setHyperionValue] = useState<number>(0);
  const [echelonValue, setEchelonValue] = useState<number>(0);

  useEffect(() => {
    async function loadPortfolio() {
      if (!account?.address) return;

      try {
        const portfolioService = new AptosPortfolioService();
        const portfolio = await portfolioService.getPortfolio(account.address.toString());
        
        const total = portfolio.tokens.reduce((sum, token) => {
          const value = token.value ? parseFloat(token.value) : 0;
          return sum + (isNaN(value) ? 0 : value);
        }, 0);

        setTokens(portfolio.tokens);
        setTotalValue((total + hyperionValue + echelonValue).toFixed(2));
      } catch (error) {
        console.error("Failed to load portfolio:", error);
      }
    }

    loadPortfolio();
  }, [account?.address, hyperionValue, echelonValue]);

  // Обработчики изменения суммы позиций в протоколах
  const handleHyperionValueChange = (value: number) => {
    setHyperionValue(value);
  };

  const handleEchelonValueChange = (value: number) => {
    setEchelonValue(value);
  };

  return (
    <div className="h-screen flex flex-col">
      <div className="flex-1 overflow-y-auto">
        {tab === "dashboard" && <DashboardPanel />}
        {tab === "assets" && (
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Assets</h2>
              <WalletSelector />
            </div>
            {account?.address && (
              <>
                <PortfolioCard totalValue={totalValue} tokens={tokens} />
                <HyperionPositionsList 
                  address={account.address.toString()} 
                  onPositionsValueChange={handleHyperionValueChange}
                />
                <EchelonPositionsList 
                  address={account.address.toString()} 
                  onPositionsValueChange={handleEchelonValueChange}
                />
              </>
            )}
          </div>
        )}
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