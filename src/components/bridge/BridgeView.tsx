"use client";

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AssetPicker } from './AssetPicker';
import { AmountInput } from './AmountInput';
import { SolanaWalletSelector } from '@/components/SolanaWalletSelector';
import { Input } from '@/components/ui/input';
import { ArrowLeftRight } from 'lucide-react';

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

interface BridgeViewProps {
  sourceChain: Chain | null;
  sourceToken: Token | null;
  destChain: Chain | null;
  destToken: Token | null;
  amount: string;
  destinationAddress: string;
  onSourceChainSelect: (chain: Chain) => void;
  onSourceTokenSelect: (token: Token) => void;
  onDestChainSelect: (chain: Chain) => void;
  onDestTokenSelect: (token: Token) => void;
  onAmountChange: (amount: string) => void;
  onDestinationAddressChange: (address: string) => void;
  onTransfer: () => void;
  onRefund?: () => void;
  hasFundedSigners?: boolean;
  isTransferring?: boolean;
  transferStatus?: string;
  chains: Chain[];
  tokens: Token[];
  showSwapButton?: boolean;
  disableAssetSelection?: boolean;
}

export function BridgeView({
  sourceChain,
  sourceToken,
  destChain,
  destToken,
  amount,
  destinationAddress,
  onSourceChainSelect,
  onSourceTokenSelect,
  onDestChainSelect,
  onDestTokenSelect,
  onAmountChange,
  onDestinationAddressChange,
  onTransfer,
  onRefund,
  hasFundedSigners,
  isTransferring,
  transferStatus,
  chains,
  tokens,
  showSwapButton = true,
  disableAssetSelection = false,
}: BridgeViewProps) {

  const handleSwap = () => {
    if (sourceChain && destChain) {
      const tempChain = sourceChain;
      onSourceChainSelect(destChain);
      onDestChainSelect(tempChain);
    }
    if (sourceToken && destToken) {
      const tempToken = sourceToken;
      onSourceTokenSelect(destToken);
      onDestTokenSelect(tempToken);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-4">
      <Card className="border-2">
        <CardContent className="p-6 space-y-6">
          {/* Title */}
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-2">Bridge Assets</h1>
            <p className="text-sm text-muted-foreground">
              Transfer tokens across chains
            </p>
          </div>

          {/* Source Asset */}
          <div className="space-y-4">
            <AssetPicker
              label="From"
              chain={sourceChain}
              token={sourceToken}
              chains={chains}
              tokens={tokens}
              onChainSelect={onSourceChainSelect}
              onTokenSelect={onSourceTokenSelect}
              disabled={disableAssetSelection}
            />

            {/* Swap Button */}
            {showSwapButton && (
              <div className="flex justify-center -my-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-full rotate-90"
                  onClick={handleSwap}
                >
                  <ArrowLeftRight className="w-4 h-4" />
                </Button>
              </div>
            )}

            {/* Destination Asset */}
            <AssetPicker
              label="To"
              chain={destChain}
              token={destToken}
              chains={chains}
              tokens={tokens}
              onChainSelect={onDestChainSelect}
              onTokenSelect={onDestTokenSelect}
              disabled={disableAssetSelection}
            />
          </div>

          {/* Amount Input */}
          {sourceToken && (
            <AmountInput
              value={amount}
              onChange={onAmountChange}
              tokenSymbol={sourceToken.symbol}
              maxAmount={10}
            />
          )}

          {/* Wallets */}
          <div className="space-y-4 pt-4 border-t">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Source Wallet
              </label>
              {sourceChain?.id === 'Solana' ? (
                <SolanaWalletSelector onWalletChange={() => {}} />
              ) : (
                <div className="p-3 border rounded text-sm text-muted-foreground">
                  Connect {sourceChain?.name || 'source'} wallet
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Destination Wallet Address
              </label>
              <Input
                type="text"
                value={destinationAddress}
                onChange={(e) => onDestinationAddressChange(e.target.value)}
                placeholder={`Enter ${destChain?.name || 'destination'} wallet address`}
                className="font-mono text-sm"
              />
            </div>
          </div>

          {/* Transfer Status */}
          {transferStatus && (
            <div className="p-3 bg-muted rounded text-sm">
              {transferStatus}
            </div>
          )}

          {/* Transfer Button */}
          <Button
            onClick={onTransfer}
            disabled={
              !sourceChain ||
              !sourceToken ||
              !destChain ||
              !destToken ||
              !amount ||
              !destinationAddress.trim() ||
              isTransferring
            }
            className="w-full h-12 text-lg font-semibold"
          >
            {isTransferring ? 'Transferring...' : 'Bridge'}
          </Button>

          {/* Refund Button */}
          {onRefund && hasFundedSigners && (
            <Button
              onClick={onRefund}
              disabled={isTransferring}
              variant="outline"
              className="w-full"
            >
              {isTransferring ? 'Processing...' : 'Refund SOL from Internal Signers'}
            </Button>
          )}

          {/* Info */}
          <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
            <p>• Automatic relaying: The relayer will complete the transfer</p>
            <p>• Gas on destination: 0.01 APT will be provided for gas fees</p>
            <p>• Works on empty Aptos wallets: No need to pre-fund with APT</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

