import { BaseProtocol } from './BaseProtocol';
import { getTokenInfo } from '@/lib/tokens/tokenRegistry';

interface Token {
  chainId: number;
  panoraId: string;
  tokenAddress: string | null;
  faAddress: string;
  name: string;
  symbol: string;
  decimals: number;
  bridge: string | null;
  panoraSymbol: string;
  usdPrice: string | null;
  logoUrl: string | null;
  websiteUrl: string | null;
  panoraUI: boolean;
  panoraTags: string[];
  panoraIndex: number;
  coinGeckoId: string | null;
  coinMarketCapId: number | null;
  isInPanoraTokenList: boolean;
  isBanned: boolean;
  isFungible: boolean;
}

export class JouleProtocol implements BaseProtocol {
  name = 'Joule';

  async buildDeposit(amountOctas: bigint, token: string) {
    console.log('Building deposit for:', { amountOctas, token });

    const tokenInfo = await this.getTokenInfo(token);
    console.log('Token info:', { tokenInfo, isFungible: tokenInfo.isFungible });

    if (tokenInfo.isFungible) {
      const payload = {
        type: 'entry_function_payload' as const,
        function: '0x2fe576faa841347a9b1b32c869685deb75a15e3f62dfe37cbd6d52cc403a16f6::pool::lend_fa',
        type_arguments: [] as string[],
        arguments: [
          '1',
          tokenInfo.faAddress,
          false,
          amountOctas.toString()
        ].map(arg => arg.toString()) as string[]
      };
      console.log('Generated fungible payload:', payload);
      return payload;
    } else {
      const payload = {
        type: 'entry_function_payload' as const,
        function: '0x2fe576faa841347a9b1b32c869685deb75a15e3f62dfe37cbd6d52cc403a16f6::pool::lend_nft',
        type_arguments: [token],
        arguments: [
          '1',
          amountOctas.toString(),
          false
        ].map(arg => arg.toString()) as string[]
      };
      console.log('Generated NFT payload:', payload);
      return payload;
    }
  }

  private async getTokenInfo(token: string) {
    console.log('Looking for token:', {
      token,
      cleanAddress: token.toLowerCase(),
      fullAddress: token
    });

    const tokenInfo = await getTokenInfo(token);
    console.log('Found token:', tokenInfo);

    if (!tokenInfo) {
      throw new Error(`Token ${token} not found`);
    }

    return tokenInfo;
  }
} 