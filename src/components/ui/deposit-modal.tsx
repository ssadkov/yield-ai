"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronDown } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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

interface DepositModalContentProps {
  onClose(): void;
  onConfirm(data: { amount: bigint }): void;

  protocol: {
    name: string;
    logo: string;
    apy: number;
  };

  tokenIn: {
    symbol: string;
    logo: string;
    decimals: number;
  };
  tokenOut: {
    symbol: string;
    logo: string;
    decimals: number;
  };

  balance: bigint;
  priceUSD: number;
}

function DepositModalContent({
  onClose,
  onConfirm,
  protocol,
  tokenIn,
  tokenOut,
  balance,
  priceUSD,
}: DepositModalContentProps) {
  const [isYieldExpanded, setIsYieldExpanded] = useState(false);
  const {
    amount,
    amountString,
    setAmountFromString,
    setHalf,
    setMax,
    isValid,
  } = useAmountInput({
    balance,
    decimals: tokenIn.decimals,
  });

  const yieldResult = calcYield(protocol.apy, amount, tokenIn.decimals);
  const usdValue = Number(amount) / Math.pow(10, tokenIn.decimals) * priceUSD;

  return (
    <DialogContent className="sm:max-w-[425px] p-6 rounded-2xl">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <div className="w-8 h-8 relative">
            <Image
              src={protocol.logo}
              alt={protocol.name}
              width={32}
              height={32}
              className="object-contain"
            />
          </div>
          <span>Deposit on {protocol.name}</span>
        </DialogTitle>
      </DialogHeader>

      <div className="flex items-center justify-center gap-2 py-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 relative">
            <Image
              src={tokenIn.logo}
              alt={tokenIn.symbol}
              width={32}
              height={32}
              className="object-contain"
            />
          </div>
          <span>{tokenIn.symbol}</span>
        </div>
        <span>→</span>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 relative">
            <Image
              src={tokenOut.logo}
              alt={tokenOut.symbol}
              width={32}
              height={32}
              className="object-contain"
            />
          </div>
          <span>{tokenOut.symbol}</span>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Input
            type="number"
            value={amountString}
            onChange={(e) => setAmountFromString(e.target.value)}
            className="flex-1"
          />
          <div className="text-sm text-muted-foreground">
            ≈ ${usdValue.toFixed(2)}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={setHalf}>
            Half
          </Button>
          <Button variant="outline" size="sm" onClick={setMax}>
            Max
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <div
          className="flex items-center justify-between cursor-pointer"
          onClick={() => setIsYieldExpanded(!isYieldExpanded)}
        >
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
          <ChevronDown
            className={`h-4 w-4 transition-transform ${
              isYieldExpanded ? "rotate-180" : ""
            }`}
          />
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

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          onClick={() => onConfirm({ amount })}
          disabled={!isValid}
        >
          Deposit
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

interface DepositModalProps {
  isOpen: boolean;
  onClose(): void;
  onConfirm(data: { amount: bigint }): void;

  protocol: {
    name: string;
    logo: string;
    apy: number;
  };

  tokenIn: {
    symbol: string;
    logo: string;
    decimals: number;
  };
  tokenOut: {
    symbol: string;
    logo: string;
    decimals: number;
  };

  balance: bigint;
  priceUSD: number;
}

export function DepositModal(props: DepositModalProps) {
  return (
    <Dialog open={props.isOpen} onOpenChange={props.onClose}>
      <DepositModalContent {...props} />
    </Dialog>
  );
} 