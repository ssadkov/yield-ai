"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
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
import { Label } from "@/components/ui/label";
import { useAmountInput } from "@/hooks/useAmountInput";
import { Loader2 } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { useDragDrop } from "@/contexts/DragDropContext";

interface WithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (amount: bigint) => void;
  position: {
    coin: string;
    supply: string;
    market?: string;
  };
  tokenInfo?: {
    symbol: string;
    logoUrl?: string;
    decimals: number;
    usdPrice?: string;
  };
  isLoading?: boolean;
  userAddress?: string;
}

export function WithdrawModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  position, 
  tokenInfo,
  isLoading = false,
  userAddress
}: WithdrawModalProps) {
  const { closeAllModals } = useDragDrop();
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [vaultBalance, setVaultBalance] = useState<bigint>(BigInt(0));
  const [percentage, setPercentage] = useState([100]);
  const [isLoadingVault, setIsLoadingVault] = useState(false);

  // Загружаем данные Vault при открытии модального окна
  useEffect(() => {
    if (isOpen && userAddress && position.market) {
      loadVaultData();
    }
  }, [isOpen, userAddress, position.market]);

  const loadVaultData = async () => {
    if (!userAddress || !position.market) return;
    
    setIsLoadingVault(true);
    try {
      const response = await fetch(`/api/protocols/echelon/vault?address=${userAddress}`);
      const data = await response.json();
      
      console.log('WithdrawModal - Vault API response:', data);
      console.log('WithdrawModal - Looking for market:', position.market);
      
      if (data.success && data.data?.data?.collaterals?.data) {
        console.log('WithdrawModal - Collaterals data:', data.data.data.collaterals.data);
        const collateral = data.data.data.collaterals.data.find(
          (item: any) => item.key.inner === position.market
        );
        
        if (collateral) {
          setVaultBalance(BigInt(collateral.value));
          console.log('WithdrawModal - Vault balance for market', position.market, ':', collateral.value);
        } else {
          console.log('WithdrawModal - No collateral found for market:', position.market);
          setVaultBalance(BigInt(0));
        }
      } else {
        console.log('WithdrawModal - Invalid vault data structure:', data);
        setVaultBalance(BigInt(0));
      }
    } catch (error) {
      console.error('WithdrawModal - Error loading vault data:', error);
      setVaultBalance(BigInt(0));
    } finally {
      setIsLoadingVault(false);
    }
  };

  // Получаем Available Balance из position (userPositions API)
  const availableBalance = BigInt(position.supply);
  const availableBalanceFormatted = Number(availableBalance) / (tokenInfo?.decimals ? 10 ** tokenInfo.decimals : 1e8);

  // Рассчитываем количество для вывода на основе процента от Available Balance
  const withdrawAmount = availableBalance > 0 
    ? (availableBalance * BigInt(percentage[0])) / BigInt(100)
    : BigInt(0);

  console.log('WithdrawModal - Debug state:', {
    availableBalance: availableBalance.toString(),
    vaultBalance: vaultBalance.toString(),
    percentage: percentage[0],
    withdrawAmount: withdrawAmount.toString(),
    isLoading,
    isLoadingVault,
    withdrawAmountValid: withdrawAmount > 0
  });

  const withdrawAmountFormatted = Number(withdrawAmount) / (tokenInfo?.decimals ? 10 ** tokenInfo.decimals : 1e8);

  // Получаем USD стоимость количества для вывода
  const withdrawValueUSD = tokenInfo?.usdPrice 
    ? withdrawAmountFormatted * parseFloat(tokenInfo.usdPrice)
    : 0;

  const handlePercentageChange = (value: number[]) => {
    setPercentage(value);
    setError("");
  };

  const handleMaxClick = () => {
    setPercentage([100]);
    setError("");
  };

  const handleConfirm = () => {
    if (withdrawAmount <= 0) {
      setError("No amount to withdraw");
      return;
    }

    // Для payload используем vaultBalance (реальные обёрнутые токены)
    const payloadAmount = vaultBalance > 0 
      ? (vaultBalance * BigInt(percentage[0])) / BigInt(100)
      : BigInt(0);

    console.log('WithdrawModal - Payload amount (vault):', payloadAmount.toString());
    console.log('WithdrawModal - Display amount (userPositions):', withdrawAmount.toString());

    onConfirm(payloadAmount);
  };

  const handleClose = () => {
    setPercentage([100]);
    setError("");
    onClose();
    closeAllModals();
  };

  // Сбрасываем состояние при открытии/закрытии модального окна
  useEffect(() => {
    if (!isOpen) {
      setPercentage([100]);
      setError("");
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {tokenInfo?.logoUrl && (
              <Image 
                src={tokenInfo.logoUrl} 
                alt={tokenInfo.symbol}
                width={24}
                height={24}
                className="object-contain"
              />
            )}
            Withdraw {tokenInfo?.symbol || "Token"}
          </DialogTitle>
          <DialogDescription>
            Enter the amount you want to withdraw from your position
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Withdraw Percentage</Label>
            <div className="space-y-4">
              <Slider
                value={percentage}
                onValueChange={handlePercentageChange}
                max={100}
                min={0}
                step={1}
                disabled={isLoading || isLoadingVault}
                className="w-full"
              />
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">0%</span>
                <span className="text-lg font-semibold">{percentage[0]}%</span>
                <span className="text-sm text-muted-foreground">100%</span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleMaxClick}
                disabled={isLoading || isLoadingVault}
                className="w-full"
              >
                MAX (100%)
              </Button>
            </div>
            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Available Balance:</span>
              <span>{availableBalanceFormatted.toFixed(6)} {tokenInfo?.symbol}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Withdraw Amount:</span>
              <span>{withdrawAmountFormatted.toFixed(6)} {tokenInfo?.symbol}</span>
            </div>
            {withdrawValueUSD > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Withdraw Value:</span>
                <span>${withdrawValueUSD.toFixed(2)}</span>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={isLoading || isLoadingVault || withdrawAmount <= 0}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Withdrawing...
              </>
            ) : (
              "Withdraw"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 