# C4 Context Diagram - YieldAI System

## System Context

This diagram shows how the YieldAI system fits into the larger environment, including users and external systems.

```mermaid
C4Context
    title Level 1: System Context Diagram

    Person(defiUser, "DeFi User", "Manages investments across multiple DeFi protocols")
    
    System(yieldAI, "YieldAI System", "DeFi investment dashboard for portfolio management and yield optimization")
    
    System_Ext(walletProviders, "Wallet Providers", "Petra, Martian, Pontem wallets")
    
    System_Ext(aptosBlockchain, "Aptos Blockchain", "Layer 1 blockchain for DeFi protocols")
    
    System_Ext(panoraAPI, "Panora API", "Token prices and swap functionality")
    
    System_Ext(defiProtocols, "DeFi Protocols", "Echelon, Hyperion, Joule, Aries, Auro, Amnis, Tapp, Meso")

    Rel(defiUser, yieldAI, "Uses", "Web browser")
    Rel(yieldAI, aptosBlockchain, "Reads from and writes to", "Aptos SDK")
    Rel(yieldAI, panoraAPI, "Fetches token prices and executes swaps", "HTTP/REST")
    Rel(yieldAI, defiProtocols, "Fetches pool data and user positions", "HTTP/REST")
    Rel(defiUser, walletProviders, "Connects via", "Wallet adapter")
    Rel(yieldAI, walletProviders, "Interacts with", "Wallet adapter")
```

## Key External Systems

### Users
- **DeFi User**: Manages investments across multiple DeFi protocols

### External Systems
- **Aptos Blockchain**: Layer 1 blockchain providing the foundation for all DeFi protocols
- **Panora API**: Token prices, market data, and swap functionality
- **DeFi Protocols**: Multiple DeFi protocols (Echelon, Hyperion, Joule, Aries, Auro, Amnis, Tapp, Meso)
- **Wallet Providers**: Various Aptos wallet implementations (Petra, Martian, Pontem, etc.)

## System Responsibilities

The YieldAI system allows users to:
- View and manage portfolio across multiple DeFi protocols
- Discover investment opportunities with highest APY
- Execute deposits, withdrawals, and swaps
- Monitor positions and claim rewards
- Get AI-powered assistance for DeFi operations 