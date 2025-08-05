'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { useToast } from '@/components/ui/use-toast';
import { CheckCircle, AlertCircle, Loader2, Gift } from 'lucide-react';
import { ClaimableRewardsSummary } from '@/lib/stores/walletStore';

interface ClaimAllRewardsModalProps {
  isOpen: boolean;
  onClose: () => void;
  summary: ClaimableRewardsSummary;
}

interface ClaimResult {
  protocol: string;
  success: boolean;
  hash?: string;
  error?: string;
}

export function ClaimAllRewardsModal({ isOpen, onClose, summary }: ClaimAllRewardsModalProps) {
  const { signAndSubmitTransaction, account } = useWallet();
  const { toast } = useToast();
  const [isClaiming, setIsClaiming] = useState(false);
  const [currentProtocol, setCurrentProtocol] = useState<string>('');
  const [results, setResults] = useState<ClaimResult[]>([]);
  const [currentHash, setCurrentHash] = useState<string>('');

  // Get protocols with rewards
  const protocolsWithRewards = Object.entries(summary.protocols)
    .filter(([_, data]) => data.count > 0)
    .map(([protocol, data]) => ({ protocol, ...data }));

  const totalProtocols = protocolsWithRewards.length;
  const progress = totalProtocols > 0 ? ((results.length + 1) / totalProtocols) * 100 : 0;

  const handleClaimAll = async () => {
    if (!account?.address || totalProtocols === 0) return;

    setIsClaiming(true);
    setResults([]);
    setCurrentProtocol('');

    try {
      for (const { protocol } of protocolsWithRewards) {
        setCurrentProtocol(protocol);
        
        try {
          // Create claim transaction for each protocol
          const response = await fetch(`/api/protocols/${protocol}/claim`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userAddress: account.address,
              // Add protocol-specific parameters as needed
            }),
          });

          if (!response.ok) {
            throw new Error(`Failed to create claim transaction for ${protocol}`);
          }

          const data = await response.json();
          
          if (data.success && data.data?.transactionPayload) {
            // Sign and submit transaction
            const result = await signAndSubmitTransaction(data.data.transactionPayload);
            
            setCurrentHash(result.hash);
            
            // Wait for transaction to be confirmed
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            setResults(prev => [...prev, {
              protocol,
              success: true,
              hash: result.hash
            }]);
            
            toast({
              title: `${protocol} rewards claimed!`,
              description: `Transaction: ${result.hash.slice(0, 8)}...${result.hash.slice(-8)}`,
            });
          } else {
            throw new Error(data.error || 'Unknown error');
          }
        } catch (error) {
          console.error(`Error claiming ${protocol} rewards:`, error);
          
          setResults(prev => [...prev, {
            protocol,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          }]);
          
          toast({
            title: `Failed to claim ${protocol} rewards`,
            description: error instanceof Error ? error.message : 'Unknown error',
            variant: 'destructive',
          });
        }
      }
    } catch (error) {
      console.error('Error in claim all process:', error);
      toast({
        title: 'Claim process failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsClaiming(false);
      setCurrentProtocol('');
      setCurrentHash('');
    }
  };

  const handleClose = () => {
    if (!isClaiming) {
      onClose();
      setResults([]);
    }
  };

  const getCurrentProtocolInfo = () => {
    if (!currentProtocol) return null;
    const protocolData = summary.protocols[currentProtocol as keyof typeof summary.protocols];
    return {
      name: currentProtocol,
      value: protocolData.value,
      count: protocolData.count
    };
  };

  const successfulClaims = results.filter(r => r.success).length;
  const failedClaims = results.filter(r => !r.success).length;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-green-600" />
            Claim All Rewards
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Summary */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium mb-2">Available Rewards</h4>
            <div className="space-y-2">
              {protocolsWithRewards.map(({ protocol, value, count }) => (
                <div key={protocol} className="flex justify-between text-sm">
                  <span className="capitalize">{protocol}</span>
                  <span>${value.toFixed(2)} ({count} rewards)</span>
                </div>
              ))}
            </div>
            <div className="border-t pt-2 mt-2">
              <div className="flex justify-between font-medium">
                <span>Total</span>
                <span>${summary.totalValue.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Progress */}
          {isClaiming && (
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span>Claiming rewards...</span>
                <span>{results.length + 1}/{totalProtocols}</span>
              </div>
              <Progress value={progress} className="w-full" />
              
              {currentProtocol && (
                <div className="text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Claiming {currentProtocol} rewards...
                  </div>
                  {currentHash && (
                    <div className="text-xs mt-1">
                      Hash: {currentHash.slice(0, 8)}...{currentHash.slice(-8)}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Results */}
          {results.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium">Results</h4>
              <div className="space-y-1">
                {results.map((result, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    {result.success ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-600" />
                    )}
                    <span className="capitalize">{result.protocol}</span>
                    {result.success ? (
                      <span className="text-green-600">Success</span>
                    ) : (
                      <span className="text-red-600">{result.error}</span>
                    )}
                  </div>
                ))}
              </div>
              
              {!isClaiming && (
                <div className="text-sm text-muted-foreground">
                  {successfulClaims} successful, {failedClaims} failed
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-4">
            {!isClaiming && results.length === 0 && (
              <Button 
                onClick={handleClaimAll}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                Claim All Rewards
              </Button>
            )}
            
            {!isClaiming && (
              <Button 
                onClick={handleClose}
                variant="outline"
                className="flex-1"
              >
                {results.length > 0 ? 'Close' : 'Cancel'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 