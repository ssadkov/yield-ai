# Adding New Pools to Investment Ideas

This document explains how the investment ideas system works and how to add new pools from different APIs.

## Current System Overview

The investment ideas system currently works as follows:

1. **Data Sources**: Pools data is fetched from multiple API sources
2. **Data Format**: All pools must conform to the `InvestmentData` interface
3. **Display**: Pools are displayed in the `InvestmentsDashboard` component
4. **Filtering**: Pools are filtered by category (Stables, Fundamentals, etc.)

## Current Data Flow

```
External APIs → PoolsService → /api/aptos/pools → InvestmentsDashboard
```

## Built-in APIs

### Hyperion Protocol API

We have a complete built-in API for Hyperion protocol:

- **All Pools**: `GET /api/protocols/hyperion/pools`
- **Pool by ID**: `GET /api/protocols/hyperion/pools/[poolId]`
- **Pool by Tokens**: `GET /api/protocols/hyperion/pools/by-tokens?token1=...&token2=...&feeTier=...`
- **User Positions**: `GET /api/protocols/hyperion/userPositions?address=...`

Hyperion pools are automatically included in the investment ideas system and transformed to the correct format.

### Testing Hyperion Integration

Visit `/test-hyperion` to test the Hyperion pools integration and see the transformation from raw data to InvestmentData format.

## How to Add New Pools

### Step 1: Understand the Data Format

All pools must match the `InvestmentData` interface:

```typescript
interface InvestmentData {
  asset: string;        // Token symbol (e.g., "APT", "USDC")
  provider: string;     // Bridge or provider name
  totalAPY: number;     // Total APY percentage
  depositApy: number;   // Deposit APY percentage
  borrowAPY: number;    // Borrow APY percentage (negative for borrowing)
  token: string;        // Token address
  protocol: string;     // Protocol name (e.g., "Echelon", "Joule")
}
```

### Step 2: Add Your API Source

1. **Edit the configuration file**: `src/lib/config/poolsConfig.ts`

```typescript
export const poolSources: PoolSource[] = [
  // ... existing sources
  {
    name: 'Your Protocol API',
    url: 'https://your-api.com/pools',
    enabled: true,
    transform: (data: any) => {
      // Transform your API response to InvestmentData format
      return (data.pools || []).map((pool: any) => ({
        asset: pool.tokenSymbol,
        provider: pool.provider || 'Your Protocol',
        totalAPY: pool.totalAPY,
        depositApy: pool.depositAPY,
        borrowAPY: pool.borrowAPY,
        token: pool.tokenAddress,
        protocol: pool.protocolName || 'Your Protocol'
      }));
    }
  }
];
```

### Step 3: Ensure Your API Returns the Right Format

Your API should return data in one of these formats:

**Option A: Direct InvestmentData format**
```json
{
  "data": [
    {
      "asset": "APT",
      "provider": "Your Protocol",
      "totalAPY": 12.5,
      "depositApy": 10.2,
      "borrowAPY": -2.3,
      "token": "0x1::aptos_coin::AptosCoin",
      "protocol": "Your Protocol"
    }
  ]
}
```

**Option B: Custom format with transform function**
```json
{
  "pools": [
    {
      "tokenSymbol": "APT",
      "tokenAddress": "0x1::aptos_coin::AptosCoin",
      "totalAPY": 12.5,
      "depositAPY": 10.2,
      "borrowAPY": -2.3,
      "protocolName": "Your Protocol"
    }
  ]
}
```

### Step 4: Add Protocol to Protocols List (Optional)

If you want your protocol to appear in the protocols management section, add it to `src/lib/data/protocolsList.json`:

```json
{
  "name": "Your Protocol",
  "category": "Lending",
  "url": "https://yourprotocol.com",
  "logoUrl": "https://yourprotocol.com/logo.png",
  "description": "Description of your protocol",
  "depositType": "native",
  "isDepositEnabled": true,
  "managedType": "native"
}
```

### Step 5: Test Your Integration

1. Start your development server
2. Navigate to `/test-pools` to test your API source
3. Navigate to the dashboard to see your pools in investment ideas
4. Check the browser console for any errors

## Example Implementation

See `src/lib/examples/newProtocolExample.ts` for a complete example.

## Troubleshooting

### Common Issues

1. **Pools not appearing**: Check that your API is accessible and returns the correct format
2. **Transform errors**: Ensure your transform function handles all possible data structures
3. **Protocol not showing**: Verify the protocol name matches exactly in the configuration

### Debug Steps

1. Check browser console for errors
2. Verify API endpoint is accessible
3. Test your API response format using `/test-pools`
4. Check that all required fields are present

## Current Supported Protocols

- **Hyperion** (built-in API)
- Echelon
- Joule
- Aries
- Tapp Exchange
- Meso Finance
- **Auro Finance** (placeholder implementation)

## Adding New Categories

To add new pool categories (like "DeFi", "Staking", etc.), modify the `InvestmentsDashboard.tsx` component and add new filtering logic in the appropriate sections.

## Testing Tools

- `/test-pools` - Test any API source with custom transform functions
- `/test-hyperion` - Test Hyperion pools integration specifically 