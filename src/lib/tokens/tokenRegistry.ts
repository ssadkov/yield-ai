import tokenList from '../data/tokenList.json';
import { TokenInfoService } from '../services/tokenInfoService';
import type { TokenInfo as ServiceTokenInfo } from '../services/tokenInfoService';

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

/**
 * Get token info with fallback to protocol APIs
 * 
 * This function first tries to find the token in tokenList.json.
 * If not found, it falls back to protocol APIs (Echelon, Panora, etc.)
 * 
 * Use this function when dealing with tokens that might not be in the main token list,
 * such as LP tokens, protocol-specific tokens, or new tokens.
 * 
 * @param token Token address (tokenAddress or faAddress)
 * @param useCache Whether to use cache (default: true)
 * @returns Token info or null if not found anywhere
 */
export async function getTokenInfoWithFallback(
  token: string, 
  useCache = true
): Promise<Token | null> {
  const normalizedAddress = normalizeTokenAddress(token);
  console.log('[getTokenInfoWithFallback] Looking up token:', normalizedAddress);
  
  // 1. Try tokenList first (fast path)
  try {
    const tokenInfo = await getTokenInfo(token);
    console.log('[getTokenInfoWithFallback] Found in tokenList:', tokenInfo.symbol);
    return tokenInfo;
  } catch (error) {
    console.log('[getTokenInfoWithFallback] Not in tokenList, trying protocol APIs...');
  }
  
  // 2. Try protocol APIs through TokenInfoService
  try {
    const service = TokenInfoService.getInstance();
    const serviceTokenInfo = await service.getTokenInfo(token, useCache);
    
    if (serviceTokenInfo) {
      console.log('[getTokenInfoWithFallback] Found via protocol API:', serviceTokenInfo.symbol, 'from', serviceTokenInfo.source);
      
      // Convert ServiceTokenInfo to Token format
      const convertedToken: Token = {
        chainId: 1, // Aptos mainnet
        panoraId: '', // Not available from protocol APIs
        tokenAddress: serviceTokenInfo.tokenAddress || null,
        faAddress: serviceTokenInfo.faAddress || serviceTokenInfo.address,
        name: serviceTokenInfo.name,
        symbol: serviceTokenInfo.symbol,
        decimals: serviceTokenInfo.decimals,
        bridge: null,
        panoraSymbol: serviceTokenInfo.symbol,
        usdPrice: serviceTokenInfo.price ? serviceTokenInfo.price.toString() : null,
        logoUrl: serviceTokenInfo.logoUrl,
        websiteUrl: null,
        panoraUI: false,
        panoraTags: [],
        panoraIndex: 0,
        coinGeckoId: null,
        coinMarketCapId: null,
        isInPanoraTokenList: serviceTokenInfo.source === 'panora',
        isBanned: false,
        isFungible: serviceTokenInfo.isFungible || false
      };
      
      return convertedToken;
    }
  } catch (error) {
    console.warn('[getTokenInfoWithFallback] Error with protocol APIs:', error);
  }
  
  // 3. Not found anywhere
  console.log('[getTokenInfoWithFallback] Token not found in any source');
  return null;
} 