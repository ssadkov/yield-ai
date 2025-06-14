import { useState, useCallback } from 'react';

interface UseAmountInputProps {
  balance: bigint;
  decimals: number;
  initialValue?: bigint;
}

export function useAmountInput({ balance, decimals, initialValue }: UseAmountInputProps) {
  const [amount, setAmount] = useState<bigint>(initialValue || balance);

  const setHalf = useCallback(() => {
    setAmount(balance / BigInt(2));
  }, [balance]);

  const setMax = useCallback(() => {
    setAmount(balance);
  }, [balance]);

  const setAmountFromString = useCallback((value: string) => {
    if (!value) {
      setAmount(BigInt(0));
      return;
    }

    try {
      const floatValue = parseFloat(value);
      if (isNaN(floatValue)) return;

      const multiplier = BigInt(Math.pow(10, decimals));
      const newAmount = BigInt(Math.floor(floatValue * Math.pow(10, decimals)));
      
      if (newAmount > balance) {
        setAmount(balance);
      } else {
        setAmount(newAmount);
      }
    } catch (e) {
      console.error('Error parsing amount:', e);
    }
  }, [balance, decimals]);

  const amountString = (Number(amount) / Math.pow(10, decimals)).toString();

  return {
    amount,
    amountString,
    setAmount,
    setAmountFromString,
    setHalf,
    setMax,
    isValid: amount > BigInt(0) && amount <= balance
  };
} 