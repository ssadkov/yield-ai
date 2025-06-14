export interface YieldResult {
  daily: number;
  weekly: number;
  monthly: number;
  yearly: number;
}

export function calcYield(apy: number, amount: bigint, decimals: number): YieldResult {
  const amountFloat = Number(amount) / Math.pow(10, decimals);
  const apyDecimal = apy / 100; // Convert percentage to decimal

  const yearly = amountFloat * apyDecimal;
  const monthly = yearly / 12;
  const weekly = yearly / 52;
  const daily = yearly / 365;

  return {
    daily,
    weekly,
    monthly,
    yearly
  };
} 