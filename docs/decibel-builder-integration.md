# Decibel Builder Integration Guide

This guide provides the essential technical foundation for projects integrating **Builder Codes**. Decibel offers a high-performance environment where your application handles the frontend while our engine manages the heavy lifting.

---

## Table of contents

1. [Core Architecture & Accounts](#1-core-architecture--accounts)
2. [Configuration & Authentication](#2-configuration--authentication)
3. [Builder Monetization Flow](#3-builder-monetization-flow)
4. [Step-by-Step Implementation](#4-step-by-step-implementation)
5. [Utility Helper Endpoints](#5-utility-helper-endpoints)
6. [AMPs (Points) Integration](#6-amps-points-integration)
7. [Important Constraints & Error Handling](#7-important-constraints--error-handling)

---

## 1. Core Architecture & Accounts

Decibel utilizes a three-tier account structure designed for high-performance programmatic trading without compromising security.

- **Primary Wallet:** The user's root Aptos wallet (e.g., Petra, MetaMask, Phantom). It acts as the owner of all subaccounts but does not trade directly on-chain.
- **Subaccounts:** Programmatic entities that actually hold funds (USDC collateral) and maintain positions. They do not have their own private keys.
- **Delegation Model:** The Primary Wallet signs a transaction to delegate trading permissions to an **API Wallet**.
  - **API Wallet** can place orders and trade.
  - **API Wallet** cannot withdraw funds; withdrawals always require the Primary Wallet's signature.

---

## 2. Configuration & Authentication

### Network Reference

Use these endpoints to toggle between environments.

| **Network** | **Trading API** | **Fullnode RPC** | **Package ID** |
| --- | --- | --- | --- |
| **Mainnet** | `https://api.mainnet.aptoslabs.com/decibel` | `https://api.mainnet.aptoslabs.com/v1` | *Ask Team* |
| **Testnet** | `https://api.testnet.aptoslabs.com/decibel` | `https://api.testnet.aptoslabs.com/v1` | `0x9f83...` |

### API Keys

You require two types of keys.

| **Key Type** | **Purpose** | **Source** |
| --- | --- | --- |
| **Node API Key** | Authenticates access to Decibel's node infrastructure (Read/Submit). | `geomi.dev` |
| **API Wallet (Private Key)** | Signs transactions on behalf of a delegated subaccount. | `app.decibel.trade/api` |

> **Security First:** Never expose private keys in client-side code. Use environment variables (`.env`) for all key management.

---

## 3. Builder Monetization Flow

Builders monetize by defining a **Builder Address** (your own subaccount) and a **Fee** (in basis points).

### The Integration Lifecycle

1. **Onboard:** Create a user subaccount via referral code redemption.
2. **Approve:** User signs a one-time transaction approving your max fee.
3. **Trade:** You append your builder address and fee to every order.
4. **Withdraw:** You withdraw accumulated fees from your subaccount to your wallet.

**Builder Address:** Your builder address is simply your own Decibel subaccount address. You must have one to collect fees. Connect your wallet to the Decibel UI to generate one, or use the redeem endpoint on your own wallet.

> **Important:** We ask that you **not use x-chain accounts** (e.g., EVM-derived addresses) for generating your `builderAddr` and instead use an **Aptos native wallet/address** (e.g., Petra, Pontem) to ensure compatibility.

| **Exchange** | **Taker Fee** | **Maker Fee** |
| --- | --- | --- |
| Decibel (Tier 0) | 0.034% | 0.011% |
| Hyperliquid | 0.045% | 0.015% |
| Drift | 0.05% | 0.02% |
| Binance (Futures) | 0.050% | 0.020% |

---

## 4. Step-by-Step Implementation

### Step 1: User Onboarding (Redeem Referral Code)

Decibel is in **Gated Mainnet Alpha**. Users cannot trade without a subaccount created via referral. You will receive a **multi-use** referral code from the Decibel team.

> **Secret Key:** This multi-use builder code should **never** be exposed to users or shared externally. It is for your backend use only to generate unique user codes.

- **Endpoint:** `POST /api/v1/referrals/redeem`
- **Action:** Creates the subaccount and returns 5 single-use codes for the user.

**Request Body:**

| **Field** | **Type** | **Description** |
| --- | --- | --- |
| `referral_code` | string | The referral code provided to you |
| `account` | string | User's wallet address (64-char hex) |

> **Check First:** Before redeeming, call `GET /api/v1/subaccounts?owner={address}`. If it returns a list, the user is already onboarded. Skip this step to save your invite codes.

**Response (200 OK):**

| Field | Type | Description |
| --- | --- | --- |
| `referral_code` | string | The code that was redeemed |
| `account` | string | The account that redeemed |

#### TypeScript

```ts
const MAINNET_API = "https://api.mainnet.aptoslabs.com/decibel";
// For testnet: "https://api.testnet.aptoslabs.com/decibel"

async function redeemReferralCode(
  referralCode: string,
  userAddress: string
): Promise<{
  referral_code: string;
  account: string;
  generated_referral_codes: string[];
}> {
  const response = await fetch(`${MAINNET_API}/api/v1/referrals/redeem`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      referral_code: referralCode,
      account: userAddress,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Redeem failed (${response.status}):${error}`);
  }

  return response.json();
}

// Usage
const result = await redeemReferralCode(
  "YOUR_REFERRAL_CODE",
  "0x0000000000000000000000001234abcd5678ef901234abcd5678ef901234abcd"
);
console.log("Subaccount created. User referral codes:", result.generated_referral_codes);
```

#### Python

```python
import requests

MAINNET_API = "https://api.mainnet.aptoslabs.com/decibel"
# For testnet: "https://api.testnet.aptoslabs.com/decibel"

def redeem_referral_code(referral_code: str, user_address: str) -> dict:
    """Create a user's subaccount by redeeming a referral code."""
    response = requests.post(
        f"{MAINNET_API}/api/v1/referrals/redeem",
        json={
            "referral_code": referral_code,
            "account": user_address,
        },
    )
    response.raise_for_status()
    return response.json()

# Usage
result = redeem_referral_code(
    "YOUR_REFERRAL_CODE",
    "0x0000000000000000000000001234abcd5678ef901234abcd5678ef901234abcd",
)
print("Subaccount created. User referral codes:", result["generated_referral_codes"])
```

---

### Step 2: Approve Builder Fee

The user must sign a **one-time** on-chain transaction to approve your fee cap.

**Parameters:**

| **Parameter** | **Type** | **Description** |
| --- | --- | --- |
| `builderAddr` | string | Your builder address (64-char hex, padded with leading zeros) |
| `maxFee` | number | Maximum fee in basis points (e.g., `10` = 0.1%, `100` = 1%) |
| `subaccountAddr` | string | (Optional) The user's subaccount address. Defaults to the user's primary subaccount if not provided. Builders only earn fees on approved subaccounts. |

#### TypeScript (using `@decibeltrade/sdk`)

```ts
import {
  DecibelWriteDex,
  MAINNET_CONFIG,
  // For testnet: TESTNET_CONFIG
} from "@decibeltrade/sdk";
import { Ed25519Account, Ed25519PrivateKey } from "@aptos-labs/ts-sdk";

// The user's account (they sign this transaction)
const user = new Ed25519Account({
  privateKey: new Ed25519PrivateKey(process.env.USER_PRIVATE_KEY!),
});

const dex = new DecibelWriteDex(MAINNET_CONFIG, user, {
  skipSimulate: true,
});

// Your builder address — must be 64 characters after 0x
const builderAddress =
  "0x0000000000000000000000008c967e73e7b15087c42a10d344cff4c96d877f1d";
const maxFeeBps = 10; // 10 basis points = 0.1%

const txResult = await dex.approveMaxBuilderFee({
  builderAddr: builderAddress,
  maxFee: maxFeeBps,
});

console.log("Builder fee approved:", txResult);
```

#### Python (using `aptos-sdk`)

```python
from aptos_sdk.account import Account
from aptos_sdk.async_client import RestClient
from aptos_sdk.transactions import (
    EntryFunction,
    TransactionArgument,
    TransactionPayload,
)
from aptos_sdk.type_tag import TypeTag

# Config
NODE_URL = "https://api.mainnet.aptoslabs.com/v1"
# For testnet: "https://api.testnet.aptoslabs.com/v1"
PACKAGE_ADDRESS = "0x..."  # Decibel package address (get from Decibel team)

BUILDER_ADDRESS = "0x0000000000000000000000008c967e73e7b15087c42a10d344cff4c96d877f1d"
MAX_FEE_BPS = 10  # 10 basis points = 0.1%

async def approve_builder_fee(user: Account, subaccount_addr: str):
    """Submit an approve_max_builder_fee transaction signed by the user."""
    client = RestClient(NODE_URL)

    payload = EntryFunction.natural(
        f"{PACKAGE_ADDRESS}::dex_accounts_entry",
        "approve_max_builder_fee_for_subaccount",
        [],  # no type arguments
        [
            TransactionArgument(subaccount_addr, TransactionArgument.OBJECT),
            TransactionArgument(BUILDER_ADDRESS, TransactionArgument.ADDRESS),
            TransactionArgument(MAX_FEE_BPS, TransactionArgument.U64),
        ],
    )

    signed_tx = await client.create_bcs_signed_transaction(
        user, TransactionPayload(payload)
    )
    tx_hash = await client.submit_bcs_transaction(signed_tx)
    await client.wait_for_transaction(tx_hash)

    print(f"Builder fee approved. Tx:{tx_hash}")
    await client.close()
```

---

### Step 3: Placing Orders with Fees

Include your `builderAddr` and `builderFee` in the `placeOrder` arguments.

> The `builderFee` must be **less than or equal** to the `maxFee` approved in Step 2.

#### TypeScript

```ts
import { TimeInForce } from "@decibeltrade/sdk";

const orderResult = await dex.placeOrder({
  marketName: "APT/USD",
  price: 300000000,       // price in market precision
  size: 1000000000,       // size in market precision
  isBuy: true,
  timeInForce: TimeInForce.ImmediateOrCancel,
  isReduceOnly: false,
  builderAddr: builderAddress,  // your builder address
  builderFee: maxFeeBps,        // must be <= approved maxFee
});

if (orderResult.success) {
  console.log(`Order placed! Tx:${orderResult.transactionHash}`);
}
```

#### Python

```python
async def place_order_with_builder_fee(user: Account, subaccount_addr: str):
    """Place an order that includes builder fee collection."""
    client = RestClient(NODE_URL)

    # Get the market address for APT/USD from the Decibel API
    market_addr = "0x..."  # resolve via GET /api/v1/markets

    payload = EntryFunction.natural(
        f"{PACKAGE_ADDRESS}::dex_accounts_entry",
        "place_order_to_subaccount",
        [],
        [
            TransactionArgument(subaccount_addr, TransactionArgument.OBJECT),
            TransactionArgument(market_addr, TransactionArgument.OBJECT),
            TransactionArgument(300000000, TransactionArgument.U64),     # price
            TransactionArgument(1000000000, TransactionArgument.U64),    # size
            TransactionArgument(True, TransactionArgument.BOOL),         # is_buy
            TransactionArgument(1, TransactionArgument.U8),              # time_in_force (IOC=1)
            TransactionArgument(False, TransactionArgument.BOOL),        # is_reduce_only
            TransactionArgument(0, TransactionArgument.U64),             # client_order_id
            TransactionArgument(0, TransactionArgument.U64),             # stop_price
            TransactionArgument(0, TransactionArgument.U64),             # tp_trigger_price
            TransactionArgument(0, TransactionArgument.U64),             # tp_limit_price
            TransactionArgument(0, TransactionArgument.U64),             # sl_trigger_price
            TransactionArgument(0, TransactionArgument.U64),             # sl_limit_price
            TransactionArgument(BUILDER_ADDRESS, TransactionArgument.ADDRESS),
            TransactionArgument(MAX_FEE_BPS, TransactionArgument.U64),
        ],
    )

    signed_tx = await client.create_bcs_signed_transaction(
        user, TransactionPayload(payload)
    )
    tx_hash = await client.submit_bcs_transaction(signed_tx)
    await client.wait_for_transaction(tx_hash)

    print(f"Order placed. Tx:{tx_hash}")
    await client.close()
```

---

### Step 4: Withdraw Accumulated Fees

Fees accumulate in your builder subaccount. To cash out to your origin Aptos wallet, call `withdraw_from_subaccount` — must be signed by owner of subaccount (your builder wallet).

#### TypeScript

```ts
// Withdraw accumulated builder fees to your wallet
const withdrawAmount = 1000000; // amount in USDC chain units (6 decimals)

await dex.withdraw(withdrawAmount, yourBuilderSubaccountAddr);

console.log("Fees withdrawn to wallet");
```

#### Python

```python
async def withdraw_builder_fees(builder: Account, builder_subaccount_addr: str, amount: int):
    """Withdraw accumulated builder fees from subaccount to wallet."""
    client = RestClient(NODE_URL)

    payload = EntryFunction.natural(
        f"{PACKAGE_ADDRESS}::dex_accounts_entry",
        "withdraw_from_subaccount",
        [],
        [
            TransactionArgument(builder_subaccount_addr, TransactionArgument.OBJECT),
            TransactionArgument(USDC_ADDRESS, TransactionArgument.OBJECT),  # USDC metadata
            TransactionArgument(amount, TransactionArgument.U64),
        ],
    )

    signed_tx = await client.create_bcs_signed_transaction(
        builder, TransactionPayload(payload)
    )
    tx_hash = await client.submit_bcs_transaction(signed_tx)
    await client.wait_for_transaction(tx_hash)

    print(f"Fees withdrawn. Tx: {tx_hash}")
    await client.close()
```

---

## 5. Utility Helper Endpoints

### Validate a Referral Code

Check if a code is valid/active before asking the user to connect.

- **Endpoint:** `GET /api/v1/referrals/code/{code}`

**Response (200 OK):**

| **Field** | **Type** | **Description** |
| --- | --- | --- |
| `referral_code` | string | The code that was checked |
| `is_valid` | boolean | Whether the code exists |
| `is_active` | boolean | Whether the code can still accept new referrals |

#### TypeScript

```ts
async function validateReferralCode(code: string): Promise<{
  referral_code: string;
  is_valid: boolean;
  is_active: boolean;
}> {
  const response = await fetch(`${MAINNET_API}/api/v1/referrals/code/${code}`);

  if (!response.ok) {
    throw new Error(`Validation failed (${response.status})`);
  }

  return response.json();
}

// Usage
const validation = await validateReferralCode("YOUR_REFERRAL_CODE");

if (!validation.is_valid) {
  console.error("Referral code does not exist");
} else if (!validation.is_active) {
  console.error("Referral code has been fully redeemed");
} else {
  console.log("Code is valid and active — proceed to redeem");
}
```

#### Python

```python
def validate_referral_code(code: str) -> dict:
    """Check if a referral code exists and is still active."""
    response = requests.get(f"{MAINNET_API}/api/v1/referrals/code/{code}")
    response.raise_for_status()
    return response.json()

# Usage
validation = validate_referral_code("YOUR_REFERRAL_CODE")

if not validation["is_valid"]:
    print("Referral code does not exist")
elif not validation["is_active"]:
    print("Referral code has been fully redeemed")
else:
    print("Code is valid and active — proceed to redeem")
```

---

### Check Existing Subaccounts

Query if a wallet already has a subaccount (skip redeem if true).

- **Endpoint:** `GET /api/v1/subaccounts?owner={address}`
- **Empty array:** User has no subaccount and needs to go through the redeem flow

**Response (200 OK):** Array of subaccount objects.

| **Field** | **Type** | **Description** |
| --- | --- | --- |
| `subaccount_address` | string | The subaccount's on-chain address |
| `primary_account_address` | string | The owner wallet address |
| `is_primary` | boolean | Whether this is the primary subaccount |
| `is_active` | boolean | Whether the subaccount is active |
| `custom_label` | string? | Optional user-set label |

#### TypeScript

```ts
async function getSubaccounts(ownerAddress: string): Promise<{
  subaccount_address: string;
  primary_account_address: string;
  is_primary: boolean;
  is_active: boolean;
  custom_label: string | null;
}[]> {
  const response = await fetch(
    `${MAINNET_API}/api/v1/subaccounts?owner=${ownerAddress}`
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch subaccounts (${response.status})`);
  }

  return response.json();
}

// Usage
const subaccounts = await getSubaccounts(userAddress);

if (subaccounts.length === 0) {
  console.log("No subaccount found — need to redeem a referral code first");
} else {
  const primary = subaccounts.find((s) => s.is_primary);
  console.log("User already has a subaccount:", primary?.subaccount_address);
}
```

#### Python

```python
def get_subaccounts(owner_address: str) -> list[dict]:
    """Check if a wallet address already has a Decibel subaccount."""
    response = requests.get(
        f"{MAINNET_API}/api/v1/subaccounts",
        params={"owner": owner_address},
    )
    response.raise_for_status()
    return response.json()

# Usage
subaccounts = get_subaccounts(user_address)

if not subaccounts:
    print("No subaccount found — need to redeem a referral code first")
else:
    primary = next((s for s in subaccounts if s["is_primary"]), None)
    print("User already has a subaccount:", primary["subaccount_address"])
```

---

## 6. AMPs (Points) Integration

You can display a user's earned AMPs directly in your UI. Note that data is materialized **once per day**.

- **Endpoint:** `GET /api/v1/points/trading/amps?owner={walletAddress}`

**Response Structure:**

| **Field** | Type | **Description** |
| --- | --- | --- |
| `owner` | string | Wallet address queried |
| `total_amps` | f64 | Aggregated AMPs earned across all the user's subaccounts (entire ecosystem). |
| `breakdown` | array or null | Array of per-subaccount AMPs. Use this to filter for points earned **specifically on your app**. |

> **Example:** If a user earns 5 points on your app and 7 points elsewhere:
>
> - `total_amps`: 12
> - `breakdown`: `[{ subaccount_A (Yours): 5 }, { subaccount_B: 7 }]`

---

## 7. Important Constraints & Error Handling

### Address Formatting

All addresses must be 64 hex characters after `0x`. Pad with leading zeros if necessary (e.g., `0x0000...1234`).

### Error Handling Table

Refer to this table to handle API responses correctly.

| **Status** | **Meaning** | **Action** |
| --- | --- | --- |
| **200** | Success | Subaccount created, codes returned. |
| **409** | Conflict | User already redeemed with a different code. User is already onboarded. |
| **404** | Not Found | Referral code does not exist. Check the code string. |
| **400** | Bad Request | Invalid request (bad address format, etc.). Fix request body. |
| **429** | Rate Limited | Back off and retry. |
| **500** | Server Error | Retry with backoff. |

### Operational Notes

- **Idempotency:** The `redeem` endpoint is idempotent. Calling it multiple times with the same `(account, code)` pair is safe and returns the original result.
- **Referral Code Types:**
  - **Single-use codes:** Expire after one redemption.
  - **Affiliate/Builder codes:** Can be reused (max usage 100+).
