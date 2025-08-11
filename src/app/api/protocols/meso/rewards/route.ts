import { NextRequest, NextResponse } from 'next/server';
import { createErrorResponse } from '@/lib/utils/http';
import tokenList from '@/lib/data/tokenList.json';
import { PanoraPricesService } from '@/lib/services/panora/prices';

type Side = 'supply' | 'borrow';

interface RewardItem {
  side: Side;
  poolInner: string;
  rewardPoolInner: string;
  tokenAddress: string;
  amountRaw: string;
  amount: number;
  decimals: number;
  symbol: string;
  name: string;
  logoUrl?: string | null;
  price?: string | null;
  usdValue: number;
}

async function callView(functionFullname: string, args: any[]): Promise<any> {
  const url = 'https://fullnode.mainnet.aptoslabs.com/v1/view';
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ function: functionFullname, type_arguments: [], arguments: args })
  });
  if (!res.ok) throw new Error(`View call failed: ${res.status} ${res.statusText}`);
  return res.json();
}

function normalizeKeyValue(resp: any): Array<{ key: any; value: string }> {
  if (!resp) return [];
  if (Array.isArray(resp)) {
    if (resp.length > 0 && Array.isArray(resp[0]?.data)) return resp[0].data;
    return resp as any[];
  }
  if (resp.data && Array.isArray(resp.data)) return resp.data;
  return [];
}

function getTokenMeta(tokenAddr: string) {
  const token = (tokenList as any).data?.data?.find((t: any) => t.tokenAddress === tokenAddr || t.faAddress === tokenAddr);
  return {
    symbol: token?.symbol || (tokenAddr.split('::').pop() || 'UNKNOWN'),
    name: token?.name || tokenAddr,
    decimals: token?.decimals ?? 8,
    logoUrl: token?.logoUrl || null
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');
    if (!address) {
      return NextResponse.json(createErrorResponse(new Error('Address parameter is required')), { status: 400 });
    }

    const pkg = '0x68476f9d437e3f32fd262ba898b5e3ee0a23a1d586a6cf29a28add35f253f6f7';

    // 1) Fetch user pools
    const [supplyPoolsResp, borrowAmountsResp] = await Promise.all([
      callView(`${pkg}::lending_pool::asset_amounts`, [address]),
      callView(`${pkg}::lending_pool::debt_amounts`, [address])
    ]);

    const supplyPairs = normalizeKeyValue(supplyPoolsResp) // { key: {inner}, value }
      .map(x => ({ poolInner: (typeof x.key === 'string' ? x.key : x.key?.inner) as string, amountRaw: x.value }))
      .filter(x => !!x.poolInner && x.amountRaw !== '0');

    const borrowPairs = normalizeKeyValue(borrowAmountsResp)
      .map(x => ({ poolInner: (typeof x.key === 'string' ? x.key : x.key?.inner) as string, amountRaw: x.value }))
      .filter(x => !!x.poolInner && x.amountRaw !== '0');

    const poolInners = Array.from(new Set<string>([
      ...supplyPairs.map(p => p.poolInner),
      ...borrowPairs.map(p => p.poolInner)
    ]));

    // 2) Fetch lending_pool_info for each pool
    const poolInfoByInner: Record<string, any> = {};
    await Promise.all(poolInners.map(async (inner) => {
      try {
        const info = await callView(`${pkg}::lending_pool::lending_pool_info`, [inner]);
        // Normalize possible shapes
        const obj = Array.isArray(info) ? info[0] || info : info;
        poolInfoByInner[inner] = obj;
      } catch (e) {
        // ignore individual errors
      }
    }));

    // 3) Build reward queries
    type RewardQuery = { side: Side; poolInner: string; rewardPoolInner: string; tokenAddress: string };
    const rewardQueries: RewardQuery[] = [];

    for (const p of supplyPairs) {
      const info = poolInfoByInner[p.poolInner];
      const rewardPoolInner = info?.supply_rewards_pool?.inner;
      const tokenAddress = info?.token; // token of the lending pool
      if (rewardPoolInner && tokenAddress) {
        rewardQueries.push({ side: 'supply', poolInner: p.poolInner, rewardPoolInner, tokenAddress });
      }
    }
    for (const p of borrowPairs) {
      const info = poolInfoByInner[p.poolInner];
      const rewardPoolInner = info?.borrow_rewards_pool?.inner;
      const tokenAddress = info?.token;
      if (rewardPoolInner && tokenAddress) {
        rewardQueries.push({ side: 'borrow', poolInner: p.poolInner, rewardPoolInner, tokenAddress });
      }
    }

    // 4) Fetch claimable rewards per reward pool
    const rewardsRaw = await Promise.all(rewardQueries.map(async (q) => {
      try {
        const resp = await callView(`${pkg}::rewards_pool::claimable_rewards`, [address, q.rewardPoolInner]);
        // Response may be number string or array
        const value = Array.isArray(resp) ? String(resp[0]) : String(resp);
        return { ...q, amountRaw: value };
      } catch (e) {
        return { ...q, amountRaw: '0' };
      }
    }));

    // 5) Price rewards
    const uniqueTokenAddrs = Array.from(new Set(rewardsRaw.map(r => r.tokenAddress)));
    const pricesService = PanoraPricesService.getInstance();
    const pricesResp = await pricesService.getPrices(1, uniqueTokenAddrs);
    const prices = pricesResp.data || [];

    // Hardcode rewards token as APT for now
    const APT = '0x1::aptos_coin::AptosCoin';
    const aptMeta = getTokenMeta(APT);

    const rewards: RewardItem[] = rewardsRaw.map((r) => {
      const meta = aptMeta; // override token meta to APT
      const amount = Number(BigInt(r.amountRaw)) / Math.pow(10, meta.decimals);
      const priceObj = prices.find((p: any) => p.tokenAddress === APT || p.faAddress === APT);
      const price = priceObj?.usdPrice || null;
      const usdValue = price ? amount * parseFloat(price) : 0;
      return {
        side: r.side,
        poolInner: r.poolInner,
        rewardPoolInner: r.rewardPoolInner,
        tokenAddress: APT,
        amountRaw: r.amountRaw,
        amount,
        decimals: meta.decimals,
        symbol: meta.symbol,
        name: meta.name,
        logoUrl: meta.logoUrl,
        price,
        usdValue
      };
    });

    const totalUsd = rewards.reduce((sum, x) => sum + x.usdValue, 0);
    return NextResponse.json({ success: true, rewards, totalUsd });
  } catch (error) {
    console.error('Error in Meso rewards route:', error);
    if (error instanceof Error) {
      return NextResponse.json(createErrorResponse(error), { status: 500 });
    }
    return NextResponse.json(createErrorResponse(new Error('Internal server error')), { status: 500 });
  }
}


