"use client";

import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { ArrowLeftRight, Loader2, Info, AlertCircle, CheckCircle, XCircle, Copy, ExternalLink, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { useBridge } from '@/lib/hooks/useBridge';
import { getSolanaWalletAddress } from '@/lib/wallet/getSolanaWalletAddress';
import { useToast } from '@/components/ui/use-toast';
import { useSolanaPortfolio } from '@/hooks/useSolanaPortfolio';
import { WormholeBridgeService } from '@/lib/services/wormhole/bridge';

interface BridgeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BridgeModal({ isOpen, onClose }: BridgeModalProps) {
  const { wallet, connected, account } = useWallet();
  const { bridge, isLoading, bridgeStatus } = useBridge();
  const { toast } = useToast();
  const { tokens: solanaTokens, isLoading: isSolanaLoading } = useSolanaPortfolio();

  const [amount, setAmount] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [directBalance, setDirectBalance] = useState<string | null>(null);

  // Get Solana address
  const solanaAddress = useMemo(() => {
    return wallet ? getSolanaWalletAddress(wallet) : null;
  }, [wallet]);

  // Get Aptos address
  const aptosAddress = useMemo(() => {
    return account?.address?.toString() || null;
  }, [account]);

  // Load balance directly from service (always as primary source)
  useEffect(() => {
    if (isOpen && solanaAddress) {
      const loadDirectBalance = async () => {
        try {
          console.log('[BridgeModal] Loading direct USDC balance for address:', solanaAddress);
          const bridgeService = WormholeBridgeService.getInstance();
          const balance = await bridgeService.getSolanaUSDCBalance(solanaAddress);
          console.log('[BridgeModal] Direct balance loaded:', balance);
          setDirectBalance(balance);
        } catch (error) {
          console.error('[BridgeModal] Error loading direct balance:', error);
          setDirectBalance('0');
        }
      };
      loadDirectBalance();
    } else {
      setDirectBalance(null);
    }
  }, [isOpen, solanaAddress]);

  // Get USDC balance - prioritize direct balance, fallback to portfolio
  const solanaBalance = useMemo(() => {
    // Use direct balance if available (most reliable)
    if (directBalance !== null && directBalance !== '0') {
      console.log('[BridgeModal] Using direct balance:', directBalance);
      return directBalance;
    }

    const USDC_SOLANA_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
    
    // Try to get from portfolio tokens as fallback
    if (solanaTokens && solanaTokens.length > 0) {
      // Try to find USDC by address first (case-insensitive)
      let usdcToken = solanaTokens.find(
        token => {
          const tokenAddr = (token.address || '').trim().toLowerCase();
          const usdcAddr = USDC_SOLANA_MINT.toLowerCase();
          return tokenAddr === usdcAddr;
        }
      );
      
      // If not found by address, try by symbol
      if (!usdcToken) {
        usdcToken = solanaTokens.find(
          token => {
            const symbol = (token.symbol || '').trim().toUpperCase();
            return symbol === 'USDC';
          }
        );
      }
      
      // Debug logging
      console.log('[BridgeModal] Solana tokens count:', solanaTokens.length);
      console.log('[BridgeModal] Solana tokens:', solanaTokens.map(t => ({
        address: t.address,
        symbol: t.symbol,
        amount: t.amount,
        decimals: t.decimals
      })));
      console.log('[BridgeModal] Looking for USDC with mint:', USDC_SOLANA_MINT);
      console.log('[BridgeModal] Found USDC token:', usdcToken);
      
      if (usdcToken && usdcToken.amount) {
        try {
          // Calculate balance from raw amount and decimals
          const rawAmount = BigInt(usdcToken.amount);
          const decimals = usdcToken.decimals || 6;
          const balance = Number(rawAmount) / Math.pow(10, decimals);
          
          console.log('[BridgeModal] USDC balance from portfolio:', balance.toFixed(6));
          return balance.toFixed(6);
        } catch (error) {
          console.error('[BridgeModal] Error calculating USDC balance:', error);
        }
      }
    }
    
    // Return direct balance even if 0, or fallback to 0
    return directBalance !== null ? directBalance : '0';
  }, [solanaTokens, directBalance]);

  // Calculate amount in smallest unit (USDC has 6 decimals)
  const amountInSmallestUnit = useMemo(() => {
    if (!amount || isNaN(Number(amount))) return '0';
    return (Number(amount) * 1_000_000).toString();
  }, [amount]);

  // USD value (same as amount for USDC)
  const usdValue = useMemo(() => {
    return amount || '0';
  }, [amount]);

  const handleMax = () => {
    const balanceNum = parseFloat(solanaBalance);
    if (balanceNum > 0) {
      setAmount(balanceNum.toString());
    }
  };

  const handleBridge = async () => {
    if (!connected || !solanaAddress || !aptosAddress) {
      setError('Wallet not connected');
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    const amountNum = parseFloat(amount);
    const balanceNum = parseFloat(solanaBalance);

    if (amountNum > balanceNum) {
      setError('Insufficient balance');
      return;
    }

    setError(null);

    try {
      await bridge({
        amount: amountInSmallestUnit,
        toAddress: aptosAddress,
      });
    } catch (error: any) {
      setError(error.message || 'Failed to bridge tokens');
    }
  };

  const copyAddress = async (address: string, label: string) => {
    try {
      await navigator.clipboard.writeText(address);
      toast({
        title: 'Copied',
        description: `${label} address copied to clipboard`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to copy address',
        variant: 'destructive',
      });
    }
  };

  const getExplorerUrl = (txHash: string, chain: 'solana' | 'aptos') => {
    if (chain === 'solana') {
      return `https://solscan.io/tx/${txHash}`;
    }
    return `https://explorer.aptoslabs.com/txn/${txHash}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5" />
            Bridge USDC
          </DialogTitle>
          <DialogDescription>
            Transfer USDC from Solana to Aptos using Wormhole CCTP
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-4">
          {/* Source Chain (Solana) */}
          <div className="flex flex-col gap-2">
            <Label>From (Solana)</Label>
            <div className="flex items-center gap-2 p-3 border rounded-md bg-muted/50">
              <div className="flex items-center gap-2 flex-1">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-xs font-bold">
                  S
                </div>
                <span className="font-medium">Solana</span>
              </div>
              {solanaAddress && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground font-mono">
                    {solanaAddress.slice(0, 6)}...{solanaAddress.slice(-4)}
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={() => copyAddress(solanaAddress, 'Solana')}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Amount Input */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label>Amount</Label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  Balance: {isSolanaLoading ? '...' : `${parseFloat(solanaBalance).toFixed(2)} USDC`}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-xs"
                  onClick={handleMax}
                  disabled={isSolanaLoading || parseFloat(solanaBalance) === 0}
                >
                  MAX
                </Button>
              </div>
            </div>
            <div className="relative">
              <Input
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={isLoading || !connected}
                className="pr-20"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                <Image
                  src="/protocol_ico/panora.png"
                  alt="USDC"
                  width={20}
                  height={20}
                  className="rounded-full"
                />
                <span className="text-sm font-medium">USDC</span>
              </div>
            </div>
            {amount && parseFloat(amount) > 0 && (
              <div className="text-xs text-muted-foreground">
                ≈ ${parseFloat(usdValue).toFixed(2)} USD
              </div>
            )}
          </div>

          {/* Destination Chain (Aptos) */}
          <div className="flex flex-col gap-2">
            <Label>To (Aptos)</Label>
            <div className="flex items-center gap-2 p-3 border rounded-md bg-muted/50">
              <div className="flex items-center gap-2 flex-1">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-green-500 flex items-center justify-center text-white text-xs font-bold">
                  A
                </div>
                <span className="font-medium">Aptos</span>
              </div>
              {aptosAddress && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground font-mono">
                    {aptosAddress.slice(0, 6)}...{aptosAddress.slice(-4)}
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={() => copyAddress(aptosAddress, 'Aptos')}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Info Box */}
          <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-md">
            <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="flex flex-col gap-1 text-xs text-blue-800 dark:text-blue-200">
              <p className="font-medium">Bridge Information</p>
              <ul className="list-disc list-inside space-y-1 text-blue-700 dark:text-blue-300">
                <li>No bridge fees (CCTP is free)</li>
                <li>Only network gas fees apply</li>
                <li>Estimated time: 2-5 minutes</li>
                <li>Automatic relaying included</li>
              </ul>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-md">
              <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          {/* Bridge Status */}
          {bridgeStatus && (
            <div className="flex flex-col gap-2 p-3 border rounded-md">
              <div className="flex items-center gap-2">
                {bridgeStatus.status === 'pending' && (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                    <span className="text-sm font-medium">Bridge in progress...</span>
                  </>
                )}
                {bridgeStatus.status === 'completed' && (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium text-green-600">Bridge completed!</span>
                  </>
                )}
                {bridgeStatus.status === 'failed' && (
                  <>
                    <XCircle className="h-4 w-4 text-red-600" />
                    <span className="text-sm font-medium text-red-600">Bridge failed</span>
                  </>
                )}
              </div>
              {bridgeStatus.sourceTxHash && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">Source TX:</span>
                  <a
                    href={getExplorerUrl(bridgeStatus.sourceTxHash, 'solana')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline flex items-center gap-1"
                  >
                    {bridgeStatus.sourceTxHash.slice(0, 8)}...
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
              {bridgeStatus.destinationTxHash && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">Destination TX:</span>
                  <a
                    href={getExplorerUrl(bridgeStatus.destinationTxHash, 'aptos')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline flex items-center gap-1"
                  >
                    {bridgeStatus.destinationTxHash.slice(0, 8)}...
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
              {bridgeStatus.error && (
                <p className="text-xs text-red-600">{bridgeStatus.error}</p>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col gap-2 pt-2">
            {!connected ? (
              <Button disabled className="w-full">
                Connect Wallet
              </Button>
            ) : !solanaAddress ? (
              <Button disabled className="w-full">
                Solana wallet not available
              </Button>
            ) : (
              <Button
                onClick={handleBridge}
                disabled={isLoading || !amount || parseFloat(amount) <= 0 || parseFloat(amount) > parseFloat(solanaBalance)}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Bridging...
                  </>
                ) : (
                  <>
                    <ArrowLeftRight className="mr-2 h-4 w-4" />
                    Bridge USDC
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

