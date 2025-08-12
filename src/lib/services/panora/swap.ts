import Panora from "@panoraexchange/swap-sdk";
import { getProtocolByName } from "@/lib/protocols/getProtocolsList";

export interface PanoraSwapQuoteRequest {
  fromToken: string;
  toToken: string;
  amount: string;
  slippage: number;
  toWalletAddress?: string;
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

  private getPanoraConfig() {
    const panoraProtocol = getProtocolByName("Panora");
    return panoraProtocol?.panoraConfig;
  }

  public async getSwapQuote(request: PanoraSwapQuoteRequest): Promise<PanoraSwapQuoteResponse> {
    try {
      console.log('Getting quote with params:', request);
      
      const panoraConfig = this.getPanoraConfig();
      
      // Ensure slippage is reasonable (minimum 0.5%, maximum 10%)
      const slippage = Math.max(0.5, Math.min(10, request.slippage));
      
      // Convert to the format expected by the old API
      const quoteRequest = {
        chainId: "1",
        fromTokenAddress: request.fromToken,
        toTokenAddress: request.toToken,
        fromTokenAmount: request.amount,
        toWalletAddress: request.toWalletAddress || "0x0000000000000000000000000000000000000000000000000000000000000000",
        slippagePercentage: slippage.toString(),
        getTransactionData: "transactionPayload",
        integratorFeeAddress: panoraConfig?.integratorFeeAddress || "0x0000000000000000000000000000000000000000000000000000000000000000",
        integratorFeePercentage: panoraConfig?.integratorFeePercentage || "0"
      };

      console.log('Quote request:', quoteRequest);

      const response = await this.client.SwapQuote(quoteRequest);
      console.log('Quote received:', response);

      // Validate quote response
      if (!response || !response.quotes || response.quotes.length === 0) {
        return {
          success: false,
          error: 'Invalid quote response from Panora'
        };
      }

      const quote = response.quotes[0];
      console.log('Quote details:', {
        toTokenAmount: quote.toTokenAmount,
        minToTokenAmount: quote.minToTokenAmount,
        slippagePercentage: quote.slippagePercentage,
        priceImpact: quote.priceImpact
      });

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

      const panoraConfig = this.getPanoraConfig();

      // Extract transaction payload directly from quote data
      if (quoteData.quotes && quoteData.quotes[0] && quoteData.quotes[0].transactionPayload) {
        const rawPayload = quoteData.quotes[0].transactionPayload;
        console.log('Raw transaction payload from quote:', rawPayload);

        // Validate payload structure
        if (!rawPayload.function || !rawPayload.type_arguments || !rawPayload.arguments) {
          console.error('Invalid payload structure:', rawPayload);
          return {
            success: false,
            error: 'Invalid transaction payload structure'
          };
        }

        // Log key payload information for debugging
        console.log('Payload function:', rawPayload.function);
        console.log('Payload type_arguments count:', rawPayload.type_arguments.length);
        console.log('Payload arguments count:', rawPayload.arguments.length);
        console.log('Min to token amount from quote:', quoteData.quotes[0].minToTokenAmount);
        console.log('To token amount from quote:', quoteData.quotes[0].toTokenAmount);
        console.log('Slippage percentage from quote:', quoteData.quotes[0].slippagePercentage);
        
        // Validate minToTokenAmount is present and reasonable
        if (!quoteData.quotes[0].minToTokenAmount || parseFloat(quoteData.quotes[0].minToTokenAmount) <= 0) {
          console.error('Invalid minToTokenAmount:', quoteData.quotes[0].minToTokenAmount);
          return {
            success: false,
            error: 'Invalid minimum output amount in quote'
          };
        }

        // Return payload AS-IS to preserve exact type arguments and argument encoding required by Panora
        return {
          success: true,
          data: rawPayload
        };
      }

      // Fallback: Try to get transaction payload using Swap method
      console.log('No payload in quote, trying Swap method...');
      
      try {
        const swapRequest = {
          chainId: "1",
          fromTokenAddress: quoteData.fromToken?.address || quoteData.fromTokenAddress,
          toTokenAddress: quoteData.toToken?.address || quoteData.toTokenAddress,
          fromTokenAmount: quoteData.fromTokenAmount,
          toWalletAddress: walletAddress,
          slippagePercentage: quoteData.quotes?.[0]?.slippagePercentage || "2",
          integratorFeeAddress: panoraConfig?.integratorFeeAddress || "0x0000000000000000000000000000000000000000000000000000000000000000",
          integratorFeePercentage: panoraConfig?.integratorFeePercentage || "0",
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

        return {
          success: false,
          error: 'Failed to generate transaction payload'
        };
      } catch (error: any) {
        console.error('Error getting transaction payload:', error);
        return {
          success: false,
          error: error.message || 'Failed to execute swap'
        };
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