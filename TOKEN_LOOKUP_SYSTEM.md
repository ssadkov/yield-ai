# Universal Token Lookup System

## Overview

A comprehensive token information lookup system with automatic fallback to protocol APIs when tokens are not found in the main token list. This solves the problem of displaying LP tokens, protocol-specific tokens, and newly added tokens that aren't yet in `tokenList.json`.

## Problem Statement

### Before
- **LP tokens** (like Panora xLPT tokens) showed as "unknown" with no price
- **Protocol-specific tokens** from Echelon had no metadata
- **Wallet balances** couldn't display proper info for tokens not in tokenList
- **Position components** threw errors when encountering unknown tokens

### After
- ✅ Automatic fallback to protocol APIs (Echelon, Panora)
- ✅ LP tokens show correct symbol, name, decimals, and price
- ✅ Protocol-specific tokens fully supported
- ✅ 5-minute caching to prevent excessive API calls
- ✅ Works seamlessly in wallet service and position components

## Architecture

```
┌─────────────────────────────────────────────────────┐
│ Client Request: getTokenInfo(address)               │
└──────────────────┬──────────────────────────────────┘
                   │
                   ↓
┌─────────────────────────────────────────────────────┐
│ 1. Check tokenList.json (Fast Path)                │
│    - Common tokens: APT, USDC, USDT, etc.          │
│    - Instant lookup, no API call                    │
└──────────────────┬──────────────────────────────────┘
                   │ Not found?
                   ↓
┌─────────────────────────────────────────────────────┐
│ 2. Check Memory Cache (5 min TTL)                  │
│    - Recently fetched tokens                        │
│    - Prevents duplicate API calls                   │
└──────────────────┬──────────────────────────────────┘
                   │ Not cached?
                   ↓
┌─────────────────────────────────────────────────────┐
│ 3. API Endpoint: /api/tokens/info                  │
│    ↓                                                │
│    ├─ Try Echelon API (LP tokens, collateral)      │
│    ├─ Try Panora API (general tokens)              │
│    └─ Return 404 if not found                      │
└──────────────────┬──────────────────────────────────┘
                   │ Found!
                   ↓
┌─────────────────────────────────────────────────────┐
│ 4. Cache & Return Result                           │
│    - Store in memory cache                          │
│    - Return normalized token info                   │
└─────────────────────────────────────────────────────┘
```

## Components

### 1. API Endpoint (`/api/tokens/info`)

**Location:** `src/app/api/tokens/info/route.ts`

Universal token lookup endpoint that checks multiple sources:
- `tokenList.json` (local, instant)
- Echelon API (LP tokens, protocol-specific tokens)
- Panora API (general token information)

**Usage:**
```typescript
GET /api/tokens/info?address=0x35c3e420fa4fd925628366f1977865d62432c8856a2db147a1cb13f7207f6a79

Response:
{
  "success": true,
  "data": {
    "address": "0x35c3e420fa4fd925628366f1977865d62432c8856a2db147a1cb13f7207f6a79",
    "symbol": "sUSDe/USDC.x",
    "name": "sUSDe/USDC xLPT",
    "decimals": 8,
    "price": 102.64,
    "logoUrl": "https://app.echelon.market/assets/icons/xlpt_susde_usdc.png",
    "source": "echelon",
    "market": "0x9c22785c5247e8bc491b2c19f25bbc313c5cd683a23a736bb358195bfbe81f1"
  }
}
```

### 2. TokenInfoService

**Location:** `src/lib/services/tokenInfoService.ts`

Singleton service for token information lookup with built-in caching.

**Features:**
- Memory cache with 5-minute TTL
- Batch token lookup support
- Automatic cache management
- Error handling and fallbacks

**Usage:**
```typescript
import { TokenInfoService } from '@/lib/services/tokenInfoService';

const service = TokenInfoService.getInstance();

// Single token lookup
const tokenInfo = await service.getTokenInfo('0x35c3e420...');

// Batch lookup
const tokens = await service.getTokenInfoBatch([
  '0x35c3e420...',
  '0xf22bede2...'
]);

// Clear cache (for testing or forced refresh)
service.clearCache();
```

### 3. Token Registry Extension

**Location:** `src/lib/tokens/tokenRegistry.ts`

Extended with `getTokenInfoWithFallback()` function that wraps the existing `getTokenInfo()` with protocol API fallbacks.

**Usage:**
```typescript
import { getTokenInfo, getTokenInfoWithFallback } from '@/lib/tokens/tokenRegistry';

// Old way (throws error if not found)
try {
  const token = await getTokenInfo('0x35c3e420...');
} catch (error) {
  // Token not in tokenList
}

// New way (returns null if not found, tries protocol APIs)
const token = await getTokenInfoWithFallback('0x35c3e420...');
if (token) {
  console.log('Found:', token.symbol);
} else {
  console.log('Not found in any source');
}
```

