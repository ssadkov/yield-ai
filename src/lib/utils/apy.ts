const RAY_BIGINT = BigInt(10) ** BigInt(27);

function clampNumber(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value === 0) return 0;
  if (value === Infinity) return Number.MAX_VALUE;
  if (value === -Infinity) return -Number.MAX_VALUE;
  return value;
}

/**
 * Converts a raw ray-based rate (as used by Aave-style protocols) into a decimal APR.
 * Echo front-end displays simple (non-compounded) APR percentages, so we mirror that here.
 * @param rawRate string representation of the rate in ray units (1e27 precision)
 * @returns APR as a decimal (e.g. 0.1274 = 12.74%)
 */
export function calculateApyFromRay(rawRate: string): number {
  if (!rawRate) return 0;

  try {
    const rateBigInt = BigInt(rawRate);
    if (rateBigInt <= BigInt(0)) return 0;
    const rate = Number(rateBigInt) / Number(RAY_BIGINT);
    return clampNumber(rate);
  } catch {
    const rate = clampNumber(Number.parseFloat(rawRate));
    if (!rate || rate <= 0) return 0;
    return clampNumber(rate / Number(RAY_BIGINT));
  }
}

/**
 * Formats a ray-based rate into a human readable percentage string.
 */
export function formatApyFromRay(rawRate: string, fractionDigits = 2): string {
  const apyDecimal = calculateApyFromRay(rawRate);
  const percentage = apyDecimal * 100;
  return `${percentage.toFixed(fractionDigits)}%`;
}

export interface ReserveApyMetrics {
  supplyApy: number;
  borrowApy: number;
  supplyApyFormatted: string;
  borrowApyFormatted: string;
}

export interface EchoReserveData {
  current_liquidity_rate?: string;
  current_variable_borrow_rate?: string;
}

export function getReserveApyMetrics(reserve: EchoReserveData): ReserveApyMetrics {
  const supplyApy = calculateApyFromRay(reserve.current_liquidity_rate ?? '0');
  const borrowApy = calculateApyFromRay(reserve.current_variable_borrow_rate ?? '0');

  return {
    supplyApy,
    borrowApy,
    supplyApyFormatted: formatApyFromRay(reserve.current_liquidity_rate ?? '0'),
    borrowApyFormatted: formatApyFromRay(reserve.current_variable_borrow_rate ?? '0'),
  };
}

