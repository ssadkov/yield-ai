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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface YieldCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  tokens?: any[]; // Опциональные токены для использования вместо токенов из контекста
  totalAssets?: number; // Опционально: итоговая сумма assets (wallet + протоколы) извне
  walletTotal?: number; // Опционально: сумма кошелька извне
}

export function YieldCalculatorModal({ isOpen, onClose, tokens: externalTokens, totalAssets: externalTotalAssets, walletTotal: externalWalletTotal }: YieldCalculatorModalProps) {
  const { address, tokens: contextTokens } = useWalletData();
  // Используем внешние токены, если они переданы, иначе токены из контекста
  const tokens = externalTokens || contextTokens;
  const { fetchPositions, fetchRewards, isDataStale, getTotalValue, positions, lastPositionsUpdate } = useWalletStore();

  const [apr, setApr] = useState<number>(0);
  const [aprInput, setAprInput] = useState<string>('0.00');
  const [depositUSD, setDepositUSD] = useState<string>('0');
  const [animKey, setAnimKey] = useState<number>(0);
  const [userEditedDeposit, setUserEditedDeposit] = useState<boolean>(false);
  const [walletTotalCached, setWalletTotalCached] = useState<number>(0);
  const [loadingDefaults, setLoadingDefaults] = useState<boolean>(false);
  const formatAssetInputValue = (value: number) => {
    if (!Number.isFinite(value) || value <= 0) return '0';
    const fixed = value.toFixed(2);
    return fixed.replace(/\.?0+$/, ''); // убираем лишние нули
  };
  const formatLooseValue = (value: number) => {
    if (!Number.isFinite(value) || value <= 0) return '0';
    return value % 1 === 0 ? value.toFixed(0) : value.toString();
  };

  // Подтягиваем актуальные позиции кошелька при открытии калькулятора
  useEffect(() => {
    if (!isOpen) return;
    if (address) {
      // Форсируем обновление позиций, чтобы суммы протоколов были актуальны
      fetchPositions(address, undefined, true);
      fetchRewards(address, undefined, true);
    }
  }, [isOpen, address, fetchPositions, fetchRewards]);

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

        // Auto-fill deposit from wallet tokens
        const walletTotalValue =
          typeof externalWalletTotal === 'number' && externalWalletTotal > 0
            ? externalWalletTotal
            : computeWalletTotalFromContext(tokens as any[]);

        if (walletTotalValue > 0) {
          // Для кошелька показываем 2 знака после запятой
          setDepositUSD(walletTotalValue.toFixed(2));
          setWalletTotalCached(walletTotalValue);
        } else {
          // До загрузки кошелька — 0
          setDepositUSD('0');
          setWalletTotalCached(0);
        }
      } finally {
        setLoadingDefaults(false);
      }
    };

    fetchDefaults();
  }, [isOpen, tokens]);

  // Подхватываем обновление суммы кошелька после загрузки (если юзер не правил поле)
  useEffect(() => {
    if (!isOpen) return;
    if (userEditedDeposit) return;
    const walletTotalValue =
      typeof externalWalletTotal === 'number' && externalWalletTotal > 0
        ? externalWalletTotal
        : computeWalletTotalFromContext(tokens as any[]);
    if (walletTotalValue > 0) {
      setDepositUSD(walletTotalValue.toFixed(2));
      setWalletTotalCached(walletTotalValue);
    } else {
      setDepositUSD('0');
    }
  }, [isOpen, externalWalletTotal, tokens, userEditedDeposit]);

  // No auto-updates for deposit amount for now

  const parsedDeposit = useMemo(() => {
    // Парсим число с поддержкой точки для сумм меньше 1
    const cleaned = depositUSD.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    const normalized = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : cleaned;
    const val = parseFloat(normalized || '0');
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
  // Если передали полную сумму assets извне (wallet + протоколы), используем её
  const effectiveTotalAssets = useMemo(() => {
    if (typeof externalTotalAssets === 'number' && Number.isFinite(externalTotalAssets)) {
      return externalTotalAssets;
    }
    return totalAssetsNow;
  }, [externalTotalAssets, totalAssetsNow]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto p-6 rounded-2xl w-[calc(100vw-2rem)] sm:w-auto">
        <DialogHeader>
          <DialogTitle>Yield Calculator</DialogTitle>
          <DialogDescription>Estimate your earnings or derive APR from results.</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="yield" className="w-full">
          <TabsList className="mb-3">
            <TabsTrigger value="yield">Yield</TabsTrigger>
            <TabsTrigger value="apr">APR</TabsTrigger>
          </TabsList>

          <TabsContent value="yield" className="space-y-5">
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
                  inputMode="decimal"
                  pattern="[0-9.]*"
                  value={depositUSD}
                  onChange={(e) => {
                    // Разрешаем цифры и точку для сумм меньше 1
                    let v = e.target.value.replace(/[^0-9.]/g, '');
                    const parts = v.split('.');
                    if (parts.length > 2) {
                      v = parts[0] + '.' + parts.slice(1).join('');
                    }
                    setDepositUSD(v);
                    setUserEditedDeposit(true);
                    setAnimKey((k) => k + 1);
                  }}
                  onBlur={() => {
                    // Нормализуем значение при потере фокуса — 2 знака после запятой
                    const num = parseFloat(depositUSD || '0');
                    if (!isNaN(num) && num >= 0) {
                      setDepositUSD(num.toFixed(2));
                    }
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
          
          </TabsContent>

          <TabsContent value="apr" className="space-y-5">
            {/* APR from result tab */}
            <AprFromResult initialCurrentCapital={effectiveTotalAssets} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}


// --- APR from result sub-component ---
function AprFromResult({ initialCurrentCapital }: { initialCurrentCapital?: number }) {
  const [startInput, setStartInput] = useState<string>('10000');
  const [currentInput, setCurrentInput] = useState<string>('0');
  const [daysMode, setDaysMode] = useState<'days' | 'dates'>('days');
  const [daysInput, setDaysInput] = useState<string>('30');
  const [startDateStr, setStartDateStr] = useState<string>('');
  const [endDateStr, setEndDateStr] = useState<string>(() => {
    const d = new Date();
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}.${mm}.${yyyy}`;
  });

  // Ensure end date defaults to today when switching to dates mode
  useEffect(() => {
    if (daysMode === 'dates' && !endDateStr) {
      const d = new Date();
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      setEndDateStr(`${dd}.${mm}.${yyyy}`);
    }
  }, [daysMode, endDateStr]);

  const [userEditedCurrent, setUserEditedCurrent] = useState<boolean>(false);

  const parseMoney = (v: string) => {
    const cleaned = v.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    const normalized = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : cleaned;
    const num = parseFloat(normalized);
    return Number.isFinite(num) ? num : 0;
  };
  const formatLooseValue = (value: number) => {
    if (!Number.isFinite(value) || value <= 0) return '0';
    return value % 1 === 0 ? value.toFixed(0) : value.toString();
  };
  const formatAssetInputValue = (value: number) => {
    if (!Number.isFinite(value) || value <= 0) return '0';
    const fixed = value.toFixed(2);
    return fixed.replace(/\.?0+$/, '');
  };

  useEffect(() => {
    if (initialCurrentCapital !== undefined && !userEditedCurrent) {
      setCurrentInput(formatAssetInputValue(initialCurrentCapital));
    }
  }, [initialCurrentCapital, userEditedCurrent]);

  const start = useMemo(() => parseMoney(startInput), [startInput]);
  const current = useMemo(() => parseMoney(currentInput), [currentInput]);
  const days = useMemo(() => {
    if (daysMode === 'days') {
      const d = parseInt((daysInput || '0').replace(/\D/g, ''), 10);
      return Math.max(1, isNaN(d) ? 0 : d);
    }
    // dates mode
    const parseDDMMYYYY = (s: string): Date | null => {
      const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(s);
      if (!m) return null;
      const dd = parseInt(m[1], 10);
      const mm = parseInt(m[2], 10);
      const yyyy = parseInt(m[3], 10);
      if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
      const dt = new Date(yyyy, mm - 1, dd);
      if (dt.getFullYear() !== yyyy || dt.getMonth() !== mm - 1 || dt.getDate() !== dd) return null;
      return dt;
    };

    const s = startDateStr ? parseDDMMYYYY(startDateStr) : null;
    const e = endDateStr ? parseDDMMYYYY(endDateStr) : null;
    if (!s || !e || isNaN(s.getTime()) || isNaN(e.getTime())) return 1;
    const diffMs = e.getTime() - s.getTime();
    const d = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    return Math.max(1, d);
  }, [daysMode, daysInput, startDateStr, endDateStr]);

  const roi = useMemo(() => {
    if (start <= 0) return 0;
    return (current - start) / start;
  }, [start, current]);

  const aprPct = useMemo(() => {
    if (days <= 0) return 0;
    return roi * (365 / days) * 100;
  }, [roi, days]);

  const formatPct = (v: number) => `${(Number.isFinite(v) ? v : 0).toFixed(2)}%`;
  const formatUsd = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(Number.isFinite(v) ? v : 0);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
      {/* Left: inputs */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Start capital (USD)</Label>
          <Input
            value={startInput}
            onChange={(e) => {
              let v = e.target.value.replace(/[^0-9.]/g, '');
              const parts = v.split('.');
              if (parts.length > 2) v = parts[0] + '.' + parts.slice(1).join('');
              setStartInput(v);
            }}
            onBlur={() => {
              const num = parseMoney(startInput);
              setStartInput(formatLooseValue(num));
            }}
            className="h-12 text-lg text-right"
          />
        </div>
        <div className="space-y-2">
          <Label>Current capital (USD)</Label>
          <Input
            value={currentInput}
            onChange={(e) => {
              let v = e.target.value.replace(/[^0-9.]/g, '');
              const parts = v.split('.');
              if (parts.length > 2) v = parts[0] + '.' + parts.slice(1).join('');
              setCurrentInput(v);
              setUserEditedCurrent(true);
            }}
            onBlur={() => {
              const num = parseMoney(currentInput);
              const formatted = formatAssetInputValue(num);
              setCurrentInput(formatted);
            }}
            className="h-12 text-lg text-right"
          />
        </div>

        <div className="space-y-2">
          <Label>Period</Label>
          <div className="flex gap-2">
            <Button type="button" variant={daysMode === 'days' ? 'default' : 'outline'} size="sm" onClick={() => setDaysMode('days')}>Days</Button>
            <Button type="button" variant={daysMode === 'dates' ? 'default' : 'outline'} size="sm" onClick={() => setDaysMode('dates')}>Dates</Button>
          </div>
          {daysMode === 'days' ? (
            <Input
              value={daysInput}
              onChange={(e) => setDaysInput(e.target.value.replace(/\D/g, ''))}
              onBlur={() => setDaysInput(String(Math.max(1, parseInt(daysInput || '1', 10) || 1)))}
              className="h-12 text-lg text-right"
              placeholder="Days"
            />
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="text"
                inputMode="numeric"
                placeholder="dd.mm.yyyy"
                value={startDateStr}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^0-9.]/g, '');
                  const parts = v.split('.');
                  const normalized = parts.length > 3 ? parts.slice(0, 3).join('.') : v;
                  setStartDateStr(normalized);
                }}
                onBlur={() => {
                  const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(startDateStr);
                  if (m) {
                    const dd = String(Math.min(31, Math.max(1, parseInt(m[1], 10)))).padStart(2, '0');
                    const mm = String(Math.min(12, Math.max(1, parseInt(m[2], 10)))).padStart(2, '0');
                    const yyyy = m[3];
                    setStartDateStr(`${dd}.${mm}.${yyyy}`);
                  }
                }}
                className="h-12 text-lg"
              />
              <Input
                type="text"
                inputMode="numeric"
                placeholder="dd.mm.yyyy"
                value={endDateStr}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^0-9.]/g, '');
                  const parts = v.split('.');
                  const normalized = parts.length > 3 ? parts.slice(0, 3).join('.') : v;
                  setEndDateStr(normalized);
                }}
                onBlur={() => {
                  const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(endDateStr);
                  if (m) {
                    const dd = String(Math.min(31, Math.max(1, parseInt(m[1], 10)))).padStart(2, '0');
                    const mm = String(Math.min(12, Math.max(1, parseInt(m[2], 10)))).padStart(2, '0');
                    const yyyy = m[3];
                    setEndDateStr(`${dd}.${mm}.${yyyy}`);
                  }
                }}
                className="h-12 text-lg"
              />
            </div>
          )}
        </div>
      </div>

      {/* Right: output */}
      <div className="space-y-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">APR</span>
              <span className="text-2xl font-semibold">{formatPct(aprPct)}</span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">ROI</span>
                <span>{formatPct(roi * 100)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">PnL</span>
                <span>{formatUsd(current - start)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

