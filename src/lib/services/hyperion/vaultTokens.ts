import { Token } from '@/lib/types/token';

// Hyperion Vault token addresses и их символы
const HYPERION_VAULT_TOKENS: Record<string, string> = {
  '0x7a6ef286a6d3f482dcb56d683678dadc7a18be133bf5f01626d5164a52e68eeb': 'Vault-APT-USDt',
  '0xab8fdae5dd99a4379362c01218cd7aef40758cd8111d11853ce6efd2f82b7cad': 'Vault-USDt-USDC',
  '0x77d56ce63cf4d8c36a60a8a8f29e11ebbf7a1c0e22d6cd069d7f2e950d2fd0bd': 'Vault-APT-USDC'
};

// Маппинг Vault токенов к их базовым токенам и decimals
const VAULT_TOKEN_MAPPING: Record<string, {
  symbol: string;
  tokens: Array<{
    address: string;
    symbol: string;
    decimals: number;
  }>;
}> = {
  '0x7a6ef286a6d3f482dcb56d683678dadc7a18be133bf5f01626d5164a52e68eeb': {
    symbol: 'Vault-APT-USDt',
    tokens: [
      { address: '0x1::aptos_coin::AptosCoin', symbol: 'APT', decimals: 8 },
      { address: '0x357b0b74bc833e95a115ad22604854d6b0fca151cecd94111770e5d6ffc9dc2b', symbol: 'USDT', decimals: 6 }
    ]
  },
  '0xab8fdae5dd99a4379362c01218cd7aef40758cd8111d11853ce6efd2f82b7cad': {
    symbol: 'Vault-USDt-USDC',
    tokens: [
      { address: '0x357b0b74bc833e95a115ad22604854d6b0fca151cecd94111770e5d6ffc9dc2b', symbol: 'USDT', decimals: 6 },
      { address: '0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b', symbol: 'USDC', decimals: 6 }
    ]
  },
  '0x77d56ce63cf4d8c36a60a8a8f29e11ebbf7a1c0e22d6cd069d7f2e950d2fd0bd': {
    symbol: 'Vault-APT-USDC',
    tokens: [
      { address: '0x1::aptos_coin::AptosCoin', symbol: 'APT', decimals: 8 },
      { address: '0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b', symbol: 'USDC', decimals: 6 }
    ]
  }
};

/**
 * Проверяет, является ли токен Hyperion Vault токеном
 */
export function isHyperionVaultToken(tokenAddress: string): boolean {
  return Object.keys(HYPERION_VAULT_TOKENS).includes(tokenAddress.toLowerCase());
}

/**
 * Получает символ Vault токена по адресу
 */
export function getVaultTokenSymbol(tokenAddress: string): string {
  return HYPERION_VAULT_TOKENS[tokenAddress.toLowerCase()] || tokenAddress;
}

/**
 * Получает маппинг Vault токена по адресу
 */
export function getVaultTokenMapping(tokenAddress: string) {
  return VAULT_TOKEN_MAPPING[tokenAddress.toLowerCase()];
}

/**
 * Фильтрует токены кошелька, оставляя только Hyperion Vault токены
 */
export function filterHyperionVaultTokens(tokens: Token[]): Token[] {
  return tokens.filter(token => isHyperionVaultToken(token.address));
}

/**
 * Проверяет, есть ли у пользователя Hyperion Vault токены
 */
export function hasHyperionVaultTokens(tokens: Token[]): boolean {
  return filterHyperionVaultTokens(tokens).length > 0;
}

/**
 * Получает список адресов Hyperion Vault токенов
 */
export function getHyperionVaultTokenAddresses(): string[] {
  return Object.keys(HYPERION_VAULT_TOKENS);
}
