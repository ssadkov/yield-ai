# Public Wallet API (Aptos)

This document describes the minimal public API for retrieving wallet token balances and USD values on Aptos.

## Base URL

Use your deployed app origin as a base. In local development it is usually:

- `http://localhost:3000` 

Make sure your server-side code points to the same origin via `NEXT_PUBLIC_API_URL`.

## Endpoint

GET `/api/public/v1/wallet/{address}/balance`

- `{address}`: Aptos address.
  - Accepts both `0x<64 hex>` and `<64 hex>`.
  - The response always returns canonical `0x`-prefixed, lowercase address.

### Optional authentication

Simple API key header can be enabled via env variables (see Environment below).

- Header: `x-api-key: <YOUR_KEY>`
- Or Query: `?api_key=<YOUR_KEY>`

If authentication is disabled, calls are public.

## Response (200)

```jsonc
{
  "address": "0x<canonical_lowercase>",
  "timestamp": "2025-08-08T07:01:07.805Z",
  "tokens": [
    {
      "tokenAddress": "0x1::aptos_coin::AptosCoin",
      "symbol": "APT",
      "name": "Aptos Coin",
      "decimals": 8,
      "amount": "2.5400",           // amount in token units
      "priceUSD": 4.3320,            // unit price in USD
      "valueUSD": 11.6500            // amount * priceUSD
    }
  ]
}
```

Notes:
- Tokens are sorted by `valueUSD` in descending order.
- `amount` is a string; `priceUSD` and `valueUSD` are numbers.
- Fields may be zero when upstream pricing is temporarily unavailable.

## Errors

- `400 Bad Request` — invalid address
  ```json
  { "error": "invalid_address", "address": "<provided>" }
  ```
- `401 Unauthorized` — when API key is required and missing/invalid
  ```json
  { "error": "unauthorized" }
  ```
- `500 Internal Server Error`
  ```json
  { "error": "internal_error" }
  ```

## Examples

cURL with API key header:

```bash
curl -H "x-api-key: test_key_1" \
  "http://localhost:3000/api/public/v1/wallet/0x56ff2fc971deecd286314fe99b8ffd6a5e72e62eacdc46ae9b234c5282985f97/balance"
```

cURL with API key query parameter:

```bash
curl "http://localhost:3000/api/public/v1/wallet/0x56ff2fc971deecd286314fe99b8ffd6a5e72e62eacdc46ae9b234c5282985f97/balance?api_key=test_key_1"
```

## Environment

Server-side configuration (place in `.env.local` or your deployment environment):

```dotenv
# Required for internal server-to-server calls
NEXT_PUBLIC_API_URL=http://localhost:3001

# Optional: enable API key enforcement
PUBLIC_API_REQUIRE_KEY=true
# Comma-separated allowlist of API keys
PUBLIC_API_KEYS=test_key_1,test_key_2
```

Guidelines:
- Do NOT expose secrets via `NEXT_PUBLIC_*` except for non-secret base URLs; API keys must remain in server env (`PUBLIC_API_*`).
- After changing env variables, restart the dev server.

## Versioning

Path includes version segment `/v1/`. Breaking changes will be introduced under a new version.
