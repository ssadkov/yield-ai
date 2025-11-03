import { NextRequest, NextResponse } from 'next/server';
import { Transaction, TransactionsResponse, ActivityType } from '@/lib/transactions/types';
import { getProtocolsList } from '@/lib/protocols/getProtocolsList';
import { ProtocolKey } from '@/lib/transactions/types';

const APTOSCAN_API_BASE = 'https://api.aptoscan.com/public/v1.0';

interface FetchTransactionsParams {
  address: string;
  page: number;
  platform?: string[];
}

async function fetchTransactionsFromAptoscan(
  params: FetchTransactionsParams
): Promise<TransactionsResponse> {
  const { address, page, platform } = params;
  
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
  console.log('Fetching from Aptoscan:', urlString);
  
  // Use realistic browser headers to bypass Cloudflare protection
  const response = await fetch(urlString, {
    headers: {
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Referer': 'https://aptoscan.com/',
      'Origin': 'https://aptoscan.com',
      'Connection': 'keep-alive',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-origin',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
    },
    cache: 'no-store',
    // Add redirect handling
    redirect: 'follow',
  });
  
  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unable to read error response');
    console.error('Aptoscan API error:', response.status, response.statusText, errorText);
    
    // Check if it's a Cloudflare challenge
    if (response.status === 403 && errorText.includes('Just a moment') || errorText.includes('challenge-platform')) {
      throw new Error('Cloudflare protection is blocking requests. Please try again later or contact support if the issue persists.');
    }
    
    throw new Error(`Aptoscan API error: ${response.status} ${response.statusText}`);
  }
  
  let data: TransactionsResponse;
  try {
    data = await response.json();
  } catch (parseError) {
    console.error('Failed to parse JSON response:', parseError);
    throw new Error('Invalid JSON response from Aptoscan API');
  }
  
  // Validate response structure
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid response structure from Aptoscan API');
  }
  
  console.log(`Page ${page}: Received ${data.data?.length || 0} transactions, success: ${data.success}`);
  
  return data;
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

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const address = searchParams.get('address');
    const protocol = searchParams.get('protocol') as ProtocolKey | null;
    const activityType = searchParams.get('activityType') as ActivityType | null;
    
    if (!address) {
      return NextResponse.json(
        { success: false, error: 'Address parameter is required' },
        { status: 400 }
      );
    }
    
    // Normalize address (ensure 0x prefix)
    const normalizedAddress = address.startsWith('0x') ? address : `0x${address}`;
    
    if (!validateAptosAddress(normalizedAddress)) {
      return NextResponse.json(
        { success: false, error: 'Invalid Aptos address format' },
        { status: 400 }
      );
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
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        } else {
          hasMore = false;
        }
      } catch (fetchError) {
        console.error(`Error fetching page ${page}:`, fetchError);
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
    
    console.log(`Fetched ${allTransactions.length} total transactions across ${page - 1} pages`);
    
    // Filter by activity type if specified
    if (activityType) {
      allTransactions = allTransactions.filter(tx => tx.activity_type === activityType);
    }
    
    // Sort by block_time descending (newest first)
    allTransactions.sort((a, b) => b.block_time - a.block_time);
    
    return NextResponse.json({
      success: true,
      data: allTransactions,
      metadata: mergedMetadata,
    });
    
  } catch (error) {
    console.error('Error fetching transactions:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch transactions',
        message: errorMessage,
        ...(process.env.NODE_ENV === 'development' && { stack: errorStack })
      },
      { status: 500 }
    );
  }
}
