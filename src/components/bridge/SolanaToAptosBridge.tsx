"use client";

import { PublicKey, Transaction, Keypair } from "@solana/web3.js";
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { USDC_MINT, TOKEN_MESSENGER_MINTER_PROGRAM_ID } from "@/lib/cctp-mint-pdas";
import { createDepositForBurnInstructionManual } from "@/lib/cctp-deposit-for-burn";

// CCTP Domain IDs
const DOMAIN_SOLANA = 5;
const DOMAIN_APTOS = 9;

// USDC addresses
const USDC_SOLANA = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const USDC_APTOS =
  "0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b";

const MESSAGE_TRANSMITTER_PROGRAM_ID = new PublicKey(
  "CCTPmbSD7gX1bxKPAmg77w8oFzNFpaQiQUWD43TKaecd"
);

/**
 * Converts Aptos address (32 bytes hex) to bytes for mint_recipient.
 */
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

// Re-export for callers that import from this component
export { createDepositForBurnInstructionManual };

export type SolanaToAptosBridgeTmpOptions = {
  mode: "tmp";
  tmpKeypair: Keypair;
  feePayerKeypair: Keypair;
  onStatusUpdate?: (status: string) => void;
};

/**
 * Executes Solana -> Aptos bridge transfer
 * Uses CCTP depositForBurn on Solana (without Wormhole SDK)
 * Default: connected wallet signs & pays fee.
 * Tmp mode: tmpKeypair as owner, feePayerKeypair pays fee (no wallet adapter).
 */
