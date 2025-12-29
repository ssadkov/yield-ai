"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';

interface Chain {
  id: string;
  name: string;
  icon?: string;
}

interface Token {
  id: string;
  symbol: string;
  name: string;
  icon?: string;
  chain: string;
}

interface AssetPickerProps {
  label: string;
  chain: Chain | null;
  token: Token | null;
  chains: Chain[];
  tokens: Token[];
  onChainSelect: (chain: Chain) => void;
  onTokenSelect: (token: Token) => void;
  disabled?: boolean;
}

export function AssetPicker({
  label,
  chain,
  token,
  chains,
  tokens,
  onChainSelect,
  onTokenSelect,
  disabled,
}: AssetPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState<'chain' | 'token'>('chain');

  const filteredTokens = chain
    ? tokens.filter((t) => t.chain === chain.id)
    : tokens;

  return (
    <>
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">
          {label}
        </label>
        <Button
          variant="outline"
          className="w-full h-auto p-4 justify-between"
          onClick={() => {
            setPickerMode('chain');
            setIsOpen(true);
          }}
          disabled={disabled}
        >
          <div className="flex items-center gap-3">
            {chain ? (
              <>
                {chain.icon && (
                  <img
                    src={chain.icon}
                    alt={chain.name}
                    className="w-6 h-6 rounded-full"
                  />
                )}
                <div className="text-left">
                  <div className="font-medium">{chain.name}</div>
                  {token && (
                    <div className="text-sm text-muted-foreground">
                      {token.symbol}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <span className="text-muted-foreground">Select {label}</span>
            )}
          </div>
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </Button>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {pickerMode === 'chain' ? 'Select Chain' : 'Select Token'}
            </DialogTitle>
          </DialogHeader>

          {pickerMode === 'chain' ? (
            <div className="space-y-2 mt-4 max-h-[400px] overflow-y-auto">
              {chains.map((c) => (
                <Card
                  key={c.id}
                  className="p-4 cursor-pointer hover:bg-muted transition-colors"
                  onClick={() => {
                    onChainSelect(c);
                    if (filteredTokens.length > 0) {
                      setPickerMode('token');
                    } else {
                      setIsOpen(false);
                    }
                  }}
                >
                  <div className="flex items-center gap-3">
                    {c.icon && (
                      <img
                        src={c.icon}
                        alt={c.name}
                        className="w-8 h-8 rounded-full"
                      />
                    )}
                    <div className="font-medium">{c.name}</div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="space-y-2 mt-4 max-h-[400px] overflow-y-auto">
              {filteredTokens.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  No tokens available for {chain?.name}
                </div>
              ) : (
                filteredTokens.map((t) => (
                  <Card
                    key={t.id}
                    className="p-4 cursor-pointer hover:bg-muted transition-colors"
                    onClick={() => {
                      onTokenSelect(t);
                      setIsOpen(false);
                    }}
                  >
                    <div className="flex items-center gap-3">
                      {t.icon && (
                        <img
                          src={t.icon}
                          alt={t.symbol}
                          className="w-8 h-8 rounded-full"
                        />
                      )}
                      <div>
                        <div className="font-medium">{t.symbol}</div>
                        <div className="text-sm text-muted-foreground">
                          {t.name}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))
              )}
              <Button
                variant="ghost"
                className="w-full mt-2"
                onClick={() => setPickerMode('chain')}
              >
                ← Back to Chains
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}





