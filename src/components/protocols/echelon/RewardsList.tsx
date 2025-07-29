"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight } from "lucide-react";

interface EchelonReward {
  token: string;
  tokenType: string;
  rewardName?: string;
  amount: number;
  rawAmount: string;
  farmingId: string;
  stakeAmount: number;
}

interface RewardsListProps {
  walletAddress: string;
  isOpen?: boolean;
  onToggle?: (isOpen: boolean) => void;
}

export default function RewardsList({ walletAddress, isOpen = false, onToggle }: RewardsListProps) {
  const [rewards, setRewards] = useState<EchelonReward[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRewards = async () => {
    if (!walletAddress) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/protocols/echelon/rewards?address=${encodeURIComponent(walletAddress)}`);
      const data = await response.json();

      if (response.ok && data.success) {
        setRewards(data.data || []);
      } else {
        throw new Error(data.error || "Failed to fetch rewards");
      }
    } catch (err) {
      console.error("Error fetching Echelon rewards:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && walletAddress) {
      fetchRewards();
    }
  }, [isOpen, walletAddress]);

  const getTokenIcon = (tokenName: string) => {
    if (tokenName.toLowerCase().includes('aptos') || tokenName.toLowerCase().includes('apt')) {
      return "🟢";
    }
    if (tokenName.toLowerCase().includes('thala') || tokenName.toLowerCase().includes('thapt')) {
      return "🔵";
    }
    return "🪙";
  };

  const formatFarmingId = (farmingId: string) => {
    if (farmingId.startsWith('@')) {
      return farmingId.substring(1, 10) + '...' + farmingId.substring(farmingId.length - 8);
    }
    return farmingId.substring(0, 10) + '...' + farmingId.substring(farmingId.length - 8);
  };

  const totalRewards = rewards.reduce((sum, reward) => sum + reward.amount, 0);

  return (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <CollapsibleTrigger asChild>
        <Card className="cursor-pointer hover:bg-gray-50 transition-colors">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                  E
                </div>
                <div>
                  <CardTitle className="text-lg">Echelon Rewards</CardTitle>
                  <p className="text-sm text-muted-foreground">Farming rewards from Echelon protocol</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {rewards.length > 0 && (
                  <Badge variant="secondary">
                    {rewards.length} rewards
                  </Badge>
                )}
                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </div>
            </div>
          </CardHeader>
        </Card>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <Card className="mt-2">
          <CardContent className="pt-6">
            {loading && (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-6 w-6 rounded" />
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                ))}
              </div>
            )}

            {error && (
              <div className="p-4 border rounded-lg bg-red-50 border-red-200">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            {!loading && !error && rewards.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <span className="text-sm font-medium text-green-800">Total Claimable Rewards:</span>
                  <span className="text-lg font-bold text-green-600">
                    {totalRewards.toFixed(6)}
                  </span>
                </div>

                <div className="space-y-3">
                  {rewards.map((reward, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{getTokenIcon(reward.token)}</span>
                        <div>
                          <p className="font-medium">{reward.token}</p>
                          <p className="text-xs text-muted-foreground">
                            Pool: {formatFarmingId(reward.farmingId)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-green-600 font-medium">
                          {reward.amount.toFixed(6)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Staked: {reward.stakeAmount.toFixed(6)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!loading && !error && rewards.length === 0 && (
              <div className="p-8 text-center">
                <p className="text-muted-foreground">No rewards found for this address</p>
              </div>
            )}
          </CardContent>
        </Card>
      </CollapsibleContent>
    </Collapsible>
  );
} 