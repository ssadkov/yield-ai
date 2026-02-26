'use client';

import React, { useEffect, useState } from 'react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import { useToast } from '@/components/ui/use-toast';
import { ToastAction } from '@/components/ui/toast';

const DECIBEL_LOGO = '/protocol_ico/decibel.png';

type ReferralStatus = { success: boolean; canRegister?: boolean };
type SubaccountsResponse = { success: boolean; data?: { subaccount_address?: string }[] };

export function DecibelCTABlock() {
  const { account } = useWallet();
  const { toast } = useToast();
  const [referralStatus, setReferralStatus] = useState<ReferralStatus | null>(null);
  const [subaccounts, setSubaccounts] = useState<{ subaccount_address?: string }[]>([]);
  const [checking, setChecking] = useState(false);
  const [registering, setRegistering] = useState(false);

  const address = account?.address?.toString();

  useEffect(() => {
    if (!address) {
      setReferralStatus(null);
      setSubaccounts([]);
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
        setSubaccounts(subs?.success && Array.isArray(subs.data) ? subs.data : []);
      })
      .catch(() => {
        if (!cancelled) {
          setReferralStatus(null);
          setSubaccounts([]);
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
      if (subsData?.success && Array.isArray(subsData.data)) setSubaccounts(subsData.data);
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
                Register on Decibel Mainnet — trade perps on Aptos
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
            {address && !checking && hasSubaccount && (
              <p className="text-sm text-muted-foreground">You&apos;re registered on Decibel</p>
            )}
            {address && !checking && canRegister === false && !hasSubaccount && (
              <p className="text-sm text-muted-foreground">Registration temporarily unavailable</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
