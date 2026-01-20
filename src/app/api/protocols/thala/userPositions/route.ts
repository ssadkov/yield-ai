import { NextRequest, NextResponse } from 'next/server';
import { normalizeAddress } from '@/lib/utils/addressNormalization';
import { PanoraPricesService } from '@/lib/services/panora/prices';

const THALA_FARMING_ADDRESS = '0xcb8365dc9f7ac6283169598aaad7db9c7b12f52da127007f37fa4565170ff59c';
const THALA_POOL_ADDRESS = '0x075b4890de3e312d9425408c43d9a9752b64ab3562a30e89a55bdc568c645920';
const THALA_POOLS_API_URL = 'https://app.thala.fi/api/liquidity-pools';
const FULLNODE_VIEW_URL = 'https://fullnode.mainnet.aptoslabs.com/v1/view';
const INDEXER_GRAPHQL_URL = 'https://indexer.mainnet.aptoslabs.com/v1/graphql';
const APTOS_API_KEY = process.env.APTOS_API_KEY;

type PoolInfo = {
  poolAddress?: string;
  coinAddresses: string[];
  tokenASymbol?: string;
  tokenBSymbol?: string;
  apr?: number; // decimal (e.g. 0.05 = 5%)
  aprSources?: any[];
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

async function getNonStakedThalaPositionAddresses(ownerAddress: string): Promise<string[]> {
  if (!ownerAddress) return [];

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (APTOS_API_KEY) {
    headers['Authorization'] = `Bearer ${APTOS_API_KEY}`;
  }

  const query = `
    query GetThalaCLTokens($owner: String!) {
      current_token_ownerships_v2(
        where: {
          owner_address: { _eq: $owner }
          amount: { _gt: "0" }
          current_token_data: { token_name: { _like: "ThalaSwapCLToken:%" } }
        }
      ) {
        storage_id
        current_token_data { token_name }
      }
    }
  `;

  try {
    const resp = await fetch(INDEXER_GRAPHQL_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, variables: { owner: ownerAddress } })
    });
    if (!resp.ok) {
      const text = await resp.text();
      console.warn('[Thala] Indexer GraphQL error:', resp.status, resp.statusText, text);
      return [];
    }
    const json = await resp.json();
    const rows = json?.data?.current_token_ownerships_v2 || [];
    return rows
      .map((r: any) => String(r?.storage_id || ''))
      .filter((x: string) => !!x);
  } catch (e) {
    console.warn('[Thala] Failed to query indexer for non-staked positions:', e);
    return [];
  }
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

      // Pools API may return APR sources array; compute total APR as decimal
      const aprSources = Array.isArray(pool?.apr) ? pool.apr : [];
      const totalApr = aprSources.reduce((sum: number, s: any) => sum + (Number(s?.apr) || 0), 0);

      const normalized = normalizeTokenAddress(lptAddress);
      poolMap.set(normalized, {
        poolAddress: lptAddress,
        coinAddresses: Array.isArray(coinAddresses) ? coinAddresses : [],
        tokenASymbol: pool?.token_a,
        tokenBSymbol: pool?.token_b,
        apr: totalApr,
        aprSources
      });
    });
  } catch (error) {
    console.warn('[Thala] Failed to load pools API:', error);
  }
  return poolMap;
}

/**
 * Get active incentives for a position
 * @param positionAddress - Position object address
 * @returns Array of incentive addresses
 */
async function getActiveIncentivesByToken(positionAddress: string): Promise<string[]> {
  if (!positionAddress) return [];

  try {
    const result = await callView(`${THALA_FARMING_ADDRESS}::farming::active_incentives_by_token`, [
      positionAddress
    ]);
    const incentives = unwrapArray(result);
    return incentives
      .map((inc: any) => inc?.inner || inc)
      .filter((addr: string) => typeof addr === 'string' && addr.length > 0);
  } catch (error) {
    console.warn('[Thala] Failed to get active incentives for position:', positionAddress, error);
    return [];
  }
}

/**
 * Get pending reward info for a position and incentive
 * @param positionAddress - Position object address
 * @param incentiveAddress - Incentive address
 * @returns Object with rewardAmount (first number) and secondNumber (second number, unused)
 */
async function getPendingRewardInfo(
  positionAddress: string,
  incentiveAddress: string
): Promise<{ rewardAmount: string; secondNumber: string } | null> {
  if (!positionAddress || !incentiveAddress) return null;

  try {
    const result = await callView(`${THALA_FARMING_ADDRESS}::farming::pending_reward_info`, [
      positionAddress,
      incentiveAddress
    ]);
    const values = unwrapArray(result);
    if (Array.isArray(values) && values.length >= 2) {
      return {
        rewardAmount: String(values[0] || '0'),
        secondNumber: String(values[1] || '0')
      };
    }
  } catch (error) {
    console.warn('[Thala] Failed to get pending reward info:', { positionAddress, incentiveAddress }, error);
    return null;
  }

  return null;
}

