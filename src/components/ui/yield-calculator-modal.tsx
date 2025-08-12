'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { calcYield } from '@/lib/utils/calcYield';
import { useWalletData } from '@/contexts/WalletContext';
import { getProtocolByName } from '@/lib/protocols/getProtocolsList';
import { useWalletStore } from '@/lib/stores/walletStore';

interface YieldCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function YieldCalculatorModal({ isOpen, onClose }: YieldCalculatorModalProps) {
  const { address, tokens } = useWalletData();
  const { fetchPositions, isDataStale, getTotalValue, positions, lastPositionsUpdate } = useWalletStore();

  const [apr, setApr] = useState<number>(0);
  const [aprInput, setAprInput] = useState<string>('0.00');
  const [depositUSD, setDepositUSD] = useState<string>('10000');
  const [animKey, setAnimKey] = useState<number>(0);
  const [userEditedDeposit, setUserEditedDeposit] = useState<boolean>(false);
  const [walletTotalCached, setWalletTotalCached] = useState<number>(0);
  const [loadingDefaults, setLoadingDefaults] = useState<boolean>(false);

  // Helpers
  const computeWalletTotalFromContext = (walletTokens: any[]) => {
    return (walletTokens || []).reduce((sum, t: any) => {
      let v = 0;
      if (t?.value != null) {
        const parsed = parseFloat(t.value as string);
        v = isNaN(parsed) ? 0 : parsed;
      } else if (t?.price != null) {
        const price = parseFloat(t.price as string);
        const decimals = typeof t.decimals === 'number' ? t.decimals : 8;
        const raw = parseFloat(t.amount as string);
        const amount = isNaN(raw) ? 0 : raw / Math.pow(10, decimals);
        v = (isNaN(price) ? 0 : price) * amount;
      }
      return sum + (isFinite(v) ? v : 0);
    }, 0);
  };

  // Fetch defaults on open: best stable APR from Lite Stables
  useEffect(() => {
    if (!isOpen) return;

    const fetchDefaults = async () => {
      try {
        setLoadingDefaults(true);

        // 1) Best stable APR from Lite Stables (native deposit only)
        // We'll use Auro Finance and Echelon APIs which surface lending pools of stables
        const auroUrl = '/api/protocols/auro/pools';
        const echelonUrl = '/api/protocols/echelon/v2/pools';

        const [auroResp, echelonResp] = await Promise.allSettled([
          fetch(auroUrl),
          fetch(echelonUrl),
        ]);

        let bestStableApr = 0;
        const stableSymbols = ['USDT', 'USDC', 'DAI'];

        // Auro
        if (auroResp.status === 'fulfilled' && auroResp.value.ok) {
          const data = await auroResp.value.json();
          const pools = (data.data || []) as any[];
          const auroNative = getProtocolByName('Auro Finance');
          if (auroNative && auroNative.depositType === 'native') {
            pools
              .filter((p) => p.type === 'COLLATERAL')
              .filter((p) => stableSymbols.includes((p.collateralTokenSymbol || '').toUpperCase()))
              .forEach((p) => {
                const supplyApr = parseFloat(p.supplyApr || '0');
                const supplyIncentiveApr = parseFloat(p.supplyIncentiveApr || '0');
                const stakingApr = parseFloat(p.stakingApr || '0');
                const totalAPY = supplyApr + supplyIncentiveApr + stakingApr;
                if (!isNaN(totalAPY)) bestStableApr = Math.max(bestStableApr, totalAPY);
              });
          }
        }

        // Echelon
        if (echelonResp.status === 'fulfilled' && echelonResp.value.ok) {
          const data = await echelonResp.value.json();
          const pools = (data.data || []) as any[];
          const echelonNative = getProtocolByName('Echelon');
          if (echelonNative && echelonNative.depositType === 'native') {
            pools
              .filter((p) => stableSymbols.some((s) => (p.asset || '').toUpperCase().includes(s)))
              .forEach((p) => {
                const totalAPY = parseFloat(p.totalAPY || 0);
                if (!isNaN(totalAPY)) bestStableApr = Math.max(bestStableApr, totalAPY);
              });
          }
        }

        const defaultApr = bestStableApr > 0 ? parseFloat(bestStableApr.toFixed(2)) : 0;
        setApr(defaultApr);
        setAprInput(defaultApr.toFixed(2));

        // Deposit stays as simple default (10000) for now; no auto-fill from assets
      } finally {
        setLoadingDefaults(false);
      }
    };

    fetchDefaults();
  }, [isOpen]);

