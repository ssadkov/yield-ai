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
}

export function AmountInput({
  value,
  onChange,
  max,
  onMaxClick,
  disabled,
  tokenSymbol,
}: AmountInputProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-muted-foreground">
          Amount
        </label>
        {max && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onMaxClick}
            className="h-auto p-1 text-xs"
          >
            Max: {max} {tokenSymbol}
          </Button>
        )}
      </div>
      <div className="relative">
        <Input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0.0"
          disabled={disabled}
          className="text-2xl font-semibold h-16 pr-20"
        />
        {tokenSymbol && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
            {tokenSymbol}
          </div>
        )}
      </div>
    </div>
  );
}





