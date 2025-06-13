import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { getProtocolByName } from "@/lib/protocols/getProtocolsList";
import Image from "next/image";
import tokenList from "@/lib/data/tokenList.json";

interface PositionsListProps {
  address?: string;
  onPositionsValueChange?: (value: number) => void;
}

interface Position {
  assetName: string;
  balance: string;
  value: string;
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
  return tokenList.data.data.find((token: any) => 
    token.symbol === symbol || 
    token.tokenAddress === address
  );
}

export function PositionsList({ address, onPositionsValueChange }: PositionsListProps) {
  const { account } = useWallet();
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const [totalValue, setTotalValue] = useState(0);

  const walletAddress = address || account?.address?.toString();
  const protocol = getProtocolByName("Aries");

  useEffect(() => {
    async function loadPositions() {
      if (!walletAddress) {
        setPositions([]);
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
        console.log('Aries API response:', data); // Добавляем для отладки
        
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
        console.error('Error loading Aries positions:', err);
        setError('Failed to load positions');
        setPositions([]);
      } finally {
        setLoading(false);
      }
    }

    loadPositions();
  }, [walletAddress]);

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
        onClick={() => setIsExpanded(!isExpanded)}
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
            <div className="text-lg">${totalValue.toFixed(2)}</div>
            <ChevronDown className={cn(
              "h-5 w-5 transition-transform",
              isExpanded ? "transform rotate-0" : "transform -rotate-90"
            )} />
          </div>
        </div>
      </CardHeader>
      
      {isExpanded && (
        <CardContent className="flex-1 overflow-y-auto px-3 pt-0">
          <ScrollArea className="h-full">
            {positions.map((position, index) => {
              const tokenInfo = getTokenInfo(position.assetName);
              const amount = parseFloat(position.balance) / (tokenInfo?.decimals ? 10 ** tokenInfo.decimals : 1e8);
              const value = parseFloat(position.value);
              
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
                      <div>
                        <div className="text-sm font-medium">{position.assetName}</div>
                        <div className="text-xs text-muted-foreground">
                          ${parseFloat(position.assetInfo.price).toFixed(2)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">${value.toFixed(2)}</div>
                      <div className="text-xs text-muted-foreground">{amount.toFixed(4)}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </ScrollArea>
        </CardContent>
      )}
    </Card>
  );
} 