"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useAmountInput } from "@/hooks/useAmountInput";
import { Loader2 } from "lucide-react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useWalletData } from "@/contexts/WalletContext";
import { getProtocolByName } from "@/lib/protocols/getProtocolsList";
import { getTokenList } from "@/lib/tokens/getTokenList";
import { normalizeAddress } from "@/lib/utils/addressNormalization";
import { USDC_FA_METADATA_MAINNET } from "@/lib/constants/yieldAiVault";
import { buildVaultDepositPayload } from "@/lib/protocols/yield-ai/vaultDeposit";
import { showTransactionSuccessToast } from "@/components/ui/transaction-toast";

const USDC_LOGO = "https://assets.panora.exchange/tokens/aptos/USDC.svg";
const USDC_DECIMALS = 6;

interface YieldAIDepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Safe address to deposit into. Required for real deposit (when onDeposit is not provided). */
  safeAddress?: string;
  /** Token metadata address (default: USDC mainnet). */
  defaultTokenAddress?: string;
  /** If provided, called instead of submitting tx (e.g. stub). Otherwise modal submits vault::deposit. */
  onDeposit?: (tokenAddress: string, amount: bigint) => Promise<void>;
}

export function YieldAIDepositModal({
  isOpen,
  onClose,
  safeAddress,
  defaultTokenAddress = USDC_FA_METADATA_MAINNET,
  onDeposit,
}: YieldAIDepositModalProps) {
  const { account, signAndSubmitTransaction } = useWallet();
  const { tokens: walletTokens, refreshPortfolio } = useWalletData();
  const protocol = getProtocolByName("AI agent");
  const [isLoading, setIsLoading] = useState(false);

  const tokenToUse = walletTokens?.find(
    (t) =>
      normalizeAddress(t.address) === normalizeAddress(defaultTokenAddress) ||
      (defaultTokenAddress === USDC_FA_METADATA_MAINNET && t.symbol === "USDC")
  );

  const tokenListAptos = getTokenList(1);
  const tokenInfo = tokenToUse
    ? tokenListAptos.find(
        (t: { symbol?: string; faAddress?: string }) =>
          t.symbol === tokenToUse.symbol ||
          (t as { faAddress?: string }).faAddress === tokenToUse.address
      )
    : null;
  const logoUrl = (tokenInfo as { logoUrl?: string })?.logoUrl ?? USDC_LOGO;

  const walletBalance = tokenToUse ? BigInt(tokenToUse.amount) : BigInt(0);
  const decimals = tokenToUse?.decimals ?? USDC_DECIMALS;
  const symbol = tokenToUse?.symbol ?? "USDC";
  const priceUSD = tokenToUse?.price ? parseFloat(tokenToUse.price) : 0;

  const {
    amount,
    amountString,
    setAmountFromString,
    setHalf,
    setMax,
    isValid,
  } = useAmountInput({
    balance: walletBalance,
    decimals,
  });

  useEffect(() => {
    if (isOpen) {
      refreshPortfolio?.();
    }
  }, [isOpen, refreshPortfolio]);

  const handleDeposit = async () => {
    if (!isValid || amount === BigInt(0)) return;
    try {
      setIsLoading(true);
      if (onDeposit) {
        await onDeposit(defaultTokenAddress, amount);
        onClose();
        return;
      }
      if (!safeAddress || !account?.address || !signAndSubmitTransaction) {
        onClose();
        return;
      }
      const payload = buildVaultDepositPayload({
        safeAddress,
        metadata: defaultTokenAddress,
        amountBaseUnits: amount,
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
          title: "Deposit to safe successful!",
        });
        window.dispatchEvent(
          new CustomEvent("refreshPositions", { detail: { protocol: "yield-ai" } })
        );
        onClose();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px] p-6 rounded-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {protocol?.logoUrl && (
              <Image
                src={protocol.logoUrl}
                alt={protocol?.name ?? "AI agent"}
                width={24}
                height={24}
                className="rounded-full"
              />
            )}
            <DialogTitle>Deposit to {protocol?.name ?? "AI agent"}</DialogTitle>
          </div>
          <DialogDescription>
            Enter amount to deposit {symbol}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-center gap-2 py-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 relative">
              <Image
                src={logoUrl}
                alt={symbol}
                width={32}
                height={32}
                className="object-contain"
                unoptimized
              />
            </div>
            <span>{symbol}</span>
          </div>
          <span>→</span>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 relative">
              {protocol?.logoUrl && (
                <Image
                  src={protocol.logoUrl}
                  alt={protocol?.name ?? "AI agent"}
                  width={32}
                  height={32}
                  className="object-contain rounded-full"
                />
              )}
            </div>
            <span>{protocol?.name ?? "AI agent"}</span>
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
                className={`flex-1 ${amount > walletBalance ? "text-red-500" : ""}`}
                placeholder="0.00"
              />
              <div className="flex items-center gap-1">
                <Image
                  src={logoUrl}
                  alt={symbol}
                  width={16}
                  height={16}
                  className="rounded-full object-contain"
                  unoptimized
                />
                <span className="text-sm">{symbol}</span>
                {amountString && priceUSD > 0 && (
                  <span
                    className={`text-sm ml-2 ${amount > walletBalance ? "text-red-500" : "text-muted-foreground"}`}
                  >
                    ≈ $
                    {(
                      (Number(amount) / Math.pow(10, decimals)) * priceUSD
                    ).toFixed(2)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {amount > walletBalance && (
            <p className="text-sm text-red-500">
              Amount exceeds wallet balance of {symbol}.
            </p>
          )}

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={setHalf}>
              Half
            </Button>
            <Button variant="outline" size="sm" onClick={setMax}>
              Max
            </Button>
          </div>

          <div className="text-sm text-muted-foreground">
            Wallet balance:{" "}
            {(Number(walletBalance) / Math.pow(10, decimals)).toFixed(6)} {symbol}
          </div>
        </div>

        <Separator />

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleDeposit}
            disabled={
              !isValid ||
              isLoading ||
              amount === BigInt(0) ||
              (!onDeposit && (!safeAddress || !signAndSubmitTransaction))
            }
          >
            {isLoading ? (
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
  );
}
