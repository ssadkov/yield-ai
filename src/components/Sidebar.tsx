"use client";
import { WalletSelector } from "./WalletSelector";
import { PortfolioCard } from "./portfolio/PortfolioCard";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useEffect, useState, useCallback } from "react";
import { AptosPortfolioService } from "@/lib/services/aptos/portfolio";
import { Token } from "@/lib/types/token";
import { Logo } from "./ui/logo";
import { PositionsList as HyperionPositionsList } from "./protocols/hyperion/PositionsList";
import { PositionsList as EchelonPositionsList } from "./protocols/echelon/PositionsList";
import { PositionsList as AriesPositionsList } from "./protocols/aries/PositionsList";
import { PositionsList as JoulePositionsList } from "./protocols/joule/PositionsList";

export default function Sidebar() {
  const { account } = useWallet();
  const [tokens, setTokens] = useState<Token[]>([]);
  const [totalValue, setTotalValue] = useState<string>("0");
  const [hyperionValue, setHyperionValue] = useState<number>(0);
  const [echelonValue, setEchelonValue] = useState<number>(0);
  const [ariesValue, setAriesValue] = useState<number>(0);
  const [jouleValue, setJouleValue] = useState<number>(0);

  const updateTotalValue = useCallback(() => {
    const total = tokens.reduce((sum, token) => {
      const value = token.value ? parseFloat(token.value) : 0;
      return sum + (isNaN(value) ? 0 : value);
    }, 0);

    setTotalValue((total + hyperionValue + echelonValue + ariesValue + jouleValue).toFixed(2));
  }, [tokens, hyperionValue, echelonValue, ariesValue, jouleValue]);

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

  return (
    <div className="w-[340px] p-4 border-r">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Logo size="md" />
          <h2 className="text-xl font-bold">Yield AI</h2>
        </div>
        <WalletSelector />
      </div>
      {account?.address && (
        <div className="mt-4 space-y-4">
          <PortfolioCard totalValue={totalValue} tokens={tokens} />
          {[
            { component: HyperionPositionsList, value: hyperionValue, name: 'Hyperion' },
            { component: EchelonPositionsList, value: echelonValue, name: 'Echelon' },
            { component: AriesPositionsList, value: ariesValue, name: 'Aries' },
            { component: JoulePositionsList, value: jouleValue, name: 'Joule' }
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
                  handleJouleValueChange
                }
              />
            ))}
        </div>
      )}
    </div>
  );
} 