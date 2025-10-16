import { useEffect, useState, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { ChevronDown, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { getProtocolByName } from "@/lib/protocols/getProtocolsList";
import Image from "next/image";
import tokenList from "@/lib/data/tokenList.json";
import { ManagePositionsButton } from "../ManagePositionsButton";
import { useCollapsible } from "@/contexts/CollapsibleContext";
import { formatNumber, formatCurrency } from "@/lib/utils/numberFormat";
import { PanoraPricesService } from "@/lib/services/panora/prices";
import { TokenPrice } from "@/lib/types/panora";
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { createDualAddressPriceMap } from "@/lib/utils/addressNormalization";

interface PositionsListProps {
  address?: string;
  onPositionsValueChange?: (value: number) => void;
  refreshKey?: number;
  onPositionsCheckComplete?: () => void;
  showManageButton?: boolean;
}

interface AavePosition {
  underlying_asset: string;
  symbol: string;
  name: string;
  decimals: number;
  deposit_amount: number;
  deposit_value_usd: number;
  borrow_amount: number;
  borrow_value_usd: number;
  usage_as_collateral_enabled: boolean;
  liquidity_index: string;
  variable_borrow_index: string;
}

interface TokenInfo {
  symbol: string;
  name: string;
  logoUrl: string | null;
  decimals: number;
  usdPrice: string | null;
}

export function PositionsList({ address, onPositionsValueChange, refreshKey, onPositionsCheckComplete, showManageButton=true }: PositionsListProps) {
  const { account } = useWallet();
  const [positions, setPositions] = useState<AavePosition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokenPrices, setTokenPrices] = useState<Record<string, string>>({});

  const { isExpanded, toggleSection } = useCollapsible();
  const pricesService = PanoraPricesService.getInstance();

  const walletAddress = address || account?.address?.toString();
  const protocol = getProtocolByName("Aave");

  // Получаем цену токена из кэша
  const getTokenPrice = (coinAddress: string): string => {
    let cleanAddress = coinAddress;
    if (cleanAddress.startsWith('@')) {
      cleanAddress = cleanAddress.slice(1);
    }
    if (!cleanAddress.startsWith('0x')) {
      cleanAddress = `0x${cleanAddress}`;
    }
    const price = tokenPrices[cleanAddress] || '0';
    // Округляем цену до 2 знаков после запятой
    const roundedPrice = formatCurrency(parseFloat(price), 2);
    return roundedPrice;
  };

  // Функция для поиска информации о токене (без цены)
  const getTokenInfo = (coinAddress: string): TokenInfo | null => {
    const token = tokenList.data.data.find(
      (t) => t.faAddress === coinAddress || t.tokenAddress === coinAddress
    );
    
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
  const getRewardTokenInfoHelper = (tokenAddress: string) => {
    const token = tokenList.data.data.find(
      (t) => t.faAddress === tokenAddress || t.tokenAddress === tokenAddress
    );
    
    if (token) {
      return {
        symbol: token.symbol,
        name: token.name,
        icon_uri: token.logoUrl,
        faAddress: token.faAddress,
        address: token.tokenAddress,
        decimals: token.decimals
      };
    }
    
    return null;
  };

    // Получаем все адреса токенов для загрузки цен
  const getAllTokenAddresses = () => {
    const addresses = new Set<string>();
    positions.forEach(position => {
      if (position.underlying_asset) {
        addresses.add(position.underlying_asset);
      }
    });
    return Array.from(addresses);
  };

  // Загружаем цены токенов через Panora API с дебаунсингом
  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      const addresses = getAllTokenAddresses();
      if (addresses.length === 0 || !walletAddress || walletAddress.length < 10) {
        return;
      }

      try {
        const response = await pricesService.getPrices(1, addresses);
        if (response.data) {
          // Use utility function to create price map with both address versions
          const prices = createDualAddressPriceMap(response.data);
          setTokenPrices(prices);
        }
      } catch (error) {
        console.error('Failed to fetch token prices:', error);
      }
    }, 1000); // Уменьшаем дебаунсинг до 1 секунды

    return () => clearTimeout(timeoutId);
  }, [walletAddress, positions]); // Добавляем positions в зависимости



  // Объединенный useEffect для загрузки позиций с дебаунсингом
  useEffect(() => {
    if (!walletAddress || walletAddress.length < 10) {
      setPositions([]);
      onPositionsCheckComplete?.();
      return;
    }

    const timeoutId = setTimeout(async () => {
      setLoading(true);
      setError(null);
      
      try {
        const response = await fetch(`/api/protocols/aave/positions?address=${walletAddress}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch positions: ${response.status}`);
        }
        
        const data = await response.json();
        if (data.success && data.data) {
          setPositions(data.data);
        } else {
          setPositions([]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch positions');
        // Keep previous positions on error to avoid flicker
      } finally {
        setLoading(false);
        onPositionsCheckComplete?.();
      }
    }, 3000); // Увеличиваем дебаунсинг до 3 секунд

    return () => clearTimeout(timeoutId);
  }, [walletAddress, refreshKey]);



  // Вычисляем общую стоимость позиций (collateral - borrow)
  const totalValue = positions.reduce((sum, position) => {
    return sum + (position.deposit_value_usd || 0) - (position.borrow_value_usd || 0);
  }, 0);

  // Уведомляем родительский компонент об изменении стоимости
  useEffect(() => {
    if (onPositionsValueChange) {
      onPositionsValueChange(totalValue);
    }
  }, [onPositionsValueChange, totalValue]); // ✅ Возвращаем totalValue в зависимости

  // Сортируем позиции по стоимости (deposits сверху, borrows снизу)
  const sortedPositions = [...positions].sort((a, b) => {
    const aValue = (a.deposit_value_usd || 0) + (a.borrow_value_usd || 0);
    const bValue = (b.deposit_value_usd || 0) + (b.borrow_value_usd || 0);
    return bValue - aValue;
  });

  // Если нет позиций, не отображаем блок
  if (positions.length === 0) {
    return null;
  }

  return (
    <Card className="w-full">
      <CardHeader 
        className="py-2 cursor-pointer hover:bg-accent/50 transition-colors"
        onClick={() => toggleSection('aave')}
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
            <CardTitle className="text-lg">Aave</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-lg">{formatCurrency(totalValue, 2)}</div>
            <ChevronDown className={cn(
              "h-5 w-5 transition-transform",
              isExpanded('aave') ? "transform rotate-0" : "transform -rotate-90"
            )} />
          </div>
        </div>
      </CardHeader>
      
      {isExpanded('aave') && (
        <CardContent className="flex-1 overflow-y-auto px-3 pt-0">
          <ScrollArea className="h-full">
            {sortedPositions.map((position, index) => {
              const tokenInfo = getTokenInfo(position.underlying_asset);
              const hasDeposit = position.deposit_amount > 0;
              const hasBorrow = position.borrow_amount > 0;
              
              return (
                <div key={`${position.underlying_asset}-${index}`} className="mb-2">
                                     {/* Deposit Position */}
                   {hasDeposit && (
                     <div className="mb-2 rounded p-2">
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
                               <span className="text-sm font-medium">{position.symbol}</span>
                               <span className="text-xs font-semibold px-2 py-0.5 rounded bg-green-500/10 text-green-600 border border-green-500/20">
                                 Supply
                               </span>
                               {position.usage_as_collateral_enabled && (
                                 <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 border border-blue-500/20">
                                   Collateral
                                 </span>
                               )}
                             </div>
                             <div className="text-xs text-muted-foreground">
                               {getTokenPrice(position.underlying_asset) || '$0.00'}
                             </div>
                           </div>
                         </div>
                         <div className="text-right">
                           <div className="text-sm font-medium">{formatCurrency(position.deposit_value_usd, 2)}</div>
                           <div className="text-xs text-muted-foreground">
                             {formatNumber(position.deposit_amount, 4)}
                           </div>
                         </div>
                      </div>
                    </div>
                  )}
                  
                                     {/* Borrow Position */}
                   {hasBorrow && (
                     <div className="mb-2 rounded p-2">
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
                               <span className="text-sm font-medium">{position.symbol}</span>
                               <span className="text-xs font-semibold px-2 py-0.5 rounded bg-red-500/10 text-red-600 border border-red-500/20">
                                 Borrow
                               </span>
                             </div>
                             <div className="text-xs text-muted-foreground">
                               {getTokenPrice(position.underlying_asset) || '$0.00'}
                             </div>
                           </div>
                         </div>
                         <div className="text-right">
                           <div className="text-sm font-medium">{formatCurrency(position.borrow_value_usd, 2)}</div>
                           <div className="text-xs text-muted-foreground">
                             {formatNumber(position.borrow_amount, 4)}
                           </div>
                         </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            
            
            
            {/* Кнопка управления позициями */}
            {protocol && showManageButton && (
              <ManagePositionsButton protocol={protocol} />
            )}
          </ScrollArea>
        </CardContent>
      )}
    </Card>
  );
}
