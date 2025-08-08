import { AptosWalletService } from './aptos/wallet';
import { PanoraPricesService } from './panora/prices';

interface TokenBalance {
  address: string;
  symbol: string | null;
  name: string | null;
  balance: string;
  decimals: number;
  priceUSD: number;
  valueUSD: number;
}

// Token information mapping
const TOKEN_INFO: Record<string, { symbol: string; decimals: number; name: string }> = {
  // Native tokens
  '0x1::aptos_coin::AptosCoin': { symbol: 'APT', decimals: 8, name: 'Aptos' },
  
  // Staking tokens
  '0x111ae3e5bc816a5e63c2da97d0aa3886519e0cd5e4b046659fa35796bd11542a::stapt_token::StakedApt': { symbol: 'stAPT', decimals: 8, name: 'Staked Aptos' },
  '0x111ae3e5bc816a5e63c2da97d0aa3886519e0cd5e4b046659fa35796bd11542a::amapt_token::AmnisApt': { symbol: 'amAPT', decimals: 8, name: 'Amnis Aptos Coin' },
  '0x50788befc1107c0cc4473848a92e5c783c635866ce3c98de71d2eeb7d2a34f85::aptos_coin::AptosCoin': { symbol: 'amAPT', decimals: 8, name: 'Amnis Aptos' },
  
  // Stablecoins
  '0x357b0b74bc833e95a115ad22604854d6b0fca151cecd94111770e5d6ffc9dc2b': { symbol: 'USDt', decimals: 6, name: 'Tether USD' },
  '0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b': { symbol: 'USDC', decimals: 6, name: 'USDC' },
  
  // Popular tokens
  '0x68844a0d7f2587e726ad0579f3d640865bb4162c08a4589eeda3f9689ec52a3d': { symbol: 'WBTC', decimals: 8, name: 'Wrapped BTC' },
  '0x81214a80d82035a190fcb76b6ff3c0145161c3a9f33d137f2bbaee4cfec8a387': { symbol: 'xBTC', decimals: 8, name: 'OKX Wrapped BTC' },
  '0x435ad41e7b383cef98899c4e5a22c8dc88ab67b22f95e5663d6c6649298c3a9d': { symbol: 'RION', decimals: 6, name: 'Hyperion' },
  '0xb2c7780f0a255a6137e5b39733f5a4c85fe093c549de5c359c1232deef57d1b7': { symbol: 'ECHO', decimals: 8, name: 'Echo' },
  '0x5ae6789dd2fec1a9ec9cccfb3acaf12e93d432f0a3a42c92fe1a9d490b7bbc06::mkl_token::MKL': { symbol: 'MKL', decimals: 6, name: 'Merkle' },
  '0xb36527754eb54d7ff55daf13bcb54b42b88ec484bd6f0e3b2e0d1db169de6451': { symbol: 'AMI', decimals: 8, name: 'AMNIS' },
  '0x53a30a6e5936c0a4c5140daed34de39d17ca7fcae08f947c02e979cef98a3719::coin::LSD': { symbol: 'LSD', decimals: 8, name: 'Liquidswap' },
  '0x7fd500c11216f0fe3095d0c4b8aa4d64a4e2e04f83758462f2b127255643615::thl_coin::THL': { symbol: 'THL', decimals: 8, name: 'Thala Token' },
  '0x2ebb2ccac5e027a87fa0e2e5f656a3a4238d6a48d93ec9b610d570fc0aa0df12': { symbol: 'CELL', decimals: 8, name: 'Cellana' },
  '0xeedba439a4ab8987a995cf5cfefebd713000b3365718a29dfbc36bc214445fb8': { symbol: 'VIBE', decimals: 8, name: 'VibrantX token' },
  '0xe4ccb6d39136469f376242c31b34d10515c8eaaa38092f804db8e08a8f53c5b2::assets_v1::EchoCoin002': { symbol: 'GUI', decimals: 6, name: 'Gui Inu' },
  '0xbcff91abababee684b194219ff2113c26e63d57c8872e6fdaf25a41a45fb7197': { symbol: 'AURO', decimals: 8, name: 'AURO Finance' },
  '0x378d5ba871c3d1bdf477a617f997f23d9e0702de97a02f42925b44fa3abc9866': { symbol: 'MESO', decimals: 8, name: 'MESO' },
  '0xeeb5ba9616292d315edc8ce36a25b921bab879b2a7088d479d12b0c182bd28c8': { symbol: 'CATTOS', decimals: 8, name: 'Defi Cattos' },
  '0x9d0595765a31f8d56e1d2aafc4d6c76f283c67a074ef8812d8c31bd8252ac2c3::asset::TOMA': { symbol: 'TOMA', decimals: 6, name: 'Tomarket' },
  '0xd0ab8c2f76cd640455db56ca758a9766a966c88f77920347aac1719edab1df5e': { symbol: 'AMA', decimals: 8, name: 'Amaterasu' },
  '0x73eb84966be67e4697fc5ae75173ca6c35089e802650f75422ab49a8729704ec::coin::DooDoo': { symbol: 'DooDoo', decimals: 8, name: 'DooDoo' },
  '0x268d4a7a2ad93274edf6116f9f20ad8455223a7ab5fc73154f687e7dbc3e3ec6::LOON::LOON': { symbol: 'LOON', decimals: 6, name: 'The Loonies' },
  '0xf37a8864fe737eb8ec2c2931047047cbaed1beed3fb0e5b7c5526dafd3b9c2e9': { symbol: 'USDe', decimals: 6, name: 'USDe' },
  '0xfaf4e633ae9eb31366c9ca24214231760926576c7b625313b3688b5e900731f6::staking::ThalaAPT': { symbol: 'thAPT', decimals: 8, name: 'Thala APT' },
  '0xfaf4e633ae9eb31366c9ca24214231760926576c7b625313b3688b5e900731f6::staking::StakedThalaAPT': { symbol: 'sthAPT', decimals: 8, name: 'Staked Thala APT' },
  '0x821c94e69bc7ca058c913b7b5e6b0a5c9fd1523d58723a966fb8c1f5ea888105': { symbol: 'kAPT', decimals: 8, name: 'Kofi APT' },
  '0x42556039b88593e768c97ab1a3ab0c6a17230825769304482dff8fdebe4c002b': { symbol: 'stkAPT', decimals: 8, name: 'Staked Kofi APT' },
  '0xdd84125d1ebac8f1ecb2819801417fc392325e672be111ec03830c34d6ff82dd': { symbol: 'mUSD', decimals: 8, name: 'mirage dollar' },
  '0x6f986d146e4a90b828d8c12c14b6f4e003fdff11a8eecceceb63744363eaac01::mod_coin::MOD': { symbol: 'MOD', decimals: 8, name: 'Move Dollar' },
  '0x534e4c3dc0f038dab1a8259e89301c4da58779a5d482fb354a41c08147e6b9ec': { symbol: 'USDA', decimals: 8, name: 'AURO USDA' },
};