### 4. Wallet Service Integration

**Location:** `src/lib/services/wallet-api.ts`

Updated to use `TokenInfoService` for unknown tokens when displaying wallet balances.

**Flow:**
1. Fetch wallet balances from Aptos
2. Get prices from Panora API (for known tokens)
3. For unknown tokens → fallback to `TokenInfoService`
4. Display all tokens with proper metadata and prices

### 5. Position Components Integration

**Location:** `src/components/protocols/manage-positions/protocols/EchelonPositions.tsx`

Added automatic loading of unknown token information via `TokenInfoService`.

**Implementation:**
1. New state: `fallbackTokenInfo` - stores token info from protocol APIs
2. `useEffect` hook - detects unknown tokens and loads their info on mount
3. Enhanced `getTokenInfo()` - checks fallback cache before tokenList
4. Automatic price loading for all tokens including LP tokens

**Benefits:**
- ✅ LP tokens show correct symbols (e.g., "sUSDe/USDC.x")
- ✅ Prices loaded from Echelon API
- ✅ Proper decimals for amount calculations
- ✅ Logo display from protocol source
- ✅ No more "unknown token" or undefined errors

**Flow:**
```
1. User opens Echelon positions
2. Positions loaded with coin addresses
3. System checks each token:
   - If in tokenList → use immediately
   - If NOT in tokenList → load via TokenInfoService
4. Unknown tokens loaded from Echelon API
5. Cached in component state (fallbackTokenInfo)
6. Prices fetched via existing price loading mechanism
7. UI displays all tokens correctly
```

## Supported Token Sources

### 1. tokenList.json (Primary)
- **Tokens:** Main tokens (APT, USDC, USDT, etc.)
- **Speed:** Instant (local file)
- **Accuracy:** High (curated list)
- **Updates:** Manual via update script

### 2. Echelon API (Fallback #1)
- **Tokens:** LP tokens, collateral tokens, Echelon markets
- **Speed:** ~200-500ms
- **Accuracy:** High (source of truth for Echelon)
- **Updates:** Real-time from protocol
- **Example:** `sUSDe/USDC.x` LP token

### 3. Panora API (Fallback #2)
- **Tokens:** General Aptos tokens, DEX tokens
- **Speed:** ~300-600ms
- **Accuracy:** High
- **Updates:** Real-time from DEX
- **Example:** New tokens added to Panora

## Test Page

**Location:** `/test-token-lookup`

Interactive test page for the token lookup system.

**Features:**
- Test any token address
- Quick test buttons for common cases
- Displays full token information
- Shows data source (tokenList, echelon, panora)
- JSON response viewer

**Test Cases:**
1. **Echelon LP Token:** `0x35c3e420fa4fd925628366f1977865d62432c8856a2db147a1cb13f7207f6a79`
   - Symbol: sUSDe/USDC.x
   - Source: Echelon API
   
2. **APT (tokenList):** `0xa`
   - Symbol: APT
   - Source: tokenList
   
3. **USDC (tokenList):** `0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa`
   - Symbol: USDC
   - Source: tokenList

## Example: LP Token Lookup

### Token Details
- **Address:** `0x35c3e420fa4fd925628366f1977865d62432c8856a2db147a1cb13f7207f6a79`
- **Symbol:** `sUSDe/USDC.x`
- **Name:** `sUSDe/USDC xLPT`
- **Type:** Panora concentrated liquidity LP token
- **Decimals:** 8
- **Price:** $102.64 (from Echelon)
- **Source:** Echelon API

### Where It's Used
1. **Echelon Markets:** As collateral in lending positions
2. **Wallet Balances:** Users who hold LP tokens
3. **Portfolio View:** Total value calculations

### Lookup Flow
```
1. Check tokenList.json → Not found (LP token not in main list)
2. Check Echelon API → Found!
   {
     "symbol": "sUSDe/USDC.x",
     "name": "sUSDe/USDC xLPT",
     "price": 102.64,
     "decimals": 8
   }
3. Cache for 5 minutes
4. Return to caller
```

## Performance & Caching

### Cache Strategy
- **Location:** In-memory (TokenInfoService)
- **TTL:** 5 minutes
- **Key:** Normalized token address
- **Invalidation:** Automatic after TTL

### API Call Optimization
- **Batch requests:** Support for multiple tokens at once
- **Deduplication:** Same token requested multiple times uses cache
- **Parallel requests:** Multiple different tokens fetched in parallel

### Performance Metrics
- **tokenList lookup:** ~1-5ms (instant)
- **Cached lookup:** ~1-5ms (instant)
- **Echelon API:** ~200-500ms (first call)
- **Panora API:** ~300-600ms (first call)

## Usage Examples

