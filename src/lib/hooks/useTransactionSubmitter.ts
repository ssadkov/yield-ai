'use client';

import { useCallback } from 'react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import {
  Account,
  AccountAuthenticator,
  AccountAuthenticatorSingleKey,
  AnyPublicKey,
  AnySignature,
  Deserializer,
  Ed25519PrivateKey,
  Ed25519PublicKey,
  Ed25519Signature,
} from '@aptos-labs/ts-sdk';
import { useAptosClient } from '@/contexts/AptosClientContext';

interface TransactionPayload {
  function: string;
  typeArguments: string[];
  functionArguments: any[];
}

interface TransactionOptions {
  maxGasAmount?: number;
  gasUnitPrice?: number;
}

export interface TransactionRequest {
  data: TransactionPayload;
  options?: TransactionOptions;
}

export function normalizeAuthenticator(authenticatorData: any): AccountAuthenticator {
  try {
    if (authenticatorData instanceof AccountAuthenticator) {
      return authenticatorData;
    }

    if (authenticatorData instanceof Uint8Array) {
      return AccountAuthenticator.deserialize(new Deserializer(authenticatorData));
    }

    if (authenticatorData instanceof AccountAuthenticatorSingleKey) {
      return authenticatorData;
    }

    const publicKeyData = authenticatorData?.public_key?.key?.data;
    const signatureData = authenticatorData?.signature?.data?.data;

    if (publicKeyData && signatureData) {
      const pubKeyArray = new Uint8Array(Object.values(publicKeyData));
      const sigArray = new Uint8Array(Object.values(signatureData));

      const ed25519PublicKey = new Ed25519PublicKey(pubKeyArray);
      const ed25519Signature = new Ed25519Signature(sigArray);

      const publicKey = new AnyPublicKey(ed25519PublicKey);
      const signature = new AnySignature(ed25519Signature);

      return new AccountAuthenticatorSingleKey(publicKey, signature);
    }

    console.warn('Could not normalize authenticator, returning original:', authenticatorData);
    return authenticatorData as AccountAuthenticator;
  } catch (error) {
    console.error('Error normalizing authenticator:', error);
    return authenticatorData as AccountAuthenticator;
  }
}

export function getFeePayerAccount() {
  const privateKeyHex = process.env.NEXT_PUBLIC_FEE_PAYER_PRIVATE_KEY;
  const address = process.env.NEXT_PUBLIC_FEE_PAYER_ADDRESS;

  if (!privateKeyHex) {
    return null;
  }

  try {
    const account = Account.fromPrivateKey({ privateKey: new Ed25519PrivateKey(privateKeyHex) });

    if (address && account.accountAddress.toString().toLowerCase() !== address.toLowerCase()) {
      console.warn('Fee payer address mismatch between env and derived key:', address, account.accountAddress.toString());
    }

    return account;
  } catch (error) {
    console.error('Failed to create fee payer account from env variables:', error);
    return null;
  }
}

export function useTransactionSubmitter() {
  const wallet = useWallet();
  const aptosClient = useAptosClient();

  const submitTransaction = useCallback(
    async (request: TransactionRequest) => {
      if (!wallet.connected || !wallet.account) {
        throw new Error('Wallet not connected');
      }

      const sender = wallet.account.address;
      const feePayerAccount = getFeePayerAccount();
      const useFeePayer = Boolean(feePayerAccount);

      const transaction = await aptosClient.transaction.build.simple({
        sender,
        withFeePayer: useFeePayer,
        data: {
          function: request.data.function as `${string}::${string}::${string}`,
          typeArguments: request.data.typeArguments,
          functionArguments: request.data.functionArguments,
        },
        options: {
          maxGasAmount: request.options?.maxGasAmount ?? 2000,
          gasUnitPrice: request.options?.gasUnitPrice ?? 100,
        },
      });

      if (feePayerAccount) {
        transaction.feePayerAddress = feePayerAccount.accountAddress;
      }

      if (!useFeePayer && wallet.signAndSubmitTransaction) {
        try {
          return await wallet.signAndSubmitTransaction(transaction as any);
        } catch (error) {
          console.warn('signAndSubmitTransaction failed, falling back to manual path', error);
        }
      }

      if (!wallet.signTransaction) {
        throw new Error('Wallet does not support signTransaction');
      }

      const walletResult = await wallet.signTransaction({
        transactionOrPayload: transaction,
      } as any);

      const senderAuthenticator = normalizeAuthenticator((walletResult as any)?.authenticator ?? walletResult);

      if (!feePayerAccount) {
        return aptosClient.transaction.submit.simple({
          transaction,
          senderAuthenticator,
        });
      }

      const feePayerAuthenticator = aptosClient.transaction.signAsFeePayer({
        signer: feePayerAccount,
        transaction,
      });

      return aptosClient.transaction.submit.simple({
        transaction,
        senderAuthenticator,
        feePayerAuthenticator,
      });
    },
    [wallet, aptosClient],
  );

  return {
    submitTransaction,
    isConnected: wallet.connected,
    hasSignAndSubmitTransaction: !!wallet.signAndSubmitTransaction,
    hasSignTransaction: !!wallet.signTransaction,
    address: wallet.account?.address,
  };
} 