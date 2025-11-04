'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Transaction, TransactionsResponse, ActivityType } from '@/lib/transactions/types';
import { getProtocolsList, Protocol } from '@/lib/protocols/getProtocolsList';
import { getProtocolFromPlatform } from '@/lib/transactions/protocolResolver';
import { formatCurrency } from '@/lib/utils/numberFormat';
import { Loader2, ExternalLink } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { fetchTransactionsClient } from '@/lib/transactions/clientFetch';
import { ProtocolKey } from '@/lib/transactions/types';

const DEFAULT_ADDRESS = '0x4ade47d86d1013af5a0e38bbbd5d745a72cf4b9fa9759f4a5f7434b15bb1fbd1';

const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  'ACTIVITY_COIN_SWAP': 'Swap',
  'ACTIVITY_DEPOSIT_MARKET': 'Deposit',
  'ACTIVITY_WITHDRAW_MARKET': 'Withdraw',
  'ACTIVITY_COIN_ADD_LIQUID': 'Add Liquidity',
  'ACTIVITY_COIN_REMOVE_LIQUID': 'Remove Liquidity',
};

const ACTIVITY_TYPE_COLORS: Record<ActivityType, string> = {
  'ACTIVITY_COIN_SWAP': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  'ACTIVITY_DEPOSIT_MARKET': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  'ACTIVITY_WITHDRAW_MARKET': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  'ACTIVITY_COIN_ADD_LIQUID': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  'ACTIVITY_COIN_REMOVE_LIQUID': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
};

