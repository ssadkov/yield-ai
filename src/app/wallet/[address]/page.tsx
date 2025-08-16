'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Wallet, DollarSign, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface TokenBalance {
  address?: string;
  symbol: string | null;
  name: string | null;
  balance: string;
  decimals: number;
  priceUSD: number;
  valueUSD: number;
}

interface WalletData {
  address: string;
  timestamp: string;
  totalValueUSD: number | null;
  tokens: TokenBalance[];
}

export default function WalletViewPage() {
  const params = useParams();
  const router = useRouter();
  
  if (!params?.address) {
    return <div>Address not found</div>;
  }
  
  const address = params.address as string;
  
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const validateAptosAddress = (addr: string): boolean => {
    // Remove 0x prefix if present
    const cleanAddr = addr.startsWith('0x') ? addr.slice(2) : addr;
    const aptosAddressRegex = /^[0-9a-fA-F]{64}$/;
    return aptosAddressRegex.test(cleanAddr);
  };

  const fetchWalletData = async () => {
    try {
      const response = await fetch(`/api/wallet/${address}/balance`);
      if (!response.ok) {
        throw new Error('Failed to fetch wallet data');
      }
      const data: WalletData = await response.json();

      // Client-side sort and total calculation (authoritative on UI)
      const sortedTokens = (data?.tokens || []).slice().sort(
        (a, b) => (b.valueUSD || 0) - (a.valueUSD || 0)
      );
      const computedTotal = sortedTokens.reduce(
        (sum, t) => sum + (typeof t.valueUSD === 'number' ? t.valueUSD : 0),
        0
      );

      setWalletData({
        ...data,
        tokens: sortedTokens,
        totalValueUSD: computedTotal,
      });
      setError('');
    } catch (err) {
      setError('Failed to load wallet data. Please check the address and try again.');
      setWalletData(null);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchWalletData();
    setIsRefreshing(false);
  };

  useEffect(() => {
    if (!validateAptosAddress(address)) {
      setError('Invalid Aptos wallet address format');
      setIsLoading(false);
      return;
    }

    fetchWalletData().finally(() => setIsLoading(false));
  }, [address]);

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const formatUSD = (value: number | null) => {
    if (value === null || value === undefined || Number.isNaN(value)) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto space-y-6">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <Button
              variant="ghost"
              onClick={() => router.push('/wallet')}
              className="mb-6"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Wallet Explorer
            </Button>
            
            <div className="p-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg dark:bg-red-900/20 dark:text-red-400 dark:border-red-800">
              {error}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => router.push('/wallet')}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Wallet Explorer
            </Button>
            
            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {/* Wallet Info */}
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
                  <Wallet className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <CardTitle className="text-xl">Wallet Balance</CardTitle>
                  <CardDescription className="font-mono">
                    {formatAddress(address)}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center space-x-3 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <DollarSign className="h-6 w-6 text-green-600 dark:text-green-400" />
                  <div>
                    <p className="text-sm text-green-600 dark:text-green-400">Total Value</p>
                    <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                      {formatUSD(walletData?.totalValueUSD ?? 0)}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <Badge variant="secondary" className="text-sm">
                    {walletData?.tokens.length || 0} Tokens
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Token List */}
          <Card>
            <CardHeader>
              <CardTitle>Token Balances</CardTitle>
              <CardDescription>
                All tokens in this wallet with their current values
              </CardDescription>
            </CardHeader>
            <CardContent>
              {walletData?.tokens && walletData.tokens.length > 0 ? (
                <div className="space-y-3">
                  {walletData.tokens.map((token, index) => (
                    <div
                      key={index}
                      title={token.address || ''}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
                          <span className="text-sm font-semibold">
                            {token.symbol ? token.symbol.slice(0, 2) : '??'}
                          </span>
                        </div>
                        <div>
                          <p className="font-semibold">{token.name || 'Unknown Token'}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {token.symbol || 'UNKNOWN'}
                          </p>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <p className="font-semibold">
                          {parseFloat(token.balance).toLocaleString(undefined, {
                            maximumFractionDigits: 4,
                          })}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {formatUSD(token.valueUSD)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  No tokens found in this wallet
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
} 