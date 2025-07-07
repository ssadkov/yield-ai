import { NextRequest, NextResponse } from 'next/server';

// Auro Finance contract addresses (mainnet)
const AURO_ADDRESS = "0x50a340a19e6ada1be07192c042786ca6a9651d5c845acc8727e8c6416a56a32c";

// Helper function to normalize collection id
function normalizeCollectionId(id: string): string {
  if (id.startsWith("0x") && id.length === 66) return id;
  if (id.startsWith("0x") && id.length === 65) {
    return "0x0" + id.slice(2);
  }
  return id; // fallback
}

export async function GET(request: NextRequest) {
  try {
    console.log('=== Auro API Route Started ===');
    
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');

    console.log('Request URL:', request.url);
    console.log('Address parameter:', address);

    if (!address) {
      console.log('No address provided, returning 400');
      return NextResponse.json({ error: 'Address parameter is required' }, { status: 400 });
    }

    console.log('Getting collection address for Auro Finance...');

    // Get collection address using direct HTTP request to fullnode
    const viewPayload = {
      function: `${AURO_ADDRESS}::auro_pool::position_nft_collection`,
      type_arguments: [],
      arguments: []
    };

    console.log('Calling view function with payload:', viewPayload);

    const response = await fetch('https://fullnode.mainnet.aptoslabs.com/v1/view', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(viewPayload)
    });

    console.log('View function response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('View function error:', response.status, errorText);
      throw new Error(`View function error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('View function response data:', data);

    const collectionAddress = data[0];
    console.log('Collection address:', collectionAddress);
    
    // Стандартизируем адрес коллекции
    const standardizedAddress = normalizeCollectionId(collectionAddress);
    console.log('Standardized address:', standardizedAddress);

    // Новый GraphQL-запрос для поиска позиций по collection_id
    const query = `
      query GetUserAuroPositions($owner: String!, $collectionId: String!) {
        current_token_ownerships_v2(
          where: {
            owner_address: { _eq: $owner },
            amount: { _gt: "0" },
            current_token_data: {
              collection_id: { _eq: $collectionId }
            }
          }
        ) {
          storage_id
          amount
          current_token_data {
            token_name
            token_uri
            token_data_id
            collection_id
            current_collection {
              collection_name
              creator_address
            }
          }
        }
      }
    `;

    const variables = {
      owner: address,
      collectionId: standardizedAddress,
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (process.env.APTOS_API_KEY) {
      headers['Authorization'] = `Bearer ${process.env.APTOS_API_KEY}`;
    }

    const indexerResponse = await fetch("https://indexer.mainnet.aptoslabs.com/v1/graphql", {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, variables })
    });

    if (!indexerResponse.ok) {
      const errorText = await indexerResponse.text();
      throw new Error(`Indexer API error: ${indexerResponse.status} - ${errorText}`);
    }

    const indexerData = await indexerResponse.json();
    if (indexerData.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(indexerData.errors)}`);
    }

    const positions = (indexerData.data?.current_token_ownerships_v2 || []);

    // Получаем подробную информацию о позициях через view-функцию
    let rawPositionInfo = null;
    if (positions.length > 0) {
      const positionAddresses = positions.map((p: any) => p.storage_id);
      const payloadPositionInfo = {
        function: `${AURO_ADDRESS}::auro_view::multiple_position_info`,
        type_arguments: [],
        arguments: [positionAddresses],
      };
      const viewResponse = await fetch('https://fullnode.mainnet.aptoslabs.com/v1/view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadPositionInfo),
      });
      rawPositionInfo = await viewResponse.json();
    }

    const result = {
      success: true,
      collectionAddress: collectionAddress,
      standardizedCollectionAddress: standardizedAddress,
      positions,
      rawPositionInfo,
      message: "Collection address and user positions retrieved successfully"
    };

    console.log('Returning result:', JSON.stringify(result, null, 2));
    console.log('=== Auro API Route Completed ===');

    return NextResponse.json(result);

  } catch (error) {
    console.error('=== Auro API Route Error ===');
    console.error('Error getting collection address:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return NextResponse.json(
      { 
        error: 'Failed to get collection address', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
} 