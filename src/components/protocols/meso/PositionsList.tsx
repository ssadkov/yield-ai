import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { getProtocolByName } from "@/lib/protocols/getProtocolsList";
import Image from "next/image";
import { ManagePositionsButton } from "../ManagePositionsButton";
import { useCollapsible } from "@/contexts/CollapsibleContext";
import { parseMesoPosition, formatMesoPosition } from "@/lib/protocols/meso/parser";
import tokenList from "@/lib/data/tokenList.json";
import { getMesoTokenByInner } from "@/lib/protocols/meso/tokens";

interface PositionsListProps {
  address?: string;
  onPositionsValueChange?: (value: number) => void;
}

interface Position {
  assetName: string;
  balance: string;
  type: 'deposit' | 'debt';
  assetInfo: {
    name: string;
    symbol: string;
    decimals: number;
    logoUrl?: string;
    price?: string;
  };
}

interface MesoResponse {
  data: Array<{
    type: string;
    data: any;
  }>;
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
    token.tokenAddress === tokenAddress || token.faAddress === tokenAddress
  );
}

export function PositionsList({ address, onPositionsValueChange }: PositionsListProps) {
  const { account } = useWallet();
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isExpanded, toggleSection } = useCollapsible();
  const [totalValue, setTotalValue] = useState(0);

  const walletAddress = address || account?.address?.toString();
  const protocol = getProtocolByName("Meso Finance");

  useEffect(() => {
    async function loadPositions() {
      if (!walletAddress) {
        setPositions([]);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        
        // Получаем ресурсы аккаунта
        const response = await fetch('/api/aptos/resources', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ address: walletAddress }),
        });
        
        if (!response.ok) {
          throw new Error(`API returned status ${response.status}`);
        }
        
        const data = await response.json() as MesoResponse;
        console.log('Meso API response:', data);
        
        // Ищем позицию Meso Finance
        const mesoResource = data.data?.find((resource: any) => 
          resource.type === '0x68476f9d437e3f32fd262ba898b5e3ee0a23a1d586a6cf29a28add35f253f6f7::lending_pool::UserPosition'
        );
        
        if (mesoResource) {
          const parsed = parseMesoPosition(mesoResource.data);
          if (parsed) {
            const newPositions: Position[] = [];
            let totalValueSum = 0;
            
            // Добавляем депозиты
            parsed.deposits.forEach(deposit => {
              const mesoToken = getMesoTokenByInner(deposit.inner);
              const tokenInfo = mesoToken ? getTokenInfo(mesoToken.tokenAddress) : undefined;
              const amount = formatTokenAmount(deposit.shares, deposit.decimals);
              const value = tokenInfo?.usdPrice ? 
                parseFloat(amount) * parseFloat(tokenInfo.usdPrice) : 0;
              
              totalValueSum += value;
              
              newPositions.push({
                assetName: deposit.tokenSymbol,
                balance: deposit.shares,
                type: 'deposit',
                assetInfo: {
                  name: deposit.tokenName,
                  symbol: deposit.tokenSymbol,
                  decimals: deposit.decimals,
                  logoUrl: tokenInfo?.logoUrl,
                  price: tokenInfo?.usdPrice
                }
              });
            });
            
            // Добавляем займы (вычитаем из общей суммы)
            parsed.debts.forEach(debt => {
              const mesoToken = getMesoTokenByInner(debt.inner);
              const tokenInfo = mesoToken ? getTokenInfo(mesoToken.tokenAddress) : undefined;
              const amount = formatTokenAmount(debt.shares, debt.decimals);
              const value = tokenInfo?.usdPrice ? 
                parseFloat(amount) * parseFloat(tokenInfo.usdPrice) : 0;
              
              totalValueSum -= value; // Займы уменьшают общую стоимость
              
              newPositions.push({
                assetName: debt.tokenSymbol,
                balance: debt.shares,
                type: 'debt',
                assetInfo: {
                  name: debt.tokenName,
                  symbol: debt.tokenSymbol,
                  decimals: debt.decimals,
                  logoUrl: tokenInfo?.logoUrl,
                  price: tokenInfo?.usdPrice
                }
              });
            });
            
            setPositions(newPositions);
            setTotalValue(Math.max(0, totalValueSum)); // Не показываем отрицательные значения
          }
        } else {
          setPositions([]);
          setTotalValue(0);
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

  // Вызываем колбэк при изменении общей суммы позиций
  useEffect(() => {
    onPositionsValueChange?.(totalValue);
  }, [totalValue, onPositionsValueChange]);

  // Если нет позиций, не отображаем блок
  if (positions.length === 0) {
    return null;
  }

  // Сортировка: сначала депозиты, потом займы, внутри каждой группы — по убыванию value
  const sortedPositions = [...positions].sort((a, b) => {
    if (a.type !== b.type) {
      // deposit выше debt
      return a.type === 'deposit' ? -1 : 1;
    }
    // Сортировка по value (стоимости позиции)
    const aAmount = parseFloat(formatTokenAmount(a.balance, a.assetInfo.decimals));
    const bAmount = parseFloat(formatTokenAmount(b.balance, b.assetInfo.decimals));
    const aValue = a.assetInfo.price ? aAmount * parseFloat(a.assetInfo.price) : 0;
    const bValue = b.assetInfo.price ? bAmount * parseFloat(b.assetInfo.price) : 0;
    return bValue - aValue;
  });

  return (
    <Card className="w-full h-full flex flex-col">
      <CardHeader 
        className="py-2 cursor-pointer hover:bg-accent/50 transition-colors"
        onClick={() => toggleSection('meso')}
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
            <CardTitle className="text-lg">Meso Finance</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-lg">${totalValue.toFixed(2)}</div>
            <ChevronDown className={cn(
              "h-5 w-5 transition-transform",
              isExpanded('meso') ? "transform rotate-0" : "transform -rotate-90"
            )} />
          </div>
        </div>
      </CardHeader>
      
      {isExpanded('meso') && (
        <CardContent className="flex-1 overflow-y-auto px-3 pt-0">
          <ScrollArea className="h-full">
            {sortedPositions.map((position, index) => {
              const amount = formatTokenAmount(position.balance, position.assetInfo.decimals);
              const isDebt = position.type === 'debt';
              const value = position.assetInfo.price ? 
                parseFloat(amount) * parseFloat(position.assetInfo.price) : 0;
              
              return (
                <div key={`${position.assetName}-${index}`} className="mb-2">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      {position.assetInfo.logoUrl && (
                        <div className="w-6 h-6 relative">
                          <Image 
                            src={position.assetInfo.logoUrl} 
                            alt={position.assetInfo.symbol}
                            width={24}
                            height={24}
                            className="object-contain"
                          />
                        </div>
                      )}
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            "text-sm font-medium",
                            isDebt && "text-red-500"
                          )}>{position.assetName}</div>
                          {isDebt && (
                            <div className="text-xs px-1.5 py-0.5 rounded bg-red-500/10 text-red-500 border border-red-500/20">
                              Borrow
                            </div>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">${position.assetInfo.price ? parseFloat(position.assetInfo.price).toFixed(2) : 'N/A'}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={cn(
                        "text-sm font-medium",
                        isDebt && "text-red-500"
                      )}>${value.toFixed(2)}</div>
                      <div className={cn(
                        "text-xs",
                        isDebt ? "text-red-400" : "text-muted-foreground"
                      )}>{amount}</div>
                    </div>
                  </div>
                </div>
              );
            })}
            {protocol && <ManagePositionsButton protocol={protocol} />}
          </ScrollArea>
        </CardContent>
      )}
    </Card>
  );
} 