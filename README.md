# Yield AI - DeFi Investment Dashboard

A comprehensive DeFi investment dashboard built on the Aptos blockchain that allows users to discover, analyze, and manage yield farming opportunities across multiple protocols.

## 🚀 Features

### Core Functionality
- **Multi-Protocol Support**: Connect and manage positions across 5 major DeFi protocols
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

## 🏦 Supported Protocols

### Lending Protocols

#### **Echelon**
- **Category**: High-efficiency lending market
- **Features**: 
  - Native deposit integration
  - Position management
  - Real-time APY tracking
  - Fungible and non-fungible token support
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
