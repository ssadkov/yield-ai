"use client";

import { PublicKey, Transaction, TransactionInstruction, Keypair } from '@solana/web3.js';
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { USDC_MINT, TOKEN_MESSENGER_MINTER_PROGRAM_ID } from '@/lib/cctp-mint-pdas';
import { utils } from '@coral-xyz/anchor';

// CCTP Domain IDs
const DOMAIN_SOLANA = 5;
const DOMAIN_APTOS = 9;

// USDC addresses
const USDC_SOLANA = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const USDC_APTOS = '0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b';

const MESSAGE_TRANSMITTER_PROGRAM_ID = new PublicKey("CCTPmbSD7gX1bxKPAmg77w8oFzNFpaQiQUWD43TKaecd");

/**
 * Find PDA using Anchor's utils
 */
function findProgramAddress(label: string, programId: PublicKey, extraSeeds?: (string | Buffer | PublicKey | Uint8Array)[]): { publicKey: PublicKey; bump: number } {
  const seeds = [Buffer.from(utils.bytes.utf8.encode(label))];
  if (extraSeeds) {
    for (const extraSeed of extraSeeds) {
      if (typeof extraSeed === 'string') {
        seeds.push(Buffer.from(utils.bytes.utf8.encode(extraSeed)));
      } else if (Array.isArray(extraSeed)) {
        seeds.push(Buffer.from(extraSeed));
      } else if (Buffer.isBuffer(extraSeed)) {
        seeds.push(extraSeed);
      } else if (extraSeed instanceof PublicKey) {
        seeds.push(extraSeed.toBuffer());
      } else if (extraSeed instanceof Uint8Array) {
        seeds.push(Buffer.from(extraSeed));
      }
    }
  }
  const [publicKey, bump] = PublicKey.findProgramAddressSync(seeds, programId);
  return { publicKey, bump };
}

/**
 * Converts Aptos address (32 bytes hex) to bytes for mint_recipient
 */
function aptosAddressToBytes(aptosAddress: string): Uint8Array {
  // Remove 0x prefix if present
  const cleanAddress = aptosAddress.startsWith('0x') ? aptosAddress.slice(2) : aptosAddress;
  
  // Convert hex string to bytes
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    bytes[i] = parseInt(cleanAddress.slice(i * 2, i * 2 + 2), 16);
  }
  
  return bytes;
}

/**
 * Compute Anchor instruction discriminator
 * Discriminator = first 8 bytes of SHA256("global:instruction_name")
 * Uses Web Crypto API for browser compatibility
 */
