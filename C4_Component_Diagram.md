# C4 Component Diagram - YieldAI System

## Component Architecture

This diagram shows the internal structure of the main containers in the YieldAI system.

```mermaid
graph TD

  subgraph Web Application
    MP[📄 Main Page<br/>Next.js Page]
    DP[📊 Dashboard Page<br/>Next.js Page]
    SB[🧭 Sidebar<br/>React Component]
    MT[📱 Mobile Tabs<br/>React Component]
    ID[💼 Investments Dashboard<br/>React Component]
    CP[💬 Chat Panel<br/>React Component]
    WC[🔗 Wallet Connect<br/>React Component]
    WS[👛 Wallet Selector<br/>React Component]
    
    PC[💳 Portfolio Card<br/>React Component]
    TL[📋 Token List<br/>React Component]
    TI[🪙 Token Item<br/>React Component]
    
    PRC[🏛️ Protocol Components<br/>React Components]
    MPOS[📈 Manage Positions<br/>React Component]
    DM[💰 Deposit Modal<br/>React Component]
    WM[💸 Withdraw Modal<br/>React Component]
    SM[🔄 Swap Modal<br/>React Component]
    
    UIC[🎨 UI Components<br/>shadcn/ui]
  end

  subgraph API Gateway
    AR[🔗 Aptos Routes<br/>Next.js API Routes]
    PR[💱 Panora Routes<br/>Next.js API Routes]
    PROTR[🏛️ Protocol Routes<br/>Next.js API Routes]
    SR[📚 Swagger Routes<br/>Next.js API Routes]
  end

  subgraph Protocol Service
    PRG[📋 Protocol Registry<br/>TypeScript]
    BP[🔧 Base Protocol<br/>TypeScript]
    EP[⚡ Echelon Protocol<br/>TypeScript]
    HP[🌊 Hyperion Protocol<br/>TypeScript]
    JP[⚡ Joule Protocol<br/>TypeScript]
    AP[🟡 Auro Protocol<br/>TypeScript]
    AMP[🔵 Amnis Protocol<br/>TypeScript]
    ARP[🦁 Aries Protocol<br/>TypeScript]
    TP[🔘 Tapp Protocol<br/>TypeScript]
    MP[🟣 Meso Protocol<br/>TypeScript]
  end

  subgraph Wallet Service
    AW[👛 Aptos Wallet<br/>TypeScript]
    WA[🔌 Wallet Adapter<br/>TypeScript]
    GS[⛽ Gas Station<br/>TypeScript]
  end

  subgraph Portfolio Service
    APF[💼 Aptos Portfolio<br/>TypeScript]
    AAP[🔗 Aptos API<br/>TypeScript]
    BS[⚖️ Balance Service<br/>TypeScript]
  end

  subgraph Swap Service
    PS[💱 Panora Swap<br/>TypeScript]
    PP[💰 Panora Prices<br/>TypeScript]
    PT[🪙 Panora Tokens<br/>TypeScript]
  end

  subgraph Transaction Service
    TB[🔨 Transaction Builder<br/>TypeScript]
    TS[📤 Transaction Submitter<br/>TypeScript]
    DH[💰 Deposit Hook<br/>React Hook]
    WH[💸 Withdraw Hook<br/>React Hook]
    CH[🏆 Claim Hook<br/>React Hook]
  end

  subgraph AI Chat Service
    CI[💬 Chat Interface<br/>TypeScript]
    AIP[🤖 AI Processor<br/>TypeScript]
    AE[⚡ Action Executor<br/>TypeScript]
  end

  subgraph React Contexts
    WCX[👛 Wallet Context<br/>React Context]
    PCX[🏛️ Protocol Context<br/>React Context]
    DDC[🖱️ Drag Drop Context<br/>React Context]
    CC[📁 Collapsible Context<br/>React Context]
  end

  %% Web App internal relationships
  MP -->|Navigates to| DP
  MP -->|Renders| SB
  MP -->|Renders| MT
  DP -->|Renders| ID
  DP -->|Renders| CP
  
  ID -->|Uses| PC
  PC -->|Uses| TL
  TL -->|Uses| TI
  
  ID -->|Uses| PRC
  PRC -->|Uses| MPOS
  PRC -->|Uses| DM
  PRC -->|Uses| WM
  PRC -->|Uses| SM

  %% Web App to API Gateway
  Web Application -->|Makes API calls to| API Gateway

  %% API Gateway to Services
  API Gateway -->|Routes to| Protocol Service
  API Gateway -->|Routes to| Wallet Service
  API Gateway -->|Routes to| Portfolio Service
  API Gateway -->|Routes to| Swap Service
  API Gateway -->|Routes to| Transaction Service
  API Gateway -->|Routes to| AI Chat Service

  %% Service relationships
  Protocol Service -->|Uses for transactions| Wallet Service
  Swap Service -->|Uses for swap execution| Transaction Service
  Portfolio Service -->|Uses for data| Protocol Service

  %% Web App to Contexts and UI
  Web Application -->|Uses| React Contexts
  Web Application -->|Uses| UIC

  classDef webApp fill:#1168BD,stroke:#0E5DAD,stroke-width:2px,color:#fff
  classDef apiGateway fill:#438DD5,stroke:#3B7BC0,stroke-width:2px,color:#fff
  classDef service fill:#85BBF0,stroke:#6BA5E7,stroke-width:2px,color:#fff
  classDef context fill:#B8D4F0,stroke:#A5C7E8,stroke-width:2px,color:#000

  class MP,DP,SB,MT,ID,CP,WC,WS,PC,TL,TI,PRC,MPOS,DM,WM,SM,UIC webApp
  class AR,PR,PROTR,SR apiGateway
  class PRG,BP,EP,HP,JP,AP,AMP,ARP,TP,MP,AW,WA,GS,APF,AAP,BS,PS,PP,PT,TB,TS,DH,WH,CH,CI,AIP,AE service
  class WCX,PCX,DDC,CC context
```

