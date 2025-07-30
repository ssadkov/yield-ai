# C4 Container Diagram - YieldAI System

## Container Architecture

This diagram shows the high-level technical building blocks that make up the YieldAI system.

```mermaid
graph TD

  subgraph Persons
    U[👤 DeFi User<br/>Manages investments across<br/>multiple DeFi protocols]
  end

  subgraph YieldAI System
    WA[🌐 Web Application<br/>Next.js 15, TypeScript, Tailwind CSS<br/>Provides all functionality to users via web interface]
    
    AG[🚪 API Gateway<br/>Next.js API Routes<br/>Handles all API requests and routes to services]
    
    PS[🏛️ Protocol Service<br/>TypeScript<br/>Manages integrations with DeFi protocols and data aggregation]
    
    WS[👛 Wallet Service<br/>TypeScript, Aptos SDK<br/>Handles wallet connections and blockchain interactions]
    
    PFS[💼 Portfolio Service<br/>TypeScript<br/>Manages user portfolio data and calculations]
    
    SS[💱 Swap Service<br/>TypeScript<br/>Handles token swaps and Panora integration]
    
    TS[🔨 Transaction Service<br/>TypeScript<br/>Manages transaction building and submission]
    
    CS[🤖 AI Chat Service<br/>TypeScript<br/>Provides AI-powered assistance and transaction execution]
  end

  subgraph External Systems
    AB[🔗 Aptos Blockchain<br/>Layer 1 blockchain for DeFi protocols]
    PA[💱 Panora API<br/>Token prices and swap functionality]
    DP[🏛️ DeFi Protocols<br/>Echelon, Hyperion, Joule, Aries, Auro, Amnis, Tapp, Meso]
    WP[👛 Wallet Providers<br/>Petra, Martian, Pontem wallets]
  end

  %% User interactions
  U -->|Uses| WA

  %% Web App to API Gateway
  WA -->|Makes API calls to| AG

  %% API Gateway to Services
  AG -->|Routes protocol requests to| PS
  AG -->|Routes wallet requests to| WS
  AG -->|Routes portfolio requests to| PFS
  AG -->|Routes swap requests to| SS
  AG -->|Routes transaction requests to| TS
  AG -->|Routes chat requests to| CS

  %% Service to External Systems
  PS -->|Fetches pool data and user positions| DP
  WS -->|Reads from and writes to| AB
  WS -->|Interacts with| WP
  SS -->|Fetches token prices and executes swaps| PA
  PFS -->|Gets portfolio data from| PS

  %% Service relationships
  PS -->|Uses for transactions| WS
  SS -->|Uses for swap execution| TS
  TS -->|Uses for transaction signing| WS

  classDef person fill:#08427B,stroke:#073B6F,stroke-width:2px,color:#fff
  classDef container fill:#1168BD,stroke:#0E5DAD,stroke-width:2px,color:#fff
  classDef external fill:#999999,stroke:#8A8A8A,stroke-width:2px,color:#fff

  class U person
  class WA,AG,PS,WS,PFS,SS,TS,CS container
  class AB,PA,DP,WP external
```

## Container Details

### Web Application
- **Technology**: Next.js 15, TypeScript, Tailwind CSS, shadcn/ui
- **Responsibilities**:
  - User interface and experience
  - Component rendering and state management
  - Real-time data updates
  - Mobile responsiveness
  - Drag & drop functionality

### API Gateway
- **Technology**: Next.js API Routes
- **Responsibilities**:
  - Request routing and validation
  - Authentication and authorization
  - Rate limiting and security
  - Response formatting
  - Error handling

### Protocol Service
- **Technology**: TypeScript
- **Responsibilities**:
  - DeFi protocol integrations
  - Data aggregation from multiple sources
  - Protocol-specific data transformation
  - Investment opportunity discovery
  - Real-time APY calculations

### Wallet Service
- **Technology**: TypeScript, Aptos SDK
- **Responsibilities**:
  - Wallet connection management
  - Account balance retrieval
  - Transaction signing coordination
  - Multi-wallet support (Petra, Martian, etc.)
  - Gas station integration

### Portfolio Service
- **Technology**: TypeScript
- **Responsibilities**:
  - Portfolio data aggregation
  - Token balance calculations
  - USD value conversions
  - Position tracking across protocols
  - Performance metrics

### Swap Service
- **Technology**: TypeScript
- **Responsibilities**:
  - Panora API integration
  - Token swap execution
  - Price discovery and routing
  - Swap quote generation
  - Liquidity pool management

### Transaction Service
- **Technology**: TypeScript
- **Responsibilities**:
  - Transaction payload building
  - Gas estimation and optimization
  - Transaction submission and monitoring
  - Error handling and retry logic
  - Gasless transaction support

### AI Chat Service
- **Technology**: TypeScript
- **Responsibilities**:
  - Natural language processing
  - Transaction execution through chat
  - User assistance and guidance
  - Context-aware responses
  - Integration with other services

## External Systems

### Aptos Blockchain
- **Purpose**: Layer 1 blockchain providing the foundation for all DeFi protocols
- **Interaction**: Read/write operations for transactions and data

### Panora API
- **Purpose**: Token prices, market data, and swap functionality
- **Interaction**: Price feeds and swap execution

### DeFi Protocols
- **Purpose**: Multiple DeFi protocols (Echelon, Hyperion, Joule, Aries, Auro, Amnis, Tapp, Meso)
- **Interaction**: Pool data and user positions

### Wallet Providers
- **Purpose**: Various Aptos wallet implementations (Petra, Martian, Pontem, etc.)
- **Interaction**: Wallet connections and transaction signing

## Key Interactions

1. **User Authentication**: Web App → API Gateway → Wallet Service
2. **Portfolio Loading**: Web App → API Gateway → Portfolio Service → Protocol Service
3. **Investment Discovery**: Web App → API Gateway → Protocol Service
4. **Transaction Execution**: Web App → API Gateway → Transaction Service → Wallet Service
5. **Swap Operations**: Web App → API Gateway → Swap Service → Transaction Service
6. **AI Assistance**: Web App → API Gateway → Chat Service → Other Services

## Technology Stack Summary

- **Frontend**: Next.js 15, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Next.js API Routes, TypeScript
- **Blockchain**: Aptos SDK, Wallet Adapter
- **External APIs**: Panora, DeFi protocols, Aptos API
- **State Management**: React Context, Zustand
- **Development**: ESLint, Turbopack, pnpm 