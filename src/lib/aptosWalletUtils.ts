const SOLANA_SUFFIX = " (Solana)";
const APTOS_WALLET_NAME_KEY = "AptosWalletName";

/**
 * Derived Aptos wallets are created from Solana wallets (e.g. Trust, Phantom)
 * and have name in the form "WalletName (Solana)". Native Aptos wallets (Petra, etc.) do not.
 * The adapter may or may not set isAptosNativeWallet; we determine by name for consistency.
 */
export function isDerivedAptosWallet(
  wallet: { name?: string } | null | undefined
): boolean {
  return Boolean(
    wallet?.name != null && String(wallet.name).trim().endsWith(SOLANA_SUFFIX)
  );
}

/**
 * Returns the stored Aptos wallet name from localStorage (what the adapter/user selected).
 * Used as source of truth for derived vs native: "X (Solana)" = derived.
 */
export function getAptosWalletNameFromStorage(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(APTOS_WALLET_NAME_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as string | null;
      return typeof parsed === "string" ? parsed : null;
    } catch {
      // Some adapters may store plain string, not JSON
      return typeof raw === "string" && raw.length > 0 ? raw : null;
    }
  } catch {
    return null;
  }
}

/**
 * Reliable derived vs native: use localStorage AptosWalletName first (adapter writes it on connect).
 * If stored name ends with " (Solana)" → derived. If set and not → native. Else fallback to wallet.name.
 */
export function isDerivedAptosWalletReliable(
  wallet: { name?: string } | null | undefined
): boolean {
  const stored = getAptosWalletNameFromStorage();
  if (stored != null && stored !== "") {
    if (String(stored).trim().endsWith(SOLANA_SUFFIX)) return true;
    return false;
  }
  return isDerivedAptosWallet(wallet);
}
