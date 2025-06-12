import { TokenListResponse, TokenListError, SUPPORTED_CHAIN_IDS, SupportedChainId, DEFAULT_CHAIN_ID } from '../../types/panora';

export class PanoraTokensService {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly tokenListEndpoint: string;

  constructor() {
    this.apiKey = process.env.PANORA_API_KEY || '';
    console.log('API Key loaded:', this.apiKey ? 'Present' : 'Missing');
    this.baseUrl = process.env.PANORA_API_URL || 'https://api.panora.exchange';
    this.tokenListEndpoint = `${this.baseUrl}/tokenlist`;

    if (!this.apiKey) {
      throw new Error('PANORA_API_KEY is not set');
    }
  }

  private validateChainId(chainId: number): chainId is SupportedChainId {
    return Object.values(SUPPORTED_CHAIN_IDS).includes(chainId as SupportedChainId);
  }

  async getTokenList(chainId: number = DEFAULT_CHAIN_ID): Promise<TokenListResponse> {
    if (!this.validateChainId(chainId)) {
      throw new Error(`Unsupported chainId: ${chainId}. Supported chains: ${Object.values(SUPPORTED_CHAIN_IDS).join(', ')}`);
    }

    try {
      const response = await fetch(this.tokenListEndpoint, {
        headers: {
          'x-api-key': this.apiKey,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const error: TokenListError = await response.json();
        throw new Error(error.message || 'Failed to fetch token list');
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to fetch token list: ${error.message}`);
      }
      throw new Error('Failed to fetch token list');
    }
  }
} 