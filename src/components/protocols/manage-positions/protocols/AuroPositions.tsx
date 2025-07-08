import React, { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

export function AuroPositions() {
  const { account } = useWallet();
  const [positions, setPositions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    if (!account?.address) {
      setPositions([]);
      return;
    }
    setLoading(true);
    setError(null);
    fetch(`/api/protocols/auro/userPositions?address=${account.address}`)
      .then(res => res.json())
      .then(data => {
        setPositions(Array.isArray(data.positionInfo) ? data.positionInfo : []);
      })
      .catch(err => {
        setError("Failed to load Auro Finance positions");
        setPositions([]);
      })
      .finally(() => setLoading(false));
  }, [account?.address]);

  if (!account?.address) return null;
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <img src="https://app.auro.finance/logo.png" alt="Auro Finance" className="w-6 h-6 rounded" />
            Auro Finance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-6 bg-muted rounded w-1/2" />
            <div className="h-4 bg-muted rounded w-1/3" />
          </div>
        </CardContent>
      </Card>
    );
  }
  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <img src="https://app.auro.finance/logo.png" alt="Auro Finance" className="w-6 h-6 rounded" />
            Auro Finance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-500 text-center py-4">{error}</p>
        </CardContent>
      </Card>
    );
  }
  if (!positions || positions.length === 0) return null;

  // Сортировка по value (по убыванию)
  const sortedPositions = [...positions].sort((a, b) => {
    const valueA = a.collateralTokenInfo?.usdPrice ? parseFloat(a.collateralAmount) * parseFloat(a.collateralTokenInfo.usdPrice) : 0;
    const valueB = b.collateralTokenInfo?.usdPrice ? parseFloat(b.collateralAmount) * parseFloat(b.collateralTokenInfo.usdPrice) : 0;
    return valueB - valueA;
  });

  // Сумма активов
  const totalValue = sortedPositions.reduce((sum, pos) => {
    const v = pos.collateralTokenInfo?.usdPrice ? parseFloat(pos.collateralAmount) * parseFloat(pos.collateralTokenInfo.usdPrice) : 0;
    return sum + v;
  }, 0);

  return (
    <Card className="w-full">
      <CardHeader 
        className="py-2 cursor-pointer hover:bg-accent/50 transition-colors"
        onClick={() => setExpanded(e => !e)}
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
            <div className="text-lg">${totalValue.toFixed(2)}</div>
            <ChevronDown className={cn(
              "h-5 w-5 transition-transform",
              expanded ? "transform rotate-0" : "transform -rotate-90"
            )} />
          </div>
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="flex-1 overflow-y-auto px-3 pt-0">
          <div className="space-y-2">
            {sortedPositions.map((pos, idx) => {
              const collateral = pos.collateralAmount;
              const collateralSymbol = pos.collateralSymbol;
              const collateralLogo = pos.collateralTokenInfo?.logoUrl;
              const collateralPrice = pos.collateralTokenInfo?.usdPrice ? parseFloat(pos.collateralTokenInfo.usdPrice).toFixed(2) : 'N/A';
              const debt = pos.debtAmount;
              const debtSymbol = pos.debtSymbol;
              const debtLogo = pos.debtTokenInfo?.logoUrl;
              const debtPrice = pos.debtTokenInfo?.usdPrice ? parseFloat(pos.debtTokenInfo.usdPrice).toFixed(2) : 'N/A';
              const value = pos.collateralTokenInfo?.usdPrice ? (parseFloat(collateral) * parseFloat(pos.collateralTokenInfo.usdPrice)).toFixed(2) : 'N/A';
              return (
                <div key={pos.address || idx} className={cn('mb-2', parseFloat(debt) > 0 && 'bg-red-50 rounded')}>
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
                            Collateral
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">${collateralPrice}</div>
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <div className="text-sm font-medium">${value}</div>
                      <div className="text-xs text-muted-foreground">{collateral} {collateralSymbol}</div>
                    </div>
                  </div>
                  {/* Debt строка — всегда на новой строке, как borrow в Echelon */}
                  {parseFloat(debt) > 0 && (
                    <div className="flex items-center gap-2 mt-2 ml-8">
                      {debtLogo && (
                        <div className="w-6 h-6 relative shrink-0">
                          <Image src={debtLogo} alt={debtSymbol} width={24} height={24} className="object-contain" />
                        </div>
                      )}
                      <span className="text-sm font-medium truncate max-w-[80px]">{debtSymbol}</span>
                      <span className={cn(
                        'text-xs font-semibold px-2 py-0.5 rounded border',
                        'bg-red-500/10 text-red-600 border-red-500/20')
                      }>
                        Debt
                      </span>
                      <span className="text-xs text-muted-foreground">{debt} {debtSymbol}</span>
                      {debtPrice !== 'N/A' && (
                        <span className="text-xs text-muted-foreground ml-2">${debtPrice}</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      )}
    </Card>
  );
} 