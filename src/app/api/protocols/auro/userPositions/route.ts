import { NextRequest, NextResponse } from 'next/server';

// Auro Finance contract addresses (mainnet)
const AURO_ADDRESS = "0x50a340a19e6ada1be07192c042786ca6a9651d5c845acc8727e8c6416a56a32c";
const AURO_ROUTER_ADDRESS = '0xd039ef33e378c10544491855a2ef99cd77bf1a610fd52cc43117cd96e1c73465';

const APTOS_API_KEY = process.env.APTOS_API_KEY;

// Helper function to normalize collection id
function normalizeCollectionId(id: string): string {
  if (id.startsWith("0x") && id.length === 66) return id;
  if (id.startsWith("0x") && id.length === 65) {
    return "0x0" + id.slice(2);
  }
  return id; // fallback
}

// Helper function to get token info from tokenList.json
function getTokenInfo(tokenAddress: string) {
  const tokenList = require('@/lib/data/tokenList.json');
  return tokenList.data.data.find((token: any) => 
    token.tokenAddress === tokenAddress || 
    token.faAddress === tokenAddress
  );
}

// Helper function to get collateral token for a pool
async function getCollateralToken(poolAddress: string): Promise<string | null> {
  try {
    const viewPayload = {
      function: `${AURO_ADDRESS}::auro_pool::collateral_token`,
      type_arguments: [],
      arguments: [poolAddress]
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (process.env.APTOS_API_KEY) {
      headers['Authorization'] = `Bearer ${process.env.APTOS_API_KEY}`;
    }
    
    const response = await fetch('https://fullnode.mainnet.aptoslabs.com/v1/view', {
      method: 'POST',
      headers,
      body: JSON.stringify(viewPayload)
    });

    if (!response.ok) {
      console.error('Failed to get collateral token for pool:', poolAddress);
      return null;
    }

    const data = await response.json();
    const tokenAddress = data[0];

    return tokenAddress;
  } catch (error) {
    console.error('Error getting collateral token for pool:', poolAddress, error);
    return null;
  }
}

export async function GET(request: NextRequest) {

  try {
    // Auro API route started
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');

    if (!address) {
      
      return NextResponse.json({ error: 'Address parameter is required' }, { status: 400 });
    }

    // Get collection address using direct HTTP request to fullnode
    const viewPayload = {
      function: `${AURO_ADDRESS}::auro_pool::position_nft_collection`,
      type_arguments: [],
      arguments: []
    };

    const viewHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (process.env.APTOS_API_KEY) {
      viewHeaders['Authorization'] = `Bearer ${process.env.APTOS_API_KEY}`;
    }

    const response = await fetch('https://fullnode.mainnet.aptoslabs.com/v1/view', {
      method: 'POST',
      headers: viewHeaders,
      body: JSON.stringify(viewPayload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('View function error:', response.status, errorText);
      throw new Error(`View function error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    const collectionAddress = data[0];

    // Стандартизируем адрес коллекции
    const standardizedAddress = normalizeCollectionId(collectionAddress);

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
    let positionInfo: any[] = [];
    if (positions.length > 0) {

      const positionAddresses = positions.map((p: any) => p.storage_id);

      type PositionInfo = {
        collateral_pool: {
          inner: string;
        };  // pool address
        asset_amount: string;
        debt_amount: string;
        liquidate_price: string;
      };

      try {

        // Теперь вызываем основную функцию через fetch
        const payloadPositionInfo = {
          function: `${AURO_ROUTER_ADDRESS}::auro_view::multiple_position_info`,
          type_arguments: [],
          arguments: [positionAddresses.map((addr: string) => ({ inner: addr }))]
        };

        const viewResponse = await fetch('https://fullnode.mainnet.aptoslabs.com/v1/view', {
          method: 'POST',
          headers: viewHeaders,
          body: JSON.stringify(payloadPositionInfo)
        });
 
        if (viewResponse.ok) {
          const positionInfoResult = await viewResponse.json();
          
          if (positionInfoResult && Array.isArray(positionInfoResult) && positionInfoResult.length > 0) {
            const positionsData = positionInfoResult[0] as PositionInfo[];
            if (Array.isArray(positionsData)) {
              // Получаем информацию о токенах для каждой позиции
              const positionInfoWithTokens = await Promise.all(
                positionsData.map(async (x: any, index: number) => {
                  const poolAddress = x.collateral_pool?.inner;
                  let collateralTokenAddress = null;
                  let collateralTokenInfo = null;
                  
                  if (poolAddress) {
                    collateralTokenAddress = await getCollateralToken(poolAddress);
                    if (collateralTokenAddress) {
                      collateralTokenInfo = getTokenInfo(collateralTokenAddress);
                    }
                  }
                  
                  // Получаем информацию о токене долга (USDA)
                  const debtTokenInfo = getTokenInfo("0x534e4c3dc0f038dab1a8259e89301c4da58779a5d482fb354a41c08147e6b9ec");
                  
                  // Используем правильные decimals для каждого токена
                  const collateralDecimals = collateralTokenInfo?.decimals || 8;
                  const debtDecimals = debtTokenInfo?.decimals || 8;
                  
                  return {
                    address: positionAddresses[index],
                    poolAddress: poolAddress,
                    collateralTokenAddress: collateralTokenAddress,
                    collateralTokenInfo: collateralTokenInfo,
                    debtTokenInfo: debtTokenInfo,
                    collateralAmount: (Number(x.asset_amount) / Math.pow(10, collateralDecimals)).toFixed(4),
                    debtAmount: (Number(x.debt_amount) / Math.pow(10, debtDecimals)).toFixed(4),
                    liquidatePrice: (Number(x.liquidate_price) / Math.pow(10, 8)).toFixed(2), // Price обычно в 8 decimals
                    collateralSymbol: collateralTokenInfo?.symbol || 'Unknown',
                    debtSymbol: debtTokenInfo?.symbol || 'USDA',
                  };
                })
              );
              
              positionInfo = positionInfoWithTokens;
            }
          }
          rawPositionInfo = positionInfoResult;
        } else {
          const errorText = await viewResponse.text();
//console.error("Auro Finance - userPositions: View function error:", viewResponse.status, errorText);
          
          // Если ошибка связана с устаревшими ценами, возвращаем базовую информацию о позициях
          if (viewResponse.status === 400 && errorText.includes("stale")) {
            positionInfo = positions.map((pos: any) => ({
              storage_id: pos.storage_id,
              amount: pos.amount,
              token_name: pos.current_token_data?.token_name || 'Unknown',
              collection_name: pos.current_token_data?.current_collection?.collection_name || 'Unknown',
              error: 'Price data unavailable (stale oracle)'
            }));
          } else {
            rawPositionInfo = { error: `View function error: ${viewResponse.status} - ${errorText}` };
          }
        }
      } catch (error) {
        rawPositionInfo = { error: error instanceof Error ? error.message : "Unknown error" };
      }
    }

    const result = {
      success: true,
      collectionAddress: collectionAddress,
      standardizedCollectionAddress: standardizedAddress,
      positions,
      positionInfo,
      rawPositionInfo,
      message: "Collection address and user positions retrieved successfully"
    };

    return NextResponse.json(result);

  } catch (error) {
    console.error('Auro userPositions error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get collection address', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
} 