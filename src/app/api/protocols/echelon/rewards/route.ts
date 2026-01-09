import { NextRequest, NextResponse } from 'next/server';
import tokenList from '@/lib/data/tokenList.json';

const ECHELON_FARMING_ADDRESS = "0xc6bc659f1649553c1a3fa05d9727433dc03843baac29473c817d06d39e7621ba";
const REWARDS_POOL_ADDRESS = "0xfdb653ffa48e91f39396ce87c656406f9b5e7a6686475446d92e79b098f0f4b5";
const APTOS_API_KEY = process.env.APTOS_API_KEY;

// Simple in-memory cache to reduce duplicate requests within short window
type CacheEntry = { timestamp: number; response: any };
const CACHE_TTL_MS = 60_000; // 60s
const echelonRewardsCache = new Map<string, CacheEntry>();

function getCache(key: string) {
  const entry = echelonRewardsCache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL_MS) {
    return entry.response;
  }
  return null;
}

function setCache(key: string, response: any) {
  echelonRewardsCache.set(key, { timestamp: Date.now(), response });
}

// Normalize address by removing leading zeros after 0x prefix
function normalizeAddress(addr: string): string {
  if (!addr || !addr.startsWith('0x')) return addr;
  const normalized = '0x' + addr.slice(2).replace(/^0+/, '');
  return normalized === '0x' ? '0x0' : normalized;
}

