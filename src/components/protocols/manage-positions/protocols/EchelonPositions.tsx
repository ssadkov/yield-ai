'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import Image from "next/image";
import tokenList from "@/lib/data/tokenList.json";
import { Badge } from "@/shared/Badge/Badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useWithdraw } from "@/lib/hooks/useWithdraw";
import { WithdrawModal } from "@/components/ui/withdraw-modal";
import echelonMarkets from "@/lib/data/echelonMarkets.json";
import { useDragDrop } from "@/contexts/DragDropContext";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { PanoraPricesService } from "@/lib/services/panora/prices";
import { useClaimRewards } from "@/lib/hooks/useClaimRewards";
import { ClaimAllRewardsEchelonModal } from "@/components/ui/claim-all-rewards-echelon-modal";
import { DepositModal } from "@/components/ui/deposit-modal";
import { ProtocolKey } from "@/lib/transactions/types";
import { createDualAddressPriceMap } from "@/lib/utils/addressNormalization";
import { TokenInfoService } from "@/lib/services/tokenInfoService";
import { formatNumber, formatCurrency } from "@/lib/utils/numberFormat";
import {
  useEchelonPositions,
  useEchelonRewards,
  useEchelonPools,
  type EchelonPosition,
} from "@/lib/query/hooks/protocols/echelon";

type Position = EchelonPosition & { market?: string };

