'use client';

import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { InvestmentData, InvestmentAction } from '@/types/investments';
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import tokenList from "@/lib/data/tokenList.json";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { ExternalLink } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { DepositButton } from "@/components/ui/deposit-button";
import { getProtocolByName } from "@/lib/protocols/getProtocolsList";
import Image from "next/image";
import { ManagePositions } from "./protocols/manage-positions/ManagePositions";
import { Protocol } from "@/lib/protocols/getProtocolsList";
import { ManagePositionsButton } from "@/components/protocols/ManagePositionsButton";
import { useProtocol } from "@/lib/contexts/ProtocolContext";
import { useDragDrop } from "@/contexts/DragDropContext";
import { DragData } from "@/types/dragDrop";
import { cn } from "@/lib/utils";

// Список адресов токенов Echelon, которые нужно исключить из отображения
const EXCLUDED_ECHELON_TOKENS = [
  "0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::USDT",
  "0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::USDC",
  "0x2b3be0a97a73c87ff62cbdd36837a9fb5bbd1d7f06a73b7ed62ec15c5326c1b8",
  "0x5e156f1207d0ebfa19a9eeff00d62a282278fb8719f4fab3a586a0a2c0fffbea::coin::T",
  "0x54fc0d5fa5ad975ede1bf8b1c892ae018745a1afd4a4da9b70bb6e5448509fc0"
];

interface InvestmentsDashboardProps {
  className?: string;
}

interface Token {
  chainId: number;
  panoraId: string;
  tokenAddress: string;
  faAddress: string;
  name: string;
  symbol: string;
  decimals: number;
  bridge: null;
  panoraSymbol: string;
  usdPrice: string;
  isBanned: boolean;
  logoUrl?: string;
}

