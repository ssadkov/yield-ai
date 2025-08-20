import { useEffect, useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { getProtocolByName } from "@/lib/protocols/getProtocolsList";
import Image from "next/image";
import tokenList from "@/lib/data/tokenList.json";
import { useCollapsible } from "@/contexts/CollapsibleContext";

interface PositionsListProps {
  address?: string;
  onPositionsValueChange?: (value: number) => void;
  onPositionsCheckComplete?: () => void;
}

type RewardsEntry = { tokenKey: string; amountRaw: string };

function findToken(address: string) {
  const addr = address?.toLowerCase();
  const tokens = (tokenList as any).data?.data || [];
  const found = tokens.find((t: any) => {
    const fa = t.faAddress ? t.faAddress.toLowerCase() : null;
    const coin = t.tokenAddress ? t.tokenAddress.toLowerCase() : null;
    return fa === addr || coin === addr;
  });
  if (found) return found;
  // Hardcoded fallback for USE token (as in test-earnium)
  if (addr === '0xcd94610565e131c1d8507ed46fccc6d0b64304fc2946fbfceb4420922d7d8b24') {
    return {
      symbol: 'USE',
      name: 'USE Token',
      decimals: 8,
      logoUrl: 'https://img.earnium.io/USE.png',
      faAddress: address,
      tokenAddress: address,
    };
  }
  return undefined as any;
}

function normalizePriceMap(list: any[]): Record<string, number> {
  const map: Record<string, number> = {};
  (list || []).forEach((t: any) => {
    const keyA = (t.faAddress || '').toLowerCase();
    const keyB = (t.tokenAddress || '').toLowerCase();
    const price = t.usdPrice ? Number(t.usdPrice) : 0;
    if (keyA) map[keyA] = price;
    if (keyB) map[keyB] = price;
  });
  return map;
}

export function PositionsList({ address, onPositionsValueChange, onPositionsCheckComplete }: PositionsListProps) {
  const { account } = useWallet();
  const walletAddress = address || account?.address?.toString();
  const protocol = getProtocolByName("Earnium");
  const { isExpanded, toggleSection } = useCollapsible();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalValue, setTotalValue] = useState(0);
  const [pools, setPools] = useState<any[]>([]);
  const [icons, setIcons] = useState<{ logo: string; symbol: string }[]>([]);
  const [rewardsSummary, setRewardsSummary] = useState<{ totalUSD: number; items: { symbol: string; amount: number; usd: number }[] }>({ totalUSD: 0, items: [] });

  useEffect(() => {
    async function load() {
      if (!walletAddress) {
        onPositionsCheckComplete?.();
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const resp = await fetch(`/api/protocols/earnium/rewards?address=${walletAddress}`);
        const json = await resp.json();
        const data: any[] = Array.isArray(json.data) ? json.data : [];

        // Collect pools with stake (strict)
        const stakedPools = data.filter((p) => {
          try {
            const v = BigInt(p?.stakedRaw ?? '0');
            const zero = BigInt(0);
            return v > zero;
          } catch {
            return false;
          }
        });

        // For each pool, fetch pool balances to know underlying tokens
        const poolsWithBalances: any[] = [];
        for (const p of stakedPools) {
          const owner = p.lp?.metadataId || p.poolAddress;
          if (!owner) continue;
          const bRes = await fetch('/api/aptos/balances', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address: owner })
          });
          const bJson = await bRes.json();
          const balances: any[] = bJson?.data?.balances || [];
          poolsWithBalances.push({ ...p, balances });
        }

        // Build list of price addresses
        const addrSet = new Set<string>();
        const addAddr = (s?: string) => { if (s) addrSet.add(s.toLowerCase()); };

        poolsWithBalances.forEach((p) => {
          (p.balances || []).forEach((b: any) => {
            const t = findToken(b.asset_type);
            if (t?.faAddress) addAddr(t.faAddress);
            if (t?.tokenAddress) addAddr(t.tokenAddress);
          });
          // rewards
          (p.rewards || []).forEach((r: RewardsEntry) => {
            const t = findToken(r.tokenKey);
            if (t?.faAddress) addAddr(t.faAddress);
            if (t?.tokenAddress) addAddr(t.tokenAddress);
          });
        });

        const priceAddrs = Array.from(addrSet);
        let priceMap: Record<string, number> = {};
        if (priceAddrs.length > 0) {
          const pricesRes = await fetch(`/api/panora/tokenPrices?chainId=1&tokenAddress=${encodeURIComponent(priceAddrs.join(','))}`);
          const pricesJson = await pricesRes.json();
          priceMap = normalizePriceMap(pricesJson?.data || []);
        }

        // Compute USD totals
        let positionsUSD = 0;
        const headerIcons: { logo: string; symbol: string }[] = [];
        const enrichedPools: any[] = [];
        poolsWithBalances.forEach((p) => {
          const totalSupplyRaw = (() => { try { return BigInt(p.lp?.totalSupplyRaw || '0'); } catch { return BigInt(0); } })();
          const stakedRaw = (() => { try { return BigInt(p.stakedRaw || '0'); } catch { return BigInt(0); } })();
          if (stakedRaw <= BigInt(0)) return;
          let poolUserUSD = 0;
          const tokens: { logo?: string; symbol: string; amount: number; usd: number }[] = [];
          const pairSet: { logo?: string; symbol: string }[] = [];
          (p.balances || []).forEach((b: any) => {
            const t = findToken(b.asset_type);
            const decimals = typeof t?.decimals === 'number' ? t.decimals : 8;
            const addrA = (t?.faAddress || '').toLowerCase();
            const addrB = (t?.tokenAddress || '').toLowerCase();
            const price = addrA ? (priceMap[addrA] || 0) : (priceMap[addrB] || 0);
            const poolAmountRaw = (() => { try { return BigInt(b.amount || '0'); } catch { return BigInt(0); } })();
            const userAmountRaw = totalSupplyRaw > BigInt(0) ? (poolAmountRaw * stakedRaw) / totalSupplyRaw : BigInt(0);
            const userAmount = Number(userAmountRaw) / Math.pow(10, decimals);
            const usd = userAmount * price;
            poolUserUSD += usd;
            const sym = t?.symbol || b.asset_type;
            const logo = t?.logoUrl;
            tokens.push({ logo, symbol: sym, amount: userAmount, usd });
            // Collect pair symbols/icons (unique by symbol)
            if (sym && !pairSet.find((x) => x.symbol === sym)) pairSet.push({ logo, symbol: sym });
            // Collect icons
            if (t?.logoUrl) headerIcons.push({ logo: t.logoUrl, symbol: t.symbol });
          });
          positionsUSD += poolUserUSD;
          const pairSymbols = pairSet.map((x) => x.symbol).slice(0, 2);
          const pairIcons = pairSet.map((x) => x.logo).filter(Boolean).slice(0, 2);
          enrichedPools.push({ ...p, tokens, poolUserUSD, pairSymbols, pairIcons });
        });

        // Rewards USD
        let rewardsUSD = 0;
        const rewardsItemsMap: Record<string, { symbol: string; amount: number; usd: number }> = {};
        poolsWithBalances.forEach((p) => {
          (p.rewards || []).forEach((r: any) => {
            const t = findToken(r.tokenKey);
            const decimals = typeof t?.decimals === 'number' ? t.decimals : 8;
            const addrA = (t?.faAddress || '').toLowerCase();
            const addrB = (t?.tokenAddress || '').toLowerCase();
            const price = addrA ? (priceMap[addrA] || 0) : (priceMap[addrB] || 0);
            const amountHuman = Number(r.amountRaw || '0') / Math.pow(10, decimals);
            rewardsUSD += amountHuman * price;
            if (t?.logoUrl) headerIcons.push({ logo: t.logoUrl, symbol: t.symbol });
            const sym = t?.symbol || r.tokenKey;
            if (!rewardsItemsMap[sym]) rewardsItemsMap[sym] = { symbol: sym, amount: 0, usd: 0 };
            rewardsItemsMap[sym].amount += amountHuman;
            rewardsItemsMap[sym].usd += amountHuman * price;
          });
        });

        const total = positionsUSD + rewardsUSD;
        setTotalValue(total);
        onPositionsValueChange?.(total);
        setPools(enrichedPools);
        setRewardsSummary({ totalUSD: rewardsUSD, items: Object.values(rewardsItemsMap) });

        // unique icons top 4
        const uniq: { [k: string]: boolean } = {};
        const uniqIcons = headerIcons.filter((x) => {
          if (uniq[x.symbol]) return false;
          uniq[x.symbol] = true;
          return true;
        }).slice(0, 4);
        setIcons(uniqIcons);
      } catch (e) {
        setError('Failed to load Earnium positions');
      } finally {
        setLoading(false);
        onPositionsCheckComplete?.();
      }
    }
    load();
  }, [walletAddress]);

  if (loading) return null;
  if (error) return null;
  if (totalValue <= 0) return null;

  return (
    <Card className="w-full h-full flex flex-col">
      <CardHeader 
        className="py-2 cursor-pointer hover:bg-accent/50 transition-colors"
        onClick={() => toggleSection('earnium')}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {protocol && (
              <div className="w-5 h-5 relative">
                <Image 
                  src={protocol.logoUrl} 
                  alt={protocol.name}
                  width={20}
                  height={20}
                  className="object-contain"
                />
              </div>
            )}
            <CardTitle className="text-lg">Earnium</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-lg">${totalValue.toFixed(2)}</div>
            <ChevronDown className={cn(
              "h-5 w-5 transition-transform",
              isExpanded('earnium') ? "transform rotate-0" : "transform -rotate-90"
            )} />
          </div>
        </div>
      </CardHeader>

      {isExpanded('earnium') && (
        <CardContent className="flex-1 overflow-y-auto px-3 pt-0">
          <ScrollArea className="h-full">
            {/* Пулы: токены и сумма по пулу (доля пользователя) */}
            {pools.map((p, idx) => (
              <div key={idx} className="mb-2">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-2">
                      {(p.pairIcons || []).map((logo: string, i: number) => (
                        <Image key={i} src={logo} alt={p.pairSymbols?.[i] || 'token'} width={18} height={18} className="rounded ring-1 ring-background object-contain" />
                      ))}
                    </div>
                    <div className="font-medium">{(p.pairSymbols || []).join(' / ') || `Pool #${p.pool}`}</div>
                  </div>
                  <div className="font-medium">${(p.poolUserUSD || 0).toFixed(2)}</div>
                </div>
              </div>
            ))}

            {/* Rewards */}
            <div className="mt-2 pt-2 border-t">
              <div className="flex items-center justify-between text-sm">
                <div className="font-medium">
                  Total Rewards
                  <span className="ml-2 text-xs text-muted-foreground">({rewardsSummary.items.length})</span>
                </div>
                <div className="font-medium">${rewardsSummary.totalUSD.toFixed(2)}</div>
              </div>
              <div className="mt-1 space-y-1 text-xs text-muted-foreground">
                {rewardsSummary.items.map((it, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span>{it.symbol}</span>
                    <div>
                      <span className="mr-2">{it.amount.toFixed(4)}</span>
                      <span>${it.usd.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </ScrollArea>
        </CardContent>
      )}
    </Card>
  );
}


