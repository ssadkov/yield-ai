import { getMesoTokenByInner, getMesoTokenSymbol } from './tokens';

export interface MesoPosition {
  protocol: 'Meso Finance';
  type: 'deposit' | 'debt';
  tokenSymbol: string;
  tokenName: string;
  shares: string;
  inner: string;
  decimals: number;
}

export interface MesoUserPosition {
  deposits: MesoPosition[];
  debts: MesoPosition[];
}

function formatTokenAmount(amount: string, decimals: number): string {
  const bigIntAmount = BigInt(amount);
  const divisor = BigInt(10 ** decimals);
  
  const wholePart = bigIntAmount / divisor;
  const fractionalPart = bigIntAmount % divisor;
  
  if (fractionalPart === BigInt(0)) {
    return wholePart.toString();
  }
  
  // Format fractional part with leading zeros
  const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
  // Remove trailing zeros
  const trimmedFractional = fractionalStr.replace(/0+$/, '');
  
  return `${wholePart}.${trimmedFractional}`;
}

export function parseMesoPosition(resourceData: any): MesoUserPosition | null {
  try {
    const deposits: MesoPosition[] = [];
    const debts: MesoPosition[] = [];

    // Parse deposit shares
    if (resourceData.deposit_shares?.data) {
      resourceData.deposit_shares.data.forEach((item: any) => {
        const inner = item.key?.inner;
        if (inner) {
          const token = getMesoTokenByInner(inner);
          deposits.push({
            protocol: 'Meso Finance',
            type: 'deposit',
            tokenSymbol: token?.symbol || 'Unknown',
            tokenName: token?.name || 'Unknown Token',
            shares: item.value,
            inner: inner,
            decimals: token?.decimals || 8
          });
        }
      });
    }

    // Parse debt shares
    if (resourceData.debt_shares?.data) {
      resourceData.debt_shares.data.forEach((item: any) => {
        const inner = item.key?.inner;
        if (inner) {
          const token = getMesoTokenByInner(inner);
          debts.push({
            protocol: 'Meso Finance',
            type: 'debt',
            tokenSymbol: token?.symbol || 'Unknown',
            tokenName: token?.name || 'Unknown Token',
            shares: item.value,
            inner: inner,
            decimals: token?.decimals || 8
          });
        }
      });
    }

    return {
      deposits,
      debts
    };
  } catch (error) {
    console.error('Error parsing Meso position:', error);
    return null;
  }
}

export function formatMesoPosition(position: MesoUserPosition): string {
  const parts: string[] = [];
  
  if (position.deposits.length > 0) {
    const deposits = position.deposits.map(d => 
      `${formatTokenAmount(d.shares, d.decimals)} ${d.tokenSymbol}`
    ).join(', ');
    parts.push(`Deposits: ${deposits}`);
  }
  
  if (position.debts.length > 0) {
    const debts = position.debts.map(d => 
      `${formatTokenAmount(d.shares, d.decimals)} ${d.tokenSymbol}`
    ).join(', ');
    parts.push(`Debts: ${debts}`);
  }
  
  return parts.join(' | ');
} 