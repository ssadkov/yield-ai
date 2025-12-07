import { wormhole, CircleTransfer } from "@wormhole-foundation/sdk";
import solana from "@wormhole-foundation/sdk/solana";
import aptos from "@wormhole-foundation/sdk/aptos";
import { getSolanaWalletSigner } from "@/lib/wallet/getSolanaWalletSigner";
import { Connection, PublicKey } from "@solana/web3.js";
import { getSolanaWalletAddress } from "@/lib/wallet/getSolanaWalletAddress";
import type { AdapterWallet } from "@aptos-labs/wallet-adapter-core";

// USDC token addresses
const USDC_SOLANA = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const USDC_APTOS = "0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::USDC";

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
    const endpoint =
      process.env.SOLANA_RPC_URL ??
      process.env.NEXT_PUBLIC_SOLANA_RPC_URL ??
      "https://api.mainnet-beta.solana.com";

    this.solanaConnection = new Connection(endpoint, "confirmed");
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
      
      // Configure custom RPC endpoints if provided
      const solanaChain = this.wh.getChain("Solana");
      if (this.solanaConnection?.rpcEndpoint) {
        solanaChain.config.rpc = this.solanaConnection.rpcEndpoint;
      }
      
      const aptosChain = this.wh.getChain("Aptos");
      const aptosRpc = process.env.APTOS_RPC_URL || process.env.NEXT_PUBLIC_APTOS_RPC_URL;
      if (aptosRpc) {
        aptosChain.config.rpc = aptosRpc;
      }
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
   * Initiate bridge transfer from Solana to Aptos
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

      // Get Solana wallet signer
      const signer = await getSolanaWalletSigner();
      if (!signer) {
        throw new Error("Solana wallet not connected");
      }

      // Validate amount
      const amountBigInt = BigInt(request.amount);
      if (amountBigInt <= 0n) {
        throw new Error("Invalid amount");
      }

      // Get chain contexts
      const solanaChain = this.wh.getChain("Solana");
      const aptosChain = this.wh.getChain("Aptos");

      // Create CircleTransfer for CCTP (native USDC transfers)
      // Reference: https://wormhole.com/docs/products/cctp-bridge/
      const transfer = new CircleTransfer(
        this.wh,
        {
          source: solanaChain,
          destination: aptosChain,
          token: USDC_SOLANA,
          amount: amountBigInt,
          from: new PublicKey(request.fromAddress),
          to: request.toAddress,
        }
      );

      // Initiate transfer on Solana
      const txids = await transfer.initiate(signer);
      
      // Get the transaction hash (first one if multiple)
      const tx = Array.isArray(txids) ? txids[0] : txids;

      return {
        success: true,
        txHash: tx,
        messageId: undefined, // Will be available after VAA is generated
      };
    } catch (error: any) {
      console.error("Bridge initiation error:", error);
      return {
        success: false,
        error: error.message || "Failed to initiate bridge transfer",
      };
    }
  }

  /**
   * Check bridge transfer status
   */
  public async checkBridgeStatus(
    txHash: string,
    messageId?: string
  ): Promise<BridgeStatus> {
    try {
      // TODO: Implement status checking via Wormhole API or on-chain queries
      // For now, return pending status
      return {
        status: "pending",
        sourceTxHash: txHash,
      };
    } catch (error: any) {
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
    try {
      if (!this.solanaConnection) {
        throw new Error("Solana connection not initialized");
      }

      const publicKey = new PublicKey(address);
      const tokenAccounts = await this.solanaConnection.getParsedTokenAccountsByOwner(
        publicKey,
        { mint: new PublicKey(USDC_SOLANA) }
      );

      if (tokenAccounts.value.length === 0) {
        return "0";
      }

      const balance = tokenAccounts.value[0].account.data.parsed.info.tokenAmount
        .uiAmountString;
      return balance || "0";
    } catch (error) {
      console.error("Error getting Solana USDC balance:", error);
      return "0";
    }
  }
}

