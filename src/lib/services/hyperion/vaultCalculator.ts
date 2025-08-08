import { PanoraPricesService } from '../panora/prices';

export interface VaultData {
  vaultTokenAddress: string;
  vaultSymbol: string;
  tokenAmounts: number[];
  tokenAddresses: string[];
  tokenSymbols: string[];
  tokenDecimals: number[];
  totalValueUSD: number;
}

export class VaultCalculator {
  private pricesService: PanoraPricesService;

  constructor() {
    this.pricesService = PanoraPricesService.getInstance();
  }

  /**
   * Получает данные Vault токена из блокчейна
   */
  async getVaultData(vaultTokenAddress: string, walletAddress: string): Promise<VaultData | null> {
    try {
      console.log('[VaultCalculator] Getting vault data for:', vaultTokenAddress, walletAddress);

      const response = await fetch('/api/protocols/hyperion/vaultData', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          vaultTokenAddress,
          walletAddress
        })
      });

      if (!response.ok) {
        console.error('[VaultCalculator] API error:', response.status);
        return null;
      }

      const result = await response.json();
      
      if (!result.success) {
        console.error('[VaultCalculator] API returned error:', result.error);
        return null;
      }

      const data = result.data;
      
      // Получаем цены токенов
      const prices = await this.getTokenPrices(data.tokenAddresses);
      
      // Рассчитываем общую стоимость
      const totalValueUSD = this.calculateVaultValue(
        data.tokenAmounts,
        data.tokenDecimals,
        prices
      );

      return {
        vaultTokenAddress: data.vaultTokenAddress,
        vaultSymbol: data.vaultSymbol,
        tokenAmounts: data.tokenAmounts,
        tokenAddresses: data.tokenAddresses,
        tokenSymbols: data.tokenSymbols,
        tokenDecimals: data.tokenDecimals,
        totalValueUSD
      };

    } catch (error) {
      console.error('[VaultCalculator] Error getting vault data:', error);
      return null;
    }
  }

  /**
   * Получает цены токенов
   */
  private async getTokenPrices(tokenAddresses: string[]): Promise<Record<string, number>> {
    try {
      const pricesResponse = await this.pricesService.getPrices(1, tokenAddresses);
      const prices = Array.isArray(pricesResponse) ? pricesResponse : (pricesResponse.data || []);
      
      const priceMap: Record<string, number> = {};
      prices.forEach((price: any) => {
        const address = price.tokenAddress || price.faAddress;
        if (address) {
          priceMap[address] = parseFloat(price.usdPrice || '0');
        }
      });

      console.log('[VaultCalculator] Token prices:', priceMap);
      return priceMap;

    } catch (error) {
      console.error('[VaultCalculator] Error getting token prices:', error);
      return {};
    }
  }

  /**
   * Рассчитывает стоимость Vault токена
   */
  private calculateVaultValue(
    tokenAmounts: number[],
    tokenDecimals: number[],
    prices: Record<string, number>
  ): number {
    let totalValue = 0;

    tokenAmounts.forEach((amount, index) => {
      const decimals = tokenDecimals[index];
      const tokenAddress = Object.keys(prices)[index];
      const price = prices[tokenAddress] || 0;

      // Конвертируем количество с учетом decimals
      const realAmount = amount / Math.pow(10, decimals);
      const value = realAmount * price;
      
      totalValue += value;

      console.log(`[VaultCalculator] Token ${index}:`, {
        amount,
        decimals,
        realAmount,
        price,
        value
      });
    });

    console.log('[VaultCalculator] Total vault value:', totalValue);
    return totalValue;
  }

  /**
   * Получает данные для всех Vault токенов пользователя
   */
  async getAllVaultData(vaultTokenAddresses: string[], walletAddress: string): Promise<VaultData[]> {
    const vaultDataPromises = vaultTokenAddresses.map(address => 
      this.getVaultData(address, walletAddress)
    );

    const results = await Promise.all(vaultDataPromises);
    return results.filter((data): data is VaultData => data !== null);
  }
}
