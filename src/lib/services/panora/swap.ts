import Panora from "@panoraexchange/swap-sdk";

export interface PanoraSwapQuoteRequest {
  fromToken: string;
  toToken: string;
  amount: string;
  slippage: number;
}

export interface PanoraSwapQuoteResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export class PanoraSwapService {
  private static instance: PanoraSwapService;
  private client: any;

  private constructor() {
    this.client = new Panora({
      apiKey: process.env.PANORA_API_KEY || "",
      rpcUrl: process.env.APTOS_RPC_URL || "https://fullnode.mainnet.aptoslabs.com"
    });
  }

  public static getInstance(): PanoraSwapService {
    if (!PanoraSwapService.instance) {
      PanoraSwapService.instance = new PanoraSwapService();
    }
    return PanoraSwapService.instance;
  }

  public async getSwapQuote(request: PanoraSwapQuoteRequest): Promise<PanoraSwapQuoteResponse> {
    try {
      console.log('Getting quote with params:', request);
      
      // Convert to the format expected by the old API
      const quoteRequest = {
        chainId: "1",
        fromTokenAddress: request.fromToken,
        toTokenAddress: request.toToken,
        fromTokenAmount: request.amount,
        toWalletAddress: "0x0000000000000000000000000000000000000000000000000000000000000000", // placeholder
        slippagePercentage: request.slippage.toString(),
        getTransactionData: "transactionPayload"
      };

      const response = await this.client.SwapQuote(quoteRequest);
      console.log('Quote received:', response);

      return {
        success: true,
        data: response
      };
    } catch (error: any) {
      console.error('Panora quote error:', error);
      return {
        success: false,
        error: error.message || 'Failed to get quote'
      };
    }
  }

  public async buildSwapTransaction(quoteData: any, walletAddress: string): Promise<PanoraSwapQuoteResponse> {
    try {
      console.log('Building swap transaction...');
      console.log('Quote data:', quoteData);
      console.log('Wallet address:', walletAddress);

      // Extract transaction payload directly from quote data
      if (quoteData.quotes && quoteData.quotes[0] && quoteData.quotes[0].transactionPayload) {
        const txPayload = quoteData.quotes[0].transactionPayload;
        console.log('Using transaction payload from quote:', txPayload);

        return {
          success: true,
          data: txPayload
        };
      }

      // Fallback to SDK method if no payload in quote
      console.log('No transaction payload in quote, using SDK...');
      const txPayload = await this.client.buildSwapTransaction({
        sender: walletAddress,
        route: quoteData.route,
      });

      console.log('Transaction payload from SDK:', txPayload);

      return {
        success: true,
        data: txPayload
      };
    } catch (error: any) {
      console.error('Panora build transaction error:', error);
      return {
        success: false,
        error: error.message || 'Failed to build transaction'
      };
    }
  }
} 