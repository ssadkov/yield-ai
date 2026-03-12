/**
 * Build transaction payload for closing a Decibel perps position at market (IOC).
 * Uses place_order_to_subaccount with time_in_force=ImmediateOrCancel and is_reduce_only=true.
 *
 * @see https://docs.decibel.trade/developer-hub/on-chain/order-management/place-order
 * @see https://docs.decibel.trade/developer-hub/on-chain/overview/formatting-prices-sizes
 * @see https://docs.decibel.trade/developer-hub/on-chain/overview/contract-reference
 */

// Must match DECIBEL_PACKAGE_ADDRESS_MAINNET / deployed mainnet contract (e.g. explorer.aptoslabs.com)
export const PACKAGE_MAINNET = '0x50ead22afd6ffd9769e3b3d6e0e64a2a350d68e8b102c4e72e33d0b8cfdfdb06';
// Aptos Testnet - match DECIBEL_PACKAGE_ADDRESS_TESTNET when using testnet
export const PACKAGE_TESTNET = '0xd0b2dd565e0f2020d66d581a938e7766b2163db4b8c63410c17578d32b4e9e88';

export interface DecibelMarketConfig {
  market_addr?: string;
  market_name?: string;
  px_decimals: number;
  sz_decimals: number;
  tick_size: number;
  lot_size: number;
  min_size: number;
}

export interface CloseAtMarketParams {
  /** Subaccount address (pos.user from account_positions) */
  subaccountAddr: string;
  /** PerpMarket object address (pos.market from account_positions) */
  marketAddr: string;
  /** Position size in decimal (use Math.abs(pos.size)) */
  size: number;
  /** True if long (size > 0), false if short */
  isLong: boolean;
  /** Current mark price from prices API */
  markPx: number;
  /** Market config from v1/markets (px_decimals, tick_size, lot_size, etc.) */
  marketConfig: DecibelMarketConfig;
  /** Slippage in basis points (default 50 = 0.5%). For long/sell use lower price; for short/buy use higher. */
  slippageBps?: number;
  /** Use testnet package address (default: false = mainnet) */
  isTestnet?: boolean;
  /** Builder address for fee (Step 3). If set, builderFeeBps must be set. */
  builderAddr?: string | null;
  /** Builder fee in basis points (e.g. 10 = 0.1%). Must be <= user-approved max. */
  builderFeeBps?: number | null;
}

export interface CloseAtLimitParams {
  subaccountAddr: string;
  marketAddr: string;
  size: number;
  isLong: boolean;
  /** Limit price in human decimal (e.g. 5.67). Will be rounded to tick. */
  limitPrice: number;
  marketConfig: DecibelMarketConfig;
  isTestnet?: boolean;
  builderAddr?: string | null;
  builderFeeBps?: number | null;
}

export interface OpenMarketParams {
  /** Subaccount address */
  subaccountAddr: string;
  /** PerpMarket object address */
  marketAddr: string;
  /** Desired notional in USD (human decimal) */
  orderSizeUsd: number;
  /** Current mark price from prices API */
  markPx: number;
  /** Market config from v1/markets */
  marketConfig: DecibelMarketConfig;
  /** True for long (buy), false for short (sell) */
  isLong: boolean;
  /** Slippage in basis points (default 50 = 0.5%) */
  slippageBps?: number;
  /** Use testnet package address (default: false = mainnet) */
  isTestnet?: boolean;
  /** Optional builder address */
  builderAddr?: string | null;
  /** Optional builder fee in bps */
  builderFeeBps?: number | null;
}

/**
 * Round price to valid tick size and return chain units directly.
 * Uses integer rounding to avoid floating-point errors that cause EPRICE_NOT_RESPECTING_TICKER_SIZE.
 */
function roundPriceToTickChainUnits(
  price: number,
  tickSize: number,
  pxDecimals: number
): number {
  if (price <= 0) return 0;
  const scaledPrice = Math.round(price * 10 ** pxDecimals); // integer in chain units
  return Math.round(scaledPrice / tickSize) * tickSize; // multiple of tickSize
}

