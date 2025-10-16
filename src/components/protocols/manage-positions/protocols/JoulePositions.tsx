'use client';

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { cn } from "@/lib/utils";
import Image from "next/image";
import tokenList from "@/lib/data/tokenList.json";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface Position {
  position_name: string;
  borrow_positions: {
    data: Array<{
      key: string;
      value: {
        borrow_amount: string;
        coin_name: string;
        interest_accumulated: string;
      }
    }>
  };
  lend_positions: {
    data: Array<{
      key: string;
      value: string;
    }>
  };
}

export function JoulePositions() {
  const { account } = useWallet();
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalValue, setTotalValue] = useState<number>(0);
  const [marketData, setMarketData] = useState<any[]>([]);

  // Получаем данные о протоколе для логотипа и названия
  const protocol = {
    name: 'Joule',
    logoUrl: 'https://app.joule.finance/favicon.ico',
  };

  const getTokenInfo = (coinName: string) => {
    const cleanAddress = coinName.startsWith('@') ? coinName.slice(1) : coinName;
    const fullAddress = cleanAddress.startsWith('0x') ? cleanAddress : `0x${cleanAddress}`;
    const token = (tokenList as any).data.data.find((token: any) => 
      token.tokenAddress === fullAddress || 
      token.faAddress === fullAddress ||
      token.symbol === coinName
    );
    if (!token) return undefined;
    return {
      address: token.tokenAddress,
      faAddress: token.faAddress,
      symbol: token.symbol,
      logoUrl: token.logoUrl,
      decimals: token.decimals,
      usdPrice: token.usdPrice
    };
  };

  useEffect(() => {
    async function loadPositions() {
      if (!account?.address) {
        setPositions([]);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`/api/protocols/joule/userPositions?address=${account.address}`);
        if (!response.ok) {
          throw new Error(`API returned status ${response.status}`);
        }
        const data = await response.json();
        if (data.userPositions?.[0]?.positions_map?.data) {
          const positionsData = data.userPositions[0].positions_map.data.map((item: any) => item.value);
          setPositions(positionsData);
          // Рассчитываем общую стоимость позиций
          let total = 0;
          positionsData.forEach((position: Position) => {
            position.lend_positions.data.forEach(lend => {
              const tokenInfo = getTokenInfo(lend.key);
              if (tokenInfo?.usdPrice) {
                const amount = parseFloat(lend.value) / (tokenInfo.decimals ? 10 ** tokenInfo.decimals : 1e8);
                total += amount * parseFloat(tokenInfo.usdPrice);
              }
            });
            position.borrow_positions.data.forEach(borrow => {
              const tokenInfo = getTokenInfo(borrow.value.coin_name);
              if (tokenInfo?.usdPrice) {
                const amount = parseFloat(borrow.value.borrow_amount) / (tokenInfo.decimals ? 10 ** tokenInfo.decimals : 1e8);
                total -= amount * parseFloat(tokenInfo.usdPrice);
              }
            });
          });
          setTotalValue(total);
        } else {
          setPositions([]);
        }
      } catch (err) {
        setError('Failed to load positions');
        setPositions([]);
      } finally {
        setLoading(false);
      }
    }
    loadPositions();
  }, [account?.address]);

  // Загружаем market data для Joule
  useEffect(() => {
    fetch('/api/aptos/pools')
      .then(res => res.json())
      .then(data => setMarketData(data.data?.filter((m: any) => m.protocol === 'Joule') || []));
  }, []);

  // Получить APY для supply/borrow
  const getApyForToken = (tokenAddress: string, type: 'supply' | 'borrow', faAddress?: string) => {
    const market = marketData.find((m: any) => m.token === tokenAddress || (faAddress && m.token === faAddress));
    if (!market) return null;
    if (type === 'supply') return market.totalAPY ?? null;
    if (type === 'borrow') return market.borrowAPY ?? null;
    return null;
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
    <div className="w-full mb-6 py-2 px-6">
      <div className="space-y-4 text-base">
        {positions.map((position, index) => {
          // Рассчитываем стоимость позиции
          let positionValue = 0;
          position.lend_positions.data.forEach(lend => {
            const tokenInfo = getTokenInfo(lend.key);
            if (tokenInfo?.usdPrice) {
              const amount = parseFloat(lend.value) / (tokenInfo.decimals ? 10 ** tokenInfo.decimals : 1e8);
              positionValue += amount * parseFloat(tokenInfo.usdPrice);
            }
          });
          position.borrow_positions.data.forEach(borrow => {
            const tokenInfo = getTokenInfo(borrow.value.coin_name);
            if (tokenInfo?.usdPrice) {
              const amount = parseFloat(borrow.value.borrow_amount) / (tokenInfo.decimals ? 10 ** tokenInfo.decimals : 1e8);
              positionValue -= amount * parseFloat(tokenInfo.usdPrice);
            }
          });
          return (
            <div key={`${position.position_name}-${index}`} className="p-4 border-b last:border-b-0">
              <div className="flex justify-between items-center mb-2">
                <span className="text-lg">{position.position_name}</span>
              </div>
              {/* Lend (Supply) */}
              {position.lend_positions.data.length > 0 && (
                <div className="mb-2">
                  {position.lend_positions.data.map((lend, idx) => {
                    const tokenInfo = getTokenInfo(lend.key);
                    const amount = parseFloat(lend.value) / (tokenInfo?.decimals ? 10 ** tokenInfo.decimals : 1e8);
                    const value = tokenInfo?.usdPrice ? amount * parseFloat(tokenInfo.usdPrice) : 0;
                    const apy = getApyForToken(tokenInfo?.address, 'supply', tokenInfo?.faAddress);
                    return (
                      <div key={`lend-${lend.key}-${idx}`} className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-2">
                          {tokenInfo?.logoUrl && (
                            <div className="w-8 h-8 relative">
                              <Image src={tokenInfo.logoUrl} alt={tokenInfo.symbol} width={32} height={32} className="object-contain" />
                            </div>
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{tokenInfo?.symbol || lend.key.split('::').pop()}</span>
                              <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20 text-xs font-normal px-2 py-0.5 h-5">Supply</Badge>
                            </div>
                            <div className="text-base text-muted-foreground mt-0.5">${tokenInfo?.usdPrice ? parseFloat(tokenInfo.usdPrice).toFixed(2) : 'N/A'}</div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-0.5">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20 text-xs font-normal px-2 py-0.5 h-5">
                              APY: {apy !== null ? (apy).toFixed(2) + '%' : 'N/A'}
                            </Badge>
                            <span className="text-lg font-bold text-right w-24">${value.toFixed(2)}</span>
                          </div>
                          <span className="text-base text-muted-foreground font-semibold">{amount.toFixed(4)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {/* Borrow */}
              {position.borrow_positions.data.length > 0 && (
                <div className="mb-2">
                  {position.borrow_positions.data.map((borrow, idx) => {
                    const tokenInfo = getTokenInfo(borrow.value.coin_name);
                    const amount = parseFloat(borrow.value.borrow_amount) / (tokenInfo?.decimals ? 10 ** tokenInfo.decimals : 1e8);
                    const value = tokenInfo?.usdPrice ? amount * parseFloat(tokenInfo.usdPrice) : 0;
                    const apy = getApyForToken(tokenInfo?.address, 'borrow', tokenInfo?.faAddress);
                    return (
                      <div key={`borrow-${borrow.key}-${idx}`} className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-2">
                          {tokenInfo?.logoUrl && (
                            <div className="w-8 h-8 relative">
                              <Image src={tokenInfo.logoUrl} alt={tokenInfo.symbol} width={32} height={32} className="object-contain" />
                            </div>
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{tokenInfo?.symbol || borrow.value.coin_name.split('::').pop()}</span>
                              <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20 text-xs font-normal px-2 py-0.5 h-5">Borrow</Badge>
                            </div>
                            <div className="text-base text-muted-foreground mt-0.5">${tokenInfo?.usdPrice ? parseFloat(tokenInfo.usdPrice).toFixed(2) : 'N/A'}</div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-0.5">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20 text-xs font-normal px-2 py-0.5 h-5">
                              APR: {apy !== null ? (apy).toFixed(2) + '%' : 'N/A'}
                            </Badge>
                            <span className="text-lg font-bold text-right w-24">${value.toFixed(2)}</span>
                          </div>
                          <span className="text-base text-muted-foreground font-semibold">{amount.toFixed(4)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
        <div className="flex items-center justify-between pt-6 pb-6">
          <span className="text-xl">Total assets in Joule:</span>
          <span className="text-xl text-primary font-bold">${totalValue.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
} 