export function EchelonPositions() {
  const { account } = useWallet();
  const walletAddress = account?.address?.toString();

  const { data: positionsData = [], isLoading: loading, error: positionsError } = useEchelonPositions(walletAddress);
  const { data: rewardsData = [] } = useEchelonRewards(walletAddress);
  const { data: poolsResponse } = useEchelonPools();

  const positions: Position[] = positionsData;

  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showClaimAllModal, setShowClaimAllModal] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
  const [tokenPrices, setTokenPrices] = useState<Record<string, string>>({});
  const [fallbackTokenInfo, setFallbackTokenInfo] = useState<Record<string, any>>({});
  const { withdraw, isLoading: isWithdrawing } = useWithdraw();
  const { isLoading: isClaiming } = useClaimRewards();
  const { closePositionModal, closeAllModals } = useDragDrop();
  const isModalOpenRef = useRef(false);
  const pricesService = PanoraPricesService.getInstance();

  const error = positionsError ? "Failed to load Echelon positions" : null;

  const apyData = useMemo(() => {
    if (!poolsResponse?.data) return {} as Record<string, any>;
    const apyMapping: Record<string, any> = {};
    poolsResponse.data.forEach((pool: any) => {
      const poolData = {
        supplyAPY: pool.depositApy,
        borrowAPY: pool.borrowAPY,
        supplyRewardsApr: pool.supplyRewardsApr,
        borrowRewardsApr: pool.borrowRewardsApr,
        marketAddress: pool.marketAddress,
        asset: pool.asset,
        poolType: pool.poolType,
        hasSupply: pool.depositApy > 0,
        hasBorrow: pool.borrowAPY > 0,
        hasStaking: pool.stakingApr > 0,
        lendingApr: pool.lendingApr || 0,
        stakingAprOnly: pool.stakingAprOnly || 0,
        totalSupplyApr: pool.totalSupplyApr || pool.depositApy || 0,
        ltv: pool.ltv,
        lt: pool.lt,
        emodeLtv: pool.emodeLtv,
        emodeLt: pool.emodeLt,
      };
      if (pool.asset) {
        apyMapping[pool.asset] = poolData;
      }
      if (pool.token) {
        apyMapping[pool.token] = poolData;
      }
      if (pool.asset === "APT" && (pool as any).aptAlternativeAddresses) {
        (pool as any).aptAlternativeAddresses.forEach((alt: string) => {
          apyMapping[alt] = poolData;
        });
      }
    });
    return apyMapping;
  }, [poolsResponse?.data]);

  // Функция для нормализации адресов токенов
  const normalizeTokenAddress = (coinAddress: string): string => {
    if (coinAddress === '0xa' || coinAddress === '0x1') {
      return '0x1::aptos_coin::AptosCoin';
    }
    return coinAddress;
  };

  // Получаем цену токена из кэша (объявлено выше, чтобы использовать в getRewardTokenInfoHelper)
  const getTokenPrice = useCallback((coinAddress: string): string => {
    let cleanAddress = coinAddress;
    if (cleanAddress.startsWith('@')) cleanAddress = cleanAddress.slice(1);
    if (!cleanAddress.startsWith('0x')) cleanAddress = `0x${cleanAddress}`;
    const normalizeAddress = (addr: string) => {
      if (!addr || !addr.startsWith('0x')) return addr;
      return '0x' + addr.slice(2).replace(/^0+/, '') || '0x0';
    };
    const normalizedAddress = normalizeAddress(cleanAddress);
    return tokenPrices[cleanAddress] || tokenPrices[normalizedAddress] || '0';
  }, [tokenPrices]);

  // Функция для получения информации о токене наград (useCallback — стабильная ссылка, меньше ререндеров)
  const getRewardTokenInfoHelper = useCallback((tokenName: string) => {
    const token = (tokenList as any).data.data.find(
      (t: any) =>
        t.symbol.toLowerCase() === tokenName.toLowerCase() ||
        t.name.toLowerCase().includes(tokenName.toLowerCase())
    );
    if (!token) return undefined;
    return {
      address: token.tokenAddress,
      faAddress: token.faAddress,
      symbol: token.symbol,
      icon_uri: token.logoUrl,
      decimals: token.decimals,
      usdPrice: getTokenPrice(token.faAddress || token.tokenAddress || ''),
    };
  }, [getTokenPrice]);

  // Получаем все уникальные адреса токенов из позиций и наград
  const getAllTokenAddresses = useCallback(() => {
    const addresses = new Set<string>();

    // Normalize address function
    const normalizeAddress = (addr: string) => {
      if (!addr || !addr.startsWith('0x')) return addr;
      return '0x' + addr.slice(2).replace(/^0+/, '') || '0x0';
    };

    // Добавляем адреса токенов позиций
    positions.forEach(position => {
      let cleanAddress = position.coin;
      if (cleanAddress.startsWith('@')) {
        cleanAddress = cleanAddress.slice(1);
      }
      if (!cleanAddress.startsWith('0x')) {
        cleanAddress = `0x${cleanAddress}`;
      }

      // Add only normalized address (like Wallet does)
      addresses.add(normalizeAddress(cleanAddress));
    });

    // Добавляем адреса токенов наград
    rewardsData.forEach((reward) => {
      const tokenInfo = getRewardTokenInfoHelper(reward.token);
      if (tokenInfo?.faAddress) {
        addresses.add(normalizeAddress(tokenInfo.faAddress));
      }
      if (tokenInfo?.address) {
        addresses.add(normalizeAddress(tokenInfo.address));
      }
    });

    return Array.from(addresses);
  }, [positions, rewardsData, getRewardTokenInfoHelper]);

  // Расчет стоимости rewards
  const calculateRewardsValue = useCallback(() => {
    return rewardsData.reduce((sum, reward) => {
      const tokenInfo = getRewardTokenInfoHelper(reward.token);
      if (!tokenInfo) return sum;

      const price = getTokenPrice(tokenInfo.faAddress || tokenInfo.address || '');
      const value = price && price !== '0' ? reward.amount * parseFloat(price) : 0;

      return sum + value;
    }, 0);
  }, [rewardsData, tokenPrices]);

    // Расчет Health Factor
  const calculateHealthFactor = useCallback(() => {
    // Проверяем, есть ли borrow позиции
    const hasBorrowPositions = positions.some(p => p.type === 'borrow');
    if (!hasBorrowPositions) return null;

    // Собираем коллатераль (supply позиции)
    const collateral = positions.filter(p => p.type === 'supply');
    const liabilities = positions.filter(p => p.type === 'borrow');

    let accountMargin = 0;
    let totalLiabilities = 0;

    // Считаем account margin (коллатераль × LT)
    collateral.forEach(position => {
      const tokenInfo = getTokenInfo(position.coin);
      const amount = parseFloat(String(position.amount)) / (tokenInfo?.decimals ? 10 ** tokenInfo.decimals : 1e8);
      const price = getTokenPrice(position.coin);
      const value = price ? amount * parseFloat(price) : 0;

      // Получаем LT для токена
      let poolData = apyData[position.coin];
      if (!poolData) {
        const normalizedCoin = normalizeTokenAddress(position.coin);
        poolData = apyData[normalizedCoin];
      }
      if (!poolData && tokenInfo?.symbol) {
        poolData = apyData[tokenInfo.symbol];
      }
      const lt = poolData?.lt || 0.75; // fallback к 75% если LT недоступен

      accountMargin += value * lt;
    });

    // Считаем общую задолженность
    liabilities.forEach(position => {
      const tokenInfo = getTokenInfo(position.coin);
      const amount = parseFloat(String(position.amount)) / (tokenInfo?.decimals ? 10 ** tokenInfo.decimals : 1e8);
      const price = getTokenPrice(position.coin);
      const value = price ? amount * parseFloat(price) : 0;

      totalLiabilities += value;
    });

    // Если нет долгов, возвращаем null
    if (totalLiabilities <= 0) return null;

    const healthFactor = accountMargin / totalLiabilities;

    return {
      healthFactor,
      accountMargin,
      totalLiabilities,
      isLiquidatable: healthFactor < 1
    };
  }, [positions, apyData, tokenPrices, fallbackTokenInfo]);

  // Вспомогательные функции для Health Factor
  const getHealthFactorColor = (healthFactor: number) => {
    if (healthFactor >= 1.5) return 'text-green-500';
    if (healthFactor >= 1.2) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getHealthFactorStatus = (healthFactor: number) => {
    if (healthFactor >= 1.5) return 'Safe';
    if (healthFactor >= 1.2) return '';
    return 'Danger';
  };

  // Получаем цены токенов через Panora API с fallback к Echelon API
  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      const addresses = getAllTokenAddresses();
      if (addresses.length === 0 || !walletAddress) return;

      try {
        const response = await pricesService.getPrices(1, addresses);
        let prices: Record<string, string> = {};
        if (response.data) {
          prices = createDualAddressPriceMap(response.data);
          setTokenPrices(prices);
        }

        // Check for missing prices and try Echelon API fallback
        const missingPrices: string[] = [];
        addresses.forEach(addr => {
          const normalizedAddr = addr.replace(/^0+/, '0x') || '0x0';
          if (!prices[addr] && !prices[normalizedAddr]) {
            missingPrices.push(addr);
          }
        });

        if (missingPrices.length > 0) {
          const service = TokenInfoService.getInstance();
          const fallbackPrices: Record<string, string> = {};
          await Promise.all(
            missingPrices.map(async (addr) => {
              try {
                const info = await service.getTokenInfo(addr);
                if (info && info.price) {
                  fallbackPrices[addr] = info.price.toString();
                  const normalizedAddr = addr.replace(/^0+/, '0x') || '0x0';
                  fallbackPrices[normalizedAddr] = info.price.toString();
                }
              } catch (error) {
                console.warn('[EchelonPositions] Failed to get price for', addr, error);
              }
            })
          );
          if (Object.keys(fallbackPrices).length > 0) {
            setTokenPrices(prev => ({
              ...prev,
              ...fallbackPrices
            }));
          }
        }
      } catch (error) {
        console.error('Failed to fetch token prices:', error);
      }
    }, 1000); // Дебаунсинг 1 секунда

    return () => clearTimeout(timeoutId);
  }, [getAllTokenAddresses, pricesService, walletAddress]);

  const getTokenInfo = useCallback((coinAddress: string) => {
    const normalizeAddress = (addr: string) => {
      if (!addr || !addr.startsWith('0x')) return addr;
      return '0x' + addr.slice(2).replace(/^0+/, '') || '0x0';
    };
    const normalizedCoinAddress = normalizeAddress(coinAddress);

    if (fallbackTokenInfo[normalizedCoinAddress] || fallbackTokenInfo[coinAddress]) {
      const fallbackInfo = fallbackTokenInfo[normalizedCoinAddress] || fallbackTokenInfo[coinAddress];
      return {
        address: fallbackInfo.address,
        symbol: fallbackInfo.symbol,
        logoUrl: fallbackInfo.logoUrl,
        decimals: fallbackInfo.decimals,
        usdPrice: getTokenPrice(coinAddress),
      };
    }

    const token = (tokenList as any).data.data.find((t: any) => {
      const normalizedFaAddress = normalizeAddress(t.faAddress || '');
      const normalizedTokenAddress = normalizeAddress(t.tokenAddress || '');
      return normalizedFaAddress === normalizedCoinAddress ||
             normalizedTokenAddress === normalizedCoinAddress;
    });

    if (!token) return undefined;
    return {
      address: token.tokenAddress,
      symbol: token.symbol,
      logoUrl: token.logoUrl,
      decimals: token.decimals,
      usdPrice: getTokenPrice(coinAddress),
    };
  }, [fallbackTokenInfo, getTokenPrice]);

  // Load token info for unknown tokens using fallback APIs
  useEffect(() => {
    const loadUnknownTokens = async () => {
      if (positions.length === 0) return;

      const normalizeAddress = (addr: string) => {
        if (!addr || !addr.startsWith('0x')) return addr;
        return '0x' + addr.slice(2).replace(/^0+/, '') || '0x0';
      };

      // Find tokens not in tokenList
      const unknownTokens: string[] = [];
      positions.forEach(position => {
        const normalizedAddr = normalizeAddress(position.coin);

        // Skip if already in fallback cache
        if (fallbackTokenInfo[normalizedAddr] || fallbackTokenInfo[position.coin]) {
          return;
        }

        // Check if in tokenList
        const inTokenList = (tokenList as any).data.data.find((t: any) => {
          const normalizedFaAddress = normalizeAddress(t.faAddress || '');
          const normalizedTokenAddress = normalizeAddress(t.tokenAddress || '');
          return normalizedFaAddress === normalizedAddr || normalizedTokenAddress === normalizedAddr;
        });

        if (!inTokenList) {
          unknownTokens.push(position.coin);
        }
      });

      if (unknownTokens.length === 0) return;

      console.log('[EchelonPositions] Loading info for unknown tokens:', unknownTokens);

      // Load token info from protocol APIs
      const service = TokenInfoService.getInstance();
      const newTokenInfo: Record<string, any> = {};

      await Promise.all(
        unknownTokens.map(async (tokenAddr) => {
          try {
            const info = await service.getTokenInfo(tokenAddr);
            if (info) {
              const normalizedAddr = normalizeAddress(tokenAddr);
              newTokenInfo[normalizedAddr] = info;
              newTokenInfo[tokenAddr] = info; // Also store under original address
              console.log('[EchelonPositions] Loaded token info:', info.symbol, 'from', info.source);
            }
          } catch (error) {
            console.warn('[EchelonPositions] Failed to load token info for', tokenAddr, error);
          }
        })
      );

      if (Object.keys(newTokenInfo).length > 0) {
        setFallbackTokenInfo(prev => ({
          ...prev,
          ...newTokenInfo
        }));
      }
    };

    loadUnknownTokens();
  }, [positions]); // Removed fallbackTokenInfo from dependencies to prevent infinite loops

      // Общая логика получения market address для позиции (используется в deposit/withdraw)
  const getMarketAddressForPosition = useCallback((position: Position): string | undefined => {
    if (position.market) return position.market;
    let poolData = apyData[position.coin];
    if (!poolData) {
      const normalizedCoin = normalizeTokenAddress(position.coin);
      poolData = apyData[normalizedCoin];
    }
    if (!poolData) {
      const tokenInfo = getTokenInfo(position.coin);
      if (tokenInfo?.symbol) poolData = apyData[tokenInfo.symbol];
    }
    if (poolData?.marketAddress) return poolData.marketAddress;
    const normalizedCoin = normalizeTokenAddress(position.coin);
    const localMarket = echelonMarkets.markets.find((m: any) => m.coin === normalizedCoin);
    return localMarket?.market;
  }, [apyData, getTokenInfo]);

  // Получить APR для позиции (обновленная функция)
  const getApyForPosition = (position: any) => {
    // Ищем данные в APR маппинге по адресу токена
    let poolData = apyData[position.coin];

    // Если не найдено по адресу, попробуем найти по нормализованному адресу
    if (!poolData && position.coin) {
      const normalizedCoin = normalizeTokenAddress(position.coin);
      poolData = apyData[normalizedCoin];
    }

    // Если не найдено по нормализованному адресу, попробуем найти по символу токена
    if (!poolData && position.coin) {
      const tokenInfo = getTokenInfo(position.coin);
      if (tokenInfo?.symbol) {
        poolData = apyData[tokenInfo.symbol];
      }
    }

    if (poolData) {
      if (position.type === 'supply') {
        const apy = poolData.supplyAPY / 100; // Конвертируем из процентов в десятичную форму
        return apy;
      } else if (position.type === 'borrow') {
        const apy = poolData.borrowAPY / 100;
        return apy;
      }
    }
    return null;
  };

  // Сортируем позиции по значению от большего к меньшему (useMemo — не пересчитывать каждый рендер)
  const sortedPositions = useMemo(() => {
    return [...positions].sort((a, b) => {
      const tokenInfoA = getTokenInfo(a.coin);
      const tokenInfoB = getTokenInfo(b.coin);
      const amountA = parseFloat(String(a.amount)) / (tokenInfoA?.decimals ? 10 ** tokenInfoA.decimals : 1e8);
      const amountB = parseFloat(String(b.amount)) / (tokenInfoB?.decimals ? 10 ** tokenInfoB.decimals : 1e8);
      const priceA = getTokenPrice(a.coin);
      const priceB = getTokenPrice(b.coin);
      const valueA = priceA ? amountA * parseFloat(priceA) : 0;
      const valueB = priceB ? amountB * parseFloat(priceB) : 0;
      return valueB - valueA;
    });
  }, [positions, getTokenInfo, getTokenPrice]);

  // Общая сумма: supply плюсуем, borrow вычитаем, rewards плюсуем (вычисляем, без отдельного state)
  const totalValue = useMemo(() => {
    const positionsValue = sortedPositions.reduce((sum, position) => {
      const tokenInfo = getTokenInfo(position.coin);
      const amount = parseFloat(String(position.amount)) / (tokenInfo?.decimals ? 10 ** tokenInfo.decimals : 1e8);
      const price = getTokenPrice(position.coin);
      const value = price ? amount * parseFloat(price) : 0;
      if (position.type === 'borrow') {
        return sum - value;
      }
      return sum + value;
    }, 0);
    const rewardsValue = calculateRewardsValue();
    return positionsValue + rewardsValue;
  }, [sortedPositions, tokenPrices, calculateRewardsValue, fallbackTokenInfo]);

  // Обработчик открытия модального окна withdraw
  const handleWithdrawClick = (position: Position) => {
    setSelectedPosition(position);
    setShowWithdrawModal(true);
  };

  const handleDepositClick = (position: Position) => {
    setSelectedPosition(position);
    setShowDepositModal(true);
  };

  const handleWithdrawConfirm = async (amount: bigint) => {
    if (!selectedPosition) return;
    const marketAddress = getMarketAddressForPosition(selectedPosition);
    if (!marketAddress) {
      throw new Error('Market address not found for this token');
    }
    try {
      await withdraw('echelon', marketAddress, amount, selectedPosition.coin);
      setShowWithdrawModal(false);
      setSelectedPosition(null);
      isModalOpenRef.current = false;
      closePositionModal(selectedPosition.coin);
    } catch (error) {
      console.error('[EchelonPositions] Withdraw failed:', error);
    }
  };

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
    <div className="space-y-4 text-base">
      <ScrollArea>
        {sortedPositions.map((position, index) => {
          const tokenInfo = getTokenInfo(position.coin);
          const rawAmount = typeof position.amount === 'number' ? position.amount : parseFloat(position.amount);
          const amount = !isNaN(rawAmount) && tokenInfo?.decimals ? rawAmount / 10 ** tokenInfo.decimals : 0;
          const price = getTokenPrice(position.coin);
          const value = price ? formatCurrency(amount * parseFloat(price), 2) : 'N/A';
          const apy = getApyForPosition(position);
          const isBorrow = position.type === 'borrow';

          return (
                        <div
              key={`${position.coin}-${position.type ?? 'supply'}-${index}`}
              className={cn(
                'p-3 sm:p-4 border-b last:border-b-0 transition-colors'
              )}
              draggable={false}
            >
              {/* Desktop Layout */}
              <div className="hidden sm:flex justify-between items-center">
                <div className="flex items-center gap-2">
                  {tokenInfo?.logoUrl && (
                    <div className="w-8 h-8 relative">
                      <Image
                        src={tokenInfo.logoUrl}
                        alt={tokenInfo.symbol}
                        width={32}
                        height={32}
                        className="object-contain"
                      />
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="text-lg">{tokenInfo?.symbol || position.coin.substring(0, 4).toUpperCase()}</div>
                      <Badge
                        variant={isBorrow ? "danger" : "success"}
                        className="text-xs font-normal px-2 py-0.5 h-5"
                      >
                        {isBorrow ? 'Borrow' : 'Supply'}
                      </Badge>
                    </div>
                    <div className="text-base text-muted-foreground mt-0.5">
                      {price ? formatCurrency(parseFloat(price), 2) : 'N/A'}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center justify-between mb-1">
                    <Badge
                      variant={isBorrow ? "danger" : "success"}
                      className="text-xs font-normal px-2 py-0.5 h-5"
                    >
                      {apy !== null ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-help">
                                APR: {formatNumber(apy * 100, 2)}%
                              </span>
                            </TooltipTrigger>
                            <TooltipContent className="bg-popover text-popover-foreground border-border max-w-xs">
                              <div className="text-xs font-semibold mb-1">APR Breakdown:</div>
                              <div className="space-y-1">
                                {!isBorrow && apyData[position.coin]?.lendingApr > 0 && (
                                  <div className="flex justify-between">
                                    <span>Lending APR:</span>
                                    <span className="text-green-400">{formatNumber(apyData[position.coin].lendingApr, 2)}%</span>
                                  </div>
                                )}
                                {!isBorrow && apyData[position.coin]?.stakingAprOnly > 0 && (
                                  <div className="flex justify-between">
                                    <span>Staking APR:</span>
                                    <span className="text-blue-400">{formatNumber(apyData[position.coin].stakingAprOnly, 2)}%</span>
                                  </div>
                                )}
                                {!isBorrow && apyData[position.coin]?.supplyRewardsApr > 0 && (
                                  <div className="flex justify-between">
                                    <span>Rewards APR:</span>
                                    <span className="text-yellow-400">{formatNumber(apyData[position.coin].supplyRewardsApr, 2)}%</span>
                                  </div>
                                )}
                                <div className="border-t border-gray-600 pt-1 mt-1">
                                  <div className="flex justify-between font-semibold">
                                    <span>Total:</span>
                                    <span className="text-white">{formatNumber(apy * 100, 2)}%</span>
                                  </div>
                                </div>
                                {/* LTV Information */}
                                {apyData[position.coin]?.ltv && apyData[position.coin].ltv > 0 && (
                                  <div className="border-t border-gray-600 pt-1 mt-1">
                                    <div className="text-xs font-semibold mb-1 text-cyan-400">Collateral Info:</div>
                                    <div className="space-y-1">
                                      <div className="flex justify-between">
                                        <span>LTV:</span>
                                        <span className="text-cyan-400">{formatNumber(apyData[position.coin].ltv * 100, 0)}%</span>
                                      </div>
                                      {apyData[position.coin].lt && apyData[position.coin].lt > 0 && (
                                        <div className="flex justify-between">
                                          <span>Liquidation Threshold:</span>
                                          <span className="text-orange-400">{formatNumber(apyData[position.coin].lt * 100, 0)}%</span>
                                        </div>
                                      )}
                                      {apyData[position.coin].emodeLtv && apyData[position.coin].emodeLtv > 0 && (
                                        <div className="flex justify-between">
                                          <span>E-Mode LTV:</span>
                                          <span className="text-purple-400">{formatNumber(apyData[position.coin].emodeLtv * 100, 0)}%</span>
                                        </div>
                                      )}
                                      {apyData[position.coin].emodeLt && apyData[position.coin].emodeLt > 0 && (
                                        <div className="flex justify-between">
                                          <span>E-Mode LT:</span>
                                          <span className="text-pink-400">{formatNumber(apyData[position.coin].emodeLt * 100, 0)}%</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        'APR: N/A'
                      )}
                    </Badge>
                    <div className="text-lg font-bold text-right w-24">{value}</div>
                  </div>
                  <div className="text-base text-muted-foreground font-semibold">{formatNumber(amount, 4)}</div>
                  <div className="flex flex-col gap-1 mt-2">
                    {!isBorrow && (
                      <div className="flex gap-2 justify-end">
                        <Button
                          onClick={() => handleDepositClick(position)}
                          disabled={false}
                          size="sm"
                          variant="default"
                          className="h-10"
                        >
                          Deposit
                        </Button>
                        <Button
                          onClick={() => handleWithdrawClick(position)}
                          disabled={isWithdrawing}
                          size="sm"
                          variant="outline"
                          className="h-10"
                        >
                          {isWithdrawing ? 'Withdrawing...' : 'Withdraw'}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Mobile Layout */}
              <div className="sm:hidden space-y-3">
                {/* Header with token info and USD value */}
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    {tokenInfo?.logoUrl && (
                      <div className="w-6 h-6 relative">
                        <Image
                          src={tokenInfo.logoUrl}
                          alt={tokenInfo.symbol}
                          width={24}
                          height={24}
                          className="object-contain"
                        />
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-1">
                        <div className="text-base font-medium">{tokenInfo?.symbol || position.coin.substring(0, 4).toUpperCase()}</div>
                        <Badge
                          variant={isBorrow ? "danger" : "success"}
                          className="text-xs font-normal px-1.5 py-0.5 h-4"
                        >
                          {isBorrow ? 'Borrow' : 'Supply'}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {price ? formatCurrency(parseFloat(price), 2) : 'N/A'}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-right w-24">{value}</div>
                    <div className="text-sm text-muted-foreground">{formatNumber(amount, 4)}</div>
                  </div>
                </div>

                {/* APR Badge */}
                <div className="flex justify-center">
                  <Badge
                    variant={isBorrow ? "danger" : "success"}
                    className="text-xs font-normal px-2 py-0.5 h-5"
                  >
                    {apy !== null ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-help">
                              APR: {formatNumber(apy * 100, 2)}%
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="bg-popover text-popover-foreground border-border max-w-xs">
                            <div className="text-xs font-semibold mb-1">APR Breakdown:</div>
                            <div className="space-y-1">
                              {!isBorrow && apyData[position.coin]?.lendingApr > 0 && (
                                <div className="flex justify-between">
                                  <span>Lending APR:</span>
                                  <span className="text-green-400">{formatNumber(apyData[position.coin].lendingApr, 2)}%</span>
                                </div>
                              )}
                              {!isBorrow && apyData[position.coin]?.stakingAprOnly > 0 && (
                                <div className="flex justify-between">
                                  <span>Staking APR:</span>
                                  <span className="text-blue-400">{formatNumber(apyData[position.coin].stakingAprOnly, 2)}%</span>
                                </div>
                              )}
                              {!isBorrow && apyData[position.coin]?.supplyRewardsApr > 0 && (
                                <div className="flex justify-between">
                                  <span>Rewards APR:</span>
                                  <span className="text-yellow-400">{formatNumber(apyData[position.coin].supplyRewardsApr, 2)}%</span>
                                </div>
                              )}
                              <div className="border-t border-gray-600 pt-1 mt-1">
                                <div className="flex justify-between font-semibold">
                                  <span>Total:</span>
                                  <span className="text-white">{formatNumber(apy * 100, 2)}%</span>
                                </div>
                              </div>
                              {/* LTV Information */}
                              {apyData[position.coin]?.ltv && apyData[position.coin].ltv > 0 && (
                                <div className="border-t border-gray-600 pt-1 mt-1">
                                  <div className="text-xs font-semibold mb-1 text-cyan-400">Collateral Info:</div>
                                  <div className="space-y-1">
                                    <div className="flex justify-between">
                                      <span>LTV:</span>
                                      <span className="text-cyan-400">{formatNumber(apyData[position.coin].ltv * 100, 0)}%</span>
                                    </div>
                                    {apyData[position.coin].lt && apyData[position.coin].lt > 0 && (
                                      <div className="flex justify-between">
                                        <span>Liquidation Threshold:</span>
                                        <span className="text-orange-400">{formatNumber(apyData[position.coin].lt * 100, 0)}%</span>
                                      </div>
                                    )}
                                    {apyData[position.coin].emodeLtv && apyData[position.coin].emodeLtv > 0 && (
                                      <div className="flex justify-between">
                                        <span>E-Mode LTV:</span>
                                        <span className="text-purple-400">{formatNumber(apyData[position.coin].emodeLtv * 100, 0)}%</span>
                                      </div>
                                    )}
                                    {apyData[position.coin].emodeLt && apyData[position.coin].emodeLt > 0 && (
                                      <div className="flex justify-between">
                                        <span>E-Mode LT:</span>
                                        <span className="text-pink-400">{formatNumber(apyData[position.coin].emodeLt * 100, 0)}%</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : (
                      'APR: N/A'
                    )}
                  </Badge>
                </div>

                {/* Action Buttons */}
                {!isBorrow && (
                  <div className="flex gap-2 justify-end">
                    <Button
                      onClick={() => handleDepositClick(position)}
                      disabled={false}
                      size="sm"
                      variant="default"
                      className="h-10"
                    >
                      Deposit
                    </Button>
                    <Button
                      onClick={() => handleWithdrawClick(position)}
                      disabled={isWithdrawing}
                      size="sm"
                      variant="outline"
                      className="h-10"
                    >
                      {isWithdrawing ? 'Withdrawing...' : 'Withdraw'}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </ScrollArea>
      <div className="flex items-center justify-between pt-6 pb-6">
        <span className="text-xl">Total assets in Echelon:</span>
        <div className="text-right">
          <span className="text-xl text-primary font-bold">{formatCurrency(totalValue, 2)}</span>
          {calculateRewardsValue() > 0 && (
            <div className="flex flex-col items-end gap-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="text-sm text-muted-foreground cursor-help">
                     💰 including rewards {formatCurrency(calculateRewardsValue(), 2)}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="bg-popover text-popover-foreground border-border max-w-xs">
                    <div className="text-xs font-semibold mb-1">Rewards breakdown:</div>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {rewardsData.map((reward, idx) => {
                        const tokenInfo = getRewardTokenInfoHelper(reward.token);
                        if (!tokenInfo) return null;
                        const price = getTokenPrice(tokenInfo.faAddress || tokenInfo.address || '');
                        const value = price && price !== '0' ? formatCurrency(reward.amount * parseFloat(price), 2) : 'N/A';
                        return (
                          <div key={idx} className="flex items-center gap-2">
                            {tokenInfo.icon_uri && (
                              <img src={tokenInfo.icon_uri} alt={tokenInfo.symbol} className="w-3 h-3 rounded-full" />
                            )}
                            <span>{tokenInfo.symbol}</span>
                            <span>{formatNumber(reward.amount, 6)}</span>
                            <span className="text-gray-300">{value}</span>
                          </div>
                        );
                      })}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              {rewardsData.length > 0 && (
                <button
                  className="px-3 py-1 bg-success text-success-foreground rounded text-sm font-semibold disabled:opacity-60 hover:bg-success/90 transition-colors"
                  onClick={() => setShowClaimAllModal(true)}
                  disabled={isClaiming}
                >
                  {isClaiming ? 'Claiming...' : `Claim All Rewards (${rewardsData.length})`}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Health Factor Display */}
      {(() => {
        const healthData = calculateHealthFactor();
        if (!healthData) return null;

        return (
          <div className="flex items-center justify-between pt-4 pb-6 border-t border-gray-200">
            <span className="text-lg font-semibold">Account Health:</span>
            <div className="text-right">
              <div className="flex items-center gap-3">
                <div className="text-center">
                  <div className={`text-2xl font-bold ${getHealthFactorColor(healthData.healthFactor)}`}>
                    {formatNumber(healthData.healthFactor, 2)}
                  </div>
                  <div className={`text-sm font-medium ${getHealthFactorColor(healthData.healthFactor)}`}>
                    {getHealthFactorStatus(healthData.healthFactor)}
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  <div>Collateral: {formatCurrency(healthData.accountMargin, 2)}</div>
                  <div>Liabilities: {formatCurrency(healthData.totalLiabilities, 2)}</div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Deposit Modal */}
      {selectedPosition && (
        <DepositModal
          isOpen={showDepositModal}
          onClose={() => {
            setShowDepositModal(false);
            setSelectedPosition(null);
          }}
          protocol={{
            name: "Echelon",
            logo: "/echelon-favicon.ico",
            apy: (() => {
              const apyValue = getApyForPosition(selectedPosition) ? getApyForPosition(selectedPosition)! * 100 : 0;
              return apyValue;
            })(),
            key: "echelon" as ProtocolKey
          }}
          tokenIn={{
            symbol: getTokenInfo(selectedPosition.coin)?.symbol || selectedPosition.coin.substring(0, 4).toUpperCase(),
            logo: getTokenInfo(selectedPosition.coin)?.logoUrl || '/file.svg',
            decimals: getTokenInfo(selectedPosition.coin)?.decimals || 8,
            address: selectedPosition.coin
          }}
          tokenOut={{
            symbol: getTokenInfo(selectedPosition.coin)?.symbol || selectedPosition.coin.substring(0, 4).toUpperCase(),
            logo: getTokenInfo(selectedPosition.coin)?.logoUrl || '/file.svg',
            decimals: getTokenInfo(selectedPosition.coin)?.decimals || 8,
            address: selectedPosition.coin
          }}
          priceUSD={parseFloat(getTokenPrice(selectedPosition.coin)) || 0}
        />
      )}

      {/* Withdraw Modal */}
      {selectedPosition && (
        <WithdrawModal
          isOpen={showWithdrawModal}
          onClose={() => {
            setShowWithdrawModal(false);
            setSelectedPosition(null);
            isModalOpenRef.current = false;
            if (selectedPosition) {
              closePositionModal(selectedPosition.coin);
            }
            closeAllModals();
          }}
          onConfirm={handleWithdrawConfirm}
          position={{ ...selectedPosition, supply: String(selectedPosition.amount) }}
          tokenInfo={getTokenInfo(selectedPosition.coin)}
          isLoading={isWithdrawing}
          userAddress={account?.address?.toString()}
        />
      )}

      {/* Claim All Rewards Modal */}
      <ClaimAllRewardsEchelonModal
        isOpen={showClaimAllModal}
        onClose={() => setShowClaimAllModal(false)}
        rewards={rewardsData}
        tokenPrices={tokenPrices}
      />
    </div>
  );
}
