"use client";
import { WalletSelector } from "./WalletSelector";
import { PortfolioCard } from "./portfolio/PortfolioCard";
import { SolanaWalletCard } from "./portfolio/SolanaWalletCard";
import { SolanaSignMessageButton } from "./SolanaSignMessageButton";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useEffect, useState, useCallback } from "react";
import { useAptosNativeRestore } from "@/hooks/useAptosNativeRestore";
import { AptosPortfolioService } from "@/lib/services/aptos/portfolio";
import { Token } from "@/lib/types/token";
import { Logo } from "./ui/logo";
import { AlphaBadge } from "./ui/alpha-badge";
import { CollapsibleProvider } from "@/contexts/CollapsibleContext";
import { useWalletStore } from "@/lib/stores/walletStore";
import { getProtocolByName } from "@/lib/protocols/getProtocolsList";
import { PositionsList as HyperionPositionsList } from "./protocols/hyperion/PositionsList";
import { PositionsList as EchelonPositionsList } from "./protocols/echelon/PositionsList";
import { PositionsList as AriesPositionsList } from "./protocols/aries/PositionsList";
import { PositionsList as JoulePositionsList } from "./protocols/joule/PositionsList";
import { PositionsList as TappPositionsList } from "./protocols/tapp/PositionsList";
import { PositionsList as MesoPositionsList } from "./protocols/meso/PositionsList";
import { PositionsList as AuroPositionsList } from "./protocols/auro/PositionsList";
import { PositionsList as AmnisPositionsList } from "./protocols/amnis/PositionsList";
import { PositionsList as EarniumPositionsList } from "./protocols/earnium/PositionsList";
import { PositionsList as MoarPositionsList } from "./protocols/moar/PositionsList";
import { PositionsList as AavePositionsList } from "./protocols/aave/PositionsList";
import { PositionsList as ThalaPositionsList } from "./protocols/thala/PositionsList";
import { PositionsList as EchoPositionsList } from "./protocols/echo/PositionsList";
import { PositionsList as DecibelPositionsList } from "./protocols/decibel/PositionsList";
import { useSolanaPortfolio } from "@/hooks/useSolanaPortfolio";
import { ProtocolIcon } from "@/shared/ProtocolIcon/ProtocolIcon";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { RefreshCw } from "lucide-react";
import { CollapsibleControls } from "@/components/ui/collapsible-controls";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/numberFormat";