## Component Details

### Web Application Components

#### Core Pages
- **Main Page**: Entry point with layout and navigation
- **Dashboard Page**: Main investment interface
- **Sidebar**: Protocol navigation and selection
- **Mobile Tabs**: Mobile-optimized navigation

#### Main Components
- **Investments Dashboard**: Central investment interface with drag & drop
- **Chat Panel**: AI assistant interface
- **Wallet Connect**: Wallet connection management
- **Wallet Selector**: Multi-wallet selection interface

#### Portfolio Components
- **Portfolio Card**: Portfolio overview display
- **Token List**: Token balance aggregation
- **Token Item**: Individual token display with logo and values

#### Protocol Components
- **Protocol Components**: Protocol-specific UI (Echelon, Hyperion, etc.)
- **Manage Positions**: Position management interface
- **Transaction Modals**: Deposit, withdraw, swap interfaces

#### UI Components
- **shadcn/ui Library**: Reusable UI components (buttons, modals, forms, etc.)

### API Gateway Components

#### Route Groups
- **Aptos Routes**: Blockchain data endpoints
- **Panora Routes**: Token prices and swap endpoints
- **Protocol Routes**: DeFi protocol integration endpoints
- **Swagger Routes**: API documentation endpoints

### Protocol Service Components

#### Core Protocol Management
- **Protocol Registry**: Central protocol registration
- **Base Protocol**: Common protocol interface
- **Individual Protocols**: Specific implementations for each DeFi protocol

### Wallet Service Components

#### Wallet Management
- **Aptos Wallet**: Core wallet integration
- **Wallet Adapter**: Multi-wallet support
- **Gas Station**: Gasless transaction capabilities

### Portfolio Service Components

#### Portfolio Management
- **Aptos Portfolio**: Portfolio data aggregation
- **Aptos API**: Blockchain data client
- **Balance Service**: Token balance calculations

### Swap Service Components

#### Trading Services
- **Panora Swap**: Token swap execution
- **Panora Prices**: Real-time price data
- **Panora Tokens**: Token metadata and lists

### Transaction Service Components

#### Transaction Management
- **Transaction Builder**: Payload creation
- **Transaction Submitter**: Transaction execution
- **Transaction Hooks**: React hooks for transaction management

### AI Chat Service Components

#### Chat Functionality
- **Chat Interface**: User interaction handling
- **AI Processor**: Natural language processing
- **Action Executor**: Transaction execution through chat

### React Contexts

#### State Management
- **Wallet Context**: Wallet state and data
- **Protocol Context**: Protocol state and data
- **Drag Drop Context**: Drag & drop state management
- **Collapsible Context**: UI collapse state management

## Key Interactions

1. **User Interface Flow**: Main Page → Dashboard → Investments Dashboard → Protocol Components
2. **Data Flow**: API Gateway → Service Components → React Contexts → UI Components
3. **Transaction Flow**: UI Components → Transaction Service → Wallet Service → Blockchain
4. **Protocol Integration**: Protocol Service → Individual Protocols → External APIs
5. **State Management**: React Contexts → UI Components → User Interactions

## Component Relationships

- **Composition**: UI components are composed of smaller, reusable components
- **Dependency**: Services depend on each other for complex operations
- **State Sharing**: React contexts provide state across component trees
- **API Integration**: Components communicate through API gateway
- **Protocol Abstraction**: Base protocol provides common interface for all protocols 