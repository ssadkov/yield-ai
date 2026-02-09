"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useAptosClient } from "@/contexts/AptosClientContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface TokenBalance {
  tokenAddress: string;
  symbol: string;
  name: string;
  decimals: number;
  balance: string;
  formattedBalance: string;
  type: string;
}

interface AccountResource {
  type: string;
  data: any;
}

export default function MintingAptosPage() {
  const { toast } = useToast();
  const { account } = useWallet();
  const aptosClient = useAptosClient();
  
  // States
  const [isCheckingBalance, setIsCheckingBalance] = useState<boolean>(false);
  const [transactionResult, setTransactionResult] = useState<any>(null);
  const [transactionHash, setTransactionHash] = useState<string>("0x5534aae3ffc270990c931719e160f99895b1870b8c1a1add4c8df503731a8ca1");
  const [targetAddress, setTargetAddress] = useState<string>("0xbaae4e8fcd07785903c2031523c42b42d92a3f83e5aad3a88bc3200f0ff22b30");
  const [balanceData, setBalanceData] = useState<TokenBalance[]>([]);
  const [allResources, setAllResources] = useState<AccountResource[]>([]);
  const [activeTab, setActiveTab] = useState<string>("balance");
  const [showRawData, setShowRawData] = useState<boolean>(false);

  async function checkAddressBalance() {
    if (!targetAddress || !aptosClient) {
      toast({
        title: "Error",
        description: "Please enter a valid address",
        variant: "destructive"
      });
      return;
    }

    setIsCheckingBalance(true);
    setBalanceData([]);
    setAllResources([]);

    try {
      console.log(`Checking balance for address: ${targetAddress}`);
      
      // 1. Получаем все ресурсы аккаунта через API
      const response = await fetch(
        `https://api.mainnet.aptoslabs.com/v1/accounts/${targetAddress}/resources`
      );
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }
      
      const resources: AccountResource[] = await response.json();
      console.log('All resources received:', resources.length);
      setAllResources(resources);

      const balances: TokenBalance[] = [];

      // 2. Ищем CoinStore для APT (основной баланс)
      const aptCoinStore = resources.find((r: AccountResource) => 
        r.type === "0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>"
      );

      if (aptCoinStore && aptCoinStore.data?.coin?.value) {
        const aptBalance = aptCoinStore.data.coin.value;
        console.log('Found APT balance:', aptBalance);
        
        balances.push({
          tokenAddress: "0x1::aptos_coin::AptosCoin",
          symbol: "APT",
          name: "Aptos Coin",
          decimals: 8,
          balance: aptBalance,
          formattedBalance: (BigInt(aptBalance) / BigInt(100_000_000)).toString(),
          type: "coin"
        });
      }

      // 3. Ищем все CoinStore ресурсы (другие токены)
      const allCoinStores = resources.filter((r: AccountResource) => 
        r.type.includes("0x1::coin::CoinStore<")
      );

      console.log(`Found ${allCoinStores.length} CoinStore resources`);

      for (const coinStore of allCoinStores) {
        try {
          // Извлекаем тип токена из CoinStore типа
          const match = coinStore.type.match(/CoinStore<(.+)>/);
          if (match && match[1]) {
            const tokenType = match[1];
            const balance = coinStore.data?.coin?.value;
            
            if (balance && BigInt(balance) > 0) {
              // Пропускаем APT, так как уже добавили
              if (tokenType === "0x1::aptos_coin::AptosCoin") continue;
              
              // Пытаемся определить символ токена
              const parts = tokenType.split('::');
              const symbol = parts.length >= 3 ? parts[2] : "Unknown";
              
              balances.push({
                tokenAddress: tokenType,
                symbol: symbol,
                name: tokenType,
                decimals: 8, // Предполагаем 8 decimals для большинства coin токенов
                balance: balance,
                formattedBalance: (BigInt(balance) / BigInt(100_000_000)).toString(),
                type: "coin"
              });
            }
          }
        } catch (error) {
          console.log('Error parsing CoinStore:', error);
        }
      }

      // 4. Ищем FungibleStore ресурсы (CCTP токены)
      const fungibleStores = resources.filter((r: AccountResource) => 
        r.type === "0x1::fungible_asset::FungibleStore"
      );

      console.log(`Found ${fungibleStores.length} FungibleStore resources`);

      for (const store of fungibleStores) {
        if (store.data && store.data.balances) {
          try {
            // Обрабатываем разные форматы balances
            let balancesArray: any[] = [];
            
            if (Array.isArray(store.data.balances)) {
              balancesArray = store.data.balances;
            } else if (store.data.balances.data && Array.isArray(store.data.balances.data)) {
              balancesArray = store.data.balances.data;
            } else if (typeof store.data.balances === 'object') {
              // Если balances это объект {handle: string, ...}
              balancesArray = Object.entries(store.data.balances).map(([key, value]) => ({
                key: key,
                value: value
              }));
            }

            console.log('Processing balances array:', balancesArray);

            for (const balanceItem of balancesArray) {
              try {
                const tokenType = balanceItem.key || balanceItem.token_type;
                let balanceValue = balanceItem.value || balanceItem.amount;
                
                if (balanceValue && BigInt(balanceValue) > 0) {
                  // Определяем decimals для токена
                  let decimals = 6; // По умолчанию для USDC
                  
                  // Пытаемся определить символ
                  let symbol = "Unknown";
                  let name = "Token";
                  
                  if (tokenType.includes("USDC")) {
                    symbol = "USDC";
                    name = "USD Coin";
                    decimals = 6;
                  } else if (tokenType.includes("USDT")) {
                    symbol = "USDT";
                    name = "Tether USD";
                    decimals = 6;
                  } else if (tokenType.includes("WETH")) {
                    symbol = "WETH";
                    name = "Wrapped Ethereum";
                    decimals = 18;
                  }
                  
                  // Проверяем, есть ли уже этот токен
                  const existing = balances.find(b => b.tokenAddress === tokenType);
                  if (!existing) {
                    balances.push({
                      tokenAddress: tokenType,
                      symbol: symbol,
                      name: name,
                      decimals: decimals,
                      balance: balanceValue.toString(),
                      formattedBalance: (BigInt(balanceValue) / BigInt(10 ** decimals)).toString(),
                      type: "fungible_asset"
                    });
                  }
                }
              } catch (error) {
                console.log('Error processing balance item:', error, balanceItem);
              }
            }
          } catch (error) {
            console.log('Error parsing FungibleStore:', error, store);
          }
        }
      }

      // 5. Проверяем конкретный CCTP USDC токен из вашей транзакции
      const cctpUsdcType = "0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b::fungible_asset::FungibleAsset";
      
      // Проверяем через view function
      try {
        const balanceView = await aptosClient.view({
          payload: {
            function: "0x1::fungible_asset::balance",
            typeArguments: [cctpUsdcType],
            functionArguments: [targetAddress],
          },
        });
        
        console.log('CCTP USDC balance via view:', balanceView);
        
        // Check if balanceView[0] is a valid number/string for BigInt conversion
        const balanceValue = balanceView && balanceView[0];
        const isValidBalance = balanceValue && (typeof balanceValue === 'string' || typeof balanceValue === 'number' || typeof balanceValue === 'bigint');
        
        if (isValidBalance && BigInt(balanceValue) > 0) {
          const existing = balances.find(b => b.tokenAddress === cctpUsdcType);
          if (!existing) {
            balances.push({
              tokenAddress: cctpUsdcType,
              symbol: "USDC (CCTP)",
              name: "USD Coin (Circle CCTP)",
              decimals: 6,
              balance: String(balanceValue),
              formattedBalance: (BigInt(balanceValue) / BigInt(1_000_000)).toString(),
              type: "fungible_asset"
            });
          }
        }
      } catch (error) {
        console.log('CCTP USDC view failed:', error);
      }

      // 6. Сортируем балансы по сумме
      balances.sort((a, b) => {
        const aValue = parseFloat(a.formattedBalance);
        const bValue = parseFloat(b.formattedBalance);
        return bValue - aValue;
      });

      setBalanceData(balances);

      if (balances.length > 0) {
        toast({
          title: "Balance Found",
          description: `Found ${balances.length} token(s) with total balance`,
          variant: "default"
        });
        
        // Логируем для отладки
        console.log('Final balances:', balances);
      } else {
        toast({
          title: "No Token Balances Found",
          description: "No token balances found for this address. Showing raw resources for debugging.",
          variant: "default"
        });
      }

    } catch (error: any) {
      console.error('Balance check error:', error);
      toast({
        title: "Balance Check Failed",
        description: error.message || "Unknown error",
        variant: "destructive"
      });
    } finally {
      setIsCheckingBalance(false);
    }
  }

  async function analyzeTransactionDetails() {
    if (!transactionHash || !aptosClient) return;

    try {
      const tx = await aptosClient.getTransactionByHash({
        transactionHash: transactionHash,
      });

      console.log('Transaction details:', tx);
      setTransactionResult(tx);
      
      toast({
        title: "Analysis Complete",
        description: "Transaction details loaded successfully",
      });

    } catch (error: any) {
      console.error('Analysis error:', error);
      toast({
        title: "Analysis Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  }

  // Функция для форматирования адреса
  function truncateAddress(address: string) {
    if (address.length <= 10) return address;
    return `${address.slice(0, 8)}...${address.slice(-6)}`;
  }

  // Загружаем баланс при изменении адреса или при монтировании
  useEffect(() => {
    if (targetAddress && activeTab === "balance") {
      // Можно добавить автоматическую загрузку
      // checkAddressBalance();
    }
  }, [targetAddress, activeTab]);

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Aptos Balance & Transaction Analyzer</h1>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="balance">Balance Check</TabsTrigger>
          <TabsTrigger value="analyze">Transaction Analysis</TabsTrigger>
        </TabsList>
        
        <TabsContent value="balance">
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Balance Check Tool</CardTitle>
              <CardDescription>
                Check token balances for any Aptos address
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="targetAddress">Wallet Address</Label>
                  <Input
                    id="targetAddress"
                    value={targetAddress}
                    onChange={(e) => setTargetAddress(e.target.value)}
                    placeholder="Enter Aptos wallet address"
                    className="font-mono"
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    Try: 0xbaae4e8fcd07785903c2031523c42b42d92a3f83e5aad3a88bc3200f0ff22b30
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button 
                    onClick={checkAddressBalance} 
                    disabled={isCheckingBalance || !targetAddress}
                    className="flex-1"
                  >
                    {isCheckingBalance ? (
                      <>
                        <span className="animate-spin mr-2">⟳</span>
                        Checking Balance...
                      </>
                    ) : "Check Balance"}
                  </Button>
                  
                  <Button 
                    variant="outline"
                    onClick={() => setShowRawData(!showRawData)}
                    disabled={allResources.length === 0}
                  >
                    {showRawData ? "Hide Raw Data" : "Show Raw Data"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {balanceData.length > 0 && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Token Balances</CardTitle>
                <CardDescription>
                  Address: {targetAddress}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Token</TableHead>
                      <TableHead>Symbol</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead className="text-right">Raw Units</TableHead>
                      <TableHead>Type</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {balanceData.map((token, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">
                          <div className="max-w-xs truncate">{token.name}</div>
                          <div className="text-xs text-gray-500 font-mono">
                            {truncateAddress(token.tokenAddress)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-bold">{token.symbol}</span>
                        </TableCell>
                        <TableCell className="text-right font-bold text-lg">
                          {parseFloat(token.formattedBalance).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: token.decimals
                          })}
                        </TableCell>
                        <TableCell className="text-right text-sm text-gray-500">
                          {parseInt(token.balance).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded text-xs ${token.type === 'coin' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                            {token.type}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                
                <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-bold text-blue-800">Total Tokens: {balanceData.length}</div>
                      <div className="text-sm text-blue-600">
                        {balanceData.filter(t => t.symbol.includes('USDC')).length} USDC token(s)
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-blue-800">
                        {balanceData
                          .filter(t => t.symbol === 'APT')
                          .reduce((sum, token) => sum + parseFloat(token.formattedBalance), 0)
                          .toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })} APT
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {showRawData && allResources.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Raw Resources Data</CardTitle>
                <CardDescription>
                  Showing {allResources.length} resources. Click to expand.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {allResources.map((resource, index) => (
                    <div key={index} className="p-3 border rounded">
                      <div className="font-mono text-sm break-all">{resource.type}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {JSON.stringify(resource.data).length > 200 
                          ? `${JSON.stringify(resource.data).substring(0, 200)}...` 
                          : JSON.stringify(resource.data)}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {balanceData.length === 0 && allResources.length > 0 && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Debug Information</CardTitle>
                <CardDescription>
                  No balances found, but resources exist. Here's what was found:
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="p-3 bg-gray-50 rounded">
                      <div className="text-sm font-medium">Total Resources</div>
                      <div className="text-2xl font-bold">{allResources.length}</div>
                    </div>
                    <div className="p-3 bg-gray-50 rounded">
                      <div className="text-sm font-medium">CoinStores</div>
                      <div className="text-2xl font-bold">
                        {allResources.filter(r => r.type.includes('CoinStore')).length}
                      </div>
                    </div>
                    <div className="p-3 bg-gray-50 rounded">
                      <div className="text-sm font-medium">FungibleStores</div>
                      <div className="text-2xl font-bold">
                        {allResources.filter(r => r.type.includes('FungibleStore')).length}
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-4">
                    <Label>Resource Types Found:</Label>
                    <div className="mt-2 space-y-1">
                      {allResources.slice(0, 10).map((resource, index) => (
                        <div key={index} className="text-sm font-mono p-2 bg-gray-100 rounded">
                          {resource.type}
                        </div>
                      ))}
                      {allResources.length > 10 && (
                        <div className="text-sm text-gray-500">
                          ... and {allResources.length - 10} more
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="analyze">
          {/* Transaction Analysis Tab - аналогично предыдущей версии */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Transaction Analysis Tool</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label>Transaction Hash</Label>
                  <Input
                    value={transactionHash}
                    onChange={(e) => setTransactionHash(e.target.value)}
                    placeholder="Enter transaction hash"
                  />
                </div>
                <Button onClick={analyzeTransactionDetails}>
                  Analyze Transaction
                </Button>
              </div>
            </CardContent>
          </Card>

          {transactionResult && (
            <Card>
              <CardHeader>
                <CardTitle>Transaction Result</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs bg-gray-100 p-4 rounded overflow-auto">
                  {JSON.stringify(transactionResult, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button 
              variant="outline" 
              onClick={() => {
                setTargetAddress("0xbaae4e8fcd07785903c2031523c42b42d92a3f83e5aad3a88bc3200f0ff22b30");
                setActiveTab("balance");
                setTimeout(() => checkAddressBalance(), 100);
              }}
            >
              Check Target Wallet
            </Button>
            <Button 
              variant="outline"
              onClick={() => {
                if (account?.address) {
                  setTargetAddress(account.address.toString());
                  setActiveTab("balance");
                  setTimeout(() => checkAddressBalance(), 100);
                }
              }}
              disabled={!account}
            >
              Check My Wallet
            </Button>
            <Button 
              variant="outline"
              onClick={() => {
                setTransactionHash("0x5534aae3ffc270990c931719e160f99895b1870b8c1a1add4c8df503731a8ca1");
                setActiveTab("analyze");
                setTimeout(() => analyzeTransactionDetails(), 100);
              }}
            >
              Load Example Tx
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


/* http://localhost:3000/cctp-list-attestation
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Connection } from "@solana/web3.js";

type Attestation = {
  payload: string;
  messageHash: string;
  attestation: string;
};

const SOLANA_RPC = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 
                   process.env.SOLANA_RPC_URL || 
                   'https://mainnet.helius-rpc.com/?api-key=29798653-2d13-4d8a-96ad-df70b015e234';

export default function CctpListAttestationsPage() {
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [apiKey, setApiKey] = useState<string>("");
  
  // Method 1: By remoteDomain
  const [remoteDomain, setRemoteDomain] = useState<string>("");
  const [fromIso, setFromIso] = useState<string>("");
  const [toIso, setToIso] = useState<string>("");
  
  // Method 2: By depositMessageHash
  const [solanaTxSignature, setSolanaTxSignature] = useState<string>("");
  const [depositMessageHash, setDepositMessageHash] = useState<string>("");

  const [isLoading, setIsLoading] = useState(false);
  const [rawResponse, setRawResponse] = useState<string>("");
  const [attestations, setAttestations] = useState<Attestation[]>([]);

  // Read query parameters and auto-fill fields
  useEffect(() => {
    if (!searchParams) return;
    const txSignature = searchParams.get('txSignature');
    const messageHash = searchParams.get('messageHash');

    if (txSignature) {
      setSolanaTxSignature(txSignature);
      // Try to extract depositMessageHash from transaction
      extractMessageHashFromSolanaTx(txSignature).then(hash => {
        if (hash) {
          setDepositMessageHash(hash);
        }
      });
    }

    if (messageHash) {
      setDepositMessageHash(messageHash);
    }
  }, [searchParams]);

  // Try to get depositMessageHash from localStorage (Wormhole SDK saves transfer data there)
  const getDepositMessageHashFromLocalStorage = (txSignature: string): string | null => {
    try {
      const storageKeys = Object.keys(localStorage);
      
      for (const key of storageKeys) {
        if (key.includes('transfer') || key.includes('wormhole') || key.includes('cctp')) {
          try {
            const data = JSON.parse(localStorage.getItem(key) || '[]');
            const transfers = Array.isArray(data) ? data : [data];
            
            for (const transfer of transfers) {
              // Check if this transfer matches our transaction
              if (transfer.txHash === txSignature || 
                  transfer.txDetails?.sendTx === txSignature ||
                  transfer.txDetails?.txHash === txSignature) {
                
                // Check if there's a depositMessageHash field
                if (transfer.depositMessageHash) {
                  console.log('[CCTP] Found depositMessageHash in localStorage:', transfer.depositMessageHash);
                  return transfer.depositMessageHash;
                }
                
                // Note: receipt.attestation.id.hash is the attestation hash, not message hash
                // We would need to compute depositMessageHash from receipt.attestation.attestation.message
                // Note: In Wormhole SDK, message is at receipt.attestation.attestation.message
                const cctpMessage = transfer.receipt?.attestation?.attestation?.message || 
                                   transfer.receipt?.attestation?.message;
                
                if (cctpMessage && cctpMessage.sourceDomain !== undefined) {
                  console.log('[CCTP] Found CCTP message in localStorage, but need keccak256 to compute depositMessageHash');
                  // Could compute here if we had keccak256 library
                }
              }
            }
          } catch (e) {
            // Skip invalid JSON
            continue;
          }
        }
      }
    } catch (error: any) {
      console.warn('[CCTP] Error checking localStorage:', error);
    }
    return null;
  };

  // Extract depositMessageHash from Solana transaction logs
  const extractMessageHashFromSolanaTx = async (txSignature: string): Promise<string | null> => {
    try {
      const connection = new Connection(SOLANA_RPC, 'confirmed');
      const tx = await connection.getTransaction(txSignature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      });

      if (!tx) {
        throw new Error('Transaction not found');
      }

      // CCTP message hash is typically in the logs
      // Look for log entries containing "message" or "hash"
      const logs = tx.meta?.logMessages || [];
      
      // Try to find message hash in logs
      // Format might be: "Program log: Message hash: <hash>"
      for (const log of logs) {
        // Look for patterns like "message hash", "messageHash", etc.
        const hashMatch = log.match(/message[_\s]?hash[:\s]+([A-Za-z0-9]+)/i);
        if (hashMatch && hashMatch[1]) {
          return hashMatch[1];
        }
        
        // Also check for hex patterns that might be the message hash
        const hexMatch = log.match(/0x([A-Fa-f0-9]{64})/);
        if (hexMatch && hexMatch[1]) {
          // This might be the message hash
          return hexMatch[1];
        }
      }

      // Alternative: check transaction account keys for Circle program
      // Circle CCTP program on Solana: TokenMessenger program
      // The message hash might be in instruction data or account keys
      
      toast({
        variant: "default",
        title: "Message hash not found in logs",
        description: "Попробуйте ввести depositMessageHash вручную или проверьте транзакцию на Solscan.",
      });
      
      return null;
    } catch (error: any) {
      console.error("[CCTP] Error extracting message hash:", error);
      toast({
        variant: "destructive",
        title: "Failed to extract message hash",
        description: error.message || "Не удалось получить message hash из транзакции.",
      });
      return null;
    }
  };

  const handleFetchByRemoteDomain = async () => {
    setRawResponse("");
    setAttestations([]);

    if (!apiKey.trim() || !remoteDomain.trim() || !fromIso.trim() || !toIso.trim()) {
      toast({
        variant: "destructive",
        title: "Missing fields",
        description: "Заполни API key, remoteDomain и from/to ISO timestamps.",
      });
      return;
    }

    setIsLoading(true);

    try {
      const baseUrl = "https://xreserve-api.circle.com";
      const params = new URLSearchParams({
        pageSize: "50",
        from: fromIso,
        to: toIso,
      });
      const url = `${baseUrl}/v1/remote-domains/${remoteDomain}/attestations?${params.toString()}`;

      const res = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey.trim()}`,
        },
      });

      const text = await res.text();
      setRawResponse(text);

      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Circle API error",
          description: `HTTP ${res.status} – см. raw JSON ниже.`,
        });
        return;
      }

      let json: any;
      try {
        json = JSON.parse(text);
      } catch (e) {
        toast({
          variant: "destructive",
          title: "JSON parse error",
          description: "Ответ от Circle не похож на JSON. См. raw текст ниже.",
        });
        return;
      }

      if (!json.attestations || !Array.isArray(json.attestations)) {
        toast({
          variant: "destructive",
          title: "No attestations array",
          description: "В ответе нет поля attestations. См. raw JSON ниже.",
        });
        return;
      }

      const mapped: Attestation[] = json.attestations.map((a: any) => ({
        payload: a.payload,
        messageHash: a.messageHash,
        attestation: a.attestation,
      }));

      setAttestations(mapped);

      toast({
        title: "Attestations loaded",
        description: `Получено ${mapped.length} записей. Внизу показаны payload/attestation/messageHash.`,
      });
    } catch (e: any) {
      console.error("[CCTP List Attestations] Error:", e);
      toast({
        variant: "destructive",
        title: "Request failed",
        description: e?.message || "Не удалось запросить attestations у Circle.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFetchByMessageHash = async () => {
    setRawResponse("");
    setAttestations([]);

    let messageHash = depositMessageHash.trim();

    // If Solana tx signature is provided, try to extract message hash
    if (solanaTxSignature.trim() && !messageHash) {
      setIsLoading(true);
      
      // First, try to get from localStorage (Wormhole SDK saves it there)
      let extractedHash = getDepositMessageHashFromLocalStorage(solanaTxSignature.trim());
      
      // If not in localStorage, try to extract from transaction logs
      if (!extractedHash) {
        extractedHash = await extractMessageHashFromSolanaTx(solanaTxSignature.trim());
      }
      
      // If not found in logs, try to get from Circle API using transaction signature
      if (!extractedHash && apiKey.trim()) {
        try {
          console.log('[CCTP] Attempting to get depositMessageHash from Circle API using transaction signature...');
          const baseUrl = "https://xreserve-api.circle.com";
          // Try to query by transaction hash (if Circle API supports it)
          const url = `${baseUrl}/v1/attestations?txHash=${solanaTxSignature.trim()}`;
          
          const res = await fetch(url, {
            method: "GET",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey.trim()}`,
            },
          });
          
          if (res.ok) {
            const data = await res.json();
            if (data.attestations && Array.isArray(data.attestations) && data.attestations.length > 0) {
              // Get the first attestation's messageHash
              extractedHash = data.attestations[0].messageHash;
              console.log('[CCTP] Found depositMessageHash from Circle API:', extractedHash);
            }
          }
        } catch (e: any) {
          console.warn('[CCTP] Could not get depositMessageHash from Circle API:', e.message);
        }
      }
      
      if (extractedHash) {
        messageHash = extractedHash;
        setDepositMessageHash(extractedHash);
      } else {
        setIsLoading(false);
        toast({
          variant: "default",
          title: "Could not extract depositMessageHash",
          description: "depositMessageHash не найден в логах транзакции. Попробуйте получить его из localStorage данных Wormhole SDK или введите вручную, если знаете.",
        });
        return;
      }
    }

    if (!apiKey.trim() || !messageHash) {
      toast({
        variant: "destructive",
        title: "Missing fields",
        description: "Заполни API key и depositMessageHash (или Solana tx signature).",
      });
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const baseUrl = "https://xreserve-api.circle.com";
      const url = `${baseUrl}/v1/attestations/${messageHash}`;

      const res = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey.trim()}`,
        },
      });

      const text = await res.text();
      setRawResponse(text);

      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Circle API error",
          description: `HTTP ${res.status} – см. raw JSON ниже.`,
        });
        return;
      }

      let json: any;
      try {
        json = JSON.parse(text);
      } catch (e) {
        toast({
          variant: "destructive",
          title: "JSON parse error",
          description: "Ответ от Circle не похож на JSON. См. raw текст ниже.",
        });
        return;
      }

      // Single attestation response
      if (json.payload && json.attestation && json.messageHash) {
        const attestation: Attestation = {
          payload: json.payload,
          messageHash: json.messageHash,
          attestation: json.attestation,
        };
        setAttestations([attestation]);

        toast({
          title: "Attestation loaded",
          description: "Получена attestation. Внизу показаны payload/attestation/messageHash.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Invalid response format",
          description: "Ответ не содержит ожидаемых полей (payload, attestation, messageHash).",
        });
      }
    } catch (e: any) {
      console.error("[CCTP Get Attestation] Error:", e);
      toast({
        variant: "destructive",
        title: "Request failed",
        description: e?.message || "Не удалось запросить attestation у Circle.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-gray-50 via-white to-gray-100">
      <Card className="w-full max-w-3xl border-2">
        <CardHeader>
          <CardTitle>Get CCTP Attestations (Circle xReserve)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Страница для запроса attestations с Circle xReserve API.
            <br />
            <strong>Важно:</strong> Aptos отсутствует в списке remoteDomains Circle API.
            Используйте метод "По depositMessageHash" для получения attestation по конкретной транзакции.
          </p>

          <div>
            <Label htmlFor="apiKey">Circle API key (Bearer)</Label>
            <Input
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk_live_..."
              className="font-mono text-xs"
            />
          </div>

          <Tabs defaultValue="by-message-hash" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="by-message-hash">По depositMessageHash</TabsTrigger>
              <TabsTrigger value="by-remote-domain">По remoteDomain</TabsTrigger>
            </TabsList>

            <TabsContent value="by-message-hash" className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Получить attestation по depositMessageHash из Solana транзакции.
                <br />
                Endpoint: <code>GET /v1/attestations/{"{depositMessageHash}"}</code>
              </p>

              <div className="space-y-3">
                <div>
                  <Label htmlFor="solanaTxSignature">Solana Transaction Signature (опционально)</Label>
                  <Input
                    id="solanaTxSignature"
                    type="text"
                    value={solanaTxSignature}
                    onChange={(e) => setSolanaTxSignature(e.target.value)}
                    placeholder="Вставьте Solana tx signature для автоматического извлечения messageHash"
                    className="font-mono text-xs"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Если указан, попытаемся автоматически извлечь depositMessageHash из логов транзакции.
                  </p>
                </div>

                <div>
                  <Label htmlFor="depositMessageHash">depositMessageHash (обязательно)</Label>
                  <Input
                    id="depositMessageHash"
                    type="text"
                    value={depositMessageHash}
                    onChange={(e) => setDepositMessageHash(e.target.value)}
                    placeholder="Вставьте depositMessageHash вручную или оставьте пустым для автозаполнения из Solana tx"
                    className="font-mono text-xs"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Можно найти в логах Solana транзакции на Solscan или получить из Wormhole SDK.
                  </p>
                </div>
              </div>

              <Button 
                onClick={handleFetchByMessageHash} 
                disabled={isLoading} 
                className="w-full h-11 text-sm font-semibold"
              >
                {isLoading ? "Запрос..." : "Получить attestation по messageHash"}
              </Button>
            </TabsContent>

            <TabsContent value="by-remote-domain" className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Получить список attestations по remoteDomain и временному диапазону.
                <br />
                <strong>Примечание:</strong> Aptos отсутствует в списке поддерживаемых remoteDomains.
                <br />
                Endpoint: <code>GET /v1/remote-domains/{"{remoteDomain}"}/attestations</code>
              </p>

              <div className="space-y-3">
                <div>
                  <Label htmlFor="remoteDomain">remoteDomain</Label>
                  <Input
                    id="remoteDomain"
                    type="number"
                    min="0"
                    value={remoteDomain}
                    onChange={(e) => setRemoteDomain(e.target.value)}
                    placeholder="Напр. 0 (Ethereum), 5 (Solana), 10001 (Canton)"
                    className="font-mono text-xs"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Поддерживаемые: Ethereum (0), Solana (5), Canton (10001), Aleo (10002), Stacks (10003).
                    Aptos отсутствует.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="fromIso">from (ISO 8601)</Label>
                    <Input
                      id="fromIso"
                      type="text"
                      value={fromIso}
                      onChange={(e) => setFromIso(e.target.value)}
                      placeholder="2025-12-23T09:30:00Z"
                      className="font-mono text-xs"
                    />
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Используйте обычные дефисы (-), не специальные символы.
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="toIso">to (ISO 8601)</Label>
                    <Input
                      id="toIso"
                      type="text"
                      value={toIso}
                      onChange={(e) => setToIso(e.target.value)}
                      placeholder="2025-12-23T10:00:00Z"
                      className="font-mono text-xs"
                    />
                  </div>
                </div>
              </div>

              <Button 
                onClick={handleFetchByRemoteDomain} 
                disabled={isLoading} 
                className="w-full h-11 text-sm font-semibold"
              >
                {isLoading ? "Запрос..." : "Запросить attestations по remoteDomain"}
              </Button>
            </TabsContent>
          </Tabs>

          {attestations.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                Упрощённый список (для копирования в /cctp-redeem-test):
              </p>
              <div className="max-h-64 overflow-auto border rounded p-2 text-[11px] font-mono space-y-2 bg-muted">
                {attestations.map((a, idx) => (
                  <div key={a.messageHash + idx} className="border-b pb-1 mb-1 last:border-b-0 last:pb-0 last:mb-0">
                    <div>[{idx}] messageHash:</div>
                    <div className="break-all">{a.messageHash}</div>
                    <div>payload (message):</div>
                    <div className="break-all">{a.payload}</div>
                    <div>attestation:</div>
                    <div className="break-all">{a.attestation}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {rawResponse && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">
                Raw JSON response от Circle:
              </p>
              <div className="max-h-64 overflow-auto border rounded p-2 text-[11px] font-mono bg-muted whitespace-pre-wrap break-words">
                {rawResponse}
              </div>
            </div>
          )}

          <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
            <p>
              <strong>Методы получения attestations:</strong>
            </p>
            <p>
              • <strong>По depositMessageHash:</strong> <code>GET /v1/attestations/{"{depositMessageHash}"}</code>
              <br />
              &nbsp;&nbsp;Работает для всех цепочек, включая Aptos. Требует messageHash из Solana транзакции.
            </p>
            <p>
              • <strong>По remoteDomain:</strong> <code>GET /v1/remote-domains/{"{remoteDomain}"}/attestations</code>
              <br />
              &nbsp;&nbsp;Работает только для поддерживаемых цепочек (Ethereum, Solana, Canton, Aleo, Stacks).
              <br />
              &nbsp;&nbsp;Aptos отсутствует в списке remoteDomains Circle API.
            </p>
            <p>
              • <strong>Как найти depositMessageHash:</strong>
              <br />
              &nbsp;&nbsp;1. Откройте Solana транзакцию на Solscan
              <br />
              &nbsp;&nbsp;2. Найдите в логах запись с "message hash" или hex-строку (64 символа)
              <br />
              &nbsp;&nbsp;3. Или используйте Wormhole SDK для извлечения messageHash из transfer объекта
            </p>
            <p className="text-red-500">
              • Используй этот экран только локально, не храни тут боевой API key в проде.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
*/