async function getTokenInfoFromAPIOnly(address: string): Promise<{
  symbol: string;
  name: string;
  decimals: number;
  priceUSD: number | null;
  logoUrl: string | null;
} | null> {
  if (!address) return null;

  const normalizedAddress = normalizeAddress(address);

  // 1. Try Echelon API
  try {
    const echelonResponse = await fetch('https://app.echelon.market/api/markets?network=aptos_mainnet', {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'YieldAI/1.0',
      },
    });

    if (echelonResponse.ok) {
      const echelonData = await echelonResponse.json();
      const asset = echelonData.data.assets?.find((a: any) => {
        const assetAddr = a.address ? normalizeAddress(a.address) : null;
        const assetFaAddr = a.faAddress ? normalizeAddress(a.faAddress) : null;
        return assetAddr === normalizedAddress || assetFaAddr === normalizedAddress;
      });

      if (asset) {
        console.log('[Thala] Found reward token in Echelon:', asset.symbol, 'at', normalizedAddress);
        return {
          symbol: asset.symbol,
          name: asset.name,
          decimals: asset.decimals || 8,
          priceUSD: asset.price || null,
          logoUrl: asset.icon || null,
        };
      }
    }
  } catch (error) {
    console.warn('[Thala] Error checking Echelon API for reward token:', error);
  }

  // 2. Try Panora API
  try {
    const panoraResponse = await fetch(
      `https://api.panora.exchange/tokens?chainId=1&address=${encodeURIComponent(address)}`,
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (panoraResponse.ok) {
      const panoraData = await panoraResponse.json();
      if (panoraData.data && panoraData.data.length > 0) {
        const token = panoraData.data[0];
        console.log('[Thala] Found reward token in Panora:', token.symbol, 'at', normalizedAddress);
        return {
          symbol: token.symbol,
          name: token.name,
          decimals: token.decimals,
          priceUSD: token.usdPrice ? parseFloat(token.usdPrice) : null,
          logoUrl: token.logoUrl || null,
        };
      }
    }
  } catch (error) {
    console.warn('[Thala] Error checking Panora API for reward token:', error);
  }

  // 3. Fallback: Try our internal API (which checks tokenList as last resort)
  // Only use this if external APIs failed, to avoid "Unknown" tokens
  try {
    const baseUrl = typeof window === 'undefined' 
      ? (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000')
      : '';
    const internalApiUrl = `${baseUrl}/api/tokens/info?address=${encodeURIComponent(address)}`;
    const internalResponse = await fetch(internalApiUrl);
    
    if (internalResponse.ok) {
      const internalData = await internalResponse.json();
      if (internalData.success && internalData.data) {
        const token = internalData.data;
        console.log('[Thala] Found reward token via internal API (fallback):', token.symbol, 'at', normalizedAddress, 'source:', token.source);
        return {
          symbol: token.symbol,
          name: token.name,
          decimals: token.decimals,
          priceUSD: token.price || null,
          logoUrl: token.logoUrl || null,
        };
      }
    }
  } catch (error) {
    console.warn('[Thala] Error checking internal API for reward token:', error);
  }

  console.warn('[Thala] Reward token not found in any API:', normalizedAddress);
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

    const poolsMap = await buildPoolsMap();

    let deposits: any[] = [];
    let positions: any[] = [];
    let rewardMetadataAddresses: string[] = [];

    if (hasDeposits) {
      const depositsAndPositionsResult = await callView(
        `${THALA_FARMING_ADDRESS}::farming::user_deposits_and_position_info`,
        [address]
      );
      const parsed = parseDepositsAndPositions(depositsAndPositionsResult);
      deposits = parsed.deposits;
      positions = parsed.positions;

      const rewardsMetadataResult = await callView(`${THALA_FARMING_ADDRESS}::farming::rewards_metadata`, []);
      const rewardsMetadata = unwrapArray(rewardsMetadataResult);
      rewardMetadataAddresses = rewardsMetadata
        .map((meta: any) => meta?.inner || meta)
        .filter((addr: string) => typeof addr === 'string' && addr.length > 0);
    }

    // Collect all token addresses (token0, token1, and rewards) for batch price fetching
    const allTokenAddresses = new Set<string>();
    
    // Collect token0 and token1 addresses from all positions
    for (let index = 0; index < positions.length; index++) {
      const position = positions[index];
      const poolObjInner = position?.pool_obj?.inner || '';
      const normalizedPool = normalizeTokenAddress(poolObjInner);
      const poolInfo = poolsMap.get(normalizedPool);
      const coinAddresses = poolInfo?.coinAddresses || [];
      if (coinAddresses[0]) allTokenAddresses.add(coinAddresses[0]);
      if (coinAddresses[1]) allTokenAddresses.add(coinAddresses[1]);
    }
    
    // Add reward token addresses
    rewardMetadataAddresses.forEach(addr => allTokenAddresses.add(addr));
    
    // Get prices for all tokens from Panora API (like other protocols)
    const allTokenPrices: Record<string, string> = {};
    if (allTokenAddresses.size > 0) {
      try {
        console.log('[Thala] Fetching token prices for', allTokenAddresses.size, 'tokens from Panora API');
        const pricesService = PanoraPricesService.getInstance();
        const pricesResponse = await pricesService.getPrices(1, Array.from(allTokenAddresses));
        const pricesData = pricesResponse.data || pricesResponse;
        
        // Build prices lookup with all possible address variations
        if (Array.isArray(pricesData)) {
          pricesData.forEach((priceData: any) => {
            const tokenAddress = priceData.tokenAddress;
            const faAddress = priceData.faAddress;
            
            if (priceData.usdPrice) {
              // Store price under all possible address variations
              if (tokenAddress) {
                allTokenPrices[tokenAddress] = priceData.usdPrice;
              }
              if (faAddress) {
                allTokenPrices[faAddress] = priceData.usdPrice;
              }
              // Also store under normalized versions
              if (faAddress && faAddress.startsWith('0x')) {
                const shortAddress = faAddress.slice(2);
                allTokenPrices[shortAddress] = priceData.usdPrice;
              }
              if (tokenAddress && tokenAddress.startsWith('0x')) {
                const shortAddress = tokenAddress.slice(2);
                allTokenPrices[shortAddress] = priceData.usdPrice;
              }
            }
          });
        }
        console.log('[Thala] Got prices for', Object.keys(allTokenPrices).length, 'tokens');
      } catch (error) {
        console.warn('[Thala] Error fetching token prices from Panora API:', error);
      }
    }
    
    // Separate reward prices for backward compatibility
    const rewardPrices: Record<string, string> = {};
    rewardMetadataAddresses.forEach(addr => {
      if (allTokenPrices[addr]) rewardPrices[addr] = allTokenPrices[addr];
    });

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

      // Get token metadata from API only (no tokenList.json)
      const [token0Info, token1Info] = await Promise.all([
        token0Address ? getTokenInfoFromAPIOnly(token0Address) : Promise.resolve(null),
        token1Address ? getTokenInfoFromAPIOnly(token1Address) : Promise.resolve(null)
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
      
      // Get prices from PanoraPricesService (already fetched in batch)
      const normalizedToken0Addr = token0Address.startsWith('0x') ? token0Address : `0x${token0Address}`;
      const shortToken0Addr = token0Address.startsWith('0x') ? token0Address.slice(2) : token0Address;
      const token0PriceStr = allTokenPrices[token0Address] || 
                            allTokenPrices[normalizedToken0Addr] || 
                            allTokenPrices[shortToken0Addr] || 
                            (token0Info?.priceUSD ? String(token0Info.priceUSD) : '0');
      const token0Price = parseFloat(token0PriceStr);
      
      const normalizedToken1Addr = token1Address.startsWith('0x') ? token1Address : `0x${token1Address}`;
      const shortToken1Addr = token1Address.startsWith('0x') ? token1Address.slice(2) : token1Address;
      const token1PriceStr = allTokenPrices[token1Address] || 
                            allTokenPrices[normalizedToken1Addr] || 
                            allTokenPrices[shortToken1Addr] || 
                            (token1Info?.priceUSD ? String(token1Info.priceUSD) : '0');
      const token1Price = parseFloat(token1PriceStr);
      
      const token0Value = token0Amount * token0Price;
      const token1Value = token1Amount * token1Price;
      const positionValueUSD = token0Value + token1Value;

      const rewards = [];
      let rewardsValueUSD = 0;

      // New rewards mechanism: use active_incentives_by_token + pending_reward_info
      if (positionObjectAddress && rewardMetadataAddresses.length > 0) {
        // Get active incentives for this position
        const incentiveAddresses = await getActiveIncentivesByToken(positionObjectAddress);
        
        // Sum up rewards from all incentives
        let totalRewardAmountRaw = '0';
        for (const incentiveAddress of incentiveAddresses) {
          const rewardInfo = await getPendingRewardInfo(positionObjectAddress, incentiveAddress);
          if (rewardInfo && rewardInfo.rewardAmount && rewardInfo.rewardAmount !== '0') {
            // Sum up reward amounts from all incentives
            const currentTotal = BigInt(totalRewardAmountRaw || '0');
            const newAmount = BigInt(rewardInfo.rewardAmount || '0');
            totalRewardAmountRaw = String(currentTotal + newAmount);
          }
        }

        // If we have rewards, get token info from the first reward metadata address
        if (totalRewardAmountRaw && totalRewardAmountRaw !== '0') {
          const rewardMetadataAddress = rewardMetadataAddresses[0]; // Use first (and usually only) reward token
          
          // Get token metadata (symbol, name, decimals, logoUrl) from API
          const rewardTokenInfo = rewardMetadataAddress
            ? await getTokenInfoFromAPIOnly(rewardMetadataAddress)
            : null;
          
          if (rewardTokenInfo) {
            const rewardDecimals = rewardTokenInfo.decimals ?? 8;
            const rewardAmount = parseTokenAmount(totalRewardAmountRaw, rewardDecimals);
            
            // Get price from PanoraPricesService (like other protocols)
            const normalizedRewardAddr = rewardMetadataAddress.startsWith('0x') ? rewardMetadataAddress : `0x${rewardMetadataAddress}`;
            const shortRewardAddr = rewardMetadataAddress.startsWith('0x') ? rewardMetadataAddress.slice(2) : rewardMetadataAddress;
            
            const rewardPriceStr = rewardPrices[rewardMetadataAddress] || 
                                  rewardPrices[normalizedRewardAddr] || 
                                  rewardPrices[shortRewardAddr] || 
                                  '0';
            const rewardPrice = parseFloat(rewardPriceStr);
            const rewardValue = rewardAmount * rewardPrice;
            rewardsValueUSD += rewardValue;

            rewards.push({
              tokenAddress: rewardMetadataAddress,
              symbol: rewardTokenInfo.symbol || 'Unknown',
              name: rewardTokenInfo.name || 'Unknown',
              decimals: rewardDecimals,
              logoUrl: rewardTokenInfo.logoUrl || null,
              amountRaw: totalRewardAmountRaw,
              amount: rewardAmount,
              priceUSD: rewardPrice,
              valueUSD: rewardValue
            });
          }
        }
      }

      formattedPositions.push({
        positionId,
        positionAddress: positionObjectAddress,
        staked: true,
        apr: typeof poolInfo?.apr === 'number' ? poolInfo.apr * 100 : 0,
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

    // Non-staked positions: Thala CL position NFTs held in wallet (no rewards)
    const stakedSet = new Set<string>(
      formattedPositions.map((p: any) => String(p?.positionAddress || '')).filter(Boolean)
    );
    const nonStakedAddresses = (await getNonStakedThalaPositionAddresses(address)).filter((a) => !stakedSet.has(a));

    // Collect token addresses from non-staked positions for batch price fetching
    const nonStakedTokenAddresses = new Set<string>();
    for (const positionAddress of nonStakedAddresses) {
      try {
        const positionInfoResult = await callView(`${THALA_POOL_ADDRESS}::pool::position_info`, [positionAddress]);
        const positionInfo = unwrapSingle<any>(positionInfoResult);
        const poolObjInner = positionInfo?.pool_obj?.inner || '';
        const normalizedPool = normalizeTokenAddress(poolObjInner);
        const poolInfo = poolsMap.get(normalizedPool);
        const coinAddresses = poolInfo?.coinAddresses || [];
        if (coinAddresses[0]) nonStakedTokenAddresses.add(coinAddresses[0]);
        if (coinAddresses[1]) nonStakedTokenAddresses.add(coinAddresses[1]);
      } catch (e) {
        // Skip if we can't get position info
      }
    }
    
    // Add non-staked token addresses to allTokenAddresses and fetch prices if needed
    nonStakedTokenAddresses.forEach(addr => allTokenAddresses.add(addr));
    if (nonStakedTokenAddresses.size > 0) {
      try {
        console.log('[Thala] Fetching additional token prices for', nonStakedTokenAddresses.size, 'non-staked tokens from Panora API');
        const pricesService = PanoraPricesService.getInstance();
        const pricesResponse = await pricesService.getPrices(1, Array.from(nonStakedTokenAddresses));
        const pricesData = pricesResponse.data || pricesResponse;
        
        // Add to allTokenPrices
        if (Array.isArray(pricesData)) {
          pricesData.forEach((priceData: any) => {
            const tokenAddress = priceData.tokenAddress;
            const faAddress = priceData.faAddress;
            
            if (priceData.usdPrice) {
              if (tokenAddress) {
                allTokenPrices[tokenAddress] = priceData.usdPrice;
              }
              if (faAddress) {
                allTokenPrices[faAddress] = priceData.usdPrice;
              }
              if (faAddress && faAddress.startsWith('0x')) {
                const shortAddress = faAddress.slice(2);
                allTokenPrices[shortAddress] = priceData.usdPrice;
              }
              if (tokenAddress && tokenAddress.startsWith('0x')) {
                const shortAddress = tokenAddress.slice(2);
                allTokenPrices[shortAddress] = priceData.usdPrice;
              }
            }
          });
        }
      } catch (error) {
        console.warn('[Thala] Error fetching non-staked token prices from Panora API:', error);
      }
    }

    for (const positionAddress of nonStakedAddresses) {
      try {
        const positionInfoResult = await callView(`${THALA_POOL_ADDRESS}::pool::position_info`, [positionAddress]);
        const positionInfo = unwrapSingle<any>(positionInfoResult);
        const poolObjInner = positionInfo?.pool_obj?.inner || '';
        const normalizedPool = normalizeTokenAddress(poolObjInner);
        const poolInfo = poolsMap.get(normalizedPool);
        const coinAddresses = poolInfo?.coinAddresses || [];
        const token0Address = coinAddresses[0] || '';
        const token1Address = coinAddresses[1] || '';

        // Get token metadata from API only (no tokenList.json)
        const [token0Info, token1Info] = await Promise.all([
          token0Address ? getTokenInfoFromAPIOnly(token0Address) : Promise.resolve(null),
          token1Address ? getTokenInfoFromAPIOnly(token1Address) : Promise.resolve(null)
        ]);

        let rawAmount0 = '0';
        let rawAmount1 = '0';
        try {
          const principalValueResult = await callView(
            `${THALA_POOL_ADDRESS}::pool::position_principal_value`,
            [positionAddress]
          );
          const principalValues = unwrapArray(principalValueResult);
          rawAmount0 = String(principalValues?.[0] ?? '0');
          rawAmount1 = String(principalValues?.[1] ?? '0');
        } catch (e) {
          console.warn('[Thala] position_principal_value failed (non-staked)', { positionAddress });
        }

        const token0Decimals = token0Info?.decimals ?? 8;
        const token1Decimals = token1Info?.decimals ?? 8;
        const token0Amount = parseTokenAmount(rawAmount0, token0Decimals);
        const token1Amount = parseTokenAmount(rawAmount1, token1Decimals);
        
        // Get prices from PanoraPricesService (already fetched in batch)
        const normalizedToken0Addr = token0Address.startsWith('0x') ? token0Address : `0x${token0Address}`;
        const shortToken0Addr = token0Address.startsWith('0x') ? token0Address.slice(2) : token0Address;
        const token0PriceStr = allTokenPrices[token0Address] || 
                              allTokenPrices[normalizedToken0Addr] || 
                              allTokenPrices[shortToken0Addr] || 
                              (token0Info?.priceUSD ? String(token0Info.priceUSD) : '0');
        const token0Price = parseFloat(token0PriceStr);
        
        const normalizedToken1Addr = token1Address.startsWith('0x') ? token1Address : `0x${token1Address}`;
        const shortToken1Addr = token1Address.startsWith('0x') ? token1Address.slice(2) : token1Address;
        const token1PriceStr = allTokenPrices[token1Address] || 
                              allTokenPrices[normalizedToken1Addr] || 
                              allTokenPrices[shortToken1Addr] || 
                              (token1Info?.priceUSD ? String(token1Info.priceUSD) : '0');
        const token1Price = parseFloat(token1PriceStr);
        
        const token0Value = token0Amount * token0Price;
        const token1Value = token1Amount * token1Price;
        const positionValueUSD = token0Value + token1Value;

        formattedPositions.push({
          positionId: String(positionInfo?.position_id || ''),
          positionAddress,
          staked: false,
          apr: typeof poolInfo?.apr === 'number' ? poolInfo.apr * 100 : 0,
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
          rewards: [],
          positionValueUSD,
          rewardsValueUSD: 0,
          totalValueUSD: positionValueUSD,
          rawPosition: positionInfo
        });
      } catch (e) {
        console.warn('[Thala] Failed to load non-staked position', { positionAddress });
      }
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
