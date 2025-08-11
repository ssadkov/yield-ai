'use client';

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useWallet, WalletReadyState } from "@aptos-labs/wallet-adapter-react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { getProtocolByName } from "@/lib/protocols/getProtocolsList";
import Image from "next/image";
import { ManagePositionsButton } from "../../ManagePositionsButton";
import tokenList from "@/lib/data/tokenList.json";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { getMesoTokenByAddress } from "@/lib/protocols/meso/tokens";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface MesoPositionsProps {
  address?: string;
  onPositionsValueChange?: (value: number) => void;
}

interface Position {
  assetName: string;
  balance: string; // raw base units from asset_amounts
  amount: number;  // normalized
  usdValue: number; // normalized by 1e16
  type: 'deposit';
  assetInfo: {
    name: string;
    symbol: string;
    decimals: number;
    logoUrl?: string;
  };
}

interface MesoApiResponse {
  success: boolean;
  data: Position[];
}

interface RewardsApiResponse {
  success: boolean;
  rewards: Array<{
    side: 'supply' | 'borrow';
    poolInner: string;
    rewardPoolInner: string;
    tokenAddress: string;
    amount: number;
    symbol: string;
    usdValue: number;
  }>;
  totalUsd: number;
}

function formatTokenAmount(amount: string, decimals: number): string {
  const bigIntAmount = BigInt(amount);
  const divisor = BigInt(10 ** decimals);
  
  const wholePart = bigIntAmount / divisor;
  const fractionalPart = bigIntAmount % divisor;
  
  if (fractionalPart === BigInt(0)) {
    return wholePart.toString();
  }
  
  const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
  const trimmedFractional = fractionalStr.replace(/0+$/, '');
  
  return `${wholePart}.${trimmedFractional}`;
}

function getTokenInfo(tokenAddress: string) {
  return (tokenList as any).data.data.find((token: any) => 
    token.tokenAddress === tokenAddress || 
    token.faAddress === tokenAddress
  );
}

