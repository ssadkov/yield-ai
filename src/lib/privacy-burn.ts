import {
  PublicKey,
  Transaction,
  Connection,
  Keypair,
} from "@solana/web3.js";
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import bs58 from "bs58";

import {
  USDC_MINT,
  TOKEN_MESSENGER_MINTER_PROGRAM_ID,
  MESSAGE_TRANSMITTER_PROGRAM_ID,
} from "./cctp-mint-pdas";
import { createDepositForBurnInstructionManual } from "./cctp-deposit-for-burn";

const DOMAIN_APTOS = 9;

function aptosAddressToBytes(aptosAddress: string): Uint8Array {
  const cleanAddress = aptosAddress.startsWith("0x")
    ? aptosAddress.slice(2)
    : aptosAddress;
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    bytes[i] = parseInt(cleanAddress.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export async function burnUsdcFromTmpWalletAndReturnSignature(params: {
  tmpPrivateKeyBase58: string;
  tmpAddress: string;
  solanaConnection: Connection;
  aptosRecipient: string;
  solanaPayerPrivateKeyBase58: string;
  onStatusUpdate?: (status: string) => void;
}): Promise<string> {
  const {
    tmpPrivateKeyBase58,
    tmpAddress,
    solanaConnection,
    aptosRecipient,
    solanaPayerPrivateKeyBase58,
    onStatusUpdate,
  } = params;

  const log = (s: string) => onStatusUpdate?.(s);

  // Decode keypairs
  const tmpSecret = bs58.decode(tmpPrivateKeyBase58.trim());
  const tmpKeypair = Keypair.fromSecretKey(tmpSecret);

  const payerSecret = bs58.decode(solanaPayerPrivateKeyBase58.trim());
  const payerKeypair = Keypair.fromSecretKey(payerSecret);

  // Sanity check address
  const tmpPubkey = new PublicKey(tmpAddress);
  if (!tmpPubkey.equals(tmpKeypair.publicKey)) {
    throw new Error("Tmp wallet address does not match derived public key");
  }

  log("Fetching USDC balance on tmp Solana wallet...");

  // Get tmp wallet USDC ATA and balance
  const ownerTokenAccount = await getAssociatedTokenAddress(
    USDC_MINT,
    tmpKeypair.publicKey
  );

  const tokenBalanceInfo = await solanaConnection.getTokenAccountBalance(
    ownerTokenAccount
  );

  const amountRaw = tokenBalanceInfo?.value?.amount;
  if (!amountRaw) {
    throw new Error("No USDC balance on tmp wallet token account");
  }

  const amountInBaseUnits = BigInt(amountRaw);
  if (amountInBaseUnits <= BigInt(0)) {
    throw new Error("USDC balance on tmp wallet is zero");
  }

  log(
    `Building CCTP burn for ${Number(amountInBaseUnits) / 1_000_000} USDC from tmp wallet...`
  );

  // mint_recipient при burn на Solana (destination Aptos) = Aptos-адрес получателя (32 байта). См. Circle CCTP Solana docs.
  const mintRecipientBytes = aptosAddressToBytes(aptosRecipient);

  // messageSendEventData account
  const messageSendEventDataKeypair = Keypair.generate();
  const messageSendEventData = messageSendEventDataKeypair.publicKey;

  const { instruction } = await createDepositForBurnInstructionManual(
    TOKEN_MESSENGER_MINTER_PROGRAM_ID,
    MESSAGE_TRANSMITTER_PROGRAM_ID,
    USDC_MINT,
    DOMAIN_APTOS,
    tmpKeypair.publicKey,
    payerKeypair.publicKey,
    ownerTokenAccount,
    mintRecipientBytes,
    amountInBaseUnits,
    messageSendEventData,
    messageSendEventDataKeypair
  );

  const tx = new Transaction();
  tx.add(instruction);
  tx.feePayer = payerKeypair.publicKey;

  log("Getting recent blockhash for burn transaction...");
  const { blockhash } = await solanaConnection.getLatestBlockhash("finalized");
  tx.recentBlockhash = blockhash;

  // Signers: tmp wallet (owner / event_rent_payer), messageSendEventData, fee payer
  tx.partialSign(tmpKeypair, messageSendEventDataKeypair, payerKeypair);

  log("Sending burn transaction to Solana...");
  const signature = await solanaConnection.sendRawTransaction(
    tx.serialize(),
    {
      skipPreflight: false,
    }
  );

  log(`Burn transaction submitted: ${signature}`);

  return signature;
}

