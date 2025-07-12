"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, TrendingUp, DollarSign, Shield, Zap } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

interface AuroPool {
  type: string;
  poolAddress: string;
  poolName: string;
  collateralTokenAddress?: string;
  collateralTokenSymbol?: string;
  supplyApr?: number;
  supplyIncentiveApr?: number;
  stakingApr?: number;
  totalSupplyApr?: number;
  borrowApr?: number;
  borrowIncentiveApr?: number;
  totalBorrowApr?: number;
  rewardPoolAddress?: string;
  borrowRewardsPoolAddress?: string;
  tvl?: number;
  ltvBps?: number;
  liquidationThresholdBps?: number;
  liquidationFeeBps?: number;
  borrowAmountFromPool?: number;
  token?: any;
}

interface AuroPosition {
  address: string;
  poolAddress: string;
  collateralTokenAddress?: string;
  collateralTokenInfo?: any;
  debtTokenInfo?: any;
  collateralAmount: string;
  debtAmount: string;
  liquidatePrice: string;
  collateralSymbol: string;
  debtSymbol: string;
}

export default function TestAuroPage() {
  const { account } = useWallet();
  const [walletAddress, setWalletAddress] = useState(account?.address?.toString() || "");
  const [loading, setLoading] = useState(false);
  const [poolsLoading, setPoolsLoading] = useState(false);
  const [positionsLoading, setPositionsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [poolsError, setPoolsError] = useState<string | null>(null);
  const [positionsError, setPositionsError] = useState<string | null>(null);
  
  // Data states
  const [poolsData, setPoolsData] = useState<AuroPool[]>([]);
  const [userPositions, setUserPositions] = useState<AuroPosition[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showOnlyStablePools, setShowOnlyStablePools] = useState(true);
  const [activeTab, setActiveTab] = useState<"pools" | "positions">("pools");

  // Load pools data on component mount
  useEffect(() => {
    handleFetchPools();
  }, []);

  // Load positions when wallet address changes
  useEffect(() => {
    if (walletAddress) {
      handleFetchPositions();
    }
  }, [walletAddress]);

  const handleFetchPools = async () => {
    setPoolsLoading(true);
    setPoolsError(null);
    setPoolsData([]);

    try {
      const response = await fetch('/api/protocols/auro/pools');
      const data = await response.json();
      
      if (response.ok && data.success) {
        setPoolsData(data.data || []);
      } else {
        throw new Error(data.error || "Failed to fetch pools");
      }
    } catch (err) {
      console.error("Error fetching Auro pools:", err);
      setPoolsError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setPoolsLoading(false);
    }
  };

  const handleFetchPositions = async () => {
    if (!walletAddress) return;

    setPositionsLoading(true);
    setPositionsError(null);
    setUserPositions([]);

    try {
      const response = await fetch(`/api/protocols/auro/userPositions?address=${encodeURIComponent(walletAddress)}`);
      const data = await response.json();
      
      if (response.ok && data.success) {
        setUserPositions(data.positionInfo || []);
      } else {
        throw new Error(data.error || "Failed to fetch positions");
      }
    } catch (err) {
      console.error("Error fetching Auro positions:", err);
      setPositionsError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setPositionsLoading(false);
    }
  };

  // Filter pools based on search and stable filter
  const filteredPools = poolsData.filter(pool => {
    const matchesSearch = pool.poolName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         pool.collateralTokenSymbol?.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (showOnlyStablePools) {
      const isStable = pool.collateralTokenSymbol?.toUpperCase().includes('USDT') ||
                      pool.collateralTokenSymbol?.toUpperCase().includes('USDC') ||
                      pool.collateralTokenSymbol?.toUpperCase().includes('DAI') ||
                      pool.collateralTokenSymbol?.toUpperCase().includes('USDA');
      return matchesSearch && isStable;
    }
    
    return matchesSearch;
  });

  // Group pools by type
  const collateralPools = filteredPools.filter(pool => pool.type === 'COLLATERAL');
  const borrowPools = filteredPools.filter(pool => pool.type === 'BORROW');

  const getTokenLogo = (tokenAddress?: string) => {
    if (!tokenAddress) return undefined;
    // You can implement token logo fetching here
    return undefined;
  };

  const getPoolTypeIcon = (type: string) => {
    switch (type) {
      case 'COLLATERAL':
        return <Shield className="h-4 w-4 text-green-600" />;
      case 'BORROW':
        return <Zap className="h-4 w-4 text-blue-600" />;
      default:
        return <DollarSign className="h-4 w-4 text-gray-600" />;
    }
  };

  const getPoolTypeLabel = (type: string) => {
    switch (type) {
      case 'COLLATERAL':
        return 'Supply';
      case 'BORROW':
        return 'Borrow';
      default:
        return type;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <img 
          src="https://app.auro.finance/logo.png" 
          alt="Auro Finance" 
          className="w-12 h-12 rounded"
        />
        <div>
          <h1 className="text-3xl font-bold">Auro Finance - Pro Investment Ideas</h1>
          <p className="text-muted-foreground">
            Professional investment opportunities and position management
          </p>
        </div>
      </div>

      {/* Wallet Connection */}
      <Card>
        <CardHeader>
          <CardTitle>Wallet Connection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4">
            <div>
              <Label htmlFor="wallet-address">Wallet Address</Label>
              <Input
                id="wallet-address"
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
                placeholder="Enter wallet address to view positions"
                className="mt-1"
              />
            </div>
            
            <div className="flex gap-2">
              {account?.address && (
                <Button 
                  variant="outline"
                  onClick={() => setWalletAddress(account.address.toString())}
                >
                  Use Connected Wallet
                </Button>
              )}
            </div>
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600">{error}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Tabs defaultValue="pools" className="w-full" onValueChange={(value) => setActiveTab(value as "pools" | "positions")}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="pools">Investment Opportunities</TabsTrigger>
          <TabsTrigger value="positions">My Positions</TabsTrigger>
        </TabsList>

        {/* Investment Opportunities Tab */}
        <TabsContent value="pools" className="space-y-6">
          {/* Search and Filters */}
          <div className="flex items-center gap-2 mb-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search pools..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
            <div className="flex gap-1">
              {['USDT', 'USDC', 'DAI', 'APT'].map((token) => (
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
                Stable pools only
              </label>
            </div>
          </div>

          {poolsLoading ? (
            <div className="text-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-2 text-muted-foreground">Loading pools...</p>
            </div>
          ) : poolsError ? (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600">{poolsError}</p>
            </div>
          ) : (
            <>
              {/* Supply Pools */}
              {collateralPools.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Shield className="h-5 w-5 text-green-600" />
                    Supply Pools
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {collateralPools
                      .sort((a, b) => (b.totalSupplyApr || 0) - (a.totalSupplyApr || 0))
                      .map((pool, index) => (
                        <Card key={pool.poolAddress} className="hover:shadow-lg transition-shadow">
                          <CardHeader>
                            <CardTitle className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Avatar className="h-6 w-6">
                                  <AvatarImage src={getTokenLogo(pool.collateralTokenAddress)} />
                                  <AvatarFallback>{pool.collateralTokenSymbol?.slice(0, 2)}</AvatarFallback>
                                </Avatar>
                                <span className="text-sm">{pool.collateralTokenSymbol}</span>
                              </div>
                              <Badge variant="outline" className="text-xs">
                                {getPoolTypeLabel(pool.type)}
                              </Badge>
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="text-2xl font-bold text-green-600">
                              {(pool.totalSupplyApr || 0).toFixed(2)}%
                            </div>
                            <p className="text-xs text-muted-foreground">Total APY</p>
                            
                            <div className="mt-3 space-y-1 text-xs">
                              {pool.supplyApr && (
                                <div className="flex justify-between">
                                  <span>Base APR:</span>
                                  <span>{(pool.supplyApr).toFixed(2)}%</span>
                                </div>
                              )}
                              {pool.supplyIncentiveApr && (
                                <div className="flex justify-between">
                                  <span>Incentive APR:</span>
                                  <span>{(pool.supplyIncentiveApr).toFixed(2)}%</span>
                                </div>
                              )}
                              {pool.stakingApr && (
                                <div className="flex justify-between">
                                  <span>Staking APR:</span>
                                  <span>{(pool.stakingApr).toFixed(2)}%</span>
                                </div>
                              )}
                            </div>

                            {pool.tvl && (
                              <div className="mt-3 pt-2 border-t">
                                <div className="text-xs text-muted-foreground">
                                  TVL: ${pool.tvl.toLocaleString()}
                                </div>
                              </div>
                            )}

                            <Button className="mt-4 w-full" size="sm">
                              Supply
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                  </div>
                </div>
              )}

              {/* Borrow Pools */}
              {borrowPools.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Zap className="h-5 w-5 text-blue-600" />
                    Borrow Pools
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {borrowPools
                      .sort((a, b) => (b.totalBorrowApr || 0) - (a.totalBorrowApr || 0))
                      .map((pool, index) => (
                        <Card key={pool.poolAddress} className="hover:shadow-lg transition-shadow">
                          <CardHeader>
                            <CardTitle className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Avatar className="h-6 w-6">
                                  <AvatarImage src={getTokenLogo(pool.token?.address)} />
                                  <AvatarFallback>{pool.token?.symbol?.slice(0, 2)}</AvatarFallback>
                                </Avatar>
                                <span className="text-sm">{pool.token?.symbol}</span>
                              </div>
                              <Badge variant="outline" className="text-xs">
                                {getPoolTypeLabel(pool.type)}
                              </Badge>
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="text-2xl font-bold text-blue-600">
                              {(pool.totalBorrowApr || 0).toFixed(2)}%
                            </div>
                            <p className="text-xs text-muted-foreground">Total APR</p>
                            
                            <div className="mt-3 space-y-1 text-xs">
                              {pool.borrowApr && (
                                <div className="flex justify-between">
                                  <span>Base APR:</span>
                                  <span>{(pool.borrowApr).toFixed(2)}%</span>
                                </div>
                              )}
                              {pool.borrowIncentiveApr && (
                                <div className="flex justify-between">
                                  <span>Incentive APR:</span>
                                  <span>{(pool.borrowIncentiveApr).toFixed(2)}%</span>
                                </div>
                              )}
                            </div>

                            {pool.tvl && (
                              <div className="mt-3 pt-2 border-t">
                                <div className="text-xs text-muted-foreground">
                                  TVL: ${pool.tvl.toLocaleString()}
                                </div>
                              </div>
                            )}

                            <Button className="mt-4 w-full" size="sm" variant="outline">
                              Borrow
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                  </div>
                </div>
              )}

              {filteredPools.length === 0 && (
                <div className="text-center p-8">
                  <p className="text-muted-foreground">No pools found matching your criteria.</p>
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* My Positions Tab */}
        <TabsContent value="positions" className="space-y-6">
          {!walletAddress ? (
            <div className="text-center p-8">
              <p className="text-muted-foreground">Please enter a wallet address to view positions.</p>
            </div>
          ) : positionsLoading ? (
            <div className="text-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-2 text-muted-foreground">Loading positions...</p>
            </div>
          ) : positionsError ? (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600">{positionsError}</p>
            </div>
          ) : userPositions.length > 0 ? (
            <div>
              <h3 className="text-lg font-semibold mb-4">Your Positions ({userPositions.length})</h3>
              <div className="space-y-4">
                {userPositions.map((position, index) => (
                  <Card key={position.address}>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={getTokenLogo(position.collateralTokenAddress)} />
                            <AvatarFallback>{position.collateralSymbol?.slice(0, 2)}</AvatarFallback>
                          </Avatar>
                          <span>Position #{index + 1}</span>
                        </div>
                        <Badge variant="secondary">Active</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <Label className="text-xs text-muted-foreground">Collateral</Label>
                          <p className="font-medium">{position.collateralAmount} {position.collateralSymbol}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Debt</Label>
                          <p className="font-medium">{position.debtAmount} {position.debtSymbol}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Liquidation Price</Label>
                          <p className="font-medium">${position.liquidatePrice}</p>
                        </div>
                      </div>
                      
                      <div className="mt-4 flex gap-2">
                        <Button size="sm" variant="outline">Add Collateral</Button>
                        <Button size="sm" variant="outline">Repay Debt</Button>
                        <Button size="sm" variant="outline">Close Position</Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center p-8">
              <p className="text-muted-foreground">No positions found for this wallet address.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Debug Information (Collapsible) */}
      <details className="mt-8">
        <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
          Debug Information
        </summary>
        <div className="mt-2 p-4 bg-gray-50 border rounded-lg">
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground">Raw Pools Data:</Label>
              <pre className="text-xs mt-1 overflow-auto whitespace-pre-wrap max-h-40">
                {JSON.stringify(poolsData, null, 2)}
              </pre>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">User Positions:</Label>
              <pre className="text-xs mt-1 overflow-auto whitespace-pre-wrap max-h-40">
                {JSON.stringify(userPositions, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      </details>
    </div>
  );
} 