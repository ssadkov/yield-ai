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

function normalizeTokenAddress(address: string): string {
  // Убираем префикс @ если он есть
  let cleanAddress = address.startsWith('@') ? address.slice(1) : address;
  
  // Если адрес содержит ::, значит это Move адрес
  if (cleanAddress.includes('::')) {
    // Разбиваем на части
    const parts = cleanAddress.split('::');
    // Берем только адрес модуля
    cleanAddress = parts[0];
  }
  
  // Добавляем префикс 0x если его нет
  return cleanAddress.startsWith('0x') ? cleanAddress : `0x${cleanAddress}`;
}

export async function getTokenInfo(token: string): Promise<Token> {
  const normalizedAddress = normalizeTokenAddress(token);
  console.log('Normalized token address:', normalizedAddress);
  
  const foundToken = (tokenList.data.data as any[]).find(t => {
    const normalizedTokenAddress = t.tokenAddress ? normalizeTokenAddress(t.tokenAddress) : null;
    const normalizedFaAddress = t.faAddress ? normalizeTokenAddress(t.faAddress) : null;
    
    return normalizedTokenAddress === normalizedAddress || normalizedFaAddress === normalizedAddress;
  });

  if (!foundToken) {
    throw new Error(`Token ${token} not found in token list`);
  }

  return {
    ...foundToken,
    isFungible: foundToken.faAddress !== null
  };
} 