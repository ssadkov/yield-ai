import { NextRequest, NextResponse } from 'next/server';

// Aave Aptos contract addresses
const AAVE_POOL_DATA_PROVIDER = '0x39ddcd9e1a39fa14f25e3f9ec8a86074d05cc0881cbf667df8a6ee70942016fb';
const AAVE_POOL = '0x39ddcd9e1a39fa14f25e3f9ec8a86074d05cc0881cbf667df8a6ee70942016fb';

// Constants
const RAY27 = BigInt('1000000000000000000000000000'); // 1e27
const FULLNODE_VIEW_URL = 'https://fullnode.mainnet.aptoslabs.com/v1/view';

interface AaveReserveData {
  underlying_asset: string;
  symbol: string;
  name: string;
  decimals: string;
  liquidity_index: string;
  variable_borrow_index: string;
  price_in_market_reference_currency: string;
  a_token_address?: string;
  variable_debt_token_address?: string;
  [key: string]: any; // Allow additional properties
}

interface AaveUserReserveData {
  underlying_asset: string;
  decimals: string;
  scaled_a_token_balance: string;
  scaled_variable_debt: string;
  usage_as_collateral_enabled_on_user: boolean;
}

interface AavePosition {
  underlying_asset: string;
  symbol: string;
  name: string;
  decimals: number;
  deposit_amount: number;
  deposit_value_usd: number;
  borrow_amount: number;
  borrow_value_usd: number;
  usage_as_collateral_enabled: boolean;
  liquidity_index: string;
  variable_borrow_index: string;
}

async function callView(functionFullname: string, args: any[]): Promise<any> {
  const res = await fetch(FULLNODE_VIEW_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ function: functionFullname, type_arguments: [], arguments: args })
  });
  
  if (!res.ok) {
    const text = await res.text();
    console.error('[Aave] VIEW ERROR:', functionFullname, 'args:', JSON.stringify(args), '->', res.status, res.statusText, text);
    throw new Error(`VIEW ERROR ${res.status} ${res.statusText}: ${text}`);
  }
  
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

function calculateActualAmount(scaledAmount: string, index: string, decimals: number): number {
  // Additional safety checks
  if (!scaledAmount || !index || scaledAmount === '0' || index === '0') {
    console.log('[Aave] calculateActualAmount: zero or undefined values', { scaledAmount, index, decimals });
    return 0;
  }
  
  try {
    const scaled = BigInt(scaledAmount);
    const indexValue = BigInt(index);
    const actualBase = (scaled * indexValue) / RAY27;
    
    return Number(actualBase) / Math.pow(10, decimals);
  } catch (error) {
    console.error('[Aave] calculateActualAmount error:', { scaledAmount, index, decimals, error });
    return 0;
  }
}

