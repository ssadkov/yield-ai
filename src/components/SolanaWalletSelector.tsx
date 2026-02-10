"use client";

import { useState, useMemo, useEffect } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletReadyState, WalletName } from '@solana/wallet-adapter-base';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';

interface SolanaWalletSelectorProps {
  onWalletChange?: (address: string | null) => void;
}

export function SolanaWalletSelector({ onWalletChange }: SolanaWalletSelectorProps) {
  const { wallet, wallets, select, connect, disconnect, connected, publicKey } = useWallet();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  // Notify parent when wallet changes
  useEffect(() => {
    if (onWalletChange) {
      onWalletChange(publicKey?.toBase58() || null);
    }
  }, [publicKey, onWalletChange]);

  // Reset connecting state when wallet connects
  useEffect(() => {
    if (connected) {
      setIsConnecting(false);
    }
  }, [connected]);

  const availableWallets = useMemo(() => {
    // Include all wallets except those that are not detected
    // This includes Standard Wallets (Phantom, Trust) which are automatically detected
    const filtered = wallets.filter(
      (wallet) => wallet.readyState !== WalletReadyState.NotDetected
    );
    
    // Remove duplicates by name (keep first occurrence)
    const seen = new Set<string>();
    return filtered.filter((wallet) => {
      const name = wallet.adapter.name;
      if (seen.has(name)) {
        return false;
      }
      seen.add(name);
      return true;
    });
  }, [wallets]);

  const handleWalletSelect = async (walletName: string) => {
    try {
      setIsConnecting(true);
      select(walletName as WalletName);
      setIsDialogOpen(false);
      
      // Auto-connect after selection
      setTimeout(async () => {
        try {
          await connect();
          toast({
            title: "Wallet Connected",
            description: `Connected to ${walletName}`,
          });
        } catch (error: any) {
          // Don't show toast — connection often succeeds via restore mechanism
          // even when connect() throws (race condition with Phantom etc.)
          console.log('[SolanaWalletSelector] connect failed (suppressed):', error?.message);
        } finally {
          setIsConnecting(false);
        }
      }, 100);
    } catch (error: any) {
      setIsConnecting(false);
      toast({
        variant: "destructive",
        title: "Selection Failed",
        description: error.message || "Failed to select wallet",
      });
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
      setIsDialogOpen(false);
      toast({
        title: "Wallet Disconnected",
        description: "Solana wallet disconnected",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Disconnect Failed",
        description: error.message || "Failed to disconnect wallet",
      });
    }
  };

  if (connected && publicKey) {
    return (
      <div className="flex items-center justify-between p-3 border rounded">
        <span className="text-sm">
          {wallet?.adapter.name || 'Unknown'}: {publicKey.toBase58().slice(0, 8)}...{publicKey.toBase58().slice(-8)}
        </span>
        <div className="flex gap-2">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                Change
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Select Solana Wallet</DialogTitle>
                <DialogDescription>
                  Choose a wallet to connect to your Solana account
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2 mt-4">
                {availableWallets.map((w, index) => (
                  <Button
                    key={`${w.adapter.name}-${index}-${w.adapter.url || ''}`}
                    variant={wallet?.adapter.name === w.adapter.name ? "default" : "outline"}
                    className="w-full justify-start"
                    onClick={() => handleWalletSelect(w.adapter.name)}
                    disabled={wallet?.adapter.name === w.adapter.name}
                  >
                    <div className="flex items-center gap-2">
                      {w.adapter.icon && (
                        <img src={w.adapter.icon} alt={w.adapter.name} className="w-6 h-6" />
                      )}
                      <span>{w.adapter.name}</span>
                      {w.adapter.name === wallet?.adapter.name && (
                        <span className="ml-auto text-xs">(Connected)</span>
                      )}
                    </div>
                  </Button>
                ))}
                <Button
                  variant="destructive"
                  className="w-full mt-4"
                  onClick={handleDisconnect}
                >
                  Disconnect
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    );
  }

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button className="w-full">Connect Solana Wallet</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Select Solana Wallet</DialogTitle>
          <DialogDescription>
            Choose a wallet to connect to your Solana account
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 mt-4">
          {availableWallets.length === 0 ? (
            <div className="text-sm text-muted-foreground p-4 text-center">
              No Solana wallets detected. Please install a wallet extension.
            </div>
          ) : (
            availableWallets.map((w, index) => (
              <Button
                key={`${w.adapter.name}-${index}-${w.adapter.url || ''}`}
                variant="outline"
                className="w-full justify-start"
                onClick={() => handleWalletSelect(w.adapter.name)}
                disabled={isConnecting}
              >
                <div className="flex items-center gap-2">
                  {w.adapter.icon && (
                    <img src={w.adapter.icon} alt={w.adapter.name} className="w-6 h-6" />
                  )}
                  <span>{w.adapter.name}</span>
                  {w.readyState === WalletReadyState.Loadable && (
                    <span className="ml-auto text-xs text-muted-foreground">(Install)</span>
                  )}
                </div>
              </Button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

