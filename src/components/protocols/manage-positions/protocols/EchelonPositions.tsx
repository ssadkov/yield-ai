'use client';

import { useEffect, useState, useCallback, useRef } from "react";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import Image from "next/image";
import tokenList from "@/lib/data/tokenList.json";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useWithdraw } from "@/lib/hooks/useWithdraw";
import { WithdrawModal } from "@/components/ui/withdraw-modal";
import echelonMarkets from "@/lib/data/echelonMarkets.json";
import { useDragDrop } from "@/contexts/DragDropContext";
import { PositionDragData } from "@/types/dragDrop";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface Position {
  coin: string;
  amount: number | string;
  market?: string;
  type?: string; // supply или borrow
}

export function EchelonPositions() {
  const { account } = useWallet();
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalValue, setTotalValue] = useState<number>(0);
  const [marketData, setMarketData] = useState<any[]>([]);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
  const { withdraw, isLoading: isWithdrawing } = useWithdraw();
  const { startDrag, endDrag, state, closePositionModal, closeAllModals, setPositionConfirmHandler } = useDragDrop();
  const isModalOpenRef = useRef(false);

  // Функция для загрузки позиций
  const loadPositions = useCallback(async () => {
    if (!account?.address) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/protocols/echelon/userPositions?address=${account.address}`);
      const data = await response.json();
      console.log('EchelonPositions - loadPositions raw data:', data);
      
      if (data.success && Array.isArray(data.data)) {
        console.log('EchelonPositions - data.data length:', data.data.length);
        console.log('EchelonPositions - data.data:', data.data);
        
        // Просто устанавливаем позиции без дополнительной обработки
        console.log('EchelonPositions - setting positions with length:', data.data.length);
        setPositions(data.data);
      } else {
        console.log('EchelonPositions - no valid data, setting empty positions');
        console.log('EchelonPositions - data.success:', data.success);
        console.log('EchelonPositions - data.data type:', typeof data.data);
        console.log('EchelonPositions - data.data:', data.data);
        setPositions([]);
      }
    } catch (error) {
      console.error('EchelonPositions - loadPositions error:', error);
      setPositions([]);
    } finally {
      setLoading(false);
    }
  }, [account?.address]);

  // Загружаем marketData с APY
  useEffect(() => {
    fetch('/api/protocols/echelon/pools')
      .then(res => res.json())
      .then(data => {
        console.log('EchelonPositions - marketData loaded:', data);
        setMarketData(data.marketData || []);
      })
      .catch(error => {
        console.error('EchelonPositions - marketData load error:', error);
        console.log('Using local market data due to API error');
        setMarketData(echelonMarkets.markets);
      });
  }, []);

  useEffect(() => {
    loadPositions();
  }, [loadPositions]);

  const getTokenInfo = (coinAddress: string) => {
    const token = (tokenList as any).data.data.find(
      (t: any) => t.faAddress === coinAddress || t.tokenAddress === coinAddress
    );
    if (!token) return undefined;
    return {
      address: token.tokenAddress,
      symbol: token.symbol,
      logoUrl: token.logoUrl,
      decimals: token.decimals,
      usdPrice: token.usdPrice
    };
  };

  // Получить APY для позиции
  const getApyForPosition = (position: any) => {
    // Сначала ищем по market, если есть, иначе по coin
    const market = marketData.find((m: any) => m.market === position.market || m.coin === position.coin);
    return market ? market.supplyAPR : null;
  };

  // Сортируем позиции по значению от большего к меньшему
  const sortedPositions = [...positions].sort((a, b) => {
    const tokenInfoA = getTokenInfo(a.coin);
    const tokenInfoB = getTokenInfo(b.coin);
    const amountA = parseFloat(String(a.amount)) / (tokenInfoA?.decimals ? 10 ** tokenInfoA.decimals : 1e8);
    const amountB = parseFloat(String(b.amount)) / (tokenInfoB?.decimals ? 10 ** tokenInfoB.decimals : 1e8);
    const valueA = tokenInfoA?.usdPrice ? amountA * parseFloat(tokenInfoA.usdPrice) : 0;
    const valueB = tokenInfoB?.usdPrice ? amountB * parseFloat(tokenInfoB.usdPrice) : 0;
    // borrow всегда ниже supply
    if ((a.type === 'borrow') !== (b.type === 'borrow')) {
      return a.type === 'borrow' ? 1 : -1;
    }
    return valueB - valueA;
  });

  // Считаем общую сумму: supply плюсуем, borrow вычитаем
  useEffect(() => {
    const total = sortedPositions.reduce((sum, position) => {
      const tokenInfo = getTokenInfo(position.coin);
      const amount = parseFloat(String(position.amount)) / (tokenInfo?.decimals ? 10 ** tokenInfo.decimals : 1e8);
      const value = tokenInfo?.usdPrice ? amount * parseFloat(tokenInfo.usdPrice) : 0;
      if (position.type === 'borrow') {
        return sum - value;
      }
      return sum + value;
    }, 0);
    setTotalValue(total);
  }, [sortedPositions]);

  // Обработчик открытия модального окна withdraw
  const handleWithdrawClick = (position: Position) => {
    setSelectedPosition(position);
    setShowWithdrawModal(true);
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, position: Position) => {
    const tokenInfo = getTokenInfo(position.coin);
    const market = marketData.find((m: any) => m.coin === position.coin);
    
    const dragData: PositionDragData = {
      type: 'position',
      positionId: position.coin,
      asset: position.coin,
      amount: String(position.amount),
      positionType: 'lend',
      protocol: 'Echelon',
      market: market?.market,
      tokenInfo: tokenInfo ? {
        symbol: tokenInfo.symbol,
        logoUrl: tokenInfo.logoUrl,
        decimals: tokenInfo.decimals,
        usdPrice: tokenInfo.usdPrice,
      } : undefined,
    };

    e.dataTransfer.setData('application/json', JSON.stringify(dragData));
    e.dataTransfer.effectAllowed = 'move';
    
    startDrag(dragData);
  };

  const handleDragEnd = () => {
    endDrag();
  };

  // Обработчик подтверждения withdraw
  const handleWithdrawConfirm = async (amount: bigint) => {
    if (!selectedPosition) return;
    
    try {
      console.log('Withdraw confirm - selectedPosition:', selectedPosition);
      console.log('Withdraw confirm - marketData:', marketData);
      
      // Если market address нет в позиции, получаем его из API
      let marketAddress = selectedPosition.market;
      console.log('Withdraw confirm - initial marketAddress:', marketAddress);
      
      if (!marketAddress) {
        console.log('Withdraw confirm - searching for market by coin:', selectedPosition.coin);
        const market = marketData.find((m: any) => m.coin === selectedPosition.coin);
        console.log('Withdraw confirm - found market:', market);
        marketAddress = market?.market;
        console.log('Withdraw confirm - marketAddress from marketData:', marketAddress);
      }
      
      // Если все еще нет market address, попробуем получить его через API
      if (!marketAddress) {
        console.log('Withdraw confirm - trying to get market address via API');
        try {
          const response = await fetch('/api/protocols/echelon/pools');
          const poolsData = await response.json();
          const market = poolsData.marketData?.find((m: any) => m.coin === selectedPosition.coin);
          marketAddress = market?.market;
          console.log('Withdraw confirm - marketAddress from API:', marketAddress);
        } catch (apiError) {
          console.error('Withdraw confirm - API error:', apiError);
        }
      }
      
      // Если все еще нет market address, используем локальные данные
      if (!marketAddress) {
        console.log('Withdraw confirm - trying to get market address from local data');
        const localMarket = echelonMarkets.markets.find((m: any) => m.coin === selectedPosition.coin);
        marketAddress = localMarket?.market;
        console.log('Withdraw confirm - marketAddress from local data:', marketAddress);
      }
      
      if (!marketAddress) {
        console.error('Withdraw confirm - no market address found');
        console.error('Withdraw confirm - selectedPosition.coin:', selectedPosition.coin);
        console.error('Withdraw confirm - marketData length:', marketData.length);
        console.error('Withdraw confirm - marketData coins:', marketData.map((m: any) => m.coin));
        throw new Error('Market address not found for this token');
      }
      
      console.log('Withdraw confirm - final marketAddress:', marketAddress);
      console.log('Withdraw confirm - amount:', amount.toString());
      console.log('Withdraw confirm - coin:', selectedPosition.coin);
      
      await withdraw('echelon', marketAddress, amount, selectedPosition.coin);
      setShowWithdrawModal(false);
      setSelectedPosition(null);
      isModalOpenRef.current = false;
      closePositionModal(selectedPosition.coin);
    } catch (error) {
      console.error('Withdraw failed:', error);
    }
  };

  if (loading) {
    return <div>Loading positions...</div>;
  }

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

  console.log('EchelonPositions - render - positions length:', positions.length);
  console.log('EchelonPositions - render - positions:', positions);
  console.log('EchelonPositions - render - sortedPositions length:', sortedPositions.length);

  if (positions.length === 0) {
    console.log('EchelonPositions - render - returning null because positions.length === 0');
    return null;
  }

  return (
    <div className="space-y-4 text-base">
      <ScrollArea>
        {sortedPositions.map((position, index) => {
          const tokenInfo = getTokenInfo(position.coin);
          const rawAmount = typeof position.amount === 'number' ? position.amount : parseFloat(position.amount);
          const amount = !isNaN(rawAmount) && tokenInfo?.decimals ? rawAmount / 10 ** tokenInfo.decimals : 0;
          const value = tokenInfo?.usdPrice ? (amount * parseFloat(tokenInfo.usdPrice)).toFixed(2) : 'N/A';
          const apy = getApyForPosition(position);
          const isBorrow = position.type === 'borrow';
          
          return (
            <div 
              key={`${position.coin}-${index}`} 
              className={cn(
                'p-4 border-b last:border-b-0 transition-colors',
                isBorrow && 'bg-red-50'
              )}
              draggable={false}
            >
              <div className="flex justify-between items-center">
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
                        variant="outline" 
                        className={cn(
                          isBorrow
                            ? 'bg-red-500/10 text-red-600 border-red-500/20'
                            : 'bg-green-500/10 text-green-600 border-green-500/20',
                          'text-xs font-normal px-2 py-0.5 h-5'
                        )}
                      >
                        {isBorrow ? 'Borrow' : 'Supply'}
                      </Badge>
                    </div>
                    <div className="text-base text-muted-foreground mt-0.5">
                      ${tokenInfo?.usdPrice ? parseFloat(tokenInfo.usdPrice).toFixed(2) : 'N/A'}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className={cn(
                      isBorrow
                        ? 'bg-red-500/10 text-red-600 border-red-500/20'
                        : 'bg-green-500/10 text-green-600 border-green-500/20',
                      'text-xs font-normal px-2 py-0.5 h-5')}
                    >
                      APY: {apy !== null ? (apy * 100).toFixed(2) + '%' : 'N/A'}
                    </Badge>
                    <div className="text-lg font-bold">${value}</div>
                  </div>
                  <div className="text-base text-muted-foreground font-semibold">{amount.toFixed(4)}</div>
                  <div className="flex flex-col gap-1 mt-2">
                    {!isBorrow && (
                      <button
                        className={cn(
                          'px-3 py-1 rounded text-sm font-semibold disabled:opacity-60 transition-all',
                          'bg-green-500 text-white hover:bg-green-600',
                          'shadow-lg'
                        )}
                        onClick={() => handleWithdrawClick(position)}
                        disabled={isWithdrawing}
                      >
                        {isWithdrawing ? 'Withdrawing...' : 'Withdraw'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </ScrollArea>
      <div className="flex items-center justify-between pt-6 pb-6">
        <span className="text-xl">Total assets in Echelon:</span>
        <span className="text-xl text-primary font-bold">${totalValue.toFixed(2)}</span>
      </div>

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
    </div>
  );
} 