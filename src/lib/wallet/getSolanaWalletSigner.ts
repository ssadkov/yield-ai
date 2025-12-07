/**
 * Utility to get Solana wallet signer from connected wallet
 * This allows signing Solana transactions directly via Phantom wallet
 */

export interface SolanaWalletSigner {
  publicKey: string;
  signTransaction: (transaction: any) => Promise<any>;
  signAllTransactions?: (transactions: any[]) => Promise<any[]>;
}

/**
 * Get Solana wallet signer from Phantom wallet
 * Accesses Phantom directly via window.solana
 */
export async function getSolanaWalletSigner(): Promise<SolanaWalletSigner | null> {
  if (typeof window === 'undefined') {
    return null;
  }

  // Check if Phantom wallet is available
  const phantom = (window as any).solana;
  if (!phantom || !phantom.isPhantom) {
    console.warn('Phantom wallet not detected');
    return null;
  }

  // Check if wallet is connected
  if (!phantom.isConnected) {
    try {
      // Try to connect
      const response = await phantom.connect();
      if (!response.publicKey) {
        return null;
      }
    } catch (error) {
      console.error('Failed to connect Phantom wallet:', error);
      return null;
    }
  }

  const publicKey = phantom.publicKey;
  if (!publicKey) {
    return null;
  }

  return {
    publicKey: publicKey.toString(),
    signTransaction: async (transaction: any) => {
      if (!phantom.signTransaction) {
        throw new Error('Phantom wallet does not support signTransaction');
      }
      return await phantom.signTransaction(transaction);
    },
    signAllTransactions: phantom.signAllTransactions
      ? async (transactions: any[]) => {
          return await phantom.signAllTransactions(transactions);
        }
      : undefined,
  };
}

/**
 * Get Solana public key from Phantom wallet
 */
export async function getSolanaPublicKey(): Promise<string | null> {
  const signer = await getSolanaWalletSigner();
  return signer?.publicKey || null;
}

