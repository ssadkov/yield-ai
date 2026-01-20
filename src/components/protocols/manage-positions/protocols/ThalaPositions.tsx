'use client';

import { useEffect, useState } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { formatNumber, formatCurrency } from "@/lib/utils/numberFormat";

interface ThalaTokenAmount {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoUrl?: string | null;
  amountRaw: string;
  amount: number;
  priceUSD: number;
  valueUSD: number;
}

interface ThalaRewardItem {
  tokenAddress: string;
  symbol: string;
  name: string;
  decimals: number;
  logoUrl?: string | null;
  amountRaw: string;
  amount: number;
  priceUSD: number;
  valueUSD: number;
}

interface ThalaPosition {
  positionId: string;
  positionAddress: string;
  poolAddress: string;
  token0: ThalaTokenAmount;
  token1: ThalaTokenAmount;
  inRange: boolean;
  rewards: ThalaRewardItem[];
  positionValueUSD: number;
  rewardsValueUSD: number;
  totalValueUSD: number;
}

interface ThalaPositionProps {
  position: ThalaPosition;
  index: number;
}

function formatCurrencyValue(value: number) {
  if (value === 0) return '$0.00';
  if (value > 0 && value < 0.01) return '< $0.01';
  return formatCurrency(value);
}

function ThalaPositionCard({ position, index }: ThalaPositionProps) {
  const [isClaiming, setIsClaiming] = useState(false);
  const { signAndSubmitTransaction, account } = useWallet();
  const { toast } = useToast();

  const tokenEntries = [
    {
      symbol: position.token0.symbol,
      amount: position.token0.amount,
      value: position.token0.valueUSD
    },
    {
      symbol: position.token1.symbol,
      amount: position.token1.amount,
      value: position.token1.valueUSD
    }
  ];

  const handleClaimRewards = async () => {
    if (!signAndSubmitTransaction || !account?.address || position.rewards.length === 0) return;

    try {
      setIsClaiming(true);
      const THALA_FARMING_ADDRESS = "0xcb8365dc9f7ac6283169598aaad7db9c7b12f52da127007f37fa4565170ff59c";

      for (const reward of position.rewards) {
        const payload = {
          function: `${THALA_FARMING_ADDRESS}::farming::claim_token_reward_entry` as `${string}::${string}::${string}`,
          typeArguments: [],
          functionArguments: [
            position.positionAddress, // position address
            reward.tokenAddress // reward token object address
          ]
        };

        const response = await signAndSubmitTransaction({
          data: payload,
          options: { maxGasAmount: 20000 },
        });

        toast({
          title: "Success",
          description: `Claim transaction hash: ${response.hash.slice(0, 6)}...${response.hash.slice(-4)}`,
          action: (
            <ToastAction altText="View in Explorer" onClick={() => window.open(`https://explorer.aptoslabs.com/txn/${response.hash}?network=mainnet`, '_blank')}>
              View in Explorer
            </ToastAction>
          ),
        });
      }

      // Refresh positions after claiming
      window.dispatchEvent(new CustomEvent('refreshPositions', { detail: { protocol: 'thala' } }));
    } catch (error) {
      console.error('Error claiming Thala rewards:', error);
      toast({ title: "Error", description: "Failed to claim rewards", variant: "destructive" });
    } finally {
      setIsClaiming(false);
    }
  };

  return (
    <div key={`${position.positionId}-${index}`} className="mt-2 pb-2 border-b last:border-b-0">
      <div className="flex flex-wrap justify-between items-center mb-2">
        <div className="flex items-center gap-2">
          <div className="flex -space-x-2 mr-2">
            {position.token0.logoUrl && (
              <img
                src={position.token0.logoUrl}
                alt={position.token0.symbol}
                className="w-8 h-8 rounded-full border-2 border-white object-contain"
              />
            )}
            {position.token1.logoUrl && (
              <img
                src={position.token1.logoUrl}
                alt={position.token1.symbol}
                className="w-8 h-8 rounded-full border-2 border-white object-contain"
              />
            )}
          </div>
          <span className="text-lg font-semibold">
            {position.token0.symbol} / {position.token1.symbol}
          </span>
          {position.inRange ? (
            <span className="px-2 py-1 rounded bg-green-500/10 text-green-600 text-xs font-semibold ml-2">Active</span>
          ) : (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="bg-error-muted text-error border-error/20 text-xs font-normal px-2 py-0.5 h-5 ml-2 cursor-help">
                    Inactive
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Liquidity is currently outside the active price range</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <div className="flex items-centern gap-2">
          <span className="text-lg font-bold">{formatCurrencyValue(position.positionValueUSD)}</span>
        </div>
      </div>
      <div className="flex flex-wrap justify-between items-start">
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          {tokenEntries.map((te) => (
            <div key={`amt-${te.symbol}`}>
              <div className="text-gray-500">{te.symbol} Amount</div>
              <div className="font-medium">{formatNumber(te.amount, 6)}</div>
            </div>
          ))}
          {tokenEntries.map((te) => (
            <div key={`val-${te.symbol}`}>
              <div className="text-gray-500">{te.symbol} Value</div>
              <div className="font-medium">{formatCurrencyValue(te.value)}</div>
            </div>
          ))}
        </div>
        <div className="flex flex-col items-end gap-2 text-sm">
          {position.rewards.length > 0 && (
            <div className="mt-2 text-right">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="text-gray-500 mb-1 cursor-help">
                      🎁 Rewards: {formatCurrencyValue(position.rewardsValueUSD)}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <div className="space-y-1 text-xs max-h-48 overflow-auto">
                      {position.rewards.map((reward, rewardIndex) => (
                        <div key={rewardIndex} className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            {reward.logoUrl && (
                              <img src={reward.logoUrl} alt={reward.symbol} className="w-4 h-4 rounded-full" />
                            )}
                            <span>{reward.symbol}</span>
                          </div>
                          <span className="font-semibold">{formatNumber(reward.amount, 6)}</span>
                        </div>
                      ))}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}
          {position.rewards.length > 0 && position.rewardsValueUSD > 0 && (
            <button
              className="px-3 py-1 bg-success text-success-foreground rounded text-sm font-semibold disabled:opacity-60"
              onClick={handleClaimRewards}
              disabled={isClaiming}
            >
              {isClaiming ? 'Claiming...' : 'Claim'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function ThalaPositions() {
  const { account } = useWallet();
  const [positions, setPositions] = useState<ThalaPosition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPositions = async () => {
    if (!account?.address) {
      setPositions([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/protocols/thala/userPositions?address=${account.address}`);

      if (!response.ok) {
        throw new Error(`API returned status ${response.status}`);
      }

      const rawData = await response.json();
      if (rawData.success && Array.isArray(rawData.data)) {
        const sortedPositions = [...rawData.data].sort((a, b) => (b.positionValueUSD || 0) - (a.positionValueUSD || 0));
        setPositions(sortedPositions);
      } else {
        setPositions([]);
      }
    } catch (err) {
      console.error('Error loading Thala positions:', err);
      setError('Failed to load positions');
      setPositions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPositions();

    const handleRefresh: EventListener = (evt) => {
      const event = evt as CustomEvent<any>;
      if (event?.detail?.protocol === 'thala') {
        if (event.detail.data && Array.isArray(event.detail.data)) {
          setPositions(event.detail.data);
        } else {
          void loadPositions();
        }
      }
    };

    window.addEventListener('refreshPositions', handleRefresh);
    return () => {
      window.removeEventListener('refreshPositions', handleRefresh);
    };
  }, [account?.address]);

  if (loading) {
    return <div>Loading positions...</div>;
  }

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

  if (positions.length === 0) {
    return null;
  }

  const totalValue = positions.reduce((sum, position) => sum + (position.positionValueUSD || 0), 0);
  const totalRewards = positions.reduce((sum, position) => sum + (position.rewardsValueUSD || 0), 0);

  return (
    <div className="w-full mb-6 py-2">
      <div className="space-y-4 text-base">
        {positions.map((position, index) => (
          <ThalaPositionCard key={`${position.positionId}-${index}`} position={position} index={index} />
        ))}
        <div className="pt-6 pb-6">
          {/* Desktop layout */}
          <div className="hidden md:block">
            <div className="flex items-center justify-between">
              <span className="text-xl">Total assets in Thala:</span>
              <span className="text-xl text-primary font-bold">{formatCurrency(totalValue)}</span>
            </div>
            {totalRewards > 0 && (
              <div className="flex justify-end mt-2">
                <div className="text-right">
                  <div className="text-sm text-muted-foreground flex items-center gap-1 justify-end">
                    <span>💰</span>
                    <span>including rewards {formatCurrency(totalRewards)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
          {/* Mobile layout */}
          <div className="md:hidden space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-lg">Total assets in Thala:</span>
              <span className="text-lg text-primary font-bold">{formatCurrency(totalValue)}</span>
            </div>
            {totalRewards > 0 && (
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground flex items-center gap-1">
                  <span>💰</span>
                  <span>including rewards ${totalRewards.toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
