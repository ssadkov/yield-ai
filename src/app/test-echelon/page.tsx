"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/components/ui/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { WalletConnectButton } from "@/components/WalletConnectButton";
import tokenList from "@/lib/data/tokenList.json";


interface EchelonReward {
  token: string;
  tokenType: string;
  amount: number;
  rawAmount: string;
  farmingId: string;
  stakeAmount: number;
}

interface TokenPrice {
  tokenAddress: string | null;
  faAddress: string;
  symbol: string;
  usdPrice: string;
}

export default function TestEchelonPage() {
  const { account, signAndSubmitTransaction } = useWallet();
  const [walletAddress, setWalletAddress] = useState(account?.address?.toString() || "");
  const [loading, setLoading] = useState(false);
  const [rewards, setRewards] = useState<EchelonReward[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>("");
  const [claimingRewards, setClaimingRewards] = useState<Set<string>>(new Set());
  const [vaultData, setVaultData] = useState<string>("");
  const [vaultLoading, setVaultLoading] = useState(false);
  const [parsedVaultData, setParsedVaultData] = useState<string>("");
  const [tokenPrices, setTokenPrices] = useState<Map<string, TokenPrice>>(new Map());
  const [pricesLoading, setPricesLoading] = useState(false);
  const [collateralMarketsData, setCollateralMarketsData] = useState<string>("");
  const [collateralMarketsLoading, setCollateralMarketsLoading] = useState(false);

  // Function to get token address by symbol
  const getTokenAddressBySymbol = (symbol: string): string | null => {
    const token = tokenList.data.data.find((t: any) => 
      t.symbol.toLowerCase() === symbol.toLowerCase() ||
      t.name.toLowerCase().includes(symbol.toLowerCase())
    );
    return token?.faAddress || token?.tokenAddress || null;
  };

  // Function to fetch token prices
  const fetchTokenPrices = async (tokens: string[]) => {
    if (tokens.length === 0) return;

    setPricesLoading(true);
    try {
      // Get unique token addresses
      const tokenAddresses = tokens
        .map(token => getTokenAddressBySymbol(token))
        .filter(Boolean) as string[];

      if (tokenAddresses.length === 0) {
        setPricesLoading(false);
        return;
      }

      const response = await fetch(`/api/panora/prices?chainId=1&addresses=${tokenAddresses.join(',')}`);
      const data = await response.json();

      if (data.data) {
        const pricesMap = new Map<string, TokenPrice>();
        data.data.forEach((price: TokenPrice) => {
          // Find the token symbol that matches this price
          const matchingToken = tokens.find(token => {
            const tokenAddress = getTokenAddressBySymbol(token);
            return tokenAddress === price.faAddress || tokenAddress === price.tokenAddress;
          });
          if (matchingToken) {
            pricesMap.set(matchingToken, price);
          }
        });
        setTokenPrices(pricesMap);
      }
    } catch (error) {
      console.error('Error fetching token prices:', error);
    } finally {
      setPricesLoading(false);
    }
  };

  // Calculate total USD value of rewards
  const calculateTotalUSDValue = (): number => {
    return rewards.reduce((total, reward) => {
      const price = tokenPrices.get(reward.token);
      if (price && price.usdPrice && !isNaN(parseFloat(price.usdPrice))) {
        return total + (reward.amount * parseFloat(price.usdPrice));
      }
      return total;
    }, 0);
  };

  const handleFetchRewards = async () => {
    if (!walletAddress) {
      setError("Please enter a wallet address");
      return;
    }

    setLoading(true);
    setError(null);
    setDebugInfo("");
    setRewards([]);

    try {
      const apiUrl = `/api/protocols/echelon/rewards?address=${encodeURIComponent(walletAddress)}`;
      setDebugInfo(`Making request to: ${apiUrl}`);
      
      const response = await fetch(apiUrl);
      setDebugInfo(prev => prev + `\nResponse status: ${response.status}`);
      
      const data = await response.json();
      setDebugInfo(prev => prev + `\nResponse data: ${JSON.stringify(data, null, 2)}`);
      
      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch rewards");
      }
      
      if (data.success) {
        const rewardsData = data.data || [];
        setRewards(rewardsData);
        
        // Fetch prices for the tokens in rewards
        const uniqueTokens = [...new Set(rewardsData.map((r: EchelonReward) => r.token))] as string[];
        await fetchTokenPrices(uniqueTokens);
      } else {
        throw new Error(data.error || "Failed to fetch rewards");
      }
    } catch (err) {
      console.error("Error fetching Echelon rewards:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
      setDebugInfo(prev => prev + `\nError: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFetchVaultData = async () => {
    if (!walletAddress) {
      setError("Please enter a wallet address");
      return;
    }

    setVaultLoading(true);
    setError(null);
    setVaultData("");

    try {
      const apiUrl = `https://fullnode.mainnet.aptoslabs.com/v1/accounts/${walletAddress}/resources`;
      setDebugInfo(`Fetching vault data from: ${apiUrl}`);
      
      const response = await fetch(apiUrl);
      setDebugInfo(prev => prev + `\nResponse status: ${response.status}`);
      
      const data = await response.json();
      setDebugInfo(prev => prev + `\nTotal resources found: ${data.length}`);
      
      // Find lending::Vault resource
      const vaultResource = data.find((resource: any) => 
        resource.type === "0xc6bc659f1649553c1a3fa05d9727433dc03843baac29473c817d06d39e7621ba::lending::Vault"
      );
      
      if (vaultResource) {
        setVaultData(JSON.stringify(vaultResource, null, 2));
        setDebugInfo(prev => prev + `\nVault resource found and displayed below`);
        
        // Parse and analyze vault data
        const parsedData = parseVaultData(vaultResource);
        setParsedVaultData(JSON.stringify(parsedData, null, 2));
        setDebugInfo(prev => prev + `\n\nParsed Vault Data:\n${JSON.stringify(parsedData, null, 2)}`);
      } else {
        setVaultData("No lending::Vault resource found for this address");
        setDebugInfo(prev => prev + `\nNo lending::Vault resource found`);
      }
    } catch (err) {
      console.error("Error fetching vault data:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
      setDebugInfo(prev => prev + `\nError: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setVaultLoading(false);
    }
  };

  const handleFetchCollateralMarkets = async () => {
    if (!walletAddress) {
      setError("Please enter a wallet address");
      return;
    }

    setCollateralMarketsLoading(true);
    setError(null);
    setCollateralMarketsData("");

    try {
      const apiUrl = `/api/protocols/echelon/account-collateral-markets?address=${encodeURIComponent(walletAddress)}`;
      setDebugInfo(`Fetching collateral markets data from: ${apiUrl}`);
      
      const response = await fetch(apiUrl);
      setDebugInfo(prev => prev + `\nResponse status: ${response.status}`);
      
      const data = await response.json();
      setDebugInfo(prev => prev + `\nResponse data: ${JSON.stringify(data, null, 2)}`);
      
      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch collateral markets data");
      }
      
      if (data.success) {
        setCollateralMarketsData(JSON.stringify(data.data, null, 2));
        setDebugInfo(prev => prev + `\nCollateral markets data fetched successfully`);
      } else {
        throw new Error(data.error || "Failed to fetch collateral markets data");
      }
    } catch (err) {
      console.error("Error fetching collateral markets data:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
      setDebugInfo(prev => prev + `\nError: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setCollateralMarketsLoading(false);
    }
  };

  const parseVaultData = (vaultResource: any) => {
    const result = {
      collaterals: [] as any[],
      liabilities: [] as any[],
      marketMapping: {} as Record<string, string>
    };

    // Load market data for mapping
    const marketData = [
      { market: "0x778362f04f7904ba0b76913ec7c0c5cc04e469b0b96929c6998b34910690a740", coin: "0xb30a694a344edee467d9f82330bbe7c3b89f440a1ecd2da1f3bca266560fce69" },
      { market: "0xac00e90cdadec06d81e0d5ce7a3e93d63d563e982dea0ca15bad2b067f42d2be", coin: "0x357b0b74bc833e95a115ad22604854d6b0fca151cecd94111770e5d6ffc9dc2b" },
      { market: "0x2c4e0bb55272f9c120ffd5a414c10244005caf9c1b14527cea3df7074c5bf623", coin: "0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b" },
      { market: "0x761a97787fa8b3ae0cef91ebc2d96e56cc539df5bc88dadabee98ae00363a831", coin: "0x1::aptos_coin::AptosCoin" }
    ];

    // Helper function to get decimals from token address
    const getDecimals = (coinAddress: string): number => {
      const token = tokenList.data.data.find((t: any) => 
        t.faAddress === coinAddress || 
        t.tokenAddress === coinAddress ||
        t.address === coinAddress
      );
      
      if (token) {
        return token.decimals || 8;
      }
      
      // Default decimals for common tokens
      if (coinAddress === "0x1::aptos_coin::AptosCoin") return 8;
      if (coinAddress.includes("::asset::")) return 6; // USDT, USDC
      
      return 8; // Default fallback
    };

    // Parse collaterals
    if (vaultResource.data.collaterals?.data) {
      result.collaterals = vaultResource.data.collaterals.data.map((item: any) => {
        const marketAddress = item.key.inner;
        const market = marketData.find(m => m.market === marketAddress);
        const coinAddress = market?.coin || 'Unknown';
        const decimals = getDecimals(coinAddress);
        
        return {
          marketAddress,
          coinAddress,
          decimals,
          rawAmount: item.value,
          amount: Number(item.value) / Math.pow(10, decimals)
        };
      });
    }

    // Parse liabilities
    if (vaultResource.data.liabilities?.data) {
      result.liabilities = vaultResource.data.liabilities.data.map((item: any) => {
        const marketAddress = item.key.inner;
        const market = marketData.find(m => m.market === marketAddress);
        const coinAddress = market?.coin || 'Unknown';
        const decimals = getDecimals(coinAddress);
        
        return {
          marketAddress,
          coinAddress,
          decimals,
          principal: {
            raw: item.value.principal,
            amount: Number(item.value.principal) / Math.pow(10, decimals)
          },
          interestAccumulated: {
            raw: item.value.interest_accumulated,
            amount: Number(item.value.interest_accumulated) / Math.pow(10, decimals)
          },
          lastInterestRateIndex: item.value.last_interest_rate_index.v
        };
      });
    }

    return result;
  };

  const getTokenIcon = (tokenName: string) => {
    if (tokenName.toLowerCase().includes('aptos') || tokenName.toLowerCase().includes('apt')) {
      return "🟢";
    }
    if (tokenName.toLowerCase().includes('thala') || tokenName.toLowerCase().includes('thapt')) {
      return "🔵";
    }
    return "🪙";
  };

  const formatFarmingId = (farmingId: string) => {
    if (farmingId.startsWith('@')) {
      return farmingId.substring(1, 10) + '...' + farmingId.substring(farmingId.length - 8);
    }
    return farmingId.substring(0, 10) + '...' + farmingId.substring(farmingId.length - 8);
  };

  const handleClaimReward = async (reward: EchelonReward) => {
    const rewardKey = `${reward.farmingId}-${reward.token}`;
    
    if (claimingRewards.has(rewardKey)) return;
    
    if (!account?.address) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to claim rewards",
        variant: "destructive",
      });
      return;
    }
    
    setClaimingRewards(prev => new Set(prev).add(rewardKey));
    
    try {
      // Get transaction payload from API
      const response = await fetch('/api/protocols/echelon/claim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userAddress: account.address.toString(),
          rewardName: reward.token,
          farmingId: reward.farmingId
        })
      });

      const data = await response.json();
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to create claim transaction");
      }

      // Submit transaction using wallet
      if (!signAndSubmitTransaction) {
        throw new Error("Wallet does not support transaction signing");
      }

      const txResponse = await signAndSubmitTransaction({
        data: {
          function: data.data.transactionPayload.function as `${string}::${string}::${string}`,
          typeArguments: data.data.transactionPayload.type_arguments,
          functionArguments: data.data.transactionPayload.arguments
        },
        options: {
          maxGasAmount: 20000, // Network limit is 20000
        },
      });

      console.log('Transaction submitted:', txResponse);

      // Wait for transaction confirmation
      if (txResponse.hash) {
        const maxAttempts = 10;
        const delay = 2000;
        
        for (let i = 0; i < maxAttempts; i++) {
          try {
            const txStatusResponse = await fetch(`https://fullnode.mainnet.aptoslabs.com/v1/transactions/by_hash/${txResponse.hash}`);
            const txData = await txStatusResponse.json();
            
            if (txData.success && txData.vm_status === "Executed successfully") {
              toast({
                title: "Claim Successful!",
                description: `Successfully claimed ${reward.amount.toFixed(6)} ${reward.token}. Hash: ${txResponse.hash.slice(0, 6)}...${txResponse.hash.slice(-4)}`,
              });
              
              // Refresh rewards after successful claim
              await handleFetchRewards();
              return;
            } else if (txData.vm_status) {
              throw new Error(`Transaction failed: ${txData.vm_status}`);
            }
          } catch (error) {
            console.error(`Attempt ${i + 1} failed:`, error);
          }
          
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        throw new Error('Transaction confirmation timeout');
      }

    } catch (err) {
      console.error("Error claiming reward:", err);
      toast({
        title: "Claim Failed",
        description: err instanceof Error ? err.message : "Unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setClaimingRewards(prev => {
        const newSet = new Set(prev);
        newSet.delete(rewardKey);
        return newSet;
      });
    }
  };

  const handleClaimAllRewards = async () => {
    if (rewards.length === 0) return;
    
    if (!account?.address) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to claim rewards",
        variant: "destructive",
      });
      return;
    }
    
    if (!signAndSubmitTransaction) {
      toast({
        title: "Wallet Not Supported",
        description: "Your wallet does not support transaction signing",
        variant: "destructive",
      });
      return;
    }
    
    try {
      let successCount = 0;
      let errorCount = 0;
      
      for (const reward of rewards) {
        try {
          // Get transaction payload from API
          const response = await fetch('/api/protocols/echelon/claim', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userAddress: account.address.toString(),
              rewardName: reward.token,
              farmingId: reward.farmingId
            })
          });

          const data = await response.json();
          
          if (!response.ok || !data.success) {
            throw new Error(data.error || "Failed to create claim transaction");
          }

          // Submit transaction using wallet
          const txResponse = await signAndSubmitTransaction({
            data: {
              function: data.data.transactionPayload.function as `${string}::${string}::${string}`,
              typeArguments: data.data.transactionPayload.type_arguments,
              functionArguments: data.data.transactionPayload.arguments
            },
            options: {
              maxGasAmount: 20000, // Network limit is 20000
            },
          });

          console.log('Transaction submitted:', txResponse);

          // Wait for transaction confirmation
          if (txResponse.hash) {
            const maxAttempts = 10;
            const delay = 2000;
            let confirmed = false;
            
            for (let i = 0; i < maxAttempts; i++) {
              try {
                const txStatusResponse = await fetch(`https://fullnode.mainnet.aptoslabs.com/v1/transactions/by_hash/${txResponse.hash}`);
                const txData = await txStatusResponse.json();
                
                if (txData.success && txData.vm_status === "Executed successfully") {
                  successCount++;
                  confirmed = true;
                  break;
                } else if (txData.vm_status) {
                  throw new Error(`Transaction failed: ${txData.vm_status}`);
                }
              } catch (error) {
                console.error(`Attempt ${i + 1} failed:`, error);
              }
              
              await new Promise(resolve => setTimeout(resolve, delay));
            }
            
            if (!confirmed) {
              errorCount++;
            }
          }
        } catch (err) {
          console.error(`Error claiming reward ${reward.token}:`, err);
          errorCount++;
        }
      }
      
      if (errorCount === 0) {
        toast({
          title: "All Claims Successful",
          description: `Successfully claimed all ${successCount} rewards.`,
        });
      } else {
        toast({
          title: "Partial Success",
          description: `${successCount} claims successful, ${errorCount} failed.`,
          variant: "destructive",
        });
      }
      
      // Refresh rewards
      await handleFetchRewards();
    } catch (err) {
      console.error("Error claiming all rewards:", err);
      toast({
        title: "Claim All Failed",
        description: err instanceof Error ? err.message : "Unknown error occurred",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">
          E
        </div>
        <div>
          <h1 className="text-3xl font-bold">Echelon Rewards Test Page</h1>
          <p className="text-muted-foreground">
            Test Echelon farming rewards from farming::Staker resource
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Fetch Echelon Rewards</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4">
            <div>
              <Label htmlFor="wallet-address">Wallet Address</Label>
              <Input
                id="wallet-address"
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
                placeholder="Enter wallet address to test"
                className="mt-1"
              />
            </div>
            
            <div className="flex gap-2">
              <Button 
                onClick={handleFetchRewards} 
                disabled={loading || !walletAddress}
              >
                {loading ? "Loading..." : "Fetch Rewards"}
              </Button>
              
              <Button 
                onClick={handleFetchVaultData} 
                disabled={vaultLoading || !walletAddress}
                variant="outline"
              >
                {vaultLoading ? "Loading..." : "Fetch Vault Data"}
              </Button>
              
              <Button 
                onClick={handleFetchCollateralMarkets} 
                disabled={collateralMarketsLoading || !walletAddress}
                variant="outline"
              >
                {collateralMarketsLoading ? "Loading..." : "Fetch Collateral Markets"}
              </Button>
              
              {account?.address ? (
                <Button 
                  variant="outline"
                  onClick={() => setWalletAddress(account.address.toString())}
                >
                  Use Connected Wallet
                </Button>
              ) : (
                <WalletConnectButton />
              )}
            </div>
          </div>

          {!account?.address && (
            <div className="p-4 border rounded-lg bg-yellow-50 border-yellow-200">
              <p className="text-yellow-800">
                <strong>Wallet Required:</strong> Connect your wallet to claim rewards. You can still view rewards by entering an address manually.
              </p>
            </div>
          )}

          {error && (
            <div className="p-4 border rounded-lg bg-red-50 border-red-200">
              <p className="text-red-600">{error}</p>
            </div>
          )}

          {debugInfo && (
            <div className="p-4 border rounded-lg bg-gray-50 border-gray-200">
              <p className="text-sm font-mono text-gray-700 whitespace-pre-wrap">{debugInfo}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Vault Data Display */}
      {vaultData && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Lending Vault Data (Raw)</CardTitle>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setVaultData("")}
              >
                Clear
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="p-4 border rounded-lg bg-blue-50 border-blue-200">
              <p className="text-sm font-mono text-blue-700 whitespace-pre-wrap">{vaultData}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Parsed Vault Data Display */}
      {parsedVaultData && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Parsed Vault Data</CardTitle>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setParsedVaultData("")}
              >
                Clear
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="p-4 border rounded-lg bg-green-50 border-green-200">
              <p className="text-sm font-mono text-green-700 whitespace-pre-wrap">{parsedVaultData}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Collateral Markets Data Display */}
      {collateralMarketsData && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Account Collateral Markets Data</CardTitle>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setCollateralMarketsData("")}
              >
                Clear
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="p-4 border rounded-lg bg-purple-50 border-purple-200">
              <p className="text-sm font-mono text-purple-700 whitespace-pre-wrap">{collateralMarketsData}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {rewards.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                Echelon Rewards
                <Badge variant="secondary">{rewards.length} rewards found</Badge>
                {pricesLoading ? (
                  <Badge variant="outline" className="text-blue-600">
                    Loading prices...
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-green-600">
                    Total: ${calculateTotalUSDValue().toFixed(2)}
                  </Badge>
                )}
              </div>
              <Button 
                onClick={handleClaimAllRewards}
                variant="outline"
                size="sm"
                disabled={claimingRewards.size > 0}
              >
                Claim All Rewards
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Token</TableHead>
                  <TableHead>Token Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>USD Value</TableHead>
                  <TableHead>Stake Amount</TableHead>
                  <TableHead>Farming ID</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rewards.map((reward, index) => (
                  <TableRow key={index}>
                                         <TableCell className="flex items-center gap-2">
                       <span className="text-lg">{getTokenIcon(reward.token)}</span>
                       <span className="font-medium">{reward.token}</span>
                     </TableCell>
                     <TableCell>
                       <span className="font-mono text-xs text-gray-500">
                         {reward.tokenType}
                       </span>
                     </TableCell>
                     <TableCell>
                       <span className="font-mono text-green-600">
                         {reward.amount.toFixed(6)}
                       </span>
                     </TableCell>
                                         <TableCell>
                       <span className="font-mono text-gray-600">
                         {pricesLoading ? (
                           "Loading..."
                         ) : (
                           (() => {
                             const price = tokenPrices.get(reward.token);
                             if (price && price.usdPrice && !isNaN(parseFloat(price.usdPrice))) {
                               const usdValue = reward.amount * parseFloat(price.usdPrice);
                               return `$${usdValue.toFixed(2)}`;
                             }
                             return "N/A";
                           })()
                         )}
                       </span>
                     </TableCell>
                                         <TableCell>
                       <span className="font-mono text-gray-600">
                         {reward.stakeAmount.toFixed(6)}
                       </span>
                     </TableCell>

                     <TableCell>
                       <span className="font-mono text-xs text-gray-500">
                         {formatFarmingId(reward.farmingId)}
                       </span>
                     </TableCell>
                     <TableCell className="text-right">
                       <Button
                         size="sm"
                         variant="outline"
                         onClick={() => handleClaimReward(reward)}
                         disabled={claimingRewards.has(`${reward.farmingId}-${reward.token}`)}
                       >
                         {claimingRewards.has(`${reward.farmingId}-${reward.token}`) ? "Claiming..." : "Claim"}
                       </Button>
                     </TableCell>
                   </TableRow>
                 ))}
               </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {rewards.length === 0 && !loading && !error && (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">No rewards found for this address</p>
          </CardContent>
        </Card>
      )}


       
      <Toaster />
    </div>
  );
} 