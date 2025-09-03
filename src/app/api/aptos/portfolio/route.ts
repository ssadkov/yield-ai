import { NextRequest, NextResponse } from 'next/server';
import { PanoraPricesService } from '@/lib/services/panora/prices';
import { createErrorResponse, createSuccessResponse } from '@/lib/utils/http';
import { FungibleAssetBalance } from '@/lib/types/aptos';
import { TokenPrice } from '@/lib/types/panora';
import tokenList from '@/lib/data/tokenList.json';
import protocolsList from '@/lib/data/protocolsList.json';

interface PortfolioToken {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  amount: string;
  price: string | null;
  value: string | null;
}

interface ProtocolPosition {
  protocol: string;
  positions: any[];
  totalValue: number;
}

interface PortfolioResponse {
  tokens: PortfolioToken[];
  protocols: {
    hyperion: {
      info: any;
      positions: any[];
    };
    echelon: {
      info: any;
      positions: any[];
    };
    aries: {
      info: any;
      positions: any[];
    };
    joule: {
      info: any;
      positions: any[];
    };
    tapp: {
      info: any;
      positions: any[];
    };
    meso: {
      info: any;
      positions: any[];
    };
    amnis: {
      info: any;
      positions: any[];
    };
  };
  totals: {
    walletValue: number;
    protocolsValue: number;
    totalValue: number;
  };
}

// Функция для поиска информации о токене (как в sidebar)
const getTokenInfo = (coinAddress: string) => {
  const token = (tokenList as any).data.data.find(
    (t: any) => t.faAddress === coinAddress || t.tokenAddress === coinAddress
  );
  
  if (token) {
    return {
      symbol: token.symbol,
      name: token.name,
      logoUrl: token.logoUrl || null,
      decimals: token.decimals,
      usdPrice: token.usdPrice || null
    };
  }
  
  return null;
};

// Функция для получения информации о протоколе
const getProtocolInfo = (protocolName: string) => {
  const protocol = (protocolsList as any[]).find(
    (p: any) => p.name.toLowerCase() === protocolName.toLowerCase() || 
               p.name.toLowerCase().includes(protocolName.toLowerCase())
  );
  
  if (protocol) {
    return {
      name: protocol.name,
      category: protocol.category,
      logoUrl: protocol.logoUrl,
      description: protocol.description,
      url: protocol.url,
      depositType: protocol.depositType,
      isDepositEnabled: protocol.isDepositEnabled,
      managedType: protocol.managedType
    };
  }
  
  return null;
};

