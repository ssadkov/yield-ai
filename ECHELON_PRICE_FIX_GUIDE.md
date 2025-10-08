# Echelon Price Fix: LP Token Prices

## Проблема
LP токен `sUSDe/USDC.x` отображался с правильным символом и логотипом, но ценой $0.00.

## Решение
Добавлен fallback для цен из Echelon API, когда Panora API не содержит цены для LP токенов.

## Что изменено

### 1. Enhanced Price Loading
```typescript
// Before: Only Panora API
const response = await pricesService.getPrices(1, addresses);
const prices = createDualAddressPriceMap(response.data);

// After: Panora API + Echelon API fallback
const response = await pricesService.getPrices(1, addresses);
let prices = createDualAddressPriceMap(response.data);

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

### 2. Flow
```
1. Load token info (symbol, name, logo) ✅
2. Load prices from Panora API
3. Check for missing prices
4. Load missing prices from Echelon API ✅
5. Display complete token info with correct price
```

## Тестирование

### Шаг 1: Обновите страницу
```
1. Обновите страницу с портфолио
2. Откройте консоль браузера (F12)
3. Перейдите в "Assets" → "Echelon"
```

### Шаг 2: Проверьте логи
В консоли должны появиться:
```
[EchelonPositionsList] Loading info for unknown tokens: ["0x35c3e420..."]
[EchelonPositionsList] Loaded token info: sUSDe/USDC.x from echelon
[EchelonPositionsList] Missing prices for tokens, trying Echelon API: ["0x35c3e420..."]
[EchelonPositionsList] Got price from Echelon: sUSDe/USDC.x 102.64
```

### Шаг 3: Проверьте результат
LP токен должен отображаться как:
```
✅ sUSDe/USDC.x
   Price: $102.64 (вместо $0.00)
   Value: $102.47 (0.9968 × $102.64)
   APR: N/A (нормально для LP токенов)
```

## Ожидаемый результат

### Before Fix:
```
❌ sUSDe/USDC.x
   Price: $0.00
   Value: $0.00
```

### After Fix:
```
✅ sUSDe/USDC.x
   Price: $102.64
   Value: $102.47
```

## Отладка

### Если цена всё ещё $0.00:

1. **Проверьте консоль** - должны быть логи загрузки цен
2. **Проверьте API** - откройте:
   ```
   http://localhost:3002/api/tokens/info?address=0x35c3e420fa4fd925628366f1977865d62432c8856a2db147a1cb13f7207f6a79
   ```
3. **Проверьте Echelon API** - должен возвращать price: 102.64

### Если нет логов загрузки:
- Проверьте, что позиции загрузились
- Проверьте, что токен определяется как "unknown"
- Проверьте, что TokenInfoService работает

## Файлы изменены

| File | Changes |
|------|---------|
| `src/components/protocols/echelon/PositionsList.tsx` | Added price fallback to Echelon API |

## Ключевые функции

### Price Loading with Fallback
```typescript
useEffect(() => {
  // 1. Load from Panora API
  // 2. Identify missing prices
  // 3. Load missing prices from Echelon API
  // 4. Merge results
}, [addresses]);
```

### Token Info with Fallback
```typescript
useEffect(() => {
  // 1. Find unknown tokens
  // 2. Load via TokenInfoService
  // 3. Cache in fallbackTokenInfo
}, [positions]);
```

## Успех! 🎉

После исправления LP токены должны отображаться с:
- ✅ Правильным символом (sUSDe/USDC.x)
- ✅ Правильным логотипом
- ✅ Правильной ценой ($102.64)
- ✅ Правильной стоимостью ($102.47)
