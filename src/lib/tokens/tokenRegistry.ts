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
  if (!cleanAddress.startsWith('0x')) {
    cleanAddress = `0x${cleanAddress}`;
  }
  
  // Нормализуем адрес, убирая ведущие нули после 0x
  if (cleanAddress.startsWith('0x')) {
    const normalized = '0x' + cleanAddress.slice(2).replace(/^0+/, '') || '0x0';
    return normalized;
  }
  
  return cleanAddress;
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

  // Проверяем, является ли токен FA, исключая нативные токены Aptos
  const isFungible = foundToken.faAddress !== null && 
    !foundToken.tokenAddress?.includes('0x1::aptos_coin::AptosCoin');

  return {
    ...foundToken,
    isFungible
  };
} 