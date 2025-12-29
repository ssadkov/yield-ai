/**
 * Helper functions to create Wormhole SDK signers from wallet adapters
 */

import { Connection, Transaction, VersionedTransaction } from '@solana/web3.js';

/**
 * Create Solana signer from Phantom wallet
 */
export async function createSolanaSigner(
  phantom: any,
  rpcUrl: string
): Promise<any> {
  if (!phantom || !phantom.isPhantom) {
    throw new Error('Phantom wallet not found');
  }

  if (!phantom.isConnected) {
    await phantom.connect();
  }

  const connection = new Connection(rpcUrl, 'confirmed');
  const publicKey = phantom.publicKey;

  return {
    address: () => publicKey.toString(),
    chain: () => 'Solana' as const,
    signAndSendTx: async (tx: Transaction | VersionedTransaction) => {
      // Sign transaction with Phantom
      const signed = await phantom.signTransaction(tx);
      
      // Send transaction
      if (signed instanceof VersionedTransaction) {
        const signature = await connection.sendRawTransaction(signed.serialize());
        await connection.confirmTransaction(signature, 'confirmed');
        return signature;
      } else {
        const signature = await connection.sendRawTransaction(signed.serialize());
        await connection.confirmTransaction(signature, 'confirmed');
        return signature;
      }
    },
  };
}

/**
 * Create Aptos signer from wallet adapter
 */
export function createAptosSigner(
  address: string,
  signAndSubmitTransaction: (transaction: any) => Promise<{ hash: string }>
): any {
  return {
    address: () => address,
    chain: () => 'Aptos' as const,
    signAndSendTx: async (tx: any) => {
      // Use Aptos wallet adapter to sign and submit
      // The transaction should be in the format expected by the wallet adapter
      const result = await signAndSubmitTransaction(tx);
      return result.hash;
    },
  };
}

