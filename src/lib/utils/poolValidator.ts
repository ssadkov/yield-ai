import { InvestmentData } from '@/types/investments';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  data: InvestmentData[];
}

export class PoolValidator {
  static validatePoolData(data: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const validPools: InvestmentData[] = [];

    if (!Array.isArray(data)) {
      errors.push('Data must be an array');
      return { isValid: false, errors, warnings, data: [] };
    }

    data.forEach((pool, index) => {
      const poolErrors: string[] = [];
      const poolWarnings: string[] = [];

      // Required fields validation
      if (!pool.asset) {
        poolErrors.push(`Pool ${index}: Missing 'asset' field`);
      }
      if (!pool.token) {
        poolErrors.push(`Pool ${index}: Missing 'token' field`);
      }
      if (typeof pool.totalAPY !== 'number') {
        poolErrors.push(`Pool ${index}: 'totalAPY' must be a number`);
      }
      if (typeof pool.depositApy !== 'number') {
        poolErrors.push(`Pool ${index}: 'depositApy' must be a number`);
      }
      if (typeof pool.borrowAPY !== 'number') {
        poolErrors.push(`Pool ${index}: 'borrowAPY' must be a number`);
      }
      if (!pool.protocol) {
        poolErrors.push(`Pool ${index}: Missing 'protocol' field`);
      }

      // Optional warnings
      if (!pool.provider) {
        poolWarnings.push(`Pool ${index}: Missing 'provider' field`);
      }
      if (pool.totalAPY < 0) {
        poolWarnings.push(`Pool ${index}: Negative totalAPY detected`);
      }
      if (pool.totalAPY > 1000) {
        poolWarnings.push(`Pool ${index}: Unusually high APY detected (>1000%)`);
      }

      if (poolErrors.length === 0) {
        validPools.push(pool as InvestmentData);
      } else {
        errors.push(...poolErrors);
      }

      warnings.push(...poolWarnings);
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      data: validPools
    };
  }

  static async testApiSource(url: string, transform?: (data: any) => InvestmentData[]): Promise<ValidationResult> {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        return {
          isValid: false,
          errors: [`API request failed with status ${response.status}`],
          warnings: [],
          data: []
        };
      }

      const data = await response.json();
      
      let pools: InvestmentData[];
      if (transform) {
        pools = transform(data);
      } else {
        pools = data.data || data.pools || [];
      }

      return this.validatePoolData(pools);
    } catch (error) {
      return {
        isValid: false,
        errors: [`API request failed: ${error}`],
        warnings: [],
        data: []
      };
    }
  }

  static logValidationResult(result: ValidationResult, sourceName: string) {
    console.log(`\n=== Validation Results for ${sourceName} ===`);
    
    if (result.isValid) {
      console.log('✅ Data is valid');
    } else {
      console.log('❌ Data has errors:');
      result.errors.forEach(error => console.log(`  - ${error}`));
    }

    if (result.warnings.length > 0) {
      console.log('⚠️  Warnings:');
      result.warnings.forEach(warning => console.log(`  - ${warning}`));
    }

    console.log(`📊 Valid pools: ${result.data.length}`);
    
    if (result.data.length > 0) {
      console.log('📋 Sample pool:');
      console.log(JSON.stringify(result.data[0], null, 2));
    }
  }
} 