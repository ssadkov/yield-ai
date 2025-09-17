'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Gift } from 'lucide-react';
import { ClaimableRewardsSummary } from '@/lib/stores/walletStore';

interface ClaimRewardsBlockProps {
  summary: ClaimableRewardsSummary | null;
  onClaim: () => void;
  loading?: boolean;
}

export function ClaimRewardsBlock({ summary, onClaim, loading = false }: ClaimRewardsBlockProps) {
  // Don't render if loading or invalid summary or no rewards
  if (loading || !summary || !summary.protocols || summary.totalValue <= 0) {
    return null;
  }

  const protocolCount = Object.values(summary.protocols)
    .filter(p => p.count > 0).length;

  return (
    <Card className="mb-6 bg-success-muted border-success/20 hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-success/10 rounded-full">
              <Gift className="h-5 w-5 text-success" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-success">
                Claim Rewards
              </h3>
              <p className="text-sm text-success/80">
                ${summary.totalValue.toFixed(2)} available for direct claim in {protocolCount} protocol{protocolCount !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <Button 
            onClick={onClaim}
            disabled={loading}
            className="bg-success text-success-foreground hover:bg-success/90"
          >
            {loading ? 'Loading...' : 'Claim All'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
} 