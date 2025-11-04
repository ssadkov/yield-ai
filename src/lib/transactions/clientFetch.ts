/**
 * Client-side fetch for Aptoscan API
 * This bypasses Cloudflare blocking by making requests from the user's browser
 * instead of from Vercel server IPs
 */

import { Transaction, TransactionsResponse, ActivityType } from './types';
import { ProtocolKey } from './types';

const APTOSCAN_API_BASE = 'https://api.aptoscan.com/public/v1.0';

interface FetchTransactionsParams {
  address: string;
  page: number;
  platform?: string[];
}

async function fetchTransactionsFromAptoscan(
  params: FetchTransactionsParams,
  retryCount = 0
): Promise<TransactionsResponse> {
  const { address, page, platform } = params;
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 2000; // 2 seconds
  
  const url = new URL(`${APTOSCAN_API_BASE}/accounts/${address}/dextrading`);
  url.searchParams.set('page', page.toString());
  url.searchParams.set('page_size', '100');
  
  // Add platform filters if provided
  if (platform && platform.length > 0) {
    platform.forEach(addr => {
      url.searchParams.append('platform', addr);
    });
  }
  
  const urlString = url.toString();
  console.log(`[Client] Fetching from Aptoscan (attempt ${retryCount + 1}):`, urlString);
  
  // Create AbortController for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 seconds timeout
  
  try {
    // Browser automatically sends correct headers, but we add some for compatibility
    const response = await fetch(urlString, {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store',
      signal: controller.signal,
    });
    
    // Clear timeout if request succeeds
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unable to read error response');
      console.error('[Client] Aptoscan API error:', response.status, response.statusText);
      console.error('[Client] Error response preview:', errorText.substring(0, 500));
      
      // Check if it's a Cloudflare challenge
      const isCloudflareChallenge = 
        response.status === 403 || 
        response.status === 429 ||
        errorText.includes('Just a moment') || 
        errorText.includes('challenge-platform') ||
        errorText.includes('cf-browser-verification') ||
        errorText.includes('Checking your browser');
      
      if (isCloudflareChallenge) {
        // Retry with exponential backoff
        if (retryCount < MAX_RETRIES) {
          const delay = RETRY_DELAY * Math.pow(2, retryCount);
          console.log(`[Client] Cloudflare challenge detected. Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return fetchTransactionsFromAptoscan(params, retryCount + 1);
        }
        throw new Error('Cloudflare protection is blocking requests. Please try again later or contact support if the issue persists.');
      }
      
      throw new Error(`Aptoscan API error: ${response.status} ${response.statusText}`);
    }
    
    let data: TransactionsResponse;
    try {
      data = await response.json();
    } catch (parseError) {
      console.error('[Client] Failed to parse JSON response:', parseError);
      throw new Error('Invalid JSON response from Aptoscan API');
    }
    
    // Validate response structure
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid response structure from Aptoscan API');
    }
    
    console.log(`[Client] Page ${page}: Received ${data.data?.length || 0} transactions, success: ${data.success}`);
    
    return data;
  } catch (error) {
    // Clear timeout on error
    clearTimeout(timeoutId);
    
    // Handle timeout and network errors
    if (error instanceof Error && (error.name === 'AbortError' || error.message.includes('timeout') || error.message.includes('aborted'))) {
      if (retryCount < MAX_RETRIES) {
        const delay = RETRY_DELAY * Math.pow(2, retryCount);
        console.log(`[Client] Request timeout. Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return fetchTransactionsFromAptoscan(params, retryCount + 1);
      }
      throw new Error('Request timeout. The server may be experiencing high load. Please try again later.');
    }
    
    // Re-throw other errors
    throw error;
  }
}

/**
 * Merge metadata objects, combining all nested objects
 */
function mergeMetadata(
  metadata1: TransactionsResponse['metadata'],
  metadata2: TransactionsResponse['metadata']
): TransactionsResponse['metadata'] {
  return {
    accounts: { ...metadata1.accounts, ...metadata2.accounts },
    coins: { ...metadata1.coins, ...metadata2.coins },
    tokens: { ...metadata1.tokens, ...metadata2.tokens },
    tokenv2s: { ...metadata1.tokenv2s, ...metadata2.tokenv2s },
    collections: { ...metadata1.collections, ...metadata2.collections },
    collectionv2s: { ...metadata1.collectionv2s, ...metadata2.collectionv2s },
    fungible_assets: { ...metadata1.fungible_assets, ...metadata2.fungible_assets },
    modules: { ...metadata1.modules, ...metadata2.modules },
  };
}

function validateAptosAddress(address: string): boolean {
  // Remove 0x prefix if present
  const cleanAddress = address.startsWith('0x') ? address.slice(2) : address;
  // Aptos address should be 64 hex characters
  return /^[0-9a-fA-F]{64}$/.test(cleanAddress);
}

/**
 * Fetch transactions from Aptoscan API (client-side)
 * This function should be called from the browser to bypass Cloudflare blocking
 */
export async function fetchTransactionsClient(
  address: string,
  getProtocolsList: () => Array<{ key: string; contractAddresses?: string[] }>,
  protocol?: ProtocolKey | null,
  activityType?: ActivityType | null
): Promise<TransactionsResponse> {
  // Normalize address (ensure 0x prefix)
  const normalizedAddress = address.startsWith('0x') ? address : `0x${address}`;
  
  if (!validateAptosAddress(normalizedAddress)) {
    throw new Error('Invalid Aptos address format');
  }
  
  // Get protocol contract addresses if protocol filter is specified
  let platformAddresses: string[] | undefined;
  if (protocol) {
    const protocols = getProtocolsList();
    const selectedProtocol = protocols.find(p => p.key === protocol);
    if (selectedProtocol?.contractAddresses && selectedProtocol.contractAddresses.length > 0) {
      platformAddresses = selectedProtocol.contractAddresses;
    }
  }
  
  // Fetch all pages
  let allTransactions: Transaction[] = [];
  let mergedMetadata: TransactionsResponse['metadata'] = {
    accounts: {},
    coins: {},
    tokens: {},
    tokenv2s: {},
    collections: {},
    collectionv2s: {},
    fungible_assets: {},
    modules: {},
  };
  
  let page = 1;
  let hasMore = true;
  
  while (hasMore) {
    try {
      const response = await fetchTransactionsFromAptoscan({
        address: normalizedAddress,
        page,
        platform: platformAddresses,
      });
      
      if (response.success && response.data && response.data.length > 0) {
        allTransactions.push(...response.data);
        if (response.metadata) {
          mergedMetadata = mergeMetadata(mergedMetadata, response.metadata);
        }
        page++;
        
        // If we got less than 100 transactions, we're on the last page
        if (response.data.length < 100) {
          hasMore = false;
        } else {
          // Add delay between requests to avoid being flagged as bot
          await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
        }
      } else {
        hasMore = false;
      }
    } catch (fetchError) {
      console.error(`[Client] Error fetching page ${page}:`, fetchError);
      // If it's the first page, propagate the error
      if (page === 1) {
        throw fetchError;
      }
      // Otherwise, stop pagination
      hasMore = false;
    }
    
    // Safety limit to prevent infinite loops
    if (page > 100) {
      hasMore = false;
    }
  }
  
  console.log(`[Client] Fetched ${allTransactions.length} total transactions across ${page - 1} pages`);
  
  // Filter by activity type if specified
  if (activityType) {
    allTransactions = allTransactions.filter(tx => tx.activity_type === activityType);
  }
  
  // Sort by block_time descending (newest first)
  allTransactions.sort((a, b) => b.block_time - a.block_time);
  
  return {
    success: true,
    data: allTransactions,
    metadata: mergedMetadata,
  };
}

