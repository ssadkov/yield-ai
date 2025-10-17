import { Token } from '@/lib/types/token';

// Hyperion Vault token addresses и их символы
const HYPERION_VAULT_TOKENS: Record<string, string> = {
  '0x7a6ef286a6d3f482dcb56d683678dadc7a18be133bf5f01626d5164a52e68eeb': 'Vault-APT-USDt',
  '0xab8fdae5dd99a4379362c01218cd7aef40758cd8111d11853ce6efd2f82b7cad': 'Vault-USDt-USDC',
  '0x77d56ce63cf4d8c36a60a8a8f29e11ebbf7a1c0e22d6cd069d7f2e950d2fd0bd': 'Vault-APT-USDC',
  '0x109a94e8449ac26fc1f2a785fb0d1ca96aa2c0af9d500333fa7a9d31d0043363': 'Vault-USD1-USDC',
  '0x41cfdef11efd671cbcffa66f57716ee5698308b233359481d52d6dac34b42af2': 'Vault-APT-kAPT'
};

// Маппинг Vault токенов к их базовым токенам и decimals
const VAULT_TOKEN_MAPPING: Record<string, {
  symbol: string;
  tokens: Array<{
    address: string;
    symbol: string;
    decimals: number;
    logoUrl: string;
  }>;
}> = {
  '0x7a6ef286a6d3f482dcb56d683678dadc7a18be133bf5f01626d5164a52e68eeb': {
    symbol: 'Vault-APT-USDt',
    tokens: [
      { address: '0x1::aptos_coin::AptosCoin', symbol: 'APT', decimals: 8, logoUrl: 'https://assets.panora.exchange/tokens/aptos/APT.svg' },
      { address: '0x357b0b74bc833e95a115ad22604854d6b0fca151cecd94111770e5d6ffc9dc2b', symbol: 'USDT', decimals: 6, logoUrl: 'https://assets.panora.exchange/tokens/aptos/USDT.svg' }
    ]
  },
  '0xab8fdae5dd99a4379362c01218cd7aef40758cd8111d11853ce6efd2f82b7cad': {
    symbol: 'Vault-USDt-USDC',
    tokens: [
      { address: '0x357b0b74bc833e95a115ad22604854d6b0fca151cecd94111770e5d6ffc9dc2b', symbol: 'USDT', decimals: 6, logoUrl: 'https://assets.panora.exchange/tokens/aptos/USDT.svg' },
      { address: '0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b', symbol: 'USDC', decimals: 6, logoUrl: 'https://assets.panora.exchange/tokens/aptos/USDC.svg' }
    ]
  },
  '0x77d56ce63cf4d8c36a60a8a8f29e11ebbf7a1c0e22d6cd069d7f2e950d2fd0bd': {
    symbol: 'Vault-APT-USDC',
    tokens: [
      { address: '0x1::aptos_coin::AptosCoin', symbol: 'APT', decimals: 8, logoUrl: 'https://assets.panora.exchange/tokens/aptos/APT.svg' },
      { address: '0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b', symbol: 'USDC', decimals: 6, logoUrl: 'https://assets.panora.exchange/tokens/aptos/USDC.svg' }
    ]
  },
  '0x41cfdef11efd671cbcffa66f57716ee5698308b233359481d52d6dac34b42af2': {
    symbol: 'Vault-APT-kAPT',
    tokens: [
      { address: '0x1::aptos_coin::AptosCoin', symbol: 'APT', decimals: 8, logoUrl: 'https://assets.panora.exchange/tokens/aptos/APT.svg' },
      { address: '0x821c94e69bc7ca058c913b7b5e6b0a5c9fd1523d58723a966fb8c1f5ea888105', symbol: 'kAPT', decimals: 8, logoUrl: 'https://assets.panora.exchange/tokens/aptos/kAPT.png' }
    ]
  },
  '0x109a94e8449ac26fc1f2a785fb0d1ca96aa2c0af9d500333fa7a9d31d0043363': {
    symbol: 'Vault-USD1-USDC',
    tokens: [
      { address: '0x05fabd1b12e39967a3c24e91b7b8f67719a6dacee74f3c8b9fb7d93e855437d2', symbol: 'USD1', decimals: 6, logoUrl: 'https://assets.panora.exchange/tokens/aptos/USD1.svg' },
      { address: '0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b', symbol: 'USDC', decimals: 6, logoUrl: 'https://assets.panora.exchange/tokens/aptos/USDC.svg' }
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
 * Получает символ Vault токена по адресу (без префикса "Vault-")
 */
export function getVaultTokenSymbol(tokenAddress: string): string {
  const fullSymbol = HYPERION_VAULT_TOKENS[tokenAddress.toLowerCase()] || tokenAddress;
  // Убираем префикс "Vault-" из символа
  return fullSymbol.replace(/^Vault-/, '');
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
