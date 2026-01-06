import { useEffect, useState, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import { ManagePositionsButton } from "../ManagePositionsButton";
import { getProtocolByName } from "@/lib/protocols/getProtocolsList";
import { useCollapsible } from "@/contexts/CollapsibleContext";
import { formatCurrency } from "@/lib/utils/numberFormat";
import tokenList from "@/lib/data/tokenList.json";
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { PanoraPricesService } from "@/lib/services/panora/prices";
import { createDualAddressPriceMap } from "@/lib/utils/addressNormalization";

interface PositionsListProps {
  address?: string;
  onPositionsValueChange?: (value: number) => void;
  refreshKey?: number;
  onPositionsCheckComplete?: () => void;
  showManageButton?: boolean;
}

export function PositionsList({ address, onPositionsValueChange, refreshKey, onPositionsCheckComplete, showManageButton=true }: PositionsListProps) {
  const { account } = useWallet();
  const [positions, setPositions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rewardsData, setRewardsData] = useState<any>({});
  const [totalRewardsValue, setTotalRewardsValue] = useState<number>(0);
  const [tokenPrices, setTokenPrices] = useState<Record<string, string>>({});
  const { isExpanded, toggleSection } = useCollapsible();
  const pricesService = PanoraPricesService.getInstance();

  const walletAddress = address || account?.address;
  const protocol = getProtocolByName("Auro Finance");

  // Функция для безопасного вычисления значений (заменяет NaN на 0)
  const safeCalculateValue = (amount: string | number, price: string | number): number => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    const numPrice = typeof price === 'string' ? parseFloat(price) : price;

    if (isNaN(numAmount) || isNaN(numPrice)) {
      return 0;
    }

    const result = numAmount * numPrice;
    return isNaN(result) ? 0 : result;
  };

  // Получаем цену токена из кэша
  const getTokenPrice = useCallback((tokenAddress: string): string => {
    let cleanAddress = tokenAddress;
    if (cleanAddress.startsWith('@')) {
      cleanAddress = cleanAddress.slice(1);
    }
    if (!cleanAddress.startsWith('0x')) {
      cleanAddress = `0x${cleanAddress}`;
    }
    const price = tokenPrices[cleanAddress] || '0';
    return price;
  }, [tokenPrices]);

  // Функция для получения информации о токене наград
  const getRewardTokenInfoHelper = useCallback((tokenAddress: string) => {
    const cleanAddress = tokenAddress.startsWith('@') ? tokenAddress.slice(1) : tokenAddress;
    const fullAddress = cleanAddress.startsWith('0x') ? cleanAddress : `0x${cleanAddress}`;

    // Normalize addresses by removing leading zeros after 0x
    const normalizeAddress = (addr: string) => {
      if (!addr || !addr.startsWith('0x')) return addr;
      return '0x' + addr.slice(2).replace(/^0+/, '') || '0x0';
    };

    const normalizedFullAddress = normalizeAddress(fullAddress);

    const token = (tokenList as any).data.data.find((token: any) => {
      const normalizedTokenAddress = normalizeAddress(token.tokenAddress || '');
      const normalizedFaAddress = normalizeAddress(token.faAddress || '');

      return normalizedTokenAddress === normalizedFullAddress ||
             normalizedFaAddress === normalizedFullAddress;
    });

    if (!token) {
      return undefined;
    }

    const result = {
      address: token.tokenAddress,
      faAddress: token.faAddress,
      symbol: token.symbol,
      icon_uri: token.logoUrl,
      decimals: token.decimals,
      price: getTokenPrice(fullAddress) // Используем динамическую цену
    };

    return result;
  }, [getTokenPrice]);

  // Функция для расчета стоимости наград для конкретной позиции
  const calculateRewardsValue = useCallback((positionAddress: string) => {
    if (!rewardsData[positionAddress]) {
      return 0;
    }

    let totalValue = 0;
    let collateralSum = 0;
    let borrowSum = 0;

    // Считаем collateral rewards
    rewardsData[positionAddress].collateral.forEach((reward: any) => {
      if (!reward || !reward.key || !reward.value) {
        return;
      }
      const tokenInfo = getRewardTokenInfoHelper(reward.key);
      if (!tokenInfo || !tokenInfo.price) {
        return;
      }
      const amount = parseFloat(reward.value) / Math.pow(10, tokenInfo.decimals || 8);
      const value = safeCalculateValue(amount, tokenInfo.price);
      totalValue += value;
      collateralSum += value;
    });

    // Считаем borrow rewards
    rewardsData[positionAddress].borrow.forEach((reward: any) => {
      if (!reward || !reward.key || !reward.value) {
        return;
      }
      const tokenInfo = getRewardTokenInfoHelper(reward.key);
      if (!tokenInfo || !tokenInfo.price) {
        return;
      }
      const amount = parseFloat(reward.value) / Math.pow(10, tokenInfo.decimals || 8);
      const value = safeCalculateValue(amount, tokenInfo.price);
      totalValue += value;
      borrowSum += value;
    });

    return totalValue;
  }, [rewardsData, getRewardTokenInfoHelper]);

  // Функция для расчета общей стоимости всех наград
  const calculateTotalRewardsValue = useCallback(() => {
    let total = 0;
    Object.keys(rewardsData).forEach(positionAddress => {
      const positionValue = calculateRewardsValue(positionAddress);
      total += positionValue;
    });
    return total;
  }, [rewardsData, calculateRewardsValue]);

  // Функция для загрузки наград
  const fetchRewards = useCallback(async (positionsData: any[]) => {
    if (!walletAddress || positionsData.length === 0) return;

    try {
      // Сначала загружаем данные о пулах
      console.log('Auro Finance - Fetching pools from PositionsList');
      const poolsResponse = await fetch(`/api/protocols/auro/pools`);
      console.log('Auro Finance - Pools response status:', poolsResponse.status);
      if (!poolsResponse.ok) {
        throw new Error(`Pools API returned status ${poolsResponse.status}`);
      }
      const poolsData = await poolsResponse.json();

      if (!poolsData.success || !poolsData.data) {
        throw new Error('Failed to load pools data');
      }

      // Отправляем POST запрос с данными о позициях и пулах
      const response = await fetch(`/api/protocols/auro/rewards`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          positionsInfo: positionsData,
          poolsData: poolsData.data
        })
      });

      if (!response.ok) {
        throw new Error(`API returned status ${response.status}`);
      }
      const data = await response.json();

      if (data.success && data.data) {
        setRewardsData(data.data);
        // Не рассчитываем totalRewardsValue здесь - это будет сделано в отдельном useEffect
      }
    } catch (error) {
      // Error fetching Auro rewards
    }
  }, [walletAddress]); // Убрал getRewardTokenInfoHelper из зависимостей

  // Объединенный useEffect для загрузки позиций и наград
  useEffect(() => {
    console.log('Auro Finance - useEffect triggered, walletAddress:', walletAddress);
    if (!walletAddress) {
      console.log('Auro Finance - No wallet address, skipping load');
      setPositions((prev) => prev);
      setRewardsData((prev: any) => prev);
      setTotalRewardsValue((prev: number) => prev);
      onPositionsCheckComplete?.();
      return;
    }

    const loadData = async () => {
      console.log('Auro Finance - Starting loadData for address:', walletAddress);
      setLoading(true);
      setError(null);

      try {
        // Загружаем позиции
        console.log('Auro Finance - Fetching userPositions for address:', walletAddress);
        const positionsResponse = await fetch(`/api/protocols/auro/userPositions?address=${walletAddress}`);
        console.log('Auro Finance - userPositions response status:', positionsResponse.status);
        if (!positionsResponse.ok) {
          throw new Error(`Positions API returned status ${positionsResponse.status}`);
        }

        const positionsData = await positionsResponse.json();
        console.log('Auro Finance - userPositions data:', positionsData);
        const positionsArray = Array.isArray(positionsData.positionInfo) ? positionsData.positionInfo : [];
        console.log('Auro Finance - positions array length:', positionsArray.length);
        setPositions(positionsArray);

        // Загружаем награды только если есть позиции
        if (positionsArray.length > 0) {
          await fetchRewards(positionsArray);
        } else {
          setRewardsData({});
          setTotalRewardsValue(0);
        }
      } catch (err) {
        setError("Failed to load Auro Finance positions");
        // keep previous data on error
      } finally {
        setLoading(false);
        onPositionsCheckComplete?.();
      }
    };

    loadData();
  }, [walletAddress, refreshKey, fetchRewards]);

  // Логируем изменения зависимостей
  useEffect(() => {
    console.log('Auro Finance - Dependencies changed:', { walletAddress, refreshKey, fetchRewards: !!fetchRewards });
  }, [walletAddress, refreshKey, fetchRewards]);

  // Получаем цены токенов через Panora API
  useEffect(() => {
    const fetchPrices = async () => {
      // Получаем адреса токенов напрямую, без использования getAllTokenAddresses
      const addresses = new Set<string>();

      positions.forEach(position => {
        // Добавляем collateral токен
        if (position.collateralTokenAddress) {
          let cleanAddress = position.collateralTokenAddress;
          if (cleanAddress.startsWith('@')) {
            cleanAddress = cleanAddress.slice(1);
          }
          if (!cleanAddress.startsWith('0x')) {
            cleanAddress = `0x${cleanAddress}`;
          }
          addresses.add(cleanAddress);
        }

        // Добавляем debt токен (USDA)
        const debtTokenAddress = "0x534e4c3dc0f038dab1a8259e89301c4da58779a5d482fb354a41c08147e6b9ec";
        addresses.add(debtTokenAddress);
      });

      // Добавляем адреса токенов наград
      Object.values(rewardsData).forEach((positionRewards: any) => {
        if (positionRewards.collateral) {
          positionRewards.collateral.forEach((reward: any) => {
            if (reward?.key) {
              let cleanAddress = reward.key;
              if (cleanAddress.startsWith('@')) {
                cleanAddress = cleanAddress.slice(1);
              }
              if (!cleanAddress.startsWith('0x')) {
                cleanAddress = `0x${cleanAddress}`;
              }
              addresses.add(cleanAddress);
            }
          });
        }
        if (positionRewards.borrow) {
          positionRewards.borrow.forEach((reward: any) => {
            if (reward?.key) {
              let cleanAddress = reward.key;
              if (cleanAddress.startsWith('@')) {
                cleanAddress = cleanAddress.slice(1);
              }
              if (!cleanAddress.startsWith('0x')) {
                cleanAddress = `0x${cleanAddress}`;
              }
              addresses.add(cleanAddress);
            }
          });
        }
      });

      const addressesArray = Array.from(addresses);

      if (addressesArray.length === 0) return;

      try {
        const response = await pricesService.getPrices(1, addressesArray);
        if (response.data) {
          // Use utility function to create price map with both address versions
          const prices = createDualAddressPriceMap(response.data);
          setTokenPrices(prices);
        }
      } catch (error) {
        console.error('Failed to fetch token prices:', error);
      }
    };

    fetchPrices();
  }, [positions, rewardsData, pricesService]); // Вернул positions и rewardsData, но убрал getAllTokenAddresses

  // Обновляем totalRewardsValue когда меняются цены или данные наград
  useEffect(() => {
    const newTotalRewardsValue = calculateTotalRewardsValue();
    setTotalRewardsValue(newTotalRewardsValue);
  }, [calculateTotalRewardsValue]);

  // Сортировка по value (по убыванию)
  const sortedPositions = [...positions].sort((a, b) => {
    const collateralPriceA = a.collateralTokenAddress ? parseFloat(getTokenPrice(a.collateralTokenAddress)) : 0;
    const collateralPriceB = b.collateralTokenAddress ? parseFloat(getTokenPrice(b.collateralTokenAddress)) : 0;
    const valueA = safeCalculateValue(a.collateralAmount, collateralPriceA);
    const valueB = safeCalculateValue(b.collateralAmount, collateralPriceB);
    return valueB - valueA;
  });

  // Сумма активов (Collateral - Debt + Rewards) - включая награды
  const totalValue = useCallback(() => {
    const result = sortedPositions.reduce((sum, pos) => {
      // Сумма по collateral позициям
      const collateralPrice = pos.collateralTokenAddress ? parseFloat(getTokenPrice(pos.collateralTokenAddress)) : 0;
      const collateralValue = safeCalculateValue(pos.collateralAmount, collateralPrice);

      // Сумма по debt позициям (вычитаем)
      const debtPrice = parseFloat(getTokenPrice("0x534e4c3dc0f038dab1a8259e89301c4da58779a5d482fb354a41c08147e6b9ec")); // USDA
      const debtValue = safeCalculateValue(pos.debtAmount, debtPrice);

      // Добавляем награды для этой позиции
      const positionRewards = calculateRewardsValue(pos.address);

      return sum + collateralValue - debtValue + positionRewards;
    }, 0);

    // Дополнительная защита от NaN
    return isNaN(result) ? 0 : result;
  }, [sortedPositions, calculateRewardsValue, getTokenPrice]);

  // useEffect для передачи суммы наверх
  useEffect(() => {
    if (onPositionsValueChange) {
      onPositionsValueChange(totalValue());
    }
  }, [totalValue, onPositionsValueChange]);

  // Если нет позиций, не отображаем блок
  if (!positions || positions.length === 0) return null;

  return (
    <Card className="w-full">
      <CardHeader
        className="py-2 cursor-pointer hover:bg-accent/50 transition-colors"
        onClick={() => toggleSection('auro')}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 relative">
              <Image
                src="https://app.auro.finance/logo.png"
                alt="Auro Finance"
                width={20}
                height={20}
                className="object-contain"
              />
            </div>
            <CardTitle className="text-lg">Auro Finance</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-lg">{formatCurrency(totalValue(), 2)}</div>
            <ChevronDown className={cn(
              "h-5 w-5 transition-transform",
              isExpanded('auro') ? "transform rotate-0" : "transform -rotate-90"
            )} />
          </div>
        </div>
      </CardHeader>
      {isExpanded('auro') && (
        <CardContent className="flex-1 overflow-y-auto px-3 pt-0">
          <div className="space-y-2">
            {sortedPositions.map((pos, idx) => {
              const collateral = pos.collateralAmount;
              const collateralSymbol = pos.collateralSymbol;
              const collateralLogo = pos.collateralTokenInfo?.logoUrl;
              const collateralPrice = pos.collateralTokenAddress ? parseFloat(getTokenPrice(pos.collateralTokenAddress)).toFixed(2) : 'N/A';
              const debt = pos.debtAmount;
              const debtSymbol = pos.debtSymbol;
              const debtLogo = pos.debtTokenInfo?.logoUrl;
              const debtPrice = parseFloat(getTokenPrice("0x534e4c3dc0f038dab1a8259e89301c4da58779a5d482fb354a41c08147e6b9ec")).toFixed(2); // USDA
              const value = pos.collateralTokenAddress ? safeCalculateValue(collateral, getTokenPrice(pos.collateralTokenAddress)).toFixed(2) : '0.00';
              return (
                <div key={pos.address || idx} className="mb-2">
                  {/* Collateral строка */}
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2 min-w-0">
                      {collateralLogo && (
                        <div className="w-6 h-6 relative shrink-0">
                          <Image src={collateralLogo} alt={collateralSymbol} width={24} height={24} className="object-contain" />
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate max-w-[80px]">{collateralSymbol}</span>
                          <span className={cn(
                            'text-xs font-semibold px-2 py-0.5 rounded border',
                            'bg-green-500/10 text-green-600 border-green-500/20')
                          }>
                            Supply
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">${collateralPrice}</div>
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <div className="text-sm font-medium">${value}</div>
                      <div className="text-xs text-muted-foreground">{collateral}</div>
                    </div>
                  </div>
                  {/* Debt строка — всегда на новой строке, как borrow в Echelon */}
                  {parseFloat(debt) > 0 && (
                    <div className="flex justify-between items-center mt-2 bg-red-50 rounded">
                      <div className="flex items-center gap-2 min-w-0">
                        {debtLogo && (
                          <div className="w-6 h-6 relative shrink-0">
                            <Image src={debtLogo} alt={debtSymbol} width={24} height={24} className="object-contain" />
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate max-w-[80px]">{debtSymbol}</span>
                            <span className={cn(
                              'text-xs font-semibold px-2 py-0.5 rounded border',
                              'bg-red-500/10 text-red-600 border-red-500/20')
                            }>
                              Borrow
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground">${debtPrice}</div>
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <div className="text-sm font-medium">${(parseFloat(debt) * parseFloat(getTokenPrice("0x534e4c3dc0f038dab1a8259e89301c4da58779a5d482fb354a41c08147e6b9ec"))).toFixed(2)}</div>
                        <div className="text-xs text-muted-foreground">{debt} {debtSymbol}</div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {/* Total Rewards */}
            {totalRewardsValue > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center justify-between pt-2 border-t border-gray-200 cursor-help">
                      <span className="text-sm text-muted-foreground">💰 Total rewards:</span>
                      <span className="text-sm font-medium">${totalRewardsValue.toFixed(2)}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="bg-popover text-popover-foreground border-border max-w-xs">
                    <div className="text-xs font-semibold mb-1">Rewards breakdown:</div>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {Object.entries(rewardsData).map(([positionAddress, rewards]: [string, any], idx) => {
                        const collateralRows = (rewards.collateral || []).map((reward: any, i: number) => {
                          const tokenInfo = getRewardTokenInfoHelper(reward.key);
                          if (!tokenInfo) return null;
                          const amount = parseFloat(reward.value) / Math.pow(10, tokenInfo.decimals || 8);
                          const value = tokenInfo.price ? safeCalculateValue(amount, tokenInfo.price).toFixed(2) : '0.00';
                          return (
                            <div key={`collateral-${positionAddress}-${i}`} className="flex items-center gap-2">
                              {tokenInfo.icon_uri && (
                                <img src={tokenInfo.icon_uri} alt={tokenInfo.symbol} className="w-3 h-3 rounded-full" />
                              )}
                              <span>{tokenInfo.symbol}</span>
                              <span className="text-gray-400">Supply</span>
                              <span>{amount.toFixed(6)}</span>
                              <span className="text-muted-foreground">${value}</span>
                            </div>
                          );
                        });
                        const borrowRows = (rewards.borrow || []).map((reward: any, i: number) => {
                          const tokenInfo = getRewardTokenInfoHelper(reward.key);
                          if (!tokenInfo) return null;
                          const amount = parseFloat(reward.value) / Math.pow(10, tokenInfo.decimals || 8);
                          const value = tokenInfo.price ? safeCalculateValue(amount, tokenInfo.price).toFixed(2) : '0.00';
                          return (
                            <div key={`borrow-${positionAddress}-${i}`} className="flex items-center gap-2">
                              {tokenInfo.icon_uri && (
                                <img src={tokenInfo.icon_uri} alt={tokenInfo.symbol} className="w-3 h-3 rounded-full" />
                              )}
                              <span>{tokenInfo.symbol}</span>
                              <span className="text-blue-400">Borrow</span>
                              <span>{amount.toFixed(6)}</span>
                              <span className="text-muted-foreground">${value}</span>
                            </div>
                          );
                        });
                        if (collateralRows.length === 0 && borrowRows.length === 0) return null;
                        return (
                          <div key={positionAddress} className="mb-1">
                            <div className="text-[10px] text-muted-foreground mb-0.5">Position: {positionAddress.slice(0, 6)}...{positionAddress.slice(-4)}</div>
                            {collateralRows}
                            {borrowRows}
                          </div>
                        );
                      })}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {/* Кнопка Manage Positions */}
            {protocol && showManageButton && (
              <ManagePositionsButton protocol={protocol} />
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
