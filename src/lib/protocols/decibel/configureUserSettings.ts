/**
 * Build transaction payload for configuring user leverage and margin mode per market.
 * Calls dex_accounts_entry::configure_user_settings_for_market.
 * @see https://docs.decibel.trade/typescript-sdk/write-sdk (configureUserSettingsForMarket)
 */

import { PACKAGE_MAINNET, PACKAGE_TESTNET } from './closePosition';

export interface ConfigureUserSettingsParams {
  subaccountAddr: string;
  marketAddr: string;
  /** Cross-margin (true) or isolated (false) */
  isCross: boolean;
  /** Leverage multiplier, e.g. 20 for 20x */
  userLeverage: number;
  isTestnet?: boolean;
}

export function buildConfigureUserSettingsPayload(params: ConfigureUserSettingsParams): {
  function: string;
  typeArguments: string[];
  functionArguments: unknown[];
} {
  const { subaccountAddr, marketAddr, isCross, userLeverage, isTestnet = false } = params;
  const pkg = isTestnet ? PACKAGE_TESTNET : PACKAGE_MAINNET;
  return {
    function: `${pkg}::dex_accounts_entry::configure_user_settings_for_market`,
    typeArguments: [],
    functionArguments: [subaccountAddr, marketAddr, isCross, userLeverage],
  };
}