// Find token in tokenList by address (faAddress or tokenAddress)
function findTokenInList(tokenAddress: string) {
  const normalizedSearch = normalizeAddress(tokenAddress);
  
  return (tokenList as any).data.data.find((token: any) => {
    const normalizedTokenAddr = normalizeAddress(token.tokenAddress || '');
    const normalizedFaAddr = normalizeAddress(token.faAddress || '');
    
    return normalizedTokenAddr === normalizedSearch || normalizedFaAddr === normalizedSearch;
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');

  if (!address) {
    return NextResponse.json({ 
      success: false, 
      error: 'Address parameter is required' 
    }, { status: 400 });
  }

  if (!APTOS_API_KEY) {
    return NextResponse.json({ 
      success: false, 
      error: 'APTOS_API_KEY is not configured' 
    }, { status: 500 });
  }

  try {
    const cacheKey = `echelon:rewards:${address}`;
    const cached = getCache(cacheKey);
    if (cached) {
      return NextResponse.json(cached, {
        headers: {
          'Cache-Control': 'public, max-age=30, s-maxage=30, stale-while-revalidate=60',
        }
      });
    }
    // Get account resources
    const resourcesResponse = await fetch(
      `https://fullnode.mainnet.aptoslabs.com/v1/accounts/${address}/resources`,
      {
        headers: {
          'Authorization': `Bearer ${APTOS_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!resourcesResponse.ok) {
      throw new Error(`Failed to fetch resources: ${resourcesResponse.statusText}`);
    }

    const resources = await resourcesResponse.json();

    const rewards = [];

    // Find farming::Staker resource
    const stakerResource = resources.find(
      (resource: any) => resource.type === `${ECHELON_FARMING_ADDRESS}::farming::Staker`
    );

    if (stakerResource) {
      const userPools = stakerResource.data.user_pools.data;

    // Map reward names to token types and symbols
    const REWARD_TOKEN_TYPES: { [key: string]: string } = {
      "Aptos Coin": "0x1::aptos_coin::AptosCoin",
      "Thala APT": "0xfaf4e633ae9eb31366c9ca24214231760926576c7b625313b3688b5e900731f6::staking::ThalaAPT",
      "StakedThalaAPT": "0xfaf4e633ae9eb31366c9ca24214231760926576c7b625313b3688b5e900731f6::staking::StakedThalaAPT",
      "ECHO": "0xb2c7780f0a255a6137e5b39733f5a4c85fe093c549de5c359c1232deef57d1b7",
      "MKL": "0x5ae6789dd2fec1a9ec9cccfb3acaf12e93d432f0a3a42c92fe1a9d490b7bbc06::mkl_token::MKL",
      "AMI": "0xb36527754eb54d7ff55daf13bcb54b42b88ec484bd6f0e3b2e0d1db169de6451",
      "LSD": "0x53a30a6e5936c0a4c5140daed34de39d17ca7fcae08f947c02e979cef98a3719::coin::LSD",
      "THL": "0x7fd500c11216f0fe3095d0c4b8aa4d64a4e2e04f83758462f2b127255643615::thl_coin::THL",
      "CELL": "0x2ebb2ccac5e027a87fa0e2e5f656a3a4238d6a48d93ec9b610d570fc0aa0df12",
      "VIBE": "0xeedba439a4ab8987a995cf5cfefebd713000b3365718a29dfbc36bc214445fb8",
      // Add more mappings as needed
    };

    // Map reward names to token symbols for UI display
    const REWARD_TOKEN_SYMBOLS: { [key: string]: string } = {
      "Aptos Coin": "APT",
      "Thala APT": "thAPT",
      "StakedThalaAPT": "sthAPT",
      "ECHO": "ECHO",
      "MKL": "MKL",
      "AMI": "AMI",
      "LSD": "LSD",
      "THL": "THL",
      "CELL": "CELL",
      "VIBE": "VIBE",
      // Add more mappings as needed
    };

    // Process each user pool
    for (const pool of userPools) {
      // Extract the actual string value from pool.key (it might be an object)
      const farmingId = typeof pool.key === 'string' ? pool.key : pool.key.inner || JSON.stringify(pool.key);
      const poolData = pool.value;
      const poolRewards = poolData.rewards.data;

      // Process each reward in the pool
      for (const reward of poolRewards) {
        const rewardName = reward.key;
        const rewardData = reward.value;

        // Get claimable reward amount using view function
        const viewPayload = {
          function: `${ECHELON_FARMING_ADDRESS}::farming::claimable_reward_amount`,
          type_arguments: [],
          arguments: [address, rewardName, farmingId]
        };

        const viewResponse = await fetch(
          'https://fullnode.mainnet.aptoslabs.com/v1/view',
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${APTOS_API_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(viewPayload)
          }
        );

        if (viewResponse.ok) {
          const viewResult = await viewResponse.json();
          const claimableAmount = viewResult[0];

          // Format amount (8 decimals)
          const formattedAmount = Number(claimableAmount) / 1e8;

          if (formattedAmount > 0) {
            const tokenType = REWARD_TOKEN_TYPES[rewardName];
            const tokenSymbol = REWARD_TOKEN_SYMBOLS[rewardName] || rewardName;
            rewards.push({
              token: tokenSymbol, // Используем правильный символ для UI
              tokenType: tokenType || "Unknown",
              rewardName: rewardName, // Добавляем полное название для совместимости
              amount: formattedAmount,
              rawAmount: claimableAmount,
              farmingId: farmingId,
              stakeAmount: Number(poolData.stake_amount) / 1e8
            });
          }
        }
      }
    }
    }

    // Fetch rewards from rewards_pool::user_total_claimable
    try {
      const rewardsPoolViewPayload = {
        function: `${REWARDS_POOL_ADDRESS}::rewards_pool::user_total_claimable`,
        type_arguments: [],
        arguments: [address]
      };
      
      const rewardsPoolViewResponse = await fetch(
        'https://fullnode.mainnet.aptoslabs.com/v1/view',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${APTOS_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(rewardsPoolViewPayload)
        }
      );

      if (rewardsPoolViewResponse.ok) {
        const rewardsPoolResult = await rewardsPoolViewResponse.json();
        
        // Process OrderedMap result
        // Structure can be:
        // 1. { __variant__: "SortedVectorMap", entries: [{ key: { inner: "0x..." }, value: "54934" }] }
        // 2. Direct array: [{ key: { inner: "0x..." }, value: "54934" }]
        // 3. Wrapped in array: [{ __variant__: "SortedVectorMap", entries: [...] }]
        
        let entries: any[] = [];
        
        if (rewardsPoolResult && rewardsPoolResult.__variant__ === 'SortedVectorMap' && Array.isArray(rewardsPoolResult.entries)) {
          entries = rewardsPoolResult.entries;
        } else if (Array.isArray(rewardsPoolResult)) {
          // Check if it's an array of entries or array with variant
          if (rewardsPoolResult.length > 0 && rewardsPoolResult[0]?.__variant__ === 'SortedVectorMap') {
            entries = rewardsPoolResult[0].entries || [];
          } else if (rewardsPoolResult.length > 0 && rewardsPoolResult[0]?.key) {
            entries = rewardsPoolResult;
          }
        }
        
        if (entries.length > 0) {
          for (const entry of entries) {
            const tokenAddress = entry.key?.inner;
            const rawAmount = entry.value;

            if (!tokenAddress || !rawAmount) {
              continue;
            }

            // Normalize token address
            const normalizedTokenAddress = normalizeAddress(tokenAddress);

            // Find token in tokenList
            const tokenInfo = findTokenInList(normalizedTokenAddress);

            if (!tokenInfo) {
              // Skip unknown/test tokens
              continue;
            }

            // Check if token has price (usdPrice should be available)
            if (!tokenInfo.usdPrice || tokenInfo.usdPrice === '0' || tokenInfo.usdPrice === '') {
              // Skip tokens without price
              continue;
            }

            // Get decimals (default to 8 if not specified)
            const decimals = tokenInfo.decimals || 8;
            const divisor = Math.pow(10, decimals);
            const formattedAmount = Number(rawAmount) / divisor;

            if (formattedAmount > 0) {
              rewards.push({
                token: tokenInfo.symbol,
                tokenType: tokenInfo.faAddress || tokenInfo.tokenAddress || normalizedTokenAddress,
                rewardName: tokenInfo.symbol, // Use symbol as rewardName for compatibility
                amount: formattedAmount,
                rawAmount: rawAmount,
                farmingId: 'rewards_pool', // Special identifier for this type of rewards
                stakeAmount: 0 // Not applicable for this reward type
              });
            }
          }
        }
      } else {
        const errorText = await rewardsPoolViewResponse.text();
        console.warn('[Echelon Rewards] Failed to fetch rewards_pool rewards:', {
          status: rewardsPoolViewResponse.status,
          statusText: rewardsPoolViewResponse.statusText,
          error: errorText
        });
      }
    } catch (error) {
      console.error('[Echelon Rewards] Error fetching rewards_pool rewards:', error);
      // Continue even if this fails - we still return farming rewards
    }

    const result = {
      success: true,
      data: rewards
    };

    setCache(cacheKey, result);
    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'public, max-age=30, s-maxage=30, stale-while-revalidate=60',
      }
    });

  } catch (error) {
    console.error('Echelon rewards error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
} 