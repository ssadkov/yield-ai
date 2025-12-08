import { wormhole, CircleTransfer, toNative, type Signer, type UnsignedTransaction, type SignedTx, type TxHash, type ChainAddress } from "@wormhole-foundation/sdk";
import solana from "@wormhole-foundation/sdk/solana";
import aptos from "@wormhole-foundation/sdk/aptos";
// Import CCTP protocol implementations for Solana and Aptos
import "@wormhole-foundation/sdk-solana-cctp";
import "@wormhole-foundation/sdk-aptos-cctp";
import { Connection, PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import { getSolanaWalletAddress } from "@/lib/wallet/getSolanaWalletAddress";
import type { AdapterWallet } from "@aptos-labs/wallet-adapter-core";

// USDC token addresses
// For CCTP, we use native USDC on both chains
// Solana: Circle's native USDC mint
const USDC_SOLANA = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
// Aptos: Native Circle USDC (not bridged/lzUSDC)
// Reference: https://www.circle.com/blog/aptos-migration-guide
const USDC_APTOS_NATIVE = "0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b";

export interface BridgeQuote {
  amount: string;
  estimatedTime: string;
  fees: {
    source: string; // SOL fee
    destination?: string; // APT fee (if manual redemption)
  };
}

export interface BridgeStatus {
  status: "pending" | "completed" | "failed";
  sourceTxHash?: string;
  destinationTxHash?: string;
  messageId?: string;
  error?: string;
}

export interface BridgeRequest {
  amount: string; // Amount in USDC (with decimals)
  fromAddress: string; // Solana address
  toAddress: string; // Aptos address
  wallet: AdapterWallet | null;
}

export class WormholeBridgeService {
  private static instance: WormholeBridgeService;
  private wh: Awaited<ReturnType<typeof wormhole>> | null = null;
  private solanaConnection: Connection | null = null;

  private constructor() {
    // Initialize Solana connection
    // Try to use custom RPC first, then fallback to alternative public RPCs
    const endpoint =
      process.env.SOLANA_RPC_URL ??
      process.env.NEXT_PUBLIC_SOLANA_RPC_URL ??
      "https://rpc.ankr.com/solana"; // More reliable public RPC

    this.solanaConnection = new Connection(endpoint, "confirmed");
    console.log('[WormholeBridge] Solana RPC endpoint:', endpoint);
  }

  public static getInstance(): WormholeBridgeService {
    if (!WormholeBridgeService.instance) {
      WormholeBridgeService.instance = new WormholeBridgeService();
    }
    return WormholeBridgeService.instance;
  }

  /**
   * Initialize Wormhole SDK
   * According to: https://wormhole.com/docs/tools/typescript-sdk/get-started/
   */
  private async initializeWormhole(): Promise<void> {
    if (this.wh) {
      return;
    }

    try {
      // Initialize Wormhole SDK with mainnet configuration
      // Using the correct API from documentation
      const network = "Mainnet";
      this.wh = await wormhole(network, [solana, aptos]);
      
      // Note: RPC configuration is handled by the SDK automatically
      // Custom RPCs can be configured if needed, but for now using defaults
      console.log('[WormholeBridge] SDK initialized successfully');
    } catch (error) {
      console.error("Failed to initialize Wormhole:", error);
      throw new Error("Failed to initialize Wormhole SDK");
    }
  }

  /**
   * Get supported chain pairs for CCTP
   */
  public getSupportedChains(): { from: string; to: string }[] {
    return [
      { from: "Solana", to: "Aptos" },
      { from: "Aptos", to: "Solana" },
    ];
  }

  /**
   * Get bridge quote/estimate
   */
  public async getBridgeQuote(
    amount: string,
    fromChain: string,
    toChain: string
  ): Promise<BridgeQuote> {
    // For CCTP, there are no bridge fees, only gas fees
    return {
      amount,
      estimatedTime: "2-5 minutes",
      fees: {
        source: "~0.000005 SOL", // Approximate Solana transaction fee
        destination: "~0.0001 APT", // Approximate Aptos transaction fee (if manual)
      },
    };
  }

  /**
   * Derive Aptos address from Solana address
   */
  public async getAptosAddressFromSolana(
    solanaAddress: string,
    wallet: AdapterWallet | null
  ): Promise<string | null> {
    // Use existing derivation if wallet is connected
    if (wallet) {
      const derivedAddress = getSolanaWalletAddress(wallet);
      if (derivedAddress === solanaAddress) {
        // Get Aptos address from wallet
        const maybeDerivedWallet = wallet as unknown as {
          account?: { address?: { toString: () => string } };
        };
        return maybeDerivedWallet.account?.address?.toString() || null;
      }
    }

    // TODO: Implement address derivation logic if needed
    // For now, return null and let the user provide the Aptos address
    return null;
  }

  /**
   * Create Wormhole Signer from Solana wallet adapter
   * Implements the Signer interface required by Wormhole SDK
   */
  private createSolanaSigner(phantom: any, publicKey: PublicKey): Signer<"Solana"> {
    if (!this.solanaConnection) {
      throw new Error("Solana connection not initialized");
    }

    return {
      chain: () => "Solana" as const,
      address: async () => {
        // Create ChainAddress using toNative
        if (!this.wh) {
          throw new Error("Wormhole SDK not initialized");
        }
        const nativeAddress = toNative("Solana", publicKey.toBase58());
        return {
          chain: "Solana" as const,
          address: nativeAddress,
        };
      },
      signAndSend: async (txs: UnsignedTransaction<"Solana">[]): Promise<TxHash[]> => {
        const txids: TxHash[] = [];
        const connection = this.solanaConnection!;

        for (const unsigned of txs) {
          try {
            // Get latest blockhash
            const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");

            // Convert UnsignedTransaction to Solana Transaction
            let transaction: Transaction | VersionedTransaction;

            if (unsigned.transaction instanceof Transaction) {
              transaction = unsigned.transaction;
            } else if (unsigned.transaction instanceof VersionedTransaction) {
              transaction = unsigned.transaction;
            } else {
              // If it's a serialized transaction, deserialize it
              const txBytes = unsigned.transaction as Uint8Array;
              try {
                transaction = VersionedTransaction.deserialize(txBytes);
              } catch {
                transaction = Transaction.from(txBytes);
              }
            }

            // Set fee payer and recent blockhash for legacy transactions
            if (transaction instanceof Transaction) {
              transaction.feePayer = publicKey;
              transaction.recentBlockhash = blockhash;
            }

            // Sign transaction with Phantom wallet
            let signed: Transaction | VersionedTransaction;
            if (transaction instanceof VersionedTransaction) {
              signed = await phantom.signTransaction(transaction);
            } else {
              signed = await phantom.signTransaction(transaction);
            }

            // Send transaction
            const signature = await connection.sendRawTransaction(
              signed.serialize(),
              { skipPreflight: false, maxRetries: 3 }
            );

            // Wait for confirmation
            await connection.confirmTransaction(
              { signature, blockhash, lastValidBlockHeight },
              "confirmed"
            );

            txids.push(signature);
          } catch (error: any) {
            console.error('[WormholeBridge] Error signing/sending transaction:', error);
            throw new Error(`Failed to sign and send transaction: ${error.message}`);
          }
        }

        return txids;
      },
    };
  }

  /**
   * Convert amount string to BigInt in base units (6 decimals for USDC)
   * Example: "1.5" -> 1500000n
   */
  private parseUSDCAmount(amount: string): bigint {
    const decimals = 6; // USDC has 6 decimals
    const [intPart, fracPartRaw] = amount.split(".");
    const fracPart = (fracPartRaw ?? "").padEnd(decimals, "0").slice(0, decimals);
    const amountBigInt = BigInt(intPart + fracPart);

    if (amountBigInt <= 0n) {
      throw new Error("Amount must be greater than 0");
    }

    return amountBigInt;
  }

  /**
   * Initiate bridge transfer from Solana to Aptos using CCTP
   * Reference: https://wormhole-foundation.github.io/wormhole-sdk-ts/
   */
  public async initiateBridge(request: BridgeRequest): Promise<{
    success: boolean;
    txHash?: string;
    messageId?: string;
    error?: string;
  }> {
    try {
      await this.initializeWormhole();

      if (!this.wh) {
        throw new Error("Wormhole SDK not initialized");
      }

      // Get Solana wallet (Phantom, Backpack, etc.)
      if (typeof window === 'undefined') {
        throw new Error("Window not available");
      }

      const phantom = (window as any).solana;
      if (!phantom || !phantom.isPhantom) {
        throw new Error("Phantom wallet not detected");
      }

      if (!phantom.isConnected) {
        await phantom.connect();
      }

      const publicKey = phantom.publicKey;
      if (!publicKey) {
        throw new Error("Solana wallet not connected");
      }

      const solanaPublicKey = new PublicKey(publicKey.toString());

      // Validate that the fromAddress matches the connected wallet
      if (solanaPublicKey.toBase58() !== request.fromAddress) {
        throw new Error("From address does not match connected wallet");
      }

      // Convert amount to base units (6 decimals for USDC)
      const amountBigInt = this.parseUSDCAmount(request.amount);
      console.log('[WormholeBridge] Amount:', {
        input: request.amount,
        baseUnits: amountBigInt.toString(),
      });

      // Create ChainAddress objects using toNative function
      // Reference: SDK uses toNative(chain, address) to create NativeAddress
      // Then ChainAddress is { chain, address: NativeAddress }
      const fromNativeAddress = toNative("Solana", request.fromAddress);
      const toNativeAddress = toNative("Aptos", request.toAddress);
      
      const fromChainAddress: ChainAddress = {
        chain: "Solana",
        address: fromNativeAddress,
      };
      const toChainAddress: ChainAddress = {
        chain: "Aptos",
        address: toNativeAddress,
      };

      console.log('[WormholeBridge] Creating CCTP transfer:', {
        amount: amountBigInt.toString(),
        from: fromChainAddress,
        to: toChainAddress,
      });

      // Create CCTP transfer using wh.circleTransfer()
      // This is the correct API - no need to construct CircleTransfer manually
      if (!this.wh.circleTransfer) {
        throw new Error('circleTransfer method not available. CCTP may not be supported for Solana → Aptos.');
      }

      const transfer = await this.wh.circleTransfer(
        amountBigInt,
        fromChainAddress,
        toChainAddress,
        true // automatic delivery
      );

      console.log('[WormholeBridge] CCTP transfer created successfully');

      // Create Wormhole Signer from Solana wallet
      const signer = this.createSolanaSigner(phantom, solanaPublicKey);

      // Initiate transfer on Solana
      console.log('[WormholeBridge] Initiating transfer...');
      const txids = await transfer.initiateTransfer(signer);

      // Get the transaction hash (first one if multiple)
      const tx = Array.isArray(txids) ? txids[0] : txids;

      console.log('[WormholeBridge] Transfer initiated successfully:', tx);

      return {
        success: true,
        txHash: tx,
        messageId: undefined, // Will be available after attestation
      };
    } catch (error: any) {
      console.error("[WormholeBridge] Bridge initiation error:", error);
      return {
        success: false,
        error: error.message || "Failed to initiate bridge transfer",
      };
    }
  }

  /**
   * Check bridge transfer status
   * Uses CircleTransfer.from() to recover transfer and check status
   */
  public async checkBridgeStatus(
    txHash: string,
    messageId?: string
  ): Promise<BridgeStatus> {
    try {
      await this.initializeWormhole();

      if (!this.wh) {
        throw new Error("Wormhole SDK not initialized");
      }

      // Recover transfer from transaction hash
      // Reference: https://wormhole-foundation.github.io/wormhole-sdk-ts/
      const transfer = await CircleTransfer.from(this.wh, txHash);

      // Check if transfer is complete (for automatic transfers)
      // For manual transfers, you'd need to check attestation and completeTransfer
      // For now, we'll check if the source transaction exists and is confirmed
      if (this.solanaConnection) {
        try {
          const txStatus = await this.solanaConnection.getSignatureStatus(txHash);
          if (txStatus.value?.err) {
            return {
              status: "failed",
              sourceTxHash: txHash,
              error: `Transaction failed: ${JSON.stringify(txStatus.value.err)}`,
            };
          }

          if (txStatus.value?.confirmationStatus === "confirmed" || txStatus.value?.confirmationStatus === "finalized") {
            // For automatic transfers, the transfer should complete automatically
            // We can't easily check destination status without more complex logic
            return {
              status: "pending", // Still pending until destination confirms
              sourceTxHash: txHash,
            };
          }

          return {
            status: "pending",
            sourceTxHash: txHash,
          };
        } catch (error: any) {
          console.error('[WormholeBridge] Error checking transaction status:', error);
          return {
            status: "pending",
            sourceTxHash: txHash,
          };
        }
      }

      return {
        status: "pending",
        sourceTxHash: txHash,
      };
    } catch (error: any) {
      console.error('[WormholeBridge] Error checking bridge status:', error);
      return {
        status: "failed",
        error: error.message || "Failed to check bridge status",
      };
    }
  }

  /**
   * Get Solana USDC balance
   */
  public async getSolanaUSDCBalance(address: string): Promise<string> {
    const publicKey = new PublicKey(address);
    const usdcMint = new PublicKey(USDC_SOLANA);
    
    // List of alternative RPC endpoints to try
    const rpcEndpoints = [
      this.solanaConnection?.rpcEndpoint,
      process.env.SOLANA_RPC_URL,
      process.env.NEXT_PUBLIC_SOLANA_RPC_URL,
      "https://rpc.ankr.com/solana",
      "https://solana-api.projectserum.com",
      "https://api.mainnet-beta.solana.com",
    ].filter(Boolean) as string[];

    for (const endpoint of rpcEndpoints) {
      try {
        const connection = new Connection(endpoint, "confirmed");
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
          publicKey,
          { mint: usdcMint }
        );

        if (tokenAccounts.value.length === 0) {
          return "0";
        }

        const balance = tokenAccounts.value[0].account.data.parsed.info.tokenAmount
          .uiAmountString;
        console.log('[WormholeBridge] USDC balance loaded from', endpoint, ':', balance);
        return balance || "0";
      } catch (error: any) {
        console.warn(`[WormholeBridge] Failed to get balance from ${endpoint}:`, error.message);
        // Continue to next endpoint
        continue;
      }
    }

    // If all endpoints failed, return 0
    console.error("[WormholeBridge] All RPC endpoints failed for USDC balance");
    return "0";
  }
}

