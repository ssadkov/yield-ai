"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { Token } from "@/lib/types/token";
import { APTOS_COIN_TYPE } from "@/lib/constants/yieldAiVault";
import { buildVaultWithdrawPayload } from "@/lib/protocols/yield-ai/vaultDeposit";
import { showTransactionSuccessToast } from "@/components/ui/transaction-toast";

/** FA metadata address from token (safe asset_type). APT is not supported for vault::withdraw. */
function getMetadataAddress(token: Token): string | null {
  if (token.address === APTOS_COIN_TYPE || token.address.startsWith("0x1::"))
    return null;
  return token.address.includes("::")
    ? token.address.split("::")[0]
    : token.address;
}

interface YieldAIWithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** If provided, called instead of submitting tx (e.g. stub). Otherwise modal submits vault::withdraw. */
  onConfirm?: (amount: bigint) => void | Promise<void>;
  /** Token in the safe to withdraw */
  token: Token | null;
  /** Safe address. Required for real withdraw when onConfirm is not provided. */
  safeAddress?: string;
}

export function YieldAIWithdrawModal({
  isOpen,
  onClose,
  onConfirm,
  token,
  safeAddress,
}: YieldAIWithdrawModalProps) {
  const { signAndSubmitTransaction } = useWallet();
  const [percentage, setPercentage] = useState([100]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const availableBalance = token ? BigInt(token.amount) : BigInt(0);
  const decimals = token?.decimals ?? 6;
  const availableBalanceFormatted =
    Number(availableBalance) / Math.pow(10, decimals);
  const withdrawAmount =
    availableBalance > BigInt(0)
      ? (availableBalance * BigInt(percentage[0])) / BigInt(100)
      : BigInt(0);
  const withdrawAmountFormatted =
    Number(withdrawAmount) / Math.pow(10, decimals);
  const withdrawValueUSD = token?.price
    ? withdrawAmountFormatted * parseFloat(token.price)
    : 0;

  const metadataAddress = token ? getMetadataAddress(token) : null;
  const canSubmitTx =
    !!safeAddress && !!metadataAddress && !!signAndSubmitTransaction;

  const handlePercentageChange = (value: number[]) => {
    setPercentage(value);
    setError("");
  };

  const handleMaxClick = () => {
    setPercentage([100]);
    setError("");
  };

  const handleConfirm = async () => {
    if (withdrawAmount <= BigInt(0)) {
      setError("No amount to withdraw");
      return;
    }
    setError("");
    try {
      setIsLoading(true);
      if (onConfirm) {
        await onConfirm(withdrawAmount);
        onClose();
        return;
      }
      if (!canSubmitTx || !metadataAddress) {
        setError("Withdraw not supported for this asset");
        return;
      }
      const payload = buildVaultWithdrawPayload({
        safeAddress: safeAddress!,
        metadata: metadataAddress,
        amountBaseUnits: withdrawAmount,
      });
      const result = await signAndSubmitTransaction({
        data: {
          function: payload.function as `${string}::${string}::${string}`,
          typeArguments: payload.typeArguments,
          functionArguments: payload.functionArguments,
        },
        options: { maxGasAmount: 20000 },
      });
      if (result?.hash) {
        showTransactionSuccessToast({
          hash: result.hash,
          title: "Withdraw from safe successful!",
        });
        window.dispatchEvent(
          new CustomEvent("refreshPositions", { detail: { protocol: "yield-ai" } })
        );
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Withdraw failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setPercentage([100]);
    setError("");
    onClose();
  };

  useEffect(() => {
    if (!isOpen) {
      setPercentage([100]);
      setError("");
    }
  }, [isOpen]);

  if (!token) return null;

  const logoUrl = token.logoUrl;
  const isApt = token.address === APTOS_COIN_TYPE;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
            {logoUrl ? (
              <Image
                src={logoUrl}
                alt={token.symbol}
                width={24}
                height={24}
                className="object-contain"
                unoptimized
              />
            ) : (
              <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-semibold">
                {token.symbol.slice(0, 1)}
              </span>
            )}
            Withdraw {token.symbol}
          </DialogTitle>
          <DialogDescription className="text-sm">
            Enter the amount you want to withdraw from your safe to your wallet
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Withdraw Percentage</Label>
            <div className="space-y-4">
              <Slider
                value={percentage}
                onValueChange={handlePercentageChange}
                max={100}
                min={0}
                step={1}
                disabled={isLoading}
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
                disabled={isLoading}
                className="w-full h-10 sm:h-9"
              >
                MAX (100%)
              </Button>
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            {isApt && !onConfirm && (
              <p className="text-sm text-muted-foreground">
                APT withdraw via this flow is not supported. Use FA assets (e.g. USDC).
              </p>
            )}
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Available Balance:</span>
              <span>
                {availableBalanceFormatted.toFixed(6)} {token.symbol}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Withdraw Amount:</span>
              <span>
                {withdrawAmountFormatted.toFixed(6)} {token.symbol}
              </span>
            </div>
            {withdrawValueUSD > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Withdraw Value:</span>
                <span>${withdrawValueUSD.toFixed(2)}</span>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 flex-col sm:flex-row">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isLoading}
            className="w-full sm:w-auto h-10"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={
              isLoading ||
              withdrawAmount <= BigInt(0) ||
              (isApt && !onConfirm) ||
              (!onConfirm && !canSubmitTx)
            }
            className="w-full sm:w-auto h-10"
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