/**
 * @swagger
 * /api/aptos/portfolio:
 *   get:
 *     tags:
 *       - aptos
 *     summary: Get complete portfolio data for an Aptos address
 *     description: Returns portfolio information including wallet tokens and DeFi protocol positions
 *     parameters:
 *       - in: query
 *         name: address
 *         required: true
 *         schema:
 *           type: string
 *         description: Aptos wallet address
 *     responses:
 *       200:
 *         description: Portfolio data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 tokens:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       address:
 *                         type: string
 *                       name:
 *                         type: string
 *                       symbol:
 *                         type: string
 *                       decimals:
 *                         type: number
 *                       amount:
 *                         type: string
 *                       price:
 *                         type: string
 *                       value:
 *                         type: string
 *                 protocols:
 *                   type: object
 *                   properties:
 *                     hyperion:
 *                       type: object
 *                       properties:
 *                         info:
 *                           type: object
 *                           properties:
 *                             name:
 *                               type: string
 *                             category:
 *                               type: string
 *                             logoUrl:
 *                               type: string
 *                             description:
 *                               type: string
 *                             url:
 *                               type: string
 *                             depositType:
 *                               type: string
 *                             isDepositEnabled:
 *                               type: boolean
 *                             managedType:
 *                               type: string
 *                         positions:
 *                           type: array
 *                           items:
 *                             type: object
 *                     echelon:
 *                       type: object
 *                       properties:
 *                         info:
 *                           type: object
 *                         positions:
 *                           type: array
 *                           items:
 *                             type: object
 *                     aries:
 *                       type: object
 *                       properties:
 *                         info:
 *                           type: object
 *                         positions:
 *                           type: array
 *                           items:
 *                             type: object
 *                     joule:
 *                       type: object
 *                       properties:
 *                         info:
 *                           type: object
 *                         positions:
 *                           type: array
 *                           items:
 *                             type: object
 *                     tapp:
 *                       type: object
 *                       properties:
 *                         info:
 *                           type: object
 *                         positions:
 *                           type: array
 *                           items:
 *                             type: object
 *                     meso:
 *                       type: object
 *                       properties:
 *                         info:
 *                           type: object
 *                         positions:
 *                           type: array
 *                           items:
 *                             type: object
 *                 totals:
 *                   type: object
 *                   properties:
 *                     walletValue:
 *                       type: number
 *                     protocolsValue:
 *                       type: number
 *                     totalValue:
 *                       type: number
 *       400:
 *         description: Invalid address
 *       500:
 *         description: Internal server error
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get("address");

    if (!address) {
      return NextResponse.json(
        { error: "Address is required" },
        { status: 400 }
      );
    }

    console.log('Getting complete portfolio for address:', address);
    console.log('APTOS_API_KEY exists:', !!process.env.APTOS_API_KEY);
    
    // Get wallet balances directly from Aptos API
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add API key if available
    if (process.env.APTOS_API_KEY) {
      headers['Authorization'] = `Bearer ${process.env.APTOS_API_KEY}`;
    }

    const aptosResponse = await fetch(`https://indexer.mainnet.aptoslabs.com/v1/graphql`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        query: `
          query GetAccountBalances($address: String!) {
            current_fungible_asset_balances(
              where: {owner_address: {_eq: $address}, amount: {_gt: "0"}}
            ) {
              asset_type
              amount
              last_transaction_timestamp
            }
          }
        `,
        variables: { address },
      }),
    });

    if (!aptosResponse.ok) {
      console.error('Aptos API error:', aptosResponse.status, aptosResponse.statusText);
      return NextResponse.json(
        createErrorResponse(new Error(`Aptos API error: ${aptosResponse.status}`)),
        { status: aptosResponse.status }
      );
    }

    const aptosData = await aptosResponse.json();
    // console.log('Aptos API response:', aptosData);
    
    const balances = aptosData.data?.current_fungible_asset_balances || [];
    console.log('Wallet balances:', balances);

    // Get prices for all tokens
    const pricesService = PanoraPricesService.getInstance();
    const tokenAddresses = balances.map((balance: FungibleAssetBalance) => balance.asset_type);
    console.log('Token addresses:', tokenAddresses);

    const pricesResponse = await pricesService.getPrices(1, tokenAddresses);
    console.log('Prices response:', pricesResponse);
    const prices = pricesResponse.data;

    // Process wallet tokens
    const tokens: PortfolioToken[] = balances.map((balance: FungibleAssetBalance) => {
      const price = prices.find((p: TokenPrice) => 
        p.tokenAddress === balance.asset_type || 
        p.faAddress === balance.asset_type
      );
      
      if (!price) {
        console.log('No price found for token:', balance.asset_type);
        return {
          address: balance.asset_type,
          name: balance.asset_type.split('::').pop() || balance.asset_type,
          symbol: balance.asset_type.split('::').pop() || balance.asset_type,
          decimals: 8,
          amount: balance.amount,
          price: null,
          value: null
        };
      }

      const amount = parseFloat(balance.amount) / Math.pow(10, price.decimals);
      const value = (amount * parseFloat(price.usdPrice)).toString();

      return {
        address: balance.asset_type,
        name: price.name,
        symbol: price.symbol,
        decimals: price.decimals,
        amount: balance.amount,
        price: price.usdPrice,
        value
      };
    });

    // Sort tokens by value
    tokens.sort((a, b) => {
      const valueA = a.value ? parseFloat(a.value) : 0;
      const valueB = b.value ? parseFloat(b.value) : 0;
      return valueB - valueA;
    });

    // Calculate wallet total value (handle null values properly)
    const walletValue = tokens.reduce((sum, token) => {
      const value = token.value ? parseFloat(token.value) : 0;
      return sum + (isNaN(value) ? 0 : value);
    }, 0);

    // Get protocol positions
    const protocols: {
      hyperion: { info: any; positions: any[] };
      echelon: { info: any; positions: any[] };
      aries: { info: any; positions: any[] };
      joule: { info: any; positions: any[] };
      tapp: { info: any; positions: any[] };
      meso: { info: any; positions: any[] };
      amnis: { info: any; positions: any[] };
    } = {
      hyperion: { info: getProtocolInfo('Hyperion'), positions: [] },
      echelon: { info: getProtocolInfo('Echelon'), positions: [] },
      aries: { info: getProtocolInfo('Aries'), positions: [] },
      joule: { info: getProtocolInfo('Joule'), positions: [] },
      tapp: { info: getProtocolInfo('Tapp Exchange'), positions: [] },
      meso: { info: getProtocolInfo('Meso Finance'), positions: [] },
      amnis: { info: getProtocolInfo('Amnis Finance'), positions: [] }
    };

    let protocolsValue = 0;

    // Get base URL from environment or use default
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || process.env.VERCEL_URL || 'http://localhost:3000';
    
    // Fetch positions from all protocols using correct port
    try {
      // Hyperion
      const hyperionResponse = await fetch(`${baseUrl}/api/protocols/hyperion/userPositions?address=${address}`);
      if (hyperionResponse.ok) {
        const hyperionData = await hyperionResponse.json();
        if (hyperionData.success && Array.isArray(hyperionData.data)) {
          protocols.hyperion.positions = hyperionData.data.map((pos: any) => ({
            symbol: `${pos.position?.pool?.token1Info?.symbol || 'Unknown'}/${pos.position?.pool?.token2Info?.symbol || 'Unknown'}`,
            amount: pos.value || "0",
            value: parseFloat(pos.value || "0"),
            rewards: {
              farm: pos.farm?.unclaimed?.reduce((sum: number, reward: any) => sum + parseFloat(reward.amountUSD || "0"), 0) || 0,
              fees: pos.fees?.unclaimed?.reduce((sum: number, fee: any) => sum + parseFloat(fee.amountUSD || "0"), 0) || 0,
              total: (pos.farm?.unclaimed?.reduce((sum: number, reward: any) => sum + parseFloat(reward.amountUSD || "0"), 0) || 0) + 
                     (pos.fees?.unclaimed?.reduce((sum: number, fee: any) => sum + parseFloat(fee.amountUSD || "0"), 0) || 0)
            },
            isActive: pos.isActive,
            poolInfo: {
              token1: pos.position?.pool?.token1Info,
              token2: pos.position?.pool?.token2Info
            }
          }));
          protocolsValue += protocols.hyperion.positions.reduce((sum: number, pos: any) => sum + pos.value + pos.rewards.total, 0);
        }
      }

      // Echelon
      const echelonResponse = await fetch(`${baseUrl}/api/protocols/echelon/userPositions?address=${address}`);
      if (echelonResponse.ok) {
        const echelonData = await echelonResponse.json();
        if (echelonData.success && Array.isArray(echelonData.data)) {
          // Получаем цены для токенов Echelon
          const echelonTokenAddresses = echelonData.data.map((pos: any) => pos.coin);
          const echelonPricesResponse = await pricesService.getPrices(1, echelonTokenAddresses);
          const echelonPrices = echelonPricesResponse.data;
          
          protocols.echelon.positions = echelonData.data.map((pos: any) => {
            const tokenInfo = getTokenInfo(pos.coin);
            const amount = pos.amount / (tokenInfo?.decimals ? 10 ** tokenInfo.decimals : 1e8);
            
            // Ищем цену в динамических данных
            const price = echelonPrices.find((p: TokenPrice) => 
              p.tokenAddress === pos.coin || p.faAddress === pos.coin
            );
            const value = price ? amount * parseFloat(price.usdPrice) : 0;
            
            return {
              symbol: tokenInfo?.symbol || pos.coin.substring(0, 4).toUpperCase(),
              amount: amount.toFixed(4),
              value: value,
              apy: pos.type === 'supply' ? (pos.supplyApr * 100) : (pos.borrowApr * 100), // Use appropriate APR
              assetType: pos.type, // Use the actual type (supply or borrow)
              assetInfo: tokenInfo,
              coin: pos.coin,
              supply: pos.supply,
              borrow: pos.borrow
            };
          });
          protocolsValue += protocols.echelon.positions.reduce((sum: number, pos: any) => sum + pos.value, 0);
        }
      }

      // Aries - handle the actual response structure
      const ariesResponse = await fetch(`${baseUrl}/api/protocols/aries/userPositions?address=${address}`);
      if (ariesResponse.ok) {
        const ariesData = await ariesResponse.json();
        console.log('Aries raw data:', ariesData);
        
        // Aries returns profiles with deposits and borrows
        if (ariesData.profiles && ariesData.profiles.profiles) {
          const ariesPositions: any[] = [];
          
          // Iterate through all profiles to find user's positions
          Object.entries(ariesData.profiles.profiles).forEach(([profileName, profile]: [string, any]) => {
            // Check if this profile belongs to the user by checking the owner
            if (profile.meta && profile.meta.owner === address) {
              // Process deposits
              if (profile.deposits) {
                Object.entries(profile.deposits).forEach(([assetName, deposit]: [string, any]) => {
                  const tokenInfo = getTokenInfo(assetName);
                  const amount = parseFloat(deposit.collateral_amount || "0") / (tokenInfo?.decimals ? 10 ** tokenInfo.decimals : 1e8);
                  const value = tokenInfo?.usdPrice ? amount * parseFloat(tokenInfo.usdPrice) : 0;
                  
                  ariesPositions.push({
                    symbol: tokenInfo?.symbol || assetName.substring(0, 4).toUpperCase(),
                    amount: amount.toFixed(4),
                    value: value,
                    type: 'deposit',
                    assetInfo: tokenInfo,
                    assetName: assetName,
                    collateralValue: deposit.collateral_value || 0
                  });
                });
              }
              
              // Process borrows
              if (profile.borrows) {
                Object.entries(profile.borrows).forEach(([assetName, borrow]: [string, any]) => {
                  const tokenInfo = getTokenInfo(assetName);
                  const amount = parseFloat(borrow.borrowed_coins || "0") / (tokenInfo?.decimals ? 10 ** tokenInfo.decimals : 1e8);
                  const value = tokenInfo?.usdPrice ? amount * parseFloat(tokenInfo.usdPrice) : 0;
                  
                  ariesPositions.push({
                    symbol: tokenInfo?.symbol || assetName.substring(0, 4).toUpperCase(),
                    amount: amount.toFixed(4),
                    value: value,
                    type: 'borrow',
                    assetInfo: tokenInfo,
                    assetName: assetName,
                    borrowedValue: borrow.borrowed_value || 0
                  });
                });
              }
            }
          });
          
                      protocols.aries.positions = ariesPositions;
            protocolsValue += protocols.aries.positions.reduce((sum: number, pos: any) => sum + pos.value, 0);
        }
      }

      // Joule - handle the actual response structure
      const jouleResponse = await fetch(`${baseUrl}/api/protocols/joule/userPositions?address=${address}`);
      if (jouleResponse.ok) {
        const jouleData = await jouleResponse.json();
        console.log('Joule raw data:', jouleData);
        
        // Joule returns userPositions array with positions_map
        if (jouleData.userPositions && Array.isArray(jouleData.userPositions)) {
          const joulePositions: any[] = [];
          
          jouleData.userPositions.forEach((userPosition: any) => {
            if (userPosition.positions_map && userPosition.positions_map.data) {
              userPosition.positions_map.data.forEach((position: any) => {
                if (position.value) {
                  // Process borrow positions
                  if (position.value.borrow_positions && position.value.borrow_positions.data) {
                    position.value.borrow_positions.data.forEach((borrow: any) => {
                      const tokenInfo = getTokenInfo(borrow.key);
                      const amount = parseFloat(borrow.value.borrow_amount || "0") / (tokenInfo?.decimals ? 10 ** tokenInfo.decimals : 1e8);
                      const value = tokenInfo?.usdPrice ? amount * parseFloat(tokenInfo.usdPrice) : 0;
                      
                      joulePositions.push({
                        symbol: tokenInfo?.symbol || borrow.key.substring(0, 4).toUpperCase(),
                        amount: amount.toFixed(4),
                        value: value,
                        type: 'borrow',
                        assetInfo: tokenInfo,
                        assetName: borrow.key,
                        interestAccumulated: borrow.value.interest_accumulated || "0"
                      });
                    });
                  }
                  
                  // Process lend positions
                  if (position.value.lend_positions && position.value.lend_positions.data) {
                    position.value.lend_positions.data.forEach((lend: any) => {
                      const tokenInfo = getTokenInfo(lend.key);
                      const amount = parseFloat(lend.value || "0") / (tokenInfo?.decimals ? 10 ** tokenInfo.decimals : 1e8);
                      const value = tokenInfo?.usdPrice ? amount * parseFloat(tokenInfo.usdPrice) : 0;
                      
                      joulePositions.push({
                        symbol: tokenInfo?.symbol || lend.key.substring(0, 4).toUpperCase(),
                        amount: amount.toFixed(4),
                        value: value,
                        type: 'lend',
                        assetInfo: tokenInfo,
                        assetName: lend.key
                      });
                    });
                  }
                }
              });
            }
          });
          
          protocols.joule.positions = joulePositions;
          protocolsValue += protocols.joule.positions.reduce((sum: number, pos: any) => sum + pos.value, 0);
        }
      }

      // Tapp
      const tappResponse = await fetch(`${baseUrl}/api/protocols/tapp/userPositions?address=${address}`);
      if (tappResponse.ok) {
        const tappData = await tappResponse.json();
        if (tappData.success && Array.isArray(tappData.data)) {
          protocols.tapp.positions = tappData.data.map((pos: any) => {
            const value = (pos.estimatedWithdrawals || []).reduce((sum: number, token: any) => sum + parseFloat(token.usd || "0"), 0);
            const incentives = (pos.estimatedIncentives || []).reduce((sum: number, incentive: any) => sum + parseFloat(incentive.usd || "0"), 0);
            
            return {
              symbol: pos.poolType || 'Unknown',
              amount: pos.shareOfPool || "0",
              value: value,
              rewards: {
                incentives: incentives,
                total: incentives
              },
              poolInfo: {
                feeTier: pos.feeTier,
                tvl: pos.tvl,
                volume24h: pos.volume24h
              }
            };
          });
          protocolsValue += protocols.tapp.positions.reduce((sum: number, pos: any) => sum + pos.value + pos.rewards.total, 0);
        }
      }

      // Meso
      const mesoResponse = await fetch(`${baseUrl}/api/protocols/meso/userPositions?address=${address}`);
      if (mesoResponse.ok) {
        const mesoData = await mesoResponse.json();
        if (mesoData.success && Array.isArray(mesoData.data)) {
          protocols.meso.positions = mesoData.data.map((pos: any) => {
            const symbol = pos.assetInfo?.symbol || (pos.assetName?.split('::').pop()?.toUpperCase() || 'ASSET');
            const value = typeof pos.usdValue === 'number' ? pos.usdValue : 0;
            const amount = typeof pos.amount === 'number' ? pos.amount : 0;

            return {
              symbol,
              amount: amount.toFixed(4),
              value: value,
              type: pos.type || 'deposit',
              assetInfo: pos.assetInfo || null,
              assetName: pos.assetName
            };
          });
          // Subtract debts from total
          protocolsValue += protocols.meso.positions.reduce((sum: number, pos: any) => sum + (pos.type === 'debt' ? -pos.value : pos.value), 0);
        }
      }

      // Amnis
      const amnisResponse = await fetch(`${baseUrl}/api/protocols/amnis/userPositions?address=${address}`);
      if (amnisResponse.ok) {
        const amnisData = await amnisResponse.json();
        if (amnisData.success && Array.isArray(amnisData.positions)) {
          protocols.amnis.positions = amnisData.positions.map((pos: any) => {
            const tokenInfo = getTokenInfo(pos.token);
            const stakedAmount = parseFloat(pos.stakedAmount) / (tokenInfo?.decimals ? 10 ** tokenInfo.decimals : 1e8);
            const stakingTokenAmount = parseFloat(pos.stakingTokenAmount) / (tokenInfo?.decimals ? 10 ** tokenInfo.decimals : 1e8);
            const rewards = parseFloat(pos.rewards) / (tokenInfo?.decimals ? 10 ** tokenInfo.decimals : 1e8);
            
            // Calculate value based on staked amount
            const value = tokenInfo?.usdPrice ? stakedAmount * parseFloat(tokenInfo.usdPrice) : 0;
            
            return {
              symbol: tokenInfo?.symbol || pos.token.substring(0, 4).toUpperCase(),
              amount: stakedAmount.toFixed(4),
              stakingTokenAmount: stakingTokenAmount.toFixed(4),
              value: value,
              apy: pos.apy || 0,
              rewards: rewards,
              type: 'staking',
              assetInfo: tokenInfo,
              poolName: pos.poolName,
              isActive: pos.isActive
            };
          });
          protocolsValue += protocols.amnis.positions.reduce((sum: number, pos: any) => sum + pos.value + pos.rewards, 0);
        }
      }
    } catch (error) {
      console.error('Error fetching protocol positions:', error);
    }

    const totalValue = walletValue + protocolsValue;

    const response: PortfolioResponse & { dateTime: string } = {
      dateTime: new Date().toISOString(),
      tokens,
      protocols,
      totals: {
        walletValue,
        protocolsValue,
        totalValue
      }
    };

    console.log('Complete portfolio response:', response);
    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching portfolio:", error);
    return NextResponse.json(
      { error: "Failed to fetch portfolio" },
      { status: 500 }
    );
  }
} 