async function computeDiscriminator(instructionName: string): Promise<Buffer> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`global:${instructionName}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);
  return Buffer.from(hashArray.slice(0, 8));
}

/**
 * Creates depositForBurn instruction manually (without Wormhole SDK)
 * Based on Circle CCTP TokenMessengerMinter program structure
 */
async function createDepositForBurnInstructionManual(
  tokenMessengerProgramId: PublicKey,
  messageTransmitterProgramId: PublicKey,
  tokenMint: PublicKey,
  destinationDomain: number,
  senderAddress: PublicKey,
  senderAssociatedTokenAccountAddress: PublicKey,
  mintRecipientBytes: Uint8Array,
  amount: bigint,
  messageSendEventData: PublicKey,
  messageSendEventDataKeypair: Keypair
): Promise<{ instruction: TransactionInstruction; messageSendEventDataKeypair: Keypair }> {
  // Find all required PDAs
  const messageTransmitterAccount = findProgramAddress('message_transmitter', messageTransmitterProgramId);
  const tokenMessenger = findProgramAddress('token_messenger', tokenMessengerProgramId);
  const tokenMinter = findProgramAddress('token_minter', tokenMessengerProgramId);
  const localToken = findProgramAddress('local_token', tokenMessengerProgramId, [tokenMint]);
  const remoteTokenMessengerKey = findProgramAddress('remote_token_messenger', tokenMessengerProgramId, [destinationDomain.toString()]);
  const authorityPda = findProgramAddress('sender_authority', tokenMessengerProgramId);
  const eventAuthority = findProgramAddress('__event_authority', tokenMessengerProgramId);

  // Convert mint_recipient bytes to PublicKey (32 bytes)
  const mintRecipient = new PublicKey(mintRecipientBytes);

  // Compute instruction discriminator
  const discriminator = await computeDiscriminator('deposit_for_burn');

  // Build instruction data manually
  // Format: discriminator (8) + amount (u64, 8 bytes LE) + destinationDomain (u32, 4 bytes LE) + mintRecipient (32 bytes)
  
  // Write amount as u64 little-endian (8 bytes)
  const amountBuffer = Buffer.allocUnsafe(8);
  // Convert bigint to bytes manually (little-endian)
  let amountValue = amount;
  for (let i = 0; i < 8; i++) {
    amountBuffer[i] = Number(amountValue & BigInt(0xff));
    amountValue = amountValue >> BigInt(8);
  }
  
  // Write destinationDomain as u32 little-endian (4 bytes)
  const domainBuffer = Buffer.allocUnsafe(4);
  domainBuffer[0] = destinationDomain & 0xff;
  domainBuffer[1] = (destinationDomain >> 8) & 0xff;
  domainBuffer[2] = (destinationDomain >> 16) & 0xff;
  domainBuffer[3] = (destinationDomain >> 24) & 0xff;
  
  const instructionData = Buffer.concat([
    discriminator,
    amountBuffer,
    domainBuffer,
    Buffer.from(mintRecipientBytes),
  ]);

  // Build instruction accounts (order matters - must match IDL)
  // Note: messageSentEventData must be a signer (the program will create the account)
  const instructionKeys = [
    { pubkey: senderAddress, isSigner: true, isWritable: false }, // owner
    { pubkey: senderAddress, isSigner: true, isWritable: true }, // eventRentPayer
    { pubkey: authorityPda.publicKey, isSigner: false, isWritable: false }, // senderAuthorityPda
    { pubkey: senderAssociatedTokenAccountAddress, isSigner: false, isWritable: true }, // burnTokenAccount
    { pubkey: messageTransmitterAccount.publicKey, isSigner: false, isWritable: false }, // messageTransmitter
    { pubkey: tokenMessenger.publicKey, isSigner: false, isWritable: false }, // tokenMessenger
    { pubkey: remoteTokenMessengerKey.publicKey, isSigner: false, isWritable: false }, // remoteTokenMessenger
    { pubkey: tokenMinter.publicKey, isSigner: false, isWritable: false }, // tokenMinter
    { pubkey: localToken.publicKey, isSigner: false, isWritable: false }, // localToken
    { pubkey: tokenMint, isSigner: false, isWritable: false }, // burnTokenMint
    { pubkey: messageTransmitterProgramId, isSigner: false, isWritable: false }, // messageTransmitterProgram
    { pubkey: tokenMessengerProgramId, isSigner: false, isWritable: false }, // tokenMessengerMinterProgram
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // tokenProgram
    { pubkey: eventAuthority.publicKey, isSigner: false, isWritable: false }, // eventAuthority
    { pubkey: messageSendEventData, isSigner: true, isWritable: true }, // messageSentEventData (must be signer!)
  ];

  return {
    instruction: new TransactionInstruction({
      programId: tokenMessengerProgramId,
      keys: instructionKeys,
      data: instructionData,
    }),
    messageSendEventDataKeypair,
  };
}

/**
 * Executes Solana -> Aptos bridge transfer
 * Uses CCTP depositForBurn on Solana (without Wormhole SDK)
 * Uses service wallet for gas payment (like bridge2)
 */
export async function executeSolanaToAptosBridge(
  amount: string,
  solanaPublicKey: PublicKey,
  signTransaction: (tx: Transaction) => Promise<Transaction>,
  solanaConnection: any,
  aptosAddress: string,
  onStatusUpdate: (status: string) => void
): Promise<string> {
  try {
    onStatusUpdate('Preparing burn transaction on Solana...');

    // Parse amount (USDC has 6 decimals)
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      throw new Error('Invalid amount');
    }
    const amountInBaseUnits = BigInt(Math.floor(amountNum * Math.pow(10, 6)));

    // Get owner's USDC token account (ATA) - from connected Solana wallet
    const ownerTokenAccount = await getAssociatedTokenAddress(
      USDC_MINT,
      solanaPublicKey
    );

    // Convert Aptos address to 32 bytes for mint_recipient - from connected Aptos wallet
    const mintRecipientBytes = aptosAddressToBytes(aptosAddress);

    onStatusUpdate('Building depositForBurn instruction...');

    // Generate keypair for messageSendEventData account (will be created by program)
    const messageSendEventDataKeypair = Keypair.generate();
    const messageSendEventData = messageSendEventDataKeypair.publicKey;

    // Build depositForBurn instruction manually
    const { instruction, messageSendEventDataKeypair: eventDataKeypair } = await createDepositForBurnInstructionManual(
      TOKEN_MESSENGER_MINTER_PROGRAM_ID,
      MESSAGE_TRANSMITTER_PROGRAM_ID,
      USDC_MINT,
      DOMAIN_APTOS,
      solanaPublicKey,
      ownerTokenAccount,
      mintRecipientBytes,
      amountInBaseUnits,
      messageSendEventData,
      messageSendEventDataKeypair
    );

    // Create transaction
    // Note: Service wallet for gas payment is only used for Aptos transactions (in /api/aptos/mint-cctp)
    // For Solana burn transaction, user pays for gas
    const transaction = new Transaction();
    transaction.add(instruction);
    transaction.feePayer = solanaPublicKey;

    // Get fresh blockhash
    onStatusUpdate('Getting fresh blockhash...');
    const { blockhash } = await solanaConnection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;

    // Verify messageSendEventData is in transaction before wallet signing
    const accountKeysBefore = transaction.message.accountKeys;
    const keypairIndexBefore = accountKeysBefore.findIndex((key: PublicKey) => 
      key && key.toBase58() === eventDataKeypair.publicKey.toBase58()
    );
    console.log('[SolanaToAptosBridge] messageSendEventData index before wallet signing:', keypairIndexBefore);
    if (keypairIndexBefore < 0) {
      throw new Error('messageSendEventData account not found in transaction before wallet signing');
    }

    // Sign with user's wallet FIRST
    onStatusUpdate('Please approve the transaction in your Solana wallet...');
    let signed = await signTransaction(transaction);
    console.log('[SolanaToAptosBridge] Transaction signed with wallet. Signatures count:', signed.signatures.length);
    
    // Verify that messageSendEventData account is still in transaction after wallet signing
    const accountKeysAfter = signed.message?.accountKeys || signed.message?.staticAccountKeys || [];
    const messageSendEventDataIndex = accountKeysAfter.findIndex((key: PublicKey) => 
      key && key.toBase58() === eventDataKeypair.publicKey.toBase58()
    );
    
    console.log('[SolanaToAptosBridge] messageSendEventData index after wallet signing:', messageSendEventDataIndex);
    console.log('[SolanaToAptosBridge] All account keys after wallet signing:', accountKeysAfter.map((k: PublicKey, i: number) => ({
      index: i,
      pubkey: k.toBase58(),
      isSigner: signed.message?.header?.numRequiredSignatures ? i < signed.message.header.numRequiredSignatures : false,
    })));
    
    if (messageSendEventDataIndex < 0) {
      // Wallet adapter may have recreated transaction and lost the account
      // Try to find it in instruction accounts
      const instruction = signed.instructions[0];
      if (instruction && 'keys' in instruction) {
        const instructionKeyIndex = instruction.keys.findIndex((key: any) => 
          key.pubkey && key.pubkey.toBase58() === eventDataKeypair.publicKey.toBase58()
        );
        console.log('[SolanaToAptosBridge] messageSendEventData in instruction keys:', instructionKeyIndex);
        if (instructionKeyIndex >= 0) {
          // Account is in instruction but not in transaction accountKeys
          // This shouldn't happen, but if it does, we need to rebuild transaction
          throw new Error('messageSendEventData account found in instruction but not in transaction accountKeys. Wallet adapter may have corrupted the transaction.');
        }
      }
      throw new Error('messageSendEventData account not found in transaction accounts after wallet signing');
    }
    
    // Then sign with messageSendEventData keypair (required by program)
    // This must be done AFTER wallet signing to ensure both signatures are present
    console.log('[SolanaToAptosBridge] Signing with messageSendEventData keypair:', eventDataKeypair.publicKey.toBase58());
    signed.partialSign(eventDataKeypair);
    console.log('[SolanaToAptosBridge] Transaction signed with keypair. Final signatures count:', signed.signatures.length);
    
    // Verify that messageSendEventData signature is present
    const hasSignature = signed.signatures[messageSendEventDataIndex]?.signature;
    console.log('[SolanaToAptosBridge] messageSendEventData signature verification:', {
      index: messageSendEventDataIndex,
      hasSignature: !!hasSignature,
      signatureLength: hasSignature?.length || 0,
      publicKey: eventDataKeypair.publicKey.toBase58(),
    });
    
    if (!hasSignature) {
      throw new Error('Failed to add messageSendEventData signature. Transaction cannot be sent.');
    }
    
    // Safely log signature details
    try {
      const accountKeys = signed.message?.accountKeys || signed.message?.staticAccountKeys || [];
      console.log('[SolanaToAptosBridge] Signatures:', signed.signatures.map((sig, idx) => ({
        index: idx,
        publicKey: accountKeys[idx]?.toBase58() || 'unknown',
        hasSignature: !!sig.signature,
      })));
    } catch (sigError: any) {
      console.warn('[SolanaToAptosBridge] Could not log signature details:', sigError.message);
    }

    // Send transaction
    // Use skipPreflight: true to bypass simulation that may incorrectly check signatures
    // The transaction will still be validated on-chain
    onStatusUpdate('Sending transaction to Solana...');
    const signature = await solanaConnection.sendRawTransaction(signed.serialize(), {
      skipPreflight: true,
      maxRetries: 3,
    });

    console.log('[SolanaToAptosBridge] Transaction sent:', signature);
    console.log('[SolanaToAptosBridge] View on Solscan: https://solscan.io/tx/' + signature);

    // Wait for confirmation
    onStatusUpdate('Waiting for transaction confirmation...');
    await solanaConnection.confirmTransaction(signature, 'confirmed');

    onStatusUpdate(`✅ Burn completed! Transaction: ${signature.slice(0, 8)}...${signature.slice(-8)}`);
    
    return signature;

  } catch (error: any) {
    console.error('[SolanaToAptosBridge] Error:', error);
    throw error;
  }
}
