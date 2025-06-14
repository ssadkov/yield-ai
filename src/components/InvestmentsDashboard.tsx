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

interface YieldIdeasProps {
  className?: string;
}

interface DragData {
  positionId: string;
  asset: string;
  amount: string;
  type: 'lend' | 'borrow';
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

export function YieldIdeas({ className }: YieldIdeasProps) {
  const [data, setData] = useState<InvestmentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [dragData, setDragData] = useState<DragData | null>(null);
  const [dropTarget, setDropTarget] = useState<InvestmentData | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

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

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, investment: InvestmentData) => {
    e.preventDefault();
    try {
      const dragData = JSON.parse(e.dataTransfer.getData('application/json')) as DragData;
      setDragData(dragData);
      setDropTarget(investment);
      setIsModalOpen(true);
    } catch (error) {
      console.error('Error parsing drag data:', error);
    }
  };

  const handleConfirm = () => {
    if (dragData && dropTarget) {
      // TODO: Implement the actual transfer logic here
      console.log('Transferring', dragData, 'to', dropTarget);
    }
    setIsModalOpen(false);
    setDragData(null);
    setDropTarget(null);
  };

  const topInvestments = [...data]
    .sort((a, b) => b.totalAPY - a.totalAPY)
    .slice(0, 3);

  const filteredData = data.filter(item => {
    const tokenInfo = getTokenInfo(item.asset, item.token);
    const displaySymbol = tokenInfo?.symbol || item.asset;
    return displaySymbol.toLowerCase().includes(searchQuery.toLowerCase());
  });

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
      <Tabs defaultValue="lite" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="lite">Lite</TabsTrigger>
          <TabsTrigger value="pro">Pro</TabsTrigger>
        </TabsList>

        <TabsContent value="lite" className="mt-6">
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">Best APY</h3>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {topInvestments.map((item, index) => {
                  const tokenInfo = getTokenInfo(item.asset, item.token);
                  const displaySymbol = tokenInfo?.symbol || item.asset;
                  const logoUrl = tokenInfo?.logoUrl;

