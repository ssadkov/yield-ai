import { useEffect, useState } from "react";
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
import { formatNumber, formatCurrency } from "@/lib/utils/numberFormat";

interface PositionsListProps {
  address?: string;
  onPositionsValueChange?: (value: number) => void;
  refreshKey?: number;
  onPositionsCheckComplete?: () => void;
  showManageButton?: boolean;
}

interface Position {
  assetName: string;
  balance: string;
  value: string;
  type: 'deposit' | 'borrow';
  assetInfo: {
    name: string;
    symbol: string;
    decimals: number;
    price: string;
  };
}

interface Deposit {
  collateral_amount: number;
  collateral_coins: number;
  collateral_value: number;
}

interface Borrow {
  borrowed_coins: number;
  borrowed_value: number;
}

interface Profile {
  meta: {
    module: string;
    owner: string;
    version: number;
    timestamp: string;
  };
  profileAddress: string;
  profileName: string;
  deposits: Record<string, Deposit>;
  borrows: Record<string, Borrow>;
  equity: number;
  collateralValue: number;
  loanValue: number;
  riskFactor: number | null;
}

interface Profiles {
  profiles: Record<string, Profile>;
}

interface AriesResponse {
  profiles: Profiles;
  total_equity: number;
}

function getTokenInfo(address: string) {
  // Если адрес содержит ::, берем последнюю часть
  const symbol = address.includes('::') ? address.split('::').pop() : address;
  
  // Normalize addresses by removing leading zeros after 0x
  const normalizeAddress = (addr: string) => {
    if (!addr || !addr.startsWith('0x')) return addr;
    return '0x' + addr.slice(2).replace(/^0+/, '') || '0x0';
  };
  
  const normalizedAddress = normalizeAddress(address);
  
  return tokenList.data.data.find((token: any) => {
    const normalizedTokenAddress = normalizeAddress(token.tokenAddress || '');
    const normalizedFaAddress = normalizeAddress(token.faAddress || '');
    
    return token.symbol === symbol || 
           normalizedTokenAddress === normalizedAddress ||
           normalizedFaAddress === normalizedAddress;
  });
}

export function PositionsList({ address, onPositionsValueChange, refreshKey, onPositionsCheckComplete, showManageButton=true }: PositionsListProps) {
  const { account } = useWallet();
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isExpanded, toggleSection } = useCollapsible();
  const [totalValue, setTotalValue] = useState(0);

  const walletAddress = address || account?.address?.toString();
  const protocol = getProtocolByName("Aries");

  useEffect(() => {
    async function loadPositions() {
      if (!walletAddress) {
        setPositions((prev) => prev);
        onPositionsCheckComplete?.();
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`/api/protocols/aries/userPositions?address=${walletAddress}`);
        
        if (!response.ok) {
          throw new Error(`API returned status ${response.status}`);
        }
        
        const data = await response.json() as AriesResponse;
        // console.log('Aries API response:', data); // Добавляем для отладки
        
        if (data.profiles?.profiles) {
          const profiles = Object.values(data.profiles.profiles);
          if (profiles.length > 0) {
            const profile = profiles[0];
            const newPositions: Position[] = [];

            // Обрабатываем депозиты
            if (profile.deposits) {
              Object.entries(profile.deposits).forEach(([coin, deposit]) => {
                if (deposit.collateral_coins > 0) {
                  const tokenInfo = getTokenInfo(coin);
                  const symbol = tokenInfo?.symbol || coin.split('::').pop() || '';
                  newPositions.push({
                    assetName: symbol,
                    balance: deposit.collateral_coins.toString(),
                    value: deposit.collateral_value.toString(),
                    type: 'deposit',
                    assetInfo: {
                      name: tokenInfo?.name || symbol,
                      symbol: symbol,
                      decimals: tokenInfo?.decimals || 8,
                      price: (deposit.collateral_value / deposit.collateral_coins).toString()
                    }
                  });
                }
              });
            }

            // Обрабатываем займы
            if (profile.borrows) {
              Object.entries(profile.borrows).forEach(([coin, borrow]) => {
                if (borrow.borrowed_coins > 0) {
                  const tokenInfo = getTokenInfo(coin);
                  const symbol = tokenInfo?.symbol || coin.split('::').pop() || '';
                  newPositions.push({
                    assetName: symbol,
                    balance: borrow.borrowed_coins.toString(),
                    value: borrow.borrowed_value.toString(),
                    type: 'borrow',
                    assetInfo: {
                      name: tokenInfo?.name || symbol,
                      symbol: symbol,
                      decimals: tokenInfo?.decimals || 8,
                      price: (borrow.borrowed_value / borrow.borrowed_coins).toString()
                    }
                  });
                }
              });
            }

            setPositions(newPositions);
            setTotalValue(profile.equity || 0);
          }
        }
      } catch (err) {
        // console.error('Error loading Aries positions:', err);
        setError('Failed to load positions');
        // keep previous positions on error
      } finally {
        setLoading(false);
        onPositionsCheckComplete?.();
      }
    }

    loadPositions();
  }, [walletAddress, refreshKey]);

  // Вызываем колбэк при изменении общей суммы позиций
  useEffect(() => {
    onPositionsValueChange?.(totalValue);
  }, [totalValue, onPositionsValueChange]);

  // Если нет позиций, не отображаем блок
  if (positions.length === 0) {
    return null;
  }

  return (
    <Card className="w-full h-full flex flex-col">
      <CardHeader 
        className="py-2 cursor-pointer hover:bg-accent/50 transition-colors"
        onClick={() => toggleSection('aries')}
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
            <CardTitle className="text-lg">Aries</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-lg">{formatCurrency(totalValue, 2)}</div>
            <ChevronDown className={cn(
              "h-5 w-5 transition-transform",
              isExpanded('aries') ? "transform rotate-0" : "transform -rotate-90"
            )} />
          </div>
        </div>
      </CardHeader>
      
      {isExpanded('aries') && (
        <CardContent className="flex-1 overflow-y-auto px-3 pt-0">
          <ScrollArea className="h-full">
            {positions.map((position, index) => {
              const tokenInfo = getTokenInfo(position.assetName);
              const amount = parseFloat(position.balance) / (tokenInfo?.decimals ? 10 ** tokenInfo.decimals : 1e8);
              const value = parseFloat(position.value);
              const isBorrow = position.type === 'borrow';
              
              return (
                <div key={`${position.assetName}-${index}`} className="mb-2">
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
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "text-sm font-medium",
                          isBorrow && "text-red-500"
                        )}>{position.assetName}</div>
                        {isBorrow && (
                          <div className="text-xs px-1.5 py-0.5 rounded bg-red-500/10 text-red-500 border border-red-500/20">
                            Borrow
                          </div>
                        )}
                      </div>
                      <div className={cn(
                        "text-xs",
                        isBorrow ? "text-red-400" : "text-muted-foreground"
                      )}>
                        {formatCurrency(parseFloat(position.assetInfo.price), 2)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={cn(
                        "text-sm font-medium",
                        isBorrow && "text-red-500"
                      )}>{formatCurrency(value, 2)}</div>
                      <div className={cn(
                        "text-xs",
                        isBorrow ? "text-red-400" : "text-muted-foreground"
                      )}>{formatNumber(amount, 4)}</div>
                    </div>
                  </div>
                </div>
              );
            })}
            {protocol && showManageButton && (
              <ManagePositionsButton protocol={protocol} />
            )}
          </ScrollArea>
        </CardContent>
      )}
    </Card>
  );
} 