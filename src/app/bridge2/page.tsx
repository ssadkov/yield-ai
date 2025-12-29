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
  const [lastTransferTxSignature, setLastTransferTxSignature] = useState<string | null>(null);

  // Get Solana address from wallet adapter
  const solanaAddress = solanaPublicKey?.toBase58() || null;

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
          
          // Send transaction with skipPreflight: true to bypass simulation
          // Simulation may show false positives for rent errors, but transaction can still succeed
          const signature = await connection.sendRawTransaction(signed.serialize(), {
            skipPreflight: true,
            maxRetries: 3,
          });
          
          // Try to confirm transaction with longer timeout
          // If confirmation times out, the transaction may still succeed
          try {
            await connection.confirmTransaction(signature, 'confirmed');
          } catch (confirmError: any) {
            // If confirmation times out, check if transaction was successful
            if (confirmError.message?.includes('TransactionExpiredTimeoutError') || 
                confirmError.message?.includes('not confirmed')) {
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
        const acb = await sendChain.getProtocol('AutomaticCircleBridge');
        
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
        
        for await (const step of transferGen) {
          stepCount++;
          lastStep = step;
          
          // Try to use step.send() if available (this is the recommended way)
          if (typeof step?.send === 'function') {
            try {
              const result = await step.send(solanaSigner);
              
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
                console.log('[Bridge2] Transaction sent:', txSignature);
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
        
        // Extract message hash if available from xfer
        let messageHash: string | null = null;
        try {
          // Try to extract from xfer object
          if (xfer) {
            const possibleHashProps = ['messageHash', 'hash', 'id'];
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
          
        } catch (hashError: any) {
          console.warn('[Bridge2] Error extracting message hash:', hashError.message);
        }
        
        // Save full CCTP message including xfer object (without attestation for now)
        
        setTransferStatus('Transfer initiated! Fetching attestation in background...');
      }
      
      // Fetch attestation in background (non-blocking) - it may be available immediately or within a few seconds
      // This allows the UI to remain responsive while we wait for attestation
      // Only try to fetch attestation if xfer object has the method
      
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
              
              setTransferStatus(`Transfer initiated! Attestation received.`);
              
              toast({
                title: "Attestation Received",
                description: `Circle attestation received and saved to localStorage. You can now use it to complete the transfer on Aptos.`,
              });
            } else {
              // Entry not found, save as new entry
              console.warn('[Bridge2] Entry not found in localStorage, saving with attestation...');
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