                  return (
                    <Card 
                      key={index}
                      className="transition-colors hover:bg-accent/50"
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, item)}
                    >
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-6 w-6">
                                    {logoUrl ? (
                                      <AvatarImage src={logoUrl} />
                                    ) : (
                                      <AvatarFallback>{displaySymbol.slice(0, 2)}</AvatarFallback>
                                    )}
                                  </Avatar>
                                  {displaySymbol}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="space-y-1">
                                  <p className="font-medium">Token Info</p>
                                  <p className="text-xs">Address: {item.token}</p>
                                  {tokenInfo && (
                                    <>
                                      <p className="text-xs">Name: {tokenInfo.name}</p>
                                      <p className="text-xs">Symbol: {tokenInfo.symbol}</p>
                                      <p className="text-xs">Price: ${tokenInfo.usdPrice}</p>
                                    </>
                                  )}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </CardTitle>
                        <Badge variant="outline">{item.protocol}</Badge>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{item.totalAPY.toFixed(2)}%</div>
                        <p className="text-xs text-muted-foreground">Total APY</p>
                        <Button className="mt-4 w-full" variant="secondary">
                          Deposit
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4">Stables</h3>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {data
                  .filter(item => item.asset.toUpperCase().includes('USD'))
                  .sort((a, b) => b.totalAPY - a.totalAPY)
                  .slice(0, 3)
                  .map((item, index) => {
                    const tokenInfo = getTokenInfo(item.asset, item.token);
                    const displaySymbol = tokenInfo?.symbol || item.asset;
                    const logoUrl = tokenInfo?.logoUrl;

                    return (
                      <Card 
                        key={index}
                        className="transition-colors hover:bg-accent/50"
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, item)}
                      >
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                          <CardTitle className="text-sm font-medium">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center gap-2">
                                    <Avatar className="h-6 w-6">
                                      {logoUrl ? (
                                        <AvatarImage src={logoUrl} />
                                      ) : (
                                        <AvatarFallback>{displaySymbol.slice(0, 2)}</AvatarFallback>
                                      )}
                                    </Avatar>
                                    {displaySymbol}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <div className="space-y-1">
                                    <p className="font-medium">Token Info</p>
                                    <p className="text-xs">Address: {item.token}</p>
                                    {tokenInfo && (
                                      <>
                                        <p className="text-xs">Name: {tokenInfo.name}</p>
                                        <p className="text-xs">Symbol: {tokenInfo.symbol}</p>
                                        <p className="text-xs">Price: ${tokenInfo.usdPrice}</p>
                                      </>
                                    )}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </CardTitle>
                          <Badge variant="outline">{item.protocol}</Badge>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">{item.totalAPY.toFixed(2)}%</div>
                          <p className="text-xs text-muted-foreground">Total APY</p>
                          <Button className="mt-4 w-full" variant="secondary">
                            Deposit
                          </Button>
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
                  { symbol: 'APT', exact: true },
                  { symbol: 'BTC', exact: false },
                  { symbol: 'ETH', exact: false }
                ].map(({ symbol, exact }) => {
                  const bestPool = data
                    .filter(item => exact 
                      ? item.asset.toUpperCase() === symbol
                      : item.asset.toUpperCase().includes(symbol)
                    )
                    .sort((a, b) => b.totalAPY - a.totalAPY)[0];

                  if (!bestPool) return null;

                  const tokenInfo = getTokenInfo(bestPool.asset, bestPool.token);
                  const displaySymbol = tokenInfo?.symbol || bestPool.asset;
                  const logoUrl = tokenInfo?.logoUrl;

                  return (
                    <Card 
                      key={symbol}
                      className="transition-colors hover:bg-accent/50"
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, bestPool)}
                    >
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-6 w-6">
                                    {logoUrl ? (
                                      <AvatarImage src={logoUrl} />
                                    ) : (
                                      <AvatarFallback>{displaySymbol.slice(0, 2)}</AvatarFallback>
                                    )}
                                  </Avatar>
                                  {displaySymbol}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="space-y-1">
                                  <p className="font-medium">Token Info</p>
                                  <p className="text-xs">Address: {bestPool.token}</p>
                                  {tokenInfo && (
                                    <>
                                      <p className="text-xs">Name: {tokenInfo.name}</p>
                                      <p className="text-xs">Symbol: {tokenInfo.symbol}</p>
                                      <p className="text-xs">Price: ${tokenInfo.usdPrice}</p>
                                    </>
                                  )}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </CardTitle>
                        <Badge variant="outline">{bestPool.protocol}</Badge>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{bestPool.totalAPY.toFixed(2)}%</div>
                        <p className="text-xs text-muted-foreground">Total APY</p>
                        <Button className="mt-4 w-full" variant="secondary">
                          Deposit
                        </Button>
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
            <div className="relative flex-1">
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
          </div>
          <TooltipProvider>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Token</TableHead>
                  <TableHead>Provider</TableHead>
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
                {filteredData
                  .filter(item => {
                    const tokenInfo = getTokenInfo(item.asset, item.token);
                    return item.asset.includes('::') || tokenInfo;
                  })
                  .sort((a, b) => b.totalAPY - a.totalAPY)
                  .map((item, index) => {
                    const tokenInfo = getTokenInfo(item.asset, item.token);
                    const displaySymbol = tokenInfo?.symbol || item.asset;
                    const logoUrl = tokenInfo?.logoUrl;

                    return (
                      <TableRow 
                        key={index}
                        className="transition-colors hover:bg-accent/50"
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, item)}
                      >
                        <TableCell>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-6 w-6">
                                    {logoUrl ? (
                                      <AvatarImage src={logoUrl} />
                                    ) : (
                                      <AvatarFallback>{displaySymbol.slice(0, 2)}</AvatarFallback>
                                    )}
                                  </Avatar>
                                  {displaySymbol}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="space-y-1">
                                  <p className="font-medium">Token Info</p>
                                  <p className="text-xs">Address: {item.token}</p>
                                  {tokenInfo && (
                                    <>
                                      <p className="text-xs">Name: {tokenInfo.name}</p>
                                      <p className="text-xs">Symbol: {tokenInfo.symbol}</p>
                                      <p className="text-xs">Price: ${tokenInfo.usdPrice}</p>
                                    </>
                                  )}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                        <TableCell>{getProvider(item)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{item.protocol}</Badge>
                        </TableCell>
                        <TableCell>{item.totalAPY.toFixed(2)}%</TableCell>
                        <TableCell>{item.borrowAPY ? `${item.borrowAPY.toFixed(2)}%` : "-"}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="secondary" size="sm">
                            Deposit
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </TooltipProvider>
        </TabsContent>
      </Tabs>

      <ConfirmModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setDragData(null);
          setDropTarget(null);
        }}
        onConfirm={handleConfirm}
        title="Подтверждение перемещения"
        description={`Вы уверены, что хотите переместить ${dragData?.amount} ${dragData?.asset} (${dragData?.type === 'borrow' ? 'заем' : 'депозит'}) в ${dropTarget?.protocol}?`}
      />
    </div>
  );
} 