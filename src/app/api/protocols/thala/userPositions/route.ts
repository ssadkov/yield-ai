import { NextRequest, NextResponse } from 'next/server';
import { getTokenInfoWithFallback } from '@/lib/tokens/tokenRegistry';

const THALA_FARMING_ADDRESS = '0xcb8365dc9f7ac6283169598aaad7db9c7b12f52da127007f37fa4565170ff59c';
const THALA_POOL_ADDRESS = '0x075b4890de3e312d9425408c43d9a9752b64ab3562a30e89a55bdc568c645920';
const THALA_POOLS_API_URL = 'https://app.thala.fi/api/liquidity-pools';
const FULLNODE_VIEW_URL = 'https://fullnode.mainnet.aptoslabs.com/v1/view';
const APTOS_API_KEY = process.env.APTOS_API_KEY;

type PoolInfo = {
  poolAddress?: string;
  coinAddresses: string[];
  tokenASymbol?: string;
  tokenBSymbol?: string;
};

function normalizeTokenAddress(address: string): string {
  if (!address) return '';
  let cleanAddress = address.startsWith('@') ? address.slice(1) : address;
  if (cleanAddress.includes('::')) {
    const parts = cleanAddress.split('::');
    cleanAddress = parts[0];
  }
  if (!cleanAddress.startsWith('0x')) {
    cleanAddress = `0x${cleanAddress}`;
  }
  if (cleanAddress.startsWith('0x')) {
    const normalized = '0x' + cleanAddress.slice(2).replace(/^0+/, '') || '0x0';
    return normalized;
  }
  return cleanAddress;
}