### In React Components

```typescript
import { TokenInfoService } from '@/lib/services/tokenInfoService';

function MyComponent() {
  const [tokenInfo, setTokenInfo] = useState(null);
  
  useEffect(() => {
    const loadToken = async () => {
      const service = TokenInfoService.getInstance();
      const info = await service.getTokenInfo('0x35c3e420...');
      setTokenInfo(info);
    };
    loadToken();
  }, []);
  
  return (
    <div>
      {tokenInfo && (
        <>
          <span>{tokenInfo.symbol}</span>
          <span>${tokenInfo.price}</span>
        </>
      )}
    </div>
  );
}
```

### In API Routes

```typescript
import { TokenInfoService } from '@/lib/services/tokenInfoService';

export async function GET(request: Request) {
  const address = new URL(request.url).searchParams.get('address');
  
  const service = TokenInfoService.getInstance();
  const tokenInfo = await service.getTokenInfo(address);
  
  if (!tokenInfo) {
    return NextResponse.json({ error: 'Token not found' }, { status: 404 });
  }
  
  return NextResponse.json({ data: tokenInfo });
}
```

### In Utility Functions

```typescript
import { getTokenInfoWithFallback } from '@/lib/tokens/tokenRegistry';

async function calculatePortfolioValue(tokens: string[]) {
  let total = 0;
  
  for (const tokenAddress of tokens) {
    const info = await getTokenInfoWithFallback(tokenAddress);
    if (info && info.usdPrice) {
      total += parseFloat(info.usdPrice);
    }
  }
  
  return total;
}
```

## Error Handling

### Graceful Degradation
1. **tokenList fails** → Try protocol APIs
2. **Echelon API fails** → Try Panora API
3. **All sources fail** → Return null (display fallback UI)

### Logging
- All lookups logged with source information
- Cache hits/misses tracked
- API failures logged with context

## Future Enhancements

### Potential Improvements
1. **More Protocol APIs:** Add support for more DEXes and protocols
2. **Persistent Cache:** Redis or database caching for longer TTL
3. **Background Updates:** Periodically refresh cached tokens
4. **Token Registry Service:** Centralized token registry with subscriptions
5. **Historical Prices:** Store price history for charts

### Protocol Integration Ideas
- Aries Markets
- Thala Protocol
- Liquidswap
- PancakeSwap (Aptos)

## Testing

### Manual Testing
1. Navigate to `/test-token-lookup`
2. Test with LP token: `0x35c3e420fa4fd925628366f1977865d62432c8856a2db147a1cb13f7207f6a79`
3. Verify data is fetched from Echelon
4. Check price, symbol, decimals are correct

### Integration Testing
1. Go to wallet page with LP tokens
2. Verify tokens display correctly
3. Check portfolio calculations
4. Test position components in Echelon

### Edge Cases
- Invalid addresses → 404 error
- Network failures → Fallback to next source
- Missing prices → Show $0 but still display token info
- Very long addresses → Normalized correctly

## Files Modified/Created

| File | Type | Description |
|------|------|-------------|
| `src/app/api/tokens/info/route.ts` | ✨ Created | Universal token info API endpoint |
| `src/lib/services/tokenInfoService.ts` | ✨ Created | Token info service with caching |
| `src/lib/tokens/tokenRegistry.ts` | 🔧 Updated | Added `getTokenInfoWithFallback()` |
| `src/lib/services/wallet-api.ts` | 🔧 Updated | Integrated fallback for unknown tokens |
| `src/components/protocols/manage-positions/protocols/EchelonPositions.tsx` | 🔧 Updated | Added fallback support |
| `src/app/test-token-lookup/page.tsx` | ✨ Created | Test page for token lookup |
| `src/components/TestNavigation.tsx` | 🔧 Updated | Added test page to navigation |
| `TOKEN_LOOKUP_SYSTEM.md` | ✨ Created | This documentation |

## Related Documentation

- [PRICE_LOOKUP_FIX.md](./PRICE_LOOKUP_FIX.md) - Address normalization system
- [ECHELON_INTEGRATION.md](./ECHELON_INTEGRATION.md) - Echelon protocol integration

## Summary

The Universal Token Lookup System provides a robust, scalable solution for token information retrieval across multiple sources. It seamlessly handles LP tokens, protocol-specific tokens, and new tokens without requiring manual updates to `tokenList.json`. The system includes intelligent caching, error handling, and graceful degradation to ensure a smooth user experience even when external APIs are unavailable.

**Key Benefits:**
- 🚀 Automatic fallback to protocol APIs
- 💰 Accurate prices for LP tokens
- 🔄 Smart caching (5-minute TTL)
- 🛡️ Graceful error handling
- 📊 Works everywhere (wallet, positions, portfolio)
- 🧪 Easy to test and debug