export default function TestTransactionsPage() {
  const [address, setAddress] = useState(DEFAULT_ADDRESS);
  const [selectedProtocol, setSelectedProtocol] = useState<string>('all');
  const [selectedActivityType, setSelectedActivityType] = useState<string>('all');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [metadata, setMetadata] = useState<TransactionsResponse['metadata'] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const protocols = getProtocolsList();

  // Filter transactions client-side
  const filteredTransactions = useMemo(() => {
    let filtered = [...transactions];

    // Filter by protocol
    if (selectedProtocol !== 'all') {
      filtered = filtered.filter(tx => {
        const protocol = getProtocolFromPlatform(tx.platform);
        return protocol?.key === selectedProtocol;
      });
    }

    // Filter by activity type
    if (selectedActivityType !== 'all') {
      filtered = filtered.filter(tx => tx.activity_type === selectedActivityType);
    }

    return filtered;
  }, [transactions, selectedProtocol, selectedActivityType]);

  const fetchTransactions = async () => {
    if (!address.trim()) {
      setError('Address is required');
      return;
    }

    setLoading(true);
    setError(null);
    setTransactions([]);
    setMetadata(null);

    try {
      // Use client-side fetch to bypass Cloudflare blocking on Vercel
      // This makes requests directly from the browser (user's IP) instead of Vercel server IPs
      const protocol = selectedProtocol !== 'all' ? (selectedProtocol as ProtocolKey) : null;
      const activityType = selectedActivityType !== 'all' ? (selectedActivityType as ActivityType) : null;
      
      let data: TransactionsResponse;
      
      try {
        // Try client-side fetch first (bypasses Cloudflare on Vercel)
        data = await fetchTransactionsClient(
          address.trim(),
          getProtocolsList,
          protocol,
          activityType
        );
      } catch (clientError) {
        // If client-side fails (e.g., CORS), fallback to server-side API
        console.warn('Client-side fetch failed, falling back to server API:', clientError);
        
        const params = new URLSearchParams({
          address: address.trim(),
        });

        if (selectedProtocol !== 'all') {
          params.set('protocol', selectedProtocol);
        }

        if (selectedActivityType !== 'all') {
          params.set('activityType', selectedActivityType);
        }

        const response = await fetch(`/api/transactions?${params.toString()}`);
        const serverData = await response.json();
        
        if (!response.ok) {
          const errorMessage = serverData.message || serverData.error || `HTTP ${response.status}`;
          throw new Error(errorMessage);
        }
        
        data = serverData;
      }
      
      if (data.success) {
        setTransactions(data.data || []);
        setMetadata(data.metadata || null);
      } else {
        throw new Error('API returned unsuccessful response');
      }
    } catch (err) {
      console.error('Error fetching transactions:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch transactions');
    } finally {
      setLoading(false);
    }
  };

  // Format block_time (microseconds) to readable date
  const formatDate = (blockTime: number): string => {
    // Convert microseconds to milliseconds
    const date = new Date(blockTime / 1000);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Get token info from metadata
  const getTokenInfo = (tokenAddress: string): { symbol: string; name: string; logo?: string; decimals?: number } | null => {
    if (!metadata) return null;

    // Try coins first
    if (metadata.coins[tokenAddress]) {
      const coin = metadata.coins[tokenAddress].data;
      return {
        symbol: coin.symbol,
        name: coin.name,
        logo: coin.logo_url,
        decimals: coin.decimals,
      };
    }

    // Try fungible_assets
    if (metadata.fungible_assets[tokenAddress]) {
      const asset = metadata.fungible_assets[tokenAddress].data;
      return {
        symbol: asset.symbol,
        name: asset.name,
        logo: asset.logo_url,
        decimals: asset.decimals,
      };
    }

    // Try to find by coin_id pattern
    for (const asset of Object.values(metadata.fungible_assets)) {
      if (asset.data.coin_id === tokenAddress || asset.data.address === tokenAddress) {
        return {
          symbol: asset.data.symbol,
          name: asset.data.name,
          logo: asset.data.logo_url,
          decimals: asset.data.decimals,
        };
      }
    }

    return null;
  };

  // Format amount with decimals
  const formatAmount = (amount: number | undefined, decimals: number = 8): string => {
    if (amount === undefined) return '0';
    return (amount / Math.pow(10, decimals)).toFixed(2);
  };

  // Get protocol from transaction
  const getTransactionProtocol = (tx: Transaction): Protocol | null => {
    return getProtocolFromPlatform(tx.platform);
  };

  // Format token display for transaction
  const formatTokenDisplay = (tx: Transaction): string => {
    const { amount_info } = tx;
    if (!amount_info) return 'N/A';

    const token1Info = amount_info.token1 ? getTokenInfo(amount_info.token1) : null;
    const token2Info = amount_info.token2 ? getTokenInfo(amount_info.token2) : null;

    if (tx.activity_type === 'ACTIVITY_COIN_SWAP' && token1Info && token2Info) {
      return `${token1Info.symbol} → ${token2Info.symbol}`;
    } else if (tx.activity_type === 'ACTIVITY_COIN_ADD_LIQUID' && token1Info && token2Info) {
      return `${token1Info.symbol} + ${token2Info.symbol}`;
    } else if (token1Info) {
      return token1Info.symbol;
    }

    return 'Unknown';
  };

  // Format amount display for transaction
  const formatAmountDisplay = (tx: Transaction): string => {
    const { amount_info } = tx;
    if (!amount_info) return 'N/A';

    const token1Info = amount_info.token1 ? getTokenInfo(amount_info.token1) : null;
    const token2Info = amount_info.token2 ? getTokenInfo(amount_info.token2) : null;

    if (tx.activity_type === 'ACTIVITY_COIN_SWAP' && token1Info && token2Info) {
      const amount1 = formatAmount(amount_info.amount1, token1Info.decimals || 8);
      const amount2 = formatAmount(amount_info.amount2, token2Info.decimals || 8);
      return `${amount1} ${token1Info.symbol} → ${amount2} ${token2Info.symbol}`;
    } else if (tx.activity_type === 'ACTIVITY_COIN_ADD_LIQUID' && token1Info && token2Info) {
      const amount1 = formatAmount(amount_info.amount1, token1Info.decimals || 8);
      const amount2 = formatAmount(amount_info.amount2, token2Info.decimals || 8);
      return `${amount1} ${token1Info.symbol} + ${amount2} ${token2Info.symbol}`;
    } else if (token1Info && amount_info.amount1) {
      const amount = formatAmount(amount_info.amount1, token1Info.decimals || 8);
      return `${amount} ${token1Info.symbol}`;
    }

    return 'N/A';
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Transaction Analytics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="address">Wallet Address</Label>
              <Input
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="0x..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="protocol">Protocol</Label>
              <Select value={selectedProtocol} onValueChange={setSelectedProtocol}>
                <SelectTrigger id="protocol">
                  <SelectValue placeholder="All Protocols" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Protocols</SelectItem>
                  {protocols.map((protocol) => (
                    <SelectItem key={protocol.key} value={protocol.key}>
                      {protocol.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="activityType">Activity Type</Label>
              <Select value={selectedActivityType} onValueChange={setSelectedActivityType}>
                <SelectTrigger id="activityType">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {Object.entries(ACTIVITY_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button 
                onClick={fetchTransactions} 
                disabled={loading}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  'Load Transactions'
                )}
              </Button>
            </div>
          </div>

          {error && (
            <div className="p-4 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="font-semibold mb-1">Error</div>
              <div className="font-mono text-xs break-all">{error}</div>
            </div>
          )}
        </CardContent>
      </Card>

      {loading && transactions.length === 0 && (
        <Card>
          <CardContent className="p-6">
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && filteredTransactions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              Transactions ({filteredTransactions.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Protocol</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Tokens</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Tx Hash</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.map((tx) => {
                    const protocol = getTransactionProtocol(tx);
                    const amountDisplay = formatAmountDisplay(tx);

                    return (
                      <TableRow key={`${tx.trans_id}-${tx.tx_version}`}>
                        <TableCell className="font-mono text-sm">
                          {formatDate(tx.block_time)}
                        </TableCell>
                        <TableCell>
                          {protocol ? (
                            <div className="flex items-center gap-2">
                              <Avatar className="h-6 w-6">
                                <AvatarImage src={protocol.logoUrl} alt={protocol.name} />
                                <AvatarFallback>{protocol.name[0]}</AvatarFallback>
                              </Avatar>
                              <span>{protocol.name}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">Unknown</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={ACTIVITY_TYPE_COLORS[tx.activity_type]}>
                            {ACTIVITY_TYPE_LABELS[tx.activity_type]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const token1Info = tx.amount_info?.token1 ? getTokenInfo(tx.amount_info.token1) : null;
                            const token2Info = tx.amount_info?.token2 ? getTokenInfo(tx.amount_info.token2) : null;

                            if (tx.activity_type === 'ACTIVITY_COIN_SWAP' && token1Info && token2Info) {
                              return (
                                <div className="flex items-center gap-1">
                                  {token1Info.logo && (
                                    <Image src={token1Info.logo} alt={token1Info.symbol} width={16} height={16} className="rounded-full" />
                                  )}
                                  <span className="text-sm">{token1Info.symbol}</span>
                                  <span className="text-muted-foreground">→</span>
                                  {token2Info.logo && (
                                    <Image src={token2Info.logo} alt={token2Info.symbol} width={16} height={16} className="rounded-full" />
                                  )}
                                  <span className="text-sm">{token2Info.symbol}</span>
                                </div>
                              );
                            } else if (tx.activity_type === 'ACTIVITY_COIN_ADD_LIQUID' && token1Info && token2Info) {
                              return (
                                <div className="flex items-center gap-1">
                                  {token1Info.logo && (
                                    <Image src={token1Info.logo} alt={token1Info.symbol} width={16} height={16} className="rounded-full" />
                                  )}
                                  <span className="text-sm">{token1Info.symbol}</span>
                                  <span className="text-muted-foreground">+</span>
                                  {token2Info.logo && (
                                    <Image src={token2Info.logo} alt={token2Info.symbol} width={16} height={16} className="rounded-full" />
                                  )}
                                  <span className="text-sm">{token2Info.symbol}</span>
                                </div>
                              );
                            } else if (token1Info) {
                              return (
                                <div className="flex items-center gap-1">
                                  {token1Info.logo && (
                                    <Image src={token1Info.logo} alt={token1Info.symbol} width={16} height={16} className="rounded-full" />
                                  )}
                                  <span className="text-sm">{token1Info.symbol}</span>
                                </div>
                              );
                            }
                            return <span className="text-muted-foreground text-sm">N/A</span>;
                          })()}
                        </TableCell>
                        <TableCell className="font-mono text-sm">{amountDisplay}</TableCell>
                        <TableCell>
                          {tx.value !== undefined ? formatCurrency(tx.value) : 'N/A'}
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`https://explorer.aptoslabs.com/txn/${tx.trans_id}?network=mainnet`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-blue-600 hover:text-blue-800"
                          >
                            <span className="font-mono text-xs">
                              {tx.trans_id.slice(0, 8)}...{tx.trans_id.slice(-6)}
                            </span>
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && !error && transactions.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            No transactions found. Click "Load Transactions" to fetch data.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
