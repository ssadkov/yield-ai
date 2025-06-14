import tokenList from '../data/tokenList.json';

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

export async function getTokenInfo(token: string): Promise<Token> {
  // Убираем префикс @ если он есть
  const cleanAddress = token.startsWith('@') ? token.slice(1) : token;
  // Добавляем префикс 0x если его нет
  const fullAddress = cleanAddress.startsWith('0x') ? cleanAddress : `0x${cleanAddress}`;
  
  const foundToken = (tokenList.data.data as any[]).find(t => 
    t.tokenAddress === fullAddress || t.faAddress === fullAddress
  );

  if (!foundToken) {
    throw new Error(`Token ${token} not found in token list`);
  }

  return {
    ...foundToken,
    isFungible: foundToken.faAddress !== null
  };
} 