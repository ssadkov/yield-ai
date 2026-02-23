/**
 * Build transaction payload for closing a Decibel perps position at market (IOC).
 * Uses place_order_to_subaccount with time_in_force=ImmediateOrCancel and is_reduce_only=true.
 *
 * @see https://docs.decibel.trade/developer-hub/on-chain/order-management/place-order
 * @see https://docs.decibel.trade/developer-hub/on-chain/overview/formatting-prices-sizes
 * @see https://docs.decibel.trade/developer-hub/on-chain/overview/contract-reference
 */

export const PACKAGE_MAINNET = '0xb8a5788314451ce4d2fbbad32e1bad88d4184b73943b7fe5166eab93cf1a5a95';
// Aptos Testnet (api.testnet.aptoslabs.com) - from docs.decibel.trade/quickstart/placing-your-first-order
export const PACKAGE_TESTNET = '0x952535c3049e52f195f26798c2f1340d7dd5100edbe0f464e520a974d16fbe9f';

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
      null, // builder_addr
      null, // builder_fee
    ],
  };
}
