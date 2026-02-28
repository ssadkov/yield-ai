/**
 * Build transaction payload for approving max builder fee (Step 2).
 * User signs once; then orders can include builder_addr and builder_fee.
 *
 * @see docs/decibel-builder-integration.md Step 2
 */

import { PACKAGE_MAINNET, PACKAGE_TESTNET } from './closePosition';

export interface ApproveBuilderFeeParams {
  /** User's subaccount address (primary from GET subaccounts) */
  subaccountAddr: string;
  /** Builder address (64-char hex) */
  builderAddr: string;
  /** Max fee in basis points (e.g. 10 = 0.1%) */
  maxFeeBps: number;
  /** Use testnet package (default: false = mainnet) */
  isTestnet?: boolean;
}

export function buildApproveBuilderFeePayload(params: ApproveBuilderFeeParams): {
  function: string;
  typeArguments: string[];
  functionArguments: unknown[];
} {
  const { subaccountAddr, builderAddr, maxFeeBps, isTestnet = false } = params;
  const pkg = isTestnet ? PACKAGE_TESTNET : PACKAGE_MAINNET;

  return {
    function: `${pkg}::dex_accounts_entry::approve_max_builder_fee_for_subaccount`,
    typeArguments: [],
    functionArguments: [subaccountAddr, builderAddr, maxFeeBps],
  };
}
