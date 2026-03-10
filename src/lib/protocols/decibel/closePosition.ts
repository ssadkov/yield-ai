/**
 * Build transaction payload for closing a Decibel perps position at market (IOC).
 * Uses place_order_to_subaccount with time_in_force=ImmediateOrCancel and is_reduce_only=true.
 *
 * Argument order and types must match the contract ABI (15 args):
 * @see https://docs.decibel.trade/developer-hub/on-chain/order-management/place-order
 * @see https://docs.decibel.trade/developer-hub/on-chain/overview/formatting-prices-sizes
 * @see https://docs.decibel.trade/developer-hub/on-chain/overview/contract-reference
 */

import { toCanonicalAddressFromAny } from '@/lib/utils/addressNormalization';

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
export function roundSizeToLotChainUnits(
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
 * Builds the transaction payload for closing a position at market.
 * Returns object suitable for signAndSubmitTransaction({ data: payload }).
 */
export function buildCloseAtMarketPayload(params: CloseAtMarketParams): {
  function: string;
  typeArguments: string[];
  functionArguments: unknown[];
} {
  const {
    subaccountAddr: subaccountAddrRaw,
    marketAddr: marketAddrRaw,
    size,
    isLong,
    markPx,
    marketConfig,
    slippageBps = 50,
    isTestnet = false,
    builderAddr = null,
    builderFeeBps = null,
  } = params;

  const subaccountAddr = toCanonicalAddressFromAny(subaccountAddrRaw);
  const marketAddr = toCanonicalAddressFromAny(marketAddrRaw);
  const builderAddrCanonical =
    builderAddr != null && builderAddr !== '' ? toCanonicalAddressFromAny(builderAddr) : null;

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
      builderAddrCanonical ?? null, // builder_address (Option<address>) — per Decibel docs
      builderFeeBps ?? null, // builder_fees (Option<u64>) — per Decibel docs
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
    subaccountAddr: subaccountAddrRaw,
    marketAddr: marketAddrRaw,
    size,
    isLong,
    limitPrice,
    marketConfig,
    isTestnet = false,
    builderAddr = null,
    builderFeeBps = null,
  } = params;

  const subaccountAddr = toCanonicalAddressFromAny(subaccountAddrRaw);
  const marketAddr = toCanonicalAddressFromAny(marketAddrRaw);
  const builderAddrCanonical =
    builderAddr != null && builderAddr !== '' ? toCanonicalAddressFromAny(builderAddr) : null;

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
      builderAddrCanonical ?? null, // builder_address (Option<address>) — per Decibel docs
      builderFeeBps ?? null, // builder_fees (Option<u64>) — per Decibel docs
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
  const { subaccountAddr: subaccountAddrRaw, marketAddr: marketAddrRaw, orderId, isTestnet = false } = params;
  const subaccountAddr = toCanonicalAddressFromAny(subaccountAddrRaw);
  const marketAddr = toCanonicalAddressFromAny(marketAddrRaw);
  const pkg = isTestnet ? PACKAGE_TESTNET : PACKAGE_MAINNET;
  // order_id is u128 on-chain; pass as BigInt for SDK (large IDs exceed Number.MAX_SAFE_INTEGER)
  const orderIdBigInt = BigInt(orderId);
  return {
    function: `${pkg}::dex_accounts_entry::cancel_order_to_subaccount`,
    typeArguments: [],
    functionArguments: [subaccountAddr, orderIdBigInt, marketAddr],
  };
}

/** Params for opening a market order (IOC). Order size in USD, converted to base using mark price. */
export interface OpenMarketOrderParams {
  subaccountAddr: string;
  marketAddr: string;
  /** Order size in USD (will be converted to base size = orderSizeUsd / markPx) */
  orderSizeUsd: number;
  markPx: number;
  marketConfig: DecibelMarketConfig;
  /** true = long (buy), false = short (sell) */
  isLong: boolean;
  slippageBps?: number;
  isTestnet?: boolean;
  builderAddr?: string | null;
  builderFeeBps?: number | null;
}

/**
 * Builds the transaction payload for opening a position at market (IOC).
 * Same entry point as close but is_reduce_only=false and size derived from orderSizeUsd / markPx.
 */
export function buildOpenMarketOrderPayload(params: OpenMarketOrderParams): {
  function: string;
  typeArguments: string[];
  functionArguments: unknown[];
} {
  const {
    subaccountAddr: subaccountAddrRaw,
    marketAddr: marketAddrRaw,
    orderSizeUsd,
    markPx,
    marketConfig,
    isLong,
    slippageBps = 50,
    isTestnet = false,
    builderAddr = null,
    builderFeeBps = null,
  } = params;

  // Decibel API may return addresses as decimal strings; chain/wallet expect 0x hex. Otherwise we get "X is out of range: [0, u64_max]".
  const subaccountAddr = toCanonicalAddressFromAny(subaccountAddrRaw);
  const marketAddr = toCanonicalAddressFromAny(marketAddrRaw);
  const builderAddrCanonical =
    builderAddr != null && builderAddr !== '' ? toCanonicalAddressFromAny(builderAddr) : null;

  const pkg = isTestnet ? PACKAGE_TESTNET : PACKAGE_MAINNET;
  const pxDecimals = Math.min(Number(marketConfig.px_decimals) || 9, 24);
  const szDecimals = Math.min(Number(marketConfig.sz_decimals) || 9, 24);
  const tickSize = Number(marketConfig.tick_size) || 1_000_000;
  const lotSize = Number(marketConfig.lot_size) || 100_000_000;
  const minSize = Number(marketConfig.min_size) || 1_000_000_000;

  const sizeInBase = orderSizeUsd / markPx;
  const chainSize = roundSizeToLotChainUnits(sizeInBase, lotSize, minSize, szDecimals);
  if (chainSize <= 0) {
    throw new Error('Order size too small after rounding to lot size');
  }

  const isBuy = isLong;
  const mult = isBuy ? 1 + slippageBps / 10_000 : 1 - slippageBps / 10_000;
  const priceWithSlippage = markPx * mult;
  const chainPrice = roundPriceToTickChainUnits(priceWithSlippage, tickSize, pxDecimals);

  const timeInForce = 2; // ImmediateOrCancel

  // Same format as buildCloseAtMarketPayload / buildCloseAtLimitPayload: pass u64 as number (works in Decibel close flow)
  const MAX_SAFE_U64 = Number.MAX_SAFE_INTEGER; // 2^53-1; larger numbers lose precision as JS number
  if (chainPrice > MAX_SAFE_U64 || chainPrice < 0 || !Number.isFinite(chainPrice)) {
    throw new Error(`Chain price out of safe range: ${chainPrice}. Check market config (px_decimals, tick_size).`);
  }
  if (chainSize > MAX_SAFE_U64 || chainSize < 0 || !Number.isFinite(chainSize)) {
    throw new Error(`Chain size out of safe range: ${chainSize}. Check market config (sz_decimals, lot_size).`);
  }

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
      false, // is_reduce_only
      null, // client_order_id
      null, // stop_price
      null, // tp_trigger_price
      null, // tp_limit_price
      null, // sl_trigger_price
      null, // sl_limit_price
      builderAddrCanonical ?? null, // builder_address (Option<address>) — per Decibel docs
      builderFeeBps ?? null, // builder_fees (Option<u64>) — per Decibel docs
    ],
  };
}