export function InvestmentsDashboard({ className }: InvestmentsDashboardProps) {
  const [data, setData] = useState<InvestmentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showOnlyStablePools, setShowOnlyStablePools] = useState(true);
  const [activeTab, setActiveTab] = useState<"lite" | "pro">("lite");
  const { selectedProtocol, setSelectedProtocol } = useProtocol();
  const { state, validateDrop, handleDrop } = useDragDrop();

  const getTokenInfo = (asset: string, tokenAddress?: string): Token | undefined => {
    if (tokenAddress) {
      return (tokenList.data.data as Token[]).find(token => 
        token.tokenAddress === tokenAddress || token.faAddress === tokenAddress
      );
    }
    return undefined;
  };

  const getProvider = (item: InvestmentData): string => {
    if (item.provider !== 'Unknown') return item.provider;
    
    const tokenInfo = getTokenInfo(item.asset, item.token);
    return tokenInfo?.bridge || 'Unknown';
  };

  const isStablePool = (item: InvestmentData): boolean => {
    // Лендинговые пулы всегда считаются стабильными
    if (item.protocol !== 'Hyperion') {
      return true;
    }
    
    // Для DEX-пулов Hyperion проверяем совпадающие символы
    if (item.token1Info && item.token2Info) {
      const symbol1 = item.token1Info.symbol.toLowerCase();
      const symbol2 = item.token2Info.symbol.toLowerCase();
      
      // Ищем совпадающие символы (минимум 3 символа подряд)
      for (let i = 0; i <= symbol1.length - 3; i++) {
        const substring = symbol1.substring(i, i + 3);
        if (symbol2.includes(substring)) {
          return true;
        }
      }
    }
    
    return false;
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch('/api/aptos/pools');
        if (!response.ok) {
          throw new Error('Failed to fetch data');
        }
        const result = await response.json();
        setData(result.data || []);
      } catch (error) {
        console.error('Error fetching investment data:', error);
        setError('Failed to load investment opportunities');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleDragOver = (e: React.DragEvent, investment: InvestmentData) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragLeave = () => {
    // Убираем эту логику, так как подсветка теперь глобальная
  };

  const handleDropEvent = (e: React.DragEvent, investment: InvestmentData) => {
    e.preventDefault();
    
    try {
      const dragData = JSON.parse(e.dataTransfer.getData('application/json')) as DragData;
      handleDrop(dragData, investment);
    } catch (error) {
      console.error('Error parsing drag data:', error);
    }
  };

  const getDropZoneClassName = (investment: InvestmentData) => {
    if (!state.dragData) {
      return "transition-colors hover:bg-accent/50";
    }

    const validation = validateDrop(state.dragData, investment);
    
    if (validation.isValid) {
      return "transition-colors bg-green-50 border-green-200 hover:bg-green-100";
    } else {
      return "transition-colors bg-red-50 border-red-200 hover:bg-red-100";
    }
  };

  const topInvestments = [...data]
    .sort((a, b) => b.totalAPY - a.totalAPY)
    .slice(0, 3);

  const filteredData = data.filter(item => {
    // Фильтруем исключенные токены Echelon
    if (item.protocol === 'Echelon' && EXCLUDED_ECHELON_TOKENS.includes(item.token)) {
      return false;
    }
    
    // Фильтруем по стабильным пулам, если включен чекбокс
    if (showOnlyStablePools && !isStablePool(item)) {
      return false;
    }
    
    const tokenInfo = getTokenInfo(item.asset, item.token);
    const displaySymbol = tokenInfo?.symbol || item.asset;
    return displaySymbol.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Данные для текущей вкладки
  const currentTabData = activeTab === "lite" 
    ? data.filter(item => {
        // Фильтруем исключенные токены Echelon
        if (item.protocol === 'Echelon' && EXCLUDED_ECHELON_TOKENS.includes(item.token)) {
          return false;
        }
        
        // Показываем только протоколы с нативным депозитом в Lite вкладке
        const protocol = getProtocolByName(item.protocol);
        if (!protocol || protocol.depositType !== 'native') {
          return false;
        }
        
        const tokenInfo = getTokenInfo(item.asset, item.token);
        const displaySymbol = tokenInfo?.symbol || item.asset;
        return displaySymbol.toLowerCase().includes(searchQuery.toLowerCase());
      })
    : filteredData; // В Pro вкладке используем все отфильтрованные данные

  const handleManageClick = (protocol: Protocol) => {
    console.log('Selected protocol:', protocol);
    setSelectedProtocol(protocol);
  };

  if (error) {
    return (
      <div className="text-center p-4 text-red-500">
        {error}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader className="space-y-2">
                <Skeleton className="h-4 w-[250px]" />
                <Skeleton className="h-4 w-[100px]" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-[100px] mb-2" />
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {selectedProtocol && (
        <ManagePositions 
          protocol={selectedProtocol} 
          onClose={() => setSelectedProtocol(null)} 
        />
      )}

      <div className="mb-4 pl-4">
        <h2 className="text-2xl font-bold">Ideas</h2>
      </div>
      <Tabs defaultValue="lite" className="w-full" onValueChange={(value) => setActiveTab(value as "lite" | "pro")}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="lite">Lite</TabsTrigger>
          <TabsTrigger value="pro">Pro</TabsTrigger>
        </TabsList>

        <TabsContent value="lite" className="mt-6">
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">Stables</h3>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {data
                  .filter(item => {
                    // Фильтруем исключенные токены Echelon
                    if (item.protocol === 'Echelon' && EXCLUDED_ECHELON_TOKENS.includes(item.token)) {
                      return false;
                    }
                    // Показываем только протоколы с нативным депозитом в Lite вкладке
                    const protocol = getProtocolByName(item.protocol);
                    if (!protocol || protocol.depositType !== 'native') {
                      return false;
                    }
                    return item.asset.toUpperCase().includes('USDT') || 
                           item.asset.toUpperCase().includes('USDC') ||
                           item.asset.toUpperCase().includes('DAI');
                  })
                  .sort((a, b) => b.totalAPY - a.totalAPY)
                  .slice(0, 3)
                  .map((item, index) => {
                    const tokenInfo = getTokenInfo(item.asset, item.token);
                    const displaySymbol = tokenInfo?.symbol || item.asset;
                    const logoUrl = tokenInfo?.logoUrl;
                    const protocol = getProtocolByName(item.protocol);

                    // Check if this is a DEX pool with two tokens
                    const isDex = !!(item.token1Info && item.token2Info);

                    return (
                      <Card 
                        key={index}
                        className={cn("border-2", getDropZoneClassName(item))}
                        onDragOver={(e) => handleDragOver(e, item)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDropEvent(e, item)}
                      >
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <div className="flex items-center gap-2">
                                    {isDex ? (
                                      // DEX pool display with two tokens
                                      <div className="flex items-center gap-2">
                                        <div className="flex">
                                          {item.token1Info?.logoUrl && (
                                            <Avatar className="w-6 h-6">
                                              <img 
                                                src={item.token1Info.logoUrl} 
                                                alt={item.token1Info.symbol} 
                                                className="object-contain" 
                                              />
                                            </Avatar>
                                          )}
                                          {item.token2Info?.logoUrl && (
                                            <Avatar className="w-6 h-6 -ml-2">
                                              <img 
                                                src={item.token2Info.logoUrl} 
                                                alt={item.token2Info.symbol} 
                                                className="object-contain" 
                                              />
                                            </Avatar>
                                          )}
                                        </div>
                                        <span>{item.token1Info?.symbol || '-'}</span>
                                        <span className="text-gray-400">/</span>
                                        <span>{item.token2Info?.symbol || '-'}</span>
                                      </div>
                                    ) : (
                                      // Lending pool display (existing logic)
                                      <>
                                        {logoUrl && (
                                          <div className="w-6 h-6 relative">
                                            <Image 
                                              src={logoUrl} 
                                              alt={displaySymbol}
                                              width={24}
                                              height={24}
                                              className="object-contain"
                                            />
                                          </div>
                                        )}
                                        <span>{displaySymbol}</span>
                                      </>
                                    )}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <div className="space-y-1">
                                    <p className="font-medium">Token Info</p>
                                    <p className="text-xs">Address: {item.token}</p>
                                    {isDex ? (
                                      // DEX tooltip content
                                      <>
                                        <p className="text-xs">Type: DEX Pool</p>
                                        <p className="text-xs">Token 1: {item.token1Info?.symbol} ({item.token1Info?.name})</p>
                                        <p className="text-xs">Token 2: {item.token2Info?.symbol} ({item.token2Info?.name})</p>
                                        {item.dailyVolumeUSD && (
                                          <p className="text-xs">Volume: ${item.dailyVolumeUSD.toLocaleString()}</p>
                                        )}
                                        {item.tvlUSD && (
                                          <p className="text-xs">TVL: ${item.tvlUSD.toLocaleString()}</p>
                                        )}
                                      </>
                                    ) : (
                                      // Lending tooltip content (existing logic)
                                      tokenInfo && (
                                        <>
                                          <p className="text-xs">Name: {tokenInfo.name}</p>
                                          <p className="text-xs">Symbol: {tokenInfo.symbol}</p>
                                          <p className="text-xs">Price: ${tokenInfo.usdPrice}</p>
                                        </>
                                      )
                                    )}
                                    <p className="text-xs">Provider: {getProvider(item)}</p>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <Badge variant="outline">{item.protocol}</Badge>
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">{item.totalAPY?.toFixed(2) || "0.00"}%</div>
                          <p className="text-xs text-muted-foreground">Total APY</p>
                          <DepositButton 
                            protocol={protocol!} 
                            className="mt-4 w-full"
                            tokenIn={{
                              symbol: isDex ? (item.token1Info?.symbol || 'Unknown') : displaySymbol,
                              logo: isDex ? (item.token1Info?.logoUrl || '') : (tokenInfo?.logoUrl || ''),
                              decimals: isDex ? (item.token1Info?.decimals || 8) : (tokenInfo?.decimals || 8),
                              address: item.token
                            }}
                            balance={BigInt(1000000000)} // TODO: Get real balance
                            priceUSD={Number(tokenInfo?.usdPrice || 0)}
                          />
                        </CardContent>
                      </Card>
                    );
                  })}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4">Fundamentals</h3>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[
                  { symbol: 'APT', exact: false },
                  { symbol: 'BTC', exact: false },
                  { symbol: 'ETH', exact: false }
                ].map(({ symbol, exact }) => {

                  const bestPool = data
                    .filter(item => {
                      // Показываем только протоколы с нативным депозитом в Lite вкладке
                      const protocol = getProtocolByName(item.protocol);
                      if (!protocol || protocol.depositType !== 'native') {
                        return false;
                      }
                      return exact 
                        ? item.asset.toUpperCase() === symbol
                        : item.asset.toUpperCase().includes(symbol);
                    })
                    .sort((a, b) => b.totalAPY - a.totalAPY)[0];

                  if (!bestPool) return null;

                  const tokenInfo = getTokenInfo(bestPool.asset, bestPool.token);
                  const displaySymbol = tokenInfo?.symbol || bestPool.asset;
                  const logoUrl = tokenInfo?.logoUrl;
                  const protocol = getProtocolByName(bestPool.protocol);

                  // Check if this is a DEX pool with two tokens
                  const isDex = !!(bestPool.token1Info && bestPool.token2Info);

                  return (
                    <Card 
                      key={symbol}
                      className={cn("border-2", getDropZoneClassName(bestPool))}
                      onDragOver={(e) => handleDragOver(e, bestPool)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDropEvent(e, bestPool)}
                    >
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <div className="flex items-center gap-2">
                                  {isDex ? (
                                    // DEX pool display with two tokens
                                    <div className="flex items-center gap-2">
                                      <div className="flex">
                                        {bestPool.token1Info?.logoUrl && (
                                          <Avatar className="w-6 h-6">
                                            <img 
                                              src={bestPool.token1Info.logoUrl} 
                                              alt={bestPool.token1Info.symbol} 
                                              className="object-contain" 
                                            />
                                          </Avatar>
                                        )}
                                        {bestPool.token2Info?.logoUrl && (
                                          <Avatar className="w-6 h-6 -ml-2">
                                            <img 
                                              src={bestPool.token2Info.logoUrl} 
                                              alt={bestPool.token2Info.symbol} 
                                              className="object-contain" 
                                            />
                                          </Avatar>
                                        )}
                                      </div>
                                      <span>{bestPool.token1Info?.symbol || '-'}</span>
                                      <span className="text-gray-400">/</span>
                                      <span>{bestPool.token2Info?.symbol || '-'}</span>
                                    </div>
                                  ) : (
                                    // Lending pool display (existing logic)
                                    <>
                                      {logoUrl && (
                                        <div className="w-6 h-6 relative">
                                          <Image 
                                            src={logoUrl} 
                                            alt={displaySymbol}
                                            width={24}
                                            height={24}
                                            className="object-contain"
                                          />
                                        </div>
                                      )}
                                      <span>{displaySymbol}</span>
                                    </>
                                  )}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="space-y-1">
                                  <p className="font-medium">Token Info</p>
                                  <p className="text-xs">Address: {bestPool.token}</p>
                                  {isDex ? (
                                    // DEX tooltip content
                                    <>
                                      <p className="text-xs">Type: DEX Pool</p>
                                      <p className="text-xs">Token 1: {bestPool.token1Info?.symbol} ({bestPool.token1Info?.name})</p>
                                      <p className="text-xs">Token 2: {bestPool.token2Info?.symbol} ({bestPool.token2Info?.name})</p>
                                      {bestPool.dailyVolumeUSD && (
                                        <p className="text-xs">Volume: ${bestPool.dailyVolumeUSD.toLocaleString()}</p>
                                      )}
                                      {bestPool.tvlUSD && (
                                        <p className="text-xs">TVL: ${bestPool.tvlUSD.toLocaleString()}</p>
                                      )}
                                    </>
                                  ) : (
                                    // Lending tooltip content (existing logic)
                                    tokenInfo && (
                                      <>
                                        <p className="text-xs">Name: {tokenInfo.name}</p>
                                        <p className="text-xs">Symbol: {tokenInfo.symbol}</p>
                                        <p className="text-xs">Price: ${tokenInfo.usdPrice}</p>
                                      </>
                                    )
                                  )}
                                  <p className="text-xs">Provider: {getProvider(bestPool)}</p>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <Badge variant="outline">{bestPool.protocol}</Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{bestPool.totalAPY?.toFixed(2) || "0.00"}%</div>
                        <p className="text-xs text-muted-foreground">Total APY</p>
                        <DepositButton 
                          protocol={protocol!} 
                          className="mt-4 w-full"
                          tokenIn={{
                            symbol: isDex ? (bestPool.token1Info?.symbol || 'Unknown') : displaySymbol,
                            logo: isDex ? (bestPool.token1Info?.logoUrl || '') : (tokenInfo?.logoUrl || ''),
                            decimals: isDex ? (bestPool.token1Info?.decimals || 8) : (tokenInfo?.decimals || 8),
                            address: bestPool.token
                          }}
                          balance={BigInt(1000000000)} // TODO: Get real balance
                          priceUSD={Number(tokenInfo?.usdPrice || 0)}
                        />
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="pro" className="mt-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tokens..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
            <div className="flex gap-1">
              {['USD', 'APT', 'BTC', 'ETH'].map((token) => (
                <Button
                  key={token}
                  variant="outline"
                  size="sm"
                  onClick={() => setSearchQuery(token)}
                  className="h-9 px-2"
                >
                  {token}
                </Button>
              ))}
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="stable-pools"
                checked={showOnlyStablePools}
                onCheckedChange={(checked) => setShowOnlyStablePools(checked as boolean)}
              />
              <label
                htmlFor="stable-pools"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Show only stable pools
              </label>
            </div>
          </div>
          
          <TooltipProvider>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Token</TableHead>
                  <TableHead>Protocol</TableHead>
                  <TableHead>
                    <Tooltip>
                      <TooltipTrigger>Supply APY</TooltipTrigger>
                      <TooltipContent>Annual % yield from supply</TooltipContent>
                    </Tooltip>
                  </TableHead>
                  <TableHead>
                    <Tooltip>
                      <TooltipTrigger>Borrow APY</TooltipTrigger>
                      <TooltipContent>Annual % cost or reward from borrowing</TooltipContent>
                    </Tooltip>
                  </TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentTabData
                  .filter(item => {
                    const tokenInfo = getTokenInfo(item.asset, item.token);
                    // Включаем все пулы: с tokenInfo, с :: в asset, или DEX-пулы с token1Info/token2Info
                    return item.asset.includes('::') || tokenInfo || (item.token1Info && item.token2Info);
                  })
                  .sort((a, b) => b.totalAPY - a.totalAPY)
                  .map((item, index) => {
                    const tokenInfo = getTokenInfo(item.asset, item.token);
                    const displaySymbol = tokenInfo?.symbol || item.asset;
                    const logoUrl = tokenInfo?.logoUrl;
                    const protocol = getProtocolByName(item.protocol);

                    // Check if this is a DEX pool with two tokens
                    const isDex = !!(item.token1Info && item.token2Info);

                    return (
                      <TableRow 
                        key={index}
                        className={cn("transition-colors", getDropZoneClassName(item))}
                        onDragOver={(e) => handleDragOver(e, item)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDropEvent(e, item)}
                      >
                        <TableCell>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-2">
                                  {isDex ? (
                                    // DEX pool display with two tokens
                                    <div className="flex items-center gap-2">
                                      <div className="flex">
                                        {item.token1Info?.logoUrl && (
                                          <Avatar className="w-6 h-6">
                                            <img 
                                              src={item.token1Info.logoUrl} 
                                              alt={item.token1Info.symbol} 
                                              className="object-contain" 
                                            />
                                          </Avatar>
                                        )}
                                        {item.token2Info?.logoUrl && (
                                          <Avatar className="w-6 h-6 -ml-2">
                                            <img 
                                              src={item.token2Info.logoUrl} 
                                              alt={item.token2Info.symbol} 
                                              className="object-contain" 
                                            />
                                          </Avatar>
                                        )}
                                      </div>
                                      <span>{item.token1Info?.symbol || '-'}</span>
                                      <span className="text-gray-400">/</span>
                                      <span>{item.token2Info?.symbol || '-'}</span>
                                    </div>
                                  ) : (
                                    // Lending pool display (existing logic)
                                    <>
                                      <Avatar className="h-6 w-6">
                                        {logoUrl ? (
                                          <AvatarImage src={logoUrl} />
                                        ) : (
                                          <AvatarFallback>{displaySymbol.slice(0, 2)}</AvatarFallback>
                                        )}
                                      </Avatar>
                                      <div className="flex flex-col">
                                        <span>{displaySymbol}</span>
                                        {/* Provider под токеном на мобильных */}
                                        {/* <span className="text-xs text-muted-foreground block md:hidden">{getProvider(item)}</span> */}
                                      </div>
                                    </>
                                  )}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="space-y-1">
                                  <p className="font-medium">Token Info</p>
                                  <p className="text-xs">Address: {item.token}</p>
                                  {isDex ? (
                                    // DEX tooltip content
                                    <>
                                      <p className="text-xs">Type: DEX Pool</p>
                                      <p className="text-xs">Token 1: {item.token1Info?.symbol} ({item.token1Info?.name})</p>
                                      <p className="text-xs">Token 2: {item.token2Info?.symbol} ({item.token2Info?.name})</p>
                                      {item.dailyVolumeUSD && (
                                        <p className="text-xs">Volume: ${item.dailyVolumeUSD.toLocaleString()}</p>
                                      )}
                                      {item.tvlUSD && (
                                        <p className="text-xs">TVL: ${item.tvlUSD.toLocaleString()}</p>
                                      )}
                                    </>
                                  ) : (
                                    // Lending tooltip content (existing logic)
                                    tokenInfo && (
                                      <>
                                        <p className="text-xs">Name: {tokenInfo.name}</p>
                                        <p className="text-xs">Symbol: {tokenInfo.symbol}</p>
                                        <p className="text-xs">Price: ${tokenInfo.usdPrice}</p>
                                      </>
                                    )
                                  )}
                                  <p className="text-xs">Provider: {getProvider(item)}</p>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{item.protocol}</Badge>
                        </TableCell>
                        <TableCell>{item.depositApy ? `${item.depositApy.toFixed(2)}%` : "-"}</TableCell>
                        <TableCell>{item.borrowAPY ? `${item.borrowAPY.toFixed(2)}%` : "-"}</TableCell>
                        <TableCell className="text-right">
                          <div>
                            {protocol ? (
                              isDex ? (
                                // Для DEX-пулов Hyperion - прямая ссылка на пул
                                <Button 
                                  variant="secondary"
                                  onClick={() => window.open(`https://hyperion.xyz/pool/${item.token}`, '_blank')}
                                  className="w-full"
                                >
                                  Deposit
                                  <ExternalLink className="ml-2 h-4 w-4" />
                                </Button>
                              ) : (
                                // Для лендинговых пулов - обычная кнопка Deposit
                                <DepositButton 
                                  protocol={protocol} 
                                  className="w-full"
                                  tokenIn={{
                                    symbol: displaySymbol,
                                    logo: tokenInfo?.logoUrl || '',
                                    decimals: tokenInfo?.decimals || 8,
                                    address: item.token
                                  }}
                                  balance={BigInt(1000000000)} // TODO: Get real balance
                                  priceUSD={Number(tokenInfo?.usdPrice || 0)}
                                />
                              )
                            ) : (
                              <Button disabled className="w-full">
                                Protocol not found
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </TooltipProvider>
        </TabsContent>
      </Tabs>
    </div>
  );
} 