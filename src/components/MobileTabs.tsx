"use client";
import { useState, useEffect, useRef } from "react";
import DashboardPanel from "./DashboardPanel";
import ChatPanel from "./ChatPanel";
import { WalletSelector } from "./WalletSelector";
import { PortfolioCard } from "./portfolio/PortfolioCard";
import { PositionsList as HyperionPositionsList } from "./protocols/hyperion/PositionsList";
import { PositionsList as EchelonPositionsList } from "./protocols/echelon/PositionsList";
import { PositionsList as AriesPositionsList } from "./protocols/aries/PositionsList";
import { PositionsList as JoulePositionsList } from "./protocols/joule/PositionsList";
import { PositionsList as TappPositionsList } from "./protocols/tapp/PositionsList";
import { PositionsList as MesoPositionsList } from "./protocols/meso/PositionsList";
import { PositionsList as AuroPositionsList } from "./protocols/auro/PositionsList";
import { PositionsList as EarniumPositionsList } from "./protocols/earnium/PositionsList";
import { PositionsList as MoarPositionsList } from "./protocols/moar/PositionsList";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { AptosPortfolioService } from "@/lib/services/aptos/portfolio";
import { Token } from "@/lib/types/token";
import { Logo } from "./ui/logo";
//import { AlphaBadge } from "./ui/alpha-badge";
import { CollapsibleProvider } from "@/contexts/CollapsibleContext";
import { MobileManagementProvider, useMobileManagement } from "@/contexts/MobileManagementContext";

function MobileTabsContent() {
  const [tab, setTab] = useState<"ideas" | "assets" | "chat">("assets");
  const { account } = useWallet();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [totalValue, setTotalValue] = useState<string>("0");
  const [hyperionValue, setHyperionValue] = useState<number>(0);
  const [echelonValue, setEchelonValue] = useState<number>(0);
  const [ariesValue, setAriesValue] = useState<number>(0);
  const [jouleValue, setJouleValue] = useState<number>(0);
  const [tappValue, setTappValue] = useState<number>(0);
  const [mesoValue, setMesoValue] = useState<number>(0);
  const [auroValue, setAuroValue] = useState<number>(0);
  const [earniumValue, setEarniumValue] = useState<number>(0);
  const [moarValue, setMoarValue] = useState<number>(0);

  // Функция для скролла к верху
  const scrollToTop = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

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
        setTotalValue((total + hyperionValue + echelonValue + ariesValue + jouleValue + tappValue + mesoValue + auroValue + earniumValue + moarValue).toFixed(2));
      } catch (error) {
      }
    }

    loadPortfolio();
  }, [account?.address, hyperionValue, echelonValue, ariesValue, jouleValue, tappValue, mesoValue, auroValue, earniumValue, moarValue]);

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

  const handleJouleValueChange = (value: number) => {
    setJouleValue(value);
  };

  const handleTappValueChange = (value: number) => {
    setTappValue(value);
  };

  const handleMesoValueChange = (value: number) => {
    setMesoValue(value);
  };

  const handleAuroValueChange = (value: number) => {
    setAuroValue(value);
  };

  const handleEarniumValueChange = (value: number) => {
    setEarniumValue(value);
  };

  const handleMoarValueChange = (value: number) => {
    setMoarValue(value);
  };

  return (
    <MobileManagementProvider setActiveTab={setTab} scrollToTop={scrollToTop}>
      <CollapsibleProvider>
        <div className="flex flex-col min-h-screen max-h-screen">
          {/* Header - fixed at top */}
          <div className="flex-shrink-0 p-4 border-b bg-background">
            <div className="flex items-center gap-3">
              <Logo size="md" />
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold">Yield AI</h1>
                { /*<AlphaBadge />*/ }
              </div>
            </div>
          </div>
          
          {/* Content area - scrollable */}
          <div ref={scrollContainerRef} className="flex-1 overflow-y-auto min-h-0 pb-[calc(72px+env(safe-area-inset-bottom))] sm:pb-0">
            <div className={tab === "ideas" ? "block w-full max-w-full" : "hidden w-full max-w-full"}>
              <DashboardPanel />
            </div>
            <div className={tab === "assets" ? "block w-full max-w-full" : "hidden w-full max-w-full"}>
              <div className="p-4 space-y-4 w-full max-w-full">
                <WalletSelector />
                {account?.address ? (
                  <>
                    <PortfolioCard totalValue={totalValue} tokens={tokens} />
                    {[
                      { 
                        component: HyperionPositionsList, 
                        value: hyperionValue, 
                        name: 'Hyperion',
                        handler: handleHyperionValueChange
                      },
                      { 
                        component: EchelonPositionsList, 
                        value: echelonValue, 
                        name: 'Echelon',
                        handler: handleEchelonValueChange
                      },
                      { 
                        component: AriesPositionsList, 
                        value: ariesValue, 
                        name: 'Aries',
                        handler: handleAriesValueChange
                      },
                      { 
                        component: JoulePositionsList, 
                        value: jouleValue, 
                        name: 'Joule',
                        handler: handleJouleValueChange
                      },
                      { 
                        component: TappPositionsList, 
                        value: tappValue, 
                        name: 'Tapp Exchange',
                        handler: handleTappValueChange
                      },
                      { 
                        component: MesoPositionsList, 
                        value: mesoValue, 
                        name: 'Meso Finance',
                        handler: handleMesoValueChange
                      },
                      { 
                        component: AuroPositionsList, 
                        value: auroValue, 
                        name: 'Auro Finance',
                        handler: handleAuroValueChange
                      },
                      { 
                        component: EarniumPositionsList, 
                        value: earniumValue, 
                        name: 'Earnium',
                        handler: handleEarniumValueChange
                      },
                      { 
                        component: MoarPositionsList, 
                        value: moarValue, 
                        name: 'Moar Market',
                        handler: handleMoarValueChange
                      }
                    ]
                      .sort((a, b) => b.value - a.value)
                      .map(({ component: Component, name, handler }) => (
                        <Component
                          key={name}
                          address={account.address.toString()}
                          onPositionsValueChange={handler}
                          walletTokens={tokens}
                        />
                      ))}
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
            {/* Spacer to ensure content never hides under bottom nav */}
            <div className="h-[calc(72px+env(safe-area-inset-bottom))] sm:h-0" />
          </div>
          
          {/* Bottom navigation - fixed at bottom */}
          <div className="flex-shrink-0 flex border-t bg-background safe-area-bottom mobile-bottom-nav">
            <button
              className={`flex-1 p-4 text-center transition-colors cursor-pointer ${tab === "ideas" ? "text-primary bg-primary/5" : "text-muted-foreground hover:text-foreground"}`}
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
              className={`flex-1 p-4 text-center transition-colors cursor-pointer ${tab === "assets" ? "text-primary bg-primary/5" : "text-muted-foreground hover:text-foreground"}`}
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
              className={`flex-1 p-4 text-center transition-colors cursor-pointer ${tab === "chat" ? "text-primary bg-primary/5" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => setTab("chat")}
            >
              <div className="flex flex-col items-center gap-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-xs font-medium">Tools</span>
              </div>
            </button>
          </div>
        </div>
      </CollapsibleProvider>
    </MobileManagementProvider>
  );
}

export default function MobileTabs() {
  return <MobileTabsContent />;
} 