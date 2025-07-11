"use client";

import React, { useState } from "react";
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

interface EchelonReward {
  token: string;
  tokenType: string;
  amount: number;
  rawAmount: string;
  farmingId: string;
  stakeAmount: number;
}

export default function TestEchelonPage() {
  const { account, signAndSubmitTransaction } = useWallet();
  const [walletAddress, setWalletAddress] = useState(account?.address?.toString() || "");
  const [loading, setLoading] = useState(false);
  const [rewards, setRewards] = useState<EchelonReward[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>("");
  const [claimingRewards, setClaimingRewards] = useState<Set<string>>(new Set());

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
        setRewards(data.data || []);
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
          maxGasAmount: 100000,
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
              maxGasAmount: 100000,
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

      {rewards.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                Echelon Rewards
                <Badge variant="secondary">{rewards.length} rewards found</Badge>
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