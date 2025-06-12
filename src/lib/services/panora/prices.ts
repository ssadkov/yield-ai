import { PriceResponse, PriceError, SUPPORTED_CHAIN_IDS, SupportedChainId, DEFAULT_CHAIN_ID } from '../../types/panora';
import { http } from '../../utils/http';

export class PanoraPricesService {
  private static instance: PanoraPricesService;
  private readonly baseUrl: string;

  private constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_PANORA_API_URL || 'https://api.panora.io';
  }

  public static getInstance(): PanoraPricesService {
    if (!PanoraPricesService.instance) {
      PanoraPricesService.instance = new PanoraPricesService();
    }
    return PanoraPricesService.instance;
  }

  public async getPrices(chainId: SupportedChainId = DEFAULT_CHAIN_ID): Promise<PriceResponse> {
    try {
      // TODO: Implement price fetching logic
      return {
        data: [],
        status: 200
      };
    } catch {
      throw new PriceError('Failed to fetch prices');
    }
  }
} 