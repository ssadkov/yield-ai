import { Protocol } from '../protocols/getProtocolsList';
import { getProtocolsList } from '../protocols/getProtocolsList';

/**
 * Extracts contract address from platform string
 * Example: "0x1c3206329806286fd2223647c9f9b130e66baeb6d7224a18c1f642ffe48f3b4c::panora_swap::router_entry"
 * Returns: "0x1c3206329806286fd2223647c9f9b130e66baeb6d7224a18c1f642ffe48f3b4c"
 */
export function extractContractAddress(platform: string): string | null {
  if (!platform || !platform.includes('::')) {
    return null;
  }
  
  const address = platform.split('::')[0];
  
  // Validate that it looks like an Aptos address (starts with 0x and has proper length)
  if (address.startsWith('0x') && address.length >= 2) {
    return address;
  }
  
  return null;
}

/**
 * Finds protocol by contract address
 */
export function findProtocolByAddress(address: string): Protocol | null {
  if (!address) return null;
  
  const protocols = getProtocolsList();
  
  for (const protocol of protocols) {
    if (protocol.contractAddresses && protocol.contractAddresses.length > 0) {
      for (const contractAddr of protocol.contractAddresses) {
        // Normalize addresses for comparison (remove leading zeros after 0x)
        const normalize = (addr: string) => {
          if (!addr || !addr.startsWith('0x')) return addr;
          const normalized = '0x' + addr.slice(2).replace(/^0+/, '') || '0x0';
          return normalized.length === 2 ? '0x0' : normalized;
        };
        
        const normalizedInput = normalize(address);
        const normalizedContract = normalize(contractAddr);
        
        if (normalizedInput === normalizedContract) {
          return protocol;
        }
      }
    }
  }
  
  return null;
}

/**
 * Determines protocol from transaction platform field
 */
export function getProtocolFromPlatform(platform: string[]): Protocol | null {
  if (!platform || platform.length === 0) {
    return null;
  }
  
  // Use first platform entry
  const firstPlatform = platform[0];
  const address = extractContractAddress(firstPlatform);
  
  if (!address) {
    return null;
  }
  
  return findProtocolByAddress(address);
}