  // No auto-updates for deposit amount for now

  const parsedDeposit = useMemo(() => {
    const digits = depositUSD.replace(/\D/g, '');
    const val = parseInt(digits || '0', 10);
    return isNaN(val) || val < 0 ? 0 : val;
  }, [depositUSD]);

  const yieldResult = useMemo(() => {
    const cents = Math.round(parsedDeposit * 100);
    const amount = BigInt(Math.max(0, cents));
    return calcYield(parseFloat(apr.toFixed(2)), amount, 2);
  }, [apr, parsedDeposit]);

  const formatUSD = (n: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(
      isFinite(n) ? n : 0
    );
  };

  const totalAssetsNow = useMemo(() => {
    const walletNow = walletTotalCached || computeWalletTotalFromContext(tokens as any[]);
    const positionsNow = getTotalValue();
    return (walletNow || 0) + (positionsNow || 0);
  }, [walletTotalCached, tokens, positions, lastPositionsUpdate, getTotalValue]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[520px] p-6 rounded-2xl">
        <DialogHeader>
          <DialogTitle>Yield Calculator</DialogTitle>
          <DialogDescription>Estimate your earnings based on APR and deposit size.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
            {/* Left: APR & Deposit (inputs) */}
            <div className="space-y-4">
              <Label htmlFor="apr">APR %</Label>
              <div className="flex items-center gap-2">
                 <Input
                   id="apr"
                   type="text"
                   inputMode="decimal"
                   pattern="[0-9.]*"
                   value={aprInput}
                   onChange={(e) => {
                     // Allow easy typing: digits and a single dot
                     let v = e.target.value.replace(/[^0-9.]/g, '');
                     const parts = v.split('.');
                     if (parts.length > 2) {
                       v = parts[0] + '.' + parts.slice(1).join('');
                     }
                     setAprInput(v);
                     const num = parseFloat(v);
                     setApr(Number.isFinite(num) ? num : 0);
                     setAnimKey((k) => k + 1);
                   }}
                   onBlur={() => {
                     const num = parseFloat(aprInput);
                     const normalized = Number.isFinite(num) ? Math.max(0, Math.round(num * 100) / 100) : 0;
                     setApr(normalized);
                     setAprInput(normalized.toFixed(2));
                   }}
                   className="h-12 text-lg text-right"
                   disabled={loadingDefaults}
                 />
                {/* sliders removed */}
              </div>
              <div className="space-y-2">
                <Label htmlFor="deposit">Deposit (USD)</Label>
                <Input
                  id="deposit"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={depositUSD}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '');
                    setDepositUSD(digits);
                    setUserEditedDeposit(true);
                    setAnimKey((k) => k + 1);
                  }}
                  className="h-12 text-lg text-right"
                  disabled={loadingDefaults}
                />
              </div>
            </div>
            {/* Right: Earnings column */}
            <div className="space-y-3">
              {/* Move Deposit under APR (left), so right has only earnings */}
              <div className="space-y-2">
                {[{label:'per day', value: yieldResult.daily, icon:'☀️'}, {label:'per week', value: yieldResult.weekly, icon:'📅'}, {label:'per month', value: yieldResult.monthly, icon:'📆'}, {label:'per year', value: yieldResult.yearly, icon:'📈'}].map((item, idx) => (
                  <Card key={item.label}>
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2">
                        <span className="text-base leading-none">{item.icon}</span>
                        <div className="ml-auto text-right">
                          <div className="text-xl font-semibold leading-tight transition-all duration-200 ease-out" key={animKey + '-' + idx}>
                            {formatUSD(item.value)}
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">{item.label}</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
          
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Close</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