export default function Sidebar() {
  // Use native restore hook to ensure native Aptos wallets are reconnected
  const { account } = useAptosNativeRestore();
  // Also keep useWallet for other functionality
  useWallet(); // Keep adapter state synced
  const {
    address: solanaAddress,
    tokens: solanaTokens,
    totalValueUsd: solanaTotalValue,
    isLoading: isSolanaLoading,
    refresh: refreshSolana,
  } = useSolanaPortfolio();
  const [tokens, setTokens] = useState<Token[]>([]);
  const [totalValue, setTotalValue] = useState(0);
  const [hyperionValue, setHyperionValue] = useState(0);
  const [echelonValue, setEchelonValue] = useState(0);
  const [ariesValue, setAriesValue] = useState(0);
  const [jouleValue, setJouleValue] = useState(0);
  const [tappValue, setTappValue] = useState(0);
  const [mesoValue, setMesoValue] = useState(0);
  const [auroValue, setAuroValue] = useState(0);
  const [amnisValue, setAmnisValue] = useState(0);
  const [earniumValue, setEarniumValue] = useState(0);
  const [aaveValue, setAaveValue] = useState(0);
  const [moarValue, setMoarValue] = useState(0);
  const [thalaValue, setThalaValue] = useState(0);
  const [echoValue, setEchoValue] = useState(0);
  const [decibelValue, setDecibelValue] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [checkingProtocols, setCheckingProtocols] = useState<string[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const setTotalAssetsStore = useWalletStore((s) => s.setTotalAssets);

  const allProtocolNames = [
    "Hyperion",
    "Echelon",
    "Aries",
    "Joule",
    "Tapp Exchange",
    "Meso Finance",
    "Auro Finance",
    "Amnis Finance",
    "Earnium",
    "Aave",
    "Moar Market",
    "Thala",
	"Echo Protocol",
    "Decibel",
  ];

  const resetChecking = useCallback(() => {
    setCheckingProtocols(allProtocolNames);
  }, []);

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
    setAmnisValue(0);
    setEarniumValue(0);
    setAaveValue(0);
    setThalaValue(0);
	setEchoValue(0);
    setDecibelValue(0);
    resetChecking();
    setRefreshKey((k) => k + 1);
  }, [loadPortfolio, resetChecking]);

  useEffect(() => {
    loadPortfolio();
    // Initialize checking list when account changes
    if (account?.address) {
      resetChecking();
    } else {
      setCheckingProtocols([]);
    }
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

  const handleAmnisValueChange = useCallback((value: number) => {
    setAmnisValue(value);
  }, []);
  const handleEarniumValueChange = useCallback((value: number) => {
    setEarniumValue(value);
  }, []);

  const handleAaveValueChange = useCallback((value: number) => {
    setAaveValue(value);
  }, []);

  const handleMoarValueChange = useCallback((value: number) => {
    setMoarValue(value);
  }, []);
  const handleThalaValueChange = useCallback((value: number) => {
    setThalaValue(value);
  }, []);
  const handleEchoValueChange = useCallback((value: number) => {
    setEchoValue(value);
  }, []);
  const handleDecibelValueChange = useCallback((value: number) => {
    setDecibelValue(value);
  }, []);

  // Считаем сумму по кошельку
  const walletTotal = tokens.reduce((sum, token) => {
    const value = token.value ? parseFloat(token.value) : 0;
    return sum + (isNaN(value) ? 0 : value);
  }, 0);

  // Считаем сумму по всем протоколам
  const totalProtocolsValue = hyperionValue + echelonValue + ariesValue + jouleValue + tappValue + mesoValue + auroValue + amnisValue + earniumValue + aaveValue + moarValue + thalaValue + echoValue;

  // Итоговая сумма
  const totalAssets = walletTotal + totalProtocolsValue;

  useEffect(() => {
    setTotalAssetsStore(totalAssets);
  }, [totalAssets, setTotalAssetsStore]);

  // Shared UI state: hide assets <1$ for all wallets (Aptos + Solana)
  const [hideSmallAssets, setHideSmallAssets] = useState(true);

  const hasAnyWalletCard = Boolean(account?.address || solanaAddress);

  const handleGlobalRefresh = useCallback(async () => {
    // Обновляем Aptos-портфель (если есть) и Solana-портфель
    if (account?.address) {
      await handleRefresh();
    }
    await refreshSolana();
  }, [account?.address, handleRefresh, refreshSolana]);

  return (
    <CollapsibleProvider>
      <div className="hidden md:flex w-[360px] p-4 border-r h-screen flex-col">
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
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          <div className="mt-4 space-y-4">
            {hasAnyWalletCard && (
              <div className="flex items-center justify-between mb-2">
                <span className="text-lg font-medium">Total Assets</span>
                <span className="text-lg font-medium">
                  {formatCurrency(
                    (account?.address ? totalAssets : 0) + (solanaAddress ? (solanaTotalValue ?? 0) : 0),
                    2
                  )}
                </span>
              </div>
            )}
            {hasAnyWalletCard && (
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="hideSmallAssetsGlobal"
                    checked={hideSmallAssets}
                    onCheckedChange={(checked) => setHideSmallAssets(!!checked)}
                  />
                  <Label htmlFor="hideSmallAssetsGlobal" className="text-sm">
                    Hide assets {'<'}1$
                  </Label>
                </div>
                <div className="flex items-center gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleGlobalRefresh}
                        disabled={isRefreshing || isSolanaLoading}
                        className="h-4 w-4 p-0 text-muted-foreground hover:bg-transparent hover:text-foreground/60 opacity-80 transition-colors"
                      >
                        <RefreshCw
                          className={cn(
                            "h-3 w-3",
                            (isRefreshing || isSolanaLoading) && "animate-spin"
                          )}
                        />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Refresh Aptos & Solana</p>
                    </TooltipContent>
                  </Tooltip>
                  <CollapsibleControls />
                </div>
              </div>
            )}

            {/* Aptos-портфель и протоколы — только если есть Aptos-аккаунт */}
            {account?.address ? (
              <div className="space-y-4">
                <PortfolioCard 
                  totalValue={totalAssets.toString()} 
                  tokens={tokens} 
                  onRefresh={handleRefresh}
                  isRefreshing={isRefreshing}
                  hasSolanaWallet={!!solanaAddress}
                  hideSmallAssets={hideSmallAssets}
                  onHideSmallAssetsChange={setHideSmallAssets}
                  showHeaderControls={false}
                />
                {checkingProtocols.length > 0 && (
                  <div className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground">
                    <span className="whitespace-nowrap">Checking positions on</span>
                    <div className="flex items-center gap-1">
                      {checkingProtocols.map((name) => {
                        const proto = getProtocolByName(name);
                        const logo = proto?.logoUrl || "/favicon.ico";
                        return (
                          <ProtocolIcon
                            key={name}
                            logoUrl={logo}
                            name={name}
                            size="sm"
                            isLoading={true}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}
                {[
                  { component: HyperionPositionsList, value: hyperionValue, name: 'Hyperion' },
                  { component: EchelonPositionsList, value: echelonValue, name: 'Echelon' },
                  { component: AriesPositionsList, value: ariesValue, name: 'Aries' },
                  { component: JoulePositionsList, value: jouleValue, name: 'Joule' },
                  { component: TappPositionsList, value: tappValue, name: 'Tapp Exchange' },
                  { component: MesoPositionsList, value: mesoValue, name: 'Meso Finance' },
                  { component: AuroPositionsList, value: auroValue, name: 'Auro Finance' },
                  { component: AmnisPositionsList, value: amnisValue, name: 'Amnis Finance' },
                  { component: EarniumPositionsList, value: earniumValue, name: 'Earnium' },
                  { component: AavePositionsList, value: aaveValue, name: 'Aave' },
                  { component: MoarPositionsList, value: moarValue, name: 'Moar Market' },
                  { component: ThalaPositionsList, value: thalaValue, name: 'Thala' },
				  { component: EchoPositionsList, value: echoValue, name: 'Echo Protocol' },
                  { component: DecibelPositionsList, value: decibelValue, name: 'Decibel' },
                ]
                  .sort((a, b) => b.value - a.value)
                  .map(({ component: Component, name }) => (
                    <Component
                      key={name}
                      address={account!.address.toString()}
                      walletTokens={tokens}
                      refreshKey={refreshKey}
                      onPositionsValueChange={
                        name === 'Hyperion' ? handleHyperionValueChange :
                        name === 'Echelon' ? handleEchelonValueChange :
                        name === 'Aries' ? handleAriesValueChange :
                        name === 'Joule' ? handleJouleValueChange :
                        name === 'Tapp Exchange' ? handleTappValueChange :
                        name === 'Meso Finance' ? handleMesoValueChange :
                        name === 'Auro Finance' ? handleAuroValueChange :
                        name === 'Amnis Finance' ? handleAmnisValueChange :
                        name === 'Earnium' ? handleEarniumValueChange :
                        name === 'Aave' ? handleAaveValueChange :
                        name === 'Moar Market' ? handleMoarValueChange :
                        name === 'Thala' ? handleThalaValueChange :
						name === 'Echo Protocol' ? handleEchoValueChange :
                        name === 'Decibel' ? handleDecibelValueChange :
                        undefined
                      }
                      onPositionsCheckComplete={() =>
                        setCheckingProtocols((prev) => prev.filter((p) => p !== name))
                      }
                    />
                  ))}
              </div>
            ) : (
              <div className="mt-4 p-4 bg-muted rounded-lg space-y-2">
                <p className="text-sm text-muted-foreground">
                  Connect your Aptos wallet to view your assets and positions in DeFi protocols
                </p>
              </div>
            )}

            {/* Solana должна отображаться независимо от Aptos-аккаунта */}
            {solanaAddress && (
              <div className="space-y-2">
                <SolanaWalletCard
                  tokens={solanaTokens}
                  totalValueUsd={solanaTotalValue}
                  onRefresh={refreshSolana}
                  isRefreshing={isSolanaLoading}
                  hideSmallAssets={hideSmallAssets}
                />
                <SolanaSignMessageButton />
              </div>
            )}
          </div>
        </div>
      </div>
    </CollapsibleProvider>
  );
} 