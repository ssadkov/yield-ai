'use client';

import { useEffect, useState } from 'react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { formatCurrency, formatNumber } from '@/lib/utils/numberFormat';
import { ExternalLink } from 'lucide-react';

interface EchoPosition {
  positionId: string;
  aTokenAddress: string;
  aTokenSymbol: string;
  underlyingAddress: string;
  symbol: string;
  name: string;
  decimals: number;
  logoUrl: string | null;
  amountRaw: string;
  amount: number;
  priceUSD: number;
  valueUSD: number;
}

function EchoPositionCard({ position }: { position: EchoPosition }) {
  return (
    <div className="rounded-lg border bg-card p-4 text-card-foreground shadow-sm">
      <div className="flex flex-wrap justify-between items-center gap-2">
        <div className="flex items-center gap-2">
          {position.logoUrl ? (
            <img src={position.logoUrl} alt={position.symbol} className="w-8 h-8 rounded-full object-contain" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
              {position.symbol.slice(0, 2)}
            </div>
          )}
          <div>
            <div className="font-medium">{position.symbol}</div>
            <div className="text-sm text-muted-foreground">{position.name}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="font-semibold">{formatCurrency(position.valueUSD, 2)}</div>
          <div className="text-sm text-muted-foreground">{formatNumber(position.amount, 6)} {position.symbol}</div>
        </div>
      </div>
      <div className="mt-3 flex justify-end">
        <a
          href="https://vault.echo-protocol.xyz/lending"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          View on Echo
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
}

export function EchoPositions() {
  const { account } = useWallet();
  const [positions, setPositions] = useState<EchoPosition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPositions = async () => {
    if (!account?.address) {
      setPositions([]);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/protocols/echo/userPositions?address=${account.address}`);
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      if (data.success && Array.isArray(data.data)) {
        const sorted = [...data.data].sort((a, b) => (b.valueUSD || 0) - (a.valueUSD || 0));
        setPositions(sorted);
      } else {
        setPositions([]);
      }
    } catch (err) {
      console.error('Error loading Echo positions:', err);
      setError('Failed to load positions');
      setPositions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPositions();
    const handleRefresh: EventListener = (evt) => {
      const event = evt as CustomEvent<{ protocol: string; data?: EchoPosition[] }>;
      if (event?.detail?.protocol === 'echo') {
        if (event.detail.data && Array.isArray(event.detail.data)) {
          setPositions(event.detail.data);
        } else {
          void loadPositions();
        }
      }
    };
    window.addEventListener('refreshPositions', handleRefresh);
    return () => window.removeEventListener('refreshPositions', handleRefresh);
  }, [account?.address]);

  if (loading) {
    return <div className="py-4 text-muted-foreground">Loading positions...</div>;
  }
  if (error) {
    return <div className="py-4 text-red-500">{error}</div>;
  }
  if (positions.length === 0) {
    return (
      <div className="py-4 text-muted-foreground">
        No positions on Echo Protocol. Manage deposits at{' '}
        <a href="https://vault.echo-protocol.xyz/lending" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
          vault.echo-protocol.xyz
        </a>
      </div>
    );
  }

  const totalValue = positions.reduce((sum, p) => sum + (p.valueUSD || 0), 0);

  return (
    <div className="w-full mb-6 py-2">
      <div className="space-y-4 text-base">
        {positions.map((position) => (
          <EchoPositionCard key={position.positionId} position={position} />
        ))}
        <div className="pt-6 pb-6">
          <div className="flex items-center justify-between">
            <span className="text-xl">Total assets in Echo Protocol:</span>
            <span className="text-xl text-primary font-bold">{formatCurrency(totalValue)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
