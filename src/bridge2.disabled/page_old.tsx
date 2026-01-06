"use client";

import { useState, useEffect } from 'react';
import { Wormhole } from '@wormhole-foundation/sdk-connect';
import solana from '@wormhole-foundation/sdk/solana';
import aptos from '@wormhole-foundation/sdk/aptos';
import type { ChainAddress } from '@wormhole-foundation/sdk-connect';
// CRITICAL: Import CCTP modules statically to ensure they register protocols
// before wormhole() is called. These imports execute registerProtocol() at module load time.
// In Next.js, static imports in "use client" components execute on client side.
import '@wormhole-foundation/sdk-solana-cctp';
import '@wormhole-foundation/sdk-aptos-cctp';
import { initCCTPProtocols } from '@/lib/wormhole/initCCTP';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { useWallet as useSolanaWallet, useConnection } from '@solana/wallet-adapter-react';
import { useToast } from '@/components/ui/use-toast';
import { createAptosSigner } from '@/lib/wormhole/signers';
import { BridgeView } from '@/components/bridge/BridgeView';
import { SolanaWalletProviderWrapper } from './SolanaWalletProvider';
import bs58 from 'bs58';

// USDC token addresses
const USDC_SOLANA = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'; // USDC on Solana
const USDC_APTOS = '0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b'; // USDC on Aptos

// Chains configuration
const CHAINS = [
  { id: 'Solana', name: 'Solana' },
  { id: 'Aptos', name: 'Aptos' },
];

// Tokens configuration
const TOKENS = [
  {
    id: USDC_SOLANA,
    symbol: 'USDC',
    name: 'USD Coin',
    chain: 'Solana',
  },
  {
    id: USDC_APTOS,
    symbol: 'USDC',
    name: 'USD Coin',
    chain: 'Aptos',
  },
];

