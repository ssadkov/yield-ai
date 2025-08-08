import { Token } from '@/lib/types/token';

// Hyperion Vault token addresses и их символы
const HYPERION_VAULT_TOKENS: Record<string, string> = {
  '0x7a6ef286a6d3f482dcb56d683678dadc7a18be133bf5f01626d5164a52e68eeb': 'Vault-APT-USDt',
  '0xab8fdae5dd99a4379362c01218cd7aef40758cd8111d11853ce6efd2f82b7cad': 'Vault-USDt-USDC',
  '0x77d56ce63cf4d8c36a60a8a8f29e11ebbf7a1c0e22d6cd069d7f2e950d2fd0bd': 'Vault-APT-USDC'
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
