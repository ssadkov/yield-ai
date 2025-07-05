import { PoolSource } from '@/lib/services/pools/poolsService';
import { addPoolSource } from '@/lib/config/poolsConfig';

// Example: How to add a new protocol to the pools system

// Step 1: Define the new protocol source
const newProtocolSource: PoolSource = {
  name: 'New Protocol',
  url: 'https://api.newprotocol.com/pools', // Replace with your actual API URL
  enabled: true,
  transform: (data: any) => {
    // Transform the API response to match InvestmentData format
    // This function should convert your API's data structure to the expected format
    
    return (data.pools || []).map((pool: any) => ({
      asset: pool.tokenSymbol || pool.asset,
      provider: pool.protocol || 'New Protocol',
      totalAPY: pool.totalAPY || pool.apy || 0,
      depositApy: pool.depositAPY || pool.supplyAPY || 0,
      borrowAPY: pool.borrowAPY || 0,
      token: pool.tokenAddress || pool.address,
      protocol: pool.protocolName || 'New Protocol'
    }));
  }
};

// Step 2: Add the source to the configuration
// Uncomment the line below to add the new protocol
// addPoolSource(newProtocolSource);

// Example API response structure that your new protocol should return:
/*
{
  "pools": [
    {
      "tokenSymbol": "APT",
      "tokenAddress": "0x1::aptos_coin::AptosCoin",
      "totalAPY": 12.5,
      "depositAPY": 10.2,
      "borrowAPY": -2.3,
      "protocol": "New Protocol",
      "protocolName": "New Protocol"
    }
  ]
}
*/

// Step 3: If you need to add the protocol to the protocols list, update protocolsList.json
// Add this entry to src/lib/data/protocolsList.json:
/*
{
  "name": "New Protocol",
  "category": "Lending", // or "DEX", "Staking", etc.
  "url": "https://newprotocol.com",
  "logoUrl": "https://newprotocol.com/logo.png",
  "description": "Description of the new protocol",
  "depositType": "native", // or "external"
  "isDepositEnabled": true,
  "managedType": "native" // or "external"
}
*/

export { newProtocolSource }; 