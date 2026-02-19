/**
 * Compute a display return/APR for Decibel vaults when the API does not return an explicit apr.
 * Uses PublicVaultDto-style fields: all_time_return, past_month_return, pnl_90d, net_deposits.
 *
 * Decibel API returns all_time_return and past_month_return as PERCENTAGE (e.g. 19.4572 = 19.46%).
 * We do NOT annualize all_time_return: in Decibel UX it is shown as "All Time Return" (total
 * since vault inception), and the user may have deposited later — so we show the same number.
 *
 * References:
 * - Account-owned vaults: GET /api/v1/account_owned_vaults returns apr directly (VaultDto.apr).
 * - Account vault performance: GET /api/v1/account_vault_performance returns vault (PublicVaultDto).
 * @see https://docs.decibel.trade/api-reference/vaults/get-account-owned-vaults
 * @see https://docs.decibel.trade/api-reference/vaults/get-account-vault-performance-for-all-vaults-where-account-has-deposits
 */

export interface PublicVaultDtoLike {
  apr?: number | null;
  all_time_return?: number | null;
  past_month_return?: number | null;
  pnl_90d?: number | null;
  net_deposits?: number | null;
  created_at?: number | null;
}

const DAYS_PER_YEAR = 365;
const DAYS_90 = 90;
const MONTHS_PER_YEAR = 12;

/**
 * Derives a return to display (decimal, e.g. 0.1946 = 19.46%) from vault metrics.
 * - past_month_return: annualized to APR (1 + r/100)^12 - 1.
 * - pnl_90d / net_deposits: annualized to APR (1 + r)^(365/90) - 1.
 * - all_time_return: used as-is (vault's all-time return in %, we return ÷100). Not annualized,
 *   to match Decibel UX and avoid inflated numbers for young vaults.
 * Returns null if no usable metric or API already provided apr.
 */
export function deriveVaultApr(vault: PublicVaultDtoLike | null | undefined): number | null {
  if (!vault) return null;
  if (typeof vault.apr === 'number' && Number.isFinite(vault.apr)) return vault.apr;

  // Prefer past month return (annualized): APR = (1 + r_month)^12 - 1
  const pastMonth = vault.past_month_return;
  if (typeof pastMonth === 'number' && Number.isFinite(pastMonth) && pastMonth > -100) {
    const rDecimal = pastMonth / 100;
    const apr = Math.pow(1 + rDecimal, MONTHS_PER_YEAR) - 1;
    return Number.isFinite(apr) ? apr : null;
  }

  // Else 90d return: return_90d = pnl_90d / net_deposits, annualize
  const pnl90 = vault.pnl_90d;
  const netDep = vault.net_deposits;
  if (
    typeof pnl90 === 'number' &&
    Number.isFinite(pnl90) &&
    typeof netDep === 'number' &&
    netDep > 0
  ) {
    const return90d = pnl90 / netDep;
    if (Number.isFinite(return90d) && return90d > -1) {
      const apr = Math.pow(1 + return90d, DAYS_PER_YEAR / DAYS_90) - 1;
      return Number.isFinite(apr) ? apr : null;
    }
  }

  // Else vault all-time return: show as-is (same as Decibel "All Time Return"). Not annualized.
  const allTime = vault.all_time_return;
  if (typeof allTime === 'number' && Number.isFinite(allTime) && allTime > -100) {
    return allTime / 100;
  }

  return null;
}

/**
 * Format derived APR for display (percentage, 2 decimals). Returns "—" if null.
 */
export function formatVaultApr(apr: number | null | undefined): string {
  if (apr == null || !Number.isFinite(apr)) return '—';
  return `${(apr * 100).toFixed(2)}%`;
}
