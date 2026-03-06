'use client';

import React, { useEffect, useState } from 'react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import { useToast } from '@/components/ui/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { buildApproveBuilderFeePayload } from '@/lib/protocols/decibel/approveBuilderFee';
import { DecibelDepositModal } from '@/components/ui/decibel-deposit-modal';

const DECIBEL_LOGO = '/protocol_ico/decibel.png';

type ReferralStatus = { success: boolean; canRegister?: boolean };
type SubaccountItem = { subaccount_address?: string; is_primary?: boolean };
type SubaccountsResponse = { success: boolean; data?: SubaccountItem[] };
type BuilderConfigResponse = { success: boolean; builderAddress?: string; builderFeeBps?: number };
type ApprovedMaxFeeResponse = { success: boolean; approvedMaxFeeBps?: number | null };

export function DecibelCTABlock() {
  const { account, signAndSubmitTransaction } = useWallet();
  const { toast } = useToast();
  const [referralStatus, setReferralStatus] = useState<ReferralStatus | null>(null);
  const [subaccounts, setSubaccounts] = useState<SubaccountItem[]>([]);
  const [approvedMaxFeeBps, setApprovedMaxFeeBps] = useState<number | null | undefined>(undefined);
  const [checking, setChecking] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [approving, setApproving] = useState(false);
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);

  const address = account?.address?.toString();

  useEffect(() => {
    if (!address) {
      setReferralStatus(null);
      setSubaccounts([]);
      setApprovedMaxFeeBps(undefined);
      return;
    }
    let cancelled = false;
    setChecking(true);
    Promise.all([
      fetch('/api/protocols/decibel/referral-status').then((r) => r.json() as Promise<ReferralStatus>),
      fetch(`/api/protocols/decibel/subaccounts?address=${encodeURIComponent(address)}`).then(
        (r) => r.json() as Promise<SubaccountsResponse>
      ),
    ])
      .then(([status, subs]) => {
        if (cancelled) return;
        setReferralStatus(status);
        const list = subs?.success && Array.isArray(subs.data) ? subs.data : [];
        setSubaccounts(list);
        const primary = list.find((s) => s.is_primary) ?? list[0];
        const subAddr = primary?.subaccount_address?.trim();
        if (subAddr) {
          fetch(`/api/protocols/decibel/approved-max-fee?subaccount=${encodeURIComponent(subAddr)}`)
            .then((r) => r.json() as Promise<ApprovedMaxFeeResponse>)
            .then((data) => {
              if (!cancelled && data?.success) {
                setApprovedMaxFeeBps(data.approvedMaxFeeBps ?? null);
              } else if (!cancelled) {
                setApprovedMaxFeeBps(undefined);
              }
            })
            .catch(() => {
              if (!cancelled) setApprovedMaxFeeBps(undefined);
            });
        } else {
          setApprovedMaxFeeBps(undefined);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setReferralStatus(null);
          setSubaccounts([]);
          setApprovedMaxFeeBps(undefined);
        }
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [address]);

  const canRegister = Boolean(referralStatus?.success && referralStatus?.canRegister);
  const hasSubaccount = subaccounts.length > 0;
  const needsRegister = canRegister && !hasSubaccount && !!address;
  const primarySubaccount = subaccounts.find((s) => s.is_primary) ?? subaccounts[0];
  const primarySubaccountAddr = primarySubaccount?.subaccount_address?.trim() ?? '';

  const handleRegister = async () => {
    if (!address || registering) return;
    setRegistering(true);
    try {
      const res = await fetch('/api/protocols/decibel/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account: address }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const isForbidden = res.status === 403 && (data as { code?: string })?.code === 'DECIBEL_REDEEM_FORBIDDEN';
        toast({
          variant: 'destructive',
          title: 'Registration failed',
          description: (data?.error as string) || `Error ${res.status}`,
          action: isForbidden ? (
            <ToastAction altText="Open app" onClick={() => window.open('https://app.decibel.trade/', '_blank')}>
              Open app.decibel.trade
            </ToastAction>
          ) : undefined,
        });
        return;
      }
      toast({
        title: 'Registered on Decibel',
        description: data.alreadyOnboarded
          ? 'You already had a subaccount.'
          : 'Your Decibel subaccount was created. You can trade on mainnet.',
      });
      const subsRes = await fetch(`/api/protocols/decibel/subaccounts?address=${encodeURIComponent(address)}`);
      const subsData = (await subsRes.json()) as SubaccountsResponse;
      if (subsData?.success && Array.isArray(subsData.data)) {
        setSubaccounts(subsData.data);
        setApprovedMaxFeeBps(null);
      }
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Registration failed',
        description: e instanceof Error ? e.message : 'Unknown error',
      });
    } finally {
      setRegistering(false);
    }
  };

  const handleApproveBuilderFee = async () => {
    if (!address || approving || !signAndSubmitTransaction || subaccounts.length === 0) return;
    const subaccountAddr = primarySubaccountAddr;
    if (!subaccountAddr) {
      toast({ variant: 'destructive', title: 'Error', description: 'No subaccount address' });
      return;
    }
    setApproving(true);
    try {
      const configRes = await fetch('/api/protocols/decibel/builder-config');
      const config = (await configRes.json()) as BuilderConfigResponse;
      if (!configRes.ok || !config.success || !config.builderAddress || config.builderFeeBps == null) {
        toast({
          variant: 'destructive',
          title: 'Approve failed',
          description: config?.success === false ? 'Builder not configured' : 'Could not load builder config',
        });
        return;
      }
      const payload = buildApproveBuilderFeePayload({
        subaccountAddr,
        builderAddr: config.builderAddress,
        maxFeeBps: config.builderFeeBps,
        isTestnet: false,
      });
      const result = await signAndSubmitTransaction({
        data: {
          function: payload.function as `${string}::${string}::${string}`,
          typeArguments: payload.typeArguments,
          functionArguments: payload.functionArguments as (string | number)[],
        },
        options: { maxGasAmount: 20000 },
      });
      const txHash = typeof result?.hash === 'string' ? result.hash : (result as { hash?: string })?.hash ?? '';
      setApprovedMaxFeeBps(config.builderFeeBps);
      toast({
        title: 'Trading via Yield AI enabled',
        description: txHash ? `Transaction ${txHash.slice(0, 6)}...${txHash.slice(-4)}` : 'Transaction submitted',
        action: txHash ? (
          <ToastAction
            altText="View in Explorer"
            onClick={() => window.open('https://explorer.aptoslabs.com/txn/' + txHash + '?network=mainnet', '_blank')}
          >
            View in Explorer
          </ToastAction>
        ) : undefined,
      });
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Approve failed',
        description: e instanceof Error ? e.message : 'Unknown error',
      });
    } finally {
      setApproving(false);
    }
  };

  return (
    <Card className="h-full border-primary/20 hover:shadow-md transition-shadow">
      <CardContent className="p-6 flex flex-col h-full">
        <div className="flex items-center justify-between gap-4 flex-1 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 bg-primary/10 rounded-full shrink-0">
              <div className="w-5 h-5 relative">
                <Image
                  src={DECIBEL_LOGO}
                  alt="Decibel"
                  width={20}
                  height={20}
                  className="object-contain"
                />
              </div>
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-semibold text-primary">Decibel</h3>
              <p className="text-sm text-muted-foreground">
                {hasSubaccount && approvedMaxFeeBps != null
                  ? 'Trade perps on Decibel: Season 1'
                  : 'Register on Decibel Mainnet — trade perps on Aptos'}
              </p>
            </div>
          </div>
          <div className="shrink-0">
            {!address && (
              <p className="text-sm text-muted-foreground">Connect Aptos wallet to register</p>
            )}
            {address && checking && (
              <p className="text-sm text-muted-foreground">Checking…</p>
            )}
            {address && !checking && needsRegister && (
              <Button
                size="sm"
                onClick={handleRegister}
                disabled={registering}
              >
                {registering ? 'Registering…' : 'Register on Decibel Mainnet'}
              </Button>
            )}
            {address && !checking && hasSubaccount && approvedMaxFeeBps === null && (
              <div className="flex flex-col gap-2 items-end">
                <p className="text-sm text-muted-foreground">You&apos;re registered on Decibel</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleApproveBuilderFee}
                  disabled={approving || !signAndSubmitTransaction}
                >
                  {approving ? 'Enabling…' : 'Enable trading via Yield AI'}
                </Button>
              </div>
            )}
            {address && !checking && hasSubaccount && approvedMaxFeeBps != null && primarySubaccountAddr && (
              <Button
                onClick={() => setIsDepositModalOpen(true)}
                disabled={!signAndSubmitTransaction}
                className="bg-success text-success-foreground hover:bg-success/90"
              >
                Deposit
              </Button>
            )}
            {address && !checking && canRegister === false && !hasSubaccount && (
              <p className="text-sm text-muted-foreground">Registration temporarily unavailable</p>
            )}
          </div>
        </div>
      </CardContent>
      {primarySubaccountAddr && (
        <DecibelDepositModal
          isOpen={isDepositModalOpen}
          onClose={() => setIsDepositModalOpen(false)}
          subaccountAddr={primarySubaccountAddr}
        />
      )}
    </Card>
  );
}
