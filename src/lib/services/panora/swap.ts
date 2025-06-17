import Panora, { PanoraConfig } from "@panoraexchange/swap-sdk";

export interface SwapParams {
  chainId: string;
  fromTokenAddress: string;
  toTokenAddress: string;
  fromTokenAmount: string;
  toWalletAddress: string;
  slippagePercentage?: string;
  integratorFeeAddress?: string;
  integratorFeePercentage?: string;
}

export class PanoraSwapService {
  private static instance: PanoraSwapService;
  private client: Panora;

  private constructor() {
    const config: PanoraConfig = {
      apiKey: process.env.PANORA_API_KEY || '',
      rpcUrl: process.env.PANORA_RPC_URL || '',
    };
    this.client = new Panora(config);
  }

  static getInstance(): PanoraSwapService {
    if (!PanoraSwapService.instance) {
      PanoraSwapService.instance = new PanoraSwapService();
    }
    return PanoraSwapService.instance;
  }

  private safeAddr(addr?: string, label?: string): `0x${string}` {
    if (addr && addr.startsWith('0x') && addr.length > 2) return addr as `0x${string}`;
    throw new Error(`Invalid or missing address for ${label || 'field'}`);
  }

  async swap(params: SwapParams) {
    // Вызов Panora SDK
    const response = await this.client.Swap({
      chainId: params.chainId,
      fromTokenAddress: this.safeAddr(params.fromTokenAddress, 'fromTokenAddress'),
      toTokenAddress: this.safeAddr(params.toTokenAddress, 'toTokenAddress'),
      fromTokenAmount: params.fromTokenAmount,
      toWalletAddress: this.safeAddr(params.toWalletAddress, 'toWalletAddress'),
      slippagePercentage: params.slippagePercentage || '1',
      integratorFeeAddress: params.integratorFeeAddress ? this.safeAddr(params.integratorFeeAddress, 'integratorFeeAddress') : undefined,
      integratorFeePercentage: params.integratorFeePercentage,
    }, ""); // TODO: provide private key if needed
    return response;
  }
} 