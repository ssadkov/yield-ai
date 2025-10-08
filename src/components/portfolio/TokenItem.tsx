import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Token } from "@/lib/types/token";
import { getTokenList } from "@/lib/tokens/getTokenList";
import { useDragDrop } from "@/contexts/DragDropContext";
import { TokenDragData } from "@/types/dragDrop";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect, useMemo } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatNumber, formatCurrency } from "@/lib/utils/numberFormat";

interface TokenItemProps {
  token: Token;
  stakingAprs?: Record<string, { aprPct: number; source: string }>;
}

export function TokenItem({ token, stakingAprs = {} }: TokenItemProps) {
  const { startDrag, endDrag, state } = useDragDrop();
  
  const formattedAmount = formatNumber(parseFloat(token.amount) / Math.pow(10, token.decimals), 3);
  const formattedValue = token.value ? formatCurrency(parseFloat(token.value), 2) : 'N/A';
  const formattedPrice = token.price ? formatCurrency(parseFloat(token.price), 2) : 'N/A';
  const symbol = token.symbol || token.name || 'Unknown';

  // Resolve staking APR for this token (Echelon-sourced)
  const stakingAprPct = useMemo(() => {
    // Try direct address key first
    if (stakingAprs[token.address]?.aprPct !== undefined) {
      return stakingAprs[token.address].aprPct as number;
    }
    // Try faAddress via token list entry (by matching symbol)
    const tokenList = getTokenList(1);
    const tokenInfo = tokenList.find(t => t.symbol === symbol);
    const faAddress = (tokenInfo as any)?.faAddress as string | undefined;
    if (faAddress && stakingAprs[faAddress]?.aprPct !== undefined) {
      return stakingAprs[faAddress].aprPct as number;
    }
    return 0;
  }, [stakingAprs, token.address, symbol]);

  // Находим токен в списке для получения logoUrl
  const tokenList = getTokenList(1); // 1 - это chainId для Aptos
  const tokenInfo = tokenList.find(t => t.symbol === symbol);
  const logoUrl = tokenInfo?.logoUrl;

  // Infer staking protocol name from token metadata (websiteUrl/name/symbol)
  const stakingProtocolName = useMemo(() => {
    const website = (tokenInfo as any)?.websiteUrl as string | undefined;
    const name = tokenInfo?.name || '';
    const lowerName = name.toLowerCase();
    const fromHost = (host: string) => {
      if (host.includes('amnis')) return 'Amnis';
      if (host.includes('thala')) return 'Thala';
      if (host.includes('kofi')) return 'Kofi';
      if (host.includes('trufin')) return 'TruFin';
      if (host.includes('ethena')) return 'Ethena';
      return null;
    };
    // Try websiteUrl host
    if (website) {
      try {
        const host = new URL(website).host.toLowerCase();
        const byHost = fromHost(host);
        if (byHost) return byHost;
      } catch (_) {
        // ignore invalid URL
      }
    }
    // Try name hints
    if (lowerName.includes('amnis')) return 'Amnis';
    if (lowerName.includes('thala')) return 'Thala';
    if (lowerName.includes('kofi')) return 'Kofi';
    if (lowerName.includes('trufin')) return 'TruFin';
    if (lowerName.includes('ethena')) return 'Ethena';
    // Try symbol patterns
    const upperSymbol = symbol.toUpperCase();
    if (['THAPT', 'STHAPT'].includes(upperSymbol)) return 'Thala';
    if (['KAPT', 'STKAPT'].includes(upperSymbol)) return 'Kofi';
    if (upperSymbol === 'TRUAPT') return 'TruFin';
    if (upperSymbol === 'SUSDE') return 'Ethena';
    if (['AMAPT', 'STAPT'].includes(upperSymbol)) return 'Amnis';
    return null;
  }, [tokenInfo, symbol]);

  const handleDragStart = (e: React.DragEvent) => {
    const dragData: TokenDragData = {
      type: 'token',
      symbol,
      amount: token.amount,
      address: token.address,
      price: token.price || '0',
      value: token.value || '0',
      decimals: token.decimals,
      logoUrl,
    };

    e.dataTransfer.setData('application/json', JSON.stringify(dragData));
    e.dataTransfer.effectAllowed = 'move';
    
    startDrag(dragData);
  };

  const handleDragEnd = () => {
    endDrag();
  };

  const isBeingDragged = state.isDragging && state.dragData?.type === 'token' && 
                        state.dragData.symbol === symbol;

  return (
    <div 
      className={cn(
        "flex items-center justify-between py-2 px-1 hover:bg-accent rounded-md transition-colors cursor-grab active:cursor-grabbing",
        isBeingDragged && "opacity-50"
      )}
      draggable={true}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex items-center gap-2 min-w-0">
        <Avatar className="h-6 w-6 flex-shrink-0">
          <AvatarImage src={logoUrl} />
          <AvatarFallback>{symbol.slice(0, 2)}</AvatarFallback>
        </Avatar>
        <div className="flex flex-col">
          <div className="flex items-center gap-1">
            <span className="text-sm font-medium truncate">{symbol}</span>
            {stakingAprPct > 0.01 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="secondary" className="text-xs px-1 py-0 h-4 text-green-600 bg-green-100 border-green-200 cursor-help">
                      {formatNumber(stakingAprPct, 2)}%
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{stakingProtocolName ? `${stakingProtocolName} protocol staking APR` : 'Staking APR'}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          <span className="text-xs text-muted-foreground">{formattedPrice}</span>
        </div>
      </div>
      <div className="text-sm text-right ml-2">
        <div className="font-medium whitespace-nowrap">{formattedValue}</div>
        <div className="text-xs text-muted-foreground whitespace-nowrap">
          {formattedAmount}
        </div>
      </div>
    </div>
  );
} 