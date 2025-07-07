import { NextRequest, NextResponse } from "next/server";
import { Aptos, Network, InputViewFunctionData, AptosConfig } from "@aptos-labs/ts-sdk";

// Auro Finance contract addresses (mainnet)
const AURO_ADDRESS = "0x50a340a19e6ada1be07192c042786ca6a9651d5c845acc8727e8c6416a56a32c";
const AURO_ROUTER_ADDRESS = "0x50a340a19e6ada1be07192c042786ca6a9651d5c845acc8727e8c6416a56a32c";

// Helper function to standardize address format
function standardizeAddress(address: string): string {
  return address.startsWith("0x") ? address : `0x${address}`;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get("address");
    if (!walletAddress) {
      return NextResponse.json({ error: "Address parameter is required" }, { status: 400 });
    }

    const aptosConfig = new AptosConfig({
      network: Network.MAINNET,
      fullnode: "https://fullnode.mainnet.aptoslabs.com"
    });
    const aptos = new Aptos(aptosConfig);

    // Step 1: Get collection address
    const payload: InputViewFunctionData = {
      function: `${AURO_ADDRESS}::auro_pool::position_nft_collection`,
      typeArguments: [],
      functionArguments: [],
    };
    const [collectionAddress] = await aptos.view({ payload }) as [string];

    // Step 2: Get all tokens owned from this collection (use fetch to indexer)
    const graphqlQuery = {
      query: `query GetTokens($owner: String!, $collection: String!) {
        current_token_ownerships_v2(where: {owner_address: {_eq: $owner}, collection_address: {_eq: $collection}, amount: {_gt: "0"}}) {
          storage_id
        }
      }`,
      variables: {
        owner: walletAddress,
        collection: standardizeAddress(collectionAddress)
      }
    };
    const resp = await fetch("https://indexer.mainnet.aptoslabs.com/v1/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(graphqlQuery)
    });
    const data = await resp.json();
    const positions = (data.data?.current_token_ownerships_v2 || []).map((x: any) => x.storage_id);

    return NextResponse.json({ positions });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to fetch user positions" }, { status: 500 });
  }
}

// Step 2: Get position info (collateral, debt, liquidation price)
async function getPositionInfo(positionsAddress: string[]): Promise<any[]> {
  try {
    console.log("Getting position info for addresses:", positionsAddress);
    
    if (positionsAddress.length === 0) {
      return [];
    }

    // Call the view function to get position info
    const viewPayload = {
      function: `${AURO_ROUTER_ADDRESS}::auro_view::multiple_position_info`,
      type_arguments: [],
      arguments: [positionsAddress]
    };

    console.log("Calling view function:", viewPayload.function);
    
    const viewResponse = await fetch('https://fullnode.mainnet.aptoslabs.com/v1/view', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(viewPayload)
    });

    if (viewResponse.ok) {
      const viewData = await viewResponse.json();
      console.log("View function response:", viewData);
      
      if (viewData && Array.isArray(viewData)) {
        return viewData.map((position: any, index: number) => ({
          address: positionsAddress[index],
          collateralAmount: position.asset_amount ? (parseInt(position.asset_amount) / 1e8).toFixed(2) : "0",
          debtAmount: position.debt_amount ? (parseInt(position.debt_amount) / 1e8).toFixed(2) : "0",
          liquidatePrice: position.liquidate_price ? (parseInt(position.liquidate_price) / 1e8).toFixed(2) : "0",
        }));
      }
    }

    // If view function fails, try to get basic info from indexer
    console.log("View function failed, getting basic info from indexer");
    const positionPromises = positionsAddress.map(async (address) => {
      const positionQuery = `
        query GetPosition($address: String!) {
          current_token_ownerships_v2(
            where: {
              storage_id: {_eq: $address}
            }
          ) {
            token_data_id
            amount
            token_name
            last_transaction_timestamp
          }
        }
      `;

      const positionResponse = await fetch('https://indexer.mainnet.aptoslabs.com/v1/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          query: positionQuery,
          variables: { address }
        })
      });

      if (positionResponse.ok) {
        const positionData = await positionResponse.json();
        console.log("Position data for", address, ":", positionData);
        
        if (positionData.data?.current_token_ownerships_v2?.[0]) {
          const position = positionData.data.current_token_ownerships_v2[0];
          return {
            address,
            collateralAmount: position.amount ? (parseInt(position.amount) / 1e8).toFixed(2) : "0",
            debtAmount: "0", // Need to get from view function
            liquidatePrice: "0", // Need to get from view function
          };
        }
      }
      
      return {
        address,
        collateralAmount: "0",
        debtAmount: "0", 
        liquidatePrice: "0",
      };
    });

    const positionResults = await Promise.all(positionPromises);
    return positionResults;

  } catch (error) {
    console.error("Error getting position info:", error);
    // Return empty data as fallback
    return positionsAddress.map((address) => ({
      address,
      collateralAmount: "0",
      debtAmount: "0",
      liquidatePrice: "0",
    }));
  }
}

// Step 3: Get rewards for each position
async function getPositionRewards(
  positionsAddress: string[],
  rewardPoolsAddress: string[]
): Promise<any[]> {
  try {
    console.log("Getting rewards for positions:", positionsAddress);
    console.log("Reward pools:", rewardPoolsAddress);
    
    if (positionsAddress.length === 0) {
      return [];
    }

    // Call the view function to get claimable rewards
    const viewPayload = {
      function: `${AURO_ADDRESS}::rewards_pool::get_multiple_claimable_rewards`,
      type_arguments: [],
      arguments: [positionsAddress, rewardPoolsAddress]
    };

    console.log("Calling rewards view function:", viewPayload.function);
    
    const viewResponse = await fetch('https://fullnode.mainnet.aptoslabs.com/v1/view', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(viewPayload)
    });

    if (viewResponse.ok) {
      const viewData = await viewResponse.json();
      console.log("Rewards view function response:", viewData);
      
      if (viewData && Array.isArray(viewData)) {
        return viewData.map((reward: any) => ({
          key: reward.key || "Unknown",
          value: reward.value ? (parseInt(reward.value) / 1e8).toFixed(2) : "0"
        }));
      }
    }

    // If view function fails, return empty rewards
    console.log("Rewards view function failed, returning empty rewards");
    return [];

  } catch (error) {
    console.error("Error getting rewards:", error);
    return [];
  }
} 