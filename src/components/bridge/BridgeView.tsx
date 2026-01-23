"use client";

import { useState, useMemo, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AssetPicker } from './AssetPicker';
import { AmountInput } from './AmountInput';
import { SolanaWalletSelector } from '@/components/SolanaWalletSelector';
import { Input } from '@/components/ui/input';
import { ArrowLeftRight, CheckCircle2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useWallet as useSolanaWallet } from '@solana/wallet-adapter-react';

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
  availableBalance?: string | null;
  hideSourceWallet?: boolean;
  hideDestinationAddress?: boolean;
  walletSection?: ReactNode;
  bothWalletsConnected?: boolean;
  missingWalletAlert?: ReactNode;
  bridgeButtonDisabled?: boolean;
  bridgeButtonAlert?: ReactNode;
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
  availableBalance,
  hideSourceWallet = false,
  hideDestinationAddress = false,
  walletSection,
  bothWalletsConnected = false,
  missingWalletAlert,
  bridgeButtonDisabled = false,
  bridgeButtonAlert,
}: BridgeViewProps) {
  const searchParams = useSearchParams();
  const { publicKey: solanaPublicKey, connected: solanaConnected } = useSolanaWallet();
  
  // Check if destination address matches the URL parameter
  const isGeneratedWallet = useMemo(() => {
    const urlDestination = searchParams.get('destination');
    if (!urlDestination || !destinationAddress) return false;
    // Compare addresses (case-insensitive, trim whitespace)
    return urlDestination.trim().toLowerCase() === destinationAddress.trim().toLowerCase();
  }, [searchParams, destinationAddress]);

  // Get Solana address for destination display
  const solanaAddress = solanaPublicKey?.toBase58() || null;

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

          {/* Wallet Section */}
          {walletSection && (
            <div className="pt-2 flex justify-end">
              <div className="w-auto">
                {walletSection}
              </div>
            </div>
          )}

          {/* Missing Wallet Alert */}
          {missingWalletAlert && (
            <div className="pt-2">
              {missingWalletAlert}
            </div>
          )}

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
              disabled={disableAssetSelection || !bothWalletsConnected}
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
              disabled={disableAssetSelection || !bothWalletsConnected}
            />
          </div>

          {/* Amount Input */}
          {sourceToken && (
            <div className="space-y-2">
              <AmountInput
                value={amount}
                onChange={onAmountChange}
                tokenSymbol={sourceToken.symbol}
                maxAmount={10}
                disabled={!bothWalletsConnected}
              />
              {availableBalance !== null && availableBalance !== undefined && (
                <p className="text-sm text-muted-foreground text-right">
                  Available: {availableBalance} {sourceToken.symbol} on Solana
                </p>
              )}
            </div>
          )}


          {/* Bridge Button Alert */}
          {bridgeButtonAlert && (
            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded text-sm text-yellow-800 dark:text-yellow-200">
              {bridgeButtonAlert}
            </div>
          )}

          {/* Transfer Status */}
          {transferStatus && (
            <div className="p-3 bg-muted rounded text-sm">
              {transferStatus}
            </div>
          )}

          {/* Transfer Button */}
          <Button
            onClick={onTransfer}
            disabled={bridgeButtonDisabled || isTransferring}
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