export async function executeSolanaToAptosBridge(
  amount: string,
  solanaPublicKey: PublicKey,
  signTransaction: (tx: Transaction) => Promise<Transaction>,
  solanaConnection: any,
  aptosAddress: string,
  onStatusUpdateOrOptions: ((status: string) => void) | SolanaToAptosBridgeTmpOptions
): Promise<string> {
  // TMP MODE: burn from tmp wallet using keypairs only (no wallet adapter)
  if (typeof onStatusUpdateOrOptions !== "function" && onStatusUpdateOrOptions?.mode === "tmp") {
    const { tmpKeypair, feePayerKeypair, onStatusUpdate } = onStatusUpdateOrOptions;
    const log = (s: string) => onStatusUpdate?.(s);

    log("Preparing burn transaction on Solana (tmp wallet mode)...");

    // Get tmp wallet USDC ATA and full balance
    const ownerTokenAccount = await getAssociatedTokenAddress(
      USDC_MINT,
      tmpKeypair.publicKey
    );

    const balanceInfo = await solanaConnection.getTokenAccountBalance(
      ownerTokenAccount
    );
    const rawAmount = balanceInfo?.value?.amount;
    if (!rawAmount) {
      throw new Error("No USDC balance found on tmp wallet token account");
    }
    const amountInBaseUnits = BigInt(rawAmount);

    // Convert Aptos address to 32 bytes for mint_recipient
    const mintRecipientBytes = aptosAddressToBytes(aptosAddress);

    log("Building depositForBurn instruction (tmp wallet)...");

    const messageSendEventDataKeypair = Keypair.generate();
    const messageSendEventData = messageSendEventDataKeypair.publicKey;

    const { instruction } = await createDepositForBurnInstructionManual(
      TOKEN_MESSENGER_MINTER_PROGRAM_ID,
      MESSAGE_TRANSMITTER_PROGRAM_ID,
      USDC_MINT,
      DOMAIN_APTOS,
      tmpKeypair.publicKey,
      feePayerKeypair.publicKey,
      ownerTokenAccount,
      mintRecipientBytes,
      amountInBaseUnits,
      messageSendEventData,
      messageSendEventDataKeypair
    );

    const tx = new Transaction();
    tx.add(instruction);
    tx.feePayer = feePayerKeypair.publicKey;

    log("Getting fresh blockhash...");
    const { blockhash } = await solanaConnection.getLatestBlockhash("confirmed");
    tx.recentBlockhash = blockhash;

    log("Signing burn transaction with tmp wallet and fee payer...");
    tx.partialSign(tmpKeypair, messageSendEventDataKeypair, feePayerKeypair);

    log("Sending transaction to Solana...");
    const signature = await solanaConnection.sendRawTransaction(tx.serialize(), {
      skipPreflight: false,
      maxRetries: 3,
    });

    log(`Burn transaction sent: ${signature}`);
    return signature;
  }

  // WALLET MODE (текущая логика моста)
  const onStatusUpdate = onStatusUpdateOrOptions as (status: string) => void;

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
    const { blockhash, lastValidBlockHeight } = await solanaConnection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;

    // Verify messageSendEventData is in instruction keys (more reliable than transaction.message.accountKeys)
    const instructionKeyIndex = instruction.keys.findIndex((key: any) => 
      key.pubkey && key.pubkey.toBase58() === eventDataKeypair.publicKey.toBase58()
    );
    console.log('[SolanaToAptosBridge] messageSendEventData in instruction keys:', instructionKeyIndex);
    if (instructionKeyIndex < 0) {
      throw new Error('messageSendEventData account not found in instruction keys');
    }
    
    // Also check if it's marked as signer
    const instructionKey = instruction.keys[instructionKeyIndex];
    if (!instructionKey.isSigner) {
      console.warn('[SolanaToAptosBridge] WARNING: messageSendEventData is not marked as signer in instruction!');
    }
    console.log('[SolanaToAptosBridge] messageSendEventData key details:', {
      index: instructionKeyIndex,
      pubkey: eventDataKeypair.publicKey.toBase58(),
      isSigner: instructionKey.isSigner,
      isWritable: instructionKey.isWritable,
    });

    // Sign with user's wallet FIRST
    // Then we'll add keypair signature after wallet adapter signs
    onStatusUpdate('Please approve the transaction in your Solana wallet...');
    let signed = await signTransaction(transaction);
    console.log('[SolanaToAptosBridge] Transaction signed with wallet. Signatures count:', signed.signatures.length);
    
    // Get account keys and find messageSendEventData index AFTER wallet signing
    // This is important because wallet adapter may reorder accounts
    let finalAccountKeys: PublicKey[] = [];
    let messageSendEventDataIndex = -1;
    
    try {
      const finalCompiledMessage = signed.compileMessage();
      finalAccountKeys = finalCompiledMessage.accountKeys;
      messageSendEventDataIndex = finalAccountKeys.findIndex((key: PublicKey) => 
        key && key.toBase58() === eventDataKeypair.publicKey.toBase58()
      );
    } catch (compileError: any) {
      console.warn('[SolanaToAptosBridge] Could not compile message after wallet signing:', compileError.message);
      // Fallback: try to get from message directly
      finalAccountKeys = (signed as any).message?.accountKeys || (signed as any).message?.staticAccountKeys || [];
      messageSendEventDataIndex = finalAccountKeys.findIndex((key: PublicKey) => 
        key && key.toBase58() === eventDataKeypair.publicKey.toBase58()
      );
    }
    
    console.log('[SolanaToAptosBridge] messageSendEventData index after wallet signing:', messageSendEventDataIndex);
    console.log('[SolanaToAptosBridge] All account keys after wallet signing:', finalAccountKeys.map((k: PublicKey, i: number) => ({
      index: i,
      pubkey: k.toBase58(),
        isSigner: (signed as any).message?.header?.numRequiredSignatures ? i < (signed as any).message.header.numRequiredSignatures : false,
      hasSignature: !!signed.signatures[i]?.signature,
    })));
    
    if (messageSendEventDataIndex < 0) {
      throw new Error('messageSendEventData account not found in transaction accounts after wallet signing');
    }
    
    // Now sign with messageSendEventData keypair AFTER wallet adapter
    // CRITICAL: We need to sign the EXACT message bytes that will be sent to the blockchain
    // partialSign may not work correctly if wallet adapter modified the transaction
    // So we'll manually create the signature on the final compiled message
    console.log('[SolanaToAptosBridge] Signing with messageSendEventData keypair AFTER wallet adapter:', eventDataKeypair.publicKey.toBase58());
    console.log('[SolanaToAptosBridge] Keypair will be signed at index:', messageSendEventDataIndex);
    
    // Get the final compiled message (this is what will be sent to blockchain)
    const finalCompiledMessage = signed.compileMessage();
    
    // Get the message bytes that need to be signed
    const messageBytes = finalCompiledMessage.serialize();
    console.log('[SolanaToAptosBridge] Message bytes length for signing:', messageBytes.length);
    
    // Create signature manually using tweetnacl
    const nacl = await import('tweetnacl');
    const keypairSignature = nacl.sign.detached(messageBytes, eventDataKeypair.secretKey);
    console.log('[SolanaToAptosBridge] Created keypair signature manually, length:', keypairSignature.length);
    
    // Verify the signature is valid before adding it
    const isValid = nacl.sign.detached.verify(messageBytes, keypairSignature, eventDataKeypair.publicKey.toBytes());
    if (!isValid) {
      throw new Error('Failed to create valid signature for messageSendEventData');
    }
    console.log('[SolanaToAptosBridge] ✅ Signature verified as valid');
    
    // IMPORTANT:
    // Never replace entries in `signed.signatures` with objects missing `publicKey`.
    // web3.js expects each entry to be { publicKey, signature }, and will crash otherwise.
    // Instead, locate the existing signature entry for this publicKey and set its signature.
    const sigEntryIndex = signed.signatures.findIndex((s: any) =>
      s?.publicKey?.toBase58?.() === eventDataKeypair.publicKey.toBase58()
    );
    if (sigEntryIndex < 0) {
      throw new Error('messageSendEventData signature entry not found in transaction.signatures');
    }

    // Sanity check: the signature-entry index should match the signer index in the compiled message header
    if (sigEntryIndex !== messageSendEventDataIndex) {
      console.warn('[SolanaToAptosBridge] Signature entry index differs from accountKeys signer index:', {
        sigEntryIndex,
        messageSendEventDataIndex,
      });
    }

    signed.signatures[sigEntryIndex].signature = Buffer.from(keypairSignature);
    
    // Verify that keypair signature is now present
    const addedSignature = signed.signatures[sigEntryIndex]?.signature;
    console.log('[SolanaToAptosBridge] messageSendEventData signature verification after manual signing:', {
      index: sigEntryIndex,
      hasSignature: !!addedSignature,
      signatureLength: addedSignature?.length || 0,
      publicKey: eventDataKeypair.publicKey.toBase58(),
    });
    
    if (!addedSignature) {
      throw new Error('Failed to add messageSendEventData signature. Transaction cannot be sent.');
    }
    
    // Verify transaction is valid with both signatures
    try {
      const finalCheck = signed.compileMessage();
      console.log('[SolanaToAptosBridge] ✅ Transaction compiled successfully with both signatures');
      console.log('[SolanaToAptosBridge] Final account keys count:', finalCheck.accountKeys.length);
      console.log('[SolanaToAptosBridge] Final signatures count:', signed.signatures.length);
      
      // Verify all required signatures are present
      const numRequiredSignatures = finalCheck.header.numRequiredSignatures;
      const signaturesPresent = signed.signatures.slice(0, numRequiredSignatures).filter(sig => sig.signature).length;
      console.log('[SolanaToAptosBridge] Required signatures:', numRequiredSignatures, 'Present:', signaturesPresent);
      
      if (signaturesPresent < numRequiredSignatures) {
        throw new Error(`Missing signatures: required ${numRequiredSignatures}, present ${signaturesPresent}`);
      }
    } catch (compileError: any) {
      console.error('[SolanaToAptosBridge] ❌ Failed to compile transaction:', compileError.message);
      throw new Error(`Transaction compilation failed: ${compileError.message}`);
    }
    
    // Safely log signature details
    try {
        const accountKeys = (signed as any).message?.accountKeys || (signed as any).message?.staticAccountKeys || [];
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

    // Wait for confirmation with better error handling
    onStatusUpdate('Waiting for transaction confirmation...');
    try {
      const confirmation = await solanaConnection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight,
      }, 'confirmed');

      if (confirmation.value.err) {
        // Get detailed error information
        const errorDetails = JSON.stringify(confirmation.value.err, null, 2);
        console.error('[SolanaToAptosBridge] Transaction failed with error:', errorDetails);
        
        // Try to get transaction details for more info
        try {
          const txDetails = await solanaConnection.getTransaction(signature, {
            commitment: 'confirmed',
            maxSupportedTransactionVersion: 0,
          });
          
          if (txDetails?.meta?.err) {
            console.error('[SolanaToAptosBridge] Transaction error details:', {
              err: txDetails.meta.err,
              logMessages: txDetails.meta.logMessages?.slice(0, 10), // First 10 log messages
            });
            
            // Extract error message from logs if available
            const errorLogs = txDetails.meta.logMessages?.filter((log: string) => 
              log.includes('Error') || log.includes('failed') || log.includes('AccountNotSigner')
            );
            
            if (errorLogs && errorLogs.length > 0) {
              throw new Error(`Transaction failed: ${errorLogs.join('; ')}`);
            }
          }
        } catch (txError: any) {
          console.warn('[SolanaToAptosBridge] Could not get transaction details:', txError.message);
        }
        
        throw new Error(`Transaction failed: ${errorDetails}`);
      }

      console.log('[SolanaToAptosBridge] ✅ Transaction confirmed successfully');
      onStatusUpdate(`✅ Burn completed! Transaction: ${signature.slice(0, 8)}...${signature.slice(-8)}`);
      
      return signature;
    } catch (confirmError: any) {
      // Check if transaction exists and get its status
      try {
        const status = await solanaConnection.getSignatureStatus(signature);
        if (status.value?.err) {
          console.error('[SolanaToAptosBridge] Transaction status shows error:', status.value.err);
          throw new Error(`Transaction failed: ${JSON.stringify(status.value.err)}`);
        }
      } catch (statusError: any) {
        console.warn('[SolanaToAptosBridge] Could not get transaction status:', statusError.message);
      }
      
      throw confirmError;
    }

  } catch (error: any) {
    console.error('[SolanaToAptosBridge] Error:', error);
    throw error;
  }
}
