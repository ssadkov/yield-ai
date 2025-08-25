"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { WalletConnect } from "@/components/WalletConnect";

interface AavePool {
  asset: string;
  provider: string;
  totalAPY: number;
  depositApy: number;
  borrowAPY: number;
  token: string;
  protocol: string;
  poolType: string;
  liquidityRate: number;
  variableBorrowRate: number;
  decimals: number;
}

export default function TestAavePage() {
  const { account, signAndSubmitTransaction } = useWallet();
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [poolsLoading, setPoolsLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [pools, setPools] = useState<AavePool[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [poolsError, setPoolsError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"positions" | "pools">("pools");
  
  // Новые состояния для депозита
  const [depositAmounts, setDepositAmounts] = useState<Record<string, string>>({});
  const [depositStatus, setDepositStatus] = useState<Record<string, 'idle' | 'pending' | 'success' | 'error'>>({});
  const [depositLoading, setDepositLoading] = useState<Record<string, boolean>>({});

  const testAddress = address || account?.address?.toString() || "";

  // Load pools on component mount
  useEffect(() => {
    fetchPools();
  }, []);

  const fetchPools = async () => {
    try {
      setPoolsLoading(true);
      setPoolsError(null);

      const response = await fetch('/api/protocols/aave/pools');
      const result = await response.json();

      if (result.success) {
        setPools(result.data || []);
      } else {
        setPoolsError(result.error || "Failed to fetch pools");
      }
    } catch (err) {
      console.error("Error fetching Aave pools:", err);
      setPoolsError("Failed to fetch pools");
    } finally {
      setPoolsLoading(false);
    }
  };

  // Функция для обработки депозита
  const handleDeposit = async (asset: string, amount: string, decimals: number) => {
    if (!account?.address || !amount || parseFloat(amount) <= 0) {
      return;
    }

    const poolKey = asset;
    
    try {
      // Обновляем статус
      setDepositStatus(prev => ({ ...prev, [poolKey]: 'pending' }));
      setDepositLoading(prev => ({ ...prev, [poolKey]: true }));

      // Конвертируем amount в octas
      const amountOctas = BigInt(parseFloat(amount) * Math.pow(10, decimals));
      
      // Создаем payload
      const payload = {
        function: "0x39ddcd9e1a39fa14f25e3f9ec8a86074d05cc0881cbf667df8a6ee70942016fb::supply_logic::supply" as `${string}::${string}::${string}`,
        typeArguments: [] as string[],
        functionArguments: [
          asset,                    // адрес токена
          amountOctas.toString(),   // количество в octas
          account.address,          // адрес пользователя
          0                        // referral code
        ] as any[]
      };

      console.log('Deposit payload:', payload);

      // Отправляем транзакцию
      const result = await signAndSubmitTransaction({
        data: payload,
        options: {
          maxGasAmount: 20000,
        },
      });
      
      console.log('Transaction result:', result);
      
      // Обновляем статус на успех
      setDepositStatus(prev => ({ ...prev, [poolKey]: 'success' }));
      
      // Очищаем поле ввода
      setDepositAmounts(prev => ({ ...prev, [poolKey]: '' }));
      
    } catch (error) {
      console.error('Deposit error:', error);
      
      // Обновляем статус на ошибку
      setDepositStatus(prev => ({ ...prev, [poolKey]: 'error' }));
      
    } finally {
      // Убираем загрузку
      setDepositLoading(prev => ({ ...prev, [poolKey]: false }));
      
      // Сбрасываем статус через 5 секунд
      setTimeout(() => {
        setDepositStatus(prev => ({ ...prev, [poolKey]: 'idle' }));
      }, 5000);
    }
  };

  const checkPositions = async () => {
    if (!testAddress) {
      setError("Please provide an address or connect wallet");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setData(null);

      const response = await fetch(`/api/protocols/aave/positions?address=${testAddress}`);
      const result = await response.json();

      if (result.success) {
        setData(result);
      } else {
        setError(result.error || "Failed to fetch data");
      }
    } catch (err) {
      console.error("Error checking Aave positions:", err);
      setError("Failed to check positions");
    } finally {
      setLoading(false);
    }
  };

  // Filter pools based on search query
  const filteredPools = pools.filter(pool => 
    pool.asset.toLowerCase().includes(searchQuery.toLowerCase()) ||
    pool.token.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatPercentage = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  const formatAPR = (value: number) => {
    return `${(value * 100).toFixed(4)}%`;
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Test Aave Protocol Integration</h1>
        <p className="text-muted-foreground">
          Test the Aave protocol integration - view pools and check user positions
        </p>
      </div>

      <div className="grid gap-6">
        {/* Wallet Connection */}
        <Card>
          <CardHeader>
            <CardTitle>Wallet Connection</CardTitle>
          </CardHeader>
          <CardContent>
            <WalletConnect />
          </CardContent>
        </Card>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "positions" | "pools")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="pools">Aave Pools</TabsTrigger>
            <TabsTrigger value="positions">User Positions</TabsTrigger>
          </TabsList>

          {/* Pools Tab */}
          <TabsContent value="pools" className="space-y-6">
            {/* Search and Refresh */}
            <Card>
              <CardHeader>
                <CardTitle>Aave Lending Pools</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="relative flex-1 max-w-md">
                    <Input
                      placeholder="Search pools by asset or token address..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <Button 
                    onClick={fetchPools} 
                    disabled={poolsLoading}
                    variant="outline"
                  >
                    {poolsLoading ? "Refreshing..." : "Refresh Pools"}
                  </Button>
                </div>
                
                <div className="text-sm text-muted-foreground">
                  Found {filteredPools.length} pools • Data refreshes every 5 minutes
                </div>
              </CardContent>
            </Card>

            {/* Pools Display */}
            {poolsLoading ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <div className="text-lg">Loading Aave pools...</div>
                </CardContent>
              </Card>
            ) : poolsError ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-destructive">Error Loading Pools</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-destructive">{poolsError}</div>
                </CardContent>
              </Card>
            ) : filteredPools.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  No pools found matching the search criteria
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {filteredPools.map((pool, index) => (
                  <Card key={index} className="hover:shadow-md transition-shadow">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-xl">{pool.asset}</CardTitle>
                          <div className="text-sm text-muted-foreground mt-1">
                            {pool.poolType} • {pool.token.slice(0, 8)}...{pool.token.slice(-8)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-green-600">
                            {formatPercentage(pool.totalAPY)}
                          </div>
                          <div className="text-sm text-muted-foreground">Supply APY</div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <div className="text-muted-foreground">Supply APR</div>
                          <div className="font-medium text-green-600">
                            {formatAPR(pool.liquidityRate)}
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Borrow APR</div>
                          <div className="font-medium text-red-600">
                            {formatAPR(pool.variableBorrowRate)}
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Borrow APY</div>
                          <div className="font-medium text-red-600">
                            {formatPercentage(pool.borrowAPY)}
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Decimals</div>
                          <div className="font-medium">{pool.decimals}</div>
                        </div>
                      </div>
                      
                      {/* Новые поля для депозита */}
                      <div className="mt-4 pt-4 border-t">
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            placeholder="Amount"
                            value={depositAmounts[pool.token] || ''}
                            onChange={(e) => setDepositAmounts(prev => ({
                              ...prev,
                              [pool.token]: e.target.value
                            }))}
                            className="w-24"
                            disabled={!account?.address}
                          />
                          <Button
                            onClick={() => handleDeposit(pool.token, depositAmounts[pool.token] || '', pool.decimals)}
                            disabled={!depositAmounts[pool.token] || depositLoading[pool.token] || !account?.address}
                            size="sm"
                          >
                            {depositLoading[pool.token] ? 'Depositing...' : 'Deposit'}
                          </Button>
                          {depositStatus[pool.token] && depositStatus[pool.token] !== 'idle' && (
                            <Badge variant={
                              depositStatus[pool.token] === 'success' ? 'default' :
                              depositStatus[pool.token] === 'error' ? 'destructive' :
                              depositStatus[pool.token] === 'pending' ? 'secondary' : 'outline'
                            }>
                              {depositStatus[pool.token]}
                            </Badge>
                          )}
                        </div>
                        {!account?.address && (
                          <div className="text-xs text-muted-foreground mt-1">
                            Connect wallet to deposit
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Positions Tab */}
          <TabsContent value="positions" className="space-y-6">
            {/* Address Input */}
            <Card>
              <CardHeader>
                <CardTitle>Check User Positions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid w-full max-w-sm items-center gap-1.5">
                  <Label htmlFor="address">Wallet Address</Label>
                  <Input
                    id="address"
                    placeholder="Enter Aptos address or use connected wallet"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    onClick={checkPositions} 
                    disabled={loading || !testAddress}
                  >
                    {loading ? "Checking..." : "Check Aave Positions"}
                  </Button>
                  {account?.address && (
                    <Badge variant="outline">
                      Using connected wallet: {account.address.toString().slice(0, 8)}...
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Results */}
            {data && (
              <Card>
                <CardHeader>
                  <CardTitle>Position Results</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label className="text-sm font-medium">Net Value</Label>
                        <div className="text-2xl font-bold">
                          ${data.totalValue?.toFixed(2) || "0.00"}
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Total Deposits</Label>
                        <div className="text-lg font-semibold text-green-600">
                          ${data.totalDepositValue?.toFixed(2) || "0.00"}
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Total Borrows</Label>
                        <div className="text-lg font-semibold text-red-600">
                          ${data.totalBorrowValue?.toFixed(2) || "0.00"}
                        </div>
                      </div>
                    </div>

                    <div>
                      <Label className="text-sm font-medium">Positions Count</Label>
                      <div className="text-lg font-semibold">
                        {data.data?.length || 0} positions
                      </div>
                    </div>

                    {data.data && data.data.length > 0 && (
                      <div>
                        <Label className="text-sm font-medium">Position Details</Label>
                        <div className="mt-2 space-y-2">
                          {data.data.map((position: any, index: number) => (
                            <div key={index} className="p-3 border rounded-lg bg-muted/50">
                              <div className="flex items-center justify-between mb-2">
                                <div className="font-medium">
                                  {position.symbol} ({position.name})
                                </div>
                                <Badge variant={position.usage_as_collateral_enabled ? "default" : "secondary"}>
                                  {position.usage_as_collateral_enabled ? "Collateral" : "No Collateral"}
                                </Badge>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <div className="text-muted-foreground">Deposit</div>
                                  <div className="font-medium text-green-600">
                                    {position.deposit_amount?.toFixed(6)} {position.symbol}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    ${position.deposit_value_usd?.toFixed(2)}
                                  </div>
                                </div>
                                
                                <div>
                                  <div className="text-muted-foreground">Borrow</div>
                                  <div className="font-medium text-red-600">
                                    {position.borrow_amount?.toFixed(6)} {position.symbol}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    ${position.borrow_value_usd?.toFixed(2)}
                                  </div>
                                </div>
                              </div>
                              
                              <div className="text-xs text-muted-foreground mt-2">
                                Asset: {position.underlying_asset?.slice(0, 8)}...
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <Label className="text-sm font-medium">Raw Response</Label>
                      <pre className="mt-2 p-3 bg-muted rounded-lg text-xs overflow-auto">
                        {JSON.stringify(data, null, 2)}
                      </pre>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Error Display */}
            {error && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-destructive">Error</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-destructive">{error}</div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* API Info */}
        <Card>
          <CardHeader>
            <CardTitle>API Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>
              <strong>Pools Endpoint:</strong> <code>/api/protocols/aave/pools</code>
            </div>
            <div>
              <strong>Positions Endpoint:</strong> <code>/api/protocols/aave/positions</code>
            </div>
            <div>
              <strong>Method:</strong> GET
            </div>
            <div>
              <strong>Status:</strong> <Badge variant="default">Live Implementation</Badge>
            </div>
            <div className="mt-4 p-3 bg-muted rounded-lg">
              <strong>Note:</strong> This implementation now shows both Aave lending pools with real-time APR/APY calculations 
              and user positions. Pools data refreshes every 5 minutes, positions are fetched on-demand.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
