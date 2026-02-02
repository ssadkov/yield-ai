# Yield AI - DeFi Investment Dashboard

A comprehensive DeFi investment dashboard built on the Aptos blockchain that allows users to discover, analyze, and manage yield farming opportunities across multiple protocols.

---

## 🏆 Solana PRIVACY HACK — Private Bridge

We built a **privacy-preserving cross-chain bridge** from Solana to Aptos, integrated into the Yield AI app.

**Problem:** Standard bridges let anyone link a user's Solana wallet to their destination wallet on another chain—a real security and privacy risk for users moving meaningful capital.

**Approach:** We add a **privacy layer on top of a standard, battle-tested bridge** (Circle CCTP), instead of replacing core infrastructure.

### 🔧 Architecture

| Layer | Implementation |
|-------|----------------|
| **Asset** | USDC |
| **Bridge** | Circle CCTP |
| **Privacy** | Privacy Cache Private Pool |
| **Account abstraction** | Aptos X-Chain Derived Accounts |

### 📋 Flow

1. **Private pool deposit (Solana)** — User deposits USDC into a Privacy Cache Private Pool by signing with their Solana wallet. Funds are pooled and the direct link between the main Solana wallet and the future bridge tx is broken.
2. **Temporary Solana wallet (browser-only)** — A temporary Solana wallet is generated only in the browser: session-only, no keys stored or sent to the backend. It acts as an unlinkable intermediary.
3. **CCTP bridge** — From this temporary wallet we run a standard Circle CCTP bridge to Aptos. Privacy comes from isolating the bridge source from the user's main Solana account; the user can bridge immediately or later to reduce timing correlation.
4. **Derived Aptos account** — On Aptos, funds land in a **X-Chain Derived Account** (Aptos Labs). The user does not create or manage an Aptos wallet; the account is deterministically derived from the Solana wallet in the browser and is not observable on-chain.
5. **Post-bridge (Aptos)** — USDC sits in a private Aptos account with no on-chain link to the original Solana wallet. The user can deposit into yield protocols, swap, and use DeFi on Aptos as usual.

### ✅ What we built (hackathon)

- End-to-end private Solana → Aptos bridge flow
- Privacy Cache Private Pool as pre-bridge privacy layer
- Browser-only temporary wallet generation
- Circle CCTP integration for USDC
- X-Chain Derived Account integration (no separate Aptos wallet setup)
- Frontend that hides the complexity from the user

### 🚀 How to use

1. Open **[Private Bridge](/privacy-bridge)**.
2. Connect your **Solana wallet** (deposit/withdraw in the private pool).
3. Connect or derive your **Aptos account** (receiver of USDC after mint).
4. **Deposit:** Enter USDC amount and deposit into the private pool (sign message for encryption).
5. **Withdraw → Aptos:** Enter amount → withdraw from pool to tmp wallet → automatic CCTP burn on Solana and mint on Aptos (attestation ~10–30 s).

### 🔮 Future extensions

- Confidential reverse bridge (Aptos → Solana)
- Private deposits into lending and yield protocols on both chains
- Stronger resistance to timing and amount-based correlation

---

## 🚀 Features

### Core Functionality
- **Multi-Protocol Support**: Connect and manage positions across 6 major DeFi protocols (including Echelon)
- **Real-time Portfolio Tracking**: Monitor your assets and positions in real-time
- **Yield Discovery**: Find the best APY opportunities across different protocols
- **One-Click Deposits**: Seamless deposit functionality with native and external protocol integration
- **Swap & Deposit**: Automatically swap tokens and deposit to earn yield
- **Position Management**: View and manage your existing positions across all protocols
- **Wallet Integration**: Connect Aptos wallets to view balances and execute transactions
- **AI Chat Assistant**: Get help and execute actions through an AI-powered chat interface

### Investment Dashboard
- **Top Investment Opportunities**: View the highest APY opportunities across all protocols
- **Protocol Comparison**: Compare yields and features across different DeFi protocols
- **Token Information**: Detailed token data including prices, logos, and market information
- **Drag & Drop Interface**: Intuitive interface for managing investments
- **Real-time APY Updates**: Live yield rates and calculations

### Portfolio Management
- **Asset Overview**: Complete view of all your tokens and their USD values
- **Position Tracking**: Monitor your deposits and earnings across protocols
- **Balance Filtering**: Hide small assets (<$1) for cleaner portfolio view
- **Token Details**: View token logos, symbols, amounts, and current values

