# Echelon Integration Documentation

## Overview
Echelon protocol has been successfully integrated into the YieldAI Ideas system, providing lending and borrowing pool data alongside other DeFi protocols.

## Integration Components

### 1. API Endpoint
- **Route**: `/api/protocols/echelon/v2/pools`
- **Purpose**: Fetches and transforms Echelon market data into standardized InvestmentData format
- **Source**: `https://app.echelon.market/api/markets?network=aptos_mainnet`

### 2. Data Transformation
The API transforms Echelon's raw market data into the standardized `InvestmentData` format:

```typescript
interface InvestmentData {
  asset: string;           // Token symbol (e.g., "USDC", "APT")
  provider: string;        // "Echelon"
  totalAPY: number;        // Combined supply/borrow APR + rewards
  depositApy: number;      // Supply APR + supply rewards
  borrowAPY: number;       // Borrow APR + borrow rewards
  token: string;           // Token address (faAddress || address)
  protocol: string;        // "Echelon"
  poolType: string;        // "Lending"
  tvlUSD: number;          // Total Value Locked
  dailyVolumeUSD: number;  // 0 (Echelon doesn't provide volume)
  
  // Echelon-specific fields
  supplyCap?: number;
  borrowCap?: number;
  supplyRewardsApr?: number;
  borrowRewardsApr?: number;
  marketAddress?: string;
  totalSupply?: number;
  totalBorrow?: number;
}
```

### 3. Pool Configuration
Added to `src/lib/config/poolsConfig.ts`:
```typescript
{
  name: 'Echelon Markets API v2',
  url: '/api/protocols/echelon/v2/pools',
  enabled: true,
  transform: (data: any) => data.data || []
}
```

### 4. Dashboard Integration
- **Lite Tab**: Shows stable token pools (USDC, USDT, etc.) with native deposit support
- **Pro Tab**: Shows all Echelon pools with full filtering and search capabilities
- **Filtering**: Echelon pools are considered "stable" for filtering purposes

## Key Features

### Dual Pool Creation
For each Echelon asset, two separate pool entries are created:
1. **Supply Pool**: For depositing assets (positive APY)
2. **Borrow Pool**: For borrowing assets (negative APY)

### Rewards Integration
- Calculates supply and borrow rewards APR from farming data
- Combines base APR with rewards APR for total returns
- Supports multiple reward tokens (APT, thAPT, USDC, etc.)

### Token Address Handling
- Uses `faAddress` when available (for tokens like APT)
- Falls back to `address` for other tokens
- Ensures proper token info lookup in the dashboard

### Market Activity Filtering
- Excludes markets with zero supply/borrow caps AND no activity
- Includes markets with activity even if caps are zero
- Provides comprehensive market coverage

## Testing

### Test Pages
1. **`/test-echelon-new`**: Original Echelon API testing with detailed table
2. **`/test-echelon-integration`**: Integration testing with Ideas system
3. **`/dashboard`**: Main dashboard with Echelon pools in both Lite and Pro tabs

### API Testing
```bash
# Test Echelon v2 API directly
curl http://localhost:3000/api/protocols/echelon/v2/pools

# Test full integration
curl http://localhost:3000/api/aptos/pools
```

## Data Flow

```
Echelon API → /api/protocols/echelon/v2/pools → poolsConfig.ts → InvestmentsDashboard
```

1. **Fetch**: Raw data from Echelon API
2. **Transform**: Convert to InvestmentData format
3. **Filter**: Apply business logic and exclusions
4. **Display**: Show in dashboard with proper token info

## Excluded Tokens
Certain Echelon tokens are excluded from display:
- `0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::USDT`
- `0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::USDC`
- `0x2b3be0a97a73c87ff62cbdd36837a9fb5bbd1d7f06a73b7ed62ec15c5326c1b8`
- `0x5e156f1207d0ebfa19a9eeff00d62a282278fb8719f4fab3a586a0a2c0fffbea::coin::T`
- `0x54fc0d5fa5ad975ede1bf8b1c892ae018745a1afd4a4da9b70bb6e5448509fc0`

## Performance
- **Caching**: 30-second cache with 60-second stale-while-revalidate
- **Progressive Loading**: Loads alongside other protocols
- **Error Handling**: Graceful fallback for API failures

## Future Enhancements
- User position integration
- Deposit/withdraw functionality
- Real-time price updates
- Advanced filtering options 