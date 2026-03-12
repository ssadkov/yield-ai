/**
 * Yield AI Vault contract (mainnet).
 * Module: 0x333d1890e0aa3762bb256f5caeeb142431862628c63063801f44c152ef154700::vault
 */
export const YIELD_AI_VAULT_MODULE =
  "0x333d1890e0aa3762bb256f5caeeb142431862628c63063801f44c152ef154700::vault";

export const VAULT_VIEW = {
  safeRefExists: `${YIELD_AI_VAULT_MODULE}::safe_ref_exists`,
  getSafeCount: `${YIELD_AI_VAULT_MODULE}::get_safe_count`,
  getSafeAddress: `${YIELD_AI_VAULT_MODULE}::get_safe_address`,
} as const;

export const APTOS_COIN_TYPE = "0x1::aptos_coin::AptosCoin";
export const COIN_BALANCE_VIEW = "0x1::coin::balance";
