'use client';

import React, { useEffect, useState } from 'react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { AccountAddress } from '@aptos-labs/ts-sdk';
import { signAptosTransactionWithSolana } from '@aptos-labs/derived-wallet-solana';
import { StandardWalletAdapter as SolanaWalletAdapter } from '@solana/wallet-standard-wallet-adapter-base';
import { UserResponseStatus } from '@aptos-labs/wallet-standard';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import { useToast } from '@/components/ui/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { buildApproveBuilderFeePayload } from '@/lib/protocols/decibel/approveBuilderFee';
import { DecibelDepositModal } from '@/components/ui/decibel-deposit-modal';
import { useDecibelAptosAddress } from '@/hooks/useDecibelAptosAddress';
import { isDerivedAptosWallet } from '@/lib/aptosWalletUtils';
import { normalizeAuthenticator } from '@/lib/hooks/useTransactionSubmitter';
import { useAptosClient } from '@/contexts/AptosClientContext';
import { GasStationService } from '@/lib/services/gasStation';

const DECIBEL_DOMAIN = 'app.decibel.trade';
const AUTH_FUNCTION = '0x1::solana_derivable_account::authenticate';

const DECIBEL_LOGO = '/protocol_ico/decibel.png';

type ReferralStatus = { success: boolean; canRegister?: boolean };
type SubaccountItem = { subaccount_address?: string; is_primary?: boolean };
type SubaccountsResponse = { success: boolean; data?: SubaccountItem[] };
type BuilderConfigResponse = { success: boolean; builderAddress?: string; builderFeeBps?: number };
type ApprovedMaxFeeResponse = { success: boolean; approvedMaxFeeBps?: number | null };

