# Managing Positions: LP Token Price Fix

## Проблема
В **Echelon Managing Positions** LP токены отображались с правильным символом и логотипом, но ценой $0.00, потому что цены загружались только из Panora API.

## Решение
Добавлен fallback для цен из Echelon API в компонент `EchelonPositions.tsx` (Managing Positions).

## Что исправлено

### 1. Enhanced Price Loading in Managing Positions
```typescript
// Before: Only Panora API
const response = await pricesService.getPrices(1, addresses);
const prices = createDualAddressPriceMap(response.data);
setTokenPrices(prices);

// After: Panora API + Echelon API fallback
const response = await pricesService.getPrices(1, addresses);
let prices = createDualAddressPriceMap(response.data);
setTokenPrices(prices);

// Check for missing prices
const missingPrices = addresses.filter(addr => !prices[addr]);

// Try Echelon API for missing prices
if (missingPrices.length > 0) {
  const service = TokenInfoService.getInstance();
  const fallbackPrices = await Promise.all(
    missingPrices.map(async (addr) => {
      const info = await service.getTokenInfo(addr);
      return info?.price ? { [addr]: info.price.toString() } : {};
    })
  );
  setTokenPrices(prev => ({ ...prev, ...fallbackPrices }));
}
```

## Тестирование

### Шаг 1: Откройте Managing Positions
```
1. Подключите кошелек
2. Перейдите в "Managing Positions" → "Echelon"
3. Откройте консоль браузера (F12)
```

### Шаг 2: Проверьте логи
В консоли должны появиться:
```
[EchelonPositions] Loading info for unknown tokens: ["0x35c3e420..."]
[EchelonPositions] Loaded token info: sUSDe/USDC.x from echelon
[EchelonPositions] Missing prices for tokens, trying Echelon API: ["0x35c3e420..."]
[EchelonPositions] Got price from Echelon: sUSDe/USDC.x 102.64
```

### Шаг 3: Проверьте результат
LP токен должен отображаться как:
```
✅ sUSDe/USDC.x
   Price: $102.64 (вместо $0.00)
   Value: $102.47 (amount × price)
   Supply: 0.9968 sUSDe/USDC.x
```

## Ожидаемый результат

### Before Fix:
```
❌ sUSDe/USDC.x
   Price: $0.00
   Value: $0.00
   Supply: 0.9968 sUSDe/USDC.x
```

### After Fix:
```
✅ sUSDe/USDC.x
   Price: $102.64
   Value: $102.47
   Supply: 0.9968 sUSDe/USDC.x
```

## Сравнение компонентов

| Component | Token Info Fallback | Price Fallback | Status |
|-----------|-------------------|----------------|---------|
| `PositionsList.tsx` (Sidebar) | ✅ | ✅ | Working |
| `EchelonPositions.tsx` (Managing) | ✅ | ✅ | Fixed |

## Файлы изменены

| File | Changes |
|------|---------|
| `src/components/protocols/manage-positions/protocols/EchelonPositions.tsx` | Added price fallback to Echelon API |

## Ключевые функции

### Price Loading with Fallback (Managing Positions)
```typescript
useEffect(() => {
  // 1. Load from Panora API
  // 2. Identify missing prices
  // 3. Load missing prices from Echelon API
  // 4. Merge results
}, [addresses]);
```

### Token Info with Fallback (Managing Positions)
```typescript
useEffect(() => {
  // 1. Find unknown tokens
  // 2. Load via TokenInfoService
  // 3. Cache in fallbackTokenInfo
}, [positions]);
```

## Успех! 🎉

Теперь LP токены работают в **обеих** частях приложения:
- ✅ **Sidebar Positions** (Portfolio view)
- ✅ **Managing Positions** (Detailed management)

LP токены отображаются с:
- ✅ Правильным символом (sUSDe/USDC.x)
- ✅ Правильным логотипом
- ✅ Правильной ценой ($102.64)
- ✅ Правильной стоимостью ($102.47)
