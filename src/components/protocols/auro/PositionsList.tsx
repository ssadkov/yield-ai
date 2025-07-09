import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import { ManagePositionsButton } from "../ManagePositionsButton";
import { getProtocolByName } from "@/lib/protocols/getProtocolsList";
import { useCollapsible } from "@/contexts/CollapsibleContext";

interface PositionsListProps {
  address?: string;
  onPositionsValueChange?: (value: number) => void;
}

export function PositionsList({ address, onPositionsValueChange }: PositionsListProps) {
  const { account } = useWallet();
  const [positions, setPositions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isExpanded, toggleSection } = useCollapsible();

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

  // Сумма активов (Collateral - Debt) - только для заголовка
  const totalValue = sortedPositions.reduce((sum, pos) => {
    // Сумма по collateral позициям
    const collateralValue = pos.collateralTokenInfo?.usdPrice ? parseFloat(pos.collateralAmount) * parseFloat(pos.collateralTokenInfo.usdPrice) : 0;
    
    // Сумма по debt позициям (вычитаем)
    const debtValue = pos.debtTokenInfo?.usdPrice ? parseFloat(pos.debtAmount) * parseFloat(pos.debtTokenInfo.usdPrice) : 0;
    
    return sum + collateralValue - debtValue;
  }, 0);

  // useEffect для передачи суммы наверх
  useEffect(() => {
    if (onPositionsValueChange) {
      onPositionsValueChange(totalValue);
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
            <div className="text-lg">${totalValue.toFixed(2)}</div>
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
              const collateralPrice = pos.collateralTokenInfo?.usdPrice ? parseFloat(pos.collateralTokenInfo.usdPrice).toFixed(2) : 'N/A';
              const debt = pos.debtAmount;
              const debtSymbol = pos.debtSymbol;
              const debtLogo = pos.debtTokenInfo?.logoUrl;
              const debtPrice = pos.debtTokenInfo?.usdPrice ? parseFloat(pos.debtTokenInfo.usdPrice).toFixed(2) : 'N/A';
              const value = pos.collateralTokenInfo?.usdPrice ? (parseFloat(collateral) * parseFloat(pos.collateralTokenInfo.usdPrice)).toFixed(2) : 'N/A';
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
                              Debt
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground">${debtPrice}</div>
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <div className="text-sm font-medium">${(parseFloat(debt) * parseFloat(debtPrice)).toFixed(2)}</div>
                        <div className="text-xs text-muted-foreground">{debt} {debtSymbol}</div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {/* Кнопка Manage Positions */}
            {protocol && <ManagePositionsButton protocol={protocol} />}
          </div>
        </CardContent>
      )}
    </Card>
  );
} 