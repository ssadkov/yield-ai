import type { AdapterWallet } from "@aptos-labs/wallet-adapter-core";

/**
 * Extract Solana public key (base58) from an Aptos cross-chain wallet, if available.
 *
 * @param wallet Adapter wallet returned by the Aptos wallet adapter.
 * @returns Solana public key string or null when not present.
 */
export function getSolanaWalletAddress(wallet: AdapterWallet | null): string | null {
  if (!wallet) {
    return null;
  }

  const maybeDerivedWallet = wallet as unknown as {
    solanaWallet?: { publicKey?: { toBase58: () => string } };
  };

  try {
    const publicKey = maybeDerivedWallet.solanaWallet?.publicKey;
    const address = publicKey ? publicKey.toBase58() : null;
    
    console.log('[getSolanaWalletAddress] Extracting address:', {
      walletName: wallet.name,
      hasSolanaWallet: !!maybeDerivedWallet.solanaWallet,
      hasPublicKey: !!publicKey,
      address,
    });
    
    return address;
  } catch (e) {
    console.log('[getSolanaWalletAddress] Error:', e);
    return null;
  }
}

