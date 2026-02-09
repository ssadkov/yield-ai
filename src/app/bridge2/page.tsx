"use client";

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
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
import { BridgeView } from '@/components/bridge/BridgeView';
import { ActionLog, type ActionLogItem } from '@/components/bridge/ActionLog';
import { SolanaWalletProviderWrapper } from './SolanaWalletProvider';
import { useSolanaPortfolio } from '@/hooks/useSolanaPortfolio';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
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
  const searchParams = useSearchParams();
  const router = useRouter();
  const { tokens: solanaTokens } = useSolanaPortfolio();
  
  // Calculate USDC balance from Solana portfolio
  const usdcBalance = solanaTokens.find(
    (token) => token.address === USDC_SOLANA || token.symbol === 'USDC'
  );
  const availableUsdcBalance = usdcBalance
    ? (parseFloat(usdcBalance.amount) / Math.pow(10, usdcBalance.decimals)).toFixed(6)
    : null;
  
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
  const [lastTransferTxSignature, setLastTransferTxSignature] = useState<string | null>(null);
  const [actionLog, setActionLog] = useState<ActionLogItem[]>([]);

  // Get Solana address from wallet adapter
  const solanaAddress = solanaPublicKey?.toBase58() || null;

  // Ensure source and destination chains/tokens are always set (even if disabled)
  useEffect(() => {
    if (!sourceChain) {
      setSourceChain(CHAINS[0]); // Solana
    }
    if (!sourceToken) {
      const solanaToken = TOKENS.find((t) => t.chain === 'Solana');
      if (solanaToken) {
        setSourceToken(solanaToken);
      }
    }
    if (!destChain) {
      setDestChain(CHAINS[1]); // Aptos
    }
    if (!destToken) {
      const aptosToken = TOKENS.find((t) => t.chain === 'Aptos');
      if (aptosToken) {
        setDestToken(aptosToken);
      }
    }
  }, []); // Run once on mount

  // Read destination address from query parameter
  useEffect(() => {
    if (!searchParams) return;
    const destination = searchParams.get('destination');
    if (destination) {
      // Decode and set destination address
      const decodedAddress = decodeURIComponent(destination);
      setDestinationAddress(decodedAddress);
    }
  }, [searchParams]);

  // Helper function to add action to log
  const addAction = (message: string, status: 'pending' | 'success' | 'error', link?: string, linkText?: string, startTime?: number) => {
    const now = Date.now();
    const newAction: ActionLogItem = {
      id: now.toString() + Math.random().toString(36).substr(2, 9),
      message,
      status,
      timestamp: new Date(),
      link,
      linkText,
      startTime: startTime || now,
      duration: startTime ? now - startTime : undefined,
    };
    setActionLog(prev => [...prev, newAction]);
    console.log(`[Bridge Action] ${status.toUpperCase()}: ${message}`, link ? `Link: ${link}` : '');
    return newAction.id; // Return ID for tracking
  };

  // Helper function to update last action
  const updateLastAction = (message: string, status: 'pending' | 'success' | 'error', link?: string, linkText?: string) => {
    const now = Date.now();
    setActionLog(prev => {
      const newLog = [...prev];
      if (newLog.length > 0) {
        const lastAction = newLog[newLog.length - 1];
        const startTime = lastAction.startTime || lastAction.timestamp.getTime();
        newLog[newLog.length - 1] = {
          ...lastAction,
          message,
          status,
          link,
          linkText,
          startTime,
          duration: status !== 'pending' ? now - startTime : undefined, // Calculate duration when action completes
        };
      }
      return newLog;
    });
  };

  // Initialize Wormhole SDK
  useEffect(() => {
    const initWormhole = async () => {
      try {
        try {
          await initCCTPProtocols();
        } catch (err: any) {
          console.error('[Bridge2] initCCTPProtocols failed:', err);
          throw err; // Re-throw to prevent continuing with unregistered protocols
        }
        
        // Small delay to ensure protocol registration is complete
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // IMPORTANT: Before initializing Wormhole, verify protocols are registered
        // and ensure we're using the same protocolFactory instance
        const sdkDefinitions = await import('@wormhole-foundation/sdk-definitions');
        const { protocolIsRegistered: checkProtocol } = sdkDefinitions as any;
        const sdkSolana = await import('@wormhole-foundation/sdk-solana');
        const { _platform } = sdkSolana;
        
        
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
        
        setWh(wormholeInstance);
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
      setTransferStatus(`Refund transaction sent: ${signature.slice(0, 8)}...${signature.slice(-8)}`);

      // Wait for confirmation
      try {
        await connection.confirmTransaction(signature, 'confirmed');
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
      } catch (err) {
        console.warn('[Bridge2] Failed to download log file:', err);
      }

    } catch (error) {
      console.error('[Bridge2] Failed to log funding transaction:', error);
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

    // Ensure chains and tokens are set (they should be, but double-check)
    if (!sourceChain || !sourceToken || !destChain || !destToken) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Source and destination chains/tokens must be selected",
      });
      return;
    }

    // Validate amount (max 10 USDC)
    const amountNum = parseFloat(transferAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter a valid amount",
      });
      return;
    }
    if (amountNum > 10) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Maximum amount is 10 USDC",
      });
      return;
    }

    setIsTransferring(true);
    setTransferStatus('Initializing transfer...');
    setActionLog([]); // Clear previous actions
    const transferStartTime = Date.now();
    addAction('Initializing transfer...', 'pending', undefined, undefined, transferStartTime);

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

      // Get RPC URLs - use env variables first, fallback to Wormhole SDK
      // NOTE: In Next.js, only NEXT_PUBLIC_* variables are available on client side
      const solanaRpcFromEnv = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 
                                process.env.SOLANA_RPC_URL ||
                                (process.env.NEXT_PUBLIC_SOLANA_RPC_API_KEY || process.env.SOLANA_RPC_API_KEY
                                  ? `https://mainnet.helius-rpc.com/?api-key=${process.env.NEXT_PUBLIC_SOLANA_RPC_API_KEY || process.env.SOLANA_RPC_API_KEY}`
                                  : 'https://mainnet.helius-rpc.com/?api-key=29798653-2d13-4d8a-96ad-df70b015e234');
      
      const solanaRpcFromWormhole = await sendChain.getRpc();
      const aptosRpc = await rcvChain.getRpc();
      
      // Use RPC from env, not from Wormhole SDK
      const solanaRpc = solanaRpcFromEnv;
      
      console.log('[Bridge2] RPC Configuration:', {
        usingEnv: !!process.env.NEXT_PUBLIC_SOLANA_RPC_URL || !!process.env.SOLANA_RPC_URL || !!process.env.SOLANA_RPC_API_KEY,
        solanaRpcFromEnv,
        solanaRpcFromWormhole,
        finalRpc: solanaRpc,
      });

      // Get signers
      // For Solana, use wallet adapter
      if (!solanaWallet?.adapter || !signTransaction) {
        throw new Error('Solana wallet not connected or signer not available');
      }
      
      // Create Solana signer from wallet adapter
      // Use connection from provider or create new one with RPC from env
      const { Connection, PublicKey, LAMPORTS_PER_SOL } = await import('@solana/web3.js');
      const connection = solanaConnection || new Connection(solanaRpc, 'confirmed');
      
      console.log('[Bridge2] Connection created:', {
        usingSolanaConnection: !!solanaConnection,
        connectionEndpoint: connection.rpcEndpoint,
      });
      
      // Check wallet balance before sending transaction
      if (solanaAddress) {
        try {
          const balance = await connection.getBalance(new PublicKey(solanaAddress));
          const balanceSOL = balance / LAMPORTS_PER_SOL;
          console.log('[Bridge2] Wallet balance check:', {
            address: solanaAddress,
            balance: balance,
            balanceSOL: balanceSOL,
            hasEnoughSOL: balanceSOL >= 0.01, // Minimum recommended: 0.01 SOL
          });
          
          if (balanceSOL < 0.01) {
            console.warn('[Bridge2] WARNING: Low SOL balance! Transaction may fail. Recommended: at least 0.01 SOL');
            toast({
              variant: "destructive",
              title: "Low SOL Balance",
              description: `You have ${balanceSOL.toFixed(4)} SOL. Recommended: at least 0.01 SOL for transaction fees and rent.`,
            });
          }
        } catch (balanceError: any) {
          console.warn('[Bridge2] Could not check wallet balance:', balanceError.message);
        }
      }
      

      const solanaSigner = {
        address: () => solanaAddress!,
        chain: () => 'Solana' as const,
        signAndSendTx: async (tx: any) => {
          console.log('[Bridge2] solanaSigner.signAndSendTx() called:', {
            txType: typeof tx,
            txConstructor: tx?.constructor?.name,
            hasSerialize: typeof tx?.serialize === 'function',
          });
          
          // Sign transaction with wallet adapter
          if (!signTransaction) {
            throw new Error('Sign transaction function not available');
          }
          
          console.log('[Bridge2] Calling signTransaction()...');
          const signed = await signTransaction(tx);
          console.log('[Bridge2] Transaction signed:', {
            signedType: typeof signed,
            signedConstructor: signed?.constructor?.name,
            hasSerialize: typeof signed?.serialize === 'function',
          });
          
          // Send transaction with skipPreflight: true to bypass simulation
          // Simulation may show false positives for rent errors, but transaction can still succeed
          console.log('[Bridge2] Calling connection.sendRawTransaction()...');
          console.log('[Bridge2] Transaction serialized length:', signed.serialize().length);
          
          let signature: string;
          try {
            signature = await connection.sendRawTransaction(signed.serialize(), {
              skipPreflight: false, // Enable preflight to catch errors early
              maxRetries: 3,
            });
            console.log('[Bridge2] Transaction sent to blockchain, signature:', signature);
            console.log('[Bridge2] Transaction URL: https://solscan.io/tx/' + signature);
          } catch (sendError: any) {
            console.error('[Bridge2] sendRawTransaction failed:', {
              error: sendError,
              message: sendError?.message,
              name: sendError?.name,
              code: sendError?.code,
              logs: sendError?.logs,
            });
            
            // If preflight fails, try with skipPreflight: true
            if (sendError?.message?.includes('preflight') || sendError?.message?.includes('simulation')) {
              console.log('[Bridge2] Retrying with skipPreflight: true...');
              try {
                signature = await connection.sendRawTransaction(signed.serialize(), {
                  skipPreflight: true,
                  maxRetries: 3,
                });
                console.log('[Bridge2] Transaction sent to blockchain (retry), signature:', signature);
              } catch (retryError: any) {
                console.error('[Bridge2] Retry also failed:', retryError);
                throw new Error(`Failed to send transaction: ${retryError.message || sendError.message}`);
              }
            } else {
              throw sendError;
            }
          }
          
          // Check transaction status immediately after sending
          try {
            const txStatus = await connection.getSignatureStatus(signature);
            console.log('[Bridge2] Transaction status immediately after send:', {
              signature,
              status: txStatus,
              confirmationStatus: txStatus?.value?.confirmationStatus,
              err: txStatus?.value?.err,
            });
          } catch (statusError: any) {
            console.warn('[Bridge2] Could not get transaction status immediately:', statusError.message);
          }
          
          // Try to confirm transaction with longer timeout
          // If confirmation times out, the transaction may still succeed
          try {
            console.log('[Bridge2] Waiting for transaction confirmation...');
            const confirmResult = await connection.confirmTransaction(signature, 'confirmed');
            console.log('[Bridge2] Transaction confirmed on blockchain:', {
              signature,
              confirmResult,
              slot: confirmResult?.context?.slot,
              err: confirmResult?.value?.err,
            });
            
            // Double-check transaction status after confirmation
            const finalStatus = await connection.getSignatureStatus(signature);
            console.log('[Bridge2] Final transaction status after confirmation:', {
              signature,
              status: finalStatus,
              confirmationStatus: finalStatus?.value?.confirmationStatus,
              err: finalStatus?.value?.err,
            });
          } catch (confirmError: any) {
            console.error('[Bridge2] Transaction confirmation error:', {
              error: confirmError,
              message: confirmError?.message,
              name: confirmError?.name,
              stack: confirmError?.stack,
            });
            
            // Check transaction status even if confirmation failed
            try {
              const errorStatus = await connection.getSignatureStatus(signature);
              console.log('[Bridge2] Transaction status after confirmation error:', {
                signature,
                status: errorStatus,
                confirmationStatus: errorStatus?.value?.confirmationStatus,
                err: errorStatus?.value?.err,
              });
              
              // Also try getTransaction for more details
              try {
                const txDetails = await connection.getTransaction(signature, {
                  commitment: 'confirmed',
                  maxSupportedTransactionVersion: 0,
                });
                console.log('[Bridge2] Transaction details after confirmation error:', {
                  signature,
                  slot: txDetails?.slot,
                  blockTime: txDetails?.blockTime,
                  err: txDetails?.meta?.err,
                  fee: txDetails?.meta?.fee,
                  success: !txDetails?.meta?.err,
                  exists: !!txDetails,
                });
                
                if (!txDetails) {
                  console.error('[Bridge2] Transaction NOT FOUND on blockchain! This means it was never submitted or was rejected.');
                } else if (txDetails.meta?.err) {
                  console.error('[Bridge2] Transaction FAILED on blockchain:', txDetails.meta.err);
                } else {
                  console.log('[Bridge2] Transaction SUCCESS on blockchain, but confirmation timed out');
                }
              } catch (txError: any) {
                console.warn('[Bridge2] Could not get transaction details after confirmation error:', txError.message);
                // If getTransaction returns null, transaction doesn't exist
                if (txError.message?.includes('not found') || txError.message?.includes('null')) {
                  console.error('[Bridge2] Transaction NOT FOUND on blockchain!');
                }
              }
            } catch (statusError: any) {
              console.warn('[Bridge2] Could not get transaction status after confirmation error:', statusError.message);
            }
            
            // If confirmation times out, check if transaction was successful
            if (confirmError.message?.includes('TransactionExpiredTimeoutError') || 
                confirmError.message?.includes('not confirmed') ||
                confirmError.message?.includes('timeout')) {
              // Transaction may still be processing, return signature anyway
              // User can check transaction status manually
              console.warn('[Bridge2] Transaction confirmation timeout, but may have succeeded:', confirmError.message);
            } else {
              console.error('[Bridge2] Transaction confirmation failed with non-timeout error, but returning signature anyway');
              // Don't throw - return signature so user can check manually
            }
          }
          
          console.log('[Bridge2] solanaSigner.signAndSendTx() returning signature:', signature);
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
      updateLastAction('Creating transfer...', 'pending');
      
      // Use AutomaticCircleBridge protocol directly
      // Get protocol instance and use its transfer method
      let xfer: any;
      let txSignature: string = '';
      try {
        console.log('[Bridge2] Getting AutomaticCircleBridge protocol...');
        const acb = await sendChain.getProtocol('AutomaticCircleBridge');
        console.log('[Bridge2] AutomaticCircleBridge protocol obtained:', {
          acbType: typeof acb,
          acbConstructor: acb?.constructor?.name,
          hasTransfer: typeof acb?.transfer === 'function',
        });
        
        // CRITICAL: Explicitly set domains if they are undefined
        // CCTP domain numbers:
        // Solana Mainnet = 0x00000001 (1)
        // Aptos Mainnet = 0x00000002 (2)
        const SOLANA_DOMAIN = 0x00000001;
        const APTOS_DOMAIN = 0x00000002;
        
        // Try to set domains in ACB config if they are undefined
        if (acb && typeof acb === 'object') {
          if (!(acb as any).config) {
            (acb as any).config = {};
          }
          if (!(acb as any).config.sourceDomain) {
            (acb as any).config.sourceDomain = SOLANA_DOMAIN;
          }
          if (!(acb as any).config.destDomain) {
            (acb as any).config.destDomain = APTOS_DOMAIN;
          }
          
          // Also try setting in chainConfig if it exists
          if ((acb as any).chainConfig) {
            if (!(acb as any).chainConfig.sourceDomain) {
              (acb as any).chainConfig.sourceDomain = SOLANA_DOMAIN;
            }
            if (!(acb as any).chainConfig.destDomain) {
              (acb as any).chainConfig.destDomain = APTOS_DOMAIN;
            }
          }
          
          // Try to set domains in network/chain properties if they exist
          if ((acb as any).network && typeof (acb as any).network === 'object') {
            if (!(acb as any).network.sourceDomain) {
              (acb as any).network.sourceDomain = SOLANA_DOMAIN;
            }
          }
        }
        console.log('[Bridge2] Calling acb.transfer() with params:', {
          sourceAddress: sourceAddress.address,
          destChain: destAddress.chain,
          destAddress: destAddress.address,
          amount: amtUnits.toString(),
          nativeGas: nativeGas.toString(),
          automatic,
        });
        const transferGen = acb.transfer(
          sourceAddress.address,
          { chain: destAddress.chain, address: destAddress.address },
          amtUnits,
          nativeGas,  // nativeGas for destination chain
          automatic,   // automatic mode (true = relayer handles, false = manual)
          undefined   // payload (optional)
        );
        
        // Iterate through generator to get transfer steps and transactions
        let stepCount = 0;
        let lastStep: any = null;
        
        console.log('[Bridge2] Starting iteration over transfer generator...');
        for await (const step of transferGen) {
          stepCount++;
          lastStep = step;
          console.log(`[Bridge2] Processing step ${stepCount}:`, {
            stepType: typeof step,
            stepConstructor: step?.constructor?.name,
            stepKeys: Object.keys(step || {}),
            hasSend: typeof step?.send === 'function',
            hasTx: !!step?.tx,
            hasTransaction: !!step?.transaction,
            hasXfer: !!step?.xfer,
            hasTransfer: !!step?.transfer,
          });
          
          // Try to use step.send() if available (this is the recommended way)
          if (typeof step?.send === 'function') {
            try {
              console.log('[Bridge2] Calling step.send() with solanaSigner...');
              const result = await step.send(solanaSigner);
              console.log('[Bridge2] step.send() result:', {
                resultType: typeof result,
                resultConstructor: result?.constructor?.name,
                resultKeys: result && typeof result === 'object' ? Object.keys(result) : null,
                resultValue: result,
                isString: typeof result === 'string',
                isArray: Array.isArray(result),
              });
              
              // Extract transaction signature from result
              if (result && typeof result === 'object') {
                console.log('[Bridge2] Extracting signature from object:', {
                  txid: result.txid,
                  txHash: result.txHash,
                  signature: result.signature,
                  tx: result.tx,
                  txType: typeof result.tx,
                  txConstructor: result.tx?.constructor?.name,
                });
                txSignature = result.txid || result.txHash || result.signature || result.tx || '';
                if (Array.isArray(result) && result.length > 0) {
                  txSignature = result[0]?.txid || result[0]?.txHash || result[0]?.signature || result[0] || '';
                }
              } else if (typeof result === 'string') {
                txSignature = result;
              }
              
              console.log('[Bridge2] Extracted txSignature:', {
                txSignature,
                length: txSignature?.length,
                isValidBase58: txSignature && /^[1-9A-HJ-NP-Za-km-z]{32,}$/.test(txSignature),
                isString: typeof txSignature === 'string',
              });
              
              if (txSignature) {
                // Check if txSignature is actually a valid signature (not an object or transaction)
                if (typeof txSignature !== 'string' || txSignature.length < 32) {
                  console.error('[Bridge2] WARNING: txSignature is not a valid string signature!', {
                    txSignature,
                    type: typeof txSignature,
                    length: txSignature?.length,
                  });
                } else {
                  setLastTransferTxSignature(txSignature);
                  console.log('[Bridge2] Transaction sent, signature set:', txSignature);
                  console.log('[Bridge2] Transaction URL: https://solscan.io/tx/' + txSignature);
                  updateLastAction(
                    `Transaction sent successfully`,
                    'success',
                    `https://solscan.io/tx/${txSignature}`,
                    'View on Solscan'
                  );
                }
              } else {
                console.warn('[Bridge2] No txSignature extracted from step.send() result');
              }
              
              // Store xfer object from step if available
              if (step.xfer || step.transfer) {
                xfer = step.xfer || step.transfer;
              }
            } catch (sendError: any) {
              console.error('[Bridge2] step.send() failed:', sendError);
              
              // Check if error is about insufficient funds for rent
              if (sendError?.InsufficientFundsForRent || 
                  sendError?.message?.includes('insufficient funds for rent') ||
                  sendError?.message?.includes('InsufficientFundsForRent')) {
                throw new Error(`Transaction failed: Insufficient funds for rent. The transaction requires creating new accounts that need SOL for rent. Please ensure your wallet has enough SOL (at least 0.01 SOL recommended) to cover transaction fees and account rent. Error details: ${JSON.stringify(sendError)}`);
              }
              
              throw new Error(`Failed to send transaction via step.send(): ${sendError.message || JSON.stringify(sendError)}`);
            }
          } else if (step?.tx || step?.transaction) {
            // Fallback: try to handle transaction manually
            // Import Transaction types first
            const { Connection, Transaction, VersionedTransaction } = await import('@solana/web3.js');
            
            // The transaction might be nested: step.transaction.transaction
            let tx = step.tx || step.transaction;
            
            // If tx is an object with a 'transaction' property, extract it
            if (tx && typeof tx === 'object' && !(tx instanceof Transaction) && !(tx instanceof VersionedTransaction) && tx.transaction) {
              tx = tx.transaction;
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
              // Ensure transaction has a recent blockhash
              if (tx instanceof Transaction && !tx.recentBlockhash) {
                const { blockhash } = await connection.getLatestBlockhash('confirmed');
                tx.recentBlockhash = blockhash;
              }
              
              // After setting blockhash, we need to re-sign with internal signers if any
              // Signers might be in step.signers or step.transaction.signers
              const signers = step.signers || (step.transaction && step.transaction.signers) || [];
              if (signers && Array.isArray(signers) && signers.length > 0) {
                for (const signer of signers) {
                  if (signer && signer.secretKey) {
                    const { Keypair } = await import('@solana/web3.js');
                    const keypair = Keypair.fromSecretKey(signer.secretKey);
                    if (tx instanceof Transaction) {
                      tx.partialSign(keypair);
                    } else if (tx instanceof VersionedTransaction) {
                      tx.sign([keypair]);
                    }
                  }
                }
              }
              
              // It's already a proper transaction object, use solanaSigner
              if (solanaSigner && typeof solanaSigner.signAndSendTx === 'function') {
                try {
                  const result = await solanaSigner.signAndSendTx(tx);
                  
                  if (typeof result === 'string') {
                    txSignature = result;
                  } else if (result && typeof result === 'object') {
                    txSignature = (result as any).txid || (result as any).txHash || (result as any).signature || '';
                  }
                  
                  if (txSignature) {
                    setLastTransferTxSignature(txSignature);
                    console.log('[Bridge2] Transaction sent:', txSignature);
                  }
                } catch (sendError: any) {
                  console.error('[Bridge2] solanaSigner.signAndSendTx() failed:', sendError);
                  throw new Error(`Failed to send transaction via solanaSigner.signAndSendTx(): ${sendError.message}`);
                }
              } else if (signTransaction) {
                // Fallback to manual signing
                if (tx instanceof VersionedTransaction) {
                  
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
                    skipPreflight: true,
                    maxRetries: 3,
                  });
                  
                  txSignature = signature;
                  setLastTransferTxSignature(signature);
                  await connection.confirmTransaction(signature, 'confirmed');
                } else if (tx instanceof Transaction) {
                  
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
                    skipPreflight: true,
                    maxRetries: 3,
                  });
                  
                  txSignature = signature;
                  setLastTransferTxSignature(signature);
                  await connection.confirmTransaction(signature, 'confirmed');
                }
              }
            } else {
              // Transaction is a plain object, not a Transaction instance
              // This might be transaction data that needs to be constructed
              // The transaction object might contain a method to get the actual transaction
              // Or it might be a transaction builder that needs to be finalized
              // Check if there's a method to get the transaction
              if (typeof (tx as any)?.build === 'function') {
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
                      console.log('[Bridge2] Transaction sent:', txSignature);
                    }
                  }
                } else {
                  throw new Error(`Transaction.build() returned a non-Transaction object. Type: ${builtTx?.constructor?.name || typeof builtTx}`);
                }
              } else if (typeof (tx as any)?.toTransaction === 'function') {
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
                      console.log('[Bridge2] Transaction sent:', txSignature);
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
            console.log('[Bridge2] Found xfer/transfer in step (no tx or send method):', {
              hasXfer: !!step.xfer,
              hasTransfer: !!step.transfer,
              xferType: step.xfer?.constructor?.name,
              transferType: step.transfer?.constructor?.name,
            });
          } else {
            console.log('[Bridge2] Step has no send(), tx, transaction, xfer, or transfer:', {
              stepKeys: Object.keys(step || {}),
              stepType: typeof step,
              stepConstructor: step?.constructor?.name,
            });
          }
        }
        
        console.log('[Bridge2] Transfer generator iteration complete:', {
          stepCount,
          hasXfer: !!xfer,
          txSignature,
          txSignatureLength: txSignature?.length,
          txSignatureType: typeof txSignature,
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
      
      if (txSignature) {
        updateLastAction(
          `Transfer initiated on Solana`,
          'success',
          `https://solscan.io/tx/${txSignature}`,
          'View transaction on Solscan'
        );
      }
      
      setTransferStatus(`Transfer initiated! Transaction: ${txSignature ? txSignature.slice(0, 8) + '...' + txSignature.slice(-8) : 'pending'}`);
      
      toast({
        title: "Transfer Initiated",
        description: `Your transfer has been initiated. Transaction: ${txSignature ? txSignature.slice(0, 8) + '...' + txSignature.slice(-8) : 'pending'}. The relayer will complete it automatically.${txSignature ? ` View on Solscan: https://solscan.io/tx/${txSignature}` : ''}`,
      });

      // After successful initiation, wait for Solana confirmation, then poll for attestation
      if (txSignature) {
        setTransferStatus('Waiting for Solana transaction confirmation...');
        addAction('Waiting for Solana transaction confirmation...', 'pending');
        
        // Wait for Solana transaction to be finalized
        const waitForSolanaConfirmation = async (): Promise<void> => {
          const { Connection } = await import('@solana/web3.js');
          const connection = solanaConnection || new Connection(
            process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 
            process.env.SOLANA_RPC_URL || 
            'https://mainnet.helius-rpc.com/?api-key=29798653-2d13-4d8a-96ad-df70b015e234',
            'confirmed'
          );

          const maxConfirmationAttempts = 30; // 30 attempts * 2s = 60 seconds max
          const confirmationDelay = 2000; // 2 seconds

          for (let attempt = 1; attempt <= maxConfirmationAttempts; attempt++) {
            try {
              const txStatus = await connection.getSignatureStatus(txSignature);
              
              if (txStatus?.value?.confirmationStatus === 'finalized' || 
                  txStatus?.value?.confirmationStatus === 'confirmed') {
                updateLastAction(
                  'Solana transaction confirmed',
                  'success',
                  `https://solscan.io/tx/${txSignature}`,
                  'View transaction on Solscan'
                );
                return;
              }
              
              if (txStatus?.value?.err) {
                throw new Error(`Transaction failed: ${JSON.stringify(txStatus.value.err)}`);
              }
              
              // Update status
              if (attempt % 5 === 0) {
                updateLastAction(
                  `Waiting for confirmation... (${attempt}/${maxConfirmationAttempts})`,
                  'pending'
                );
              }
            } catch (error: any) {
              if (attempt === maxConfirmationAttempts) {
                throw new Error(`Failed to confirm transaction: ${error.message}`);
              }
            }
            
            await new Promise(resolve => setTimeout(resolve, confirmationDelay));
          }
          
          throw new Error('Transaction confirmation timeout');
        };

        // Poll for attestation with exponential backoff
        const pollForAttestation = async (): Promise<void> => {
          const maxAttempts = 15; // Increased from 12 to 15
          const initialDelay = 10000; // 10 seconds after confirmation (increased from 5)
          const maxDelay = 30000; // Max 30 seconds between attempts
          
          // Wait initial delay after confirmation (Circle needs time to generate attestation)
          console.log(`[Bridge2] Waiting ${initialDelay}ms before first attestation request...`);
          await new Promise(resolve => setTimeout(resolve, initialDelay));
          
          for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            const delay = Math.min(initialDelay * Math.pow(1.5, attempt - 1), maxDelay);
            const attemptStartTime = Date.now();
            
            // Add or update action for this attempt
            if (attempt === 1) {
              addAction(
                `Requesting attestation from Circle... (attempt ${attempt}/${maxAttempts})`,
                'pending',
                `https://iris-api.circle.com/v1/messages/5/${txSignature}`,
                'View attestation request',
                attemptStartTime
              );
            } else {
              updateLastAction(
                `Requesting attestation from Circle... (attempt ${attempt}/${maxAttempts})`,
                'pending',
                `https://iris-api.circle.com/v1/messages/5/${txSignature}`,
                'View attestation request'
              );
            }
            
            try {
              const requestBody = {
                signature: txSignature.trim(),
                sourceDomain: '5', // Solana CCTP V1 domain
                finalRecipient: destinationAddress.trim(),
              };
              
              console.log(`[Bridge2] Calling mint API, attempt ${attempt}/${maxAttempts}:`, {
                signature: requestBody.signature.substring(0, 20) + '...',
                sourceDomain: requestBody.sourceDomain,
                finalRecipient: requestBody.finalRecipient.substring(0, 20) + '...',
              });
              
              const response = await fetch('/api/aptos/mint-cctp', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
              });
              
              const data = await response.json();
              
              if (response.ok) {
                // Success! Attestation received and minting completed
                // Update the "Requesting attestation" action to success
                updateLastAction(
                  'Attestation received and minting completed',
                  'success',
                  `https://iris-api.circle.com/v1/messages/5/${txSignature}`,
                  'View attestation'
                );
                
                console.log('[Bridge2] USDC minted successfully on Aptos', data);
                
                // Add signing action if we have account info
                if (data.data?.accountAddress) {
                  addAction(
                    `Signing transaction with wallet`,
                    'success',
                    `https://explorer.aptoslabs.com/account/${data.data.accountAddress}?network=mainnet`,
                    'View signing wallet on Aptos Explorer'
                  );
                }
                
                // Add recipient wallet action
                const recipientAddress = data.data?.transaction?.finalRecipient || destinationAddress;
                if (recipientAddress) {
                  addAction(
                    `Recipient wallet`,
                    'success',
                    `https://explorer.aptoslabs.com/account/${recipientAddress}?network=mainnet`,
                    'View recipient wallet on Aptos Explorer'
                  );
                }
                
                // Add minting action
                const mintTxHash = data.data?.transaction?.hash;
                if (mintTxHash) {
                  addAction(
                    `USDC minted successfully on Aptos`,
                    'success',
                    `https://explorer.aptoslabs.com/txn/${mintTxHash}?network=mainnet`,
                    'View mint transaction on Aptos Explorer'
                  );
                } else if (data.data?.accountAddress) {
                  addAction(
                    `USDC minted successfully on Aptos`,
                    'success',
                    `https://explorer.aptoslabs.com/account/${data.data.accountAddress}?network=mainnet`,
                    'View destination wallet on Aptos Explorer'
                  );
                } else {
                  addAction(
                    `USDC minted successfully on Aptos`,
                    'success'
                  );
                }
                
                toast({
                  title: "USDC Minted on Aptos",
                  description: `USDC has been automatically minted on Aptos. Account: ${data.data?.accountAddress || 'N/A'}`,
                });
                setTransferStatus(`Transfer complete! USDC minted on Aptos. Transaction: ${txSignature.slice(0, 8)}...${txSignature.slice(-8)}`);
                return; // Success, exit polling
              } else {
                // Check if it's an attestation error (not ready or invalid)
                const errorMessage = data.error?.message || '';
                const isAttestationError = 
                  errorMessage.includes('404') ||
                  errorMessage.includes('not found') ||
                  errorMessage.includes('EINVALID_ATTESTATION') ||
                  errorMessage.includes('EINVALID_ATTESTATION_LENGTH') ||
                  errorMessage.includes('attestation') ||
                  response.status === 404;
                
                // For any attestation-related error, continue polling until max attempts
                if (isAttestationError && attempt < maxAttempts) {
                  // Attestation not ready or invalid, continue polling
                  // Update status to show error but keep as pending for retry
                  console.log(`[Bridge2] Attestation error (${errorMessage}), attempt ${attempt}/${maxAttempts}, waiting ${delay}ms...`);
                  updateLastAction(
                    `Requesting attestation from Circle... (attempt ${attempt}/${maxAttempts}) - ${errorMessage.substring(0, 50)}${errorMessage.length > 50 ? '...' : ''}`,
                    'pending',
                    `https://iris-api.circle.com/v1/messages/5/${txSignature}`,
                    'View attestation request'
                  );
                  await new Promise(resolve => setTimeout(resolve, delay));
                  continue;
                } else if (attempt < maxAttempts) {
                  // Other errors - also continue polling (might be temporary)
                  console.log(`[Bridge2] Error on attempt ${attempt}/${maxAttempts}: ${errorMessage}, retrying...`);
                  updateLastAction(
                    `Requesting attestation from Circle... (attempt ${attempt}/${maxAttempts}) - ${errorMessage.substring(0, 50)}${errorMessage.length > 50 ? '...' : ''}`,
                    'pending',
                    `https://iris-api.circle.com/v1/messages/5/${txSignature}`,
                    'View attestation request'
                  );
                  await new Promise(resolve => setTimeout(resolve, delay));
                  continue;
                } else {
                  // Max attempts reached - update to error status
                  updateLastAction(
                    `Requesting attestation from Circle failed. Max attempts reached: ${errorMessage.substring(0, 80)}${errorMessage.length > 80 ? '...' : ''}`,
                    'error',
                    `https://iris-api.circle.com/v1/messages/5/${txSignature}`,
                    'View attestation request'
                  );
                  throw new Error(data.error?.message || 'Failed to get attestation after all attempts');
                }
              }
            } catch (error: any) {
              // Check if it's a network error, attestation error, or any other error
              const errorMessage = error.message || '';
              const isNetworkError = errorMessage.includes('fetch') || 
                                    errorMessage.includes('network') ||
                                    errorMessage.includes('ECONNREFUSED');
              const isAttestationError = errorMessage.includes('EINVALID_ATTESTATION') ||
                                        errorMessage.includes('attestation');
              
              // For any error (network, attestation, or other), continue polling until max attempts
              if (attempt < maxAttempts) {
                const errorType = isNetworkError ? 'Network error' : 
                                 isAttestationError ? 'Attestation error' : 
                                 'Error';
                console.log(`[Bridge2] ${errorType}, retrying... attempt ${attempt}/${maxAttempts}: ${errorMessage}`);
                updateLastAction(
                  `Requesting attestation from Circle... (attempt ${attempt}/${maxAttempts}) - ${errorType}: ${errorMessage.substring(0, 50)}${errorMessage.length > 50 ? '...' : ''}`,
                  'pending',
                  `https://iris-api.circle.com/v1/messages/5/${txSignature}`,
                  'View attestation request'
                );
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
              }
              
              // Max attempts reached - update to error status and throw
              updateLastAction(
                `Requesting attestation from Circle failed. Max attempts reached: ${errorMessage.substring(0, 80)}${errorMessage.length > 80 ? '...' : ''}`,
                'error',
                `https://iris-api.circle.com/v1/messages/5/${txSignature}`,
                'View attestation request'
              );
              throw error;
            }
          }
          
          throw new Error('Attestation polling timeout - attestation not ready after all attempts');
        };

        // Execute: wait for confirmation, then poll for attestation
        if (destinationAddress) {
          waitForSolanaConfirmation()
            .then(() => {
              setTransferStatus('Solana transaction confirmed. Waiting for Circle attestation...');
              return pollForAttestation();
            })
            .catch((error) => {
              console.error('[Bridge2] Error in confirmation or attestation polling:', error);
              updateLastAction(
                `Error: ${error.message || 'Failed to complete minting'}`,
                'error'
              );
              
              // Add recipient wallet info even on error
              if (destinationAddress) {
                addAction(
                  `Recipient wallet`,
                  'pending',
                  `https://explorer.aptoslabs.com/account/${destinationAddress}?network=mainnet`,
                  'View recipient wallet on Aptos Explorer'
                );
              }
              
              addAction(
                `Minting failed: ${error.message || 'Unknown error'}`,
                'error'
              );
              toast({
                title: "Minting Failed",
                description: error.message || "Failed to automatically mint USDC on Aptos. You can mint manually later.",
                variant: "destructive",
              });
              setTransferStatus(`Transfer initiated! Transaction: ${txSignature.slice(0, 8)}...${txSignature.slice(-8)}. Minting failed, you can mint manually later.`);
            });
        }
        
        // Note: We don't need to save xfer object or fetch attestation here
        // The minting API will handle attestation fetching directly from Circle API
        // We only need txSignature and destinationAddress for the mint API call
        // The polling logic above will handle waiting for attestation and calling the API
      }
      
    } catch (error: any) {
      console.error('[Bridge2] Transfer error:', error);
      setTransferStatus(`Error: ${error.message || 'Unknown error'}`);
      addAction(
        `Transfer failed: ${error.message || 'Unknown error'}`,
        'error'
      );
      
      // Automatically refund SOL from funded signers if transfer failed
      // Only refund signers that were funded in this specific attempt
      if (currentFundedSigners.length > 0) {
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
              
              // Try to confirm, but don't wait too long
              try {
                await Promise.race([
                  connection.confirmTransaction(signature, 'confirmed'),
                  new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000))
                ]);
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
    <div className="w-full h-screen overflow-y-auto bg-gradient-to-br from-gray-50 via-white to-gray-100">
      <div className="w-full min-h-full flex items-start justify-center p-4 md:items-center">
        <div className="w-full max-w-2xl space-y-4 py-4">
          {/* Back to Dashboard button */}
          <div className="flex items-center mb-4">
            <button
              onClick={() => router.push('/')}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </button>
          </div>
          
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
            showSwapButton={false}
            disableAssetSelection={true}
            availableBalance={availableUsdcBalance}
          />

          <ActionLog items={actionLog} />

        </div>
      </div>
    </div>
  );
}

export default function Bridge2Page() {
  return (
    <SolanaWalletProviderWrapper>
      <Suspense fallback={<div>Loading...</div>}>
        <Bridge2PageContent />
      </Suspense>
    </SolanaWalletProviderWrapper>
  );
}
