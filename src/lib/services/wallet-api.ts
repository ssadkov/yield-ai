import { AptosPortfolioService } from './aptos/portfolio';

interface TokenBalance {
  address: string;
  symbol: string | null;
  name: string | null;
  balance: string;
  decimals: number;
  priceUSD: number;
  valueUSD: number;
}

interface WalletData {
  address: string;
  timestamp: string;
  totalValueUSD: number;
  tokens: TokenBalance[];
}

export async function getWalletBalance(address: string): Promise<WalletData> {
  try {
    console.log('📡 [wallet-api] Fetching portfolio for address:', address);
    
    // Use the same service as Sidebar
    const portfolioService = new AptosPortfolioService();
    const { tokens: portfolioTokens } = await portfolioService.getPortfolio(address);
    
    // Convert portfolio format to API format
    const tokens: TokenBalance[] = portfolioTokens.map(token => {
      // Calculate balance number from raw amount
      const amountNum = parseFloat(token.amount) / Math.pow(10, token.decimals);
      const priceUSD = token.price ? parseFloat(token.price) : 0;
      const valueUSD = token.value ? parseFloat(token.value) : 0;
      
      return {
        address: token.address,
        symbol: token.symbol,
        name: token.name,
        balance: amountNum.toString(),
        decimals: token.decimals,
        priceUSD: priceUSD,
        valueUSD: valueUSD
      };
    });
    
    // Calculate total value
    const totalValueUSD = tokens.reduce((sum, token) => sum + token.valueUSD, 0);
    
    console.log('📊 [wallet-api] Returning', tokens.length, 'tokens, total value: $' + totalValueUSD.toFixed(2));

    return {
      address,
      timestamp: new Date().toISOString(),
      totalValueUSD,
      tokens
    };
    
  } catch (error) {
    console.error('Error getting wallet balance:', error);
    
    // Return empty data structure on error
    return {
      address,
      timestamp: new Date().toISOString(),
      totalValueUSD: 0,
      tokens: []
    };
  }
} 