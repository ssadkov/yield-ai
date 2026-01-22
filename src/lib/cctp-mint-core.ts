// CCTP Minting core logic
// Extracted from minting-solana page for reusability

import { PublicKey, Transaction, TransactionInstruction, SystemProgram, Connection } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { hexToBytes, hexToSolanaBase58 } from "./cctp-mint";
import { generateAllCCTPPDAs, MESSAGE_TRANSMITTER_PROGRAM_ID, TOKEN_MESSENGER_MINTER_PROGRAM_ID, USDC_MINT } from "./cctp-mint-pdas";

import type { AttestationData } from "./cctp-mint";

/**
 * Extract mint recipient from CCTP message
 */
export function extractMintRecipientFromMessage(messageBytes: Uint8Array): string {
  const messageHex = Array.from(messageBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  // Try to find mint_recipient using fallback offset
  // Header: version(4) + sourceDomain(4) + destinationDomain(4) + nonce(8) + sender(32) + recipient(32) + destinationCaller(32) = 116 bytes
  // Body: version(4) + burnToken(32) = 36 bytes
  // mintRecipient offset = 116 + 36 = 152 bytes
  const expectedMintRecipientOffset = 116 + 36; // 152 bytes

  if (messageBytes.length >= expectedMintRecipientOffset + 32) {
    const mintRecipientBytes = messageBytes.slice(expectedMintRecipientOffset, expectedMintRecipientOffset + 32);
    const mintRecipientHex = Array.from(mintRecipientBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    const isAllZeros = mintRecipientBytes.every(b => b === 0);
    if (isAllZeros) {
      throw new Error('Адрес получателя в CCTP сообщении пустой (все нули). Проверьте транзакцию сжигания.');
    }

    // Convert hex to Solana base58
    return hexToSolanaBase58(mintRecipientHex);
  }

  throw new Error(`Не удалось найти адрес получателя в CCTP сообщении. Длина сообщения: ${messageBytes.length} байт`);
}

/**
 * Generate instruction discriminator for MessageTransmitter receiveMessage
 */
export async function generateMessageTransmitterDiscriminator(): Promise<{ discriminator: Buffer; seed: string }> {
  const encoder = new TextEncoder();
  const messageTransmitterDiscriminatorSeeds = [
    "global:receive_message",
    "receive_message",
  ];

  for (const seed of messageTransmitterDiscriminatorSeeds) {
    const mtSeedBytes = encoder.encode(seed);
    const mtSeedArray = new Uint8Array(mtSeedBytes);
    const mtHashBuffer = await crypto.subtle.digest("SHA-256", mtSeedArray);
    const mtHashArray = Array.from(new Uint8Array(mtHashBuffer));
    const discriminator = Buffer.from(mtHashArray.slice(0, 8));

    console.log(`[CCTP Mint] Testing discriminator for "${seed}":`, 
      Array.from(discriminator).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));

    // Use the first one
    return { discriminator, seed };
  }

  throw new Error("Failed to generate message transmitter discriminator");
}

/**
 * Build MessageTransmitter receiveMessage instruction data
 */
export async function buildMessageTransmitterInstructionData(
  messageBytes: Uint8Array,
  attestationBytes: Uint8Array
): Promise<Buffer> {
  const { discriminator } = await generateMessageTransmitterDiscriminator();

  // Format with length prefixes (Anchor Vec<u8> format)
  const messageLengthBuffer = Buffer.allocUnsafe(4);
  messageLengthBuffer.writeUInt32LE(messageBytes.length, 0);
  const attestationLengthBuffer = Buffer.allocUnsafe(4);
  attestationLengthBuffer.writeUInt32LE(attestationBytes.length, 0);

  const messageTransmitterData = Buffer.concat([
    discriminator,
    messageLengthBuffer,
    Buffer.from(messageBytes),
    attestationLengthBuffer,
    Buffer.from(attestationBytes),
  ]);

  return messageTransmitterData;
}

/**
 * Build receiveMessage instruction accounts
 */
export function buildReceiveMessageInstructionAccounts(
  pdas: Awaited<ReturnType<typeof generateAllCCTPPDAs>>,
  solanaPublicKey: PublicKey,
  recipientTokenAccount: PublicKey
): Array<{ pubkey: PublicKey; isSigner: boolean; isWritable: boolean }> {
  const instructionKeys = [
    // 1. Payer (must be signer and writable - pays for transaction fees)
    { pubkey: solanaPublicKey, isSigner: true, isWritable: true },
    // 2. Caller (must be signer - the account calling receiveMessage)
    { pubkey: solanaPublicKey, isSigner: true, isWritable: false },
    // 3. Authority PDA для CPI
    { pubkey: pdas.messageTransmitterAuthorityPDA, isSigner: false, isWritable: false },
    // 4. MessageTransmitter state account (writable)
    { pubkey: pdas.messageTransmitterStateAccount, isSigner: false, isWritable: true },
    // 5. Used nonce(s) PDA (writable) - для replay protection
    { pubkey: pdas.usedNoncesPDA, isSigner: false, isWritable: true },
    // 6. Receiver - TokenMessengerMinter program
    { pubkey: TOKEN_MESSENGER_MINTER_PROGRAM_ID, isSigner: false, isWritable: false },
    // 7. System program
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    // 8. eventAuthority - В ОСНОВНЫХ АККАУНТАХ
    { pubkey: pdas.eventAuthorityPDA, isSigner: false, isWritable: false },
    // 9. program - В ОСНОВНЫХ АККАУНТАХ (MessageTransmitter program ID)
    { pubkey: MESSAGE_TRANSMITTER_PROGRAM_ID, isSigner: false, isWritable: false },
  ];

  // Remaining accounts for CPI in TokenMessengerMinter
  instructionKeys.push(
    { pubkey: pdas.tokenMessengerPDA, isSigner: false, isWritable: false }, // 1. token_messenger
    { pubkey: pdas.remoteTokenMessengerPDA, isSigner: false, isWritable: false }, // 2. remote_token_messenger
    { pubkey: pdas.tokenMinterPDA, isSigner: false, isWritable: true }, // 3. token_minter
    { pubkey: pdas.localTokenPDA, isSigner: false, isWritable: true }, // 4. local_token
    { pubkey: pdas.tokenPairPDA, isSigner: false, isWritable: false }, // 5. token_pair
    { pubkey: recipientTokenAccount, isSigner: false, isWritable: true }, // 6. user_token_account
    { pubkey: pdas.custodyTokenAccountPDA, isSigner: false, isWritable: true }, // 7. custody_token_account
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // 8. SPL.token_program_id
    { pubkey: pdas.eventAuthorityForCPI, isSigner: false, isWritable: false }, // 9. event_authority (для CPI)
    { pubkey: TOKEN_MESSENGER_MINTER_PROGRAM_ID, isSigner: false, isWritable: false }, // 10. program (TokenMessengerMinter)
  );

  return instructionKeys;
}

/**
 * Perform mint on Solana - main function
 */
export async function performMintOnSolana(
  attestationData: AttestationData,
  recipient: string,
  connection: Connection,
  solanaPublicKey: PublicKey,
  signTransaction: (transaction: Transaction) => Promise<Transaction>,
  onStatusUpdate?: (status: string) => void
): Promise<string> {
  const firstMessage = attestationData.messages![0];
  
  if (onStatusUpdate) {
    onStatusUpdate("Validating attestation data...");
  }

  const messageBytes = hexToBytes(firstMessage.message!);
  const attestationBytes = hexToBytes(firstMessage.attestation!);

  console.log('[CCTP Mint] Attestation validated:', {
    messageLength: messageBytes.length,
    attestationLength: attestationBytes.length,
    eventNonce: firstMessage.eventNonce,
  });

  // Extract mint recipient from message
  if (onStatusUpdate) {
    onStatusUpdate("Extracting recipient from CCTP message...");
  }
  const mintRecipientFromMessage = extractMintRecipientFromMessage(messageBytes);
  const recipientTokenAccount = new PublicKey(mintRecipientFromMessage);
  const recipientPubkey = new PublicKey(recipient);

  console.log('[CCTP Mint] Recipient info:', {
    recipientPubkey: recipientPubkey.toBase58(),
    mintRecipientFromMessage: mintRecipientFromMessage,
    recipientTokenAccount: recipientTokenAccount.toBase58(),
  });

  // Verify token account
  if (onStatusUpdate) {
    onStatusUpdate("Verifying token account...");
  }
  const tokenAccountInfo = await connection.getAccountInfo(recipientTokenAccount);
  if (tokenAccountInfo) {
    const { unpackAccount } = await import("@solana/spl-token");
    const parsedTokenAccount = unpackAccount(recipientTokenAccount, tokenAccountInfo);
    
    if (!parsedTokenAccount.owner.equals(recipientPubkey)) {
      console.warn('[CCTP Mint] ⚠️ WARNING: Token account owner does not match connected wallet!');
    }
    
    if (!parsedTokenAccount.mint.equals(USDC_MINT)) {
      throw new Error(`Token account mint (${parsedTokenAccount.mint.toBase58()}) does not match USDC_MINT (${USDC_MINT.toBase58()})`);
    }
  }

  // Generate all PDAs
  if (onStatusUpdate) {
    onStatusUpdate("Generating CCTP PDAs...");
  }

  const SOURCE_DOMAIN = 9; // Aptos
  const burnTokenOffset = 116 + 4; // header(116) + body version(4)
  const burnTokenBytes = messageBytes.slice(burnTokenOffset, burnTokenOffset + 32);

  const pdas = await generateAllCCTPPDAs(
    connection,
    SOURCE_DOMAIN,
    firstMessage.eventNonce!,
    burnTokenBytes
  );

  // Build instruction data
  if (onStatusUpdate) {
    onStatusUpdate("Building CCTP receiveMessage instruction...");
  }
  const instructionData = await buildMessageTransmitterInstructionData(messageBytes, attestationBytes);

  // Build instruction accounts
  const instructionKeys = buildReceiveMessageInstructionAccounts(
    pdas,
    solanaPublicKey,
    recipientTokenAccount
  );

  // Create instruction
  const receiveMessageIx = new TransactionInstruction({
    programId: MESSAGE_TRANSMITTER_PROGRAM_ID,
    keys: instructionKeys,
    data: instructionData,
  });

  // Create transaction
  const transaction = new Transaction();
  transaction.add(receiveMessageIx);
  transaction.feePayer = solanaPublicKey;

  // Get fresh blockhash
  if (onStatusUpdate) {
    onStatusUpdate("Getting fresh blockhash...");
  }
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  transaction.recentBlockhash = blockhash;

  // Sign transaction
  if (onStatusUpdate) {
    onStatusUpdate("Please approve the transaction in your wallet...");
  }
  const signedTransaction = await signTransaction(transaction);

  // Submit transaction
  if (onStatusUpdate) {
    onStatusUpdate("Submitting transaction to Solana...");
  }
  const txSignature = await connection.sendRawTransaction(
    signedTransaction.serialize(),
    {
      skipPreflight: false,
      maxRetries: 3,
    }
  );

  console.log('[CCTP Mint] Transaction submitted:', txSignature);

  // Wait for confirmation
  if (onStatusUpdate) {
    onStatusUpdate("Waiting for transaction confirmation...");
  }
  const confirmation = await connection.confirmTransaction({
    signature: txSignature,
    blockhash,
    lastValidBlockHeight,
  }, 'confirmed');

  if (confirmation.value.err) {
    throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
  }

  console.log('[CCTP Mint] Transaction confirmed:', confirmation);

  return txSignature;
}
