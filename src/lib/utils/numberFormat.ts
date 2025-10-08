/**
 * Utility functions for number formatting
 */

/**
 * Format numbers with spaces for thousands and millions
 * @param num - Number to format
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string with spaces
 * 
 * @example
 * formatNumber(1234.56) // "1 234.56"
 * formatNumber(1234567.89) // "1 234 567.89"
 * formatNumber(1000000, 0) // "1 000 000"
 */
export function formatNumber(num: number, decimals: number = 2): string {
  if (isNaN(num)) return '0';
  
  const fixed = num.toFixed(decimals);
  const parts = fixed.split('.');
  
  // Add spaces to integer part
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  
  return parts.join('.');
}

/**
 * Format currency values with spaces for thousands and millions
 * @param num - Number to format
 * @param decimals - Number of decimal places (default: 2)
 * @param prefix - Currency prefix (default: '$')
 * @returns Formatted currency string
 * 
 * @example
 * formatCurrency(1234.56) // "$1 234.56"
 * formatCurrency(1234567.89) // "$1 234 567.89"
 * formatCurrency(1000000, 0) // "$1 000 000"
 */
export function formatCurrency(num: number, decimals: number = 2, prefix: string = '$'): string {
  return `${prefix}${formatNumber(num, decimals)}`;
}

/**
 * Format large numbers with appropriate units (K, M, B)
 * @param num - Number to format
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted string with units
 * 
 * @example
 * formatCompactNumber(1234) // "1.2K"
 * formatCompactNumber(1234567) // "1.2M"
 * formatCompactNumber(1234567890) // "1.2B"
 */
export function formatCompactNumber(num: number, decimals: number = 1): string {
  if (isNaN(num)) return '0';
  
  const absNum = Math.abs(num);
  
  if (absNum >= 1e9) {
    return `${(num / 1e9).toFixed(decimals)}B`;
  } else if (absNum >= 1e6) {
    return `${(num / 1e6).toFixed(decimals)}M`;
  } else if (absNum >= 1e3) {
    return `${(num / 1e3).toFixed(decimals)}K`;
  } else {
    return num.toFixed(decimals);
  }
}
