import { useEffect, useState, useCallback, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { getProtocolByName } from "@/lib/protocols/getProtocolsList";
import Image from "next/image";
import tokenList from "@/lib/data/tokenList.json";
import { ManagePositionsButton } from "../ManagePositionsButton";
import { useCollapsible } from "@/contexts/CollapsibleContext";
import { PanoraPricesService } from "@/lib/services/panora/prices";
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { createDualAddressPriceMap } from "@/lib/utils/addressNormalization";
import { TokenInfoService } from "@/lib/services/tokenInfoService";
import { formatNumber } from "@/lib/utils/numberFormat";
import { Badge } from "@/components/ui/badge";

interface PositionsListProps {
  address?: string;
  onPositionsValueChange?: (value: number) => void;
  refreshKey?: number;
  onPositionsCheckComplete?: () => void;
  showManageButton?: boolean;
}

interface Position {
  market: string;
  coin: string;
  supply: number;
  supplyApr: number;
  borrow?: number;
  amount?: number;
  type?: string; // supply или borrow
}

interface TokenInfo {
  symbol: string;
  name: string;
  logoUrl: string | null;
  decimals: number;
  usdPrice: string | null;
}

interface EchelonReward {
  token: string;
  tokenType: string;
  rewardName?: string;
  amount: number;
  rawAmount: string;
  farmingId: string;
  stakeAmount: number;
}

export function PositionsList({ address, onPositionsValueChange, refreshKey, onPositionsCheckComplete, showManageButton=true }: PositionsListProps) {
  const { account } = useWallet();
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokenPrices, setTokenPrices] = useState<Record<string, string>>({});
  const [rewardsData, setRewardsData] = useState<EchelonReward[]>([]);
  const [apyData, setApyData] = useState<Record<string, any>>({});
  const [fallbackTokenInfo, setFallbackTokenInfo] = useState<Record<string, TokenInfo>>({});
  const { isExpanded, toggleSection } = useCollapsible();
  const pricesService = PanoraPricesService.getInstance();

  const walletAddress = address || account?.address?.toString();

  const protocol = getProtocolByName("Echelon");

  // Получаем цену токена из кэша
  const getTokenPrice = (coinAddress: string): string => {
    let cleanAddress = coinAddress;
    if (cleanAddress.startsWith('@')) {
      cleanAddress = cleanAddress.slice(1);
    }
    if (!cleanAddress.startsWith('0x')) {
      cleanAddress = `0x${cleanAddress}`;
    }

    // Normalize address by removing leading zeros after 0x
    const normalizeAddress = (addr: string) => {
      if (!addr || !addr.startsWith('0x')) return addr;
      return '0x' + addr.slice(2).replace(/^0+/, '') || '0x0';
    };

    const normalizedAddress = normalizeAddress(cleanAddress);

    // Try both original and normalized addresses
    const price = tokenPrices[cleanAddress] || tokenPrices[normalizedAddress] || '0';
    return price;
  };

  // Функция для поиска информации о токене (без цены)
  const getTokenInfo = (coinAddress: string): TokenInfo | null => {
    // Normalize addresses by removing leading zeros after 0x
    const normalizeAddress = (addr: string) => {
      if (!addr || !addr.startsWith('0x')) return addr;
      return '0x' + addr.slice(2).replace(/^0+/, '') || '0x0';
    };

    const normalizedCoinAddress = normalizeAddress(coinAddress);

    // First, check fallback token info (from protocol APIs)
    if (fallbackTokenInfo[normalizedCoinAddress] || fallbackTokenInfo[coinAddress]) {
      const fallbackInfo = fallbackTokenInfo[normalizedCoinAddress] || fallbackTokenInfo[coinAddress];
      return {
        symbol: fallbackInfo.symbol,
        name: fallbackInfo.name,
        logoUrl: fallbackInfo.logoUrl || null,
        decimals: fallbackInfo.decimals,
        usdPrice: null // Цена будет получена динамически
      };
    }

    // Then check tokenList
    const token = tokenList.data.data.find((t) => {
      const normalizedFaAddress = normalizeAddress(t.faAddress || '');
      const normalizedTokenAddress = normalizeAddress(t.tokenAddress || '');

      return normalizedFaAddress === normalizedCoinAddress ||
             normalizedTokenAddress === normalizedCoinAddress;
    });

    if (token) {
      return {
        symbol: token.symbol,
        name: token.name,
        logoUrl: token.logoUrl || null,
        decimals: token.decimals,
        usdPrice: null // Цена будет получена динамически
      };
    }

    return null;
  };

  // Функция для получения информации о токене наград
  const getRewardTokenInfoHelper = useCallback((tokenSymbol: string) => {
    const token = (tokenList as any).data.data.find((token: any) =>
      token.symbol.toLowerCase() === tokenSymbol.toLowerCase() ||
      token.name.toLowerCase().includes(tokenSymbol.toLowerCase())
    );

    if (!token) {
      return undefined;
    }

    const result = {
      address: token.tokenAddress,
      faAddress: token.faAddress,
      symbol: token.symbol,
      icon_uri: token.logoUrl,
      decimals: token.decimals,
      price: null // Цена будет получена динамически
    };

    return result;
  }, []);

  // Функция для расчета стоимости наград
  const calculateRewardsValue = useCallback(() => {
    if (!rewardsData || rewardsData.length === 0) {
      return 0;
    }

    let totalValue = 0;

    rewardsData.forEach((reward) => {
      const tokenInfo = getRewardTokenInfoHelper(reward.token);
      if (!tokenInfo) {
        return;
      }

      // Получаем цену динамически
      const price = getTokenPrice(tokenInfo.faAddress || tokenInfo.address || '');
      if (!price || price === '0') {
        return;
      }

      const value = reward.amount * parseFloat(price);
      totalValue += value;
    });

    return totalValue;
  }, [rewardsData, getRewardTokenInfoHelper, tokenPrices]);

  // Функция для загрузки наград
  const fetchRewards = useCallback(async () => {
    if (!walletAddress || walletAddress.length < 10) return;

    try {
      const response = await fetch(`/api/protocols/echelon/rewards?address=${walletAddress}`);

      if (!response.ok) {
        throw new Error(`API returned status ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.data) {
        setRewardsData(data.data);
      } else {
        setRewardsData([]);
      }
    } catch (error) {
      setRewardsData([]);
    }
  }, [walletAddress]);

  // Получаем все уникальные адреса токенов из позиций
  const getAllTokenAddresses = useCallback(() => {
    const addresses = new Set<string>();

    // Normalize address function
    const normalizeAddress = (addr: string) => {
      if (!addr || !addr.startsWith('0x')) return addr;
      return '0x' + addr.slice(2).replace(/^0+/, '') || '0x0';
    };

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

    const arr = Array.from(addresses);
    return arr;
  }, [positions, rewardsData, getRewardTokenInfoHelper]);

  // Получаем цены токенов через Panora API с fallback к Echelon API
  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      const addresses = getAllTokenAddresses();
      console.log('Requesting prices for addresses:', addresses);
      if (addresses.length === 0 || !walletAddress || walletAddress.length < 10) return;

      try {
        // First try Panora API
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
          console.log('[EchelonPositionsList] Missing prices for tokens, trying Echelon API:', missingPrices);

          // Try to get prices from Echelon API for missing tokens
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
                  console.log('[EchelonPositionsList] Got price from Echelon:', info.symbol, info.price);
                }
              } catch (error) {
                console.warn('[EchelonPositionsList] Failed to get price for', addr, error);
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
  }, [getAllTokenAddresses, pricesService]);

      // Загружаем APR данные из того же источника, что и Pro вкладка
  useEffect(() => {
    fetch('/api/protocols/echelon/v2/pools')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          // Создаем маппинг token -> APR данные
          const apyMapping: Record<string, any> = {};
          data.data.forEach((pool: any) => {
            apyMapping[pool.token] = {
              supplyAPY: pool.depositApy,
              borrowAPY: pool.borrowAPY,
              supplyRewardsApr: pool.supplyRewardsApr,
              borrowRewardsApr: pool.borrowRewardsApr,
              marketAddress: pool.marketAddress,
              asset: pool.asset
            };
          });
          setApyData(apyMapping);
        }
      })
              .catch(error => {
          // APR data load error
      });
  }, []);

  // Объединенный useEffect для загрузки позиций и наград с дебаунсингом
  useEffect(() => {
    if (!walletAddress || walletAddress.length < 10) {
      setPositions((prev) => prev);
      setRewardsData((prev) => prev);
      onPositionsCheckComplete?.();
      return;
    }

    const timeoutId = setTimeout(async () => {
      setLoading(true);
      setError(null);

      try {
        // Загружаем позиции
        const positionsResponse = await fetch(`/api/protocols/echelon/userPositions?address=${walletAddress}`);

        if (!positionsResponse.ok) {
          throw new Error(`Positions API returned status ${positionsResponse.status}`);
        }

        const positionsData = await positionsResponse.json();

        if (positionsData.success && Array.isArray(positionsData.data)) {
          setPositions(positionsData.data);
        } else {
          setPositions([]);
        }

        // Загружаем награды
        await fetchRewards();
      } catch (err) {
        setError('Failed to load Echelon positions');
        // keep previous positions to avoid flicker
      } finally {
        setLoading(false);
        onPositionsCheckComplete?.();
      }
    }, 500); // Дебаунсинг 500мс

    return () => clearTimeout(timeoutId);
  }, [walletAddress, refreshKey, fetchRewards]);

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
        const inTokenList = tokenList.data.data.find((t) => {
          const normalizedFaAddress = normalizeAddress(t.faAddress || '');
          const normalizedTokenAddress = normalizeAddress(t.tokenAddress || '');
          return normalizedFaAddress === normalizedAddr || normalizedTokenAddress === normalizedAddr;
        });

        if (!inTokenList) {
          unknownTokens.push(position.coin);
        }
      });

      if (unknownTokens.length === 0) return;

      console.log('[EchelonPositionsList] Loading info for unknown tokens:', unknownTokens);

      // Load token info from protocol APIs
      const service = TokenInfoService.getInstance();
      const newTokenInfo: Record<string, TokenInfo> = {};

      await Promise.all(
        unknownTokens.map(async (tokenAddr) => {
          try {
            const info = await service.getTokenInfo(tokenAddr);
            if (info) {
              const normalizedAddr = normalizeAddress(tokenAddr);
              const tokenInfo: TokenInfo = {
                symbol: info.symbol,
                name: info.name,
                logoUrl: info.logoUrl,
                decimals: info.decimals,
                usdPrice: null
              };
              newTokenInfo[normalizedAddr] = tokenInfo;
              newTokenInfo[tokenAddr] = tokenInfo; // Also store under original address
              console.log('[EchelonPositionsList] Loaded token info:', info.symbol, 'from', info.source);
            }
          } catch (error) {
            console.warn('[EchelonPositionsList] Failed to load token info for', tokenAddr, error);
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
  }, [positions]);

      // Получить APR для позиции
  const getApyForPosition = (position: Position) => {
          // Сначала пытаемся найти данные в новом APR маппинге
    const poolData = apyData[position.coin];
    if (poolData) {
      if (position.type === 'supply') {
        const apy = poolData.supplyAPY / 100; // Конвертируем из процентов в десятичную форму
        return apy * 100; // Возвращаем в процентах для отображения
      } else if (position.type === 'borrow') {
        const apy = poolData.borrowAPY / 100;
        return apy * 100;
      }
    }

    // Fallback на старые данные
    return position.supplyApr || 0;
  };

  // Мемоизируем расчет общей суммы
  const totalValue = useMemo(() => {
    const positionsValue = positions.reduce((sum, position) => {
      const tokenInfo = getTokenInfo(position.coin);
      const isBorrow = position.type === 'borrow';
      const rawAmount = isBorrow ? (position.borrow ?? position.amount ?? 0) : (position.supply ?? position.amount ?? 0);
      const amount = rawAmount / (tokenInfo?.decimals ? 10 ** tokenInfo.decimals : 1e8);
      const price = getTokenPrice(position.coin);
      const value = price ? amount * parseFloat(price) : 0;
      if (isBorrow) {
        return sum - value;
      }
      return sum + value;
    }, 0);

    return positionsValue + calculateRewardsValue();
  }, [positions, tokenPrices, calculateRewardsValue]);

  // Мемоизируем сортировку позиций
  const sortedPositions = useMemo(() => {
    return [...positions].sort((a, b) => {
      const tokenInfoA = getTokenInfo(a.coin);
      const tokenInfoB = getTokenInfo(b.coin);
      const isBorrowA = a.type === 'borrow';
      const isBorrowB = b.type === 'borrow';
      const rawAmountA = isBorrowA ? (a.borrow ?? a.amount ?? 0) : (a.supply ?? a.amount ?? 0);
      const rawAmountB = isBorrowB ? (b.borrow ?? b.amount ?? 0) : (b.supply ?? b.amount ?? 0);
      const amountA = rawAmountA / (tokenInfoA?.decimals ? 10 ** tokenInfoA.decimals : 1e8);
      const amountB = rawAmountB / (tokenInfoB?.decimals ? 10 ** tokenInfoB.decimals : 1e8);
      const priceA = getTokenPrice(a.coin);
      const priceB = getTokenPrice(b.coin);
      const valueA = priceA ? amountA * parseFloat(priceA) : 0;
      const valueB = priceB ? amountB * parseFloat(priceB) : 0;
      return valueB - valueA;
    });
  }, [positions, tokenPrices]);

  // Вызываем колбэк при изменении общей суммы позиций
  useEffect(() => {
    onPositionsValueChange?.(totalValue);
  }, [totalValue, onPositionsValueChange]);

  // Если идет загрузка, не отображаем блок
  if (loading) {
    return null;
  }

  // Если есть ошибка, не отображаем блок
  if (error) {
    return null;
  }

  // Если нет позиций, не отображаем блок
  if (positions.length === 0) {
    return null;
  }

  return (
    <Card className="w-full">
      <CardHeader
        className="py-2 cursor-pointer hover:bg-accent/50 transition-colors"
        onClick={() => toggleSection('echelon')}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {protocol && (
              <div className="w-5 h-5 relative">
                <Image
                  src={protocol.logoUrl}
                  alt={protocol.name}
                  width={20}
                  height={20}
                  className="object-contain"
                />
              </div>
            )}
            <CardTitle className="text-lg">Echelon</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-lg">${formatNumber(totalValue, 2)}</div>
            <ChevronDown className={cn(
              "h-5 w-5 transition-transform",
              isExpanded('echelon') ? "transform rotate-0" : "transform -rotate-90"
            )} />
          </div>
        </div>
      </CardHeader>

      {isExpanded('echelon') && (
        <CardContent className="flex-1 overflow-y-auto px-3 pt-0">
          <ScrollArea className="h-full">
            {sortedPositions.map((position, index) => {
              const tokenInfo = getTokenInfo(position.coin);
              const isBorrow = position.type === 'borrow';
              const rawAmount = isBorrow ? (position.borrow ?? position.amount ?? 0) : (position.supply ?? position.amount ?? 0);
              const amount = rawAmount / (tokenInfo?.decimals ? 10 ** tokenInfo.decimals : 1e8);
              const price = getTokenPrice(position.coin);
              const value = price ? formatNumber(amount * parseFloat(price), 2) : 'N/A';
              const apy = getApyForPosition(position);
              return (
                <div key={`${position.coin}-${index}`} className={cn('mb-2', isBorrow && 'bg-error-muted rounded')}>
                  <div className="flex justify-between items-center">
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
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{tokenInfo?.symbol || position.coin.substring(0, 4).toUpperCase()}</span>
                          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20 text-xs font-normal px-2 py-0.5 h-5">
                            {isBorrow ? 'Borrow' : 'Supply'}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          ${price ? formatNumber(parseFloat(price), 2) : 'N/A'}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">${value}</div>
                      <div className="text-xs text-muted-foreground">{formatNumber(amount, 4)}</div>

                    </div>
                  </div>
                </div>
              );
            })}

            {/* Total Rewards */}
            {calculateRewardsValue() > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center justify-between pt-2 border-t border-gray-200 cursor-help">
                      <span className="text-sm text-muted-foreground">💰 Total rewards:</span>
                      <span className="text-sm font-medium">${formatNumber(calculateRewardsValue(), 2)}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="bg-popover text-popover-foreground border-border max-w-xs">
                    <div className="text-xs font-semibold mb-1">Rewards breakdown:</div>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                                             {rewardsData.map((reward, idx) => {
                         const tokenInfo = getRewardTokenInfoHelper(reward.token);
                         if (!tokenInfo) return null;
                         const price = getTokenPrice(tokenInfo.faAddress || tokenInfo.address || '');
                         const value = price && price !== '0' ? formatNumber(reward.amount * parseFloat(price), 2) : 'N/A';
                         return (
                           <div key={idx} className="flex items-center gap-2">
                             {tokenInfo.icon_uri && (
                               <img src={tokenInfo.icon_uri} alt={tokenInfo.symbol} className="w-3 h-3 rounded-full" />
                             )}
                             <span>{tokenInfo.symbol}</span>
                             <span>{formatNumber(reward.amount, 6)}</span>
                             <span className="text-gray-300">${value}</span>
                           </div>
                         );
                       })}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {/* Кнопка управления позициями, как у других протоколов */}
            {protocol && showManageButton && (
              <ManagePositionsButton protocol={protocol} />
            )}
          </ScrollArea>
        </CardContent>
      )}
    </Card>
  );
}
