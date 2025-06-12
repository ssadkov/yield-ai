"use client";
import { WalletSelector } from "./WalletSelector";
import { PortfolioCard } from "./portfolio/PortfolioCard";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useEffect, useState } from "react";
import { AptosPortfolioService } from "@/lib/services/aptos/portfolio";
import { Token } from "@/lib/types/token";
import { Logo } from "./ui/logo";
import { PositionsList } from "./protocols/hyperion/PositionsList";

export default function Sidebar() {
  const { account } = useWallet();
  const [tokens, setTokens] = useState<Token[]>([]);
  const [totalValue, setTotalValue] = useState<string>("0");

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
        setTotalValue(total.toFixed(2));
      } catch (error) {
        console.error("Failed to load portfolio:", error);
      }
    }

    loadPortfolio();
  }, [account?.address]);

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
          <PositionsList address={account.address.toString()} />
        </div>
      )}
    </div>
  );
} 