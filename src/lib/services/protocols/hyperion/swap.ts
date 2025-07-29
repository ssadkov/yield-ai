import { Network } from "@aptos-labs/ts-sdk";
import { initHyperionSDK } from '@hyperionxyz/sdk';

export class HyperionSwapService {
  private static instance: HyperionSwapService;
  private sdk: ReturnType<typeof initHyperionSDK>;

  private constructor() {
    this.sdk = initHyperionSDK({
      network: Network.MAINNET,
      APTOS_API_KEY: process.env.APTOS_API_KEY || '',
    });
  }

  static getInstance(): HyperionSwapService {
    if (!HyperionSwapService.instance) {
      HyperionSwapService.instance = new HyperionSwapService();
    }
    return HyperionSwapService.instance;
  }

  async getQuoteAndPath(params: { amount: number; from: string; to: string; safeMode?: boolean }) {
    try {
      // amount — это fromTokenAmount в минимальных единицах (например, 10^decimals)
      const result = await this.sdk.Swap.estToAmount({
        amount: params.amount,
        from: params.from,
        to: params.to,
        safeMode: params.safeMode ?? false,
      });
      return result;
    } catch (error) {
      console.error('Hyperion getQuoteAndPath error:', error);
      throw error;
    }
  }

  async estFromAmount(params: { amount: number; from: string; to: string; safeMode?: boolean }) {
    try {
      const result = await this.sdk.Swap.estFromAmount({
        amount: params.amount,
        from: params.from,
        to: params.to,
        safeMode: params.safeMode ?? false,
      });
      return result;
    } catch (error) {
      console.error('Hyperion estFromAmount error:', error);
      throw error;
    }
  }

  async estToAmount(params: { amount: number; from: string; to: string; safeMode?: boolean }) {
    try {
      const result = await this.sdk.Swap.estToAmount({
        amount: params.amount,
        from: params.from,
        to: params.to,
        safeMode: params.safeMode ?? false,
      });
      return result;
    } catch (error) {
      console.error('Hyperion estToAmount error:', error);
      throw error;
    }
  }

  async getSwapPayload(params: { 
    currencyA: string; 
    currencyB: string; 
    currencyAAmount: string; 
    currencyBAmount: string; 
    slippage: number; 
    poolRoute: string[]; 
    recipient: string;
    typeArgs?: string[];
  }) {
    try {
      const payload = await this.sdk.Swap.swapTransactionPayload({
        currencyA: params.currencyA,
        currencyB: params.currencyB,
        currencyAAmount: params.currencyAAmount,
        currencyBAmount: params.currencyBAmount,
        slippage: params.slippage,
        poolRoute: params.poolRoute,
        recipient: params.recipient,
      });
      return payload;
    } catch (error) {
      console.error('Hyperion getSwapPayload error:', error);
      throw error;
    }
  }
} 