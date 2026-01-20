"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { useWallet as useSolanaWallet, useConnection } from "@solana/wallet-adapter-react";
import { SolanaWalletProviderWrapper } from "../bridge3/SolanaWalletProvider";
import { SolanaWalletSelector } from "@/components/SolanaWalletSelector";

interface AttestationData {
  messages?: Array<{
    attestation?: string;
    message?: string;
    eventNonce?: string;
  }>;
}

// Circle CCTP TokenMessengerMinter program ID on Solana Mainnet
// const TOKEN_MESSENGER_MINTER_PROGRAM_ID = "CCTPiPYPc6AsJuwueEnWgSgucamXDZwBd53dQ11YiKX3";
// const MESSAGE_TRANSMITTER_PROGRAM_ID = "CCTPmbSD7gX1bxKPAmg77w8oFzNFpaQiQUWD43TKaecd";

// Helper: Convert hex string to Uint8Array
function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes: number[] = [];
  for (let i = 0; i < cleanHex.length; i += 2) {
    const byte = parseInt(cleanHex.substr(i, 2), 16);
    bytes.push(byte);
  }
  return new Uint8Array(bytes);
}

// Helper: Fetch attestation from Circle Iris API with polling
async function fetchAttestation(
  sourceDomain: number,
  signature: string,
  onProgress?: (attempt: number, maxAttempts: number) => void
): Promise<AttestationData> {
  const irisApiUrl = process.env.NEXT_PUBLIC_CIRCLE_CCTP_ATTESTATION_URL;
  
  if (!irisApiUrl) {
    throw new Error('NEXT_PUBLIC_CIRCLE_CCTP_ATTESTATION_URL environment variable is not set');
  }

  const maxAttempts = 15;
  const initialDelay = 10000; // 10 seconds
  const maxDelay = 60000; // 60 seconds

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (onProgress) {
      onProgress(attempt, maxAttempts);
    }

    const delay = Math.min(initialDelay * Math.pow(2, attempt - 1), maxDelay);
    if (attempt > 1) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    try {
      const url = `${irisApiUrl}/${sourceDomain}/${signature.trim()}`;
      console.log(`[Minting Solana] Fetching attestation, attempt ${attempt}/${maxAttempts}:`, url);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          console.log(`[Minting Solana] Attestation not ready yet (404), attempt ${attempt}/${maxAttempts}`);
          if (attempt === maxAttempts) {
            throw new Error(`Attestation not ready after ${maxAttempts} attempts. Please wait and try again.`);
          }
          continue;
        }

        const errorText = await response.text();
        console.error('[Minting Solana] Circle API error:', response.status, errorText);
        throw new Error(`Circle API error: ${response.status} ${response.statusText}. ${errorText}`);
      }

      const attestationData: AttestationData = await response.json();

      // Validate attestation data
      if (!attestationData.messages || attestationData.messages.length === 0) {
        throw new Error('No messages found in attestation data');
      }

      const firstMessage = attestationData.messages[0];
      
      if (!firstMessage.message) {
        throw new Error('Message field is missing');
      }
      
      if (!firstMessage.attestation) {
        throw new Error('Attestation field is missing');
      }

      // Simplified check: only verify attestation is not explicitly "PENDING"
      // Don't validate format/length as it works on Aptos without these checks
      const attestationValue = firstMessage.attestation;
      if (typeof attestationValue === 'string') {
        const upperAttestation = attestationValue.toUpperCase().trim();
        if (upperAttestation === 'PENDING' || upperAttestation === 'PENDING...') {
          console.log('[Minting Solana] Attestation still pending:', {
            attestationValue: attestationValue.substring(0, 50),
          });
          if (attempt === maxAttempts) {
            throw new Error(`Attestation not ready yet. Status: ${attestationValue.substring(0, 50)}`);
          }
          continue;
        }
      }

      console.log('[Minting Solana] Attestation received successfully:', {
        messageLength: firstMessage.message.length,
        attestationLength: firstMessage.attestation.length,
        eventNonce: firstMessage.eventNonce,
      });

      return attestationData;
    } catch (error: any) {
      if (attempt === maxAttempts) {
        throw error;
      }
      // Continue retrying for network errors
      if (error.message?.includes('Attestation not ready')) {
        continue;
      }
      // For other errors, wait a bit and retry
      console.warn(`[Minting Solana] Error on attempt ${attempt}, retrying:`, error.message);
    }
  }

  throw new Error(`Failed to fetch attestation after ${maxAttempts} attempts`);
}