/**
 * Round size to lot_size and return chain units directly. Avoids float conversion
 * to prevent ESIZE_NOT_RESPECTING_LOT_SIZE from floating-point drift.
 */
function roundSizeToLotChainUnits(
  size: number,
  lotSize: number,
  minSize: number,
  szDecimals: number
): number {
  if (size <= 0) return 0;
  const denorm = Math.ceil(size * 10 ** szDecimals); // chain units, ceil to not under-close
  const rounded = Math.ceil(denorm / lotSize) * lotSize; // multiple of lot_size
  return Math.max(rounded, minSize);
}

/**
 * Builds the transaction payload for opening a position at market (IOC).
 * Uses place_order_to_subaccount with is_reduce_only=false.
 */
export function buildOpenMarketOrderPayload(params: OpenMarketParams): {
  function: string;
  typeArguments: string[];
  functionArguments: unknown[];
} {
  const {
    subaccountAddr,
    marketAddr,
    orderSizeUsd,
    markPx,
    marketConfig,
    isLong,
    slippageBps = 50,
    isTestnet = false,
    builderAddr = null,
    builderFeeBps = null,
  } = params;

  const pkg = isTestnet ? PACKAGE_TESTNET : PACKAGE_MAINNET;
  const pxDecimals = marketConfig.px_decimals ?? 9;
  const szDecimals = marketConfig.sz_decimals ?? 9;
  const tickSize = marketConfig.tick_size ?? 1_000_000;
  const lotSize = marketConfig.lot_size ?? 100_000_000;
  const minSize = marketConfig.min_size ?? 1_000_000_000;

  // Convert USD notional to base size.
  const size = markPx > 0 ? orderSizeUsd / markPx : 0;
  const chainSize = roundSizeToLotChainUnits(size, lotSize, minSize, szDecimals);

  // For buy/long use higher price; for sell/short use lower price for IOC fill.
  const mult = isLong ? 1 + slippageBps / 10_000 : 1 - slippageBps / 10_000;
  const priceWithSlippage = markPx * mult;
  const chainPrice = roundPriceToTickChainUnits(priceWithSlippage, tickSize, pxDecimals);

  // time_in_force: 0=GoodTillCanceled, 1=PostOnly, 2=ImmediateOrCancel
  const timeInForce = 2;

  return {
    function: `${pkg}::dex_accounts_entry::place_order_to_subaccount`,
    typeArguments: [],
    functionArguments: [
      subaccountAddr,
      marketAddr,
      chainPrice,
      chainSize,
      isLong, // is_buy
      timeInForce,
      false, // is_reduce_only
      null, // client_order_id
      null, // stop_price
      null, // tp_trigger_price
      null, // tp_limit_price
      null, // sl_trigger_price
      null, // sl_limit_price
      builderAddr ?? null, // builder_addr
      builderFeeBps ?? null, // builder_fee
    ],
  };
}

/**
 * Builds the transaction payload for closing a position at market.
 * Returns object suitable for signAndSubmitTransaction({ data: payload }).
 */
export function buildCloseAtMarketPayload(params: CloseAtMarketParams): {
  function: string;
  typeArguments: string[];
  functionArguments: unknown[];
} {
  const {
    subaccountAddr,
    marketAddr,
    size,
    isLong,
    markPx,
    marketConfig,
    slippageBps = 50,
    isTestnet = false,
    builderAddr = null,
    builderFeeBps = null,
  } = params;

  const pkg = isTestnet ? PACKAGE_TESTNET : PACKAGE_MAINNET;
  const pxDecimals = marketConfig.px_decimals ?? 9;
  const szDecimals = marketConfig.sz_decimals ?? 9;
  const tickSize = marketConfig.tick_size ?? 1_000_000;
  const lotSize = marketConfig.lot_size ?? 100_000_000;
  const minSize = marketConfig.min_size ?? 1_000_000_000;

  // For long (sell to close): use lower price for IOC fill. For short (buy to close): use higher price.
  const mult = isLong ? 1 - slippageBps / 10_000 : 1 + slippageBps / 10_000;
  const priceWithSlippage = markPx * mult;
  const chainPrice = roundPriceToTickChainUnits(priceWithSlippage, tickSize, pxDecimals);

  const absSize = Math.abs(size);
  const chainSize = roundSizeToLotChainUnits(absSize, lotSize, minSize, szDecimals);

  // is_buy: long position -> we sell to close -> false; short position -> we buy to close -> true
  const isBuy = !isLong;

  // time_in_force: 0=GoodTillCanceled, 1=PostOnly, 2=ImmediateOrCancel
  const timeInForce = 2;

  return {
    function: `${pkg}::dex_accounts_entry::place_order_to_subaccount`,
    typeArguments: [],
    functionArguments: [
      subaccountAddr,
      marketAddr,
      chainPrice,
      chainSize,
      isBuy,
      timeInForce,
      true, // is_reduce_only
      null, // client_order_id
      null, // stop_price
      null, // tp_trigger_price
      null, // tp_limit_price
      null, // sl_trigger_price
      null, // sl_limit_price
      builderAddr ?? null, // builder_addr
      builderFeeBps ?? null, // builder_fee
    ],
  };
}

