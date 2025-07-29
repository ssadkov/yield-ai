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
      // Разбиваем число на целую и дробную части
      const [intPart, decPart = ''] = value.split('.');
      
      // Преобразуем целую часть в bigint
      let newAmount = BigInt(intPart) * BigInt(Math.pow(10, decimals));
      
      // Добавляем дробную часть, если она есть
      if (decPart) {
        // Дополняем дробную часть нулями до нужного количества знаков
        const paddedDecPart = decPart.padEnd(decimals, '0').slice(0, decimals);
        newAmount += BigInt(paddedDecPart);
      }
      
      setAmount(newAmount);
    } catch (e) {
      console.error('Error parsing amount:', e);
    }
  }, [decimals]);

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