interface WalletData {
  address: string;
  timestamp: string;
  totalValueUSD: number;
  tokens: TokenBalance[];
}

export async function getWalletBalance(address: string): Promise<WalletData> {
  try {
    console.log('🔍 getWalletBalance called for address:', address);
    
    // Get wallet balances using existing service
    const walletService = AptosWalletService.getInstance();
    console.log('📡 Fetching balances from Aptos...');
    const balanceData = await walletService.getBalances(address);
    console.log('📊 Raw balance data:', balanceData);
    
    // Get token prices from Panora API using the same service as Sidebar
    let prices: any[] = [];
    try {
      console.log('💰 Fetching token prices from Panora...');
      const pricesService = PanoraPricesService.getInstance();
      
      // Собираем адреса токенов
      const tokenAddresses = balanceData.balances?.map((balance: any) => balance.asset_type) || [];
      console.log('🔍 Token addresses for prices:', tokenAddresses);
      
      const pricesResponse = await pricesService.getPrices(1, tokenAddresses);
      // PanoraPricesService возвращает массив напрямую, а не объект с data
      prices = Array.isArray(pricesResponse) ? pricesResponse : (pricesResponse.data || []);
      console.log('💵 Token prices received:', prices.length, 'tokens');
      console.log('💵 Sample price data:', prices[0]);
    } catch (error) {
      console.warn('⚠️ Failed to fetch token prices:', error);
    }
    
    let totalValueUSD = 0;
    const tokens: TokenBalance[] = [];
    
    // Process each balance
    console.log('🔄 Processing', balanceData.balances?.length || 0, 'balances...');
    
    for (const balance of balanceData.balances || []) {
      const assetType: string = balance.asset_type;
      const amount: string = balance.amount;
      
      console.log('🔍 Processing token:', assetType, 'amount:', amount);
      
      // Find price from Panora API response (точно как в AptosPortfolioService)
      const priceData = prices.find((p: any) => 
        p.tokenAddress === assetType || 
        p.faAddress === assetType
      );
      
      console.log('💰 Price data found:', priceData);
      
      if (priceData) {
        // Use price data from Panora (точно как в AptosPortfolioService)
        const balanceNumber = parseFloat(amount) / Math.pow(10, priceData.decimals);
        const priceUSD = parseFloat(priceData.usdPrice);
        const valueUSD = balanceNumber * priceUSD;
        
        console.log('💱 Calculated:', balanceNumber, 'tokens, $', priceUSD, 'price, $', valueUSD, 'total');
        
        tokens.push({
          address: assetType,
          symbol: priceData.symbol,
          name: priceData.name,
          balance: balanceNumber.toString(),
          decimals: priceData.decimals,
          priceUSD: priceUSD,
          valueUSD: valueUSD
        });
        
        totalValueUSD += valueUSD;
      } else {
        // Fallback for unknown tokens (точно как в AptosPortfolioService)
        console.log('📝 No price found for token:', assetType);
        
        const symbol = assetType.includes('::') 
          ? assetType.split('::').pop()?.replace('>', '') || assetType
          : assetType;
        
        tokens.push({
          address: assetType,
          symbol,
          name: symbol,
          balance: amount, // Оставляем как есть, без конвертации
          decimals: 8, // дефолтное значение
          priceUSD: 0,
          valueUSD: 0
        });
      }
    }
    
    // Sort tokens by value (highest first)
    tokens.sort((a, b) => b.valueUSD - a.valueUSD);
    
    // Ensure number (avoid -0)
    totalValueUSD = Number(totalValueUSD) || 0;

    console.log('✅ Final result:', {
      address,
      totalValueUSD,
      tokenCount: tokens.length,
    });
    
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