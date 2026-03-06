'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { useWalletData } from '@/contexts/WalletContext';
import { useAmountInput } from '@/hooks/useAmountInput';
import { buildDepositToSubaccountPayload, DECIBEL_MAINNET_USDC_METADATA } from '@/lib/protocols/decibel/depositToSubaccount';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';
import { ToastAction } from '@/components/ui/toast';

const DECIBEL_LOGO = '/protocol_ico/decibel.png';
const USDC_LOGO = 'https://assets.panora.exchange/tokens/aptos/USDC.svg';
const USDC_DECIMALS = 6;

function normalizeAddress(addr?: string | null): string {
  if (!addr || !addr.startsWith('0x')) return addr || '';
  const normalized = addr.slice(2).replace(/^0+/, '');
  return `0x${normalized || '0'}`;
}

function shortenHex(hex: string, head = 6, tail = 4): string {
  if (!hex || !hex.startsWith('0x') || hex.length <= head + tail + 2) return hex;
  return `${hex.slice(0, head + 2)}...${hex.slice(-tail)}`;
}

interface DecibelDepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  subaccountAddr: string;
}

export function DecibelDepositModal({
  isOpen,
  onClose,
  subaccountAddr,
}: DecibelDepositModalProps) {
  const { account, signAndSubmitTransaction } = useWallet();
  const { tokens, refreshPortfolio } = useWalletData();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const usdcToken = useMemo(
    () =>
      tokens.find(
        (token) => normalizeAddress(token.address) === normalizeAddress(DECIBEL_MAINNET_USDC_METADATA)
      ),
    [tokens]
  );

  const walletBalance = usdcToken ? BigInt(usdcToken.amount) : BigInt(0);
  const balanceNumber = Number(walletBalance) / 10 ** USDC_DECIMALS;

  const { amount, amountString, setAmountFromString, setHalf, setMax, isValid } = useAmountInput({
    balance: walletBalance,
    decimals: USDC_DECIMALS,
    initialValue: BigInt(0),
  });

  useEffect(() => {
    if (!isOpen) return;
    void refreshPortfolio();
    setAmountFromString('');
  }, [isOpen, refreshPortfolio, setAmountFromString]);

  const handleDeposit = async () => {
    if (!account?.address || !signAndSubmitTransaction || isSubmitting || amount === BigInt(0)) return;

    setIsSubmitting(true);
    try {
      const payload = buildDepositToSubaccountPayload({
        subaccountAddr,
        amountBaseUnits: amount,
      });

      const result = await signAndSubmitTransaction({
        data: {
          function: payload.function as `${string}::${string}::${string}`,
          typeArguments: payload.typeArguments,
          functionArguments: payload.functionArguments as string[],
        },
        options: { maxGasAmount: 20000 },
      });

      const txHash = typeof result?.hash === 'string' ? result.hash : (result as { hash?: string })?.hash ?? '';

      void refreshPortfolio();
      window.dispatchEvent(new Event('refreshPositions'));
      onClose();

      toast({
        title: 'USDC deposited to Decibel',
        description: txHash ? `Transaction ${txHash.slice(0, 6)}...${txHash.slice(-4)}` : 'Transaction submitted',
        action: txHash ? (
          <ToastAction
            altText="View in Explorer"
            onClick={() => window.open(`https://explorer.aptoslabs.com/txn/${txHash}?network=mainnet`, '_blank')}
          >
            View in Explorer
          </ToastAction>
        ) : undefined,
      });
    } catch (error) {
      toast({
        title: 'Deposit failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[460px] p-6 rounded-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Image src={DECIBEL_LOGO} alt="Decibel" width={24} height={24} className="rounded-full" />
            <DialogTitle>Deposit to Decibel</DialogTitle>
          </div>
          <DialogDescription>Deposit USDC into your Decibel trading account.</DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-center gap-2 py-4">
          <div className="flex items-center gap-2">
            <Image src={USDC_LOGO} alt="USDC" width={32} height={32} />
            <span>USDC</span>
          </div>
          <span>-&gt;</span>
          <div className="flex items-center gap-2">
            <Image src={DECIBEL_LOGO} alt="Decibel" width={32} height={32} className="rounded-full" />
            <span>Decibel</span>
          </div>
        </div>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="decibel-deposit-amount">Amount</Label>
              <span className="text-sm text-muted-foreground text-right">
                Wallet balance: {balanceNumber.toFixed(2)} USDC
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Input
                id="decibel-deposit-amount"
                type="number"
                min="0"
                step="0.000001"
                value={amountString}
                onChange={(e) => setAmountFromString(e.target.value)}
                placeholder="0.00"
                className={amount > walletBalance ? 'text-red-500' : ''}
              />
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Image src={USDC_LOGO} alt="USDC" width={16} height={16} />
                <span>USDC</span>
              </div>
            </div>
            {amount > walletBalance && (
              <p className="text-sm text-red-500">Amount exceeds your USDC wallet balance.</p>
            )}
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={setHalf}>
              Half
            </Button>
            <Button variant="outline" size="sm" onClick={setMax}>
              Max
            </Button>
          </div>

          <div className="rounded-lg border p-3 text-sm text-muted-foreground space-y-1">
            <p title={subaccountAddr}>Subaccount: {shortenHex(subaccountAddr)}</p>
          </div>
        </div>

        <Separator />

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleDeposit}
            disabled={!isValid || isSubmitting || !signAndSubmitTransaction || amount === BigInt(0)}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Depositing...
              </>
            ) : (
              'Deposit'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
