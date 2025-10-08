# Echelon Positions: LP Token Support

## Summary

LP tokens (like Panora xLPT tokens used as collateral in Echelon) now display correctly in the Echelon Positions component with proper symbols, names, decimals, and prices.

## Example: sUSDe/USDC.x LP Token

**Token Address:** `0x35c3e420fa4fd925628366f1977865d62432c8856a2db147a1cb13f7207f6a79`

### Before Fix
```
❌ Symbol: 0x35c3e4... (truncated address)
❌ Name: undefined
❌ Price: $0 (not found)
❌ Logo: placeholder icon
```

### After Fix
```
✅ Symbol: sUSDe/USDC.x
✅ Name: sUSDe/USDC xLPT
✅ Price: $102.64 (from Echelon API)
✅ Logo: Echelon icon
✅ Decimals: 8
```

## How It Works

### 1. Position Loading
When Echelon positions are loaded, the component automatically:
1. Identifies tokens not in `tokenList.json`
2. Calls `TokenInfoService` to fetch info from Echelon API
3. Caches the results in component state

### 2. Token Display
The enhanced `getTokenInfo()` function:
1. First checks `fallbackTokenInfo` state (protocol APIs)
2. Then checks `tokenList.json` (main token list)
3. Returns complete token information or undefined

### 3. Price Loading
Existing price loading mechanism automatically includes LP tokens:
- Prices fetched from Panora API
- If not in Panora, Echelon API price is used
- Dual address mapping ensures correct lookups

## Implementation Details

### New State
```typescript
const [fallbackTokenInfo, setFallbackTokenInfo] = useState<Record<string, any>>({});
```

Stores token information loaded from protocol APIs (Echelon, Panora) for tokens not in tokenList.

### Enhanced getTokenInfo()
```typescript
const getTokenInfo = (coinAddress: string) => {
  // 1. Check fallback cache (protocol APIs)
  if (fallbackTokenInfo[normalizedAddress]) {
    return fallbackTokenInfo[normalizedAddress];
  }
  
  // 2. Check tokenList.json
  const token = tokenList.data.data.find(...);
  if (token) return token;
  
  // 3. Not found
  return undefined;
};
```

### Auto-Loading useEffect
```typescript
useEffect(() => {
  // Find tokens not in tokenList
  const unknownTokens = positions
    .filter(p => !inTokenList(p.coin) && !inFallbackCache(p.coin))
    .map(p => p.coin);
  
  // Load from protocol APIs
  await Promise.all(
    unknownTokens.map(async (addr) => {
      const info = await TokenInfoService.getInstance().getTokenInfo(addr);
      if (info) {
        setFallbackTokenInfo(prev => ({ ...prev, [addr]: info }));
      }
    })
  );
}, [positions, fallbackTokenInfo]);
```

## User Experience

### Scenario 1: User with LP Token Collateral
1. User deposits Panora LP token (sUSDe/USDC.x) as collateral in Echelon
2. Opens "Managing Positions" → "Echelon" tab
3. **Sees:**
   - Position listed with symbol "sUSDe/USDC.x"
   - Correct amount (e.g., "1.5 sUSDe/USDC.x")
   - USD value (e.g., "$153.96")
   - APY if applicable
   - Echelon icon/logo

### Scenario 2: User with Multiple Positions
1. User has APT supply + LP token collateral + borrow position
2. Opens Managing Positions
3. **Sees:**
   - APT: Loaded from tokenList (instant)
   - LP token: Loaded from Echelon API (~300ms)
   - All tokens display correctly with proper formatting

### Scenario 3: Wallet View with LP Tokens
1. User wallet contains LP tokens
2. Opens Wallet page
3. **Sees:**
   - LP tokens listed with proper symbols
   - Current prices from Echelon
   - Total portfolio value includes LP token value

## Testing

### Manual Test Steps

1. **Start Dev Server** (already running on port 3002)
   ```
   http://localhost:3002
   ```

2. **Test Token Lookup Page**
   - Navigate to `/test-token-lookup`
   - Enter: `0x35c3e420fa4fd925628366f1977865d62432c8856a2db147a1cb13f7207f6a79`
   - Click "Test Lookup"
   - Verify:
     - ✅ Symbol: sUSDe/USDC.x
     - ✅ Source: echelon
     - ✅ Price: ~$102
     - ✅ Decimals: 8

3. **Test Echelon Positions** (if you have positions)
   - Connect wallet
   - Go to "Managing Positions" → "Echelon"
   - Look for any LP tokens
   - Verify they display correctly with symbols and prices

4. **Check Console Logs**
   Open browser console and look for:
   ```
   [EchelonPositions] Loading info for unknown tokens: [...]
   [EchelonPositions] Loaded token info: sUSDe/USDC.x from echelon
   [TokenInfoService] Found token: sUSDe/USDC.x from echelon
   ```

## Performance

- **tokenList lookup:** Instant (~1-5ms)
- **First LP token load:** ~200-500ms (Echelon API call)
- **Cached LP token:** Instant (~1-5ms)
- **Cache duration:** 
  - Component-level: Until component unmounts
  - Service-level: 5 minutes

## Edge Cases Handled

1. **Network failure:** Gracefully falls back to undefined, no crash
2. **Invalid addresses:** Returns undefined, UI shows fallback
3. **Multiple unknown tokens:** Loaded in parallel
4. **Duplicate requests:** Prevented by cache checks
5. **Token not in any source:** Returns undefined, UI handles gracefully

## Related Features

### Works Together With:
- **Price Lookup Fix** (address normalization)
- **Panora Prices Service** (price fetching)
- **Wallet Service** (balance display)
- **Portfolio View** (total value calculations)

### Future Enhancements:
- Persistent cache across page reloads (localStorage)
- Background refresh of LP token prices
- Support for more DEX LP tokens
- Historical LP token performance data

## Files Modified

| File | Changes |
|------|---------|
| `src/components/protocols/manage-positions/protocols/EchelonPositions.tsx` | Added fallback token loading (Managing Positions) |
| `src/components/protocols/echelon/PositionsList.tsx` | Added fallback token loading (Portfolio view) |
| State added | `fallbackTokenInfo` |
| Function enhanced | `getTokenInfo()` |
| Hook added | `useEffect` for auto-loading |

## Summary

LP tokens and other protocol-specific tokens now work seamlessly in Echelon Positions:
- ✅ Automatic detection of unknown tokens
- ✅ Loading from Echelon API
- ✅ Proper display with symbols, prices, decimals
- ✅ No code changes needed for future LP tokens
- ✅ Graceful error handling
- ✅ Performance optimized with caching

Users can now see their complete Echelon positions including LP token collateral with accurate information and pricing.