function MintingSolanaPageContent() {
  const { toast } = useToast();
  const { publicKey: solanaPublicKey, wallet: solanaWallet, signTransaction } = useSolanaWallet();
  const { connection: solanaConnection } = useConnection();
  
  const [sourceDomain, setSourceDomain] = useState<string>("");
  const [signature, setSignature] = useState<string>("");
  const [finalRecipient, setFinalRecipient] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [status, setStatus] = useState<string>("");
  const [attestationProgress, setAttestationProgress] = useState<{ attempt: number; maxAttempts: number } | null>(null);

  // Auto-fill finalRecipient from connected wallet
  const solanaAddress = solanaPublicKey?.toBase58() || null;
  
  const handleMint = async () => {
    if (!sourceDomain.trim() || !signature.trim() || !finalRecipient.trim()) {
      toast({
        title: "Error",
        description: "Please enter sourceDomain, signature, and final recipient address",
        variant: "destructive",
      });
      return;
    }

    // Validate sourceDomain
    const domainStr = sourceDomain.toString().trim();
    const domain = parseInt(domainStr, 10);
    if (isNaN(domain) || (domain !== 5 && domain !== 9)) {
      toast({
        title: "Error",
        description: "sourceDomain must be 5 (Solana) or 9 (Aptos)",
        variant: "destructive",
      });
      return;
    }

    // Validate Solana wallet connection
    if (!solanaWallet || !solanaPublicKey || !signTransaction) {
      toast({
        title: "Error",
        description: "Please connect a Solana wallet (e.g. Trust Wallet)",
        variant: "destructive",
      });
      return;
    }

    // Validate finalRecipient is a valid Solana address
    try {
      const { PublicKey } = await import("@solana/web3.js");
      new PublicKey(finalRecipient.trim());
    } catch (error) {
      toast({
        title: "Error",
        description: "Invalid Solana address format for final recipient",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    setStatus("");
    setAttestationProgress(null);

    try {
      console.log('[Minting Solana] Starting mint process:', {
        sourceDomain: domain,
        signature: signature.substring(0, 20) + '...',
        finalRecipient: finalRecipient.substring(0, 20) + '...',
        solanaWallet: solanaWallet.adapter?.name,
        solanaAddress: solanaAddress,
      });

      // Step 1: Fetch attestation with polling
      setStatus("Fetching attestation from Circle Iris API...");
      const attestationData = await fetchAttestation(
        domain,
        signature.trim(),
        (attempt, maxAttempts) => {
          setAttestationProgress({ attempt, maxAttempts });
          setStatus(`Waiting for attestation... (attempt ${attempt}/${maxAttempts})`);
        }
      );

      setAttestationProgress(null);
      const firstMessage = attestationData.messages![0];
      
      // Step 2: Validate attestation data
      setStatus("Validating attestation data...");
      
      const messageBytes = hexToBytes(firstMessage.message!);
      const attestationBytes = hexToBytes(firstMessage.attestation!);

      console.log('[Minting Solana] Attestation validated:', {
        messageLength: messageBytes.length,
        attestationLength: attestationBytes.length,
        eventNonce: firstMessage.eventNonce,
      });

      // Step 3: Create mint transaction on Solana
      setStatus("Creating mint transaction...");
      
      if (!solanaConnection) {
        throw new Error('Solana connection not available');
      }

      // Dynamically import Solana web3.js and SPL Token
      const { 
        PublicKey, 
        Transaction, 
        TransactionInstruction,
        SystemProgram,
        SYSVAR_RENT_PUBKEY,
      } = await import("@solana/web3.js");
      
      const { 
        getAssociatedTokenAddress,
        createAssociatedTokenAccountInstruction,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      } = await import("@solana/spl-token");

      // Circle CCTP v1 program IDs on Solana Mainnet
      const TOKEN_MESSENGER_MINTER_PROGRAM_ID = new PublicKey("CCTPiPYPc6AsJuwueEnWgSgucamXDZwBd53dQ11YiKX3");
      const MESSAGE_TRANSMITTER_PROGRAM_ID = new PublicKey("CCTPmbSD7gX1bxKPAmg77w8oFzNFpaQiQUWD43TKaecd");
      
      // USDC mint on Solana
      const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
      
      const recipientPubkey = new PublicKey(finalRecipient.trim());
      
      // Get or create Associated Token Account for USDC
      setStatus("Checking/creating USDC token account...");
      const recipientTokenAccount = await getAssociatedTokenAddress(
        USDC_MINT,
        recipientPubkey,
        false, // allowOwnerOffCurve
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      // Check if token account exists
      const tokenAccountInfo = await solanaConnection.getAccountInfo(recipientTokenAccount);
      const needsTokenAccount = !tokenAccountInfo;

      // Create transaction
      const transaction = new Transaction();

      // Add instruction to create ATA if needed
      if (needsTokenAccount) {
        console.log('[Minting Solana] Creating Associated Token Account...');
        transaction.add(
          createAssociatedTokenAccountInstruction(
            solanaPublicKey, // payer
            recipientTokenAccount, // ata
            recipientPubkey, // owner
            USDC_MINT, // mint
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
          )
        );
      }

      // Create CCTP receiveMessage instruction
      // For Circle CCTP v1, the receiveMessage is typically called on TokenMessengerMinter
      // but it needs proper discriminator and account structure
      
      setStatus("Building CCTP receiveMessage instruction...");
      
      // Try using known Circle CCTP v1 instruction discriminator
      // Based on common Anchor patterns and Circle CCTP structure
      // The discriminator for "receive_message" method in Anchor is typically:
      // sha256("global:receive_message")[0:8] or sha256("receive_message")[0:8]
      
      const encoder = new TextEncoder();
      
      // Try different possible discriminator seeds
      // Circle CCTP v1 might use different naming conventions
      // We'll try them one by one until we find the correct one
      const possibleSeeds = [
        "global:receive_message",    // Standard Anchor (try this first)
        "receive_message",           // Without global prefix
        "handle_receive_message",    // Alternative naming
        "global:handle_receive_message",
        "receive",                   // Short form
        "global:receive",
      ];
      
      // Try different discriminator seeds and data formats
      // Circle CCTP v1 might use different patterns
      let instructionDiscriminator: Buffer | null = null;
      let discriminatorSeed: string = "";
      let instructionData: Buffer | null = null;
      
      // Generate discriminators for all possible seeds
      const discriminators: Array<{ seed: string; discriminator: Buffer }> = [];
      for (const seed of possibleSeeds) {
        const seedBytes = encoder.encode(seed);
        // Convert Uint8Array to ArrayBuffer for crypto.subtle.digest
        // Create a new ArrayBuffer to avoid SharedArrayBuffer issues
        const seedArray = new Uint8Array(seedBytes);
        const hashBuffer = await crypto.subtle.digest("SHA-256", seedArray);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const discriminator = Buffer.from(hashArray.slice(0, 8));
        discriminators.push({ seed, discriminator });
        console.log(`[Minting Solana] Discriminator for "${seed}":`, 
          Array.from(discriminator).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
      }
      
      // Use the first one (standard Anchor) for now
      // If it fails, user can manually try others or we can implement retry logic
      instructionDiscriminator = discriminators[0].discriminator;
      discriminatorSeed = discriminators[0].seed;
      
      console.log('[Minting Solana] Using discriminator seed:', discriminatorSeed);
      console.log('[Minting Solana] Discriminator bytes (hex):', 
        Array.from(instructionDiscriminator).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
      console.log('[Minting Solana] Alternative discriminators available:', discriminators.slice(1).map(d => d.seed));
      
      // Try building instruction data without length prefixes first
      // Format: discriminator (8) + message + attestation
      instructionData = Buffer.concat([
        instructionDiscriminator,
        Buffer.from(messageBytes),
        Buffer.from(attestationBytes),
      ]);
      
      console.log('[Minting Solana] Instruction data built (no length prefixes):', {
        discriminatorLength: instructionDiscriminator.length,
        messageLength: messageBytes.length,
        attestationLength: attestationBytes.length,
        totalLength: instructionData.length,
      });

      // According to Circle CCTP documentation:
      // receiveMessage is called on MessageTransmitter, not TokenMessengerMinter
      // MessageTransmitter then calls TokenMessengerMinter via CPI (Cross-Program Invocation)
      
      // Find PDAs for Circle CCTP programs
      // MessageTransmitter PDA: seeds = ["message_transmitter"] (owned by MessageTransmitter program)
      const [messageTransmitterPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("message_transmitter")],
        MESSAGE_TRANSMITTER_PROGRAM_ID
      );

      // MessageTransmitter authority PDA - try different seed patterns
      // Common patterns: "authority_pda", "authority", "pda"
      let messageTransmitterAuthorityPDA: InstanceType<typeof PublicKey>;
      try {
        [messageTransmitterAuthorityPDA] = PublicKey.findProgramAddressSync(
          [Buffer.from("authority_pda")],
          MESSAGE_TRANSMITTER_PROGRAM_ID
        );
      } catch {
        // Fallback to "authority" seed
        [messageTransmitterAuthorityPDA] = PublicKey.findProgramAddressSync(
          [Buffer.from("authority")],
          MESSAGE_TRANSMITTER_PROGRAM_ID
        );
      }

      // TokenMessenger PDA: seeds = ["token_messenger"] (owned by TokenMessengerMinter program)
      const [tokenMessengerPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("token_messenger")],
        TOKEN_MESSENGER_MINTER_PROGRAM_ID
      );

      // For CCTP v1, we also need remote_token_messenger PDA
      // seeds = ["remote_token_messenger", sourceDomainId as u32 (4 bytes, little-endian)]
      const domainBuffer = Buffer.allocUnsafe(4);
      domainBuffer.writeUInt32LE(domain, 0);
      const [remoteTokenMessengerPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("remote_token_messenger"), domainBuffer],
        TOKEN_MESSENGER_MINTER_PROGRAM_ID
      );

      // Token minter PDA: seeds = ["token_minter"]
      const [tokenMinterPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("token_minter")],
        TOKEN_MESSENGER_MINTER_PROGRAM_ID
      );

      // Local token PDA: seeds = ["local_token", USDC_MINT]
      const [localTokenPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("local_token"), USDC_MINT.toBuffer()],
        TOKEN_MESSENGER_MINTER_PROGRAM_ID
      );

      console.log('[Minting Solana] PDAs:', {
        messageTransmitterPDA: messageTransmitterPDA.toBase58(),
        messageTransmitterAuthorityPDA: messageTransmitterAuthorityPDA.toBase58(),
        tokenMessengerPDA: tokenMessengerPDA.toBase58(),
        remoteTokenMessengerPDA: remoteTokenMessengerPDA.toBase58(),
        tokenMinterPDA: tokenMinterPDA.toBase58(),
        localTokenPDA: localTokenPDA.toBase58(),
      });

      // Create receiveMessage instruction on MessageTransmitter
      // According to Circle docs, receiveMessage is on MessageTransmitter
      // It takes message and attestation, then calls TokenMessengerMinter via CPI
      // For CCTP v1, the discriminator might be different - let's try "receive_message" on MessageTransmitter
      const messageTransmitterDiscriminatorSeed = "global:receive_message";
      const mtSeedBytes = encoder.encode(messageTransmitterDiscriminatorSeed);
      // Convert to ArrayBuffer for crypto.subtle.digest
      // Create a new Uint8Array to avoid SharedArrayBuffer issues
      const mtSeedArray = new Uint8Array(mtSeedBytes);
      const mtHashBuffer = await crypto.subtle.digest("SHA-256", mtSeedArray);
      const mtHashArray = Array.from(new Uint8Array(mtHashBuffer));
      const messageTransmitterDiscriminator = Buffer.from(mtHashArray.slice(0, 8));
      
      // MessageTransmitter receiveMessage data format for Anchor:
      // discriminator (8 bytes) + message length (4 bytes, u32 le) + message bytes + attestation length (4 bytes, u32 le) + attestation bytes
      // OR just: discriminator + message + attestation (no length prefixes)
      // Let's try with length prefixes first (Anchor Vec<u8> format)
      const messageLengthBuffer = Buffer.allocUnsafe(4);
      messageLengthBuffer.writeUInt32LE(messageBytes.length, 0);
      const attestationLengthBuffer = Buffer.allocUnsafe(4);
      attestationLengthBuffer.writeUInt32LE(attestationBytes.length, 0);
      
      const messageTransmitterData = Buffer.concat([
        messageTransmitterDiscriminator,
        messageLengthBuffer,
        Buffer.from(messageBytes),
        attestationLengthBuffer,
        Buffer.from(attestationBytes),
      ]);
      
      console.log('[Minting Solana] MessageTransmitter data format (with length prefixes):', {
        discriminatorLength: messageTransmitterDiscriminator.length,
        messageLength: messageBytes.length,
        attestationLength: attestationBytes.length,
        totalLength: messageTransmitterData.length,
      });

      // Create receiveMessage instruction on MessageTransmitter
      // According to Circle CCTP v1 docs, receiveMessage on MessageTransmitter needs:
      // 1. caller (must be signer - the account calling receiveMessage)
      // 2. payer (must be signer - pays for transaction fees)
      // 3. message_transmitter (PDA owned by MessageTransmitter program, must be writable)
      // 4. authority_pda
      // 5. remaining accounts for TokenMessengerMinter CPI
      const receiveMessageIx = new TransactionInstruction({
        programId: MESSAGE_TRANSMITTER_PROGRAM_ID,
        keys: [
          // Caller must be first signer (required by MessageTransmitter.receiveMessage)
          { pubkey: solanaPublicKey, isSigner: true, isWritable: false }, // caller
          // Payer (can be same as caller, but must be signer and writable)
          { pubkey: solanaPublicKey, isSigner: true, isWritable: true }, // payer
          // MessageTransmitter PDA (owned by MessageTransmitter program, must be writable)
          { pubkey: messageTransmitterPDA, isSigner: false, isWritable: true },
          // Core MessageTransmitter accounts
          { pubkey: messageTransmitterAuthorityPDA, isSigner: false, isWritable: false },
          // Remaining accounts for TokenMessengerMinter (as per Circle CCTP docs)
          { pubkey: tokenMessengerPDA, isSigner: false, isWritable: false },
          { pubkey: remoteTokenMessengerPDA, isSigner: false, isWritable: false },
          { pubkey: tokenMinterPDA, isSigner: false, isWritable: true },
          { pubkey: localTokenPDA, isSigner: false, isWritable: true },
          { pubkey: recipientTokenAccount, isSigner: false, isWritable: true },
          { pubkey: USDC_MINT, isSigner: false, isWritable: true },
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
          { pubkey: TOKEN_MESSENGER_MINTER_PROGRAM_ID, isSigner: false, isWritable: false },
        ],
        data: messageTransmitterData,
      });
      
      console.log('[Minting Solana] Instruction created with MessageTransmitter program (will CPI to TokenMessengerMinter)');

      transaction.add(receiveMessageIx);
      transaction.feePayer = solanaPublicKey;

      console.log('[Minting Solana] Transaction prepared:', {
        recipient: recipientPubkey.toBase58(),
        tokenAccount: recipientTokenAccount.toBase58(),
        needsTokenAccount,
        messageLength: messageBytes.length,
        attestationLength: attestationBytes.length,
        instructionDataLength: messageTransmitterData.length,
      });

      // Step 4: Sign and submit transaction
      setStatus("Please approve the transaction in your wallet...");
      
      if (!signTransaction) {
        throw new Error('Wallet does not support signTransaction');
      }

      // Get fresh blockhash right before signing to avoid "Blockhash not found" error
      // This ensures the blockhash is as fresh as possible
      const { blockhash, lastValidBlockHeight } = await solanaConnection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;

      const signedTransaction = await signTransaction(transaction);
      console.log('[Minting Solana] Transaction signed');

      setStatus("Submitting transaction to Solana...");
      
      // Try to submit with preflight first to catch errors early
      let txSignature: string;
      try {
        txSignature = await solanaConnection.sendRawTransaction(
          signedTransaction.serialize(),
          {
            skipPreflight: false,
            maxRetries: 3,
          }
        );
      } catch (sendError: any) {
        // Check for different error types
        const errorMessage = sendError?.message || '';
        const errorLogs = sendError?.logs || [];
        const hasMemoryError = errorMessage.includes('memory allocation') || 
                               errorMessage.includes('out of memory') ||
                               errorLogs.some((log: string) => log.includes('memory allocation') || log.includes('out of memory'));
        const hasInstructionError = errorMessage.includes('InstructionFallbackNotFound') || 
                                    errorMessage.includes('0x65') ||
                                    errorLogs.some((log: string) => log.includes('InstructionFallbackNotFound'));
        
        if (hasMemoryError) {
          console.error('[Minting Solana] Memory allocation error - data format might be incorrect');
          console.error('[Minting Solana] Tried format: discriminator + message_length + message + attestation_length + attestation');
          console.error('[Minting Solana] Error details:', {
            message: errorMessage,
            logs: errorLogs,
          });
          
          throw new Error(
            `Data format error: The instruction data format might be incorrect. ` +
            `Tried format with length prefixes. ` +
            `Possible issues: 1) Wrong data format (try without length prefixes), ` +
            `2) Wrong account order, 3) Wrong PDA seeds. ` +
            `Error: ${errorMessage}`
          );
        }
        
        if (hasInstructionError) {
          console.error('[Minting Solana] InstructionFallbackNotFound - discriminator is incorrect');
          console.error('[Minting Solana] Tried discriminator seed:', messageTransmitterDiscriminatorSeed);
          
          throw new Error(
            `Instruction discriminator incorrect. Tried "${messageTransmitterDiscriminatorSeed}". ` +
            `This likely means Circle CCTP v1 uses a different instruction format. ` +
            `Possible solutions: 1) Use Wormhole SDK to create instruction, ` +
            `2) Find correct discriminator from Circle CCTP IDL, ` +
            `3) Check if instruction should be called on TokenMessengerMinter instead of MessageTransmitter. ` +
            `Error: ${errorMessage}`
          );
        }
        throw sendError;
      }

      console.log('[Minting Solana] Transaction submitted:', txSignature);
      setStatus(`Transaction submitted: ${txSignature}`);

      // Wait for confirmation
      setStatus("Waiting for transaction confirmation...");
      const confirmation = await solanaConnection.confirmTransaction({
        signature: txSignature,
        blockhash,
        lastValidBlockHeight,
      }, 'confirmed');

      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      }

      console.log('[Minting Solana] Transaction confirmed:', confirmation);
      
      toast({
        title: "Mint Successful!",
        description: `USDC minted successfully! Transaction: ${txSignature.slice(0, 8)}...${txSignature.slice(-8)}. View on Solscan: https://solscan.io/tx/${txSignature}`,
      });

      setStatus(`✅ Mint completed! Transaction: ${txSignature}`);

    } catch (error: any) {
      console.error("[Minting Solana] Error:", error);
      setStatus(`Error: ${error.message}`);
      toast({
        title: "Error",
        description: error.message || "Failed to process minting request",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      setAttestationProgress(null);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <Card>
        <CardHeader>
          <CardTitle>Solana CCTP Minting</CardTitle>
          <CardDescription>
            Enter transaction signature (from Aptos burn), source domain, and final recipient Solana address.
            The script will fetch attestation from Circle Iris API and prepare the mint transaction.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Solana wallet connect */}
          <SolanaWalletSelector onWalletChange={(addr) => {
            // Если получатель не задан, подставляем подключенный кошелёк
            if (addr && !finalRecipient) {
              setFinalRecipient(addr);
            }
          }} />

          {/* Wallet Connection Status */}
          {solanaAddress ? (
            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-md">
              <p className="text-sm text-green-800 dark:text-green-200">
                ✓ Solana wallet connected: {solanaAddress.substring(0, 8)}...{solanaAddress.slice(-8)}
              </p>
            </div>
          ) : (
            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-md">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                ⚠ Please connect a Solana wallet (e.g. Trust Wallet) to proceed
              </p>
            </div>
          )}

          {/* Status Display */}
          {status && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md">
              <p className="text-sm text-blue-800 dark:text-blue-200">{status}</p>
              {attestationProgress && (
                <div className="mt-2">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{
                        width: `${(attestationProgress.attempt / attestationProgress.maxAttempts) * 100}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    Attempt {attestationProgress.attempt} of {attestationProgress.maxAttempts}
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="sourceDomain">Source Domain</Label>
                <Input
                  id="sourceDomain"
                  type="number"
                  value={sourceDomain}
                  onChange={(e) => setSourceDomain(e.target.value)}
                  placeholder="9 (Aptos)"
                  className="font-mono text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">9 for Aptos, 5 for Solana</p>
              </div>

              <div>
                <Label htmlFor="signature">Transaction Signature</Label>
                <Input
                  id="signature"
                  value={signature}
                  onChange={(e) => setSignature(e.target.value)}
                  placeholder="Aptos transaction hash (0x...)"
                  className="font-mono text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">Transaction hash from Aptos burn</p>
              </div>
            </div>

            <div>
              <Label htmlFor="finalRecipient">Final Recipient Address (Solana)</Label>
              <Input
                id="finalRecipient"
                value={finalRecipient}
                onChange={(e) => setFinalRecipient(e.target.value)}
                placeholder={solanaAddress || "Solana wallet address (e.g. 9XL5jC...)"}
                className="font-mono text-sm"
              />
              {solanaAddress && !finalRecipient && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => setFinalRecipient(solanaAddress)}
                >
                  Use Connected Wallet
                </Button>
              )}
            </div>

            <Button
              onClick={handleMint}
              disabled={
                isProcessing ||
                !sourceDomain.trim() ||
                !signature.trim() ||
                !finalRecipient.trim() ||
                !solanaWallet ||
                !signTransaction
              }
              className="w-full bg-green-600 hover:bg-green-700"
            >
              {isProcessing ? "Processing..." : "Mint USDC on Solana"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function MintingSolanaPage() {
  return (
    <SolanaWalletProviderWrapper>
      <MintingSolanaPageContent />
    </SolanaWalletProviderWrapper>
  );
}

