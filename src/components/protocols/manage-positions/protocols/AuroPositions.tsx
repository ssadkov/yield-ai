import React, { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ManagePositionsButton } from "../../ManagePositionsButton";
import { getProtocolByName } from "@/lib/protocols/getProtocolsList";

interface AuroPositionsProps {
  address?: string;
  onPositionsValueChange?: (value: number) => void;
}

export function AuroPositions({ address, onPositionsValueChange }: AuroPositionsProps) {
  const { account } = useWallet();
  const [positions, setPositions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalValue, setTotalValue] = useState<number>(0);

  const walletAddress = address || account?.address;
  const protocol = getProtocolByName("Auro Finance");

  // useEffect для загрузки позиций
  useEffect(() => {
    if (!walletAddress) {
      setPositions([]);
      return;
    }
    setLoading(true);
    setError(null);
    fetch(`/api/protocols/auro/userPositions?address=${walletAddress}`)
      .then(res => res.json())
      .then(data => {
        setPositions(Array.isArray(data.positionInfo) ? data.positionInfo : []);
      })
      .catch(err => {
        setError("Failed to load Auro Finance positions");
        setPositions([]);
      })
      .finally(() => setLoading(false));
  }, [walletAddress]);

  // Сортировка по value (по убыванию)
  const sortedPositions = [...positions].sort((a, b) => {
    const valueA = a.collateralTokenInfo?.usdPrice ? parseFloat(a.collateralAmount) * parseFloat(a.collateralTokenInfo.usdPrice) : 0;
    const valueB = b.collateralTokenInfo?.usdPrice ? parseFloat(b.collateralAmount) * parseFloat(b.collateralTokenInfo.usdPrice) : 0;
    return valueB - valueA;
  });

  // Сумма активов
  useEffect(() => {
    const total = sortedPositions.reduce((sum, pos) => {
      const collateralValue = pos.collateralTokenInfo?.usdPrice ? parseFloat(pos.collateralAmount) * parseFloat(pos.collateralTokenInfo.usdPrice) : 0;
      const debtValue = pos.debtTokenInfo?.usdPrice ? parseFloat(pos.debtAmount) * parseFloat(pos.debtTokenInfo.usdPrice) : 0;
      return sum + collateralValue - debtValue;
    }, 0);
    setTotalValue(total);
    
    if (onPositionsValueChange) {
      onPositionsValueChange(total);
    }
  }, [sortedPositions, onPositionsValueChange]);

  // Заглушка для APR - потом подтянем реальные данные
  const getCollateralAPR = (collateralSymbol: string) => {
    // TODO: Подтянуть реальные APR данные
    const mockAPRs: { [key: string]: number } = {
      'APT': 3.5,
      'USDC': 2.1,
      'USDT': 2.0,
      'BTC': 1.8,
      'ETH': 2.5
    };
    return mockAPRs[collateralSymbol] || 2.0;
  };

  const getDebtAPR = (debtSymbol: string) => {
    // TODO: Подтянуть реальные APR данные
    const mockAPRs: { [key: string]: number } = {
      'USDA': 4.2,
      'USDC': 3.8,
      'USDT': 3.9
    };
    return mockAPRs[debtSymbol] || 4.0;
  };

  if (!walletAddress) return null;
  
  if (loading) {
    return (
      <div className="space-y-4 text-base">
        <div className="animate-pulse space-y-3">
          <div className="h-6 bg-muted rounded w-1/2" />
          <div className="h-4 bg-muted rounded w-1/3" />
          <div className="h-6 bg-muted rounded w-2/3" />
          <div className="h-4 bg-muted rounded w-1/2" />
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="space-y-4 text-base">
        <div className="text-red-500 text-center py-4">{error}</div>
      </div>
    );
  }
  
  if (!positions || positions.length === 0) return null;

  return (
    <div className="space-y-4 text-base">
      <ScrollArea>
        {sortedPositions.map((pos, idx) => {
          const collateral = pos.collateralAmount;
          const collateralSymbol = pos.collateralSymbol;
          const collateralLogo = pos.collateralTokenInfo?.logoUrl;
          const collateralPrice = pos.collateralTokenInfo?.usdPrice ? parseFloat(pos.collateralTokenInfo.usdPrice).toFixed(2) : 'N/A';
          const collateralValue = pos.collateralTokenInfo?.usdPrice ? (parseFloat(collateral) * parseFloat(pos.collateralTokenInfo.usdPrice)).toFixed(2) : 'N/A';
          const collateralAPR = getCollateralAPR(collateralSymbol);
          
          const debt = pos.debtAmount;
          const debtSymbol = pos.debtSymbol;
          const debtLogo = pos.debtTokenInfo?.logoUrl;
          const debtPrice = pos.debtTokenInfo?.usdPrice ? parseFloat(pos.debtTokenInfo.usdPrice).toFixed(2) : 'N/A';
          const debtValue = pos.debtTokenInfo?.usdPrice ? (parseFloat(debt) * parseFloat(pos.debtTokenInfo.usdPrice)).toFixed(2) : 'N/A';
          const debtAPR = getDebtAPR(debtSymbol);
          
          const hasDebt = parseFloat(debt) > 0;
          
                      return (
              <div 
                key={pos.address || idx} 
                className="p-4 border-b last:border-b-0 transition-colors"
              >
              {/* Collateral позиция */}
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2">
                  {collateralLogo && (
                    <div className="w-8 h-8 relative">
                      <Image 
                        src={collateralLogo} 
                        alt={collateralSymbol}
                        width={32}
                        height={32}
                        className="object-contain"
                      />
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="text-lg">{collateralSymbol}</div>
                      <Badge 
                        variant="outline" 
                        className="bg-green-500/10 text-green-600 border-green-500/20 text-xs font-normal px-2 py-0.5 h-5"
                      >
                        Collateral
                      </Badge>
                    </div>
                    <div className="text-base text-muted-foreground mt-0.5">
                      ${collateralPrice}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20 text-xs font-normal px-2 py-0.5 h-5">
                      APR: {collateralAPR.toFixed(2)}%
                    </Badge>
                    <div className="text-lg font-bold">${collateralValue}</div>
                  </div>
                  <div className="text-base text-muted-foreground font-semibold">
                    {parseFloat(collateral).toFixed(4)} {collateralSymbol}
                  </div>
                </div>
              </div>

              {/* Debt позиция - если есть */}
              {hasDebt && (
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    {debtLogo && (
                      <div className="w-8 h-8 relative">
                        <Image 
                          src={debtLogo} 
                          alt={debtSymbol}
                          width={32}
                          height={32}
                          className="object-contain"
                        />
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="text-lg">{debtSymbol}</div>
                        <Badge 
                          variant="outline" 
                          className="bg-red-500/10 text-red-600 border-red-500/20 text-xs font-normal px-2 py-0.5 h-5"
                        >
                          Debt
                        </Badge>
                      </div>
                      <div className="text-base text-muted-foreground mt-0.5">
                        ${debtPrice}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20 text-xs font-normal px-2 py-0.5 h-5">
                        APR: {debtAPR.toFixed(2)}%
                      </Badge>
                      <div className="text-lg font-bold text-red-600">-${debtValue}</div>
                    </div>
                    <div className="text-base text-muted-foreground font-semibold">
                      {parseFloat(debt).toFixed(4)} {debtSymbol}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </ScrollArea>
      
      <div className="flex items-center justify-between pt-6 pb-6">
        <span className="text-xl">Total assets in Auro Finance:</span>
        <span className="text-xl text-primary font-bold">${totalValue.toFixed(2)}</span>
      </div>

      {/* Кнопка Manage Positions */}
      {protocol && <ManagePositionsButton protocol={protocol} />}
    </div>
  );
} 