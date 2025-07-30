# C4 Context Diagram - YieldAI System

## System Context

This diagram shows how the YieldAI system fits into the larger environment, including users, external systems, and blockchain components.

```mermaid
C4Context
    title System Context diagram for YieldAI

    Person(user, "DeFi User", "A user who wants to manage their DeFi investments across multiple protocols on Aptos blockchain")
    
    System(yieldAI, "YieldAI System", "Allows users to view, manage, and optimize their DeFi positions across multiple protocols on Aptos")
    
    System_Ext(aptosBlockchain, "Aptos Blockchain", "Layer 1 blockchain providing the foundation for all DeFi protocols")
    
    System_Ext(panoraAPI, "Panora API", "Provides token prices, market data, and swap functionality")
    
    System_Ext(aptosAPI, "Aptos API", "Provides blockchain data, wallet information, and transaction capabilities")
    
    System_Ext(hyperionAPI, "Hyperion API", "DEX protocol API for liquidity pools and trading data")
    
    System_Ext(echelonAPI, "Echelon API", "Lending protocol API for market data and user positions")
    
    System_Ext(jouleAPI, "Joule API", "Lending protocol API for user positions and rewards")
    
    System_Ext(ariesAPI, "Aries API", "Lending protocol API for market data")
    
    System_Ext(auroAPI, "Auro API", "Lending protocol API for pools and user positions")
    
    System_Ext(amnisAPI, "Amnis API", "Staking protocol API for staking pools and rewards")
    
    System_Ext(tappAPI, "Tapp API", "DEX protocol API for trading data")
    
    System_Ext(mesoAPI, "Meso API", "Lending protocol API for market data")
    
    System_Ext(walletProviders, "Wallet Providers", "Petra, Martian, Pontem, and other Aptos wallet providers")
    
    System_Ext(gasStation, "Gas Station", "Provides gasless transaction capabilities")

    Rel(user, yieldAI, "Uses", "Web browser")
    Rel(yieldAI, aptosBlockchain, "Reads from and writes to", "Aptos SDK")
    Rel(yieldAI, panoraAPI, "Fetches token prices and executes swaps", "HTTP/REST")
    Rel(yieldAI, aptosAPI, "Gets blockchain data and wallet info", "HTTP/REST")
    Rel(yieldAI, hyperionAPI, "Fetches pool data and user positions", "HTTP/REST")
    Rel(yieldAI, echelonAPI, "Fetches market data and user positions", "HTTP/REST")
    Rel(yieldAI, jouleAPI, "Fetches user positions and rewards", "HTTP/REST")
    Rel(yieldAI, ariesAPI, "Fetches market data", "HTTP/REST")
    Rel(yieldAI, auroAPI, "Fetches pools and user positions", "HTTP/REST")
    Rel(yieldAI, amnisAPI, "Fetches staking pools and rewards", "HTTP/REST")
    Rel(yieldAI, tappAPI, "Fetches trading data", "HTTP/REST")
    Rel(yieldAI, mesoAPI, "Fetches market data", "HTTP/REST")
    Rel(user, walletProviders, "Connects via", "Wallet adapter")
    Rel(yieldAI, walletProviders, "Interacts with", "Wallet adapter")
    Rel(yieldAI, gasStation, "Uses for gasless transactions", "HTTP/REST")
```

## Key External Systems

### Blockchain Infrastructure
- **Aptos Blockchain**: The foundation layer providing transaction processing and smart contract execution
- **Wallet Providers**: Various Aptos wallet implementations (Petra, Martian, Pontem, etc.)
- **Gas Station**: Service for gasless transaction capabilities

### DeFi Protocols
- **Lending Protocols**: Echelon, Joule, Aries, Auro, Meso
- **DEX Protocols**: Hyperion, Tapp Exchange
- **Staking Protocols**: Amnis Finance

### Data & Trading Services
- **Panora API**: Token prices, market data, and swap functionality
- **Aptos API**: Blockchain data and wallet information

## User Interactions

The DeFi user interacts with the YieldAI system to:
1. Connect their wallet
2. View portfolio across multiple protocols
3. Discover investment opportunities
4. Execute deposits, withdrawals, and swaps
5. Manage positions and claim rewards
6. Monitor APY and performance metrics

## System Responsibilities

The YieldAI system acts as a unified interface that:
- Aggregates data from multiple DeFi protocols
- Provides a consistent user experience across different protocols
- Enables cross-protocol portfolio management
- Offers investment discovery and comparison tools
- Handles wallet connections and transaction signing
- Provides real-time market data and APY calculations 