function calculateUSDValue(amount: number, priceInMarketRef: string, marketRefPriceUSD: string): number {
  if (amount === 0) return 0;
  
  const price = parseFloat(priceInMarketRef) / 1e18;
  const usdPrice = parseFloat(marketRefPriceUSD) / 1e18;
  
  return amount * price * usdPrice;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');

    if (!address) {
      return NextResponse.json(
        { error: 'Address parameter is required' },
        { status: 400 }
      );
    }

    console.log(`[Aave] Checking positions for address: ${address}`);

    // Get user reserves data
    const userReservesResponse = await callView(
      `${AAVE_POOL_DATA_PROVIDER}::ui_pool_data_provider_v3::get_user_reserves_data`,
      [address]
    );

    console.log('[Aave] User reserves response structure:', JSON.stringify(userReservesResponse, null, 2));

    // The response is an array where first element contains the user reserves
    let userReservesData: AaveUserReserveData[] = [];
    if (Array.isArray(userReservesResponse) && userReservesResponse[0] && Array.isArray(userReservesResponse[0])) {
      userReservesData = userReservesResponse[0] as AaveUserReserveData[];
    } else if (Array.isArray(userReservesResponse)) {
      userReservesData = userReservesResponse as AaveUserReserveData[];
    } else {
      console.error('[Aave] Unexpected user reserves response format:', userReservesResponse);
      throw new Error('Invalid user reserves data format');
    }

    // Get all reserves data for indices and prices
    const reservesResponse = await callView(
      `${AAVE_POOL_DATA_PROVIDER}::ui_pool_data_provider_v3::get_reserves_data`,
      []
    );

    console.log('[Aave] Reserves response structure:', JSON.stringify(reservesResponse, null, 2));

    // The response is an array where first element contains reserves and second contains market info
    let reservesData: AaveReserveData[] = [];
    if (Array.isArray(reservesResponse) && reservesResponse[0] && Array.isArray(reservesResponse[0])) {
      reservesData = reservesResponse[0] as AaveReserveData[];
    } else if (Array.isArray(reservesResponse)) {
      reservesData = reservesResponse as AaveReserveData[];
    } else {
      console.error('[Aave] Unexpected reserves response format:', reservesResponse);
      throw new Error('Invalid reserves data format');
    }

    // Market data is the second element of the reserves response
    const marketData = Array.isArray(reservesResponse) && reservesResponse[1] ? reservesResponse[1] : {};

    // Create a map of reserve data by underlying asset
    const reservesMap = new Map<string, AaveReserveData>();
    reservesData.forEach(reserve => {
      reservesMap.set(reserve.underlying_asset, reserve);
    });

    console.log('[Aave] Extracted data:', {
      userReservesCount: userReservesData.length,
      reservesCount: reservesData.length,
      reservesMapKeys: Array.from(reservesMap.keys()),
      marketDataKeys: Object.keys(marketData)
    });

    // Process user positions
    const positions: AavePosition[] = [];
    let totalDepositValue = 0;
    let totalBorrowValue = 0;

    for (const userReserve of userReservesData) {
      const reserve = reservesMap.get(userReserve.underlying_asset);
      if (!reserve) {
        console.log('[Aave] Reserve not found for asset:', userReserve.underlying_asset);
        continue;
      }

      console.log('[Aave] Processing user reserve:', {
        underlying_asset: userReserve.underlying_asset,
        scaled_a_token_balance: userReserve.scaled_a_token_balance,
        scaled_variable_debt: userReserve.scaled_variable_debt,
        decimals: Number(userReserve.decimals),
        liquidity_index: reserve.liquidity_index,
        variable_borrow_index: reserve.variable_borrow_index
      });

      // Calculate actual amounts using indices
      const depositAmount = calculateActualAmount(
        userReserve.scaled_a_token_balance,
        reserve.liquidity_index,
        Number(userReserve.decimals)
      );

      const borrowAmount = calculateActualAmount(
        userReserve.scaled_variable_debt,
        reserve.variable_borrow_index,
        Number(userReserve.decimals)
      );

      // Calculate USD values (simplified - using market reference currency)
      const depositValueUSD = calculateUSDValue(
        depositAmount,
        reserve.price_in_market_reference_currency,
        '1000000000000000000' // Default market reference price
      );

      const borrowValueUSD = calculateUSDValue(
        borrowAmount,
        reserve.price_in_market_reference_currency,
        '1000000000000000000' // Default market reference price
      );

      if (depositAmount > 0 || borrowAmount > 0) {
        positions.push({
          underlying_asset: userReserve.underlying_asset,
          symbol: reserve.symbol,
          name: reserve.name,
          decimals: Number(userReserve.decimals),
          deposit_amount: depositAmount,
          deposit_value_usd: depositValueUSD,
          borrow_amount: borrowAmount,
          borrow_value_usd: borrowValueUSD,
          usage_as_collateral_enabled: userReserve.usage_as_collateral_enabled_on_user,
          liquidity_index: reserve.liquidity_index,
          variable_borrow_index: reserve.variable_borrow_index
        });

        totalDepositValue += depositValueUSD;
        totalBorrowValue += borrowValueUSD;
      }
    }

    const hasPositions = positions.length > 0;
    const netValue = totalDepositValue - totalBorrowValue;

    console.log(`[Aave] Found ${positions.length} positions for ${address}, total deposit: $${totalDepositValue.toFixed(2)}, total borrow: $${totalBorrowValue.toFixed(2)}`);

    return NextResponse.json({
      success: true,
      data: positions,
      totalValue: netValue,
      totalDepositValue,
      totalBorrowValue,
      hasPositions,
      message: 'Aave positions loaded successfully'
    });

  } catch (error) {
    console.error('[Aave] Error checking positions:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to check Aave positions',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
