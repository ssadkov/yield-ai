"use client";
import { WalletSelector } from "./WalletSelector";
import { PortfolioCard } from "./portfolio/PortfolioCard";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useEffect, useState, useCallback } from "react";
import { AptosPortfolioService } from "@/lib/services/aptos/portfolio";
import { Token } from "@/lib/types/token";
import { Logo } from "./ui/logo";
import { AlphaBadge } from "./ui/alpha-badge";
import { PositionsList as HyperionPositionsList } from "./protocols/hyperion/PositionsList";
import { PositionsList as EchelonPositionsList } from "./protocols/echelon/PositionsList";
import { PositionsList as AriesPositionsList } from "./protocols/aries/PositionsList";
import { PositionsList as JoulePositionsList } from "./protocols/joule/PositionsList";
import { PositionsList as TappPositionsList } from "./protocols/tapp/PositionsList";

export default function Sidebar() {
  const { account } = useWallet();
  const [tokens, setTokens] = useState<Token[]>([]);
  const [totalValue, setTotalValue] = useState<string>("0");
  const [hyperionValue, setHyperionValue] = useState<number>(0);
  const [echelonValue, setEchelonValue] = useState<number>(0);
  const [ariesValue, setAriesValue] = useState<number>(0);
  const [jouleValue, setJouleValue] = useState<number>(0);
  const [tappValue, setTappValue] = useState<number>(0);

  const updateTotalValue = useCallback(() => {
    const total = tokens.reduce((sum, token) => {
      const value = token.value ? parseFloat(token.value) : 0;
      return sum + (isNaN(value) ? 0 : value);
    }, 0);

    setTotalValue((total + hyperionValue + echelonValue + ariesValue + jouleValue + tappValue).toFixed(2));
  }, [tokens, hyperionValue, echelonValue, ariesValue, jouleValue, tappValue]);

  useEffect(() => {
    updateTotalValue();
  }, [updateTotalValue]);

  useEffect(() => {
    async function loadPortfolio() {
      if (!account?.address) return;

      try {
        const portfolioService = new AptosPortfolioService();
        const portfolio = await portfolioService.getPortfolio(account.address.toString());
        setTokens(portfolio.tokens);
      } catch (error) {
        console.error("Failed to load portfolio:", error);
      }
    }

    loadPortfolio();
  }, [account?.address]);

  // Обработчики изменения суммы позиций в протоколах
  const handleHyperionValueChange = useCallback((value: number) => {
    setHyperionValue(value);
  }, []);

  const handleEchelonValueChange = useCallback((value: number) => {
    setEchelonValue(value);
  }, []);

  const handleAriesValueChange = useCallback((value: number) => {
    setAriesValue(value);
  }, []);

  const handleJouleValueChange = useCallback((value: number) => {
    setJouleValue(value);
  }, []);

  const handleTappValueChange = useCallback((value: number) => {
    setTappValue(value);
  }, []);

  return (
    <div className="hidden md:flex w-[340px] p-4 border-r h-screen flex-col">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex flex-col items-start gap-1">
            <div className="flex items-center gap-2">
              <Logo size="md" />
              <h2 className="text-xl font-bold">Yield AI</h2>
            </div>
            <AlphaBadge />
          </div>
        </div>
        <WalletSelector />
      </div>
      <div className="flex-1 overflow-y-auto">
        {account?.address ? (
          <div className="mt-4 space-y-4">
            <PortfolioCard totalValue={totalValue} tokens={tokens} />
            {[
              { component: HyperionPositionsList, value: hyperionValue, name: 'Hyperion' },
              { component: EchelonPositionsList, value: echelonValue, name: 'Echelon' },
              { component: AriesPositionsList, value: ariesValue, name: 'Aries' },
              { component: JoulePositionsList, value: jouleValue, name: 'Joule' },
              { component: TappPositionsList, value: tappValue, name: 'Tapp Exchange' }
            ]
              .sort((a, b) => b.value - a.value)
              .map(({ component: Component, name }) => (
                <Component
                  key={name}
                  address={account.address.toString()}
                  onPositionsValueChange={
                    name === 'Hyperion' ? handleHyperionValueChange :
                    name === 'Echelon' ? handleEchelonValueChange :
                    name === 'Aries' ? handleAriesValueChange :
                    name === 'Joule' ? handleJouleValueChange :
                    handleTappValueChange
                  }
                />
              ))}
          </div>
        ) : (
          <div className="mt-4 p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">
              Connect your Aptos wallet to view your assets and positions in DeFi protocols
            </p>
          </div>
        )}
      </div>
    </div>
  );
} 