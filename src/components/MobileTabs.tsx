"use client";
import { useState, useEffect } from "react";
import DashboardPanel from "./DashboardPanel";
import ChatPanel from "./ChatPanel";
import { WalletSelector } from "./WalletSelector";
import { PortfolioCard } from "./portfolio/PortfolioCard";
import { PositionsList as HyperionPositionsList } from "./protocols/hyperion/PositionsList";
import { PositionsList as EchelonPositionsList } from "./protocols/echelon/PositionsList";
import { PositionsList as AriesPositionsList } from "./protocols/aries/PositionsList";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { AptosPortfolioService } from "@/lib/services/aptos/portfolio";
import { Token } from "@/lib/types/token";
import { Logo } from "./ui/logo";
import { AlphaBadge } from "./ui/alpha-badge";

export default function MobileTabs() {
  const [tab, setTab] = useState<"ideas" | "assets" | "chat">("assets");
  const { account } = useWallet();
  const [tokens, setTokens] = useState<Token[]>([]);
  const [totalValue, setTotalValue] = useState<string>("0");
  const [hyperionValue, setHyperionValue] = useState<number>(0);
  const [echelonValue, setEchelonValue] = useState<number>(0);
  const [ariesValue, setAriesValue] = useState<number>(0);

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
        setTotalValue((total + hyperionValue + echelonValue + ariesValue).toFixed(2));
      } catch (error) {
        console.error("Failed to load portfolio:", error);
      }
    }

    loadPortfolio();
  }, [account?.address, hyperionValue, echelonValue, ariesValue]);

  // Обработчики изменения суммы позиций в протоколах
  const handleHyperionValueChange = (value: number) => {
    setHyperionValue(value);
  };

  const handleEchelonValueChange = (value: number) => {
    setEchelonValue(value);
  };

  const handleAriesValueChange = (value: number) => {
    setAriesValue(value);
  };

  return (
    <div className="flex flex-col h-screen max-h-screen">
      {/* Header - fixed at top */}
      <div className="flex-shrink-0 p-4 border-b bg-background">
        <div className="flex items-center gap-3">
          <Logo size="md" />
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold">Yield AI</h1>
            <AlphaBadge />
          </div>
        </div>
      </div>
      
      {/* Content area - scrollable */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className={tab === "ideas" ? "block" : "hidden"}>
          <DashboardPanel />
        </div>
        <div className={tab === "assets" ? "block" : "hidden"}>
          <div className="p-4 space-y-4">
            <WalletSelector />
            {account?.address ? (
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
                <AriesPositionsList 
                  address={account.address.toString()} 
                  onPositionsValueChange={handleAriesValueChange}
                />
              </>
            ) : (
              <div className="mt-6 p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                  Connect your Aptos wallet to view your assets and positions in DeFi protocols
                </p>
              </div>
            )}
          </div>
        </div>
        <div className={tab === "chat" ? "block" : "hidden"}>
          <ChatPanel />
        </div>
      </div>
      
      {/* Bottom navigation - fixed at bottom */}
      <div className="flex-shrink-0 flex border-t bg-background">
        <button
          className={`flex-1 p-4 text-center transition-colors ${tab === "ideas" ? "text-primary bg-primary/5" : "text-muted-foreground hover:text-foreground"}`}
          onClick={() => setTab("ideas")}
        >
          <div className="flex flex-col items-center gap-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <span className="text-xs font-medium">Ideas</span>
          </div>
        </button>
        <button
          className={`flex-1 p-4 text-center transition-colors ${tab === "assets" ? "text-primary bg-primary/5" : "text-muted-foreground hover:text-foreground"}`}
          onClick={() => setTab("assets")}
        >
          <div className="flex flex-col items-center gap-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-xs font-medium">Assets</span>
          </div>
        </button>
        <button
          className={`flex-1 p-4 text-center transition-colors ${tab === "chat" ? "text-primary bg-primary/5" : "text-muted-foreground hover:text-foreground"}`}
          onClick={() => setTab("chat")}
        >
          <div className="flex flex-col items-center gap-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span className="text-xs font-medium">Chat</span>
          </div>
        </button>
      </div>
    </div>
  );
} 