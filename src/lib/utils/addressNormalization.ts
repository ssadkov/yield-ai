/**
 * Utility functions for Aptos address normalization
 * 
 * Problem: Panora API returns addresses with leading zeros (e.g., 0x05fabd...),
 * but some systems normalize addresses by removing leading zeros (e.g., 0x5fabd...).
 * This causes price lookup failures when the requested address doesn't match the stored one.
 * 
 * Solution: Always save prices/data under BOTH versions of the address.
 */

/**
 * Normalizes an Aptos address by removing leading zeros after 0x prefix
 * @param addr - The address to normalize (e.g., "0x05fabd..." or "0x5fabd...")
 * @returns Normalized address with leading zeros removed (e.g., "0x5fabd...")
 * 
 * @example
 * normalizeAddress("0x05fabd1b...") // returns "0x5fabd1b..."
 * normalizeAddress("0x5fabd1b...")  // returns "0x5fabd1b..."
 * normalizeAddress("0x000001")      // returns "0x1"
 * normalizeAddress("0x0")           // returns "0x0"
 */
export function normalizeAddress(addr: string): string {
  if (!addr || !addr.startsWith('0x')) return addr;
  
  const normalized = '0x' + addr.slice(2).replace(/^0+/, '');
  
  // Handle edge case where all zeros would result in "0x"
  return normalized === '0x' ? '0x0' : normalized;
}

/**
 * Creates a price map with both normalized and original address versions
 * This ensures prices can be found regardless of which address format is used for lookup
 * 
 * @param prices - Array of token price objects from Panora API
 * @returns Record mapping both original and normalized addresses to prices
 * 
 * @example
 * const apiResponse = [{ 
 *   faAddress: "0x05fabd...", 
 *   tokenAddress: null, 
 *   usdPrice: "1.23" 
 * }];
 * const priceMap = createDualAddressPriceMap(apiResponse);
 * // Result:
 * // {
 * //   "0x05fabd...": "1.23",  // original
 * //   "0x5fabd...": "1.23"     // normalized
 * // }
 */
export function createDualAddressPriceMap(
  prices: Array<{
    tokenAddress?: string | null;
    faAddress?: string | null;
    usdPrice: string;
  }>
): Record<string, string> {
  const priceMap: Record<string, string> = {};

  prices.forEach((price) => {
    const usdPrice = price.usdPrice;

    // Save price under original tokenAddress
    if (price.tokenAddress) {
      priceMap[price.tokenAddress] = usdPrice;
      
      // Also save under normalized version
      const normalized = normalizeAddress(price.tokenAddress);
      if (normalized !== price.tokenAddress) {
        priceMap[normalized] = usdPrice;
      }
    }

    // Save price under original faAddress
    if (price.faAddress) {
      priceMap[price.faAddress] = usdPrice;
      
      // Also save under normalized version
      const normalized = normalizeAddress(price.faAddress);
      if (normalized !== price.faAddress) {
        priceMap[normalized] = usdPrice;
      }
    }
  });

  return priceMap;
}

/**
 * Checks if two addresses are equivalent (same after normalization)
 * 
 * @param addr1 - First address to compare
 * @param addr2 - Second address to compare
 * @returns true if addresses are equivalent after normalization
 * 
 * @example
 * areAddressesEqual("0x05fabd...", "0x5fabd...") // returns true
 * areAddressesEqual("0x1", "0x0001")             // returns true
 * areAddressesEqual("0x1", "0x2")                // returns false
 */
export function areAddressesEqual(addr1: string, addr2: string): boolean {
  return normalizeAddress(addr1) === normalizeAddress(addr2);
}

/**
 * Finds a token in an array by matching either original or normalized address
 * Useful when searching for prices in API responses
 * 
 * @param tokens - Array of tokens with address fields
 * @param searchAddress - Address to search for
 * @returns Found token or undefined
 * 
 * @example
 * const tokens = [{ faAddress: "0x05fabd...", usdPrice: "1.23" }];
 * const found = findTokenByAddress(tokens, "0x5fabd...");
 * // Returns the token even though search address has no leading zero
 */
export function findTokenByAddress<T extends { tokenAddress?: string | null; faAddress?: string | null; usdPrice?: string }>(
  tokens: T[],
  searchAddress: string
): T | undefined {
  const normalizedSearch = normalizeAddress(searchAddress);
  
  return tokens.find((token) => {
    const normalizedTokenAddr = normalizeAddress(token.tokenAddress || '');
    const normalizedFaAddr = normalizeAddress(token.faAddress || '');
    
    return token.tokenAddress === searchAddress ||
           token.faAddress === searchAddress ||
           normalizedTokenAddr === normalizedSearch ||
           normalizedFaAddr === normalizedSearch;
  });
}

