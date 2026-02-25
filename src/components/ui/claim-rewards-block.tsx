'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Gift, X } from 'lucide-react';
import { ClaimableRewardsSummary } from '@/lib/stores/walletStore';

interface ClaimRewardsBlockProps {
  summary: ClaimableRewardsSummary | null;
  onClaim: () => void;
  loading?: boolean;
}

type RewardsPanelState = 'expanded' | 'hidden';

const REWARDS_PANEL_STORAGE_KEY = 'claimRewardsPanelState';

export function ClaimRewardsBlock({
  summary,
  onClaim,
  loading = false,
}: ClaimRewardsBlockProps) {
  const [panelState, setPanelState] = useState<RewardsPanelState>('expanded');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = window.localStorage.getItem(REWARDS_PANEL_STORAGE_KEY);
      if (stored === 'expanded' || stored === 'hidden') {
        setPanelState(stored);
      }
    } catch {
      // ignore localStorage errors
    }
  }, []);

  const updatePanelState = (next: RewardsPanelState) => {
    setPanelState(next);
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(REWARDS_PANEL_STORAGE_KEY, next);
    } catch {
      // ignore localStorage errors
    }
  };

  // Don't render anything at all if no rewards / still loading
  if (loading || !summary || !summary.protocols || summary.totalValue <= 0) {
    return null;
  }

  if (panelState === 'hidden') {
    return (
      <div className="mb-4 flex justify-start">
        <Button
          variant="outline"
          size="sm"
          onClick={() => updatePanelState('expanded')}
          className="flex items-center gap-2 text-muted-foreground"
        >
          <Gift className="h-4 w-4" />
          <span>Rewards</span>
        </Button>
      </div>
    );
  }

  const protocolCount = Object.values(summary.protocols).filter((p) => p.count > 0).length;
  const isTinyAmount = summary.totalValue < 0.1;
  const formattedAmount = `$${summary.totalValue.toFixed(2)}`;

  return (
    <Card className="mb-6 border-success/20 hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-success/10 rounded-full">
              <Gift className="h-5 w-5 text-success" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-success">Claim Rewards</h3>
              <p className="text-sm text-success dark:text-success/80">
                {isTinyAmount ? (
                  <>
                    Less than $1 available for direct claim in {protocolCount} protocol
                    {protocolCount !== 1 ? 's' : ''}
                  </>
                ) : (
                  <>
                    {formattedAmount} available for direct claim in {protocolCount} protocol
                    {protocolCount !== 1 ? 's' : ''}
                  </>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              onClick={onClaim}
              disabled={loading}
              className="bg-success text-success-foreground hover:bg-success/90"
            >
              {loading ? 'Loading...' : 'Claim All'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => updatePanelState('hidden')}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              aria-label="Hide rewards panel"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
