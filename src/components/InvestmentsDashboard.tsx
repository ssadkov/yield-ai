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
import { Search, Funnel, X, Gift } from "lucide-react";
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
import { CollapsibleProvider } from "@/contexts/CollapsibleContext";
import { useMobileManagement } from "@/contexts/MobileManagementContext";
import { useWalletStore } from "@/lib/stores/walletStore";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { ClaimRewardsBlock } from "@/components/ui/claim-rewards-block";
import { AirdropInfoTooltip } from "@/components/ui/airdrop-info-tooltip";
import { ClaimAllRewardsModal } from "@/components/ui/claim-all-rewards-modal";

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showOnlyStablePools, setShowOnlyStablePools] = useState(true);
  const [activeTab, setActiveTab] = useState<"lite" | "pro">("lite");
  const { selectedProtocol, setSelectedProtocol } = useProtocol();
  
  // New states for progressive loading
  const [protocolsLoading, setProtocolsLoading] = useState<Record<string, boolean>>({});
  const [protocolsError, setProtocolsError] = useState<Record<string, string | null>>({});
  const [protocolsData, setProtocolsData] = useState<Record<string, InvestmentData[]>>({});
  const [protocolsLogos, setProtocolsLogos] = useState<Record<string, string>>({});
  const [isClient, setIsClient] = useState(false);
  const [claimModalOpen, setClaimModalOpen] = useState(false);
  const [summary, setSummary] = useState<any>(null);

  const [showSearchOptions, setShowSearchOptions] = useState(false);
  const [searchByProtocols, setSearchByProtocols] = useState(false);
  const [selectedFilterProtocols, setSelectedFilterProtocols] = useState<string[]>([]);
  
  const { state, handleDrop, validateDrop } = useDragDrop();
  const { getClaimableRewardsSummary, fetchRewards, fetchPositions, rewardsLoading, rewards } = useWalletStore();
  const { account } = useWallet();
  const { setActiveTab: setMobileTab } = useMobileManagement();

  // Ensure we're on client side
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Load rewards and positions data when wallet is connected
  useEffect(() => {
    if (account?.address) {
      fetchRewards(account.address.toString());
      fetchPositions(account.address.toString(), ['hyperion']); // Load Hyperion positions for claim all
    }
  }, [account?.address, fetchRewards, fetchPositions]);

  // Load summary when rewards change
  useEffect(() => {
    const loadSummary = async () => {
      if (account?.address) {
        const summaryData = await getClaimableRewardsSummary();
        setSummary(summaryData);
      }
    };
    loadSummary();
  }, [account?.address, getClaimableRewardsSummary, rewardsLoading, rewards]);

  const getTokenInfo = (asset: string, tokenAddress?: string): Token | undefined => {
    if (tokenAddress) {
      // Normalize addresses by removing leading zeros after 0x
      const normalizeAddress = (addr: string) => {
        if (!addr || !addr.startsWith('0x')) return addr;
        return '0x' + addr.slice(2).replace(/^0+/, '') || '0x0';
      };
      
      const normalizedTokenAddress = normalizeAddress(tokenAddress);
      
      return (tokenList.data.data as Token[]).find(token => {
        const normalizedTokenListAddress = normalizeAddress(token.tokenAddress || '');
        const normalizedFaAddress = normalizeAddress(token.faAddress || '');
        
        return normalizedTokenListAddress === normalizedTokenAddress || 
               normalizedFaAddress === normalizedTokenAddress;
      });
    }
    return undefined;
  };

  const getProvider = (item: InvestmentData): string => {
    if (item.provider !== 'Unknown') return item.provider;
    
    const tokenInfo = getTokenInfo(item.asset, item.token);
    return tokenInfo?.bridge || 'Unknown';
  };

  const isStablePool = (item: InvestmentData): boolean => {
    // Для DEX-пулов проверяем, являются ли они стабильными парами
    if (item.token1Info && item.token2Info) {
      const symbol1 = item.token1Info.symbol.toLowerCase();
      const symbol2 = item.token2Info.symbol.toLowerCase();
      
      // Проверяем стабильные токены
      const stableTokens = ['usdt', 'usdc', 'dai', 'busd', 'tusd', 'gusd', 'frax', 'usd1', 'usda'];
      const isStable1 = stableTokens.some(token => symbol1.includes(token));
      const isStable2 = stableTokens.some(token => symbol2.includes(token));
      
      // Если оба токена стабильные, это стабильная пара
      if (isStable1 && isStable2) {
        return true;
      }
      
      // Ищем совпадающие символы (минимум 3 символа подряд) для связанных токенов
      // Например: kAPT/APT, thAPT/APT, TruAPT/APT
      for (let i = 0; i <= symbol1.length - 3; i++) {
        const substring = symbol1.substring(i, i + 3);
        if (symbol2.includes(substring)) {
          return true;
        }
      }
      
      // Также проверяем в обратном направлении
      for (let i = 0; i <= symbol2.length - 3; i++) {
        const substring = symbol2.substring(i, i + 3);
        if (symbol1.includes(substring)) {
          return true;
        }
      }
    }
    
    // Для лендинговых пулов (не DEX) считаем стабильными
    if (!item.token1Info && !item.token2Info) {
      return true;
    }
    
    // Echelon пулы считаем стабильными (они все лендинговые)
    if (item.protocol === 'Echelon') {
      return true;
    }
    
    // Kofi Finance стейкинг-пулы считаем стабильными
    if (item.protocol === 'Kofi Finance' && item.isStakingPool) {
      return true;
    }
    
    return false;
  };
  
  const handleProtocolSelect = (protocolName: string) => {
    setSelectedFilterProtocols(prev => {
      if (prev.includes(protocolName)) {
        // Удаляем протокол, если уже выбран
        return prev.filter(p => p !== protocolName);
      } else {
        // Добавляем протокол
        return [...prev, protocolName];
      }
    });
	setSearchByProtocols(true);
    setSearchQuery(''); // Очищаем поле поиска
    setShowSearchOptions(false); // Закрываем окно опций
  };

  // Функция для обработки ввода в поле поиска
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    //if (value) {
      //setSelectedFilterProtocol('');
	  //setSearchByProtocols(false);
    //}
  };
  
  // Clear protocol filter
  const clearSearchByProtocols = (value: boolean) => {
    setSelectedFilterProtocols([]);
	setSearchByProtocols(false);
	setShowSearchOptions(false);
  }

  // Start loading immediately when component mounts (only on client)
  useEffect(() => {
    if (!isClient) return;
    if (typeof window === 'undefined') return; // Extra check for SSR
    
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Initialize loading states for all protocols
        const initialLoadingState = {
          'Hyperion': true,
          'Tapp Exchange': true,
          'Auro Finance': true,
          'Amnis Finance': true,
          'Kofi Finance': true,
          'Echelon': true,
          'Aave': true,
          'Moar Market': true,
          'Earnium': true
        };
        setProtocolsLoading(initialLoadingState);
        setProtocolsError({});
        setProtocolsData({});

        // Define protocol endpoints
        const protocolEndpoints = [
          {
            name: 'Hyperion',
            url: '/api/protocols/hyperion/pools',
			logoUrl: '/protocol_ico/hyperion.png',
            transform: (data: any) => {
              const filtered = (data.data || [])
                .filter((pool: any) => {
                  const dailyVolume = parseFloat(pool.dailyVolumeUSD || "0");
                  return dailyVolume > 1000;
                });
              
              return filtered.map((pool: any) => {
                const feeAPR = parseFloat(pool.feeAPR || "0");
                const farmAPR = parseFloat(pool.farmAPR || "0");
                const totalAPY = feeAPR + farmAPR;
                
                const token1Info = pool.pool?.token1Info || pool.token1Info;
                const token2Info = pool.pool?.token2Info || pool.token2Info;
                
                return {
                  asset: `${token1Info?.symbol || 'Unknown'}/${token2Info?.symbol || 'Unknown'}`,
                  provider: 'Hyperion',
                  totalAPY: totalAPY,
                  depositApy: totalAPY,
                  borrowAPY: 0,
                  token: pool.poolId || pool.id,
                  protocol: 'Hyperion',
                  dailyVolumeUSD: parseFloat(pool.dailyVolumeUSD || "0"),
                  tvlUSD: parseFloat(pool.tvlUSD || "0"),
                  token1Info: token1Info,
                  token2Info: token2Info
                };
              });
            }
          },
          {
            name: 'Tapp Exchange',
            url: '/api/protocols/tapp/pools',
			logoUrl: '/protocol_ico/tappexchange.png',
            transform: (data: any) => {
              const filtered = (data.data || [])
                .filter((pool: any) => {
                  const dailyVolume = parseFloat(pool.volume_7d || "0") / 7;
                  return dailyVolume > 1000;
                });
              
              return filtered.map((pool: any) => {
                const totalAPY = parseFloat(pool.apr || "0") * 100;
                
                const token1Info = {
                  symbol: pool.token_a || 'Unknown',
                  name: pool.token_a || 'Unknown',
                  logoUrl: pool.tokens?.[0]?.img || undefined,
                  decimals: 8
                };
                
                const token2Info = {
                  symbol: pool.token_b || 'Unknown',
                  name: pool.token_b || 'Unknown',
                  logoUrl: pool.tokens?.[1]?.img || undefined,
                  decimals: 8
                };
                
                const tokensInfo = Array.isArray(pool.tokens)
                  ? pool.tokens.slice(0, 3).map((t: any) => ({
                      symbol: t?.symbol || 'Unknown',
                      name: t?.symbol || 'Unknown',
                      logoUrl: t?.img || undefined,
                      decimals: 8
                    }))
                  : undefined;
                
                const assetSymbols = Array.isArray(pool.tokens)
                  ? pool.tokens.slice(0, 3).map((t: any) => t?.symbol || 'Unknown').join('/')
                  : `${token1Info.symbol}/${token2Info.symbol}`;

                return {
                  asset: assetSymbols,
                  provider: 'Tapp Exchange',
                  totalAPY: totalAPY,
                  depositApy: totalAPY,
                  borrowAPY: 0,
                  token: pool.pool_id || pool.poolId,
                  protocol: 'Tapp Exchange',
                  dailyVolumeUSD: parseFloat(pool.volume_7d || "0") / 7,
                  tvlUSD: parseFloat(pool.tvl || "0"),
                  token1Info: token1Info,
                  token2Info: token2Info,
                  tokensInfo: tokensInfo,
                  poolType: 'DEX',
                  feeTier: parseFloat(pool.fee_tier || "0"),
                  volume7d: parseFloat(pool.volume_7d || "0")
                };
              });
            }
          },
          {
            name: 'Auro Finance',
            url: '/api/protocols/auro/pools',
			logoUrl: '/protocol_ico/auro.png',
            transform: (data: any) => {
              const collateralPools = (data.data || [])
                .filter((pool: any) => pool.type === 'COLLATERAL')
                .filter((pool: any) => {
                  const tvl = parseFloat(pool.tvl || "0");
                  const totalAPY = (pool.totalSupplyApr || 0);
                  return tvl > 1000 && totalAPY > 0;
                });
              
              return collateralPools.map((pool: any) => {
                const supplyApr = parseFloat(pool.supplyApr || "0");
                const supplyIncentiveApr = parseFloat(pool.supplyIncentiveApr || "0");
                const stakingApr = parseFloat(pool.stakingApr || "0");
                const totalAPY = supplyApr + supplyIncentiveApr + stakingApr;
                
                return {
                  asset: pool.collateralTokenSymbol || 'Unknown',
                  provider: 'Auro Finance',
                  totalAPY: totalAPY,
                  depositApy: totalAPY,
                  borrowAPY: 0,
                  token: pool.collateralTokenAddress || pool.poolAddress,
                  protocol: 'Auro Finance',
                  tvlUSD: parseFloat(pool.tvl || "0"),
                  poolType: 'Lending',
                  originalPool: pool
                };
              });
            }
          },
          {
            name: 'Amnis Finance',
            url: '/api/protocols/amnis/pools',
			logoUrl: '/protocol_ico/amnis.png',
            transform: (data: any) => {
              const pools = data.pools || [];
              
              return pools.map((pool: any) => {
                return {
                  asset: pool.asset || 'Unknown',
                  provider: 'Amnis Finance',
                  totalAPY: pool.apr || 0,
                  depositApy: pool.apr || 0,
                  borrowAPY: 0,
                  token: pool.token || '',
                  protocol: 'Amnis Finance',
                  poolType: 'Staking',
                  stakingToken: pool.stakingToken,
                  totalStaked: pool.totalStaked,
                  minStake: pool.minStake,
                  maxStake: pool.maxStake,
                  isActive: pool.isActive
                };
              });
            }
          },
          {
            name: 'Kofi Finance',
            url: '/api/protocols/kofi/pools',
			logoUrl: '/protocol_ico/kofi.png',
            transform: (data: any) => {
              const pools = data.data || [];
              
              return pools.map((pool: any) => {
                return {
                  asset: pool.asset || 'Unknown',
                  provider: pool.provider || 'Kofi Finance',
                  totalAPY: pool.totalAPY || 0,
                  depositApy: pool.depositApy || 0,
                  borrowAPY: pool.borrowAPY || 0,
                  token: pool.token || '',
                  protocol: pool.protocol || 'Kofi Finance',
                  poolType: pool.poolType || 'Staking',
                  tvlUSD: pool.tvlUSD || 0,
                  dailyVolumeUSD: pool.dailyVolumeUSD || 0,
                  // KoFi-specific fields
                  stakingApr: pool.stakingApr,
                  isStakingPool: pool.isStakingPool,
                  stakingToken: pool.stakingToken,
                  underlyingToken: pool.underlyingToken,
                  // Echelon-specific data
                  supplyCap: pool.supplyCap,
                  borrowCap: pool.borrowCap,
                  supplyRewardsApr: pool.supplyRewardsApr,
                  borrowRewardsApr: pool.borrowRewardsApr,
                  marketAddress: pool.marketAddress,
                  totalSupply: pool.totalSupply,
                  totalBorrow: pool.totalBorrow
                };
              });
            }
          },
          {
            name: 'Echelon',
            url: '/api/protocols/echelon/v2/pools',
			logoUrl: '/protocol_ico/echelon.png',
            transform: (data: any) => {
              const pools = data.data || [];
              
              return pools.map((pool: any) => {
                return {
                  asset: pool.asset || 'Unknown',
                  provider: pool.provider || 'Echelon',
                  totalAPY: pool.totalAPY || 0,
                  borrowAPY: pool.borrowAPY || 0,
                  token: pool.token || '',
                  protocol: 'Echelon',
                  poolType: pool.poolType || 'Lending',
                  tvlUSD: pool.tvlUSD || 0,
                  dailyVolumeUSD: pool.dailyVolumeUSD || 0,
                  // Echelon-specific fields
                  supplyCap: pool.supplyCap,
                  borrowCap: pool.borrowCap,
                  supplyRewardsApr: pool.supplyRewardsApr,
                  borrowRewardsApr: pool.borrowRewardsApr,
                  marketAddress: pool.marketAddress,
                  totalSupply: pool.totalSupply,
                  totalBorrow: pool.totalBorrow,
                  // APR breakdown fields
                  depositApy: pool.depositApy || 0,
                  stakingApr: pool.stakingApr,
                  totalSupplyApr: pool.totalSupplyApr || 0,
                  // Individual APR components for tooltip
                  lendingApr: pool.lendingApr || 0,
                  stakingAprOnly: pool.stakingAprOnly || 0,
                  // Note: LTV fields not available in current API response
                };
              });
            }
          },
          {
            name: 'Aave',
            url: '/api/protocols/aave/pools',
			logoUrl: '/protocol_ico/aave.ico',
            transform: (data: any) => {
              const pools = data.data || [];
              
              return pools.map((pool: any) => {
                return {
                  asset: pool.asset || 'Unknown',
                  provider: pool.provider || 'Aave',
                  totalAPY: pool.totalAPY || 0,
                  depositApy: pool.depositApy || 0,
                  borrowAPY: pool.borrowAPY || 0,
                  token: pool.token || '',
                  protocol: pool.protocol || 'Aave',
                  poolType: pool.poolType || 'Lending',
                  // Добавить недостающие поля
                  tvlUSD: pool.tvlUSD || 0,
                  dailyVolumeUSD: pool.dailyVolumeUSD || 0,
                  // AAVE-специфичные поля
                  liquidityRate: pool.liquidityRate,
                  variableBorrowRate: pool.variableBorrowRate,
                  decimals: pool.decimals,
                  marketAddress: pool.marketAddress || pool.token
                };
              });
            }
          },
          {
            name: 'Moar Market',
            url: '/api/protocols/moar/pools',
			logoUrl: '/protocol_ico/moar-market-logo-primary.png',
            transform: (data: any) => {
              console.log('🔍 Moar Market transform called with data:', data);
              const pools = data.data || [];
              console.log('📊 Moar Market pools count:', pools.length);
              
              return pools.map((pool: any) => {
                // API returns percentages, use as is for display
                const totalAPY = pool.totalAPY || 0;
                const depositApy = pool.depositApy || 0;
                const interestRateComponent = pool.interestRateComponent || 0;
                const farmingAPY = pool.farmingAPY || 0;
                
                console.log('📈 Moar Market pool:', pool.asset, 'APR:', totalAPY);
                
                return {
                  asset: pool.asset || 'Unknown',
                  provider: pool.provider || 'Moar Market',
                  totalAPY: totalAPY,
                  depositApy: depositApy,
                  borrowAPY: pool.borrowAPY || 0,
                  token: pool.token || '',
                  protocol: pool.protocol || 'Moar Market',
                  poolType: pool.poolType || 'Lending',
                  tvlUSD: pool.tvlUSD || 0,
                  dailyVolumeUSD: pool.dailyVolumeUSD || 0,
                  // Moar Market-specific fields
                  poolId: pool.poolId,
                  interestRateComponent: interestRateComponent,
                  farmingAPY: farmingAPY,
                  utilization: pool.utilization,
                  totalBorrows: pool.totalBorrows,
                  totalDeposits: pool.totalDeposits,
                  marketAddress: pool.marketAddress || pool.token
                };
              });
            }
          },
          {
            name: 'Earnium',
            url: '/api/protocols/earnium/pools',
			logoUrl: '/protocol_ico/earnium.png',
            transform: (data: any) => {
              const pools = data.data || [];
              
              return pools.map((pool: any) => {
                
                // Helper function to find token by address in tokenList.json
                const findTokenByAddress = (address: string) => {
                  if (!address) return null;
                  const tokens = require('@/lib/data/tokenList.json').data?.data || [];
                  const found = tokens.find((t: any) => {
                    const fa = t.faAddress ? t.faAddress.toLowerCase() : null;
                    const coin = t.tokenAddress ? t.tokenAddress.toLowerCase() : null;
                    const addr = address.toLowerCase();
                    return fa === addr || coin === addr;
                  });
                  return found;
                };

                // Create token info objects for DEX display
                // Try to find token by address first, then fallback to Earnium data
                const token0FromList = pool.token0?.address ? findTokenByAddress(pool.token0.address) : null;
                const token1FromList = pool.token1?.address ? findTokenByAddress(pool.token1.address) : null;
                
                const token1Info = {
                  symbol: pool.token0?.symbol || 'Unknown',
                  name: pool.token0?.name || 'Unknown',
                  logoUrl: token0FromList?.logoUrl || pool.token0?.icon_uri || undefined,
                  decimals: pool.token0?.decimals || 8
                };
                
                const token2Info = {
                  symbol: pool.token1?.symbol || 'Unknown',
                  name: pool.token1?.name || 'Unknown',
                  logoUrl: token1FromList?.logoUrl || pool.token1?.icon_uri || undefined,
                  decimals: pool.token1?.decimals || 8
                };
                
                return {
                  asset: pool.asset || 'Unknown',
                  provider: 'Earnium',
                  totalAPY: pool.totalAPY || 0,
                  depositApy: pool.depositApy || 0,
                  borrowAPY: 0, // DEX pools don't have borrowing
                  token: pool.token || '',
                  protocol: 'Earnium',
                  poolType: pool.poolType || 'DEX', // 'Stable' or 'Volatile'
                  tvlUSD: pool.tvlUSD || 0,
                  dailyVolumeUSD: pool.dailyVolumeUSD || 0,
                  // DEX-specific fields for logo display
                  token1Info: token1Info,
                  token2Info: token2Info,
                  feeTier: pool.feeTier,
                  // APR breakdown for tooltip
                  aprBreakdown: pool.aprBreakdown,
                  // Additional Earnium-specific data
                  poolId: pool.poolId,
                  symbol: pool.symbol,
                  bestSubPool: pool.bestSubPool,
                  subPools: pool.subPools
                };
              });
            }
          }
        ];

		const initialLogosState = protocolEndpoints.reduce((acc, endpoint) => {
          acc[endpoint.name] = endpoint.logoUrl || '';
          return acc;
        }, {} as Record<string, string>);

        setProtocolsLogos(initialLogosState);

        // Fetch all protocols in parallel
        const fetchPromises = protocolEndpoints.map(async (endpoint) => {
          try {
            console.log(`🔍 Fetching data for ${endpoint.name} from ${endpoint.url}`);
            
            const response = await fetch(endpoint.url, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json'
              }
            });

            if (!response.ok) {
              throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            const transformedData = endpoint.transform(data);

            // Update state progressively
            setProtocolsData(prev => ({
              ...prev,
              [endpoint.name]: transformedData
            }));
			
			setProtocolsLogos(prev => ({
             ...prev,
             [endpoint.name]: endpoint.logoUrl
            }));
            
            setProtocolsLoading(prev => ({
              ...prev,
              [endpoint.name]: false
            }));
            
            return { name: endpoint.name, data: transformedData, success: true };
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error(`❌ Error fetching ${endpoint.name}:`, error);
            
            setProtocolsError(prev => ({
              ...prev,
              [endpoint.name]: errorMessage
            }));
			
			setProtocolsLogos(prev => ({
             ...prev,
             [endpoint.name]: endpoint.logoUrl
            }));

            setProtocolsLoading(prev => ({
              ...prev,
              [endpoint.name]: false
            }));
            
            return { name: endpoint.name, data: [], success: false, error };
          }
        });
	
        // Wait for all promises to settle
        const results = await Promise.allSettled(fetchPromises);
        
        // Combine all successful results
        const allPools: InvestmentData[] = [];
        results.forEach((result) => {
          if (result.status === 'fulfilled' && result.value.success) {
            allPools.push(...result.value.data);
          }
        });
        
        setData(allPools);
        setLoading(false);
        
        
      } catch (error) {
        setError('Failed to load investment opportunities');
        setLoading(false);
      }
    };

    fetchData();
  }, [isClient]);

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
    }
  };

  const getDropZoneClassName = (investment: InvestmentData) => {
    if (!state.dragData) {
      return "transition-colors hover:bg-accent/50";
    }

    const validation = validateDrop(state.dragData, investment);
    const protocol = getProtocolByName(investment.protocol);

    // In Pro tab, pools with external deposit (only via link) must remain red
    if (activeTab === 'pro' && protocol && protocol.depositType !== 'native') {
      return "transition-colors bg-error-muted border-error hover:bg-error-muted/80";
    }

    if (validation.isValid) {
      // Direct deposit (same token)
      return "transition-colors bg-success-muted border-success hover:bg-success-muted/80";
    }

    if ((validation as any).requiresSwap) {
      // Requires swap + deposit → highlight in yellow
      return "transition-colors bg-warning-muted border-warning hover:bg-warning-muted/80";
    }

    // Invalid drop
    return "transition-colors bg-error-muted border-error hover:bg-error-muted/80";
  };

  // Combine all loaded protocol data
  const allLoadedData = Object.values(protocolsData).flat();
  
  
  const topInvestments = [...allLoadedData]
    .sort((a, b) => b.totalAPY - a.totalAPY)
    .slice(0, 3);

  const filteredData = allLoadedData.filter(item => {
    
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
	const displayProtocol = item.protocol;
	
	const result = (
      // Если нет выбранных протоколов ИЛИ протокол элемента есть в выбранных
      (selectedFilterProtocols.length === 0 || 
       selectedFilterProtocols.some(protocol => 
         displayProtocol?.toLowerCase().includes(protocol.toLowerCase())
       )) &&
      // Поиск по символу
      (!searchQuery || displaySymbol.toLowerCase().includes(searchQuery.toLowerCase()))
    );
    
    return result;
	
	/*
	return (
      (!selectedFilterProtocol || displayProtocol?.toLowerCase().includes(selectedFilterProtocol.toLowerCase())) &&
      (!searchQuery || displaySymbol.toLowerCase().includes(searchQuery.toLowerCase()))
    );
	*/

    //if (searchByProtocols) {
	  //return displayProtocol?.toLowerCase().includes(selectedFilterProtocol.toLowerCase());
    //}

    //return displaySymbol.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Данные для текущей вкладки
  const currentTabData = activeTab === "lite" 
    ? allLoadedData.filter(item => {
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
    setSelectedProtocol(protocol);
  };

  // Don't render anything until we're on client side
  if (!isClient) {
    return (
      <div className={className}>
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
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-4 text-red-500">
        {error}
      </div>
    );
  }

  // Show loading indicators for protocols that are still loading
  const showLoadingIndicators = loading && Object.values(protocolsLoading).some(Boolean);
  //const protocolNames = Object.keys(protocolsData);
  const protocolNames = [...Object.keys(protocolsData)].sort((a, b) => a.localeCompare(b));

  if (showLoadingIndicators) {
    return (
      <div className={className}>
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
              
              {/* Protocol loading status */}
              <div className="mt-6">
                <h4 className="text-sm font-medium mb-3">Loading pools:</h4>
                <div className="space-y-2">
                  {Object.entries(protocolsLoading).map(([protocolName, isLoading]) => (
                    <div key={protocolName} className="flex items-center gap-2 text-sm">
                      {isLoading ? (
                        <>
                          <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse">
						    <Avatar className="w-3 h-3">
							  <img 
								src={protocolsLogos[protocolName]} 
								alt={protocolName} 
								className="object-contain bg-white" 
							  />
							</Avatar>
						  </div>
                          <span>Loading {protocolName}...</span>
                        </>
                      ) : protocolsError[protocolName] ? (
                        <>
                          <div className="w-3 h-3 bg-red-500 rounded-full">
						    <Avatar className="w-3 h-3">
							  <img 
								src={protocolsLogos[protocolName]} 
								alt={protocolName} 
								className="object-contain bg-white" 
							  />
							</Avatar>
						  </div>
                          <span className="text-red-500">{protocolName}: {protocolsError[protocolName]}</span>
                        </>
                      ) : (
                        <>
                          <div className="w-3 h-3 bg-green-500 rounded-full">
						    <Avatar className="w-3 h-3">
							  <img 
								src={protocolsLogos[protocolName]} 
								alt={protocolName} 
								className="object-contain bg-white" 
							  />
							</Avatar>
						  </div>
                          <span className="text-green-600">{protocolName}: {protocolsData[protocolName]?.length || 0} pools loaded</span>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  return (
    <div className={className}>
      {selectedProtocol && (
        <CollapsibleProvider>
          <ManagePositions 
            protocol={selectedProtocol} 
            onClose={() => {
              setSelectedProtocol(null);
              if (setMobileTab) {
                setMobileTab('assets');
              }
            }} 
          />
        </CollapsibleProvider>
      )}

              {/* Claim Rewards Block */}
        <ClaimRewardsBlock 
          summary={summary}
          onClaim={() => setClaimModalOpen(true)}
          loading={rewardsLoading}
        />

      <div className="mb-4 pl-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Ideas</h2>
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                {Object.values(protocolsLoading).filter(Boolean).length > 0 && (
                  <>
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                    <span>Loading {Object.values(protocolsLoading).filter(Boolean).length} protocols...</span>
                  </>
                )}
              </div>
              <span className="text-xs">
                ({Object.values(protocolsData).flat().length} pools loaded)
              </span>
            </div>
          )}
        </div>
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
                {allLoadedData
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
                           item.asset.toUpperCase().includes('DAI') ||
                           item.asset.toUpperCase().includes('SUSD');
                  })
                  .sort((a, b) => b.totalAPY - a.totalAPY)
                  .slice(0, 3)
                  .map((item, index) => {
                    const tokenInfo = getTokenInfo(item.asset, item.token);
                    const displaySymbol = tokenInfo?.symbol || item.asset;
                    const logoUrl = tokenInfo?.logoUrl;
                    const protocol = getProtocolByName(item.protocol);

                    // Check if this is a DEX pool with two or more tokens
                    const isDex = !!(item.token1Info && item.token2Info) || !!(item as any).tokensInfo?.length;

                    return (
                      <Card 
                        key={index}
                        className={cn("border-2", getDropZoneClassName(item))}
                        onDragOver={(e) => handleDragOver(e, item)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDropEvent(e, item)}
                      >
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2 w-full flex-wrap">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <div className="flex items-center gap-2">
                                    {isDex ? (
                                      // DEX pool display with up to three tokens
                                      <div className="flex items-center gap-2">
                                        <div className="flex">
                                          {(item as any).tokensInfo?.slice(0,3)?.map((t: any, idx: number) => (
                                            <Avatar key={idx} className={`w-6 h-6 ${idx > 0 ? '-ml-2' : ''}`}>
                                              {t.logoUrl ? (
                                                <img src={t.logoUrl} alt={t.symbol} className="object-contain" />
                                              ) : null}
                                            </Avatar>
                                          )) || (
                                            <>
                                              {item.token1Info?.logoUrl && (
                                                <Avatar className="w-6 h-6">
                                                  <img src={item.token1Info.logoUrl} alt={item.token1Info.symbol} className="object-contain" />
                                                </Avatar>
                                              )}
                                              {item.token2Info?.logoUrl && (
                                                <Avatar className="w-6 h-6 -ml-2">
                                                  <img src={item.token2Info.logoUrl} alt={item.token2Info.symbol} className="object-contain" />
                                                </Avatar>
                                              )}
                                            </>
                                          )}
                                        </div>
                                        <span>{((item as any).tokensInfo?.slice(0,3)?.map((t: any) => t.symbol) || [item.token1Info?.symbol, item.token2Info?.symbol]).filter(Boolean).join(' / ')}</span>
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
									  //<p className="text-xs">Price: ${tokenInfo.usdPrice}</p>
                                      tokenInfo && (
                                        <>
                                          <p className="text-xs">Name: {tokenInfo.name}</p>
                                          <p className="text-xs">Symbol: {tokenInfo.symbol}</p>
                                        </>
                                      )
                                    )}
                                    <p className="text-xs">Provider: {getProvider(item)}</p>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <div className="flex items-center gap-2 ml-auto shrink-0">
                              <Badge variant="outline">{item.protocol}</Badge>
                              {protocol?.airdropInfo && (
                                <AirdropInfoTooltip airdropInfo={protocol.airdropInfo} size="sm">
                                  <div className="flex items-center justify-center w-5 h-5 rounded-full bg-muted hover:bg-muted/80 transition-colors cursor-help">
                                    <Gift className="h-3 w-3 text-muted-foreground" />
                                  </div>
                                </AirdropInfoTooltip>
                              )}
                            </div>
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">{item.totalAPY?.toFixed(2) || "0.00"}%</div>
                          <p className="text-xs text-muted-foreground">Total APR</p>
                          <DepositButton 
                            protocol={protocol!} 
                            className="mt-4 w-full"
                            tokenIn={{
                              symbol: isDex ? (item.token1Info?.symbol || 'Unknown') : displaySymbol,
                              logo: isDex ? (item.token1Info?.logoUrl || '/file.svg') : (tokenInfo?.logoUrl || '/file.svg'),
                              decimals: isDex ? (item.token1Info?.decimals || 8) : (tokenInfo?.decimals || 8),
                              address: item.token
                            }}
                            balance={BigInt(1000000000)} // TODO: Get real balance
                            priceUSD={Number(tokenInfo?.usdPrice || 0)}
                            poolAddress={item.originalPool?.poolAddress}
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
                        <CardTitle className="flex items-center gap-2 w-full flex-wrap">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <div className="flex items-center gap-2">
                                  {isDex ? (
                                    // DEX pool display with up to three tokens
                                    <div className="flex items-center gap-2">
                                      <div className="flex">
                                        {(bestPool as any).tokensInfo?.slice(0,3)?.map((t: any, idx: number) => (
                                          <Avatar key={idx} className={`w-6 h-6 ${idx > 0 ? '-ml-2' : ''}`}>
                                            {t.logoUrl ? (
                                              <img src={t.logoUrl} alt={t.symbol} className="object-contain" />
                                            ) : null}
                                          </Avatar>
                                        )) || (
                                          <>
                                            {bestPool.token1Info?.logoUrl && (
                                              <Avatar className="w-6 h-6">
                                                <img src={bestPool.token1Info.logoUrl} alt={bestPool.token1Info.symbol} className="object-contain" />
                                              </Avatar>
                                            )}
                                            {bestPool.token2Info?.logoUrl && (
                                              <Avatar className="w-6 h-6 -ml-2">
                                                <img src={bestPool.token2Info.logoUrl} alt={bestPool.token2Info.symbol} className="object-contain" />
                                              </Avatar>
                                            )}
                                          </>
                                        )}
                                      </div>
                                      <span>{((bestPool as any).tokensInfo?.slice(0,3)?.map((t: any) => t.symbol) || [bestPool.token1Info?.symbol, bestPool.token2Info?.symbol]).filter(Boolean).join(' / ')}</span>
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
									//<p className="text-xs">Price: ${tokenInfo.usdPrice}</p>
                                    tokenInfo && (
                                      <>
                                        <p className="text-xs">Name: {tokenInfo.name}</p>
                                        <p className="text-xs">Symbol: {tokenInfo.symbol}</p>
                                      </>
                                    )
                                  )}
                                  <p className="text-xs">Provider: {getProvider(bestPool)}</p>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <div className="flex items-center gap-2 ml-auto shrink-0">
                            <Badge variant="outline">{bestPool.protocol}</Badge>
                            {protocol?.airdropInfo && (
                              <AirdropInfoTooltip airdropInfo={protocol.airdropInfo} size="sm">
                                <div className="flex items-center justify-center w-5 h-5 rounded-full bg-muted hover:bg-muted/80 transition-colors cursor-help">
                                  <Gift className="h-3 w-3 text-muted-foreground" />
                                </div>
                              </AirdropInfoTooltip>
                            )}
                          </div>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{bestPool.totalAPY?.toFixed(2) || "0.00"}%</div>
                        <p className="text-xs text-muted-foreground">Total APR</p>
                        <DepositButton 
                          protocol={protocol!} 
                          className="mt-4 w-full"
                          tokenIn={{
                            symbol: isDex ? (bestPool.token1Info?.symbol || 'Unknown') : displaySymbol,
                            logo: isDex ? (bestPool.token1Info?.logoUrl || '/file.svg') : (tokenInfo?.logoUrl || '/file.svg'),
                            decimals: isDex ? (bestPool.token1Info?.decimals || 8) : (tokenInfo?.decimals || 8),
                            address: bestPool.token
                          }}
                          balance={BigInt(1000000000)} // TODO: Get real balance
                          priceUSD={Number(tokenInfo?.usdPrice || 0)}
                          poolAddress={bestPool.originalPool?.poolAddress}
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
          <div className="flex flex-wrap items-center gap-2 mb-4">
		  
		  <div className="relative flex-1 max-w-md" onBlur={(e) => {
		    // Закрываем, если фокус ушёл за пределы контейнера
		    if (!e.currentTarget.contains(e.relatedTarget as Node)) setShowSearchOptions(false);
		  }}>
		  
		  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
		    
		  <div className="flex gap-1 min-w-[200px] w-full sm:min-w-0 sm:w-auto flex-none">
			<Input
		      placeholder="Search tokens..."
			  value={searchQuery}
		      onChange={(e) => handleSearchChange(e.target.value)}
			  onFocus={() => setShowSearchOptions(true)}
			  onClick={() => setShowSearchOptions(true)}
			  className="pl-8 max-w-[100%] min-w-[200px]"
	        />

			{showSearchOptions && (
			  <div
			    className="absolute left-0 top-full mt-1 w-full rounded-md border bg-background shadow-md z-50 p-3"
			    tabIndex={-1}
			  >
			    <div className="flex items-center space-x-2 relative">
				 
				  <div className="absolute -top-2 right-4 z-10">
				    <TooltipProvider>
				      <Tooltip>
				        <TooltipTrigger asChild>   
					      <button
					        key={"Clear Protocol"}
					        onClick={() => clearSearchByProtocols(false)}
						    className={`text-sm transition-colors cursor-pointer`}
					      >
						    Clear
					      </button>
						</TooltipTrigger>
						  <TooltipContent>
						    <p>Clear filter by protocol</p>
						  </TooltipContent>
					    </Tooltip>
					  </TooltipProvider>
				  </div> 
				  <div className="absolute -top-2 -right-4 z-10">
					  <TooltipProvider>
				        <Tooltip>
				          <TooltipTrigger asChild> 
							<Button
						      variant="ghost"
						      size="sm"
						      onClick={() => setShowSearchOptions(false)}
						      className="h-4 w-4 py-0 hover:bg-transparent hover:text-foreground/60 opacity-80 transition-colors cursor-pointer"
						    >
						      <X className={cn(
							   "h-3 w-3"
						      )} />
						    </Button>				      
						  </TooltipTrigger>
						  <TooltipContent>
						    <p>Close filter by protocol</p>
						  </TooltipContent>
					    </Tooltip>
					  </TooltipProvider>
				  </div>
				  <div className="flex flex-wrap gap-2 pt-10">
				    {protocolNames.map((protocolName) => (
				      <button
					    key={protocolName}
					    onClick={() => handleProtocolSelect(protocolName)}
						className={`px-3 py-1 text-sm border rounded-md transition-colors ${selectedFilterProtocols.includes(protocolName) ? 'bg-blue-500 text-white border-blue-500' : 'hover:bg-gray-100'}`}
					  >
				        {protocolName}
					  </button>
				    ))}
			      </div>
			    </div>
			  </div>
			)}
			</div>
		  </div>
            <div className="flex gap-1 flex-none">
              {['USD', 'APT', 'BTC', 'ETH'].map((token) => (
                <Button
                  key={token}
                  variant="outline"
                  size="sm"
                  onClick={() => handleSearchChange(token)}
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
                  <TableHead>
					Protocol
					{searchByProtocols ? (
				      <TooltipProvider>
				        <Tooltip>
				          <TooltipTrigger asChild>
					        <Button
						      variant="ghost"
						      size="sm"
						      onClick={() => setShowSearchOptions(true)}
						      className="h-4 w-4 p-0 hover:bg-transparent hover:text-foreground/60 opacity-80 transition-colors cursor-pointer"
						    >
						      <Funnel className={cn(
							   "h-3 w-3"
						      )} />
						    </Button>				      
						  </TooltipTrigger>
						  <TooltipContent>
						    <p>Filter by protocol</p>
						  </TooltipContent>
					    </Tooltip>
					  </TooltipProvider>
					) : (
					  <TooltipProvider>
				        <Tooltip>
				          <TooltipTrigger asChild>
					        <Button
						      variant="ghost"
						      size="sm"
						      onClick={() => setShowSearchOptions(true)}
						      className="h-4 w-4 p-0 text-muted-foreground hover:bg-transparent hover:text-foreground/60 opacity-80 transition-colors cursor-pointer"
						    >
						      <Funnel className={cn(
							   "h-3 w-3"
						      )} />
						    </Button>				      
						  </TooltipTrigger>
						  <TooltipContent>
						    <p>Filter by protocol</p>
						  </TooltipContent>
					    </Tooltip>
					  </TooltipProvider>
					)}
				</TableHead>
                  <TableHead>
                    <Tooltip>
                      <TooltipTrigger>Supply APR</TooltipTrigger>
                      <TooltipContent>APR - Annual % yield from supply</TooltipContent>
                    </Tooltip>
                  </TableHead>
                  <TableHead>
                    <Tooltip>
                      <TooltipTrigger>Borrow APR</TooltipTrigger>
                      <TooltipContent>APR - Annual % cost or reward from borrowing</TooltipContent>
                    </Tooltip>
                  </TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentTabData
                  .filter(item => {
                    const tokenInfo = getTokenInfo(item.asset, item.token);
                    const hasTokenInfo = !!tokenInfo;
                    const hasAssetColon = item.asset.includes('::');
                    const hasDexTokens = !!(item.token1Info && item.token2Info) || !!(item as any).tokensInfo?.length;
                    
                    
                    // Включаем все пулы: с tokenInfo, с :: в asset, DEX-пулы с token1Info/token2Info, Echelon пулы, или Moar Market пулы
                    return hasAssetColon || hasTokenInfo || hasDexTokens || item.protocol === 'Echelon' || item.protocol === 'Moar Market';
                  })
                  .sort((a, b) => b.totalAPY - a.totalAPY)
                  .map((item, index) => {
                    const tokenInfo = getTokenInfo(item.asset, item.token);
                    const displaySymbol = tokenInfo?.symbol || item.asset;
                    const logoUrl = tokenInfo?.logoUrl;
                    const protocol = getProtocolByName(item.protocol);

                    // Check if this is a DEX pool with two or more tokens
                    const isDex = !!(item.token1Info && item.token2Info) || !!(item as any).tokensInfo?.length;

                    
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
                                    // DEX pool display with up to three tokens
                                    <div className="flex items-center gap-2">
                                      <div className="flex">
                                        {(item as any).tokensInfo?.slice(0,3)?.map((t: any, idx: number) => (
                                          <Avatar key={idx} className={`w-6 h-6 ${idx > 0 ? '-ml-2' : ''}`}>
                                            {t.logoUrl ? (
                                              <img src={t.logoUrl} alt={t.symbol} className="object-contain" />
                                            ) : null}
                                          </Avatar>
                                        )) || (
                                          <>
                                            {item.token1Info?.logoUrl && (
                                              <Avatar className="w-6 h-6">
                                                <img src={item.token1Info.logoUrl} alt={item.token1Info.symbol} className="object-contain" />
                                              </Avatar>
                                            )}
                                            {item.token2Info?.logoUrl && (
                                              <Avatar className="w-6 h-6 -ml-2">
                                                <img src={item.token2Info.logoUrl} alt={item.token2Info.symbol} className="object-contain" />
                                              </Avatar>
                                            )}
                                          </>
                                        )}
                                      </div>
                                      <span>{((item as any).tokensInfo?.slice(0,3)?.map((t: any) => t.symbol) || [item.token1Info?.symbol, item.token2Info?.symbol]).filter(Boolean).join(' / ')}</span>
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
                                      {item.poolType && (
                                        <p className="text-xs">Pool Type: {item.poolType}</p>
                                      )}
                                      <p className="text-xs">Token 1: {item.token1Info?.symbol} ({item.token1Info?.name})</p>
                                      <p className="text-xs">Token 2: {item.token2Info?.symbol} ({item.token2Info?.name})</p>
                                      {item.dailyVolumeUSD && (
                                        <p className="text-xs">Volume: ${item.dailyVolumeUSD.toLocaleString()}</p>
                                      )}
                                      {item.tvlUSD && (
                                        <p className="text-xs">TVL: ${item.tvlUSD.toLocaleString()}</p>
                                      )}
                                      {item.aprBreakdown?.rewardTokens && item.aprBreakdown.rewardTokens.length > 0 && (
                                        <div className="mt-2">
                                          <p className="text-xs font-semibold">Reward Tokens:</p>
                                          {item.aprBreakdown.rewardTokens.slice(0, 3).map((reward: any, idx: number) => (
                                            <p key={idx} className="text-xs">
                                              {reward.tokenAddress?.slice(0, 6)}...{reward.tokenAddress?.slice(-4)}: {reward.apr.toFixed(2)}%
                                            </p>
                                          ))}
                                        </div>
                                      )}
                                    </>
                                  ) : (
                                    // Lending tooltip content (existing logic)
									//<p className="text-xs">Price: ${tokenInfo.usdPrice}</p>
                                    tokenInfo && (
                                      <>
                                        <p className="text-xs">Name: {tokenInfo.name}</p>
                                        <p className="text-xs">Symbol: {tokenInfo.symbol}</p>
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
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">
                              {item.protocol}
                            </Badge>
                            {protocol?.airdropInfo && (
                              <AirdropInfoTooltip airdropInfo={protocol.airdropInfo} size="sm">
                                <div className="flex items-center justify-center w-5 h-5 rounded-full bg-muted hover:bg-muted/80 transition-colors cursor-help">
                                  <Gift className="h-3 w-3 text-muted-foreground" />
                                </div>
                              </AirdropInfoTooltip>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {item.depositApy ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="cursor-help">
                                    {item.depositApy.toFixed(2)}%
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent className="bg-black text-white border-gray-700 max-w-xs">
                                  <div className="text-xs font-semibold mb-1">Supply APR Breakdown:</div>
                                  <div className="space-y-1">
                                    {(typeof item.lendingApr === 'number' && item.lendingApr > 0) && (
                                      <div className="flex justify-between">
                                        <span>Lending APR:</span>
                                        <span className="text-green-400">{item.lendingApr.toFixed(2)}%</span>
                                      </div>
                                    )}
                                    {(typeof item.stakingApr === 'number' && item.stakingApr > 0) && (
                                      <div className="flex justify-between">
                                        <span>Staking APR:</span>
                                        <span className="text-blue-400">{item.stakingApr.toFixed(2)}%</span>
                                      </div>
                                    )}
                                    {(typeof item.supplyRewardsApr === 'number' && item.supplyRewardsApr > 0) && (
                                      <div className="flex justify-between">
                                        <span>Rewards APR:</span>
                                        <span className="text-yellow-400">{item.supplyRewardsApr.toFixed(2)}%</span>
                                      </div>
                                    )}
                                    {/* Moar Market specific breakdown */}
                                    {(typeof item.interestRateComponent === 'number' && item.interestRateComponent > 0) && (
                                      <div className="flex justify-between">
                                        <span>Interest Rate:</span>
                                        <span className="text-green-400">{item.interestRateComponent.toFixed(2)}%</span>
                                      </div>
                                    )}
                                    {(typeof item.farmingAPY === 'number' && item.farmingAPY > 0) && (
                                      <div className="flex justify-between">
                                        <span>Farming APY:</span>
                                        <span className="text-yellow-400">{item.farmingAPY.toFixed(2)}%</span>
                                      </div>
                                    )}
                                    {/* Earnium DEX specific breakdown */}
                                    {item.aprBreakdown && item.aprBreakdown.breakdown && (
                                      <>
                                        {(typeof item.aprBreakdown.breakdown.tradingFees === 'number' && item.aprBreakdown.breakdown.tradingFees > 0) && (
                                          <div className="flex justify-between">
                                            <span>Trading Fees:</span>
                                            <span className="text-green-400">{item.aprBreakdown.breakdown.tradingFees.toFixed(2)}%</span>
                                          </div>
                                        )}
                                        {(typeof item.aprBreakdown.breakdown.rewards === 'number' && item.aprBreakdown.breakdown.rewards > 0) && (
                                          <div className="flex justify-between">
                                            <span>Rewards:</span>
                                            <span className="text-yellow-400">{item.aprBreakdown.breakdown.rewards.toFixed(2)}%</span>
                                          </div>
                                        )}
                                        {(typeof item.aprBreakdown.breakdown.subPoolRewards === 'number' && item.aprBreakdown.breakdown.subPoolRewards > 0) && (
                                          <div className="flex justify-between">
                                            <span>SubPool Rewards:</span>
                                            <span className="text-blue-400">{item.aprBreakdown.breakdown.subPoolRewards.toFixed(2)}%</span>
                                          </div>
                                        )}
                                      </>
                                    )}
                                    <div className="border-t border-gray-600 pt-1 mt-1">
                                      <div className="flex justify-between font-semibold">
                                        <span>Total:</span>
                                        <span className="text-white">{item.depositApy.toFixed(2)}%</span>
                                      </div>
                                    </div>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : "-"}
                        </TableCell>
                        <TableCell>{item.borrowAPY ? `${item.borrowAPY.toFixed(2)}%` : "-"}</TableCell>
                        <TableCell>
                          {isDex ? (
                            <Badge variant="secondary" className="text-xs">
                              {item.poolType || 'DEX'}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">
                              Lending
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div>
                            {protocol ? (
                              isDex ? (
                                // Для DEX-пулов - прямая ссылка на пул
                                <Button 
                                  variant="secondary"
                                  onClick={() => {
                                    if (item.protocol === 'Hyperion') {
                                      window.open(`https://hyperion.xyz/pool/${item.token}`, '_blank');
                                    } else if (item.protocol === 'Tapp Exchange') {
                                      window.open(`https://tapp.exchange/pool`, '_blank');
                                    } else if (item.protocol === 'Earnium') {
                                      // Используем адрес пула из API для формирования ссылки
                                      const poolAddress = item.token || item.poolId;
                                      window.open(`https://app.earnium.io/explore/pool/${poolAddress}`, '_blank');
                                    }
                                  }}
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
                                    logo: tokenInfo?.logoUrl || '/file.svg',
                                    decimals: tokenInfo?.decimals || 8,
                                    address: item.token
                                  }}
                                  balance={BigInt(1000000000)} // TODO: Get real balance
                                  priceUSD={Number(tokenInfo?.usdPrice || 0)}
        poolAddress={item.originalPool?.poolAddress}
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

      {/* Claim All Rewards Modal */}
      {summary && (
        <ClaimAllRewardsModal
          isOpen={claimModalOpen}
          onClose={() => setClaimModalOpen(false)}
          summary={summary}
          positions={useWalletStore.getState().positions.hyperion}
        />
      )}
    </div>
  );
} 