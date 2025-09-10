import { NextRequest, NextResponse } from 'next/server';
import { PanoraPricesService } from '@/lib/services/panora/prices';
import tokenList from '@/lib/data/tokenList.json';

const APTOS_API_KEY = process.env.APTOS_API_KEY;

interface RewardItem {
  side: 'supply' | 'borrow';
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
  // Add fields needed for claim functionality
  farming_identifier: string;
  reward_id: string;
  claimable_amount: string;
  token_info?: {
    symbol: string;
    decimals: number;
    price: string;
    amount: number;
    logoUrl?: string;
  };
}

async function callView(functionFullname: string, args: any[]): Promise<any> {
  const url = 'https://fullnode.mainnet.aptoslabs.com/v1/view';
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  
  // Add API key if available
  if (APTOS_API_KEY) {
    headers['Authorization'] = `Bearer ${APTOS_API_KEY}`;
  }
  
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ function: functionFullname, type_arguments: [], arguments: args })
  });
  if (!res.ok) {
    const text = await res.text();
    console.error('[Moar Market] VIEW ERROR:', functionFullname, 'args:', JSON.stringify(args), '->', res.status, res.statusText, text);
    throw new Error(`VIEW ERROR ${res.status} ${res.statusText}: ${text}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

function getTokenInfo(tokenAddress: string) {
  const token = (tokenList as any).data?.data?.find((t: any) => 
    t.tokenAddress === tokenAddress || t.faAddress === tokenAddress
  );
  
  if (token) {
    return {
      symbol: token.symbol,
      name: token.name,
      logoUrl: token.logoUrl || null,
      decimals: token.decimals || 8
    };
  }
  
  // Fallback for unknown tokens
  return {
    symbol: tokenAddress.includes('::') ? tokenAddress.split('::').pop()?.replace('>', '') || 'UNKNOWN' : 'UNKNOWN',
    name: tokenAddress,
    logoUrl: null,
    decimals: 8
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');

    if (!address) {
      return NextResponse.json({ 
        success: false, 
        error: 'Address parameter is required' 
      }, { status: 400 });
    }

    console.log('🔍 Fetching Moar Market rewards for address:', address);
    console.log('🔑 APTOS_API_KEY exists:', !!APTOS_API_KEY);

    // Get Staker resource
    const resourceHeaders: Record<string, string> = {};
    if (APTOS_API_KEY) {
      resourceHeaders['Authorization'] = `Bearer ${APTOS_API_KEY}`;
    }
    
    const resourceResponse = await fetch(`https://fullnode.mainnet.aptoslabs.com/v1/accounts/${address}/resource/0xa3afc59243afb6deeac965d40b25d509bb3aebc12f502b8592c283070abc2e07::farming::Staker`, {
      headers: resourceHeaders
    });
    
    if (!resourceResponse.ok) {
      if (resourceResponse.status === 404) {
        console.log('📊 No Staker resource found for this address');
        return NextResponse.json({ 
          success: true, 
          data: [], 
          totalUsd: 0 
        });
      }
      throw new Error(`Failed to fetch Staker resource: ${resourceResponse.status}`);
    }
    
    const stakerResource = await resourceResponse.json();
    console.log('📊 Staker resource found');
    
    const userPools = stakerResource.data.user_pools;
    if (!userPools || !userPools.entries || userPools.entries.length === 0) {
      console.log('📊 No user pools found');
      return NextResponse.json({ 
        success: true, 
        data: [], 
        totalUsd: 0 
      });
    }
    
    console.log('📊 Processing', userPools.entries.length, 'user pools');
    
    const rewards: RewardItem[] = [];
    const tokenAddresses = new Set<string>();
    
    // Process each user pool
    for (const poolEntry of userPools.entries) {
      const farmingIdentifier = poolEntry.value.farming_identifier;
      const poolRewards = poolEntry.value.rewards;
      
      if (poolRewards && poolRewards.entries) {
        // Process each reward in the pool
        for (const rewardEntry of poolRewards.entries) {
          const rewardId = rewardEntry.key;
          const rewardData = rewardEntry.value;
          
          try {
            // Call claimable_reward_amount view function
            const claimableAmount = await callView(
              '0xa3afc59243afb6deeac965d40b25d509bb3aebc12f502b8592c283070abc2e07::farming::claimable_reward_amount',
              [address, rewardId, farmingIdentifier]
            );
            
            if (claimableAmount && claimableAmount !== '0') {
              // Determine token address based on reward_id
              let tokenAddress = '';
              if (rewardId.includes('APT')) {
                tokenAddress = '0x1::aptos_coin::AptosCoin';
              } else {
                // For other tokens, we might need to map them
                // For now, use a placeholder
                tokenAddress = `0x1::coin::CoinInfo<${rewardId}>`;
              }
              
              tokenAddresses.add(tokenAddress);
              
              const tokenInfo = getTokenInfo(tokenAddress);
              const amount = parseFloat(claimableAmount) / Math.pow(10, tokenInfo.decimals);
              
              rewards.push({
                side: 'supply',
                poolInner: farmingIdentifier,
                rewardPoolInner: rewardId,
                tokenAddress: tokenAddress,
                amountRaw: claimableAmount,
                amount: amount,
                decimals: tokenInfo.decimals,
                symbol: tokenInfo.symbol,
                name: tokenInfo.name,
                logoUrl: tokenInfo.logoUrl,
                price: null, // Will be filled after getting prices
                usdValue: 0, // Will be calculated after getting prices
                // Add fields needed for claim functionality
                farming_identifier: farmingIdentifier,
                reward_id: rewardId,
                claimable_amount: claimableAmount,
                token_info: {
                  symbol: tokenInfo.symbol,
                  decimals: tokenInfo.decimals,
                  price: '0', // Will be updated after getting prices
                  amount: amount,
                  logoUrl: tokenInfo.logoUrl
                }
              });
            }
          } catch (err) {
            console.warn(`Error getting claimable amount for ${rewardId}:`, err);
          }
        }
      }
    }
    
    console.log('📊 Found', rewards.length, 'rewards');
    
    // Get prices for all tokens
    if (rewards.length > 0 && tokenAddresses.size > 0) {
      try {
        const pricesService = PanoraPricesService.getInstance();
        const pricesResponse = await pricesService.getPrices(1, Array.from(tokenAddresses));
        const prices = pricesResponse.data || pricesResponse;
        
        console.log('💰 Got prices for', prices.length, 'tokens');
        
        // Update rewards with prices and USD values
        let totalUsd = 0;
        rewards.forEach(reward => {
          const priceData = prices.find((p: any) => 
            p.tokenAddress === reward.tokenAddress || p.faAddress === reward.tokenAddress
          );
          
          if (priceData) {
            reward.price = priceData.usdPrice;
            reward.usdValue = reward.amount * parseFloat(priceData.usdPrice);
            totalUsd += reward.usdValue;
            
            // Update token_info with price
            if (reward.token_info) {
              reward.token_info.price = priceData.usdPrice;
            }
            
            console.log(`💰 ${reward.symbol}: ${reward.amount.toFixed(6)} * $${priceData.usdPrice} = $${reward.usdValue.toFixed(2)}`);
          } else {
            console.warn(`💰 No price found for ${reward.symbol} (${reward.tokenAddress})`);
          }
        });
        
        console.log('💰 Total rewards value: $', totalUsd.toFixed(2));
        
        return NextResponse.json({
          success: true,
          data: rewards,
          totalUsd: totalUsd
        });
      } catch (err) {
        console.warn('💰 Error fetching prices:', err);
        return NextResponse.json({
          success: true,
          data: rewards,
          totalUsd: 0
        });
      }
    }
    
    return NextResponse.json({
      success: true,
      data: rewards,
      totalUsd: 0
    });
    
  } catch (error) {
    console.error('Error fetching Moar Market rewards:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch rewards',
      data: [],
      totalUsd: 0
    }, { status: 500 });
  }
}