/**
 * Builds the transaction payload for closing a position at limit (GTC).
 * Same entry point as market close but time_in_force=GoodTillCanceled and user's limit price.
 */
export function buildCloseAtLimitPayload(params: CloseAtLimitParams): {
  function: string;
  typeArguments: string[];
  functionArguments: unknown[];
} {
  const {
    subaccountAddr,
    marketAddr,
    size,
    isLong,
    limitPrice,
    marketConfig,
    isTestnet = false,
    builderAddr = null,
    builderFeeBps = null,
  } = params;

  const pkg = isTestnet ? PACKAGE_TESTNET : PACKAGE_MAINNET;
  const pxDecimals = marketConfig.px_decimals ?? 9;
  const szDecimals = marketConfig.sz_decimals ?? 9;
  const tickSize = marketConfig.tick_size ?? 1_000_000;
  const lotSize = marketConfig.lot_size ?? 100_000_000;
  const minSize = marketConfig.min_size ?? 1_000_000_000;

  const chainPrice = roundPriceToTickChainUnits(limitPrice, tickSize, pxDecimals);
  const absSize = Math.abs(size);
  const chainSize = roundSizeToLotChainUnits(absSize, lotSize, minSize, szDecimals);
  const isBuy = !isLong;

  // time_in_force: 0=GoodTillCanceled (limit order stays in book until filled or cancelled)
  const timeInForce = 0;

  return {
    function: `${pkg}::dex_accounts_entry::place_order_to_subaccount`,
    typeArguments: [],
    functionArguments: [
      subaccountAddr,
      marketAddr,
      chainPrice,
      chainSize,
      isBuy,
      timeInForce,
      true, // is_reduce_only
      null, // client_order_id
      null, // stop_price
      null, // tp_trigger_price
      null, // tp_limit_price
      null, // sl_trigger_price
      null, // sl_limit_price
      builderAddr ?? null,
      builderFeeBps ?? null,
    ],
  };
}

/**
 * Build transaction payload to cancel an open order by order_id.
 * @see https://docs.decibel.trade/developer-hub/on-chain/order-management/cancel-order
 */
export function buildCancelOrderPayload(params: {
  subaccountAddr: string;
  marketAddr: string;
  /** Order ID from open_orders API (string, u128 on-chain) */
  orderId: string;
  isTestnet?: boolean;
}): {
  function: string;
  typeArguments: string[];
  functionArguments: unknown[];
} {
  const { subaccountAddr, marketAddr, orderId, isTestnet = false } = params;
  const pkg = isTestnet ? PACKAGE_TESTNET : PACKAGE_MAINNET;
  // order_id is u128 on-chain; pass as BigInt for SDK (large IDs exceed Number.MAX_SAFE_INTEGER)
  const orderIdBigInt = BigInt(orderId);
  return {
    function: `${pkg}::dex_accounts_entry::cancel_order_to_subaccount`,
    typeArguments: [],
    functionArguments: [subaccountAddr, orderIdBigInt, marketAddr],
  };
}