export function MesoPositions({ address, onPositionsValueChange }: MesoPositionsProps) {
  const { account, signAndSubmitTransaction } = useWallet();
  const { toast } = useToast();
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const [totalValue, setTotalValue] = useState(0);
  const [isClaiming, setIsClaiming] = useState(false);
  const [rewards, setRewards] = useState<RewardsApiResponse | null>(null);
  

  const walletAddress = address || account?.address?.toString();
  const protocol = getProtocolByName("Meso Finance");

  // Панора цены больше не нужны

  useEffect(() => {
    async function loadPositions() {
      if (!walletAddress) {
        setPositions([]);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        // Новый API: берем уже нормализованные amount и usdValue
        const response = await fetch(`/api/protocols/meso/userPositions?address=${walletAddress}`);
        if (!response.ok) {
          throw new Error(`API returned status ${response.status}`);
        }
        const data = await response.json() as MesoApiResponse;
        if (data.success && Array.isArray(data.data)) {
          setPositions(data.data);
        } else {
          setPositions([]);
        }
      } catch (err) {
        console.error('Error loading Meso positions:', err);
        setError('Failed to load positions');
        setPositions([]);
      } finally {
        setLoading(false);
      }
    }

    loadPositions();
  }, [walletAddress]);

  // Expose a refresh helper for claim post-processing
  const refreshData = async () => {
    try {
      // reload positions
      if (walletAddress) {
        const response = await fetch(`/api/protocols/meso/userPositions?address=${walletAddress}`);
        if (response.ok) {
          const data = await response.json() as MesoApiResponse;
          if (data.success && Array.isArray(data.data)) {
            setPositions(data.data);
          }
        }
        // reload rewards
        const res = await fetch(`/api/protocols/meso/rewards?address=${walletAddress}`);
        if (res.ok) {
          const json = await res.json() as RewardsApiResponse;
          if (json?.success) setRewards(json);
        }
      }
    } catch (e) {
      // ignore refresh errors
    }
  };

  const handleClaimAll = async () => {
    if (!signAndSubmitTransaction || !account?.address) return;
    try {
      setIsClaiming(true);
      const functionAddress = '0x68476f9d437e3f32fd262ba898b5e3ee0a23a1d586a6cf29a28add35f253f6f7';
      const tokens = [
        "0x1::aptos_coin::AptosCoin",
        "0x357b0b74bc833e95a115ad22604854d6b0fca151cecd94111770e5d6ffc9dc2b",
        "0x111ae3e5bc816a5e63c2da97d0aa3886519e0cd5e4b046659fa35796bd11542a::stapt_token::StakedApt",
        "0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b",
        "0x111ae3e5bc816a5e63c2da97d0aa3886519e0cd5e4b046659fa35796bd11542a::amapt_token::AmnisApt",
        "0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::WBTC",
        "0xfaf4e633ae9eb31366c9ca24214231760926576c7b625313b3688b5e900731f6::staking::StakedThalaAPT",
        "0xb36527754eb54d7ff55daf13bcb54b42b88ec484bd6f0e3b2e0d1db169de6451",
        "0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::USDT",
        "0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::USDC",
        "0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::WETH",
        "0x68844a0d7f2587e726ad0579f3d640865bb4162c08a4589eeda3f9689ec52a3d",
        "0x5e156f1207d0ebfa19a9eeff00d62a282278fb8719f4fab3a586a0a2c0fffbea::coin::T",
        "0x2ebb2ccac5e027a87fa0e2e5f656a3a4238d6a48d93ec9b610d570fc0aa0df12",
        "0xada35ada7e43e2ee1c39633ffccec38b76ce702b4efc2e60b50f63fbe4f710d8::apetos_token::ApetosCoin",
        "0x159df6b7689437016108a019fd5bef736bac692b6d4a1f10c941f6fbb9a74ca6::oft::CakeOFT",
        "0x63be1898a424616367e19bbd881f456a78470e123e2770b5b5dcdceb61279c54::movegpt_token::MovegptCoin",
        "0xaef6a8c3182e076db72d64324617114cacf9a52f28325edc10b483f7f05da0e7"
      ];
      const payload = {
        function: `${functionAddress}::meso::claim_all_apt_rewards` as `${string}::${string}::${string}`,
        typeArguments: [] as string[],
        functionArguments: [tokens] as any[]
      } as const;

      const tx = await signAndSubmitTransaction({ data: payload });
      toast({
        title: 'Claim submitted',
        description: `Transaction ${tx.hash.slice(0, 6)}...${tx.hash.slice(-4)}`,
      });
      // Refresh state after short delay
      setTimeout(() => {
        refreshData();
      }, 1500);
    } catch (e) {
      console.error('[Meso Managing] Claim all error:', e);
      toast({ title: 'Error', description: 'Failed to claim rewards', variant: 'destructive' });
    } finally {
      setIsClaiming(false);
    }
  };

  // Load rewards for summary
  useEffect(() => {
    const loadRewards = async () => {
      if (!walletAddress) {
        setRewards(null);
        return;
      }
      try {
        const res = await fetch(`/api/protocols/meso/rewards?address=${walletAddress}`);
        if (!res.ok) throw new Error(`Rewards API ${res.status}`);
        const json = (await res.json()) as RewardsApiResponse;
        if (json?.success) setRewards(json);
        else setRewards({ success: true, rewards: [], totalUsd: 0 });
      } catch (e) {
        console.error('[Meso Managing] Rewards load error:', e);
        setRewards({ success: true, rewards: [], totalUsd: 0 });
      }
    };
    loadRewards();
  }, [walletAddress]);

  // Сортировка по USD-стоимости
  const sortedPositions = [...positions].sort((a, b) => {
    return b.usdValue - a.usdValue;
  });

  // Новый useEffect для расчёта суммы по sortedPositions
  useEffect(() => {
    const total = sortedPositions.reduce((sum, position) => sum + (position.type === 'deposit' ? position.usdValue : -position.usdValue), 0);
    setTotalValue(total);
  }, [sortedPositions]);

  // Вызываем колбэк при изменении общей суммы позиций
  useEffect(() => {
    onPositionsValueChange?.(totalValue);
  }, [totalValue, onPositionsValueChange]);

  if (loading) {
    return <div>Loading positions...</div>;
  }

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

  if (positions.length === 0) {
    return null;
  }

  return (
    <div className="text-base">
      <ScrollArea>
        {sortedPositions.map((position, index) => {
          const mapping = getMesoTokenByAddress(position.assetName);
          const tokenInfo = mapping ? getTokenInfo(mapping.tokenAddress) : undefined;
          const amount = position.amount;
          const value = position.usdValue;
          return (
            <div key={`${position.assetName}-${index}`} className="flex justify-between items-center p-4 border-b last:border-b-0">
              <div className="flex items-center gap-3">
                {tokenInfo?.logoUrl && (
                  <div className="w-8 h-8 relative">
                    <Image 
                      src={tokenInfo.logoUrl} 
                     alt={tokenInfo?.symbol || position.assetInfo.symbol}
                      width={32}
                      height={32}
                      className="object-contain"
                    />
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-medium">{tokenInfo?.symbol || position.assetInfo.symbol}</span>
                    <Badge variant="outline" className={position.type === 'deposit' ? "bg-green-500/10 text-green-600 border-green-500/20 text-base font-semibold px-3 py-1" : "bg-red-500/10 text-red-600 border-red-500/20 text-base font-semibold px-3 py-1"}>
                      {position.type === 'deposit' ? 'Supply' : 'Borrow'}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    ${(value / (amount || 1) > 0 ? (value / (amount || 1)).toFixed(2) : '0.00')}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className={position.type === 'deposit' ? "text-lg font-bold text-green-600" : "text-lg font-bold text-red-600"}>
                  ${value.toFixed(2)}
                </div>
                <div className="text-xs text-muted-foreground font-semibold">{amount.toFixed(4)}</div>
              </div>
            </div>
          );
        })}
      </ScrollArea>
      <div className="pt-6 flex items-center justify-between">
        <span className="text-xl">Total assets in Meso:</span>
        <span className="text-xl text-primary font-bold">${(totalValue + (rewards?.totalUsd || 0)).toFixed(2)}</span>
      </div>
      {rewards && rewards.rewards && rewards.rewards.length > 0 && (
        <div className="text-right">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-sm text-muted-foreground inline-flex items-center gap-1 cursor-help">
                  <span>💰</span>
                  <span>including rewards {(rewards.totalUsd || 0).toFixed(2)}</span>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <div className="space-y-1">
                  <div className="font-medium">Rewards</div>
                  {rewards.rewards
                    .sort((a, b) => b.usdValue - a.usdValue)
                    .map((r, idx) => (
                      <div key={idx} className="text-xs">
                        {r.symbol}: {r.amount.toFixed(6)} (${r.usdValue.toFixed(2)})
                      </div>
                    ))}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <div className="mt-2">
            <button
              className="px-3 py-1 bg-green-600 text-white rounded text-sm font-semibold disabled:opacity-60"
              onClick={handleClaimAll}
              disabled={isClaiming}
            >
              {isClaiming ? 'Claiming…' : 'Claim all rewards'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
} 