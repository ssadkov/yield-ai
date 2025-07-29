import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AptosWalletService } from "@/lib/services/aptos/wallet";
import { AptosPortfolioService } from "@/lib/services/aptos/portfolio";
import { PortfolioCard } from "@/components/portfolio/PortfolioCard";
import { Token } from "@/lib/types/token";

export function WalletConnect() {
  const [address, setAddress] = useState<string | null>(null);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [totalValue, setTotalValue] = useState<string>("0");

  const handleConnect = async () => {
    try {
      console.log("Connecting wallet...");
      const walletService = AptosWalletService.getInstance();
      const connectedAddress = await walletService.connect();
      console.log("Connected address:", connectedAddress);
      setAddress(connectedAddress);

      // Загружаем портфолио после подключения
      console.log("Loading portfolio...");
      const portfolioService = new AptosPortfolioService();
      const portfolio = await portfolioService.getPortfolio(connectedAddress);
      console.log("Portfolio loaded:", portfolio);
      
      // Считаем общую стоимость
      const total = portfolio.tokens.reduce((sum, token) => {
        return sum + (token.value ? parseFloat(token.value) : 0);
      }, 0);
      console.log("Total value:", total);

      setTokens(portfolio.tokens);
      setTotalValue(total.toFixed(2));
    } catch (error) {
      console.error("Failed to connect wallet:", error);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Button onClick={handleConnect}>
        {address ? `Connected: ${address.slice(0, 6)}...${address.slice(-4)}` : "Connect Wallet"}
      </Button>
      
      {address && (
        <>
          <div>Debug: {tokens.length} tokens, total: ${totalValue}</div>
          <PortfolioCard totalValue={totalValue} tokens={tokens} />
        </>
      )}
    </div>
  );
} 