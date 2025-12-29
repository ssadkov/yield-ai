# Настройка вычисления depositMessageHash

## Проблема

`depositMessageHash` нужно вычислять из CCTP message с помощью keccak256, но библиотека `js-sha3` не устанавливается из-за конфликта зависимостей в `package.json`.

## Решение

Создано два варианта API для вычисления `depositMessageHash`:

### Вариант 1: Next.js API Route (рекомендуется)

**Файл:** `src/app/api/compute-deposit-message-hash/route.ts`

**Установка библиотеки:**

Попробуйте установить `js-sha3` вручную, обойдя конфликт:

```bash
# Вариант 1: Установить вручную, игнорируя конфликт
npm install js-sha3 --legacy-peer-deps --force

# Вариант 2: Добавить в package.json вручную и установить
# Добавьте в dependencies: "js-sha3": "^0.8.0"
npm install --legacy-peer-deps
```

**Использование:**

API endpoint автоматически вызывается из кода при обнаружении CCTP message в localStorage.

Или можно вызвать напрямую:

```javascript
const response = await fetch('/api/compute-deposit-message-hash', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: cctpMessage // CCTP message из localStorage
  })
});

const { depositMessageHash } = await response.json();
```

### Вариант 2: PHP API (если есть PHP сервер)

**Файл:** `compute-deposit-message-hash.php`

**Установка:**

```bash
# Установите библиотеку для keccak256
composer require ethereum/eth-php
```

**Использование:**

1. Загрузите `compute-deposit-message-hash.php` на ваш PHP сервер
2. Обновите URL в коде (если нужно):

```typescript
// В bridge2/page.tsx, измените URL API endpoint
const response = await fetch('https://your-php-server.com/compute-deposit-message-hash.php', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: cctpMessage })
});
```

## Где находится CCTP message

CCTP message сохраняется в localStorage по ключу:
- `wormhole-connect:transactions:inprogress`

Путь к message:
```javascript
const data = JSON.parse(localStorage.getItem('wormhole-connect:transactions:inprogress'));
const cctpMessage = data[0].receipt.attestation.message;
```

## Структура CCTP message

```json
{
  "sourceDomain": 5,
  "destinationDomain": 9,
  "nonce": "633206",
  "sender": { "address": {...} },
  "recipient": { "address": {...} },
  "destinationCaller": { "address": {...} },
  "payload": {
    "burnToken": { "address": {...} },
    "mintRecipient": { "address": {...} },
    "amount": "100000",
    "messageSender": { "address": {...} }
  }
}
```

## Альтернативные решения

Если оба варианта не работают:

1. **Использовать внешний keccak256 API** (если есть публичный сервис)
2. **Использовать Circle API** с API key для получения attestation (требует depositMessageHash)
3. **Вычислить вручную** используя онлайн-инструменты для keccak256

## Тестирование

После установки библиотеки, протестируйте API:

```bash
# Тест Next.js API
curl -X POST http://localhost:3000/api/compute-deposit-message-hash \
  -H "Content-Type: application/json" \
  -d '{"message": {...}}'

# Тест PHP API
curl -X POST https://your-server.com/compute-deposit-message-hash.php \
  -H "Content-Type: application/json" \
  -d '{"message": {...}}'
```



