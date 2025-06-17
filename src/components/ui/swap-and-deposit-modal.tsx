"use client";

import { useEffect, useState, useMemo } from "react";
import Image from "next/image";
import { ChevronDown, ArrowLeftRight } from "lucide-react";
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
  amount: bigint;
  priceUSD: number;
}

export function SwapAndDepositModal({
  isOpen,
  onClose,
  protocol,
  tokenIn,
  amount,
  priceUSD,
}: SwapAndDepositModalProps) {
  const { tokens, address: userAddress } = useWalletData();
  const { deposit } = useDeposit();
  const [isLoading, setIsLoading] = useState(false);
  const [isYieldExpanded, setIsYieldExpanded] = useState(false);
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);

  // Получаем информацию о токене из списка токенов
  const getTokenInfo = (address: string): Token | undefined => {
    return (tokenList.data.data as Token[]).find(token => 
      token.tokenAddress === address || token.faAddress === address
    );
  };

  // Сортируем токены по value и выбираем самый дорогой
  const sortedTokens = useMemo(() => {
    return tokens
      .map(t => {
        const tokenInfo = getTokenInfo(t.address);
        return {
          ...t,
          tokenInfo,
          value: tokenInfo
            ? (Number(t.amount) / Math.pow(10, tokenInfo.decimals)) * (Number(tokenInfo.usdPrice) || 0)
            : 0
        };
      })
      .filter(token =>
        token.value > 0 &&
        token.tokenInfo?.tokenAddress !== tokenIn.address &&
        token.tokenInfo?.faAddress !== tokenIn.address
      )
      .sort((a, b) => b.value - a.value);
  }, [tokens, tokenIn.address]);

  // Устанавливаем самый дорогой токен по умолчанию
  useEffect(() => {
    if (sortedTokens.length > 0) {
      // selectedToken всегда Token
      const token = getTokenInfo(sortedTokens[0].address);
      if (token) setSelectedToken(token);
    }
  }, [sortedTokens]);

  const {
    amount: swapAmount,
    amountString,
    setAmountFromString,
    setHalf,
    setMax,
    isValid,
  } = useAmountInput({
    balance: selectedToken ? BigInt(tokens.find(t => t.address === selectedToken.tokenAddress)?.amount || '0') : BigInt(0),
    decimals: selectedToken?.decimals || 18,
  });

  // Доходность
  const yieldResult = useMemo(() => 
    calcYield(protocol.apy, amount, tokenIn.decimals),
    [protocol.apy, amount, tokenIn.decimals]
  );

  const handleSwapAndDeposit = async () => {
    setIsStatusModalOpen(true);
    // TODO: implement swap and deposit logic
    // onClose();
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
              <DialogTitle>Swap and Deposit to {protocol.name}</DialogTitle>
            </div>
            <DialogDescription>
              Swap tokens and deposit to earn {protocol.apy.toFixed(2)}% APY on {tokenIn.symbol}
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
                  className={`w-32 ${swapAmount > (selectedToken ? BigInt(tokens.find(t => t.address === selectedToken.tokenAddress)?.amount || '0') : BigInt(0)) ? 'text-red-500' : ''}`}
                  placeholder="0.00"
                />
                {amountString && (
                  <span className={`text-sm ${swapAmount > (selectedToken ? BigInt(tokens.find(t => t.address === selectedToken.tokenAddress)?.amount || '0') : BigInt(0)) ? 'text-red-500' : 'text-muted-foreground'}`}>
                    ≈ ${(
                      parseFloat(amountString) * (selectedToken ? Number(selectedToken.usdPrice) || 0 : 0)
                    ).toFixed(2)}
                  </span>
                )}
                <Select
                  value={selectedToken?.tokenAddress || undefined}
                  onValueChange={(value) => {
                    const token = getTokenInfo(value);
                    if (token) setSelectedToken(token);
                  }}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue>
                      {selectedToken && (
                        <div className="flex items-center gap-2">
                          <Image
                            src={selectedToken?.logoUrl || '/placeholder-token.png'}
                            alt={selectedToken?.symbol || 'Token'}
                            width={16}
                            height={16}
                            className="rounded-full"
                          />
                          <span>{selectedToken?.symbol}</span>
                        </div>
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {sortedTokens.map((token) => (
                      <SelectItem 
                        key={token.address} 
                        value={token.address}
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

            {swapAmount > (selectedToken ? BigInt(tokens.find(t => t.address === selectedToken.tokenAddress)?.amount || '0') : BigInt(0)) && (
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

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="text-sm text-muted-foreground">
                  APY {protocol.apy.toFixed(2)}%
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold">
                    ≈ ${yieldResult.daily.toFixed(2)}
                  </span>
                  <span className="text-sm text-muted-foreground">/day</span>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleSwapAndDeposit}
              disabled={!isValid || isLoading || !selectedToken}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                "Swap and Deposit"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <SwapAndDepositStatusModal
        isOpen={isStatusModalOpen}
        onClose={() => setIsStatusModalOpen(false)}
        amount={amountString}
        fromToken={{
          symbol: selectedToken?.symbol || '',
          address: selectedToken?.faAddress || '',
        }}
        toToken={{
          symbol: tokenIn.symbol,
          address: getTokenInfo(tokenIn.address)?.faAddress || '',
        }}
        protocol={{
          name: protocol.name,
          key: protocol.key,
        }}
        userAddress={userAddress || ''}
      />
    </>
  );
} 