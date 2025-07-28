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

  public async executeSwap(quoteData: any, walletAddress: string): Promise<PanoraSwapQuoteResponse> {
    try {
      console.log('Executing swap transaction...');
      console.log('Quote data:', quoteData);
      console.log('Wallet address:', walletAddress);

      // Extract transaction payload directly from quote data
      if (quoteData.quotes && quoteData.quotes[0] && quoteData.quotes[0].transactionPayload) {
        const rawPayload = quoteData.quotes[0].transactionPayload;
        console.log('Raw transaction payload from quote:', rawPayload);

        // For now, use the original payload as is
        // The issue might be in our BCS conversion
        console.log('Using original payload without BCS conversion');

        return {
          success: true,
          data: rawPayload
        };
      }

      // Try to get transaction payload using Swap method without private key
      console.log('Trying to get transaction payload using Swap method...');
      
      try {
        const swapRequest = {
          chainId: "1",
          fromTokenAddress: quoteData.fromToken?.address || quoteData.fromTokenAddress,
          toTokenAddress: quoteData.toToken?.address || quoteData.toTokenAddress,
          fromTokenAmount: quoteData.fromTokenAmount,
          toWalletAddress: walletAddress,
          slippagePercentage: quoteData.quotes?.[0]?.slippagePercentage || "2",
          integratorFeeAddress: "0x0000000000000000000000000000000000000000000000000000000000000000",
          integratorFeePercentage: "0",
        };

        console.log('Swap request:', swapRequest);
        
        // Call Swap method but catch the error to extract the transaction payload
        try {
          await this.client.Swap(swapRequest);
        } catch (swapError: any) {
          console.log('Swap error (expected):', swapError);
          
          // Check if the error contains transaction payload
          if (swapError.transactionPayload) {
            console.log('Found transaction payload in error:', swapError.transactionPayload);
            return {
              success: true,
              data: swapError.transactionPayload
            };
          }
        }

        // Fallback to buildSwapTransaction
        console.log('Falling back to buildSwapTransaction...');
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
        console.error('Error getting transaction payload:', error);
        throw error;
      }
    } catch (error: any) {
      console.error('Panora execute swap error:', error);
      return {
        success: false,
        error: error.message || 'Failed to execute swap'
      };
    }
  }

  private convertToBCSFormat(rawPayload: any): any {
    try {
      console.log('Converting payload to BCS format...');
      
      // Create a new payload with the same structure but BCS-formatted arguments
      const bcsPayload = {
        function: rawPayload.function,
        type_arguments: rawPayload.type_arguments,
        arguments: this.convertArgumentsToBCS(rawPayload.arguments)
      };

      return bcsPayload;
    } catch (error: any) {
      console.error('BCS conversion error:', error);
      // Fallback to original payload if conversion fails
      return rawPayload;
    }
  }

  private convertArgumentsToBCS(args: any[]): any[] {
    return args.map((arg, index) => {
      // Special handling for specific argument positions
      if (index === 0) {
        // Argument 0 is signer - should be null for script calls
        return null;
      }
      
      if (index === 1) {
        // Argument 1 is signer_cap - should be zero address
        return "0x0000000000000000000000000000000000000000000000000000000000000000";
      }
      
      if (arg === null) {
        return null;
      }
      
      if (typeof arg === 'string') {
        if (arg.startsWith('0x')) {
          // Keep hex strings as is for addresses and other hex values
          return arg;
        } else {
          // Convert regular strings to BCS format
          const bytes = this.stringToBytes(arg);
          const byteObj: any = {};
          bytes.forEach((byte, i) => {
            byteObj[i] = byte;
          });
          return { value: { value: byteObj } };
        }
      }
      
      if (typeof arg === 'number') {
        // Convert numbers to BCS format
        const bytes = this.numberToBytes(arg);
        const byteObj: any = {};
        bytes.forEach((byte, i) => {
          byteObj[i] = byte;
        });
        return { value: { value: byteObj } };
      }
      
      if (Array.isArray(arg)) {
        // Keep arrays as is for now - they might be complex structures
        return arg;
      }
      
      // For other types, return as is
      return arg;
    });
  }

  private hexToBytes(hex: string): number[] {
    const bytes = [];
    for (let i = 2; i < hex.length; i += 2) {
      bytes.push(parseInt(hex.substr(i, 2), 16));
    }
    return bytes;
  }

  private stringToBytes(str: string): number[] {
    const bytes = [];
    for (let i = 0; i < str.length; i++) {
      bytes.push(str.charCodeAt(i));
    }
    return bytes;
  }

  private numberToBytes(num: number): number[] {
    const bytes = [];
    for (let i = 0; i < 8; i++) {
      bytes.push((num >> (i * 8)) & 0xFF);
    }
    return bytes;
  }

  private convertArrayToBCS(arr: any[]): any {
    // For now, return a simple BCS array format
    // This is a simplified version - real BCS arrays are more complex
    const elements = arr.map((item, index) => {
      if (typeof item === 'number') {
        return { value: { value: { "0": item } } };
      }
      if (typeof item === 'string') {
        return { value: { value: { "0": item } } };
      }
      if (Array.isArray(item)) {
        return this.convertArrayToBCS(item);
      }
      return item;
    });
    
    return { value: { value: elements } };
  }
}