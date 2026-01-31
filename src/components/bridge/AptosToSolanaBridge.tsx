"use client";

import bs58 from "bs58";
import { AccountAddress } from "@aptos-labs/ts-sdk";
import { signAptosTransactionWithSolana } from "@aptos-labs/derived-wallet-solana";
import { StandardWalletAdapter as SolanaWalletAdapter } from "@solana/wallet-standard-wallet-adapter-base";
import { UserResponseStatus } from "@aptos-labs/wallet-standard";
import type { Aptos } from "@aptos-labs/ts-sdk";
import { normalizeAuthenticator } from "@/lib/hooks/useTransactionSubmitter";
import { isDerivedAptosWallet } from "@/lib/aptosWalletUtils";

const USDC_SOLANA = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const USDC_APTOS = "0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b";
const CCTP_DEPOSIT_FOR_BURN_ENTRY_FUNCTION =
  "0x35e75139eea19566dc8ac00be056e9bd605e788370d76e8bacf87177aeb32dac::cctp_tools::deposit_for_burn";
const DOMAIN_SOLANA = 5;

function solanaAddressToHexBytes(solanaAddress: string): Uint8Array {
  const decoded = bs58.decode(solanaAddress);
  return new Uint8Array(decoded);
}

async function getSolanaTokenAccountAddress(
  ownerPublicKey: string,
  mintAddress: string
): Promise<string> {
  const { getAssociatedTokenAddress } = await import("@solana/spl-token");
  const { PublicKey } = await import("@solana/web3.js");
  const ownerPubkey = new PublicKey(ownerPublicKey);
  const mintPubkey = new PublicKey(mintAddress);
  const ataAddress = await getAssociatedTokenAddress(mintPubkey, ownerPubkey, false);
  return ataAddress.toBase58();
}

async function getAptosExpireTimestampSecs(ttlSeconds: number = 1800): Promise<number | undefined> {
  try {
    const res = await fetch("https://fullnode.mainnet.aptoslabs.com/v1");
    if (!res.ok) return undefined;
    const ledgerInfo = await res.json();
    if (!ledgerInfo.ledger_timestamp) return undefined;
    const ledgerTimestamp = parseInt(ledgerInfo.ledger_timestamp, 10);
    if (Number.isNaN(ledgerTimestamp)) return undefined;
    return Math.floor(ledgerTimestamp / 1_000_000) + ttlSeconds;
  } catch {
    return undefined;
  }
}

export interface ExecuteAptosToSolanaBridgeParams {
  amount: string;
  aptosAccount: { address: { toString: () => string } };
  aptosWallet: {
    name?: string;
    isAptosNativeWallet?: boolean;
    features?: { "aptos:signTransaction"?: { signTransaction: (tx: unknown) => Promise<{ status: number; args?: unknown }> } };
    authenticationFunction?: string;
    domain?: string;
  };
  aptosClient: Aptos;
  solanaPublicKey: { toBase58: () => string };
  solanaWallet: unknown;
  signMessage: ((msg: Uint8Array) => Promise<Uint8Array>) | undefined;
  transactionSubmitter: { submitTransaction: (arg: unknown) => Promise<{ hash: string }> } | null;
  destinationSolanaAddress: string;
  onStatusUpdate: (status: string) => void;
}

/**
 * Выполняет burn USDC на Aptos (CCTP deposit_for_burn) для направления Aptos (derived) → Solana.
 * Ожидается derived-кошелёк (Aptos от Solana). Возвращает хэш транзакции Aptos.
 */
