import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');

    if (!address) {
      return NextResponse.json(
        { error: 'Address parameter is required' },
        { status: 400 }
      );
    }

    // Fetch account collateral markets data from Aptos blockchain
    const response = await fetch(
      `https://fullnode.mainnet.aptoslabs.com/v1/accounts/${address}/resources`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch resources: ${response.status}`);
    }

    const resources = await response.json();

    // Find the lending::Vault resource
    const vaultResource = resources.find((resource: any) => 
      resource.type === "0xc6bc659f1649553c1a3fa05d9727433dc03843baac29473c817d06d39e7621ba::lending::Vault"
    );

    if (!vaultResource) {
      return NextResponse.json({
        success: true,
        data: {
          hasVault: false,
          message: "No lending vault found for this address"
        }
      });
    }

    // Extract market addresses from vault data
    const marketAddresses = new Set<string>();
    
    if (vaultResource.data.collaterals?.data) {
      vaultResource.data.collaterals.data.forEach((item: any) => {
        marketAddresses.add(item.key.inner);
      });
    }
    
    if (vaultResource.data.liabilities?.data) {
      vaultResource.data.liabilities.data.forEach((item: any) => {
        marketAddresses.add(item.key.inner);
      });
    }

    // Fetch coin information for each market using the correct algorithm
    const marketCoinData = [];
    for (const marketAddress of marketAddresses) {
      try {
        // Step 1: Check if market is Fungible Asset
        const isFaResponse = await fetch(
          `https://fullnode.mainnet.aptoslabs.com/v1/view`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              function: '0xc6bc659f1649553c1a3fa05d9727433dc03843baac29473c817d06d39e7621ba::lending::market_is_fa',
              type_arguments: [],
              arguments: [marketAddress]
            })
          }
        );

        let isFa = false;
        let isCoin = false;
        let coinAddress = 'Unknown';
        let assetMetadata = null;
        let accountCoins = null;

        if (isFaResponse.ok) {
          const isFaResult = await isFaResponse.json();
          isFa = Array.isArray(isFaResult) ? isFaResult[0] : isFaResult;
          
          if (isFa) {
            // Step 2: If it's FA, get asset metadata
            const assetMetadataResponse = await fetch(
              `https://fullnode.mainnet.aptoslabs.com/v1/view`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  function: '0xc6bc659f1649553c1a3fa05d9727433dc03843baac29473c817d06d39e7621ba::lending::market_asset_metadata',
                  type_arguments: [],
                  arguments: [marketAddress]
                })
              }
            );

            if (assetMetadataResponse.ok) {
              const metadataResult = await assetMetadataResponse.json();
              assetMetadata = Array.isArray(metadataResult) ? metadataResult[0] : metadataResult;
              // Extract coin address from asset metadata
              if (assetMetadata && assetMetadata.inner) {
                coinAddress = assetMetadata.inner;
              }
            }
          } else {
            // Step 3: If not FA, check if it's a coin
            const isCoinResponse = await fetch(
              `https://fullnode.mainnet.aptoslabs.com/v1/view`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  function: '0xc6bc659f1649553c1a3fa05d9727433dc03843baac29473c817d06d39e7621ba::lending::market_is_coin',
                  type_arguments: [],
                  arguments: [marketAddress]
                })
              }
            );

            if (isCoinResponse.ok) {
              const isCoinResult = await isCoinResponse.json();
              isCoin = Array.isArray(isCoinResult) ? isCoinResult[0] : isCoinResult;
              
              if (isCoin) {
                // Step 4: If it's a coin, use market_coin function
                const marketCoinResponse = await fetch(
                  `https://fullnode.mainnet.aptoslabs.com/v1/view`,
                  {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      function: '0xc6bc659f1649553c1a3fa05d9727433dc03843baac29473c817d06d39e7621ba::lending::market_coin',
                      type_arguments: [],
                      arguments: [marketAddress]
                    })
                  }
                );

                if (marketCoinResponse.ok) {
                  const coinResult = await marketCoinResponse.json();
                  coinAddress = Array.isArray(coinResult) ? coinResult[0] : coinResult;
                }
              } else {
                // Step 5: If it's neither FA nor coin, mark as unknown type
                coinAddress = 'Unknown market type';
              }
            }
          }
        }

        // Step 6: Get account coins for this market
        const accountCoinsResponse = await fetch(
          `https://fullnode.mainnet.aptoslabs.com/v1/view`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              function: '0xc6bc659f1649553c1a3fa05d9727433dc03843baac29473c817d06d39e7621ba::lending::account_coins',
              type_arguments: [],
              arguments: [address, marketAddress]
            })
          }
        );

        if (accountCoinsResponse.ok) {
          const coinsResult = await accountCoinsResponse.json();
          accountCoins = Array.isArray(coinsResult) ? coinsResult[0] : coinsResult;
        }

        marketCoinData.push({
          marketAddress,
          isFa,
          isCoin,
          coinAddress,
          assetMetadata: isFa ? assetMetadata : null,
          accountCoins
        });

      } catch (error) {
        console.warn(`Error fetching data for market ${marketAddress}:`, error);
        marketCoinData.push({
          marketAddress,
          isFa: 'Error',
          isCoin: 'Error',
          coinAddress: 'Error',
          assetMetadata: null,
          accountCoins: null
        });
      }
    }

    // Transform data to userPositions format
    const userPositions = marketCoinData
      .map(item => ({
        market: item.marketAddress,
        coin: item.isFa ? (item.assetMetadata?.inner || item.coinAddress) : item.coinAddress,
        supply: Number(item.accountCoins) || 0
      }))
      .filter(item => item.supply > 0);

    // Return market addresses, coin mapping, and user positions
    return NextResponse.json({
      success: true,
      data: {
        hasVault: true,
        marketAddresses: Array.from(marketAddresses),
        marketCoinMapping: marketCoinData,
        userPositions
      }
    });

  } catch (error) {
    console.error('Error fetching account collateral markets:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      },
      { status: 500 }
    );
  }
} 