"use client";
import { WalletSelector } from "./WalletSelector";
import { PortfolioCard } from "./portfolio/PortfolioCard";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useEffect, useState, useCallback } from "react";
import { AptosPortfolioService } from "@/lib/services/aptos/portfolio";
import { Token } from "@/lib/types/token";
import { Logo } from "./ui/logo";
import { AlphaBadge } from "./ui/alpha-badge";
import { CollapsibleProvider } from "@/contexts/CollapsibleContext";
import { PositionsList as HyperionPositionsList } from "./protocols/hyperion/PositionsList";
import { PositionsList as EchelonPositionsList } from "./protocols/echelon/PositionsList";
import { PositionsList as AriesPositionsList } from "./protocols/aries/PositionsList";
import { PositionsList as JoulePositionsList } from "./protocols/joule/PositionsList";
import { PositionsList as TappPositionsList } from "./protocols/tapp/PositionsList";
import { PositionsList as MesoPositionsList } from "./protocols/meso/PositionsList";
import { PositionsList as AuroPositionsList } from "./protocols/auro/PositionsList";

export default function Sidebar() {
  const { account } = useWallet();
  const [tokens, setTokens] = useState<Token[]>([]);
  const [totalValue, setTotalValue] = useState(0);
  const [hyperionValue, setHyperionValue] = useState(0);
  const [echelonValue, setEchelonValue] = useState(0);
  const [ariesValue, setAriesValue] = useState(0);
  const [jouleValue, setJouleValue] = useState(0);
  const [tappValue, setTappValue] = useState(0);
  const [mesoValue, setMesoValue] = useState(0);
  const [auroValue, setAuroValue] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadPortfolio = useCallback(async () => {
    if (!account?.address) {
      setTokens([]);
      setTotalValue(0);
      return;
    }

    try {
      setIsRefreshing(true);
      const portfolioService = new AptosPortfolioService();
      const portfolio = await portfolioService.getPortfolio(account.address.toString());
      setTokens(portfolio.tokens);
      
      // Вычисляем общую стоимость из токенов
      const total = portfolio.tokens.reduce((sum, token) => {
        return sum + (token.value ? parseFloat(token.value) : 0);
      }, 0);
      setTotalValue(total);
    } catch (error) {
      console.error('Error loading portfolio:', error);
      setTokens([]);
      setTotalValue(0);
    } finally {
      setIsRefreshing(false);
    }
  }, [account?.address]);

  const handleRefresh = useCallback(async () => {
    await loadPortfolio();
    // Сбрасываем значения протоколов, чтобы они перезагрузились
    setHyperionValue(0);
    setEchelonValue(0);
    setAriesValue(0);
    setJouleValue(0);
    setTappValue(0);
    setMesoValue(0);
    setAuroValue(0);
  }, [loadPortfolio]);

  useEffect(() => {
    loadPortfolio();
  }, [loadPortfolio]);

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

  const handleMesoValueChange = useCallback((value: number) => {
    setMesoValue(value);
  }, []);

  const handleAuroValueChange = useCallback((value: number) => {
    setAuroValue(value);
  }, []);

  // Считаем сумму по кошельку
  const walletTotal = tokens.reduce((sum, token) => {
    const value = token.value ? parseFloat(token.value) : 0;
    return sum + (isNaN(value) ? 0 : value);
  }, 0);

  // Считаем сумму по всем протоколам
  const totalProtocolsValue = hyperionValue + echelonValue + ariesValue + jouleValue + tappValue + mesoValue + auroValue;

  // Итоговая сумма
  const totalAssets = walletTotal + totalProtocolsValue;

  return (
    <CollapsibleProvider>
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
              <PortfolioCard 
                totalValue={totalAssets.toString()} 
                tokens={tokens} 
                onRefresh={handleRefresh}
                isRefreshing={isRefreshing}
              />
              {[
                { component: HyperionPositionsList, value: hyperionValue, name: 'Hyperion' },
                { component: EchelonPositionsList, value: echelonValue, name: 'Echelon' },
                { component: AriesPositionsList, value: ariesValue, name: 'Aries' },
                { component: JoulePositionsList, value: jouleValue, name: 'Joule' },
                { component: TappPositionsList, value: tappValue, name: 'Tapp Exchange' },
                { component: MesoPositionsList, value: mesoValue, name: 'Meso Finance' },
                { component: AuroPositionsList, value: auroValue, name: 'Auro Finance' }
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
                      name === 'Tapp Exchange' ? handleTappValueChange :
                      name === 'Meso Finance' ? handleMesoValueChange :
                      name === 'Auro Finance' ? handleAuroValueChange :
                      undefined
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
    </CollapsibleProvider>
  );
} 