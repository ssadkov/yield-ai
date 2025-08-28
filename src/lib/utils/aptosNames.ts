export async function resolveAddressFromName(name: string, network: string = 'mainnet'): Promise<string | null> {
  try {
    const response = await fetch(`https://www.aptosnames.com/api/${network}/v1/address/${name}`);
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    return data.address;
  } catch (error) {
    console.error('Error resolving name to address:', error);
    return null;
  }
}

export async function resolveNameFromAddress(address: string, network: string = 'mainnet'): Promise<string | null> {
  try {
    const response = await fetch(`https://www.aptosnames.com/api/${network}/v1/name/${address}`);
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    return data.name;
  } catch (error) {
    console.error('Error resolving address to name:', error);
    return null;
  }
}

export function isValidAptosAddress(address: string): boolean {
  const aptosAddressRegex = /^0x[0-9a-f]{64}$/i;
  return aptosAddressRegex.test(address);
}

export function isPotentialDomainName(input: string): boolean {
  return input.includes('.') && !input.startsWith('0x');
}