function Bridge2PageContent() {
  const { account, signAndSubmitTransaction } = useWallet();
  const { publicKey: solanaPublicKey, wallet: solanaWallet, signTransaction } = useSolanaWallet();
  const { connection: solanaConnection } = useConnection();
  const { toast } = useToast();
  
  const [wh, setWh] = useState<any>(null);
  const [sourceChain, setSourceChain] = useState<typeof CHAINS[0] | null>(CHAINS[0]);
  const [sourceToken, setSourceToken] = useState<typeof TOKENS[0] | null>(
    TOKENS.find((t) => t.chain === 'Solana') || null
  );
  const [destChain, setDestChain] = useState<typeof CHAINS[0] | null>(CHAINS[1]);
  const [destToken, setDestToken] = useState<typeof TOKENS[0] | null>(
    TOKENS.find((t) => t.chain === 'Aptos') || null
  );
  const [transferAmount, setTransferAmount] = useState<string>('0.1');
  const [destinationAddress, setDestinationAddress] = useState<string>('');
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferStatus, setTransferStatus] = useState<string>('');
  // Store funded signers for potential refund
  const [fundedSigners, setFundedSigners] = useState<Array<{ pubkey: string; keypair: any }>>([]);
  // Store depositMessageHash for Aptos redeem
  const [depositMessageHash, setDepositMessageHash] = useState<string | null>(null);
  const [lastTransferTxSignature, setLastTransferTxSignature] = useState<string | null>(null);

  // Get Solana address from wallet adapter
  const solanaAddress = solanaPublicKey?.toBase58() || null;

  // Initialize Wormhole SDK
  useEffect(() => {
    const initWormhole = async () => {
      try {
        console.log('[Bridge2] Starting Wormhole initialization...');
        
        // CCTP modules are imported statically at the top of the file, so protocols should be registered
        // But we also call initCCTPProtocols to ensure registration and add AutomaticCircleBridge
        // This ensures protocols are registered in the same protocolFactory instance that wormhole() will use
        console.log('[Bridge2] Calling initCCTPProtocols...');
        try {
          await initCCTPProtocols();
          console.log('[Bridge2] initCCTPProtocols completed');
        } catch (err: any) {
          console.error('[Bridge2] initCCTPProtocols failed:', err);
          throw err; // Re-throw to prevent continuing with unregistered protocols
        }
        
        // Small delay to ensure protocol registration is complete
        await new Promise(resolve => setTimeout(resolve, 200));
        console.log('[Bridge2] Delay completed, initializing Wormhole...');
        
        // IMPORTANT: Before initializing Wormhole, verify protocols are registered
        // and ensure we're using the same protocolFactory instance
        const sdkDefinitions = await import('@wormhole-foundation/sdk-definitions');
        const { protocolIsRegistered: checkProtocol } = sdkDefinitions as any;
        const sdkSolana = await import('@wormhole-foundation/sdk-solana');
        const { _platform } = sdkSolana;
        
        if (checkProtocol) {
          const solanaCBRegistered = checkProtocol(_platform, 'CircleBridge');
          const solanaACBRegistered = checkProtocol(_platform, 'AutomaticCircleBridge');
          console.log('[Bridge2] Pre-Wormhole protocol check:', {
            solanaCircleBridge: solanaCBRegistered,
            solanaAutomaticCircleBridge: solanaACBRegistered,
          });
        }
        
        // Manually load only the required core protocols to avoid TokenBridge,
        // which pulls in its own copy of Solana core and causes double registration
        const solDef = await solana();
        const aptDef = await aptos();

        // Load WormholeCore protocol for each platform (no TokenBridge)
        if (solDef.protocols?.WormholeCore) {
          await solDef.protocols.WormholeCore();
        }
        if (aptDef.protocols?.WormholeCore) {
          await aptDef.protocols.WormholeCore();
        }

        // CCTP protocols (CircleBridge / AutomaticCircleBridge) are already
        // registered via the CCTP modules + initCCTPProtocols

        const wormholeInstance = new Wormhole('Mainnet', [
          solDef.Platform,
          aptDef.Platform,
        ]);
        console.log('[Bridge2] Wormhole instance created (manual core protocol load)');
        
        // Verify protocols are still registered after Wormhole initialization
        if (checkProtocol) {
          const solanaCBRegistered = checkProtocol(_platform, 'CircleBridge');
          const solanaACBRegistered = checkProtocol(_platform, 'AutomaticCircleBridge');
          console.log('[Bridge2] Post-Wormhole protocol check:', {
            solanaCircleBridge: solanaCBRegistered,
            solanaAutomaticCircleBridge: solanaACBRegistered,
          });
          
          // Log protocolFactory state for debugging
          const { protocolFactory: pf } = sdkDefinitions as any;
          if (pf) {
            console.log('[Bridge2] Post-Wormhole protocolFactory state:', {
              hasCircleBridge: 'CircleBridge' in pf,
              hasAutomaticCircleBridge: 'AutomaticCircleBridge' in pf,
              circleBridgePlatforms: pf.CircleBridge ? Object.keys(pf.CircleBridge) : [],
              automaticCircleBridgePlatforms: pf.AutomaticCircleBridge ? Object.keys(pf.AutomaticCircleBridge) : [],
            });
          } else {
            console.warn('[Bridge2] protocolFactory not accessible from sdkDefinitions');
          }
        }
        
        // Verify that CircleBridge is available (should be registered by CCTP modules)
        // IMPORTANT: Use getProtocolInitializer directly to check if it uses the same protocolFactory
        try {
          const { getProtocolInitializer: getPI } = await import('@wormhole-foundation/sdk-definitions');
          const solanaPlatform = wormholeInstance.getPlatform('Solana');
          console.log('[Bridge2] Testing getProtocolInitializer directly...');
          try {
            const cbCtor = getPI(_platform, 'CircleBridge');
            console.log('[Bridge2] CircleBridge constructor found via getProtocolInitializer:', !!cbCtor);
          } catch (err: any) {
            console.error('[Bridge2] getProtocolInitializer failed for CircleBridge:', err.message || err);
          }
          
          const solanaChain = wormholeInstance.getChain('Solana');
          const cb = await solanaChain.getCircleBridge();
          console.log('[Bridge2] CircleBridge is available:', !!cb);
        } catch (err: any) {
          console.error('[Bridge2] CircleBridge check failed:', err.message || err);
        }
        
        // Verify that AutomaticCircleBridge is available
        try {
          const { getProtocolInitializer: getPI } = await import('@wormhole-foundation/sdk-definitions');
          const solanaPlatform = wormholeInstance.getPlatform('Solana');
          console.log('[Bridge2] Testing getProtocolInitializer for AutomaticCircleBridge...');
          try {
            const acbCtor = getPI(_platform, 'AutomaticCircleBridge');
            console.log('[Bridge2] AutomaticCircleBridge constructor found via getProtocolInitializer:', !!acbCtor);
          } catch (err: any) {
            console.error('[Bridge2] getProtocolInitializer failed for AutomaticCircleBridge:', err.message || err);
          }
          
          const solanaChain = wormholeInstance.getChain('Solana');
          const acb = await solanaChain.getAutomaticCircleBridge();
          console.log('[Bridge2] AutomaticCircleBridge is available:', !!acb);
        } catch (err: any) {
          console.error('[Bridge2] AutomaticCircleBridge check failed:', err.message || err);
          console.warn('[Bridge2] This may cause issues with automatic transfers');
        }
        
        setWh(wormholeInstance);
        console.log('[Bridge2] Wormhole SDK initialized with CCTP support');
      } catch (error) {
        console.error('[Bridge2] Failed to initialize Wormhole SDK:', error);
        toast({
          variant: "destructive",
          title: "Initialization Error",
          description: "Failed to initialize Wormhole SDK",
        });
      }
    };

    initWormhole();
  }, [toast]);

  // Function to refund SOL from funded signers back to user's wallet
  const handleRefund = async () => {
    if (!solanaAddress || fundedSigners.length === 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No funded signers to refund or wallet not connected",
      });
      return;
    }

    setIsTransferring(true);
    setTransferStatus('Refunding SOL from internal signers...');

    try {
      const { Connection, Transaction, SystemProgram, PublicKey, Keypair, LAMPORTS_PER_SOL } = await import('@solana/web3.js');
      const connection = solanaConnection || new Connection(
        process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 
        process.env.SOLANA_RPC_URL || 
        'https://mainnet.helius-rpc.com/?api-key=29798653-2d13-4d8a-96ad-df70b015e234',
        'confirmed'
      );

      const walletPubkey = new PublicKey(solanaAddress);
      let totalRefunded = 0;
      const refundTx = new Transaction();

      // Запрашиваем реальный rent-exempt минимум для пустого аккаунта
      const rentExempt = await connection.getMinimumBalanceForRentExemption(0);
      const feeBuffer = 5_000; // небольшой запас под комиссию

      for (const { pubkey, keypair } of fundedSigners) {
        try {
          const signerPubkey = new PublicKey(pubkey);
          const balance = await connection.getBalance(signerPubkey);
          
          // Оставляем на аккаунте rent-exempt минимум + небольшой буфер под комиссию
          const minBalance = rentExempt + feeBuffer;
          const amountToRefund = balance > minBalance ? balance - minBalance : 0;
          
          if (amountToRefund > 0) {
            console.log('[Bridge2] Refunding from signer:', {
              pubkey: pubkey,
              balance: balance,
              balanceSOL: balance / LAMPORTS_PER_SOL,
              amountToRefund: amountToRefund,
              amountToRefundSOL: amountToRefund / LAMPORTS_PER_SOL,
            });

            // Create refund instruction
            refundTx.add(
              SystemProgram.transfer({
                fromPubkey: signerPubkey,
                toPubkey: walletPubkey,
                lamports: amountToRefund,
              })
            );

            totalRefunded += amountToRefund;
          }
        } catch (err: any) {
          console.warn('[Bridge2] Failed to process signer for refund:', err.message);
        }
      }

      if (refundTx.instructions.length === 0) {
        toast({
          variant: "default",
          title: "No Refund Needed",
          description: "No excess funds to refund from signers",
        });
        setIsTransferring(false);
        return;
      }

      // Set fee payer and recent blockhash
      refundTx.feePayer = walletPubkey;
      const { blockhash } = await connection.getLatestBlockhash('confirmed');
      refundTx.recentBlockhash = blockhash;

      // Sign transaction with all signer keypairs
      for (const { keypair } of fundedSigners) {
        if (keypair) {
          refundTx.partialSign(keypair);
        }
      }

      // Sign with wallet
      if (!signTransaction) {
        throw new Error('Sign transaction function not available');
      }
      const signed = await signTransaction(refundTx);
      
      // Send transaction
      const signature = await connection.sendRawTransaction(signed.serialize());
      console.log('[Bridge2] Refund transaction sent:', signature);
      console.log('[Bridge2] View on Solscan: https://solscan.io/tx/' + signature);
      setTransferStatus(`Refund transaction sent: ${signature.slice(0, 8)}...${signature.slice(-8)}`);

      // Wait for confirmation
      try {
        await connection.confirmTransaction(signature, 'confirmed');
        console.log('[Bridge2] Refund transaction confirmed');
      } catch (confirmError: any) {
        console.warn('[Bridge2] Refund transaction confirmation timeout, but may have succeeded:', confirmError.message);
      }

      // Clear funded signers after successful refund
      setFundedSigners([]);

      toast({
        title: "Refund Successful",
        description: `Refunded ${(totalRefunded / LAMPORTS_PER_SOL).toFixed(6)} SOL. Transaction: ${signature.slice(0, 8)}...${signature.slice(-8)}. View on Solscan: https://solscan.io/tx/${signature}`,
      });

      setTransferStatus(`Refunded ${(totalRefunded / LAMPORTS_PER_SOL).toFixed(6)} SOL`);
    } catch (error: any) {
      console.error('[Bridge2] Refund error:', error);
      setTransferStatus(`Refund error: ${error.message || 'Unknown error'}`);
      toast({
        variant: "destructive",
        title: "Refund Failed",
        description: error.message || "Failed to refund SOL from signers",
      });
    } finally {
      setIsTransferring(false);
    }
  };

  /**
   * Log successful funding transaction to JSON for manual refund recovery
   * Saves to localStorage and offers download
   */
  const logFundingTransaction = (
    fromWallet: string,
    toSigner: string,
    amount: number,
    amountSOL: number,
    transactionSignature: string,
    keypair: any
  ) => {
    try {
      const timestamp = Math.floor(Date.now() / 1000); // Unix timestamp
      
      // Convert keypair secret key to base58 for storage
      let secretKeyBase58: string | null = null;
      try {
        if (keypair && keypair.secretKey) {
          secretKeyBase58 = bs58.encode(keypair.secretKey);
        }
      } catch (err) {
        console.warn('[Bridge2] Failed to encode secret key:', err);
      }

      const logEntry = {
        timestamp,
        timestampISO: new Date().toISOString(),
        type: 'signer_funding',
        from: {
          wallet: fromWallet,
        },
        to: {
          signer: toSigner,
        },
        amount: {
          lamports: amount,
          sol: amountSOL,
        },
        transaction: {
          signature: transactionSignature,
          solscan: `https://solscan.io/tx/${transactionSignature}`,
        },
        recovery: {
          secretKeyBase58: secretKeyBase58,
          note: 'Use this secretKeyBase58 with Keypair.fromSecretKey(bs58.decode(secretKeyBase58)) to recover funds',
        },
      };

      // Save to localStorage
      try {
        const existingLogs = localStorage.getItem('signer_funding_logs');
        const logs = existingLogs ? JSON.parse(existingLogs) : [];
        logs.push(logEntry);
        // Keep only last 100 entries
        const recentLogs = logs.slice(-100);
        localStorage.setItem('signer_funding_logs', JSON.stringify(recentLogs));
        console.log('[Bridge2] Funding transaction logged to localStorage');
      } catch (err) {
        console.warn('[Bridge2] Failed to save to localStorage:', err);
      }

      // Offer download
      try {
        const jsonStr = JSON.stringify(logEntry, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `signer_funding_${timestamp}_${toSigner.slice(0, 8)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        console.log('[Bridge2] Funding transaction log downloaded');
      } catch (err) {
        console.warn('[Bridge2] Failed to download log file:', err);
      }

      // Also log to console for debugging
      console.log('[Bridge2] Funding transaction logged:', {
        timestamp,
        from: fromWallet,
        to: toSigner,
        amountSOL,
        signature: transactionSignature,
        hasSecretKey: !!secretKeyBase58,
      });
    } catch (error) {
      console.error('[Bridge2] Failed to log funding transaction:', error);
    }
  };

  /**
   * Normalize depositMessageHash format
   * Circle API requires: 32-byte hex string with 0x prefix (66 characters total)
   */
  const normalizeDepositMessageHash = (hash: string | null): string | null => {
    if (!hash) return null;
    
    // Remove 0x prefix if present
    let normalized = hash.startsWith('0x') ? hash.slice(2) : hash;
    
    // Remove any whitespace
    normalized = normalized.trim();
    
    // Validate length (should be 64 hex characters = 32 bytes)
    if (normalized.length !== 64) {
      console.warn('[Bridge2] depositMessageHash has invalid length:', {
        original: hash,
        normalized,
        length: normalized.length,
        expected: 64,
      });
      // Still return it with 0x prefix, but log warning
    }
    
    // Validate hex format
    if (!/^[0-9a-fA-F]+$/.test(normalized)) {
      console.warn('[Bridge2] depositMessageHash contains non-hex characters:', hash);
      return null;
    }
    
    // Return with 0x prefix
    return `0x${normalized.toLowerCase()}`;
  };

  /**
   * Verify if Solana transaction is a valid CCTP burn transaction
   * Based on CircleIntegration contract example
   */
  const verifyCCTPTransaction = (tx: any): { isValid: boolean; details: any } => {
    try {
      const CCTP_PROGRAM_ID = 'CCTPiPYPc6AsJuwueEnWgSgucamXDZwBd53dQ11YiKX3';
      const logs = tx.meta?.logMessages || [];
      
      // Check if transaction involves CCTP program
      const hasCCTPProgram = tx.transaction?.message?.accountKeys?.some((key: any) => 
        key.toString() === CCTP_PROGRAM_ID
      ) || false;
      
      // Check logs for CCTP-related events
      const hasCCTPLogs = logs.some((log: string) => 
        log.includes('TokenMessenger') || 
        log.includes('DepositForBurn') ||
        log.includes('CCTP') ||
        log.includes('Circle') ||
        log.includes('depositForBurn')
      );
      
      // Check if transaction was successful
      const isSuccessful = tx.meta?.err === null;
      
      // Check for CCTP instruction
      let hasCCTPInstruction = false;
      let cctpInstructionData: any = null;
      
      try {
        const instructions = tx.transaction?.message?.instructions || [];
        for (const ix of instructions) {
          if (ix.programId?.toString() === CCTP_PROGRAM_ID || 
              (typeof ix.programId === 'string' && ix.programId === CCTP_PROGRAM_ID)) {
            hasCCTPInstruction = true;
            cctpInstructionData = ix.data;
            break;
          }
        }
        
        // Also check inner instructions
        if (!hasCCTPInstruction && tx.meta?.innerInstructions) {
          for (const innerIxGroup of tx.meta.innerInstructions) {
            for (const innerIx of innerIxGroup.instructions) {
              if (innerIx.programId?.toString() === CCTP_PROGRAM_ID) {
                hasCCTPInstruction = true;
                cctpInstructionData = innerIx.data;
                break;
              }
            }
            if (hasCCTPInstruction) break;
          }
        }
      } catch (e) {
        // Ignore errors in instruction parsing
      }
      
      const isValid = hasCCTPProgram && (hasCCTPLogs || hasCCTPInstruction) && isSuccessful;
      
      return {
        isValid,
        details: {
          hasCCTPProgram,
          hasCCTPLogs,
          hasCCTPInstruction,
          isSuccessful,
          cctpInstructionData: cctpInstructionData ? (typeof cctpInstructionData === 'string' ? cctpInstructionData.slice(0, 50) + '...' : 'present') : null,
          logsCount: logs.length,
          error: tx.meta?.err,
        },
      };
    } catch (error: any) {
      console.warn('[Bridge2] Error verifying CCTP transaction:', error.message);
      return { isValid: false, details: { error: error.message } };
    }
  };

  /**
   * Extract depositMessageHash from Solana transaction logs
   * This is needed to complete the CCTP transfer on Aptos
   */
  const extractDepositMessageHash = async (txSignature: string): Promise<string | null> => {
    try {
      const { Connection } = await import('@solana/web3.js');
      const connection = solanaConnection || new Connection(
        process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 
        process.env.SOLANA_RPC_URL || 
        'https://mainnet.helius-rpc.com/?api-key=29798653-2d13-4d8a-96ad-df70b015e234',
        'confirmed'
      );

      console.log('[Bridge2] Extracting depositMessageHash from transaction:', txSignature);
      
      // Get transaction with logs
      const tx = await connection.getTransaction(txSignature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      });

      if (!tx) {
        console.warn('[Bridge2] Transaction not found:', txSignature);
        return null;
      }

      // Verify that this is a valid CCTP transaction
      const verification = verifyCCTPTransaction(tx);
      console.log('[Bridge2] CCTP transaction verification:', verification);
      
      if (!verification.isValid) {
        console.warn('[Bridge2] Transaction does not appear to be a valid CCTP burn transaction:', verification.details);
        // Still try to extract hash, but log warning
      }

      const logs = tx.meta?.logMessages || [];
      console.log('[Bridge2] Transaction logs count:', logs.length);

      // Try multiple patterns to find message hash
      // Pattern 1: "message hash: <hash>"
      // Pattern 2: "messageHash: <hash>"
      // Pattern 3: "depositMessageHash: <hash>"
      // Pattern 4: Hex string (64 characters) in logs
      // Pattern 5: Base58 string that might be the hash
      
      for (const log of logs) {
        // Try various patterns
        const patterns = [
          /message[_\s]?hash[:\s]+([A-Za-z0-9]{32,})/i,
          /deposit[_\s]?message[_\s]?hash[:\s]+([A-Za-z0-9]{32,})/i,
          /0x([A-Fa-f0-9]{64})/,
          /([A-Za-z0-9]{64})/,
        ];

        for (const pattern of patterns) {
          const match = log.match(pattern);
          if (match && match[1]) {
            let hash = match[1];
            // Validate hash length (should be 64 hex chars = 32 bytes)
            if (hash.length >= 32 && hash.length <= 128) {
              // Normalize hash format
              const normalized = normalizeDepositMessageHash(hash);
              console.log('[Bridge2] Found potential depositMessageHash:', {
                original: hash,
                normalized,
              });
              return normalized || hash;
            }
          }
        }
      }

      // Alternative: Check inner instructions (CCTP might emit events in inner instructions)
      if (tx.meta?.innerInstructions) {
        for (const innerIxGroup of tx.meta.innerInstructions) {
          for (const innerIx of innerIxGroup.instructions) {
            if (innerIx.data) {
              const dataStr = Buffer.from(innerIx.data, 'base64').toString('hex');
              // CCTP message hash is typically 32 bytes (64 hex chars)
              if (dataStr.length >= 64) {
                // Try to extract 64-char hex string
                const hashMatch = dataStr.match(/([A-Fa-f0-9]{64})/);
                if (hashMatch) {
                  const normalized = normalizeDepositMessageHash(hashMatch[1]);
                  console.log('[Bridge2] Found potential depositMessageHash in inner instruction data:', {
                    original: hashMatch[1],
                    normalized,
                  });
                  return normalized || hashMatch[1];
                }
              }
            }
          }
        }
      }

      // Note: depositMessageHash is typically not in account keys
      // It's usually computed from transaction data or available via Circle API

      // Alternative: Try to get from Wormhole SDK if available
      // The transfer object might have the message hash
      console.warn('[Bridge2] Could not extract depositMessageHash from transaction logs. You may need to get it from Circle API using the transaction signature.');
      return null;
    } catch (error: any) {
      console.error('[Bridge2] Error extracting depositMessageHash:', error);
      return null;
    }
  };

  /**
   * Compute depositMessageHash from CCTP message data
   * depositMessageHash = keccak256(serialized_message)
   */
  const computeDepositMessageHashFromMessage = async (message: any): Promise<string | null> => {
    try {
      // CCTP message needs to be serialized in a specific format
      // This is complex and depends on the exact CCTP message format
      // For now, we'll try to use a library if available, or return null
      
      // Try to use @noble/hashes (already installed as transitive dependency)
      let keccak256: ((data: Uint8Array) => string) | null = null;
      
      try {
        // Try to import @noble/hashes
        const { sha3_256 } = await import('@noble/hashes/sha3');
        keccak256 = (data: Uint8Array) => {
          const hash = sha3_256(data);
          // Convert Uint8Array to hex string
          return Array.from(hash).map(b => b.toString(16).padStart(2, '0')).join('');
        };
        console.log('[Bridge2] Using @noble/hashes for keccak256');
      } catch (e) {
        // @noble/hashes not available - try ethers as fallback
        try {
          const { keccak256: ethersKeccak256 } = await import('ethers');
          keccak256 = (data: Uint8Array) => {
            // ethers keccak256 expects hex string or array-like
            return ethersKeccak256(data).slice(2); // Remove 0x prefix
          };
          console.log('[Bridge2] Using ethers for keccak256');
        } catch (e2) {
          // No library available
          console.log('[Bridge2] No keccak256 library available. Will try API endpoint instead.');
        }
      }
      
      if (!keccak256) {
        // Can't compute locally - will try API endpoint
        console.log('[Bridge2] Cannot compute depositMessageHash locally. Will try API endpoint.');
        return null;
      }
      
      // Serialize message according to CCTP format
      // This is a simplified version - actual serialization is more complex
      // CCTP message format: version(1) + sourceDomain(4) + destinationDomain(4) + nonce(8) + 
      //                      sender(32) + recipient(32) + destinationCaller(32) + payload
      
      const version = 0; // CCTP v1 uses version 0
      const sourceDomain = message.sourceDomain || 0;
      const destinationDomain = message.destinationDomain || 0;
      const nonce = BigInt(message.nonce || 0);
      
      // Convert addresses from object format to bytes
      const senderBytes = addressToBytes(message.sender?.address);
      const recipientBytes = addressToBytes(message.recipient?.address);
      const destinationCallerBytes = addressToBytes(message.destinationCaller?.address);
      
      // Serialize payload
      const payloadBytes = serializePayload(message.payload);
      
      // Combine all parts
      const buffer = new Uint8Array(
        1 + // version
        4 + // sourceDomain
        4 + // destinationDomain
        8 + // nonce
        32 + // sender
        32 + // recipient
        32 + // destinationCaller
        payloadBytes.length // payload
      );
      
      let offset = 0;
      buffer[offset++] = version;
      
      // Write sourceDomain (uint32, little-endian)
      const sourceDomainView = new DataView(buffer.buffer, offset, 4);
      sourceDomainView.setUint32(0, sourceDomain, true);
      offset += 4;
      
      // Write destinationDomain (uint32, little-endian)
      const destDomainView = new DataView(buffer.buffer, offset, 4);
      destDomainView.setUint32(0, destinationDomain, true);
      offset += 4;
      
      // Write nonce (uint64, little-endian)
      const nonceView = new DataView(buffer.buffer, offset, 8);
      nonceView.setBigUint64(0, nonce, true);
      offset += 8;
      
      // Write addresses (32 bytes each)
      buffer.set(senderBytes, offset);
      offset += 32;
      buffer.set(recipientBytes, offset);
      offset += 32;
      buffer.set(destinationCallerBytes, offset);
      offset += 32;
      
      // Write payload
      buffer.set(payloadBytes, offset);
      
      // Compute keccak256 hash
      const hash = keccak256(buffer);
      return `0x${hash}`;
    } catch (error: any) {
      console.error('[Bridge2] Error computing depositMessageHash from message:', error);
      return null;
    }
  };

  /**
   * Convert address object to bytes array
   */
  const addressToBytes = (addressObj: any): Uint8Array => {
    if (!addressObj || typeof addressObj !== 'object') {
      return new Uint8Array(32).fill(0);
    }
    
    const bytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      bytes[i] = addressObj[i] || 0;
    }
    return bytes;
  };

  /**
   * Serialize CCTP payload
   */
  const serializePayload = (payload: any): Uint8Array => {
    if (!payload) {
      return new Uint8Array(0);
    }
    
    // CCTP payload format depends on the version
    // For burnToken/mintRecipient payload:
    // - burnToken address (32 bytes)
    // - mintRecipient address (32 bytes)
    // - amount (uint256, 32 bytes)
    // - messageSender address (32 bytes)
    
    const buffer = new Uint8Array(32 + 32 + 32 + 32); // 128 bytes total
    let offset = 0;
    
    // burnToken address
    const burnTokenBytes = addressToBytes(payload.burnToken?.address);
    buffer.set(burnTokenBytes, offset);
    offset += 32;
    
    // mintRecipient address
    const mintRecipientBytes = addressToBytes(payload.mintRecipient?.address);
    buffer.set(mintRecipientBytes, offset);
    offset += 32;
    
    // amount (uint256, big-endian)
    const amount = BigInt(payload.amount || 0);
    const amountBytes = new Uint8Array(32);
    const amountView = new DataView(amountBytes.buffer);
    // Write as big-endian uint256
    for (let i = 0; i < 32; i++) {
      const shift = BigInt(8 * (31 - i));
      amountBytes[i] = Number((amount >> shift) & BigInt(0xff));
    }
    buffer.set(amountBytes, offset);
    offset += 32;
    
    // messageSender address
    const messageSenderBytes = addressToBytes(payload.messageSender?.address);
    buffer.set(messageSenderBytes, offset);
    
    return buffer;
  };

  /**
   * Try to extract depositMessageHash from localStorage (Wormhole SDK saves transfer data there)
   * The depositMessageHash might be in the receipt.attestation data
   */
  const getDepositMessageHashFromLocalStorage = async (txSignature: string): Promise<string | null> => {
    try {
      // Check if there's transfer data in localStorage
      const storageKeys = Object.keys(localStorage);
      
      for (const key of storageKeys) {
        if (key.includes('transfer') || key.includes('wormhole') || key.includes('cctp')) {
          try {
            const data = JSON.parse(localStorage.getItem(key) || '[]');
            const transfers = Array.isArray(data) ? data : [data];
            
            for (const transfer of transfers) {
              // Check if this transfer matches our transaction
              if (transfer.txHash === txSignature || 
                  transfer.txDetails?.sendTx === txSignature ||
                  transfer.txDetails?.txHash === txSignature) {
                
                // Try to find depositMessageHash in various places
                // It might be in receipt.attestation.id.hash (but that's attestation hash, not message hash)
                // Or we might need to compute it from the message data
                
                // Check if there's a messageHash field
                if (transfer.depositMessageHash) {
                  const hash = normalizeDepositMessageHash(transfer.depositMessageHash);
                  console.log('[Bridge2] Found depositMessageHash in localStorage:', {
                    original: transfer.depositMessageHash,
                    normalized: hash,
                  });
                  return hash || transfer.depositMessageHash;
                }
                
                // Check receipt.attestation for message data
                // Note: In Wormhole SDK, message is at receipt.attestation.attestation.message
                const cctpMessage = transfer.receipt?.attestation?.attestation?.message || 
                                   transfer.receipt?.attestation?.message;
                
                if (cctpMessage && cctpMessage.sourceDomain !== undefined && cctpMessage.destinationDomain !== undefined) {
                  console.log('[Bridge2] Found CCTP message in localStorage, attempting to compute depositMessageHash...');
                  
                  // Try to compute using local function first (if keccak256 available)
                  try {
                    const messageHash = await computeDepositMessageHashFromMessage(cctpMessage);
                    if (messageHash) {
                      const normalized = normalizeDepositMessageHash(messageHash);
                      console.log('[Bridge2] Computed depositMessageHash from message in localStorage:', {
                        original: messageHash,
                        normalized,
                      });
                      return normalized || messageHash;
                    }
                  } catch (e: any) {
                    console.warn('[Bridge2] Could not compute depositMessageHash locally:', e.message);
                  }
                  
                  // If local computation failed, try API endpoint
                  try {
                    console.log('[Bridge2] Attempting to compute depositMessageHash via API endpoint...');
                    const response = await fetch('/api/compute-deposit-message-hash', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        message: cctpMessage,
                      }),
                    });
                    
                    if (response.ok) {
                      const data = await response.json();
                      if (data.depositMessageHash) {
                        const normalized = normalizeDepositMessageHash(data.depositMessageHash);
                        console.log('[Bridge2] Computed depositMessageHash via API:', {
                          original: data.depositMessageHash,
                          normalized,
                        });
                        return normalized || data.depositMessageHash;
                      }
                    } else {
                      const errorData = await response.json();
                      console.warn('[Bridge2] API endpoint error:', errorData.error);
                    }
                  } catch (apiError: any) {
                    console.warn('[Bridge2] Could not compute depositMessageHash via API:', apiError.message);
                  }
                  
                  // If all methods failed, log that we found the message
                  console.log('[Bridge2] CCTP message found in localStorage, but could not compute depositMessageHash. Use /cctp-list-attestations page with Circle API key.');
                }
                
                // Also check if there's a messageHash in receipt.attestation.id.hash
                // Note: This is the attestation hash, not the message hash, but let's check anyway
                if (transfer.receipt?.attestation?.id?.hash) {
                  const attestationHash = transfer.receipt.attestation.id.hash;
                  console.log('[Bridge2] Found attestation hash in localStorage (not message hash):', attestationHash);
                  // This is not the depositMessageHash, but we log it for reference
                }
              }
            }
          } catch (e) {
            // Skip invalid JSON
            continue;
          }
        }
      }
    } catch (error: any) {
      console.warn('[Bridge2] Error checking localStorage for depositMessageHash:', error);
    }
    return null;
  };

  /**
   * Try to get depositMessageHash from Circle API using transaction signature
   * This is an alternative method if extraction from logs fails
   */
  const getDepositMessageHashFromCircle = async (txSignature: string): Promise<string | null> => {
    try {
      // Circle API endpoint for getting attestations by transaction
      // Note: This might require Circle API key, but we'll try without first
      const url = `https://xreserve-api.circle.com/v1/attestations?txHash=${txSignature}`;
      
      console.log('[Bridge2] Attempting to get depositMessageHash from Circle API...');
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        // Circle API might return attestations array
        if (data.attestations && Array.isArray(data.attestations) && data.attestations.length > 0) {
          const attestation = data.attestations[0];
          if (attestation.messageHash) {
            const normalized = normalizeDepositMessageHash(attestation.messageHash);
            console.log('[Bridge2] Found depositMessageHash from Circle API:', {
              original: attestation.messageHash,
              normalized,
            });
            return normalized || attestation.messageHash;
          }
        }
      } else {
        console.log('[Bridge2] Circle API request failed (this is expected if API key is required):', response.status);
      }
    } catch (error: any) {
      console.warn('[Bridge2] Error fetching depositMessageHash from Circle API:', error.message);
    }
    return null;
  };

  /**
   * Save depositMessageHash to localStorage for later use
   */
  const saveDepositMessageHash = (txSignature: string, messageHash: string) => {
    try {
      // Normalize hash format
      const normalizedHash = normalizeDepositMessageHash(messageHash);
      
      const entry = {
        timestamp: Date.now(),
        timestampISO: new Date().toISOString(),
        txSignature,
        depositMessageHash: normalizedHash || messageHash, // Use normalized if available, fallback to original
        depositMessageHashOriginal: messageHash, // Keep original for reference
        destinationAddress,
        transferAmount,
        solanaAddress,
      };

      // Save to localStorage
      const existingEntries = localStorage.getItem('cctp_transfers');
      const entries = existingEntries ? JSON.parse(existingEntries) : [];
      entries.push(entry);
      // Keep only last 50 entries
      const recentEntries = entries.slice(-50);
      localStorage.setItem('cctp_transfers', JSON.stringify(recentEntries));

      console.log('[Bridge2] Saved depositMessageHash to localStorage:', {
        txSignature,
        depositMessageHash: normalizedHash || messageHash,
        original: messageHash,
      });
    } catch (error) {
      console.error('[Bridge2] Failed to save depositMessageHash:', error);
    }
  };

  /**
   * Get CCTP message from localStorage (Wormhole SDK data)
   */
  const getCCTPMessageFromLocalStorage = (txSignature: string): { cctpMessage: any; transfer: any } | null => {
    try {
      // Check if there's transfer data in localStorage
      const storageKeys = Object.keys(localStorage);
      
      for (const key of storageKeys) {
        if (key.includes('transfer') || key.includes('wormhole') || key.includes('cctp')) {
          try {
            const data = JSON.parse(localStorage.getItem(key) || '[]');
            const transfers = Array.isArray(data) ? data : [data];
            
            for (const transfer of transfers) {
              // Check if this transfer matches our transaction
              if (transfer.txHash === txSignature || 
                  transfer.txDetails?.sendTx === txSignature ||
                  transfer.txDetails?.txHash === txSignature) {
                
                // Check receipt.attestation for message data
                // Note: In Wormhole SDK, message is at receipt.attestation.attestation.message
                const cctpMessage = transfer.receipt?.attestation?.attestation?.message || 
                                   transfer.receipt?.attestation?.message;
                
                if (cctpMessage && cctpMessage.sourceDomain !== undefined && cctpMessage.destinationDomain !== undefined) {
                  console.log('[Bridge2] Found CCTP message in localStorage for tx:', txSignature);
                  return { cctpMessage, transfer };
                }
              }
            }
          } catch (e) {
            // Skip invalid JSON
            continue;
          }
        }
      }
    } catch (error: any) {
      console.warn('[Bridge2] Error checking localStorage for CCTP message:', error);
    }
    return null;
  };

  /**
   * Extract CCTP message from Solana transaction
   */
  const extractCCTPMessageFromTransaction = async (txSignature: string): Promise<any | null> => {
    try {
      const { Connection } = await import('@solana/web3.js');
      const connection = solanaConnection || new Connection(
        process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 
        process.env.SOLANA_RPC_URL || 
        'https://mainnet.helius-rpc.com/?api-key=29798653-2d13-4d8a-96ad-df70b015e234',
        'confirmed'
      );

      const tx = await connection.getTransaction(txSignature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      });

      if (!tx) {
        return null;
      }

      // Try to extract CCTP message from transaction logs or inner instructions
      // CCTP message data might be in logs or instruction data
      const logs = tx.meta?.logMessages || [];
      
      // Look for CCTP-related logs that might contain message data
      // This is a fallback - the message is usually in Wormhole SDK localStorage
      console.log('[Bridge2] Attempting to extract CCTP message from transaction logs...');
      
      // For now, return null - we'll rely on localStorage and Circle API
      // The actual CCTP message structure is complex and requires parsing instruction data
      return null;
    } catch (error: any) {
      console.warn('[Bridge2] Failed to extract CCTP message from transaction:', error.message);
      return null;
    }
  };

  /**
   * Save CCTP message to localStorage for debugging and comparison
   */
  const saveCCTPMessage = async (txSignature: string, messageHash: string, xferData?: any, attestation?: any) => {
    try {
      // Try multiple sources for CCTP message
      let cctpMessage: any = null;
      let wormholeTransferData: any = null;

      // 1. Try to get from localStorage (Wormhole SDK data) - wait a bit for SDK to save
      console.log('[Bridge2] Attempting to get CCTP message from localStorage...');
      for (let attempt = 0; attempt < 5; attempt++) {
        const wormholeData = getCCTPMessageFromLocalStorage(txSignature);
        if (wormholeData?.cctpMessage) {
          cctpMessage = wormholeData.cctpMessage;
          wormholeTransferData = wormholeData.transfer;
          console.log('[Bridge2] Found CCTP message in localStorage on attempt', attempt + 1);
          break;
        }
        // Wait before next attempt (Wormhole SDK may save data asynchronously)
        if (attempt < 4) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // 2. If not found in localStorage, try to extract from transaction
      if (!cctpMessage) {
        console.log('[Bridge2] CCTP message not found in localStorage, trying to extract from transaction...');
        cctpMessage = await extractCCTPMessageFromTransaction(txSignature);
      }

      // 3. If xferData was provided, try to extract message from it
      if (!cctpMessage && xferData) {
        console.log('[Bridge2] Attempting to extract CCTP message from xfer object...');
        try {
          // Check if xfer has message property
          if (xferData.message) {
            cctpMessage = xferData.message;
          } else if (xferData._message) {
            cctpMessage = xferData._message;
          } else if (xferData.receipt?.attestation?.attestation?.message) {
            cctpMessage = xferData.receipt.attestation.attestation.message;
          } else if (xferData.receipt?.attestation?.message) {
            cctpMessage = xferData.receipt.attestation.message;
          } else if (xferData.transaction?.transaction?.instructions) {
            // Try to extract CCTP message from transaction instruction data
            console.log('[Bridge2] Attempting to extract CCTP message from transaction instruction data...');
            try {
              const instructions = xferData.transaction.transaction.instructions;
              if (Array.isArray(instructions) && instructions.length > 0) {
                // Find CCTP instruction (usually the first one)
                const cctpInstruction = instructions.find((ix: any) => 
                  ix.programId === 'CCTPiPYPc6AsJuwueEnWgSgucamXDZwBd53dQ11YiKX3' ||
                  (typeof ix.programId === 'object' && ix.programId?.address === 'CCTPiPYPc6AsJuwueEnWgSgucamXDZwBd53dQ11YiKX3')
                ) || instructions[0];
                
                if (cctpInstruction && cctpInstruction.data) {
                  // Instruction data contains CCTP depositForBurn parameters
                  // Format: discriminator(8) + amount(8) + destinationDomain(4) + mintRecipient(32) + burnToken(32)
                  const data = Array.isArray(cctpInstruction.data) 
                    ? new Uint8Array(cctpInstruction.data)
                    : Buffer.from(cctpInstruction.data, 'base64');
                  
                  console.log('[Bridge2] Found CCTP instruction data:', {
                    dataLength: data.length,
                    dataHex: Array.from(data).map(b => b.toString(16).padStart(2, '0')).join(''),
                  });
                  
                  // Try to parse instruction data to extract CCTP message components
                  // Note: This is a simplified extraction - actual CCTP message is built from transaction context
                  // The instruction data alone doesn't contain the full CCTP message, but we can log it for debugging
                  console.log('[Bridge2] CCTP instruction data extracted (note: full message requires transaction context)');
                }
              }
            } catch (ixError: any) {
              console.warn('[Bridge2] Failed to extract from instruction data:', ixError.message);
            }
          }
        } catch (e: any) {
          console.warn('[Bridge2] Failed to extract message from xfer:', e.message);
        }
      }

      // Normalize depositMessageHash format
      const normalizedHash = normalizeDepositMessageHash(messageHash);
      
      // Deep clone xferData with better handling of complex objects
      let serializedXferData: any = null;
      if (xferData) {
        try {
          // Try to serialize xfer object, preserving as much data as possible
          serializedXferData = JSON.parse(JSON.stringify(xferData, (key, value) => {
            // Remove circular references and functions
            if (typeof value === 'function') return undefined;
            if (value instanceof Error) return { message: value.message, stack: value.stack };
            
            // Handle Uint8Array, Buffer, etc.
            if (value instanceof Uint8Array || (value && value.constructor?.name === 'Uint8Array')) {
              return Array.from(value);
            }
            if (value && typeof value === 'object' && value.constructor?.name === 'Buffer') {
              return Array.from(value);
            }
            
            // Handle PublicKey-like objects
            if (value && typeof value === 'object' && value.toBase58) {
              try {
                return { _type: 'PublicKey', address: value.toBase58() };
              } catch (e) {
                return { _type: 'PublicKey', error: 'Could not serialize' };
              }
            }
            
            // Handle BigInt
            if (typeof value === 'bigint') {
              return value.toString();
            }
            
            return value;
          }));
        } catch (serializeError: any) {
          console.warn('[Bridge2] Failed to serialize xferData:', serializeError.message);
          // Try to save at least a summary
          serializedXferData = {
            _error: 'Failed to serialize',
            _errorMessage: serializeError.message,
            _keys: xferData ? Object.keys(xferData) : [],
            _constructor: xferData?.constructor?.name,
          };
        }
      }

      const entry = {
        timestamp: Date.now(),
        timestampISO: new Date().toISOString(),
        txSignature,
        depositMessageHash: normalizedHash || messageHash, // Use normalized format
        depositMessageHashOriginal: messageHash, // Keep original for reference
        destinationAddress,
        transferAmount,
        solanaAddress,
        cctpMessage: cctpMessage || null,
        wormholeTransferData: wormholeTransferData || null,
        xferData: serializedXferData,
        attestation: attestation || null, // Save attestation if available
        xferDataKeys: xferData ? Object.keys(xferData) : [], // List of keys for reference
        xferDataMethods: xferData ? Object.getOwnPropertyNames(Object.getPrototypeOf(xferData)).filter(name => typeof xferData[name] === 'function') : [], // List of methods
      };

      // Save to localStorage with our own key
      const existingEntries = localStorage.getItem('cctp_messages');
      const entries = existingEntries ? JSON.parse(existingEntries) : [];
      entries.push(entry);
      // Keep only last 50 entries
      const recentEntries = entries.slice(-50);
      localStorage.setItem('cctp_messages', JSON.stringify(recentEntries));

      console.log('[Bridge2] Saved CCTP message to localStorage:', {
        txSignature,
        depositMessageHash: messageHash,
        normalizedHash: normalizedHash || messageHash,
        hasCCTPMessage: !!entry.cctpMessage,
        hasWormholeData: !!entry.wormholeTransferData,
        hasXferData: !!entry.xferData,
        hasAttestation: !!entry.attestation,
        xferDataKeys: entry.xferDataKeys,
        xferDataMethods: entry.xferDataMethods,
      });
      
      // Log detailed information about what was saved
      if (entry.xferData) {
        console.log('[Bridge2] xferData structure:', {
          hasTransaction: !!entry.xferData.transaction,
          hasTransactionTransaction: !!entry.xferData.transaction?.transaction,
          hasInstructions: !!entry.xferData.transaction?.transaction?.instructions,
          instructionsCount: entry.xferData.transaction?.transaction?.instructions?.length || 0,
          hasSigners: !!entry.xferData.transaction?.signers,
          signersCount: entry.xferData.transaction?.signers?.length || 0,
          network: entry.xferData.network,
          chain: entry.xferData.chain,
          description: entry.xferData.description,
        });
        
        // Log instruction details if available
        if (entry.xferData.transaction?.transaction?.instructions?.length > 0) {
          const firstIx = entry.xferData.transaction.transaction.instructions[0];
          console.log('[Bridge2] First instruction details:', {
            programId: firstIx.programId,
            hasData: !!firstIx.data,
            dataLength: firstIx.data?.length || 0,
            keysCount: firstIx.keys?.length || 0,
          });
        }
      }

      // Also offer download
      downloadCCTPMessageJSON(entry);
    } catch (error: any) {
      console.error('[Bridge2] Failed to save CCTP message:', error);
    }
  };

  /**
   * Download CCTP message as JSON file (similar to signer data download)
   */
  const downloadCCTPMessageJSON = (entry: any) => {
    try {
      const jsonStr = JSON.stringify(entry, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cctp-message-${entry.txSignature.slice(0, 8)}-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      console.log('[Bridge2] CCTP message JSON downloaded');
    } catch (error) {
      console.error('[Bridge2] Failed to download CCTP message JSON:', error);
    }
  };

  /**
   * Download all saved CCTP messages as JSON
   */
  const downloadAllCCTPMessages = () => {
    try {
      const entries = localStorage.getItem('cctp_messages');
      if (!entries) {
        toast({
          variant: "default",
          title: "No CCTP messages found",
          description: "No CCTP messages saved in localStorage yet.",
        });
        return;
      }

      const data = JSON.parse(entries);
      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cctp-messages-all-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "CCTP Messages Downloaded",
        description: `Downloaded ${data.length} CCTP message(s) as JSON file.`,
      });
    } catch (error: any) {
      console.error('[Bridge2] Failed to download all CCTP messages:', error);
      toast({
        variant: "destructive",
        title: "Download Failed",
        description: error.message || "Could not download CCTP messages.",
      });
    }
  };

  // CCTP Program IDs
  const MESSAGE_TRANSMITTER_PROGRAM_ID = 'CCTPmbSD7gX1bxKPAmg77w8oFzNFpaQiQUWD43TKaecd'; // Message Transmitter
  const TOKEN_MESSENGER_PROGRAM_ID = 'CCTPiPYPc6AsJuwueEnWgSgucamXDZwBd53dQ11YiKX3'; // Token Messenger
  
  // Function to check CCTP message first 4 bytes (source_domain)
  const checkCCTPMessageSourceDomain = (dataBase64: string, location: string): boolean => {
    try {
      const decodedData = atob(dataBase64);
      console.log(`[Bridge2] [${location}] Decoded CCTP data length:`, decodedData.length, 'bytes');
      
      // First 4 bytes in HEX (little-endian for source_domain)
      const first4Bytes = decodedData.slice(0, 4);
      const first4BytesHex = Array.from(first4Bytes)
        .map((b, i) => {
          const byte = b.charCodeAt(0);
          return byte.toString(16).padStart(2, '0');
        })
        .join('');
      
      console.log(`[Bridge2] [${location}] FIRST 4 BYTES of CCTP message:`, `0x${first4BytesHex}`);
      console.log(`[Bridge2] [${location}] First 4 bytes as array:`, Array.from(first4Bytes).map(b => b.charCodeAt(0)));
      
      // Expected: 0x00000001 (Solana domain) in little-endian = 01 00 00 00
      const expected = '01000000';
      const isValid = first4BytesHex.toLowerCase() === expected;
      
      if (isValid) {
        console.log(`[Bridge2] [${location}] ✅ SUCCESS: source_domain is CORRECT! (0x${first4BytesHex})`);
      } else {
        console.error(`[Bridge2] [${location}] ❌ ERROR: source_domain is WRONG!`);
        console.error(`[Bridge2] [${location}] Expected: 0x${expected} (Solana domain = 0x00000001 in little-endian)`);
        console.error(`[Bridge2] [${location}] Got: 0x${first4BytesHex}`);
        console.error(`[Bridge2] [${location}] This means the SDK is still generating wrong CCTP message!`);
      }
      
      return isValid;
    } catch (error: any) {
      console.error(`[Bridge2] [${location}] Error checking CCTP message:`, error);
      return false;
    }
  };
  
  // Function to find and check Message Transmitter instruction
  const findAndCheckMessageTransmitter = (instructions: any[], accountKeys: any[], location: string): boolean => {
    try {
      console.log(`[Bridge2] [${location}] Searching for Message Transmitter instruction...`);
      console.log(`[Bridge2] [${location}] Instructions count:`, instructions.length);
      console.log(`[Bridge2] [${location}] Account keys count:`, accountKeys.length);
      
      let foundMessageTransmitter = false;
      
      for (let i = 0; i < instructions.length; i++) {
        const instruction = instructions[i];
        
        // Get programId from instruction
        let programId: string | null = null;
        if (instruction.programId) {
          programId = typeof instruction.programId === 'string' 
            ? instruction.programId 
            : instruction.programId.toString();
        } else if (instruction.programIdIndex !== undefined && accountKeys && accountKeys.length > instruction.programIdIndex) {
          const key = accountKeys[instruction.programIdIndex];
          if (key) {
            programId = typeof key === 'string' ? key : key.toString();
          }
        }
        
        if (programId) {
          // Log all program IDs for debugging
          const isTokenMessenger = programId === TOKEN_MESSENGER_PROGRAM_ID || programId.includes('CCTPiPYPc6AsJ');
          const isMessageTransmitter = programId === MESSAGE_TRANSMITTER_PROGRAM_ID || 
                                       programId.includes('CCTPmbSD7gX1');
          
          if (isTokenMessenger) {
            console.log(`[Bridge2] [${location}] Found Token Messenger instruction at index ${i} (programId: ${programId})`);
            console.log(`[Bridge2] [${location}] ⚠️ This is NOT the CCTP message - this is depositForBurn instruction!`);
          }
          
          if (isMessageTransmitter && instruction.data) {
            foundMessageTransmitter = true;
            console.log(`[Bridge2] [${location}] ✅ Found Message Transmitter instruction at index ${i}`);
            console.log(`[Bridge2] [${location}] Program ID:`, programId);
            
            // Convert data to base64 if needed
            let dataBase64 = '';
            if (typeof instruction.data === 'string') {
              dataBase64 = instruction.data;
            } else if (instruction.data instanceof Uint8Array) {
              dataBase64 = btoa(String.fromCharCode(...instruction.data));
            } else if (Array.isArray(instruction.data)) {
              dataBase64 = btoa(String.fromCharCode(...instruction.data));
            } else if (Buffer.isBuffer && Buffer.isBuffer(instruction.data)) {
              dataBase64 = instruction.data.toString('base64');
            }
            
            if (dataBase64 && dataBase64.length > 0) {
              console.log(`[Bridge2] [${location}] Message Transmitter data length:`, dataBase64.length);
              const isValid = checkCCTPMessageSourceDomain(dataBase64, `${location} - Message Transmitter Ix ${i}`);
              return isValid;
            } else {
              console.warn(`[Bridge2] [${location}] Message Transmitter instruction has no data`);
            }
          }
        } else {
          console.log(`[Bridge2] [${location}] Instruction ${i} has no programId (programIdIndex: ${instruction.programIdIndex})`);
        }
      }
      
      if (!foundMessageTransmitter) {
        console.log(`[Bridge2] [${location}] Message Transmitter instruction not found in main instructions`);
        console.log(`[Bridge2] [${location}] It may be in innerInstructions (cross-program invocations)`);
      }
      
      return false;
    } catch (error: any) {
      console.error(`[Bridge2] [${location}] Error finding Message Transmitter:`, error);
      return false;
    }
  };
  
  // Function to find and check Message Transmitter in innerInstructions
  const findAndCheckMessageTransmitterInInner = (innerInstructions: any[], accountKeys: any[], location: string): boolean => {
    try {
      console.log(`[Bridge2] [${location}] Searching for Message Transmitter in innerInstructions...`);
      
      if (!Array.isArray(innerInstructions)) {
        console.log(`[Bridge2] [${location}] innerInstructions is not an array`);
        return false;
      }
      
      console.log(`[Bridge2] [${location}] Inner instruction groups count:`, innerInstructions.length);
      console.log(`[Bridge2] [${location}] Account keys count:`, accountKeys.length);
      
      let foundMessageTransmitter = false;
      
      for (let groupIdx = 0; groupIdx < innerInstructions.length; groupIdx++) {
        const group = innerInstructions[groupIdx];
        const groupInstructions = group.instructions || group || [];
        
        if (!Array.isArray(groupInstructions)) {
          console.log(`[Bridge2] [${location}] Group ${groupIdx} instructions is not an array`);
          continue;
        }
        
        console.log(`[Bridge2] [${location}] Group ${groupIdx} has ${groupInstructions.length} instructions`);
        
        for (let ixIdx = 0; ixIdx < groupInstructions.length; ixIdx++) {
          const innerIx = groupInstructions[ixIdx];
          if (!innerIx) continue;
          
          // Get programId from inner instruction
          let programId: string | null = null;
          if (innerIx.programId) {
            programId = typeof innerIx.programId === 'string' 
              ? innerIx.programId 
              : innerIx.programId.toString();
          } else if (innerIx.programIdIndex !== undefined && accountKeys && accountKeys.length > innerIx.programIdIndex) {
            const key = accountKeys[innerIx.programIdIndex];
            if (key) {
              programId = typeof key === 'string' ? key : key.toString();
            }
          }
          
          if (programId) {
            const isTokenMessenger = programId === TOKEN_MESSENGER_PROGRAM_ID || programId.includes('CCTPiPYPc6AsJ');
            const isMessageTransmitter = programId === MESSAGE_TRANSMITTER_PROGRAM_ID || 
                                         programId.includes('CCTPmbSD7gX1');
            
            if (isTokenMessenger) {
              console.log(`[Bridge2] [${location}] Found Token Messenger in innerInstructions group ${groupIdx}, ix ${ixIdx} (programId: ${programId})`);
            }
            
            if (isMessageTransmitter && innerIx.data) {
              foundMessageTransmitter = true;
              console.log(`[Bridge2] [${location}] ✅ Found Message Transmitter in innerInstructions group ${groupIdx}, ix ${ixIdx}`);
              console.log(`[Bridge2] [${location}] Program ID:`, programId);
              
              // Convert data to base64 if needed
              let dataBase64 = '';
              if (typeof innerIx.data === 'string') {
                dataBase64 = innerIx.data;
              } else if (innerIx.data instanceof Uint8Array) {
                dataBase64 = btoa(String.fromCharCode(...innerIx.data));
              } else if (Array.isArray(innerIx.data)) {
                dataBase64 = btoa(String.fromCharCode(...innerIx.data));
              } else if (Buffer.isBuffer && Buffer.isBuffer(innerIx.data)) {
                dataBase64 = innerIx.data.toString('base64');
              }
              
              if (dataBase64 && dataBase64.length > 0) {
                console.log(`[Bridge2] [${location}] Message Transmitter data length:`, dataBase64.length);
                const isValid = checkCCTPMessageSourceDomain(dataBase64, `${location} - InnerIx Group ${groupIdx} Ix ${ixIdx}`);
                return isValid;
              } else {
                console.warn(`[Bridge2] [${location}] Message Transmitter inner instruction has no data`);
              }
            }
          } else {
            console.log(`[Bridge2] [${location}] Inner instruction group ${groupIdx}, ix ${ixIdx} has no programId (programIdIndex: ${innerIx.programIdIndex})`);
          }
        }
      }
      
      if (!foundMessageTransmitter) {
        console.log(`[Bridge2] [${location}] Message Transmitter instruction not found in innerInstructions`);
      }
      
      return false;
    } catch (error: any) {
      console.error(`[Bridge2] [${location}] Error finding Message Transmitter in innerInstructions:`, error);
      return false;
    }
  };

  const handleTransfer = async () => {
    if (!wh || !solanaAddress || !destinationAddress) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please connect Solana wallet and enter destination address",
      });
      return;
    }

    setIsTransferring(true);
    setTransferStatus('Initializing transfer...');

    // Store signers that were funded in this specific transfer attempt
    // This is crucial for the automatic refund on error
    let currentFundedSigners: Array<{ pubkey: string; keypair: any }> = [];

    try {
      // Parse amount (USDC has 6 decimals)
      // Convert human-readable amount (e.g., "0.1") to base units
      // Multiply by 10^decimals to get the amount in smallest units
      const amountInBaseUnits = BigInt(Math.floor(parseFloat(transferAmount) * Math.pow(10, 6)));
      const amtUnits = amountInBaseUnits;

      // Set up chains
      const sendChain = wh.getChain('Solana');
      const rcvChain = wh.getChain('Aptos');

      // Get RPC URLs
      const solanaRpc = await sendChain.getRpc();
      const aptosRpc = await rcvChain.getRpc();

      // Get signers
      // For Solana, use wallet adapter
      if (!solanaWallet?.adapter || !signTransaction) {
        throw new Error('Solana wallet not connected or signer not available');
      }
      
      // Create Solana signer from wallet adapter
      // Use connection from provider or create new one
      const { Connection } = await import('@solana/web3.js');
      const connection = solanaConnection || new Connection(solanaRpc, 'confirmed');
      
      const solanaSigner = {
        address: () => solanaAddress!,
        chain: () => 'Solana' as const,
        signAndSendTx: async (tx: any) => {
          // Sign transaction with wallet adapter
          if (!signTransaction) {
            throw new Error('Sign transaction function not available');
          }
          const signed = await signTransaction(tx);
          
          // Send transaction
          const signature = await connection.sendRawTransaction(signed.serialize());
          
          // Try to confirm transaction with longer timeout
          // If confirmation times out, the transaction may still succeed
          try {
            await connection.confirmTransaction(signature, 'confirmed');
            console.log('[Bridge2] Transaction confirmed:', signature);
          } catch (confirmError: any) {
            // If confirmation times out, check if transaction was successful
            if (confirmError.message?.includes('TransactionExpiredTimeoutError') || 
                confirmError.message?.includes('not confirmed')) {
              console.warn('[Bridge2] Transaction confirmation timeout, but transaction may have succeeded:', signature);
              // Transaction may still be processing, return signature anyway
              // User can check transaction status manually
            } else {
              throw confirmError;
            }
          }
          
          return signature;
        },
      };

      // Create addresses using Wormhole.chainAddress static method
      // For Aptos, we don't need a signer for destination (relayer will handle it)
      const destAddress = Wormhole.chainAddress('Aptos', destinationAddress.trim()) as any;
      
      // Create source address
      const sourceAddress = Wormhole.chainAddress('Solana', solanaAddress) as any;

      // Set native gas amount for Aptos (0.01 APT in base units)
      // APT has 8 decimals
      const nativeGas = BigInt(Math.floor(0.01 * Math.pow(10, 8)));

      // Set automatic mode
      // automatic = true: relayer automatically handles attestation and finalization on destination chain
      // automatic = false: user must manually call fetchAttestation() and complete the transfer
      // NOTE: If you don't have a relayer, set automatic = false and handle finalization manually
      // For now, we set it to false since we're handling attestation manually
      const automatic = false;

      setTransferStatus('Creating transfer...');
      
      // Use AutomaticCircleBridge protocol directly
      // Get protocol instance and use its transfer method
      let xfer: any;
      let txSignature: string = '';
      try {
        console.log('[Bridge2] Getting AutomaticCircleBridge protocol...');
        const acb = await sendChain.getProtocol('AutomaticCircleBridge');
        console.log('[Bridge2] AutomaticCircleBridge protocol obtained:', {
          hasProtocol: !!acb,
          protocolType: typeof acb,
          protocolKeys: acb ? Object.keys(acb) : [],
        });
        
        // Log ACB configuration to check domains
        if (acb && typeof acb === 'object') {
          const acbConfig = (acb as any).config || (acb as any).chainConfig || {};
          console.log('[Bridge2] ACB configuration:', {
            sourceDomain: acbConfig.sourceDomain,
            destDomain: acbConfig.destDomain,
            chainId: acbConfig.chainId,
            configKeys: Object.keys(acbConfig),
          });
        }
        
        // Also check domains via Wormhole SDK directly
        try {
          const solanaChain = wh.getChain('Solana');
          if (solanaChain) {
            const acbDirect = await solanaChain.getAutomaticCircleBridge();
            if (acbDirect) {
              const directConfig = (acbDirect as any).config || (acbDirect as any).chainConfig || {};
              console.log('[Bridge2] Direct ACB configuration from wh.getChain():', {
                sourceDomain: directConfig.sourceDomain,
                destDomain: directConfig.destDomain,
                sourceDomainHex: directConfig.sourceDomain !== undefined ? `0x${directConfig.sourceDomain.toString(16).padStart(8, '0')}` : undefined,
                destDomainHex: directConfig.destDomain !== undefined ? `0x${directConfig.destDomain.toString(16).padStart(8, '0')}` : undefined,
                expectedSourceDomain: '0x00000001 (Solana Mainnet)',
                expectedDestDomain: '0x00000002 (Aptos Mainnet)',
                configKeys: Object.keys(directConfig),
              });
            }
          }
        } catch (domainCheckError: any) {
          console.warn('[Bridge2] Could not check domains via wh.getChain():', domainCheckError);
        }
        
        // CRITICAL: Explicitly set domains if they are undefined
        // CCTP domain numbers:
        // Solana Mainnet = 0x00000001 (1)
        // Aptos Mainnet = 0x00000002 (2)
        const SOLANA_DOMAIN = 0x00000001;
        const APTOS_DOMAIN = 0x00000002;
        
        // Try to set domains in ACB config if they are undefined
        if (acb && typeof acb === 'object') {
          // Log all available properties and methods
          console.log('[Bridge2] ACB object structure:', {
            allKeys: Object.keys(acb),
            hasConfig: !!(acb as any).config,
            hasChainConfig: !!(acb as any).chainConfig,
            hasSetConfig: typeof (acb as any).setConfig === 'function',
            hasInitialize: typeof (acb as any).initialize === 'function',
            network: (acb as any).network,
            chain: (acb as any).chain,
          });
          
          // Check if config exists and domains are undefined
          if (!(acb as any).config) {
            (acb as any).config = {};
          }
          if (!(acb as any).config.sourceDomain) {
            (acb as any).config.sourceDomain = SOLANA_DOMAIN;
            console.log('[Bridge2] Set sourceDomain in ACB config:', SOLANA_DOMAIN);
          }
          if (!(acb as any).config.destDomain) {
            (acb as any).config.destDomain = APTOS_DOMAIN;
            console.log('[Bridge2] Set destDomain in ACB config:', APTOS_DOMAIN);
          }
          
          // Also try setting in chainConfig if it exists
          if ((acb as any).chainConfig) {
            if (!(acb as any).chainConfig.sourceDomain) {
              (acb as any).chainConfig.sourceDomain = SOLANA_DOMAIN;
              console.log('[Bridge2] Set sourceDomain in ACB chainConfig:', SOLANA_DOMAIN);
            }
            if (!(acb as any).chainConfig.destDomain) {
              (acb as any).chainConfig.destDomain = APTOS_DOMAIN;
              console.log('[Bridge2] Set destDomain in ACB chainConfig:', APTOS_DOMAIN);
            }
          }
          
          // Try to set domains in network/chain properties if they exist
          if ((acb as any).network && typeof (acb as any).network === 'object') {
            if (!(acb as any).network.sourceDomain) {
              (acb as any).network.sourceDomain = SOLANA_DOMAIN;
              console.log('[Bridge2] Set sourceDomain in ACB network:', SOLANA_DOMAIN);
            }
          }
          
          // Log final configuration
          const finalConfig = (acb as any).config || (acb as any).chainConfig || {};
          console.log('[Bridge2] Final ACB configuration after setting domains:', {
            sourceDomain: finalConfig.sourceDomain,
            destDomain: finalConfig.destDomain,
            sourceDomainHex: finalConfig.sourceDomain !== undefined ? `0x${finalConfig.sourceDomain.toString(16).padStart(8, '0')}` : undefined,
            destDomainHex: finalConfig.destDomain !== undefined ? `0x${finalConfig.destDomain.toString(16).padStart(8, '0')}` : undefined,
            configKeys: Object.keys(finalConfig),
          });
        }
        
        // Use transfer method which returns a generator
        // For automatic transfers with native gas
        // Signature: transfer(sender, recipient, amount, nativeGas?, automatic?, payload?)
        // NOTE: If domains are still not set, we may need to pass them explicitly in the transfer call
        console.log('[Bridge2] Calling acb.transfer() with parameters:', {
          sender: sourceAddress.address,
          recipient: { chain: destAddress.chain, address: destAddress.address },
          amount: amtUnits.toString(),
          nativeGas: nativeGas.toString(),
          automatic: automatic,
        });
        const transferGen = acb.transfer(
          sourceAddress.address,
          { chain: destAddress.chain, address: destAddress.address },
          amtUnits,
          nativeGas,  // nativeGas for destination chain
          automatic,   // automatic mode (true = relayer handles, false = manual)
          undefined   // payload (optional)
        );
        
        // DEBUG: Check localStorage for cached CCTP data
        console.log('[Bridge2] [DEBUG] Checking localStorage for cached CCTP data...');
        try {
          const cachedData = localStorage.getItem('cctp_transfers');
          if (cachedData) {
            const parsed = JSON.parse(cachedData);
            console.log('[Bridge2] [DEBUG] Found cached CCTP transfers:', parsed.length);
            if (parsed.length > 0) {
              const lastTransfer = parsed[parsed.length - 1];
              if (lastTransfer.cctpMessage && lastTransfer.cctpMessage.data) {
                console.log('[Bridge2] [DEBUG] Checking last cached CCTP message...');
                const isValid = checkCCTPMessageSourceDomain(lastTransfer.cctpMessage.data, 'Cached localStorage data');
                if (!isValid) {
                  console.warn('[Bridge2] [DEBUG] ⚠️ Last cached CCTP message has wrong source_domain! Consider clearing localStorage.');
                }
              }
            }
          }
        } catch (e) {
          console.warn('[Bridge2] [DEBUG] Could not check localStorage:', e);
        }
        
        // Iterate through generator to get transfer steps and transactions
        console.log('[Bridge2] Iterating through transfer generator...');
        let stepCount = 0;
        let lastStep: any = null;
        
        for await (const step of transferGen) {
          stepCount++;
          lastStep = step;
          console.log(`[Bridge2] Transfer step ${stepCount}:`, {
            stepType: typeof step,
            stepKeys: step ? Object.keys(step) : [],
            hasTx: !!step?.tx,
            hasTxid: !!step?.txid,
            hasTransaction: !!step?.transaction,
          });
          
          // Check if this step has a transaction to sign and send
          // The step might have a send() method or we need to use solanaSigner
          console.log('[Bridge2] Step details:', {
            stepKeys: step ? Object.keys(step) : [],
            hasSend: typeof step?.send === 'function',
            hasSubmit: typeof step?.submit === 'function',
            hasTx: !!step?.tx,
            hasTransaction: !!step?.transaction,
            hasXfer: !!step?.xfer,
            hasTransfer: !!step?.transfer,
            stepType: step?.type,
            stepValue: step ? JSON.stringify(step, (key, value) => {
              // Don't serialize functions or circular references
              if (typeof value === 'function') return '[Function]';
              if (value instanceof Uint8Array) return `[Uint8Array(${value.length})]`;
              if (value && typeof value === 'object' && value.constructor?.name === 'Buffer') return `[Buffer(${value.length})]`;
              if (value && typeof value === 'object' && value.toBase58) return `[PublicKey(${value.toBase58()})]`;
              return value;
            }, 2).substring(0, 500) : 'null',
          });
          
          // DEBUG: Check CCTP message data in transaction instructions
          // Точка проверки 1: Внутри handleTransfer, при обработке шага генератора
          // Ищем инструкцию Message Transmitter, а не Token Messenger!
          if (step?.transaction) {
            let txToCheck = step.transaction;
            if (txToCheck.transaction) {
              txToCheck = txToCheck.transaction;
            }
            
            // Get account keys for programId resolution
            const accountKeys = txToCheck.message?.accountKeys || 
                               txToCheck.accountKeys || 
                               txToCheck.staticAccountKeys || 
                               [];
            const staticAccountKeys = txToCheck.message?.staticAccountKeys || [];
            const allAccountKeys = [...staticAccountKeys, ...accountKeys];
            
            // Check main instructions for Message Transmitter
            if (txToCheck && txToCheck.instructions) {
              console.log('[Bridge2] [CHECKPOINT 1] Checking transaction instructions for Message Transmitter...');
              const instructions = Array.isArray(txToCheck.instructions) ? txToCheck.instructions : [];
              
              const isValid = findAndCheckMessageTransmitter(instructions, allAccountKeys, 'CHECKPOINT 1');
            }
            
            // Also check innerInstructions if available (as fallback)
            if (txToCheck.innerInstructions || (step as any).innerInstructions) {
              const innerInstructions = txToCheck.innerInstructions || (step as any).innerInstructions;
              const accountKeysForInner = txToCheck.message?.accountKeys || 
                                        txToCheck.accountKeys || 
                                        txToCheck.staticAccountKeys || 
                                        [];
              const staticAccountKeysForInner = txToCheck.message?.staticAccountKeys || [];
              const allAccountKeysForInner = [...staticAccountKeysForInner, ...accountKeysForInner];
              
              console.log('[Bridge2] [CHECKPOINT 1] Also checking innerInstructions for Message Transmitter...');
              const isValidInner = findAndCheckMessageTransmitterInInner(innerInstructions, allAccountKeysForInner, 'CHECKPOINT 1 - InnerInstructions');
            }
          }
          
          // Try to use step.send() if available (this is the recommended way)
          if (typeof step?.send === 'function') {
            console.log('[Bridge2] Using step.send() method');
            try {
              const result = await step.send(solanaSigner);
              console.log('[Bridge2] step.send() result:', result);
              
              // Extract transaction signature from result
              if (result && typeof result === 'object') {
                txSignature = result.txid || result.txHash || result.signature || result.tx || '';
                if (Array.isArray(result) && result.length > 0) {
                  txSignature = result[0]?.txid || result[0]?.txHash || result[0]?.signature || result[0] || '';
                }
              } else if (typeof result === 'string') {
                txSignature = result;
              }
              
              if (txSignature) {
                setLastTransferTxSignature(txSignature);
                console.log('[Bridge2] Transaction sent via step.send():', txSignature);
              }
              
              // Store xfer object from step if available
              if (step.xfer || step.transfer) {
                xfer = step.xfer || step.transfer;
              }
            } catch (sendError: any) {
              console.error('[Bridge2] step.send() failed:', sendError);
              throw new Error(`Failed to send transaction via step.send(): ${sendError.message}`);
            }
          } else if (step?.tx || step?.transaction) {
            // Fallback: try to handle transaction manually
            // Import Transaction types first
            const { Connection, Transaction, VersionedTransaction } = await import('@solana/web3.js');
            
            // The transaction might be nested: step.transaction.transaction
            let tx = step.tx || step.transaction;
            
            // If tx is an object with a 'transaction' property, extract it
            if (tx && typeof tx === 'object' && !(tx instanceof Transaction) && !(tx instanceof VersionedTransaction) && tx.transaction) {
              console.log('[Bridge2] Transaction is nested in object, extracting from tx.transaction...');
              tx = tx.transaction;
            }
            
            console.log('[Bridge2] Found transaction in step, attempting manual handling:', {
              txType: typeof tx,
              txConstructor: tx?.constructor?.name,
              hasSerialize: typeof tx?.serialize === 'function',
              hasSign: typeof tx?.sign === 'function',
              hasPartialSign: typeof tx?.partialSign === 'function',
              txKeys: tx ? Object.keys(tx) : [],
            });
            
            // DEBUG: Точка проверки 2 - Проверка CCTP данных в транзакции перед отправкой
            // Ищем инструкцию Message Transmitter, а не Token Messenger!
            if (tx && typeof tx === 'object' && !(tx instanceof Transaction) && !(tx instanceof VersionedTransaction)) {
              // Get account keys for programId resolution
              const accountKeys = tx.message?.accountKeys || 
                                 tx.accountKeys || 
                                 tx.staticAccountKeys || 
                                 [];
              const staticAccountKeys = tx.message?.staticAccountKeys || [];
              const allAccountKeys = [...staticAccountKeys, ...accountKeys];
              
              // Check instructions in transaction object
              if (tx.instructions && Array.isArray(tx.instructions)) {
                console.log('[Bridge2] [CHECKPOINT 2] Checking transaction.instructions for Message Transmitter...');
                const isValid = findAndCheckMessageTransmitter(tx.instructions, allAccountKeys, 'CHECKPOINT 2');
              }
              
              // Also check innerInstructions if available
              if (tx.innerInstructions && Array.isArray(tx.innerInstructions)) {
                console.log('[Bridge2] [CHECKPOINT 2] Also checking innerInstructions for Message Transmitter...');
                const isValidInner = findAndCheckMessageTransmitterInInner(tx.innerInstructions, allAccountKeys, 'CHECKPOINT 2 - InnerInstructions');
              }
            }
            
            // The transaction from generator might be a plain object, not a Transaction instance
            // We need to check if it can be converted or if we need to handle it differently
            // First, try to check if it's already a Transaction or VersionedTransaction
            const connection = solanaConnection || new Connection(
              process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 
              process.env.SOLANA_RPC_URL || 
              'https://mainnet.helius-rpc.com/?api-key=29798653-2d13-4d8a-96ad-df70b015e234',
              'confirmed'
            );
            
            // Check if tx is already a Transaction or VersionedTransaction
            if (tx instanceof VersionedTransaction || tx instanceof Transaction) {
              // DEBUG: Точка проверки 3 - Проверка CCTP данных в сериализованной транзакции
              // Ищем инструкцию Message Transmitter, а не Token Messenger!
              try {
                console.log('[Bridge2] [CHECKPOINT 3] Checking serialized transaction for Message Transmitter...');
                const serialized = tx.serialize();
                console.log('[Bridge2] [CHECKPOINT 3] Transaction serialized length:', serialized.length);
                
                // Try to extract instructions from transaction
                // For Transaction, we can access instructions directly
                if (tx instanceof Transaction && tx.instructions) {
                  // Get account keys from transaction (if available)
                  const accountKeys = tx.feePayer ? [tx.feePayer] : [];
                  
                  const isValid = findAndCheckMessageTransmitter(tx.instructions, accountKeys, 'CHECKPOINT 3');
                }
                
                // For VersionedTransaction, we need to deserialize to check
                // This is more complex, so we'll log a warning
                if (tx instanceof VersionedTransaction) {
                  console.log('[Bridge2] [CHECKPOINT 3] VersionedTransaction detected - CCTP data check may be limited');
                  console.log('[Bridge2] [CHECKPOINT 3] Note: VersionedTransaction instructions are in message format, checking may require deserialization');
                }
              } catch (checkError: any) {
                // If it's our validation error, re-throw it
                if (checkError.message && checkError.message.includes('CCTP Message Transmitter validation failed')) {
                  throw checkError;
                }
                console.warn('[Bridge2] [CHECKPOINT 3] Could not check CCTP data in serialized transaction:', checkError);
                // Don't throw here, just log - we'll check in other places
              }
              
              // Ensure transaction has a recent blockhash
              if (tx instanceof Transaction && !tx.recentBlockhash) {
                console.log('[Bridge2] Transaction missing recentBlockhash, fetching fresh blockhash...');
                const { blockhash } = await connection.getLatestBlockhash('confirmed');
                tx.recentBlockhash = blockhash;
                console.log('[Bridge2] Set recentBlockhash:', blockhash);
              }
              
              // After setting blockhash, we need to re-sign with internal signers if any
              // Signers might be in step.signers or step.transaction.signers
              const signers = step.signers || (step.transaction && step.transaction.signers) || [];
              if (signers && Array.isArray(signers) && signers.length > 0) {
                console.log('[Bridge2] Re-signing transaction with internal signers after blockhash update...');
                for (const signer of signers) {
                  if (signer && signer.secretKey) {
                    const { Keypair } = await import('@solana/web3.js');
                    const keypair = Keypair.fromSecretKey(signer.secretKey);
                    if (tx instanceof Transaction) {
                      tx.partialSign(keypair);
                    } else if (tx instanceof VersionedTransaction) {
                      tx.sign([keypair]);
                    }
                    console.log('[Bridge2] Re-signed with signer:', keypair.publicKey.toBase58());
                  }
                }
              }
              
              // It's already a proper transaction object, use solanaSigner
              if (solanaSigner && typeof solanaSigner.signAndSendTx === 'function') {
                console.log('[Bridge2] Using solanaSigner.signAndSendTx() with proper Transaction object');
                try {
                  const result = await solanaSigner.signAndSendTx(tx);
                  console.log('[Bridge2] solanaSigner.signAndSendTx() result:', result);
                  
                  if (typeof result === 'string') {
                    txSignature = result;
                  } else if (result && typeof result === 'object') {
                    txSignature = (result as any).txid || (result as any).txHash || (result as any).signature || '';
                  }
                  
                  if (txSignature) {
                    setLastTransferTxSignature(txSignature);
                    console.log('[Bridge2] Transaction sent via solanaSigner.signAndSendTx():', txSignature);
                  }
                } catch (sendError: any) {
                  console.error('[Bridge2] solanaSigner.signAndSendTx() failed:', sendError);
                  throw new Error(`Failed to send transaction via solanaSigner.signAndSendTx(): ${sendError.message}`);
                }
              } else if (signTransaction) {
                // Fallback to manual signing
                if (tx instanceof VersionedTransaction) {
                  console.log('[Bridge2] Transaction is VersionedTransaction, signing manually');
                  
                  // Re-sign with internal signers if needed
                  // Signers might be in step.signers or step.transaction.signers
                  const signers = step.signers || (step.transaction && step.transaction.signers) || [];
                  if (signers && Array.isArray(signers)) {
                    for (const signer of signers) {
                      if (signer && signer.secretKey) {
                        const { Keypair } = await import('@solana/web3.js');
                        const keypair = Keypair.fromSecretKey(signer.secretKey);
                        tx.sign([keypair]);
                      }
                    }
                  }
                  
                  // Sign with wallet
                  const signedTx = await signTransaction(tx);
                  const signature = await connection.sendTransaction(signedTx, {
                    skipPreflight: false,
                    maxRetries: 3,
                  });
                  
                  txSignature = signature;
                  setLastTransferTxSignature(signature);
                  await connection.confirmTransaction(signature, 'confirmed');
                  console.log('[Bridge2] Transaction confirmed:', signature);
                } else if (tx instanceof Transaction) {
                  console.log('[Bridge2] Transaction is regular Transaction, signing manually');
                  
                  // Get fresh blockhash
                  const { blockhash } = await connection.getLatestBlockhash('confirmed');
                  if (tx.recentBlockhash) {
                    tx.recentBlockhash = blockhash;
                  }
                  
                  // Re-sign with internal signers if needed
                  // Signers might be in step.signers or step.transaction.signers
                  const signers = step.signers || (step.transaction && step.transaction.signers) || [];
                  if (signers && Array.isArray(signers)) {
                    for (const signer of signers) {
                      if (signer && signer.secretKey) {
                        const { Keypair } = await import('@solana/web3.js');
                        const keypair = Keypair.fromSecretKey(signer.secretKey);
                        tx.partialSign(keypair);
                      }
                    }
                  }
                  
                  // Sign with wallet
                  const signedTx = await signTransaction(tx);
                  const signature = await connection.sendRawTransaction(signedTx.serialize(), {
                    skipPreflight: false,
                    maxRetries: 3,
                  });
                  
                  txSignature = signature;
                  setLastTransferTxSignature(signature);
                  await connection.confirmTransaction(signature, 'confirmed');
                  console.log('[Bridge2] Transaction confirmed:', signature);
                }
              }
            } else {
              // Transaction is a plain object, not a Transaction instance
              // This might be transaction data that needs to be constructed
              console.log('[Bridge2] Transaction is a plain object, checking structure:', {
                txKeys: Object.keys(tx || {}),
                hasInstructions: !!(tx as any)?.instructions,
                hasMessage: !!(tx as any)?.message,
                hasSerialize: typeof (tx as any)?.serialize === 'function',
                fullObject: JSON.stringify(tx, (key, value) => {
                  if (typeof value === 'function') return '[Function]';
                  if (value instanceof Uint8Array) return `[Uint8Array(${value.length})]`;
                  if (value && typeof value === 'object' && value.constructor?.name === 'Buffer') return `[Buffer(${value.length})]`;
                  if (value && typeof value === 'object' && value.toBase58) return `[PublicKey(${value.toBase58()})]`;
                  return value;
                }, 2).substring(0, 1000),
              });
              
              // The transaction object might contain a method to get the actual transaction
              // Or it might be a transaction builder that needs to be finalized
              // Check if there's a method to get the transaction
              if (typeof (tx as any)?.build === 'function') {
                console.log('[Bridge2] Transaction has build() method, calling it...');
                const builtTx = await (tx as any).build();
                if (builtTx instanceof VersionedTransaction || builtTx instanceof Transaction) {
                  // Recursively handle the built transaction
                  if (solanaSigner && typeof solanaSigner.signAndSendTx === 'function') {
                    const result = await solanaSigner.signAndSendTx(builtTx);
                    if (typeof result === 'string') {
                      txSignature = result;
                    } else if (result && typeof result === 'object') {
                      txSignature = (result as any).txid || (result as any).txHash || (result as any).signature || '';
                    }
                    if (txSignature) {
                      setLastTransferTxSignature(txSignature);
                      console.log('[Bridge2] Transaction sent via solanaSigner.signAndSendTx() after build():', txSignature);
                    }
                  }
                } else {
                  throw new Error(`Transaction.build() returned a non-Transaction object. Type: ${builtTx?.constructor?.name || typeof builtTx}`);
                }
              } else if (typeof (tx as any)?.toTransaction === 'function') {
                console.log('[Bridge2] Transaction has toTransaction() method, calling it...');
                const actualTx = (tx as any).toTransaction();
                if (actualTx instanceof VersionedTransaction || actualTx instanceof Transaction) {
                  if (solanaSigner && typeof solanaSigner.signAndSendTx === 'function') {
                    const result = await solanaSigner.signAndSendTx(actualTx);
                    if (typeof result === 'string') {
                      txSignature = result;
                    } else if (result && typeof result === 'object') {
                      txSignature = (result as any).txid || (result as any).txHash || (result as any).signature || '';
                    }
                    if (txSignature) {
                      setLastTransferTxSignature(txSignature);
                      console.log('[Bridge2] Transaction sent via solanaSigner.signAndSendTx() after toTransaction():', txSignature);
                    }
                  }
                } else {
                  throw new Error(`Transaction.toTransaction() returned a non-Transaction object. Type: ${actualTx?.constructor?.name || typeof actualTx}`);
                }
              } else {
                // No known method to convert the object to a Transaction
                // This is likely a bug or we need to use a different approach
                throw new Error(`Transaction from generator is a plain object without known conversion methods. Object keys: ${Object.keys(tx || {}).join(', ')}. The transaction object structure needs to be investigated.`);
              }
            }
            
            // Store xfer object from step if available
            if (step.xfer || step.transfer) {
              xfer = step.xfer || step.transfer;
            }
          } else if (step?.xfer || step?.transfer) {
            // Store xfer object if found in step
            xfer = step.xfer || step.transfer;
            console.log('[Bridge2] Found xfer object in step');
          }
        }
        
        console.log('[Bridge2] Transfer generator iteration complete:', {
          stepCount,
          hasXfer: !!xfer,
          txSignature,
        });
        
        if (!txSignature) {
          throw new Error('No transaction was sent during transfer steps');
        }
        
        // If xfer object wasn't found in steps, try to get it from the last step
        if (!xfer && lastStep) {
          console.log('[Bridge2] Attempting to extract xfer from lastStep:', {
            lastStepKeys: Object.keys(lastStep || {}),
            hasXfer: !!lastStep?.xfer,
            hasTransfer: !!lastStep?.transfer,
            hasFetchAttestation: typeof lastStep?.fetchAttestation === 'function',
            lastStepType: typeof lastStep,
            lastStepConstructor: lastStep?.constructor?.name,
          });
          
          // Try to get xfer from various possible locations
          if (lastStep.xfer) {
            xfer = lastStep.xfer;
            console.log('[Bridge2] Found xfer in lastStep.xfer');
          } else if (lastStep.transfer) {
            xfer = lastStep.transfer;
            console.log('[Bridge2] Found xfer in lastStep.transfer');
          } else if (typeof lastStep.fetchAttestation === 'function') {
            // lastStep itself might be the xfer object
            xfer = lastStep;
            console.log('[Bridge2] lastStep itself appears to be xfer object (has fetchAttestation)');
          } else {
            // Save lastStep as xferData anyway for recovery purposes
            xfer = lastStep;
            console.log('[Bridge2] Using lastStep as xfer (may not have fetchAttestation method)');
          }
        }
        
        // Log final xfer state with detailed structure
        console.log('[Bridge2] Final xfer state:', {
          hasXfer: !!xfer,
          xferType: typeof xfer,
          xferConstructor: xfer?.constructor?.name,
          xferKeys: xfer ? Object.keys(xfer) : [],
          hasFetchAttestation: typeof xfer?.fetchAttestation === 'function',
          hasInitiateTransfer: typeof xfer?.initiateTransfer === 'function',
        });
        
        // Detailed xfer object logging for debugging
        if (xfer) {
          console.log('[Bridge2] Detailed xfer object structure:', {
            allKeys: Object.keys(xfer),
            methods: Object.keys(xfer).filter(key => typeof xfer[key] === 'function'),
            properties: Object.keys(xfer).filter(key => typeof xfer[key] !== 'function'),
            hasMessage: !!xfer.message,
            hasSourceDomain: !!xfer.sourceDomain,
            hasDestDomain: !!xfer.destDomain,
            hasNonce: !!xfer.nonce,
            messageType: typeof xfer.message,
            messageKeys: xfer.message ? Object.keys(xfer.message) : [],
            // Try to extract message data if available
            messageData: xfer.message ? JSON.stringify(xfer.message, (key, value) => {
              if (typeof value === 'function') return '[Function]';
              if (value instanceof Uint8Array) return `[Uint8Array(${value.length})]`;
              if (value && typeof value === 'object' && value.constructor?.name === 'Buffer') return `[Buffer(${value.length})]`;
              return value;
            }, 2).substring(0, 2000) : null,
          });
          
          // Log source and destination domains if available
          if (xfer.sourceDomain !== undefined || xfer.destDomain !== undefined) {
            console.log('[Bridge2] Xfer domains:', {
              sourceDomain: xfer.sourceDomain,
              destDomain: xfer.destDomain,
              sourceDomainHex: xfer.sourceDomain !== undefined ? `0x${xfer.sourceDomain.toString(16).padStart(8, '0')}` : undefined,
              destDomainHex: xfer.destDomain !== undefined ? `0x${xfer.destDomain.toString(16).padStart(8, '0')}` : undefined,
              expectedSourceDomain: '0x00000001 (Solana)',
              expectedDestDomain: '0x00000002 (Aptos)',
            });
          }
        }
      } catch (error: any) {
        console.error('[Bridge2] Failed to create Circle transfer:', error);
        throw new Error(`Failed to create transfer: ${error.message}`);
      }

      setTransferStatus('Transfer initiated on Solana...');
      
      // Transaction signature is already set from generator iteration
      console.log('[Bridge2] Transfer completed, txSignature:', txSignature);
      
      setTransferStatus(`Transfer initiated! Transaction: ${txSignature ? txSignature.slice(0, 8) + '...' + txSignature.slice(-8) : 'pending'}`);
      
      toast({
        title: "Transfer Initiated",
        description: `Your transfer has been initiated. Transaction: ${txSignature ? txSignature.slice(0, 8) + '...' + txSignature.slice(-8) : 'pending'}. The relayer will complete it automatically.${txSignature ? ` View on Solscan: https://solscan.io/tx/${txSignature}` : ''}`,
      });

      // After successful initiation, save xfer object immediately
      // Then fetch attestation in background (non-blocking) and update localStorage when ready
      if (txSignature) {
        setTransferStatus('Saving transfer data...');
		
		
		// Automatically mint USDC on Aptos via server API
        if (destinationAddress) {
          setTransferStatus('Minting USDC on Aptos...');
          
          fetch('/api/aptos/mint-cctp', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              signature: txSignature,
              sourceDomain: '5', // Solana CCTP V1 domain
              finalRecipient: destinationAddress,
            }),
          })
            .then(async (response) => {
              const data = await response.json();
              if (response.ok) {
                console.log('[Bridge2] USDC minted successfully on Aptos');
                toast({
                  title: "USDC Minted on Aptos",
                  description: `USDC has been automatically minted on Aptos. Account: ${data.data?.accountAddress || 'N/A'}`,
                });
                setTransferStatus(`Transfer complete! USDC minted on Aptos. Transaction: ${txSignature.slice(0, 8)}...${txSignature.slice(-8)}`);
              } else {
                console.error('[Bridge2] Failed to mint USDC on Aptos:', data);
                toast({
                  title: "Minting Failed",
                  description: data.error?.message || "Failed to automatically mint USDC on Aptos. You can mint manually later.",
                  variant: "destructive",
                });
                // Don't fail the whole transfer if minting fails
                setTransferStatus(`Transfer initiated! Transaction: ${txSignature.slice(0, 8)}...${txSignature.slice(-8)}. Minting failed, you can mint manually later.`);
              }
            })
            .catch((error) => {
              console.error('[Bridge2] Error calling mint API:', error);
              toast({
                title: "Minting Error",
                description: "Failed to automatically mint USDC on Aptos. You can mint manually later.",
                variant: "destructive",
              });
              // Don't fail the whole transfer if minting fails
              setTransferStatus(`Transfer initiated! Transaction: ${txSignature.slice(0, 8)}...${txSignature.slice(-8)}. Minting error, you can mint manually later.`);
            });
        }
		
		
		
		
		
		
		
        
        // Save xfer object to localStorage immediately (without attestation)
        // Deep clone xfer with proper serialization
        let serializedXfer: any = null;
        
        console.log('[Bridge2] Attempting to serialize xfer object:', {
          hasXfer: !!xfer,
          xferType: typeof xfer,
          xferConstructor: xfer?.constructor?.name,
          xferKeys: xfer ? Object.keys(xfer) : [],
        });
        
        try {
          if (xfer) {
            serializedXfer = JSON.parse(JSON.stringify(xfer, (key, value) => {
              // Remove circular references and functions
              if (typeof value === 'function') return undefined;
              if (value instanceof Error) return { message: value.message, stack: value.stack };
              
              // Handle Uint8Array, Buffer, etc.
              if (value instanceof Uint8Array || (value && value.constructor?.name === 'Uint8Array')) {
                return Array.from(value);
              }
              if (value && typeof value === 'object' && value.constructor?.name === 'Buffer') {
                return Array.from(value);
              }
              
              // Handle PublicKey-like objects
              if (value && typeof value === 'object' && value.toBase58) {
                try {
                  return { _type: 'PublicKey', address: value.toBase58() };
                } catch (e) {
                  return { _type: 'PublicKey', error: 'Could not serialize' };
                }
              }
              
              // Handle BigInt
              if (typeof value === 'bigint') {
                return value.toString();
              }
              
              return value;
            }));
            
            console.log('[Bridge2] Successfully serialized xfer object:', {
              serializedKeys: Object.keys(serializedXfer || {}),
              serializedSize: JSON.stringify(serializedXfer).length,
            });
          } else {
            console.warn('[Bridge2] xfer object is null or undefined, cannot serialize');
            serializedXfer = {
              _error: 'xfer object is null or undefined',
              _note: 'xfer object was not found in generator steps',
            };
          }
        } catch (serializeError: any) {
          console.error('[Bridge2] Failed to serialize xfer object:', serializeError.message, serializeError.stack);
          serializedXfer = {
            _error: 'Failed to serialize',
            _errorMessage: serializeError.message,
            _errorStack: serializeError.stack,
            _keys: xfer ? Object.keys(xfer) : [],
            _constructor: xfer?.constructor?.name,
            _xferType: typeof xfer,
          };
        }
        
        // Extract depositMessageHash if available from xfer
        let messageHash: string | null = null;
        try {
          // Try to extract from xfer object
          if (xfer) {
            const possibleHashProps = ['depositMessageHash', 'messageHash', 'hash', 'id'];
            for (const prop of possibleHashProps) {
              if (xfer[prop]) {
                const value = xfer[prop];
                if (typeof value === 'string' && (value.startsWith('0x') || value.length >= 32)) {
                  messageHash = value;
                  break;
                } else if (typeof value === 'object' && value.hash) {
                  messageHash = value.hash;
                  break;
                }
              }
            }
          }
          
          // If still not found, try to extract from transaction logs
          if (!messageHash && txSignature) {
            console.log('[Bridge2] Attempting to extract depositMessageHash from transaction logs...');
            await new Promise(resolve => setTimeout(resolve, 2000));
            messageHash = await extractDepositMessageHash(txSignature);
          }
          
          // If still not found, try localStorage
          if (!messageHash && txSignature) {
            console.log('[Bridge2] Trying to get depositMessageHash from localStorage...');
            messageHash = await getDepositMessageHashFromLocalStorage(txSignature);
          }
          
          // If still not found, try Circle API
          if (!messageHash && txSignature) {
            console.log('[Bridge2] Trying to get depositMessageHash from Circle API...');
            messageHash = await getDepositMessageHashFromCircle(txSignature);
          }
        } catch (hashError: any) {
          console.warn('[Bridge2] Error extracting depositMessageHash:', hashError.message);
        }
        
        // Save initial data to localStorage (without attestation)
        const normalizedHash = messageHash ? normalizeDepositMessageHash(messageHash) || messageHash : null;
        if (normalizedHash) {
          setDepositMessageHash(normalizedHash);
          saveDepositMessageHash(txSignature, messageHash!);
        }
        
        // Save full CCTP message including xfer object (without attestation for now)
        console.log('[Bridge2] Calling saveCCTPMessage with:', {
          txSignature,
          messageHash: normalizedHash || messageHash,
          hasSerializedXfer: !!serializedXfer,
          serializedXferType: typeof serializedXfer,
          serializedXferKeys: serializedXfer ? Object.keys(serializedXfer) : [],
          serializedXferError: serializedXfer?._error,
        });
        
        await saveCCTPMessage(txSignature, normalizedHash || messageHash || '', serializedXfer);
        
        console.log('[Bridge2] Saved initial transfer data:', {
          txSignature,
          messageHash: normalizedHash || messageHash,
          hasXfer: !!serializedXfer,
          xferSaved: !!serializedXfer,
        });
        
        if (normalizedHash || messageHash) {
          setTransferStatus(`Transfer initiated! depositMessageHash: ${(normalizedHash || messageHash)!.slice(0, 18)}...${(normalizedHash || messageHash)!.slice(-8)}. Fetching attestation in background...`);
        } else {
          setTransferStatus('Transfer initiated! Fetching attestation in background...');
        }
      }
      
      // Fetch attestation in background (non-blocking) - it may be available immediately or within a few seconds
      // This allows the UI to remain responsive while we wait for attestation
      // Only try to fetch attestation if xfer object has the method
      console.log('[Bridge2] Checking if xfer has fetchAttestation method:', {
        hasXfer: !!xfer,
        xferType: typeof xfer,
        xferConstructor: xfer?.constructor?.name,
        hasFetchAttestation: typeof xfer?.fetchAttestation === 'function',
        xferKeys: xfer ? Object.keys(xfer) : [],
        xferMethods: xfer ? Object.getOwnPropertyNames(Object.getPrototypeOf(xfer || {})).filter(name => typeof (xfer as any)[name] === 'function') : [],
      });
      
      if (xfer && typeof xfer.fetchAttestation === 'function') {
        (async () => {
          try {
            setTransferStatus(prev => prev + ' (waiting for attestation...)');
            // Use shorter timeout - attestation is usually available within 10-15 seconds
            const timeout = 15 * 1000; // 15 seconds timeout (usually enough)
            console.log('[Bridge2] Calling xfer.fetchAttestation() in background with timeout:', timeout);
            
            const attestIds = await xfer.fetchAttestation(timeout);
            console.log('[Bridge2] Got attestation in background:', attestIds);
          
          // Serialize attestation for localStorage
          let serializedAttestation: any = null;
          try {
            serializedAttestation = JSON.parse(JSON.stringify(attestIds, (key, value) => {
              if (typeof value === 'function') return undefined;
              if (value instanceof Error) return { message: value.message, stack: value.stack };
              if (value instanceof Uint8Array || (value && value.constructor?.name === 'Uint8Array')) {
                return Array.from(value);
              }
              if (value && typeof value === 'object' && value.constructor?.name === 'Buffer') {
                return Array.from(value);
              }
              if (value && typeof value === 'object' && value.toBase58) {
                try {
                  return { _type: 'PublicKey', address: value.toBase58() };
                } catch (e) {
                  return { _type: 'PublicKey', error: 'Could not serialize' };
                }
              }
              if (typeof value === 'bigint') {
                return value.toString();
              }
              return value;
            }));
          } catch (serializeError: any) {
            console.warn('[Bridge2] Failed to serialize attestation:', serializeError.message);
            serializedAttestation = {
              _error: 'Failed to serialize',
              _errorMessage: serializeError.message,
              _raw: attestIds,
            };
          }
          
          // Update localStorage entry with attestation
          if (txSignature) {
            const existingEntries = localStorage.getItem('cctp_messages');
            const entries = existingEntries ? JSON.parse(existingEntries) : [];
            const entryIndex = entries.findIndex((e: any) => e.txSignature === txSignature);
            
            if (entryIndex >= 0) {
              entries[entryIndex].attestation = serializedAttestation;
              entries[entryIndex].attestationReceivedAt = Date.now();
              entries[entryIndex].attestationReceivedAtISO = new Date().toISOString();
              localStorage.setItem('cctp_messages', JSON.stringify(entries));
              
              console.log('[Bridge2] Updated localStorage entry with attestation:', {
                txSignature,
                hasAttestation: !!serializedAttestation,
              });
              
              // Also update depositMessageHash from attestation if available
              let messageHashFromAttestation: string | null = null;
              if (attestIds && typeof attestIds === 'object') {
                messageHashFromAttestation = attestIds.messageHash || attestIds.hash || null;
              }
              
              if (messageHashFromAttestation) {
                const normalizedHash = normalizeDepositMessageHash(messageHashFromAttestation) || messageHashFromAttestation;
                if (normalizedHash && normalizedHash !== entries[entryIndex].depositMessageHash) {
                  entries[entryIndex].depositMessageHash = normalizedHash;
                  entries[entryIndex].depositMessageHashOriginal = messageHashFromAttestation;
                  localStorage.setItem('cctp_messages', JSON.stringify(entries));
                  setDepositMessageHash(normalizedHash);
                  console.log('[Bridge2] Updated depositMessageHash from attestation:', normalizedHash);
                }
              }
              
              setTransferStatus(`Transfer initiated! Attestation received. depositMessageHash: ${entries[entryIndex].depositMessageHash ? entries[entryIndex].depositMessageHash.slice(0, 18) + '...' + entries[entryIndex].depositMessageHash.slice(-8) : 'saved'}.`);
              
              toast({
                title: "Attestation Received",
                description: `Circle attestation received and saved to localStorage. You can now use it to complete the transfer on Aptos.`,
              });
            } else {
              // Entry not found, save as new entry
              console.warn('[Bridge2] Entry not found in localStorage, saving with attestation...');
              const messageHash = await extractDepositMessageHash(txSignature) || 
                                   await getDepositMessageHashFromLocalStorage(txSignature) ||
                                   await getDepositMessageHashFromCircle(txSignature) ||
                                   '';
              await saveCCTPMessage(txSignature, messageHash, xfer, serializedAttestation);
            }
          }
          } catch (attestError: any) {
            console.warn('[Bridge2] Failed to fetch attestation in background (this is OK for automatic transfers - relayer will handle it):', attestError.message);
            // Don't fail the transfer if attestation fetch fails - relayer will handle it
            setTransferStatus(prev => prev.replace(' (waiting for attestation...)', ' (attestation will be handled by relayer)'));
          }
        })();
      } else {
        console.warn('[Bridge2] xfer object does not have fetchAttestation method, skipping attestation fetch (relayer will handle it)', {
          hasXfer: !!xfer,
          xferType: typeof xfer,
          xferConstructor: xfer?.constructor?.name,
          xferKeys: xfer ? Object.keys(xfer) : [],
          xferMethods: xfer ? Object.getOwnPropertyNames(Object.getPrototypeOf(xfer || {})).filter(name => typeof (xfer as any)[name] === 'function') : [],
          note: 'Attestation will be fetched by relayer automatically',
        });
      }
      
      // The relayer will automatically complete the transfer
      setTransferStatus('Waiting for relayer to complete transfer...');
      
    } catch (error: any) {
      console.error('[Bridge2] Transfer error:', error);
      setTransferStatus(`Error: ${error.message || 'Unknown error'}`);
      
      // Automatically refund SOL from funded signers if transfer failed
      // Only refund signers that were funded in this specific attempt
      if (currentFundedSigners.length > 0) {
        console.log('[Bridge2] Transfer failed, attempting to auto-refund SOL from funded signers...');
        setTransferStatus(`Transfer failed. Auto-refunding SOL from internal signers...`);
        
        try {
          const { Connection, Transaction, SystemProgram, PublicKey, LAMPORTS_PER_SOL } = await import('@solana/web3.js');
          const connection = solanaConnection || new Connection(
            process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 
            process.env.SOLANA_RPC_URL || 
            'https://mainnet.helius-rpc.com/?api-key=29798653-2d13-4d8a-96ad-df70b015e234',
            'confirmed'
          );

          const walletPubkey = new PublicKey(solanaAddress!);
          let totalRefunded = 0;
          const refundTx = new Transaction();

          // Реальный rent-exempt минимум + небольшой буфер под комиссию
          const rentExempt = await connection.getMinimumBalanceForRentExemption(0);
          const feeBuffer = 5_000;
          const minBalance = rentExempt + feeBuffer;

          for (const { pubkey, keypair } of currentFundedSigners) {
            try {
              const signerPubkey = new PublicKey(pubkey);
              const balance = await connection.getBalance(signerPubkey);
              
              const amountToRefund = balance > minBalance ? balance - minBalance : 0;
              
              if (amountToRefund > 0) {
                console.log('[Bridge2] Auto-refunding from signer:', {
                  pubkey: pubkey,
                  balance: balance,
                  balanceSOL: balance / LAMPORTS_PER_SOL,
                  minBalance,
                  minBalanceSOL: minBalance / LAMPORTS_PER_SOL,
                  amountToRefund: amountToRefund,
                  amountToRefundSOL: amountToRefund / LAMPORTS_PER_SOL,
                });

                refundTx.add(
                  SystemProgram.transfer({
                    fromPubkey: signerPubkey,
                    toPubkey: walletPubkey,
                    lamports: amountToRefund,
                  })
                );

                totalRefunded += amountToRefund;
              }
            } catch (err: any) {
              console.warn('[Bridge2] Failed to process signer for auto-refund:', err.message);
            }
          }

          if (refundTx.instructions.length > 0) {
            // Set fee payer and recent blockhash
            refundTx.feePayer = walletPubkey;
            const { blockhash } = await connection.getLatestBlockhash('confirmed');
            refundTx.recentBlockhash = blockhash;

            // Sign transaction with all signer keypairs
            for (const { keypair } of currentFundedSigners) {
              if (keypair) {
                refundTx.partialSign(keypair);
              }
            }

            // Sign with wallet
            if (signTransaction) {
              const signed = await signTransaction(refundTx);
              const signature = await connection.sendRawTransaction(signed.serialize());
              console.log('[Bridge2] Auto-refund transaction sent:', signature);
              console.log('[Bridge2] View on Solscan: https://solscan.io/tx/' + signature);
              
              // Try to confirm, but don't wait too long
              try {
                await Promise.race([
                  connection.confirmTransaction(signature, 'confirmed'),
                  new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000))
                ]);
                console.log('[Bridge2] Auto-refund transaction confirmed');
              } catch (confirmError: any) {
                console.warn('[Bridge2] Auto-refund transaction confirmation timeout, but may have succeeded:', confirmError.message);
              }

              // Clear only the signers that were refunded in this attempt
              setFundedSigners(prev => prev.filter(s => !currentFundedSigners.some(cs => cs.pubkey === s.pubkey)));

              toast({
                title: "Auto-Refund Successful",
                description: `Automatically refunded ${(totalRefunded / LAMPORTS_PER_SOL).toFixed(6)} SOL after transfer failure. Transaction: ${signature.slice(0, 8)}...${signature.slice(-8)}`,
              });

              setTransferStatus(`Transfer failed. Auto-refunded ${(totalRefunded / LAMPORTS_PER_SOL).toFixed(6)} SOL. Transaction: ${signature.slice(0, 8)}...${signature.slice(-8)}`);
            }
          } else {
            console.log('[Bridge2] No excess funds to refund');
          }
        } catch (refundError: any) {
          console.error('[Bridge2] Auto-refund failed:', refundError);
          // Don't show error toast for refund failure, just log it
          // The main error toast will be shown below
        }
      }
      
      toast({
        variant: "destructive",
        title: "Transfer Failed",
        description: error.message || "Failed to initiate transfer",
      });
    } finally {
      setIsTransferring(false);
    }
  };


  return (
    <div className="w-full min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-gray-50 via-white to-gray-100">
      <div className="w-full max-w-2xl space-y-4">
        <BridgeView
          sourceChain={sourceChain}
          sourceToken={sourceToken}
          destChain={destChain}
          destToken={destToken}
          amount={transferAmount}
          destinationAddress={destinationAddress}
          onSourceChainSelect={setSourceChain}
          onSourceTokenSelect={setSourceToken}
          onDestChainSelect={setDestChain}
          onDestTokenSelect={setDestToken}
          onAmountChange={setTransferAmount}
          onDestinationAddressChange={setDestinationAddress}
          onTransfer={handleTransfer}
          onRefund={handleRefund}
          hasFundedSigners={fundedSigners.length > 0}
          isTransferring={isTransferring}
          transferStatus={transferStatus}
          chains={CHAINS}
          tokens={TOKENS}
        />

        {/* Display saved depositMessageHash for Aptos redeem */}
        {depositMessageHash && lastTransferTxSignature && (
          <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4 space-y-3">
            <h3 className="text-lg font-semibold text-green-800">Transfer Initiated Successfully!</h3>
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium text-green-700">Transaction:</span>
                <a
                  href={`https://solscan.io/tx/${lastTransferTxSignature}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 text-blue-600 hover:underline font-mono"
                >
                  {lastTransferTxSignature.slice(0, 8)}...{lastTransferTxSignature.slice(-8)}
                </a>
              </div>
              <div>
                <span className="font-medium text-green-700">depositMessageHash:</span>
                <div className="mt-1 p-2 bg-white rounded border font-mono text-xs break-all">
                  {depositMessageHash}
                </div>
              </div>
              <div className="pt-2">
                <p className="text-green-700 mb-2">
                  Use this depositMessageHash to complete the transfer on Aptos:
                </p>
                <div className="flex gap-2 flex-wrap">
                  <a
                    href={`/cctp-redeem-test?messageHash=${encodeURIComponent(depositMessageHash)}&txSignature=${encodeURIComponent(lastTransferTxSignature)}`}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm font-medium"
                  >
                    Complete Transfer on Aptos
                  </a>
                  <a
                    href={`/cctp-list-attestations?messageHash=${encodeURIComponent(depositMessageHash)}`}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium"
                  >
                    Get Attestation from Circle
                  </a>
                  <button
                    onClick={downloadAllCCTPMessages}
                    className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm font-medium"
                  >
                    Download All CCTP Messages (JSON)
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Bridge2Page() {
  return (
    <SolanaWalletProviderWrapper>
      <Bridge2PageContent />
    </SolanaWalletProviderWrapper>
  );
}
