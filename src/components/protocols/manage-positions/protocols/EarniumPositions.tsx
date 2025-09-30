"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import tokenList from "@/lib/data/tokenList.json";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";

function findToken(address: string) {
  const addr = address?.toLowerCase();
  const tokens = (tokenList as any).data?.data || [];
  const found = tokens.find((t: any) => {
    const fa = t.faAddress ? t.faAddress.toLowerCase() : null;
    const coin = t.tokenAddress ? t.tokenAddress.toLowerCase() : null;
    return fa === addr || coin === addr;
  });
  if (found) return found;
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

export function EarniumPositionsManaging() {
  const { account, signAndSubmitTransaction } = useWallet();
  const [pools, setPools] = useState<any[]>([]);
  const [rewardsUSD, setRewardsUSD] = useState(0);
  const [claiming, setClaiming] = useState(false);
  const [poolsData, setPoolsData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!account?.address) return;
    
    try {
      setLoading(true);
      
      // Загружаем данные о наградах
      const resp = await fetch(`/api/protocols/earnium/rewards?address=${account.address}`);
      const json = await resp.json();
      const data: any[] = Array.isArray(json.data) ? json.data : [];
      
      // Загружаем данные о пулах с APR
      const poolsResp = await fetch('/api/protocols/earnium/pools');
      const poolsJson = await poolsResp.json();
      const poolsData: any[] = Array.isArray(poolsJson.data) ? poolsJson.data : [];
      setPoolsData(poolsData);

    const stakedPools = data.filter((p) => { try { return BigInt(p?.stakedRaw ?? '0') > BigInt(0); } catch { return false; } });
    const poolsWithBalances: any[] = [];
    for (const p of stakedPools) {
      const owner = p.lp?.metadataId || p.poolAddress;
      if (!owner) continue;
      const bRes = await fetch('/api/aptos/balances', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address: owner }) });
      const bJson = await bRes.json();
      const balances: any[] = bJson?.data?.balances || [];
      poolsWithBalances.push({ ...p, balances });
    }

    const addrSet = new Set<string>();
    const addAddr = (s?: string) => { if (s) addrSet.add(s.toLowerCase()); };
    poolsWithBalances.forEach((p) => {
      (p.balances || []).forEach((b: any) => {
        const t = findToken(b.asset_type); if (t?.faAddress) addAddr(t.faAddress); if (t?.tokenAddress) addAddr(t.tokenAddress);
      });
      (p.rewards || []).forEach((r: any) => { const t = findToken(r.tokenKey); if (t?.faAddress) addAddr(t.faAddress); if (t?.tokenAddress) addAddr(t.tokenAddress); });
    });
    const priceAddrs = Array.from(addrSet);
    let priceMap: Record<string, number> = {};
    if (priceAddrs.length > 0) {
      const pricesRes = await fetch(`/api/panora/tokenPrices?chainId=1&tokenAddress=${encodeURIComponent(priceAddrs.join(','))}`);
      const pricesJson = await pricesRes.json();
      priceMap = normalizePriceMap(pricesJson?.data || []);
    }

    const enriched: any[] = [];
    let totalRewards = 0;
    poolsWithBalances.forEach((p) => {
      const totalSupplyRaw = (() => { try { return BigInt(p.lp?.totalSupplyRaw || '0'); } catch { return BigInt(0); } })();
      const stakedRaw = (() => { try { return BigInt(p.stakedRaw || '0'); } catch { return BigInt(0); } })();
      if (stakedRaw <= BigInt(0)) return;
      let poolUserUSD = 0;
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
        const sym = t?.symbol || b.asset_type; const logo = t?.logoUrl;
        if (sym && !pairSet.find((x) => x.symbol === sym)) pairSet.push({ logo, symbol: sym });
      });
             const pairSymbols = pairSet.map((x) => x.symbol).slice(0, 3);
       const pairIcons = pairSet.map((x) => x.logo).filter(Boolean).slice(0, 3);
       enriched.push({ pairSymbols, pairIcons, poolUserUSD, rewards: p.rewards });

      // rewards USD
      (p.rewards || []).forEach((r: any) => {
        const t = findToken(r.tokenKey); const decimals = typeof t?.decimals === 'number' ? t.decimals : 8;
        const addrA = (t?.faAddress || '').toLowerCase(); const addrB = (t?.tokenAddress || '').toLowerCase();
        const price = addrA ? (priceMap[addrA] || 0) : (priceMap[addrB] || 0);
        const amountHuman = Number(r.amountRaw || '0') / Math.pow(10, decimals);
        totalRewards += amountHuman * price;
      });
    });
    setPools(enriched);
    setRewardsUSD(totalRewards);
    
    } catch (error) {
      console.error('Error loading Earnium data:', error);
    } finally {
      setLoading(false);
    }
  }, [account?.address]);

  useEffect(() => { load(); }, [load]);

  // Подписка на глобальное событие обновления позиций
  useEffect(() => {
    const handleRefresh = (event: CustomEvent) => {
      console.log('🔍 EarniumPositionsManaging - Received refreshPositions event:', event.detail);
      
      if (event.detail?.protocol === 'earnium') {
        console.log('🔍 EarniumPositionsManaging - Protocol matches earnium, refreshing data');
        // Перезагружаем данные
        load();
      }
    };

    window.addEventListener('refreshPositions', handleRefresh as unknown as EventListener);
    return () => {
      window.removeEventListener('refreshPositions', handleRefresh as unknown as EventListener);
    };
  }, [load]);

  const claimAll = async () => {
    if (!signAndSubmitTransaction) return;
    try {
      setClaiming(true);
      const functionAddress = '0x7c92a9636a412407aaede35eb2654d176477c00a47bc11ea3338d1f571ec95bc';
      const payload = {
        function: `${functionAddress}::premium_staked_pool::claim_all_rewards` as `${string}::${string}::${string}`,
        typeArguments: [] as string[],
        functionArguments: [[0,1,2,3]] as any[]
      } as const;
      await signAndSubmitTransaction({ data: payload } as any);
    } finally {
      setClaiming(false);
    }
  };

  if (loading) {
    return <div className="text-center py-4">Loading Earnium positions...</div>;
  }

  if (!account?.address || (pools.length === 0 && rewardsUSD === 0)) return null;

  return (
    <TooltipProvider>
      <div className="w-full mb-6 py-2">
        <div className="space-y-4">
          {pools.map((p, i) => {
            // Находим соответствующий пул с APR
            const poolInfo = poolsData.find(pool => {
              const poolSymbols = pool.asset?.split('/') || [];
              const positionSymbols = p.pairSymbols || [];
              return poolSymbols.length === positionSymbols.length && 
                     poolSymbols.every((symbol: string) => positionSymbols.includes(symbol));
            });
            
            const apr = poolInfo?.totalAPY || 0;
            
            return (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-2">
                    {(p.pairIcons || []).map((logo: string, idx: number) => (
                      <Image key={idx} src={logo} alt={p.pairSymbols?.[idx] || 'token'} width={30} height={30} className="rounded ring-1 ring-background object-contain" />
                    ))}
                  </div>
                  <div className="text-lg font-medium">{(p.pairSymbols || []).join(' / ') || 'Pool'}</div>
                </div>
                <div className="flex items-center gap-2">
                  {apr > 0 && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20 text-xs font-normal px-2 py-0.5 h-5 cursor-help">
                          APR: {apr.toFixed(2)}%
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent className="bg-black text-white border-gray-700 max-w-xs">
                        <div className="space-y-1">
                          <div className="text-xs font-semibold mb-1">APR Breakdown:</div>
                          {poolInfo?.aprBreakdown?.breakdown && (
                            <>
                              {(typeof poolInfo.aprBreakdown.breakdown.tradingFees === 'number' && poolInfo.aprBreakdown.breakdown.tradingFees > 0) && (
                                <div className="flex justify-between">
                                  <span className="text-xs">Trading Fees:</span>
                                  <span className="text-xs text-green-400">{poolInfo.aprBreakdown.breakdown.tradingFees.toFixed(2)}%</span>
                                </div>
                              )}
                              {(typeof poolInfo.aprBreakdown.breakdown.rewards === 'number' && poolInfo.aprBreakdown.breakdown.rewards > 0) && (
                                <div className="flex justify-between">
                                  <span className="text-xs">Rewards:</span>
                                  <span className="text-xs text-yellow-400">{poolInfo.aprBreakdown.breakdown.rewards.toFixed(2)}%</span>
                                </div>
                              )}
                              {(typeof poolInfo.aprBreakdown.breakdown.subPoolRewards === 'number' && poolInfo.aprBreakdown.breakdown.subPoolRewards > 0) && (
                                <div className="flex justify-between">
                                  <span className="text-xs">SubPool Rewards:</span>
                                  <span className="text-xs text-blue-400">{poolInfo.aprBreakdown.breakdown.subPoolRewards.toFixed(2)}%</span>
                                </div>
                              )}
                            </>
                          )}
                          <div className="border-t border-gray-600 pt-1 mt-1">
                            <div className="flex justify-between font-semibold">
                              <span className="text-xs">Total:</span>
                              <span className="text-xs text-white">{apr.toFixed(2)}%</span>
                            </div>
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  )}
                  <div className="text-lg font-bold">${(p.poolUserUSD || 0).toFixed(2)}</div>
                </div>
              </div>
            );
          })}


      </div>

      {/* Desktop layout - Total Assets */}
      <div className="hidden md:flex items-center justify-between pt-6 pb-6">
        <span className="text-xl">Total assets in Earnium:</span>
        <div className="text-right">
          <span className="text-xl text-primary font-bold">${(pools.reduce((sum, p) => sum + (p.poolUserUSD || 0), 0) + rewardsUSD).toFixed(2)}</span>
          {rewardsUSD > 0 && (
            <div className="text-sm text-muted-foreground mt-1 flex flex-col items-end gap-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1 cursor-help">
                      <span>💰</span>
                      <span>including rewards ${rewardsUSD.toFixed(2)}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="bg-black text-white border-gray-700">
                    <div className="space-y-1 text-xs">
                      <div className="text-center">Total unclaimed rewards</div>
                      <div className="border-t border-gray-600 pt-1 mt-1">
                        {pools.map((p, i) => (
                          p.rewards?.map((r: any, j: number) => {
                            const t = findToken(r.tokenKey);
                            const decimals = typeof t?.decimals === 'number' ? t.decimals : 8;
                            const amountHuman = Number(r.amountRaw || '0') / Math.pow(10, decimals);
                            return (
                              <div key={`${i}-${j}`} className="flex items-center justify-between gap-6">
                                <span>{t?.symbol || 'Unknown'}</span>
                                <div>
                                  <span className="mr-2">{amountHuman.toFixed(4)}</span>
                                </div>
                              </div>
                            );
                          })
                        )).flat()}
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}
        </div>
      </div>

      {/* Mobile layout - Total Assets */}
      <div className="md:hidden pt-6 pb-6 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-lg">Total assets in Earnium:</span>
          <span className="text-lg text-primary font-bold">${(pools.reduce((sum, p) => sum + (p.poolUserUSD || 0), 0) + rewardsUSD).toFixed(2)}</span>
        </div>
        {rewardsUSD > 0 && (
          <div className="space-y-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="text-sm text-muted-foreground flex items-center gap-1 cursor-help">
                    <span>💰</span>
                    <span>including rewards ${rewardsUSD.toFixed(2)}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent className="bg-black text-white border-gray-700">
                  <div className="space-y-1 text-xs">
                    <div className="text-center">Total unclaimed rewards</div>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}
      </div>
      {rewardsUSD > 0 && (
          <div className="space-y-2">
 
            <div className="flex justify-end">
              <button
                className="px-3 py-1 bg-green-600 text-white rounded text-sm font-semibold disabled:opacity-60"
                onClick={claimAll}
                disabled={claiming}
              >
                {claiming ? 'Claiming...' : 'Claim rewards'}
              </button>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}


