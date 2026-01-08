"use client";

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface AmountInputProps {
  value: string;
  onChange: (value: string) => void;
  max?: string;
  onMaxClick?: () => void;
  disabled?: boolean;
  tokenSymbol?: string;
  maxAmount?: number;
}

export function AmountInput({
  value,
  onChange,
  max,
  onMaxClick,
  disabled,
  tokenSymbol,
  maxAmount,
}: AmountInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    if (maxAmount !== undefined) {
      const numValue = parseFloat(newValue);
      if (!isNaN(numValue) && numValue > maxAmount) {
        return; // Don't allow values greater than maxAmount
      }
    }
    onChange(newValue);
  };

  const displayMax = maxAmount !== undefined ? maxAmount.toString() : max;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-muted-foreground">
          Amount
        </label>
        {displayMax && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onMaxClick}
            className="h-auto p-1 text-xs"
          >
            Max: {displayMax} {tokenSymbol}
          </Button>
        )}
      </div>
      <div className="relative">
        <Input
          type="number"
          value={value}
          onChange={handleChange}
          placeholder="0.0"
          disabled={disabled}
          max={maxAmount}
          className="text-2xl font-semibold h-16 pr-20"
        />
        {tokenSymbol && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
            {tokenSymbol}
          </div>
        )}
      </div>
      {maxAmount !== undefined && parseFloat(value || '0') > maxAmount && (
        <p className="text-sm text-red-500">
          Maximum amount is {maxAmount} {tokenSymbol}
        </p>
      )}
    </div>
  );
}





