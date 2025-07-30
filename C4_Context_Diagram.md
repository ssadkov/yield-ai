# C4 Context Diagram - YieldAI System

## System Context

This diagram shows how the YieldAI system fits into the larger environment, including users and external systems.

```mermaid
graph TD

  subgraph User
    U[👤 DeFi User<br/>Manages investments across<br/>multiple DeFi protocols]
  end

  subgraph YieldAI
    Y[🏦 YieldAI System<br/>DeFi investment dashboard for<br/>portfolio management and yield optimization]
  end

  subgraph External Systems
    A[🔗 Aptos Blockchain<br/>Layer 1 blockchain for DeFi protocols]
    P[💱 Panora API<br/>Token prices and swap functionality]
    D[🏛️ DeFi Protocols<br/>Echelon, Hyperion, Joule,<br/>Aries, Auro, Amnis, Tapp, Meso]
    W[👛 Wallet Providers<br/>Petra, Martian, Pontem wallets]
  end

  U -->|Uses| Y
  Y -->|Reads from and writes to| A
  Y -->|Fetches token prices and executes swaps| P
  Y -->|Fetches pool data and user positions| D
  U -->|Connects via| W
  Y -->|Interacts with| W

  classDef person fill:#08427B,stroke:#073B6F,stroke-width:2px,color:#fff
  classDef system fill:#1168BD,stroke:#0E5DAD,stroke-width:2px,color:#fff
  classDef external fill:#999999,stroke:#8A8A8A,stroke-width:2px,color:#fff

  class U person
  class Y system
  class A,P,D,W external
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