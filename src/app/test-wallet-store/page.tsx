"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useWalletData } from "@/lib/stores/useWalletData";
import { Separator } from "@/components/ui/separator";

export default function TestWalletStorePage() {
  const { account } = useWallet();
  const walletAddress = account?.address?.toString();
  
  const {
    // Data
    balance,
    positions,
    rewards,
    prices,
    
    // Loading states
    isLoading,
    balanceLoading,
    positionsLoading,
    rewardsLoading,
    pricesLoading,
    
    // Error states
    hasError,
    balanceError,
    positionsError,
    rewardsError,
    pricesError,
    
    // Computed values
    totalValue,
    
    // Actions
    refreshAll,
    refreshBalance,
    refreshPositions,
    refreshRewards,
    refreshPrices,
    
    // Getters
    getPositions,
    getRewards,
    getTokenPrice
  } = useWalletData(walletAddress);

  const handleRefreshAll = () => {
    refreshAll();
  };

  const handleRefreshBalance = () => {
    refreshBalance();
  };

  const handleRefreshPositions = () => {
    refreshPositions();
  };

  const handleRefreshRewards = () => {
    refreshRewards();
  };

  const handleRefreshPrices = () => {
    refreshPrices();
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Wallet Store Test - Centralized Data Management</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <span>Wallet Address:</span>
              <code className="bg-gray-100 px-2 py-1 rounded">
                {walletAddress || "Not connected"}
              </code>
            </div>
            
            <div className="flex items-center gap-4">
              <span>Overall Loading:</span>
              <Badge variant={isLoading ? "destructive" : "default"}>
                {isLoading ? "Loading..." : "Ready"}
              </Badge>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center gap-2">
                <span>Balance:</span>
                <Badge variant={balanceLoading ? "destructive" : "default"}>
                  {balanceLoading ? "Loading" : "Ready"}
                </Badge>
              </div>
              
              <div className="flex items-center gap-2">
                <span>Positions:</span>
                <Badge variant={positionsLoading ? "destructive" : "default"}>
                  {positionsLoading ? "Loading" : "Ready"}
                </Badge>
              </div>
              
              <div className="flex items-center gap-2">
                <span>Rewards:</span>
                <Badge variant={rewardsLoading ? "destructive" : "default"}>
                  {rewardsLoading ? "Loading" : "Ready"}
                </Badge>
              </div>
              
              <div className="flex items-center gap-2">
                <span>Prices:</span>
                <Badge variant={pricesLoading ? "destructive" : "default"}>
                  {pricesLoading ? "Loading" : "Ready"}
                </Badge>
              </div>
            </div>
            
            {hasError && (
              <div className="space-y-2">
                <div className="text-sm font-medium text-red-600">Errors:</div>
                {balanceError && <div className="text-xs text-red-500">Balance: {balanceError}</div>}
                {positionsError && <div className="text-xs text-red-500">Positions: {positionsError}</div>}
                {rewardsError && <div className="text-xs text-red-500">Rewards: {rewardsError}</div>}
                {pricesError && <div className="text-xs text-red-500">Prices: {pricesError}</div>}
              </div>
            )}
            
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleRefreshAll} disabled={isLoading}>
                Refresh All
              </Button>
              <Button onClick={handleRefreshBalance} disabled={balanceLoading}>
                Refresh Balance
              </Button>
              <Button onClick={handleRefreshPositions} disabled={positionsLoading}>
                Refresh Positions
              </Button>
              <Button onClick={handleRefreshRewards} disabled={rewardsLoading}>
                Refresh Rewards
              </Button>
              <Button onClick={handleRefreshPrices} disabled={pricesLoading}>
                Refresh Prices
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Balance Data */}
      <Card>
        <CardHeader>
          <CardTitle>Balance Data</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">
              Total Balance Items: {balance.length}
            </div>
            {balance.slice(0, 5).map((item, index) => (
              <div key={index} className="text-xs font-mono bg-gray-50 p-2 rounded">
                {item.asset_type}: {item.amount}
              </div>
            ))}
            {balance.length > 5 && (
              <div className="text-xs text-muted-foreground">
                ... and {balance.length - 5} more items
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Positions Data */}
      <Card>
        <CardHeader>
          <CardTitle>Positions Data</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries(positions).map(([protocol, protocolPositions]) => (
              <div key={protocol}>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium capitalize">{protocol}</h4>
                  <Badge variant="outline">{protocolPositions.length} positions</Badge>
                </div>
                {protocolPositions.slice(0, 3).map((position: any, index: number) => (
                  <div key={index} className="text-xs font-mono bg-gray-50 p-2 rounded mb-1">
                    {JSON.stringify(position, null, 2)}
                  </div>
                ))}
                {protocolPositions.length > 3 && (
                  <div className="text-xs text-muted-foreground">
                    ... and {protocolPositions.length - 3} more positions
                  </div>
                )}
                <Separator className="mt-2" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Rewards Data */}
      <Card>
        <CardHeader>
          <CardTitle>Rewards Data</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries(rewards).map(([protocol, protocolRewards]) => (
              <div key={protocol}>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium capitalize">{protocol}</h4>
                  <Badge variant="outline">{protocolRewards.length} rewards</Badge>
                </div>
                {protocolRewards.slice(0, 3).map((reward: any, index: number) => (
                  <div key={index} className="text-xs font-mono bg-gray-50 p-2 rounded mb-1">
                    {JSON.stringify(reward, null, 2)}
                  </div>
                ))}
                {protocolRewards.length > 3 && (
                  <div className="text-xs text-muted-foreground">
                    ... and {protocolRewards.length - 3} more rewards
                  </div>
                )}
                <Separator className="mt-2" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Prices Data */}
      <Card>
        <CardHeader>
          <CardTitle>Prices Data</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">
              Total Token Prices: {Object.keys(prices).length}
            </div>
            {Object.entries(prices).slice(0, 10).map(([address, price]) => (
              <div key={address} className="text-xs font-mono bg-gray-50 p-2 rounded">
                {address}: ${price}
              </div>
            ))}
            {Object.keys(prices).length > 10 && (
              <div className="text-xs text-muted-foreground">
                ... and {Object.keys(prices).length - 10} more prices
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Debug Info */}
      <Card>
        <CardHeader>
          <CardTitle>Debug Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Button 
              onClick={() => {
                console.log('=== Wallet Store Debug Info ===');
                console.log('Balance:', balance);
                console.log('Positions:', positions);
                console.log('Rewards:', rewards);
                console.log('Prices:', prices);
                console.log('Total Value:', totalValue);
                console.log('Loading States:', {
                  balanceLoading,
                  positionsLoading,
                  rewardsLoading,
                  pricesLoading
                });
                console.log('Error States:', {
                  balanceError,
                  positionsError,
                  rewardsError,
                  pricesError
                });
              }}
              variant="outline"
            >
              Log Debug Info to Console
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 