### Risk Management (Echelon)
- **Health Factor Calculation**: 
  - Automatic calculation for accounts with borrow positions
  - Formula: `Health Factor = (Σ collateral × LT) / total liabilities`
  - Color-coded status: Green (≥1.5 Safe), Yellow (1.0-1.49 Warning), Red (<1.0 Danger)
  - Only displayed when borrow positions exist
- **LTV Information**: 
  - Loan-to-Value ratio displayed in position tooltips
  - Liquidation Threshold (LT) values for each collateral asset
  - E-Mode LTV and LT values when available
  - Note: LTV data currently limited to managing positions view
  - **Important**: LTV fields (ltv, lt, emodeLtv, emodeLt) are not available in the current InvestmentData type
  - These fields are only accessible in the managing positions view where they are calculated separately

## 🏦 Supported Protocols

### Lending Protocols

#### **Echelon**
- **Category**: High-efficiency lending market
- **Features**: 
  - Native deposit integration
  - Position management
  - Real-time APY tracking with rewards
  - Supply and borrow pools
  - Fungible and non-fungible token support
  - **NEW**: Full integration with Ideas dashboard
  - **NEW**: Health Factor calculation for borrow positions
  - **NEW**: LTV (Loan-to-Value) information in position tooltips
- **URL**: [app.echelon.market](https://app.echelon.market/dashboard?network=aptos_mainnet)

#### **Joule**
- **Category**: Lending protocol
- **Features**:
  - Native deposit integration
  - Position management
  - Referral rewards system
  - Fungible and NFT lending support
- **URL**: [app.joule.finance](https://app.joule.finance/rewards?tabId=referral&referralAddress=0x56ff2fc971deecd286314fe99b8ffd6a5e72e62eacdc46ae9b234c5282985f97)

#### **Aries**
- **Category**: Lending protocol
- **Features**:
  - External deposit integration
  - Position tracking
  - Market data integration
- **URL**: [app.ariesmarkets.xyz](https://app.ariesmarkets.xyz/lending)

### DEX Protocols

#### **Hyperion**
- **Category**: Decentralized exchange
- **Features**:
  - Native position management
  - Swap functionality
  - Liquidity pool integration
  - Referral rewards
- **URL**: [hyperion.xyz](https://hyperion.xyz/drips?inviteCode=O02Eig)

#### **Tapp Exchange**
- **Category**: Next-generation DEX
- **Features**:
  - Modular trading approach
  - Position management
  - External deposit integration
- **URL**: [tapp.exchange](https://tapp.exchange/)

## 🛠️ Technology Stack

### Frontend
- **Next.js 15**: React framework with App Router
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first CSS framework
- **shadcn/ui**: Modern component library
- **Radix UI**: Accessible UI primitives

### Blockchain Integration
- **Aptos SDK**: Official Aptos blockchain integration
- **Wallet Adapter**: Multi-wallet support
- **Transaction Building**: Custom transaction payloads for each protocol

### APIs & Services
- **Panora API**: Token prices and market data
- **Aptos API**: Blockchain data and wallet information
- **Protocol APIs**: Direct integration with DeFi protocols

### Development Tools
- **ESLint**: Code linting
- **Turbopack**: Fast development bundler
- **pnpm**: Package manager

## 📊 API Endpoints

### Aptos Endpoints
- `GET /api/aptos/pools` - Get investment opportunities
- `GET /api/aptos/portfolio` - Get portfolio data for address
- `GET /api/aptos/balances` - Get wallet balances
- `GET /api/aptos/walletBalance` - Get detailed wallet balance
- `GET /api/aptos/walletBalanceWithPrices` - Get balances with USD prices

### Panora Endpoints
- `GET /api/panora/prices` - Get token prices
- `GET /api/panora/tokenList` - Get available tokens
- `GET /api/panora/tokenPrices` - Get specific token prices
- `GET /api/panora/swap` - Execute token swaps

### Protocol Endpoints
- `GET /api/protocols/{protocol}/pools` - Get protocol-specific pools
- `GET /api/protocols/{protocol}/userPositions` - Get user positions

### Transactions Endpoint
- `GET /api/transactions` - Get DeFi transactions for an Aptos address

#### Parameters
- `address` (required): Aptos wallet address (0x-prefixed or without prefix)
- `protocol` (optional): Filter by protocol key (e.g., `echelon`, `hyperion`, `joule`, `aries`, `meso`, `auro`, `amnis`, `kofi`, `tapp`, `earnium`, `aave`, `moar`)
- `activityType` (optional): Filter by activity type:
  - `ACTIVITY_COIN_SWAP` - Token swaps
  - `ACTIVITY_DEPOSIT_MARKET` - Market deposits
  - `ACTIVITY_WITHDRAW_MARKET` - Market withdrawals
  - `ACTIVITY_COIN_ADD_LIQUID` - Add liquidity to pools
  - `ACTIVITY_COIN_REMOVE_LIQUID` - Remove liquidity from pools

#### Response Format
```json
{
  "success": true,
  "data": [
    {
      "block_id": "string",
      "tx_version": "string",
      "trans_id": "string",
      "block_time": number,
      "activity_type": "ACTIVITY_COIN_SWAP" | "ACTIVITY_DEPOSIT_MARKET" | ...,
      "from_address": "string",
      "sources": ["string"],
      "platform": ["string"],
      "amount_info": {
        "token1": "string",
        "amount1": number,
        "token2": "string",
        "amount2": number,
        "routers": ["string"],
        "token1_decimals": number,
        "token2_decimals": number,
        "coin_1_isFungible": boolean,
        "coin_2_isFungible": boolean
      },
      "value": number
    }
  ],
  "metadata": {
    "accounts": {},
    "coins": {},
    "tokens": {},
    "tokenv2s": {},
    "collections": {},
    "collectionv2s": {},
    "fungible_assets": {},
    "modules": {}
  }
}
```

#### How It Works
1. **Data Source**: Fetches transactions from Aptoscan API (`api.aptoscan.com/public/v1.0`)
2. **Pagination**: Automatically fetches all pages of transactions (up to 100 pages max)
3. **Protocol Filtering**: If `protocol` is specified, filters by contract addresses defined in `protocolsList.json`
4. **Activity Filtering**: If `activityType` is specified, returns only matching transaction types
5. **Address Validation**: Validates and normalizes Aptos addresses (64 hex characters)
6. **Metadata Merging**: Combines metadata from all paginated responses
7. **Sorting**: Results are sorted by `block_time` in descending order (newest first)

#### Example Requests
```bash
# Get all transactions for an address
GET /api/transactions?address=0x1234...

# Get only Echelon protocol transactions
GET /api/transactions?address=0x1234...&protocol=echelon

# Get only swap transactions
GET /api/transactions?address=0x1234...&activityType=ACTIVITY_COIN_SWAP

# Combined filters
GET /api/transactions?address=0x1234...&protocol=hyperion&activityType=ACTIVITY_DEPOSIT_MARKET
```

#### Error Responses
- `400`: Invalid or missing address parameter
- `500`: Failed to fetch transactions from Aptoscan API

### Documentation
- `GET /api/swagger` - API documentation
- `GET /api/panora/swagger` - Panora API documentation

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- pnpm (recommended) or npm
- Aptos wallet (Petra, Martian, etc.)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd yield-ai
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   # or
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```
   
   Configure the following variables:
   - `NEXT_PUBLIC_APTOS_NODE_URL` - Aptos RPC endpoint
   - `NEXT_PUBLIC_PANORA_API_URL` - Panora API endpoint
   - `NEXT_PUBLIC_HYPERION_API_URL` - Hyperion API endpoint

4. **Run the development server**
   ```bash
   pnpm dev
   # or
   npm run dev
   ```

5. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

### Building for Production

```bash
pnpm build
pnpm start
```

## 💡 Usage Guide

### Connecting Your Wallet
1. Click "Connect Wallet" in the top navigation
2. Select your preferred Aptos wallet (Petra, Martian, etc.)
3. Approve the connection in your wallet
4. Your portfolio will automatically load

### Discovering Investment Opportunities
1. Navigate to the Dashboard
2. Browse the list of available investment opportunities
3. Filter by protocol, token, or APY
4. Click on any opportunity to view details

### Making Deposits
1. **Native Deposits** (Echelon, Joule):
   - Click "Deposit" on any opportunity
   - Enter the amount you want to deposit
   - Review the transaction details
   - Confirm the transaction in your wallet

2. **External Deposits** (Hyperion, Aries, Tapp):
   - Click "Deposit" to be redirected to the protocol's website
   - Complete the deposit on the external platform

### Swap and Deposit Feature
The Swap and Deposit feature allows you to automatically exchange tokens and deposit them into yield-generating protocols in a single seamless process.

**How it works:**
1. **Token Selection**: Choose from available tokens in your wallet
2. **Amount Input**: Enter the amount you want to swap and deposit
3. **Automatic Swap**: The system automatically exchanges your tokens for the required protocol token
4. **Instant Deposit**: Received tokens are immediately deposited into the selected protocol
5. **Real-time Tracking**: Monitor the entire process through the status modal

**Key Features:**
- **Smart Token Selection**: Automatically suggests the most valuable token from your wallet
- **Yield Preview**: See estimated daily, weekly, and monthly earnings before confirming
- **Balance Validation**: Prevents transactions that exceed your wallet balance
- **Quick Actions**: Use "Half" or "Max" buttons for quick amount selection
- **Status Monitoring**: Real-time updates on swap and deposit progress
- **Error Handling**: Clear error messages and retry options if transactions fail

**Supported Protocols:**
- Echelon (native integration)
- Joule (native integration)
- Other protocols with native deposit support

**Benefits:**
- No need to manually swap tokens first
- Reduced transaction costs by combining operations
- Faster access to yield opportunities
- Simplified user experience for DeFi newcomers

### Managing Positions
1. Click "Manage Positions" for any protocol
2. View your current deposits and earnings
3. Monitor APY changes and performance
4. Withdraw funds when needed

### Using Swap and Deposit
1. **Access the Feature**: 
   - Drag a token from your portfolio to a protocol that requires a different token
   - Or click "Swap and Deposit" when available on investment opportunities

2. **Configure the Transaction**:
   - Select the token you want to swap from your wallet
   - Enter the amount (use "Half" or "Max" for quick selection)
   - Review the estimated yield and received amount

3. **Execute the Transaction**:
   - Click "Swap and Deposit" to start the process
   - Sign the swap transaction in your wallet
   - The system will automatically deposit received tokens
   - Monitor progress through the status modal

4. **Monitor Results**:
   - Check the status modal for real-time updates
   - View your new position in the protocol's management section
   - Track your earnings through the portfolio dashboard

### Using the AI Chat
1. Open the chat panel on the right side
2. Ask questions about protocols, yields, or transactions
3. Get real-time assistance with your DeFi activities

## 🔧 Development

### Project Structure
```
src/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes
│   ├── dashboard/         # Dashboard page
│   └── swagger/           # API documentation
├── components/            # React components
│   ├── ui/               # Reusable UI components
│   ├── portfolio/        # Portfolio-related components
│   └── protocols/        # Protocol-specific components
├── lib/                   # Core library code
│   ├── protocols/        # Protocol implementations
│   ├── services/         # API services
│   └── utils/            # Utility functions
└── types/                # TypeScript type definitions
```

### Adding New Protocols
1. Create a new protocol class implementing `BaseProtocol`
2. Add protocol data to `protocolsList.json`
3. Create protocol-specific components
4. Add API endpoints for the protocol
5. Update the dashboard to include the new protocol

### Contributing
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📈 Features in Development

- **Advanced Analytics**: Historical performance tracking
- **Portfolio Rebalancing**: Automated portfolio optimization
- **Yield Optimization**: AI-powered yield maximization
- **Cross-chain Support**: Integration with other blockchains
- **Mobile App**: Native mobile application
- **Social Features**: Share strategies and track friends

## 🔒 Security

- All transactions are signed locally in your wallet
- No private keys are stored on the application
- Open source code for transparency
- Regular security audits
- Integration with audited DeFi protocols

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🤝 Support

- **Documentation**: [API Documentation](/swagger)
- **Issues**: [GitHub Issues](https://github.com/your-repo/issues)
- **Discord**: [Community Discord](https://discord.gg/yield-ai)
- **Email**: support@yield-ai.com

## 🙏 Acknowledgments

- Aptos Labs for the blockchain infrastructure
- All supported DeFi protocols for their innovative products
- The open-source community for the amazing tools and libraries
- Our users for their valuable feedback and support

---

**Disclaimer**: This application is for educational and informational purposes. DeFi investments carry significant risks. Always do your own research and never invest more than you can afford to lose.

## Public API

See Public Wallet API usage guide:

- [PUBLIC_API.md](./PUBLIC_API.md)