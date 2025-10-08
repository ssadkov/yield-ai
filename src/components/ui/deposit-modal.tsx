"use client";

import { useEffect, useState, useMemo } from "react";
import Image from "next/image";
import { ChevronDown, ArrowLeftRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAmountInput } from "@/hooks/useAmountInput";
import { calcYield } from "@/lib/utils/calcYield";
import { useWalletData } from '@/contexts/WalletContext';
import { Token } from '@/lib/types/panora';
import tokenList from "@/lib/data/tokenList.json";
import { useDeposit } from "@/lib/hooks/useDeposit";
import { ProtocolKey } from "@/lib/transactions/types";
import { Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { SwapAndDepositModal } from "./swap-and-deposit-modal";

interface DepositModalProps {
  isOpen: boolean;
  onClose(): void;
  protocol: {
    name: string;
    logo: string;
    apy: number;
    key: ProtocolKey;
  };
  tokenIn: {
    symbol: string;
    logo: string;
    decimals: number;
    address: string;
  };
  tokenOut: {
    symbol: string;
    logo: string;
    decimals: number;
    address?: string;
  };
  priceUSD: number;
}

export function DepositModal({
  isOpen,
  onClose,
  protocol,
  tokenIn,
  tokenOut,
  priceUSD,
}: DepositModalProps) {
  const { tokens, refreshPortfolio } = useWalletData();
  const [isLoading, setIsLoading] = useState(false);
  const { deposit, isLoading: isDepositLoading } = useDeposit();
  const [isYieldExpanded, setIsYieldExpanded] = useState(false);
  const [isSwapModalOpen, setIsSwapModalOpen] = useState(false);

  // Получаем информацию о токене из списка токенов
  const getTokenInfo = (address: string): Token | undefined => {
    // Normalize addresses by removing leading zeros after 0x
    const normalizeAddress = (addr: string) => {
      if (!addr || !addr.startsWith('0x')) return addr;
      return '0x' + addr.slice(2).replace(/^0+/, '') || '0x0';
    };
    
    const normalizedAddress = normalizeAddress(address);
    
    return (tokenList.data.data as Token[]).find(token => {
      const normalizedTokenAddress = normalizeAddress(token.tokenAddress || '');
      const normalizedFaAddress = normalizeAddress(token.faAddress || '');
      
      return normalizedTokenAddress === normalizedAddress || 
             normalizedFaAddress === normalizedAddress;
    });
  };
  
  // Находим текущий токен в кошельке по адресу
  const currentToken = tokens?.find(t => {
    const tokenInfo = getTokenInfo(t.address);
    if (!tokenInfo) return false;
    
    // Normalize addresses for comparison
    const normalizeAddress = (addr: string) => {
      if (!addr || !addr.startsWith('0x')) return addr;
      return '0x' + addr.slice(2).replace(/^0+/, '') || '0x0';
    };
    
    const normalizedTokenInAddress = normalizeAddress(tokenIn.address);
    const normalizedTokenInfoAddress = normalizeAddress(tokenInfo.tokenAddress || '');
    const normalizedFaAddress = normalizeAddress(tokenInfo.faAddress || '');
    
    return normalizedTokenInfoAddress === normalizedTokenInAddress || 
           normalizedFaAddress === normalizedTokenInAddress;
  });
  
  // Используем реальный баланс из кошелька
  const walletBalance = currentToken ? BigInt(currentToken.amount) : BigInt(0);
  
  const {
    amount,
    amountString,
    setAmountFromString,
    setHalf,
    setMax,
    isValid,
  } = useAmountInput({
    balance: walletBalance,
    decimals: tokenIn.decimals,
  });


  // Символы для токенов
  const tokenInfo = useMemo(() => 
    tokenIn.address ? getTokenInfo(tokenIn.address) : undefined,
    [tokenIn.address]
  );
  
  const displaySymbol = useMemo(() => 
    tokenInfo?.symbol || tokenIn.symbol,
    [tokenInfo?.symbol, tokenIn.symbol]
  );
  
  const tokenOutInfo = useMemo(() => 
    tokenOut.address ? getTokenInfo(tokenOut.address) : undefined,
    [tokenOut.address]
  );
  
  const displayTokenOutSymbol = useMemo(() => 
    tokenOutInfo?.symbol || tokenOut.symbol,
    [tokenOutInfo?.symbol, tokenOut.symbol]
  );

  // Доходность
  const yieldResult = useMemo(() => 
    calcYield(protocol.apy, amount, tokenIn.decimals),
    [protocol.apy, amount, tokenIn.decimals]
  );

  // Устанавливаем максимальное значение при открытии модального окна
  useEffect(() => {
    if (isOpen && currentToken) {
      setMax();
    }
  }, [isOpen, currentToken, setMax]);

  // Refresh portfolio data when modal opens
  useEffect(() => {
    if (isOpen) {
      console.log('[DepositModal] Refreshing portfolio data on modal open');
      refreshPortfolio();
    }
  }, [isOpen, refreshPortfolio]);

  const handleDeposit = async () => {
    if (isLoading || isDepositLoading) return; // Prevent double-clicking
    
    try {
      setIsLoading(true);
      console.log('Starting deposit with:', {
        protocolKey: protocol.key,
        tokenAddress: tokenIn.address,
        amount: amount.toString()
      });

      await deposit(
        protocol.key,
        tokenIn.address,
        amount
      );
      
      onClose();
    } catch (error) {
      console.error('Deposit error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[425px] p-6 rounded-2xl">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Image
                src={protocol.logo}
                alt={protocol.name}
                width={24}
                height={24}
                className="rounded-full"
              />
              <DialogTitle>Deposit to {protocol.name}</DialogTitle>
            </div>
            <DialogDescription>
              Enter amount to deposit {displaySymbol}
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-center gap-2 py-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 relative">
                <Image
                  src={tokenIn.logo}
                  alt={displaySymbol}
                  width={32}
                  height={32}
                  className="object-contain"
                />
              </div>
              <span>{displaySymbol}</span>
            </div>
            <span>→</span>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 relative">
                <Image
                  src={tokenOut.logo}
                  alt={displayTokenOutSymbol}
                  width={32}
                  height={32}
                  className="object-contain"
                />
              </div>
              <span>{displayTokenOutSymbol}</span>
            </div>
          </div>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="amount" className="text-right">
                Amount
              </Label>
              <div className="col-span-3 flex items-center gap-2">
                <Input
                  id="amount"
                  type="number"
                  value={amountString}
                  onChange={(e) => setAmountFromString(e.target.value)}
                  className={`flex-1 ${amount > walletBalance ? 'text-red-500' : ''}`}
                  placeholder="0.00"
                />
                <div className="flex items-center gap-1">
                  <Image
                    src={tokenIn.logo}
                    alt={tokenIn.symbol}
                    width={16}
                    height={16}
                    className="rounded-full"
                  />
                  <span className="text-sm">{displaySymbol}</span>
                  {amountString && (
                    <span className={`text-sm ml-2 ${amount > walletBalance ? 'text-red-500' : 'text-muted-foreground'}`}>
                      ≈ ${(parseFloat(amountString) * priceUSD).toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {amount > walletBalance && (
              <div className="flex items-center justify-between text-sm text-red-500 mt-1">
                <span>
                  Amount exceeds wallet balance of {displaySymbol}. Would you like to{" "}
                  <button 
                    onClick={() => setIsSwapModalOpen(true)}
                    className="text-blue-500 hover:text-blue-600 inline-flex items-center gap-1"
                  >
                    swap and deposit
                    <ArrowLeftRight className="h-4 w-4" />
                  </button>
                  {" "}another token?
                </span>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={setHalf}>
                Half
              </Button>
              <Button variant="outline" size="sm" onClick={setMax}>
                Max
              </Button>
            </div>

            <div
              className="flex items-center justify-between cursor-pointer"
              onClick={() => setIsYieldExpanded(!isYieldExpanded)}
            >
              <div className="flex items-center gap-4">
                <div className="text-sm text-muted-foreground">
                  APR {protocol.apy.toFixed(2)}%
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold">
                    ≈ ${yieldResult.daily.toFixed(2)}
                  </span>
                  <span className="text-sm text-muted-foreground">/day</span>
                  <ChevronDown className="h-3 w-3 text-muted-foreground ml-1" />
                </div>
              </div>
            </div>
            {isYieldExpanded && (
              <div className="space-y-1 text-sm text-muted-foreground">
                <div>≈ ${yieldResult.weekly.toFixed(2)} /week</div>
                <div>≈ ${yieldResult.monthly.toFixed(2)} /month</div>
                <div>≈ ${yieldResult.yearly.toFixed(2)} /year</div>
              </div>
            )}
          </div>

          <Separator />

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleDeposit}
              disabled={!isValid || isLoading || isDepositLoading || !tokenIn.address || !protocol.key || amount === BigInt(0)}
            >
              {(isLoading || isDepositLoading) ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                "Deposit"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <SwapAndDepositModal
        isOpen={isSwapModalOpen}
        onClose={() => setIsSwapModalOpen(false)}
        protocol={protocol}
        tokenIn={tokenIn}
        amount={amount}
        priceUSD={priceUSD}
      />
    </>
  );
} 