async function callView(functionFullname: string, args: any[]): Promise<any> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (APTOS_API_KEY) {
    headers['Authorization'] = `Bearer ${APTOS_API_KEY}`;
  }
  const response = await fetch(FULLNODE_VIEW_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      function: functionFullname,
      type_arguments: [],
      arguments: args
    })
  });

  if (!response.ok) {
    const text = await response.text();
    console.error('[Thala] VIEW ERROR:', functionFullname, 'args:', JSON.stringify(args), '->', response.status, response.statusText, text);
    throw new Error(`VIEW ERROR ${response.status} ${response.statusText}: ${text}`);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function unwrapSingle<T>(result: any): T {
  if (Array.isArray(result) && result.length === 1) {
    return result[0] as T;
  }
  return result as T;
}

function unwrapArray(result: any): any[] {
  if (Array.isArray(result) && result.length === 1 && Array.isArray(result[0])) {
    return result[0];
  }
  return Array.isArray(result) ? result : [];
}

function parseDepositsAndPositions(result: any): { deposits: any[]; positions: any[] } {
  if (Array.isArray(result) && result.length >= 2 && Array.isArray(result[0]) && Array.isArray(result[1])) {
    return { deposits: result[0], positions: result[1] };
  }
  return { deposits: [], positions: [] };
}

function parseTokenAmount(rawAmount: string, decimals: number): number {
  const amount = parseFloat(rawAmount || '0');
  if (!decimals) return amount;
  return amount / Math.pow(10, decimals);
}

async function buildPoolsMap(): Promise<Map<string, PoolInfo>> {
  const poolMap = new Map<string, PoolInfo>();
  try {
    const response = await fetch(THALA_POOLS_API_URL, {
      headers: {
        'Accept': 'application/json'
      }
    });
    if (!response.ok) {
      console.warn('[Thala] Pools API returned', response.status);
      return poolMap;
    }
    const data = await response.json();
    const pools = Array.isArray(data?.data) ? data.data : [];
    pools.forEach((pool: any) => {
      const metadata = pool?.metadata || {};
      const lptAddress =
        metadata?.lptAddress ||
        metadata?.poolAddress ||
        pool?.lptAddress ||
        pool?.poolAddress;
      const coinAddresses = metadata?.coinAddresses || pool?.coinAddresses || [];
      if (!lptAddress) return;
      const normalized = normalizeTokenAddress(lptAddress);
      poolMap.set(normalized, {
        poolAddress: lptAddress,
        coinAddresses: Array.isArray(coinAddresses) ? coinAddresses : [],
        tokenASymbol: pool?.token_a,
        tokenBSymbol: pool?.token_b
      });
    });
  } catch (error) {
    console.warn('[Thala] Failed to load pools API:', error);
  }
  return poolMap;
}

async function getClaimableRewardAmount(
  address: string,
  positionId: string,
  rewardMeta: any,
  rewardIndex: number
): Promise<string | null> {
  const rewardToken =
    rewardMeta?.reward_token?.inner ||
    rewardMeta?.reward_token ||
    rewardMeta?.reward_coin?.inner ||
    rewardMeta?.reward_coin ||
    rewardMeta?.coin_type ||
    rewardMeta?.token?.inner ||
    rewardMeta?.token;

  const candidates = [
    [address, positionId, rewardIndex.toString()],
    rewardMeta?.reward_id ? [address, positionId, rewardMeta.reward_id] : null,
    rewardMeta?.id ? [address, positionId, rewardMeta.id] : null,
    rewardToken ? [address, positionId, rewardToken] : null
  ].filter(Boolean) as any[][];

  for (const args of candidates) {
    try {
      const result = await callView(`${THALA_FARMING_ADDRESS}::farming::claimable_reward_amount`, args);
      const claimable = unwrapSingle<string>(result);
      if (claimable !== undefined && claimable !== null) {
        return String(claimable);
      }
    } catch (error) {
      continue;
    }
  }

  return null;
}

/**
 * @swagger
 * /api/protocols/thala/userPositions:
 *   get:
 *     tags:
 *       - protocols
 *     summary: Get user positions in Thala protocol
 *     parameters:
 *       - in: query
 *         name: address
 *         required: true
 *         schema:
 *           type: string
 *         description: User wallet address
 *     responses:
 *       200:
 *         description: User positions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *       400:
 *         description: Invalid address
 *       500:
 *         description: Internal server error
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');

    if (!address) {
      return NextResponse.json({ error: 'Address parameter is required' }, { status: 400 });
    }

    console.log('🔍 Thala userPositions API called with address:', address);
    console.log('🔑 APTOS_API_KEY exists:', !!APTOS_API_KEY);

    const existsResult = await callView(`${THALA_FARMING_ADDRESS}::farming::exists_user_deposit`, [address]);
    const hasDeposits = unwrapSingle<boolean>(existsResult);

    if (!hasDeposits) {
      return NextResponse.json({ success: true, data: [] }, { status: 200 });
    }

    const poolsMap = await buildPoolsMap();

    const depositsAndPositionsResult = await callView(
      `${THALA_FARMING_ADDRESS}::farming::user_deposits_and_position_info`,
      [address]
    );

    const { deposits, positions } = parseDepositsAndPositions(depositsAndPositionsResult);

    const rewardsMetadataResult = await callView(`${THALA_FARMING_ADDRESS}::farming::rewards_metadata`, []);
    const rewardsMetadata = unwrapArray(rewardsMetadataResult);

    const formattedPositions = [];

    for (let index = 0; index < positions.length; index++) {
      const position = positions[index];
      const positionId = String(position?.position_id || '');
      const positionObjectAddress = deposits[index]?.inner || '';
      const poolObjInner = position?.pool_obj?.inner || '';
      const normalizedPool = normalizeTokenAddress(poolObjInner);
      const poolInfo = poolsMap.get(normalizedPool);
      const coinAddresses = poolInfo?.coinAddresses || [];
      const token0Address = coinAddresses[0] || '';
      const token1Address = coinAddresses[1] || '';

      const [token0Info, token1Info] = await Promise.all([
        token0Address ? getTokenInfoWithFallback(token0Address) : Promise.resolve(null),
        token1Address ? getTokenInfoWithFallback(token1Address) : Promise.resolve(null)
      ]);

      let rawAmount0 = '0';
      let rawAmount1 = '0';

      try {
        const principalArgs = positionObjectAddress ? [positionObjectAddress] : [positionId];
        const principalValueResult = await callView(
          `${THALA_POOL_ADDRESS}::pool::position_principal_value`,
          principalArgs
        );
        const principalValues = unwrapArray(principalValueResult);
        rawAmount0 = String(principalValues?.[0] ?? '0');
        rawAmount1 = String(principalValues?.[1] ?? '0');
      } catch (error) {
        console.warn('[Thala] position_principal_value failed', {
          positionId,
          positionObjectAddress
        });
      }

      const token0Decimals = token0Info?.decimals ?? 8;
      const token1Decimals = token1Info?.decimals ?? 8;
      const token0Amount = parseTokenAmount(rawAmount0, token0Decimals);
      const token1Amount = parseTokenAmount(rawAmount1, token1Decimals);
      const token0Price = parseFloat(token0Info?.usdPrice || '0');
      const token1Price = parseFloat(token1Info?.usdPrice || '0');
      const token0Value = token0Amount * token0Price;
      const token1Value = token1Amount * token1Price;
      const positionValueUSD = token0Value + token1Value;

      const rewards = [];
      let rewardsValueUSD = 0;

      for (let i = 0; i < rewardsMetadata.length; i++) {
        const rewardMeta = rewardsMetadata[i];
        const claimableRaw = await getClaimableRewardAmount(address, positionId, rewardMeta, i);
        if (!claimableRaw || claimableRaw === '0') continue;

        const rewardTokenAddress =
          rewardMeta?.reward_token?.inner ||
          rewardMeta?.reward_token ||
          rewardMeta?.reward_coin?.inner ||
          rewardMeta?.reward_coin ||
          rewardMeta?.coin_type ||
          rewardMeta?.token?.inner ||
          rewardMeta?.token ||
          '';

        const rewardTokenInfo = rewardTokenAddress ? await getTokenInfoWithFallback(rewardTokenAddress) : null;
        const rewardDecimals = rewardTokenInfo?.decimals ?? 8;
        const rewardAmount = parseTokenAmount(claimableRaw, rewardDecimals);
        const rewardPrice = parseFloat(rewardTokenInfo?.usdPrice || '0');
        const rewardValue = rewardAmount * rewardPrice;
        rewardsValueUSD += rewardValue;

        rewards.push({
          tokenAddress: rewardTokenAddress,
          symbol: rewardTokenInfo?.symbol || rewardMeta?.symbol || 'Unknown',
          name: rewardTokenInfo?.name || rewardMeta?.name || 'Unknown',
          decimals: rewardDecimals,
          logoUrl: rewardTokenInfo?.logoUrl || null,
          amountRaw: claimableRaw,
          amount: rewardAmount,
          priceUSD: rewardPrice,
          valueUSD: rewardValue
        });
      }

      formattedPositions.push({
        positionId,
        poolAddress: poolObjInner,
        token0: {
          address: token0Address,
          symbol: token0Info?.symbol || poolInfo?.tokenASymbol || 'Unknown',
          name: token0Info?.name || poolInfo?.tokenASymbol || 'Unknown',
          decimals: token0Decimals,
          logoUrl: token0Info?.logoUrl || null,
          amountRaw: rawAmount0,
          amount: token0Amount,
          priceUSD: token0Price,
          valueUSD: token0Value
        },
        token1: {
          address: token1Address,
          symbol: token1Info?.symbol || poolInfo?.tokenBSymbol || 'Unknown',
          name: token1Info?.name || poolInfo?.tokenBSymbol || 'Unknown',
          decimals: token1Decimals,
          logoUrl: token1Info?.logoUrl || null,
          amountRaw: rawAmount1,
          amount: token1Amount,
          priceUSD: token1Price,
          valueUSD: token1Value
        },
        inRange: token0Amount > 0 && token1Amount > 0,
        rewards,
        positionValueUSD,
        rewardsValueUSD,
        totalValueUSD: positionValueUSD + rewardsValueUSD,
        rawPosition: position
      });
    }

    return NextResponse.json(
      {
        success: true,
        data: formattedPositions
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=3, s-maxage=3, stale-while-revalidate=6',
          'Cdn-Cache-Control': 'max-age=3',
          'Surrogate-Control': 'max-age=3'
        }
      }
    );
  } catch (error) {
    console.error('❌ Thala user positions error:', error);
    return NextResponse.json(
      {
        success: true,
        data: []
      },
      { status: 200 }
    );
  }
}
