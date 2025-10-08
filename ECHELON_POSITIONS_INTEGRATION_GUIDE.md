# Echelon Positions: Integration Guide

## Как внедрить LP токены в Position List

### ✅ Что уже сделано:

1. **TokenInfoService** - сервис с fallback к протоколам
2. **API endpoint** `/api/tokens/info` - универсальный lookup
3. **EchelonPositions.tsx** - обновлен с fallback логикой
4. **Тестовые страницы** - для проверки работы

### 🔧 Что нужно проверить:

#### 1. Откройте тестовую страницу
```
http://localhost:3002/test-echelon-positions
```

**Нажмите "Load Token Info"** и проверьте:
- ✅ APT загружается из tokenList
- ✅ sUSDe/USDC.x загружается из Echelon API  
- ✅ USDC загружается из tokenList

#### 2. Проверьте консоль браузера
Должны быть логи:
```
[TestEchelonPositions] Starting token info loading...
[TestEchelonPositions] Loaded: APT from tokenList
[TestEchelonPositions] Loaded: sUSDe/USDC.x from echelon
[TestEchelonPositions] Loaded: USDC from tokenList
```

#### 3. Откройте реальные Echelon Positions
```
1. Подключите кошелек с позициями в Echelon
2. Перейдите в "Managing Positions" → "Echelon"
3. Проверьте консоль на логи:
   [EchelonPositions] Loading info for unknown tokens: [...]
   [EchelonPositions] Loaded token info: sUSDe/USDC.x from echelon
```

### 📋 Пошаговая проверка:

#### Шаг 1: Проверка API
```bash
# Откройте в браузере
http://localhost:3002/api/tokens/info?address=0x35c3e420fa4fd925628366f1977865d62432c8856a2db147a1cb13f7207f6a79
```

**Ожидаемый ответ:**
```json
{
  "success": true,
  "data": {
    "symbol": "sUSDe/USDC.x",
    "name": "sUSDe/USDC xLPT",
    "price": 102.64,
    "source": "echelon"
  }
}
```

#### Шаг 2: Проверка компонента
```typescript
// В EchelonPositions.tsx должна быть логика:
const getTokenInfo = (coinAddress: string) => {
  // 1. Check fallback cache first
  if (fallbackTokenInfo[normalizedAddress]) {
    return fallbackTokenInfo[normalizedAddress];
  }
  
  // 2. Check tokenList
  const token = tokenList.data.data.find(...);
  return token;
};
```

#### Шаг 3: Проверка useEffect
```typescript
// Должен загружать неизвестные токены:
useEffect(() => {
  // Find tokens not in tokenList
  // Load via TokenInfoService
  // Cache in fallbackTokenInfo state
}, [positions]);
```

### 🐛 Возможные проблемы:

#### Проблема 1: Бесконечный цикл
**Симптом:** Консоль забита логами загрузки токенов
**Решение:** Проверить зависимости useEffect - должно быть `[positions]`, не `[positions, fallbackTokenInfo]`

#### Проблема 2: Токены не загружаются
**Симптом:** LP токены показывают "Loading..." или undefined
**Решение:** 
1. Проверить консоль на ошибки
2. Проверить API endpoint
3. Проверить TokenInfoService

#### Проблема 3: Цены $0
**Симптом:** LP токены показывают правильный символ, но цену $0
**Решение:** Проверить механизм загрузки цен - должен использовать Echelon API цены

### 📊 Ожидаемые результаты:

#### В Position List должно отображаться:
```
✅ sUSDe/USDC.x
   Amount: 1.5 sUSDe/USDC.x
   Value: $153.96
   Source: Echelon API
   
✅ APT  
   Amount: 1.0 APT
   Value: $10.50
   Source: tokenList
```

#### В консоли браузера:
```
[EchelonPositions] Loading info for unknown tokens: ["0x35c3e420..."]
[TokenInfoService] Found token: sUSDe/USDC.x from echelon
[EchelonPositions] Loaded token info: sUSDe/USDC.x from echelon
```

### 🔍 Отладка:

#### 1. Проверьте состояние компонента
```typescript
// Добавьте в EchelonPositions.tsx для отладки:
console.log('fallbackTokenInfo:', fallbackTokenInfo);
console.log('positions:', positions);
```

#### 2. Проверьте TokenInfoService
```typescript
// В консоли браузера:
const service = TokenInfoService.getInstance();
const info = await service.getTokenInfo('0x35c3e420...');
console.log(info);
```

#### 3. Проверьте API напрямую
```bash
curl "http://localhost:3002/api/tokens/info?address=0x35c3e420fa4fd925628366f1977865d62432c8856a2db147a1cb13f7207f6a79"
```

### ✅ Критерии успеха:

1. **API работает** - тестовая страница показывает данные LP токена
2. **Компонент загружает** - консоль показывает логи загрузки
3. **UI отображает** - позиции показывают правильные символы и цены
4. **Нет ошибок** - консоль чистая, нет бесконечных циклов

### 📞 Если что-то не работает:

1. **Откройте консоль браузера** и скопируйте ошибки
2. **Проверьте тестовые страницы** - они покажут, где проблема
3. **Проверьте API endpoint** - должен возвращать данные LP токена
4. **Проверьте зависимости** - useEffect не должен вызывать бесконечные циклы

### 🎯 Финальная проверка:

После внедрения в Position List:
1. LP токены отображаются с правильными символами
2. Цены загружаются из Echelon API
3. Калькуляция стоимости работает корректно
4. Нет ошибок в консоли
5. Производительность приемлемая (загрузка ~300ms для новых токенов)

## Готово! 🎉

Если все проверки пройдены, LP токены будут корректно отображаться в Echelon Positions с автоматической загрузкой информации из протокола.
