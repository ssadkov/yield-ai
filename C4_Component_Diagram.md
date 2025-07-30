# C4 Component Diagram - YieldAI System

## Component Architecture

This diagram shows the internal structure of the main containers in the YieldAI system.

```mermaid
C4Component
    title Component diagram for YieldAI

    Container_Boundary(webApp, "Web Application") {
        Component(mainPage, "Main Page", "Next.js Page", "Main application entry point")
        Component(dashboardPage, "Dashboard Page", "Next.js Page", "Investment dashboard interface")
        Component(sidebar, "Sidebar", "React Component", "Navigation and protocol selection")
        Component(mobileTabs, "Mobile Tabs", "React Component", "Mobile navigation interface")
        Component(investmentsDashboard, "Investments Dashboard", "React Component", "Main investment interface with drag & drop")
        Component(chatPanel, "Chat Panel", "React Component", "AI assistant interface")
        Component(walletConnect, "Wallet Connect", "React Component", "Wallet connection interface")
        Component(walletSelector, "Wallet Selector", "React Component", "Multi-wallet selection")
        
        Component(portfolioCard, "Portfolio Card", "React Component", "Portfolio overview display")
        Component(tokenList, "Token List", "React Component", "Token balance display")
        Component(tokenItem, "Token Item", "React Component", "Individual token display")
        
        Component(protocolComponents, "Protocol Components", "React Components", "Protocol-specific UI components")
        Component(managePositions, "Manage Positions", "React Component", "Position management interface")
        Component(depositModal, "Deposit Modal", "React Component", "Deposit transaction interface")
        Component(withdrawModal, "Withdraw Modal", "React Component", "Withdrawal transaction interface")
        Component(swapModal, "Swap Modal", "React Component", "Token swap interface")
        
        Component(uiComponents, "UI Components", "shadcn/ui", "Reusable UI components library")
    }

    Container_Boundary(apiGateway, "API Gateway") {
        Component(aptosRoutes, "Aptos Routes", "Next.js API Routes", "Aptos blockchain data endpoints")
        Component(panoraRoutes, "Panora Routes", "Next.js API Routes", "Panora API integration endpoints")
        Component(protocolRoutes, "Protocol Routes", "Next.js API Routes", "DeFi protocol integration endpoints")
        Component(swaggerRoutes, "Swagger Routes", "Next.js API Routes", "API documentation endpoints")
    }

    Container_Boundary(protocolService, "Protocol Service") {
        Component(protocolRegistry, "Protocol Registry", "TypeScript", "Protocol registration and management")
        Component(baseProtocol, "Base Protocol", "TypeScript", "Base protocol interface")
        Component(echelonProtocol, "Echelon Protocol", "TypeScript", "Echelon protocol integration")
        Component(hyperionProtocol, "Hyperion Protocol", "TypeScript", "Hyperion protocol integration")
        Component(jouleProtocol, "Joule Protocol", "TypeScript", "Joule protocol integration")
        Component(auroProtocol, "Auro Protocol", "TypeScript", "Auro protocol integration")
        Component(amnisProtocol, "Amnis Protocol", "TypeScript", "Amnis protocol integration")
        Component(ariesProtocol, "Aries Protocol", "TypeScript", "Aries protocol integration")
        Component(tappProtocol, "Tapp Protocol", "TypeScript", "Tapp protocol integration")
        Component(mesoProtocol, "Meso Protocol", "TypeScript", "Meso protocol integration")
    }

    Container_Boundary(walletService, "Wallet Service") {
        Component(aptosWallet, "Aptos Wallet", "TypeScript", "Aptos wallet integration")
        Component(walletAdapter, "Wallet Adapter", "TypeScript", "Multi-wallet adapter")
        Component(gasStation, "Gas Station", "TypeScript", "Gasless transaction service")
    }

    Container_Boundary(portfolioService, "Portfolio Service") {
        Component(aptosPortfolio, "Aptos Portfolio", "TypeScript", "Portfolio data management")
        Component(aptosAPI, "Aptos API", "TypeScript", "Aptos blockchain API client")
        Component(balanceService, "Balance Service", "TypeScript", "Token balance calculations")
    }

    Container_Boundary(swapService, "Swap Service") {
        Component(panoraSwap, "Panora Swap", "TypeScript", "Panora swap integration")
        Component(panoraPrices, "Panora Prices", "TypeScript", "Token price service")
        Component(panoraTokens, "Panora Tokens", "TypeScript", "Token list service")
    }

    Container_Boundary(transactionService, "Transaction Service") {
        Component(transactionBuilder, "Transaction Builder", "TypeScript", "Transaction payload creation")
        Component(transactionSubmitter, "Transaction Submitter", "TypeScript", "Transaction submission")
        Component(depositHook, "Deposit Hook", "React Hook", "Deposit transaction management")
        Component(withdrawHook, "Withdraw Hook", "React Hook", "Withdrawal transaction management")
        Component(claimHook, "Claim Hook", "React Hook", "Reward claiming management")
    }

    Container_Boundary(chatService, "AI Chat Service") {
        Component(chatInterface, "Chat Interface", "TypeScript", "Chat interaction handling")
        Component(aiProcessor, "AI Processor", "TypeScript", "Natural language processing")
        Component(actionExecutor, "Action Executor", "TypeScript", "Transaction execution through chat")
    }

    Container_Boundary(contexts, "React Contexts") {
        Component(walletContext, "Wallet Context", "React Context", "Wallet state management")
        Component(protocolContext, "Protocol Context", "React Context", "Protocol state management")
        Component(dragDropContext, "Drag Drop Context", "React Context", "Drag & drop state management")
        Component(collapsibleContext, "Collapsible Context", "React Context", "UI collapse state management")
    }

    Rel(mainPage, dashboardPage, "Navigates to", "Next.js routing")
    Rel(mainPage, sidebar, "Renders", "React props")
    Rel(mainPage, mobileTabs, "Renders", "React props")
    Rel(dashboardPage, investmentsDashboard, "Renders", "React props")
    Rel(dashboardPage, chatPanel, "Renders", "React props")
    
    Rel(investmentsDashboard, portfolioCard, "Uses", "React composition")
    Rel(portfolioCard, tokenList, "Uses", "React composition")
    Rel(tokenList, tokenItem, "Uses", "React composition")
    
    Rel(investmentsDashboard, protocolComponents, "Uses", "React composition")
    Rel(protocolComponents, managePositions, "Uses", "React composition")
    Rel(protocolComponents, depositModal, "Uses", "React composition")
    Rel(protocolComponents, withdrawModal, "Uses", "React composition")
    Rel(protocolComponents, swapModal, "Uses", "React composition")
    
    Rel(webApp, apiGateway, "Makes API calls to", "HTTP/REST")
    Rel(apiGateway, protocolService, "Routes to", "Internal calls")
    Rel(apiGateway, walletService, "Routes to", "Internal calls")
    Rel(apiGateway, portfolioService, "Routes to", "Internal calls")
    Rel(apiGateway, swapService, "Routes to", "Internal calls")
    Rel(apiGateway, transactionService, "Routes to", "Internal calls")
    Rel(apiGateway, chatService, "Routes to", "Internal calls")
    
    Rel(protocolService, walletService, "Uses for transactions", "Internal calls")
    Rel(swapService, transactionService, "Uses for swap execution", "Internal calls")
    Rel(portfolioService, protocolService, "Uses for data", "Internal calls")
    
    Rel(webApp, contexts, "Uses", "React hooks")
    Rel(webApp, uiComponents, "Uses", "React composition")
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