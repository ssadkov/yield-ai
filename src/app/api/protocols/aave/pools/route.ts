import { NextResponse } from 'next/server';

// Aave Aptos contract addresses
const AAVE_POOL_DATA_PROVIDER = '0x39ddcd9e1a39fa14f25e3f9ec8a86074d05cc0881cbf667df8a6ee70942016fb';

// Constants
const RAY = 1e27; // 1e27 (ray scale)
const SECONDS_PER_YEAR = 31_536_000; // 365 days in seconds

interface AaveReserveData {
  underlying_asset: string;
  symbol: string;
  name: string;
  decimals: string;
  liquidity_rate: string;
  variable_borrow_rate: string;
  liquidity_index: string;
  variable_borrow_index: string;
  price_in_market_reference_currency: string;
  a_token_address?: string;
  variable_debt_token_address?: string;
  [key: string]: any;
}

interface AavePool {
  asset: string;
  provider: string;
  totalAPY: number;
  depositApy: number;
  borrowAPY: number;
  token: string;
  protocol: string;
  poolType: string;
  // Additional Aave-specific data
  liquidityRate: number;
  variableBorrowRate: number;
  liquidityIndex: string;
  variableBorrowIndex: string;
  priceInMarketRef: string;
  decimals: number;
  // Caps and rates (collected but not used yet)
  supplyCap?: string;
  borrowCap?: string;
  utilizationRate?: number;
}

async function callView(functionFullname: string, args: any[]): Promise<any> {
  const FULLNODE_VIEW_URL = 'https://fullnode.mainnet.aptoslabs.com/v1/view';
  
  const res = await fetch(FULLNODE_VIEW_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ function: functionFullname, type_arguments: [], arguments: args })
  });
  
  if (!res.ok) {
    const text = await res.text();
    console.error('[Aave Pools] VIEW ERROR:', functionFullname, 'args:', JSON.stringify(args), '->', res.status, res.statusText, text);
    throw new Error(`VIEW ERROR ${res.status} ${res.statusText}: ${text}`);
  }
  
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

function calculateAPR(rateRay: string): number {
  if (!rateRay || rateRay === '0') return 0;
  
  try {
    const rate = BigInt(rateRay);
    const apr = Number(rate) / RAY;
    return apr;
  } catch (error) {
    console.error('[Aave Pools] Error calculating APR:', { rateRay, error });
    return 0;
  }
}

function calculateAPY(apr: number): number {
  if (apr <= 0) return 0;
  
  try {
    const apy = Math.pow(1 + apr / SECONDS_PER_YEAR, SECONDS_PER_YEAR) - 1;
    return apy;
  } catch (error) {
    console.error('[Aave Pools] Error calculating APY:', { apr, error });
    return 0;
  }
}

export async function GET() {
  try {
    console.log('[Aave Pools] Fetching reserves data...');

    // Get all reserves data from Aave
    const reservesResponse = await callView(
      `${AAVE_POOL_DATA_PROVIDER}::ui_pool_data_provider_v3::get_reserves_data`,
      []
    );

    console.log('[Aave Pools] Reserves response structure:', JSON.stringify(reservesResponse, null, 2));

    // The response is an array where first element contains reserves and second contains market info
    let reservesData: AaveReserveData[] = [];
    if (Array.isArray(reservesResponse) && reservesResponse[0] && Array.isArray(reservesResponse[0])) {
      reservesData = reservesResponse[0] as AaveReserveData[];
    } else if (Array.isArray(reservesResponse)) {
      reservesData = reservesResponse as AaveReserveData[];
    } else {
      console.error('[Aave Pools] Unexpected reserves response format:', reservesResponse);
      throw new Error('Invalid reserves data format');
    }

    console.log(`[Aave Pools] Found ${reservesData.length} reserves`);

    // Transform reserves data to pools format
    const pools: AavePool[] = reservesData.map((reserve) => {
      // Calculate APR from ray values
      const supplyAPR = calculateAPR(reserve.liquidity_rate);
      const borrowAPR = calculateAPR(reserve.variable_borrow_rate);

      // Calculate APY with compounding
      const supplyAPY = calculateAPY(supplyAPR);
      const borrowAPY = calculateAPY(borrowAPR);

      return {
        asset: reserve.symbol || 'Unknown',
        provider: 'Aave',
        totalAPY: supplyAPY * 100, // Convert to percentage
        depositApy: supplyAPY * 100, // Supply APY is the deposit APY
        borrowAPY: borrowAPY * 100, // Borrow APY
        token: reserve.underlying_asset,
        protocol: 'Aave',
        poolType: 'Lending',
        // Additional Aave-specific data
        liquidityRate: supplyAPR,
        variableBorrowRate: borrowAPR,
        liquidityIndex: reserve.liquidity_index,
        variableBorrowIndex: reserve.variable_borrow_index,
        priceInMarketRef: reserve.price_in_market_reference_currency,
        decimals: Number(reserve.decimals) || 8,
        // Добавить поля для корректной работы с DepositButton
        marketAddress: reserve.underlying_asset, // Для будущих транзакций
        tvlUSD: 0, // Пока не доступно
        dailyVolumeUSD: 0 // Пока не доступно
      };
    });

    console.log(`[Aave Pools] Transformed ${pools.length} pools`);

    return NextResponse.json({
      success: true,
      data: pools,
      count: pools.length,
      message: 'Aave pools loaded successfully'
    }, {
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=600', // 5 minutes cache
        'Cdn-Cache-Control': 'max-age=300',
        'Surrogate-Control': 'max-age=300'
      }
    });

  } catch (error) {
    console.error('[Aave Pools] Error fetching pools:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch Aave pools',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