export function DecibelCTABlock() {
  const { account, wallet, signAndSubmitTransaction } = useWallet();
  const aptos = useAptosClient();
  const { decibelAddress, isLoading: isLoadingDecibelAddress } = useDecibelAptosAddress();
  const { toast } = useToast();
  const isDerived = Boolean(wallet && isDerivedAptosWallet(wallet));
  const [referralStatus, setReferralStatus] = useState<ReferralStatus | null>(null);
  const [subaccounts, setSubaccounts] = useState<SubaccountItem[]>([]);
  const [approvedMaxFeeBps, setApprovedMaxFeeBps] = useState<number | null | undefined>(undefined);
  const [checking, setChecking] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [approving, setApproving] = useState(false);
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);

  useEffect(() => {
    if (!decibelAddress) {
      setReferralStatus(null);
      setSubaccounts([]);
      setApprovedMaxFeeBps(undefined);
      return;
    }
    let cancelled = false;
    setChecking(true);
    Promise.all([
      fetch('/api/protocols/decibel/referral-status').then((r) => r.json() as Promise<ReferralStatus>),
      fetch(`/api/protocols/decibel/subaccounts?address=${encodeURIComponent(decibelAddress)}`).then(
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
  }, [decibelAddress]);

  const canRegister = Boolean(referralStatus?.success && referralStatus?.canRegister);
  const hasSubaccount = subaccounts.length > 0;
  const needsRegister = canRegister && !hasSubaccount && !!decibelAddress;
  const primarySubaccount = subaccounts.find((s) => s.is_primary) ?? subaccounts[0];
  const primarySubaccountAddr = primarySubaccount?.subaccount_address?.trim() ?? '';

  const formatAptosErrorForToast = (err: unknown): string => {
    const anyErr = err as any;
    const data = anyErr?.data;

    const message =
      typeof data?.message === 'string'
        ? data.message
        : anyErr instanceof Error
          ? anyErr.message
          : String(err);

    const errorCode = typeof data?.error_code === 'string' ? data.error_code : undefined;
    const vmErrorCode = typeof data?.vm_error_code === 'number' ? data.vm_error_code : undefined;
    const vmStatus = typeof data?.vm_status === 'string' ? data.vm_status : undefined;
    const aptosMessage = typeof data?.aptos_message === 'string' ? data.aptos_message : undefined;

    const parts: string[] = [];
    parts.push(message || 'Unknown error');
    if (errorCode) parts.push(`error_code=${errorCode}`);
    if (vmErrorCode != null) parts.push(`vm_error_code=${vmErrorCode}`);
    if (vmStatus) parts.push(vmStatus);
    if (aptosMessage) parts.push(aptosMessage);

    // If node didn't include vm_status, include compact payload to debug quickly.
    if (!vmStatus && data && typeof data === 'object') {
      try {
        const compact = JSON.stringify(data);
        if (compact && compact !== '{}' && compact !== '[]') parts.push(compact);
      } catch {
        // ignore
      }
    }
    return parts.join(' | ');
  };

  const handleRegister = async () => {
    if (!decibelAddress || registering) return;
    setRegistering(true);
    try {
      const res = await fetch('/api/protocols/decibel/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account: decibelAddress }),
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
      const subsRes = await fetch(`/api/protocols/decibel/subaccounts?address=${encodeURIComponent(decibelAddress)}`);
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
    if (!decibelAddress || approving || subaccounts.length === 0) return;
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

      if (isDerived && wallet) {
        const solanaWalletRef = (wallet as unknown as { solanaWallet?: SolanaWalletAdapter }).solanaWallet;
        if (!solanaWalletRef?.publicKey || (!solanaWalletRef.signMessage && !solanaWalletRef.signIn)) {
          toast({ variant: 'destructive', title: 'Approve failed', description: 'Solana wallet not available or does not support signing' });
          return;
        }
        const sender = AccountAddress.fromString(decibelAddress);
        // Ensure the derived account exists on-chain; otherwise the transaction will be rejected as invalid.
        // (Decibel onboarding via API can create a subaccount without creating the Aptos account itself.)
        try {
          const accountRes = await fetch(`https://fullnode.mainnet.aptoslabs.com/v1/accounts/${sender.toString()}`);
          if (accountRes.status === 404) {
            toast({
              variant: 'destructive',
              title: 'Approve failed',
              description: 'Derived Aptos account is not initialized on-chain yet. Open app.decibel.trade and complete an on-chain action (e.g. deposit) to initialize it, then try again.',
            });
            return;
          }
        } catch {
          // ignore and let submission path surface the real error
        }
        const gasStation = GasStationService.getInstance();
        const transactionSubmitter = gasStation.isAvailable() ? gasStation.getTransactionSubmitter() : null;

        const transaction = await aptos.transaction.build.simple({
          sender,
          withFeePayer: Boolean(transactionSubmitter),
          data: {
            function: payload.function as `${string}::${string}::${string}`,
            typeArguments: payload.typeArguments,
            functionArguments: payload.functionArguments as (string | number)[],
          },
          options: { maxGasAmount: 20000 },
        });
        const signResult = await signAptosTransactionWithSolana({
          solanaWallet: solanaWalletRef,
          authenticationFunction: AUTH_FUNCTION,
          rawTransaction: transaction,
          domain: DECIBEL_DOMAIN,
        });
        if (signResult.status === UserResponseStatus.REJECTED) {
          toast({ variant: 'destructive', title: 'Rejected', description: 'You rejected the transaction' });
          return;
        }
        if (signResult.status !== UserResponseStatus.APPROVED || !signResult.args) {
          toast({ variant: 'destructive', title: 'Approve failed', description: 'Transaction signing failed' });
          return;
        }
        const senderAuthenticator = normalizeAuthenticator(signResult.args);
        let txHash = '';
        if (transactionSubmitter) {
          // Preferred: sponsored submit (derived wallets often have 0 APT).
          const resp = await transactionSubmitter.submitTransaction({
            aptosConfig: aptos.config as any,
            transaction: transaction as any,
            senderAuthenticator: senderAuthenticator as any,
          });
          txHash = typeof resp?.hash === 'string' ? resp.hash : (resp as { hash?: string })?.hash ?? '';
        } else {
          // Fallback: sender pays gas.
          const response = await aptos.transaction.submit.simple({
            transaction,
            senderAuthenticator,
          });
          txHash = typeof response?.hash === 'string' ? response.hash : (response as { hash?: string })?.hash ?? '';
        }
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
      } else {
        if (!signAndSubmitTransaction) {
          toast({ variant: 'destructive', title: 'Approve failed', description: 'Wallet does not support signing' });
          return;
        }
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
      }
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Approve failed',
        description: formatAptosErrorForToast(e),
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
            {!account?.address && (
              <p className="text-sm text-muted-foreground">Connect Aptos wallet to register</p>
            )}
            {account?.address && (checking || isLoadingDecibelAddress) && (
              <p className="text-sm text-muted-foreground">Checking…</p>
            )}
            {decibelAddress && !checking && !isLoadingDecibelAddress && needsRegister && (
              <Button
                size="sm"
                onClick={handleRegister}
                disabled={registering}
              >
                {registering ? 'Registering…' : 'Register on Decibel Mainnet'}
              </Button>
            )}
            {decibelAddress && !checking && !isLoadingDecibelAddress && hasSubaccount && approvedMaxFeeBps === null && (
              <div className="flex flex-col gap-2 items-end">
                <p className="text-sm text-muted-foreground">You&apos;re registered on Decibel</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleApproveBuilderFee}
                  disabled={approving || (!isDerived && !signAndSubmitTransaction)}
                >
                  {approving ? 'Enabling…' : 'Enable trading via Yield AI'}
                </Button>
              </div>
            )}
            {decibelAddress && !checking && !isLoadingDecibelAddress && hasSubaccount && approvedMaxFeeBps != null && primarySubaccountAddr && (
              <Button
                onClick={() => setIsDepositModalOpen(true)}
                disabled={!signAndSubmitTransaction}
                className="bg-success text-success-foreground hover:bg-success/90"
              >
                Deposit
              </Button>
            )}
            {decibelAddress && !checking && !isLoadingDecibelAddress && canRegister === false && !hasSubaccount && (
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
