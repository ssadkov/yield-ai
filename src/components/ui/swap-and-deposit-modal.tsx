"use client";

import { useEffect, useState, useMemo } from "react";
import Image from "next/image";
import { ChevronDown, ArrowLeftRight, Settings } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAmountInput } from "@/hooks/useAmountInput";
import { calcYield } from "@/lib/utils/calcYield";
import { useWalletData } from '@/contexts/WalletContext';
import { Token } from '@/lib/types/panora';
import tokenList from "@/lib/data/tokenList.json";
import { useDeposit } from "@/lib/hooks/useDeposit";
import { ProtocolKey } from "@/lib/transactions/types";
import { Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { SwapAndDepositStatusModal } from "@/components/ui/swap-and-deposit-status-modal";

interface SwapAndDepositModalProps {
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
  tokenOut?: {
    symbol: string;
    logo: string;
    decimals: number;
    address: string;
  };
  amount: bigint;
  priceUSD: number;
  poolAddress?: string; // Add this for Auro Finance
}

export function SwapAndDepositModal({
  isOpen,
  onClose,
  protocol,
  tokenIn,
  tokenOut,
  amount,
  priceUSD,
  poolAddress,
}: SwapAndDepositModalProps) {
  const { tokens, address: userAddress, refreshPortfolio } = useWalletData();
  const { deposit, isLoading: isDepositLoading } = useDeposit();
  const [isLoading, setIsLoading] = useState(false);
  const [isYieldExpanded, setIsYieldExpanded] = useState(false);
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [swapProvider, setSwapProvider] = useState<'panora' | 'hyperion'>('panora');
  const [showSettings, setShowSettings] = useState(false);

  // Получаем информацию о токене из списка токенов
  const getTokenInfo = (address: string): Token | undefined => {
    const normalizedAddress = normalizeAddress(address);
    if (!normalizedAddress) return undefined;
    
    return (tokenList.data.data as Token[]).find(token => {
      const normalizedTokenAddress = normalizeAddress(token.tokenAddress);
      const normalizedFaAddress = normalizeAddress(token.faAddress);
      
      return (normalizedTokenAddress && normalizedTokenAddress === normalizedAddress) || 
             (normalizedFaAddress && normalizedFaAddress === normalizedAddress);
    });
  };

  function normalizeAddress(address?: string | null): string {
    if (!address) return '';
    if (!address.startsWith('0x')) return address.toLowerCase();
    const normalized = '0x' + address.slice(2).replace(/^0+/, '');
    return (normalized === '0x' ? '0x0' : normalized).toLowerCase();
  }

  function findTokenBalance(tokens: any[], token: Token): string {
    const tokenAddresses = [
      token.tokenAddress,
      token.faAddress,
    ].filter(Boolean).map(normalizeAddress).filter(addr => addr !== '');

    const found = tokens.find(t => {
      const normalizedTAddress = normalizeAddress(t.address);
      const normalizedTFaAddress = normalizeAddress(t.faAddress);
      
      return (normalizedTAddress && tokenAddresses.includes(normalizedTAddress)) ||
             (normalizedTFaAddress && tokenAddresses.includes(normalizedTFaAddress));
    });

    return found?.amount || '0';
  }

  // Сортируем токены по value и выбираем самый дорогой
  const sortedTokens = useMemo(() => {
    return tokens
      .map(t => {
        const tokenInfo = getTokenInfo(t.address.toLowerCase());
        return {
          ...t,
          tokenInfo,
          value: tokenInfo
            ? (Number(findTokenBalance(tokens, tokenInfo)) / Math.pow(10, tokenInfo.decimals)) * (Number(tokenInfo.usdPrice) || 0)
            : 0
        };
      })
      .filter(token =>
        token.value > 0 &&
        token.tokenInfo
      )
      .sort((a, b) => b.value - a.value);
  }, [tokens, tokenIn.address]);

  // Refresh portfolio data when modal opens
  useEffect(() => {
    if (isOpen) {
      console.log('[SwapAndDepositModal] Refreshing portfolio data on modal open');
      refreshPortfolio();
    }
  }, [isOpen, refreshPortfolio]);

  // Устанавливаем перетаскиваемый токен по умолчанию
  useEffect(() => {
    if (tokenOut?.address) {
      const token = getTokenInfo(tokenOut.address);
      if (token) {
        setSelectedToken(token);
      } else {
        // Fallback: если перетаскиваемый токен не найден, выбираем самый дорогой
        if (sortedTokens.length > 0) {
          const address = sortedTokens[0].address;
          const fallbackToken = getTokenInfo(address);
          if (fallbackToken) setSelectedToken(fallbackToken);
        }
      }
    } else {
      // Fallback: если нет tokenOut, выбираем самый дорогой
      if (sortedTokens.length > 0) {
        const address = sortedTokens[0].address;
        const fallbackToken = getTokenInfo(address);
        if (fallbackToken) setSelectedToken(fallbackToken);
      }
    }
  }, [sortedTokens, tokenOut?.address]);

  const {
    amount: swapAmount,
    amountString,
    setAmountFromString,
    setHalf,
    setMax,
    isValid,
  } = useAmountInput({
    balance: selectedToken ? BigInt(findTokenBalance(tokens, selectedToken)) : BigInt(0),
    decimals: selectedToken?.decimals || 18,
  });

  // Yield is calculated from USD value of the entered amount to reflect real deposit value
  const yieldResult = useMemo(() => {
    const tokenPriceUsd = selectedToken ? Number(selectedToken.usdPrice) || 0 : 0;
    const amountNum = parseFloat(amountString || '0');
    const usdValue = amountNum * tokenPriceUsd; // USD
    const usdCents = BigInt(Math.max(0, Math.round(usdValue * 100))); // use 2 decimals for USD cents
    return calcYield(protocol.apy, usdCents, 2);
  }, [protocol.apy, amountString, selectedToken?.usdPrice]);

  const handleSwapAndDeposit = async () => {
    if (isLoading || isDepositLoading) return; // Prevent double-clicking
    
    try {
      setIsLoading(true);
      setIsStatusModalOpen(true);
      // TODO: implement swap and deposit logic
      // onClose();
    } catch (error) {
      console.error('Swap and deposit error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Автоматически скрываем исходное окно, пока открыт статус транзакции */}
      <Dialog open={isOpen && !isStatusModalOpen} onOpenChange={onClose}>
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
              <DialogTitle>Swap and Deposit to {protocol.name}</DialogTitle>
            </div>
            <DialogDescription>
              Swap tokens and deposit to earn {protocol.apy.toFixed(2)}% APR on {tokenIn.symbol}
            </DialogDescription>
          </DialogHeader>

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
                  className={`w-32 ${swapAmount > (selectedToken ? BigInt(findTokenBalance(tokens, selectedToken)) : BigInt(0)) ? 'text-red-500' : ''}`}
                  placeholder="0.00"
                />
                {amountString && (
                  <span className={`text-sm ${swapAmount > (selectedToken ? BigInt(findTokenBalance(tokens, selectedToken)) : BigInt(0)) ? 'text-red-500' : 'text-muted-foreground'}`}>
                    ≈ ${(
                      parseFloat(amountString) * (selectedToken ? Number(selectedToken.usdPrice) || 0 : 0)
                    ).toFixed(2)}
                  </span>
                )}
                <Select
                  value={selectedToken?.faAddress || selectedToken?.tokenAddress || ''}
                  onValueChange={(value) => {
                    const token = getTokenInfo(value);
                    console.log('selectedToken', token);
                    if (token) setSelectedToken(token);
                  }}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue>
                      {selectedToken ? (
                        <div className="flex items-center gap-2">
                          <Image
                            src={selectedToken.logoUrl || '/file.svg'}
                            alt={selectedToken.symbol || 'Token'}
                            width={16}
                            height={16}
                            className="rounded-full"
                          />
                          <span>{selectedToken.symbol || 'Token'}</span>
                        </div>
                      ) : (
                        <span>Select token</span>
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {sortedTokens.map((token) => (
                      <SelectItem
                        key={token.tokenInfo?.faAddress || token.tokenInfo?.tokenAddress || ''}
                        value={token.tokenInfo?.faAddress || token.tokenInfo?.tokenAddress || ''}
                      >
                        <div className="flex items-center gap-2">
                          <Image
                            src={token.tokenInfo?.logoUrl || '/placeholder-token.png'}
                            alt={token.tokenInfo?.symbol || 'Token'}
                            width={16}
                            height={16}
                            className="rounded-full"
                          />
                          <span>{token.tokenInfo?.symbol}</span>
                          <span className="text-muted-foreground">
                            (${token.value.toFixed(2)})
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {swapAmount > (selectedToken ? BigInt(findTokenBalance(tokens, selectedToken)) : BigInt(0)) && (
              <div className="text-sm text-red-500 mt-1">
                Amount exceeds wallet balance of {selectedToken?.symbol}
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

          {/* Actions row with compact settings button */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Swap settings"
              onClick={() => setShowSettings((v) => !v)}
              className="shrink-0"
            >
              <Settings className={`h-4 w-4 ${showSettings ? 'text-primary' : ''}`} />
            </Button>

            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={handleSwapAndDeposit}
                disabled={!isValid || isLoading || isDepositLoading || !selectedToken}
              >
                {(isLoading || isDepositLoading) ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Swap and Deposit"
                )}
              </Button>
            </div>
          </div>

          {/* Slide-down minimal settings */}
          {showSettings && (
            <div className="mt-2 rounded-lg border p-3 bg-muted/30">
              <div className="flex items-center gap-3">
                <Label className="text-xs text-muted-foreground">Swap provider</Label>
                <Select value={swapProvider} onValueChange={(v) => setSwapProvider(v as 'panora' | 'hyperion')}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="panora">Panora</SelectItem>
                    <SelectItem value="hyperion">Hyperion</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          {/* Fee info for Panora */}
          {swapProvider === 'panora' && (
            <div className="mt-3 text-xs text-muted-foreground text-center">
              <div className="flex items-center justify-center gap-2">
                <span>Gasless transaction - no APT required for gas fees. 0.01% swap fee applies.</span>
                <span>•</span>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-xs text-muted-foreground">Powered by</span>
                  <img
                    src="/panora_horizontal_logo_black.png"
                    alt="Panora"
                    className="w-auto"
                    style={{ height: '21px', minWidth: '72px' }}
                  />
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <SwapAndDepositStatusModal
        isOpen={isStatusModalOpen}
        onClose={() => {
          setIsStatusModalOpen(false);
          onClose();
        }}
        provider={swapProvider}
        amount={amountString}
        fromToken={{
          symbol: selectedToken?.symbol || '',
          address: selectedToken?.faAddress || selectedToken?.tokenAddress || '',
          decimals: selectedToken?.decimals ?? 6,
        }}
        toToken={{
          symbol: tokenIn.symbol,
          address: getTokenInfo(tokenIn.address)?.faAddress || getTokenInfo(tokenIn.address)?.tokenAddress || '',
        }}
        protocol={{
          name: protocol.name,
          key: protocol.key,
          logo: protocol.logo,
        }}
        userAddress={userAddress || ''}
        poolAddress={poolAddress}
      />
    </>
  );
} 