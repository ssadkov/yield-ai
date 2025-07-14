"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useAuroData } from "@/lib/stores/useAuroData";
import { useHyperionData } from "@/lib/stores/useHyperionData";
import { Badge } from "@/components/ui/badge";

export default function TestZustandPage() {
  const { account } = useWallet();
  const walletAddress = account?.address?.toString();
  
  // Auro data
  const {
    positions: auroPositions,
    rewards,
    pools: auroPools,
    prices: auroPrices,
    isLoading: auroLoading,
    hasError: auroError,
    positionsError: auroPositionsError,
    refreshData: refreshAuroData,
    getTokenPrice: getAuroTokenPrice
  } = useAuroData(walletAddress);

  // Hyperion data
  const {
    positions: hyperionPositions,
    pools: hyperionPools,
    prices: hyperionPrices,
    isLoading: hyperionLoading,
    hasError: hyperionError,
    positionsError: hyperionPositionsError,
    refreshData: refreshHyperionData,
    getTokenPrice: getHyperionTokenPrice,
    totalValue: hyperionTotalValue,
    totalRewards: hyperionTotalRewards
  } = useHyperionData(walletAddress);

  const handleRefreshAuro = () => {
    refreshAuroData();
  };

  const handleRefreshHyperion = () => {
    refreshHyperionData();
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Zustand Store Test - Auro Finance</CardTitle>
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
              <span>Auro Loading:</span>
              <Badge variant={auroLoading ? "destructive" : "default"}>
                {auroLoading ? "Loading..." : "Ready"}
              </Badge>
            </div>
            
            <div className="flex items-center gap-4">
              <span>Hyperion Loading:</span>
              <Badge variant={hyperionLoading ? "destructive" : "default"}>
                {hyperionLoading ? "Loading..." : "Ready"}
              </Badge>
            </div>
            
            {auroError && (
              <div className="flex items-center gap-4">
                <span>Auro Error:</span>
                <Badge variant="destructive">{auroPositionsError}</Badge>
              </div>
            )}
            
            {hyperionError && (
              <div className="flex items-center gap-4">
                <span>Hyperion Error:</span>
                <Badge variant="destructive">{hyperionPositionsError}</Badge>
              </div>
            )}
            
            <Button onClick={handleRefreshAuro} disabled={auroLoading}>
              Refresh Auro Data
            </Button>
            
            <Button onClick={handleRefreshHyperion} disabled={hyperionLoading}>
              Refresh Hyperion Data
            </Button>
            
            <Button 
              onClick={() => {
                console.log('Current Auro prices in store:', auroPrices);
                console.log('Auro Positions:', auroPositions);
                auroPositions.forEach((pos: any) => {
                  const collateralPrice = getAuroTokenPrice(pos.collateralTokenAddress || '');
                  const debtPrice = getAuroTokenPrice(pos.debtTokenInfo?.faAddress || '');
                  console.log(`Auro Position ${pos.address}:`, {
                    collateral: pos.collateralTokenAddress,
                    collateralPrice,
                    debt: pos.debtTokenInfo?.faAddress,
                    debtPrice
                  });
                });
              }}
              variant="outline"
            >
              Debug Auro Prices
            </Button>
            
            <Button 
              onClick={() => {
                console.log('Current Hyperion prices in store:', hyperionPrices);
                console.log('Hyperion Positions:', hyperionPositions);
                hyperionPositions.forEach((pos: any) => {
                  const token1Price = getHyperionTokenPrice(pos.position?.pool?.token1 || '');
                  const token2Price = getHyperionTokenPrice(pos.position?.pool?.token2 || '');
                  console.log(`Hyperion Position ${pos.position?.objectId}:`, {
                    token1: pos.position?.pool?.token1,
                    token1Price,
                    token2: pos.position?.pool?.token2,
                    token2Price
                  });
                });
              }}
              variant="outline"
            >
              Debug Hyperion Prices
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Auro Positions */}
        <Card>
          <CardHeader>
            <CardTitle>Auro Positions ({auroPositions.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {auroPositions.length === 0 ? (
              <p className="text-gray-500">No Auro positions found</p>
            ) : (
              <div className="space-y-2">
                {auroPositions.slice(0, 3).map((position: any, index: number) => (
                  <div key={index} className="border p-2 rounded">
                    <div className="text-sm">
                      <strong>Address:</strong> {position.address.slice(0, 8)}...
                    </div>
                    <div className="text-sm">
                      <strong>Collateral:</strong> {position.collateralAmount} {position.collateralSymbol}
                    </div>
                    <div className="text-sm">
                      <strong>Debt:</strong> {position.debtAmount} {position.debtSymbol}
                    </div>
                  </div>
                ))}
                {auroPositions.length > 3 && (
                  <p className="text-sm text-gray-500">
                    ... and {auroPositions.length - 3} more
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Hyperion Positions */}
        <Card>
          <CardHeader>
            <CardTitle>Hyperion Positions ({hyperionPositions.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {hyperionPositions.length === 0 ? (
              <p className="text-gray-500">No Hyperion positions found</p>
            ) : (
              <div className="space-y-2">
                {hyperionPositions.slice(0, 3).map((position: any, index: number) => (
                  <div key={index} className="border p-2 rounded">
                    <div className="text-sm">
                      <strong>Pool:</strong> {position.position?.pool?.token1Info?.symbol}/{position.position?.pool?.token2Info?.symbol}
                    </div>
                    <div className="text-sm">
                      <strong>Value:</strong> ${parseFloat(position.value || '0').toFixed(2)}
                    </div>
                    <div className="text-sm">
                      <strong>Status:</strong> {position.isActive ? 'Active' : 'Inactive'}
                    </div>
                  </div>
                ))}
                {hyperionPositions.length > 3 && (
                  <p className="text-sm text-gray-500">
                    ... and {hyperionPositions.length - 3} more
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Auro Pools */}
        <Card>
          <CardHeader>
            <CardTitle>Auro Pools ({auroPools.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {auroPools.length === 0 ? (
              <p className="text-gray-500">No Auro pools found</p>
            ) : (
              <div className="space-y-2">
                {auroPools.slice(0, 3).map((pool: any, index: number) => (
                  <div key={index} className="border p-2 rounded">
                    <div className="text-sm">
                      <strong>Type:</strong> {pool.type}
                    </div>
                    <div className="text-sm">
                      <strong>Name:</strong> {pool.poolName}
                    </div>
                    <div className="text-sm">
                      <strong>Symbol:</strong> {pool.collateralTokenSymbol}
                    </div>
                  </div>
                ))}
                {auroPools.length > 3 && (
                  <p className="text-sm text-gray-500">
                    ... and {auroPools.length - 3} more
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Hyperion Pools */}
        <Card>
          <CardHeader>
            <CardTitle>Hyperion Pools ({hyperionPools.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {hyperionPools.length === 0 ? (
              <p className="text-gray-500">No Hyperion pools found</p>
            ) : (
              <div className="space-y-2">
                {hyperionPools.slice(0, 3).map((pool: any, index: number) => (
                  <div key={index} className="border p-2 rounded">
                    <div className="text-sm">
                      <strong>Pool:</strong> {pool.token1Info?.symbol}/{pool.token2Info?.symbol}
                    </div>
                    <div className="text-sm">
                      <strong>Fee APR:</strong> {pool.feeAPR}%
                    </div>
                    <div className="text-sm">
                      <strong>Farm APR:</strong> {pool.farmAPR}%
                    </div>
                  </div>
                ))}
                {hyperionPools.length > 3 && (
                  <p className="text-sm text-gray-500">
                    ... and {hyperionPools.length - 3} more
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Auro Prices */}
        <Card>
          <CardHeader>
            <CardTitle>Auro Prices ({Object.keys(auroPrices).length})</CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(auroPrices).length === 0 ? (
              <p className="text-gray-500">No Auro prices found</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(auroPrices).slice(0, 5).map(([address, price]) => (
                  <div key={address} className="border p-2 rounded">
                    <div className="text-sm">
                      <strong>Address:</strong> {address.slice(0, 8)}...
                    </div>
                    <div className="text-sm">
                      <strong>Price:</strong> ${parseFloat(price).toFixed(4)}
                    </div>
                  </div>
                ))}
                {Object.keys(auroPrices).length > 5 && (
                  <p className="text-sm text-gray-500">
                    ... and {Object.keys(auroPrices).length - 5} more
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Hyperion Prices */}
        <Card>
          <CardHeader>
            <CardTitle>Hyperion Prices ({Object.keys(hyperionPrices).length})</CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(hyperionPrices).length === 0 ? (
              <p className="text-gray-500">No Hyperion prices found</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(hyperionPrices).slice(0, 5).map(([address, price]) => (
                  <div key={address} className="border p-2 rounded">
                    <div className="text-sm">
                      <strong>Address:</strong> {address.slice(0, 8)}...
                    </div>
                    <div className="text-sm">
                      <strong>Price:</strong> ${parseFloat(price).toFixed(4)}
                    </div>
                  </div>
                ))}
                {Object.keys(hyperionPrices).length > 5 && (
                  <p className="text-sm text-gray-500">
                    ... and {Object.keys(hyperionPrices).length - 5} more
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Auro Rewards */}
        <Card>
          <CardHeader>
            <CardTitle>Auro Rewards ({Object.keys(rewards).length} positions)</CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(rewards).length === 0 ? (
              <p className="text-gray-500">No Auro rewards found</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(rewards).slice(0, 3).map(([positionAddress, positionRewards]) => (
                  <div key={positionAddress} className="border p-2 rounded">
                    <div className="text-sm">
                      <strong>Position:</strong> {positionAddress.slice(0, 8)}...
                    </div>
                    <div className="text-sm">
                      <strong>Collateral Rewards:</strong> {positionRewards.collateral.length}
                    </div>
                    <div className="text-sm">
                      <strong>Borrow Rewards:</strong> {positionRewards.borrow.length}
                    </div>
                  </div>
                ))}
                {Object.keys(rewards).length > 3 && (
                  <p className="text-sm text-gray-500">
                    ... and {Object.keys(rewards).length - 3} more
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Hyperion Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Hyperion Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-sm">
                <strong>Total Value:</strong> ${hyperionTotalValue.toFixed(2)}
              </div>
              <div className="text-sm">
                <strong>Total Rewards:</strong> ${hyperionTotalRewards.toFixed(2)}
              </div>
              <div className="text-sm">
                <strong>Active Positions:</strong> {hyperionPositions.filter((p: any) => p.isActive).length}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 