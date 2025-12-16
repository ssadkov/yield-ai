"use client";
import { WalletSelector } from "./WalletSelector";
import { PortfolioPageCard } from "./portfolio/PortfolioPageCard";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from 'next/navigation';
import { AptosPortfolioService } from "@/lib/services/aptos/portfolio";
import { Token } from "@/lib/types/token";
import { Logo } from "./ui/logo";
import { AlphaBadge } from "./ui/alpha-badge";
import { Input } from "@/components/ui/input";
import { Button } from '@/components/ui/button';
import { PortfolioChart } from './chart/PortfolioChart';
import {  ArrowLeft, Wallet, DollarSign, RefreshCw, Search, Copy, ExternalLink } from 'lucide-react';
import { CollapsibleProvider } from "@/contexts/CollapsibleContext";
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
import { PositionsList as AavePositionsList } from "./protocols/aave/PositionsList";
import { PositionsList as MoarPositionsList } from "./protocols/moar/PositionsList";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAptosAddressResolver } from '@/lib/hooks/useAptosAddressResolver';
import { YieldCalculatorModal } from '@/components/ui/yield-calculator-modal';
import { useWalletStore } from "@/lib/stores/walletStore";

//import { styled } from 'styled-components';

export default function PortfolioPage() {

   useEffect(() => {
    const forceScroll = () => {
      if (window.innerWidth <= 767) {
        document.body.style.overflowY = 'auto';
      }
    };
    
    forceScroll();
    window.addEventListener('resize', forceScroll);
    
    return () => window.removeEventListener('resize', forceScroll);
  }, []);


  //const { account } = useWallet();
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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [checkingProtocols, setCheckingProtocols] = useState<string[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [addressInput, setAddressInput] = useState('');
  const [isYieldCalcOpen, setIsYieldCalcOpen] = useState(false);
  const setTotalAssetsStore = useWalletStore((s) => s.setTotalAssets);

  const params = useParams();
  const router = useRouter();
  const input = params?.address as string;
  
  const { resolvedAddress, resolvedName, isLoading, error } = useAptosAddressResolver(input);
  

  let account = null;
  // Позже присвойте значение
  account = { address: resolvedAddress };

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
  ];

  const resetChecking = useCallback(() => {
    setCheckingProtocols(allProtocolNames);
  }, []);
  
  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };
  
  const handleSearch = () => {
    if (addressInput.trim()) {
      router.push(`/portfolio/${addressInput}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const loadPortfolio = useCallback(async () => {
    if (!resolvedAddress) {
      setTokens([]);
      setTotalValue(0);
      return;
    }

    try {
      setIsRefreshing(true);
      const portfolioService = new AptosPortfolioService();
      const portfolio = await portfolioService.getPortfolio(resolvedAddress);
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
  }, [resolvedAddress]);

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
    resetChecking();
    setRefreshKey((k) => k + 1);
  }, [loadPortfolio, resetChecking]);

  useEffect(() => {
    loadPortfolio();
    // Initialize checking list when account changes
    if (resolvedAddress) {
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

  // Считаем сумму по кошельку
  const walletTotal = tokens.reduce((sum, token) => {
    const value = token.value ? parseFloat(token.value) : 0;
    return sum + (isNaN(value) ? 0 : value);
  }, 0);

  // Считаем сумму по всем протоколам
  const totalProtocolsValue = hyperionValue + echelonValue + ariesValue + jouleValue + tappValue + mesoValue + auroValue + amnisValue + earniumValue + aaveValue + moarValue;

  // Итоговая сумма
  const totalAssets = walletTotal + totalProtocolsValue;

  useEffect(() => {
    setTotalAssetsStore(totalAssets);
  }, [totalAssets, setTotalAssetsStore]);

  // Данные для чарта: кошелек + каждый протокол отдельным сектором
  const chartSectors = [
    { name: 'Wallet', value: walletTotal },
    { name: 'Hyperion', value: hyperionValue },
    { name: 'Echelon', value: echelonValue },
    { name: 'Aries', value: ariesValue },
    { name: 'Joule', value: jouleValue },
    { name: 'Tapp Exchange', value: tappValue },
    { name: 'Meso Finance', value: mesoValue },
    { name: 'Auro Finance', value: auroValue },
    { name: 'Amnis Finance', value: amnisValue },
    { name: 'Earnium', value: earniumValue },
    { name: 'Aave', value: aaveValue },
    { name: 'Moar Market', value: moarValue },
  ];

  return (
	<CollapsibleProvider>
	  <div className="container mx-auto px-4 py-8">

	    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="w-full">

	        <div className="max-w-4xl mx-auto space-y-6">
              
			  <div className="container mx-auto">
                <div className="mx-auto">
                  <div className="flex items-left">
                    <Button
                      variant="ghost"
                      onClick={() => router.push('/')}
                    >
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Yield AI Dashboard — manage your portfolio
                    </Button>
                  </div>
                </div>
              </div>

              <div className="min-h-screen to-slate-100 dark:from-slate-900 dark:to-slate-800">
                <div className="flex-1 overflow-y-auto m-4">
                  {resolvedAddress ? ( 
                    <>
                    
					<div className="mt-4 space-y-4"> 
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
                            <Wallet className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div>
                            <CardTitle className="text-xl pt-2 ml-2">Portfolio</CardTitle>
                          </div>
                        </div>
                        <Button 
                          variant="outline" 
                          onClick={() => setIsYieldCalcOpen(true)}
                          className="flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                          Yield Calculator
                        </Button>
                      </div>
			        </div>
					
					<div className="w-full mb-4 mt-2">
				      <div className="relative w-full">
			            <Input
				          value={addressInput}
					      onChange={(e) => setAddressInput(e.target.value)}
					      onKeyDown={handleKeyDown}
					      placeholder={input}
					      className="font-mono text-sm h-10 pr-10 w-full truncate"
				        />
					    <div className="absolute right-1 top-1 flex gap-1 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 overflow-hidden h-8">
					      <Button 
					        size="sm" 
					        variant="ghost" 
					        onClick={() => {
					          if (resolvedAddress) {
					            window.open(`https://explorer.aptoslabs.com/account/${resolvedAddress}`, '_blank');
					          }
					        }}
					        className="h-8 w-8 p-0 pb-3 cursor-pointer"
					        title="View on Aptos Explorer"
					      >
					        <ExternalLink className="h-4 w-4" />
					      </Button>
					      <Button 
					        size="sm" 
					        variant="ghost" 
					        onClick={() => {
					          if (resolvedAddress) {
					            navigator.clipboard.writeText(resolvedAddress);
					          }
					        }}
					        className="h-8 w-8 p-0 pb-3 cursor-pointer"
					        title="Copy address"
					      >
					        <Copy className="h-4 w-4" />
					      </Button>
					      <Button 
					        size="sm" 
					        variant="ghost" 
					        onClick={handleSearch}
					        className="h-8 w-8 p-0 pb-3 cursor-pointer"
					        title="Search"
					      >
					        <Search className="h-4 w-4" />
					      </Button>
					    </div>
				      </div>
			        </div>

				    {/* Display ANS name if available */}
				    {resolvedName && (
				      <div className="mt-2 px-2">
				        <div className="flex items-center gap-2 text-sm text-muted-foreground">
				          <span className="font-medium">ANS Name:</span>
				          <span className="font-mono bg-muted px-2 py-1 rounded text-foreground">
				            {resolvedName}.apt
				          </span>
				        </div>
				      </div>
				    )}

				    <div className="block lg:hidden mb-4">
				      <div className="h-58 flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 rounded p-20">
				        <PortfolioChart data={chartSectors} />
				      </div>
			      </div>

				    <div className="flex flex-col lg:flex-row gap-4">
				      <div className="flex-1">
                        <div className="mt-4 space-y-4">
                          <PortfolioPageCard 
                            totalValue={totalAssets.toString()} 
                            tokens={tokens} 
                            onRefresh={handleRefresh}
                            isRefreshing={isRefreshing}
                          />
                          {checkingProtocols.length > 0 && (
                            <div className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground">
                              <span>Checking positions on</span>
                              <div className="flex items-center gap-1">
                                {checkingProtocols.map((name) => {
                                  const proto = getProtocolByName(name);
                                  const logo = proto?.logoUrl;
                                  return (
                                    <img
                                      key={name}
                                      src={logo || "/favicon.ico"}
                                      alt={name}
                                      title={name}
                                      className="w-4 h-4 rounded-sm object-contain opacity-80"
                                    />
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          {[
                            { 
					          component: HyperionPositionsList, 
					          value: hyperionValue, 
					          name: 'Hyperion',
					          showManageButton: false
					        },
                            { 
					          component: EchelonPositionsList, 
					          value: echelonValue, 
					          name: 'Echelon',
					          showManageButton: false
					        },
                            { 
					          component: AriesPositionsList, 
					          value: ariesValue, 
					          name: 'Aries',
					          showManageButton: false
					        },
                            { 
					          component: JoulePositionsList, 
					          value: jouleValue, 
					          name: 'Joule',
					          showManageButton: false
					        },
                            { 
					          component: TappPositionsList, 
					          value: tappValue, 
					          name: 'Tapp Exchange',
					          showManageButton: false
					        },
                            { 
					          component: MesoPositionsList, 
					          value: mesoValue, 
					          name: 'Meso Finance',
					          showManageButton: false
					        },
                            { 
					          component: AuroPositionsList, 
					          value: auroValue, 
					          name: 'Auro Finance',
					          showManageButton: false
					        },
                            { 
					          component: AmnisPositionsList, 
					          value: amnisValue, 
					          name: 'Amnis Finance',
					          showManageButton: false
					        },
                            { 
					          component: EarniumPositionsList, 
					          value: earniumValue, 
					          name: 'Earnium',
					          showManageButton: false
					        },
                            { 
					          component: AavePositionsList, 
					          value: aaveValue, 
					          name: 'Aave',
					          showManageButton: false
					        },
                            { 
					          component: MoarPositionsList, 
					          value: moarValue, 
					          name: 'Moar Market',
					          showManageButton: false
					        },
                          ]
                          .sort((a, b) => b.value - a.value)
                          .map(({ component: Component, name }) => (
                            <Component
                              key={name}
                              address={resolvedAddress ?? ""}
                              walletTokens={tokens}
                              refreshKey={refreshKey}
						      showManageButton={false}
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
                                undefined
                              }
                              onPositionsCheckComplete={() =>
                                setCheckingProtocols((prev) => prev.filter((p) => p !== name))
                              }
                            />
                          ))}
                        </div>
				      </div>
                    </div>
                    </>
                  ) : (
                    <div className="mt-4 p-4 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground">
                        Enter a valid Aptos address to view portfolio
                      </p>
                    </div>
                  )}
                </div>
              </div>
			  
	        </div>

		  </div>
 
          <div className="w-full">
            
			<div className="hidden lg:block mb-4 mt-17">
			  <div className="h-[500px] flex items-center justify-center to-slate-100 dark:from-slate-900 dark:to-slate-800 rounded p-8">
				<PortfolioChart data={chartSectors} />
		      </div>
			
			</div>
			
          </div>
          
        </div>
	  </div>
      <YieldCalculatorModal 
        isOpen={isYieldCalcOpen}
        onClose={() => setIsYieldCalcOpen(false)}
        tokens={tokens}
        totalAssets={totalAssets}
        walletTotal={walletTotal}
      />
    </CollapsibleProvider>
  );
} 