export async function executeAptosToSolanaBridge(
  params: ExecuteAptosToSolanaBridgeParams
): Promise<string> {
  const {
    amount,
    aptosAccount,
    aptosWallet,
    aptosClient,
    solanaPublicKey,
    solanaWallet,
    signMessage,
    transactionSubmitter,
    destinationSolanaAddress,
    onStatusUpdate,
  } = params;

  const amountNum = parseFloat(amount);
  if (isNaN(amountNum) || amountNum <= 0) {
    throw new Error("Please enter a valid amount");
  }
  const amountOctas = BigInt(Math.floor(amountNum * 1_000_000));
  const isDerivedWallet = isDerivedAptosWallet(aptosWallet);
  const useGasStation = !!transactionSubmitter;

  if (!isDerivedWallet) {
    throw new Error("Aptos → Solana bridge supports only derived (Solana-based) Aptos wallet. Please use the Aptos wallet linked to your Solana wallet.");
  }

  // Circle CCTP: when Solana is DESTINATION (burn on Aptos, mint on Solana), mint_recipient = hex-encoded USDC token account (ATA), not wallet.
  // https://developers.circle.com/cctp/v1/solana-programs (Mint Recipient for Solana as Destination Chain Transfers)
  onStatusUpdate("Computing Solana token account address (ATA)...");
  const tokenAccountAddress = await getSolanaTokenAccountAddress(
    destinationSolanaAddress,
    USDC_SOLANA
  );
  const mintRecipientBytes = solanaAddressToHexBytes(tokenAccountAddress);
  const mintRecipientAddress = AccountAddress.from(mintRecipientBytes).toString();
  const burnTokenObjectId = USDC_APTOS;

  const ttlSeconds = useGasStation ? 100 : 1800;
  const expireTimestamp = await getAptosExpireTimestampSecs(ttlSeconds);

  onStatusUpdate("Building entry function transaction...");
  const transaction = await aptosClient.transaction.build.simple({
    sender: aptosAccount.address as any,
    withFeePayer: useGasStation,
    data: {
      function: CCTP_DEPOSIT_FOR_BURN_ENTRY_FUNCTION as `${string}::${string}::${string}`,
      typeArguments: [],
      functionArguments: [
        amountOctas.toString(),
        DOMAIN_SOLANA.toString(),
        mintRecipientAddress,
        burnTokenObjectId,
      ],
    },
    options: {
      maxGasAmount: 100000,
      gasUnitPrice: 100,
      ...(expireTimestamp ? { expireTimestamp } : {}),
    },
  });

  const authenticationFunction =
    (aptosWallet as any)?.authenticationFunction || "0x1::solana_derivable_account::authenticate";
  const domain =
    (aptosWallet as any)?.domain ||
    (typeof window !== "undefined" ? window.location.host : "localhost");
  const solanaWalletAdapter: SolanaWalletAdapter | undefined = {
    ...(solanaWallet as object),
    publicKey: solanaPublicKey,
    signMessage: signMessage || (solanaWallet as any)?.adapter?.signMessage,
    name: (solanaWallet as any)?.adapter?.name || (solanaWallet as any)?.name || "Solana Wallet",
  } as unknown as SolanaWalletAdapter;

  if (!solanaWallet || !solanaPublicKey || !solanaWalletAdapter?.signMessage) {
    throw new Error(
      "Solana wallet not connected or signMessage not available. Please connect a Solana wallet that supports signing messages."
    );
  }

  onStatusUpdate("Please sign the transaction in your Solana wallet...");
  const signResult = await signAptosTransactionWithSolana({
    solanaWallet: solanaWalletAdapter,
    authenticationFunction,
    rawTransaction: transaction,
    domain,
  });

  if (signResult.status === UserResponseStatus.REJECTED) {
    throw new Error("User rejected the transaction");
  }
  if (signResult.status !== UserResponseStatus.APPROVED || !signResult.args) {
    throw new Error("Transaction signing failed or was rejected");
  }

  const senderAuthenticator = signResult.args;
  const normalizedAuthenticator = normalizeAuthenticator(senderAuthenticator);

  onStatusUpdate(
    useGasStation ? "Submitting transaction via Gas Station..." : "Submitting transaction..."
  );

  let response: { hash: string };

  if (useGasStation && transactionSubmitter) {
    try {
      response = await transactionSubmitter.submitTransaction({
        aptosConfig: aptosClient.config as any,
        transaction: transaction as any,
        senderAuthenticator: normalizedAuthenticator as any,
      });
    } catch (gasStationError: any) {
      const message =
        gasStationError?.message ||
        gasStationError?.error ||
        (typeof gasStationError === "string" ? gasStationError : "Unknown Gas Station error");
      throw new Error(
        `Gas Station rejected sponsorship: ${message}. Rule required for ${CCTP_DEPOSIT_FOR_BURN_ENTRY_FUNCTION}`
      );
    }
  } else {
    response = await aptosClient.transaction.submit.simple({
      transaction,
      senderAuthenticator: normalizedAuthenticator as any,
    });
  }

  if (!response?.hash) {
    throw new Error("Transaction submission failed: no hash returned");
  }

  return response.hash;
}
