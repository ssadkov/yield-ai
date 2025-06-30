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
import { parseMesoPosition, formatMesoPosition } from "@/lib/protocols/meso/parser";
import tokenList from "@/lib/data/tokenList.json";
import { Badge } from "@/components/ui/badge";
import { getMesoTokenByInner } from "@/lib/protocols/meso/tokens";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface MesoPositionsProps {
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
  inner: string;
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
            
            // Добавляем депозиты
            parsed.deposits.forEach(deposit => {
              const tokenInfo = getTokenInfo(deposit.inner);
              const amount = formatTokenAmount(deposit.shares, deposit.decimals);
              const value = tokenInfo?.usdPrice ? 
                parseFloat(amount) * parseFloat(tokenInfo.usdPrice) : 0;
              
              newPositions.push({
                assetName: deposit.tokenSymbol,
                balance: deposit.shares,
                type: 'deposit',
                inner: deposit.inner,
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
              const tokenInfo = getTokenInfo(debt.inner);
              const amount = formatTokenAmount(debt.shares, debt.decimals);
              const value = tokenInfo?.usdPrice ? 
                parseFloat(amount) * parseFloat(tokenInfo.usdPrice) : 0;
              
              newPositions.push({
                assetName: debt.tokenSymbol,
                balance: debt.shares,
                type: 'debt',
                inner: debt.inner,
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
          }
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

  // Новый useEffect для расчёта суммы по sortedPositions
  useEffect(() => {
    console.log('sortedPositions:', sortedPositions);
    const total = sortedPositions.reduce((sum, position) => {
      const mesoToken = getMesoTokenByInner(position.inner);
      const tokenInfo = mesoToken ? getTokenInfo(mesoToken.tokenAddress) : undefined;
      const amount = parseFloat(formatTokenAmount(position.balance, mesoToken?.decimals ?? position.assetInfo.decimals));
      const price = tokenInfo?.usdPrice ? parseFloat(tokenInfo.usdPrice) : undefined;
      const value = price ? amount * price : 0;
      console.log('token:', mesoToken?.symbol || position.assetInfo.symbol, 'amount:', amount, 'price:', price, 'value:', value);
      return sum + (position.type === 'deposit' ? value : -value);
    }, 0);
    console.log('totalValue:', total);
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
    <div className="space-y-4 text-base">
      <ScrollArea>
        {sortedPositions.map((position, index) => {
          // Получаем mapping по inner
          const mesoToken = getMesoTokenByInner((position as any).inner);
          const tokenInfo = mesoToken ? getTokenInfo(mesoToken.tokenAddress) : undefined;
          const amount = parseFloat(formatTokenAmount(position.balance, mesoToken?.decimals ?? position.assetInfo.decimals));
          const price = tokenInfo?.usdPrice ? parseFloat(tokenInfo.usdPrice) : undefined;
          const value = price ? amount * price : 0;
          return (
            <div key={`${position.assetName}-${index}`} className="flex justify-between items-center p-4 border-b last:border-b-0">
              <div className="flex items-center gap-3">
                {tokenInfo?.logoUrl && (
                  <div className="w-8 h-8 relative">
                    <Image 
                      src={tokenInfo.logoUrl} 
                      alt={mesoToken?.symbol || position.assetInfo.symbol}
                      width={32}
                      height={32}
                      className="object-contain"
                    />
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-medium">{mesoToken?.symbol || position.assetInfo.symbol}</span>
                    <Badge variant="outline" className={position.type === 'deposit' ? "bg-green-500/10 text-green-600 border-green-500/20 text-base font-semibold px-3 py-1" : "bg-red-500/10 text-red-600 border-red-500/20 text-base font-semibold px-3 py-1"}>
                      {position.type === 'deposit' ? 'Supply' : 'Borrow'}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {price ? `$${price.toFixed(2)}` : '$N/A'}
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
      <div className="flex items-center justify-between pt-6 pb-6">
        <span className="text-xl">Total assets in Meso:</span>
        <span className="text-xl text-primary font-bold">${totalValue.toFixed(2)}</span>
      </div>
    </div>
  );
} 