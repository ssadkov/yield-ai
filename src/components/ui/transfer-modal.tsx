"use client";

import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { Loader2, AlertCircle, CheckCircle, XCircle, Copy, ExternalLink, X, Send } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useWalletData } from '@/contexts/WalletContext';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { isUserRejectedError } from '@/lib/utils/errors';
import { Token } from '@/lib/types/panora';
import tokenList from '@/lib/data/tokenList.json';
import { isValidAptosAddress } from '@/lib/utils/aptosNames';
import { useToast } from '@/components/ui/use-toast';

interface TransferResult {
  success: boolean;
  hash?: string;
  error?: string;
}

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TransferModal({ isOpen, onClose }: TransferModalProps) {
  const { tokens, address: userAddress, refreshPortfolio } = useWalletData();
  const { signAndSubmitTransaction, connected, account } = useWallet();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transferResult, setTransferResult] = useState<TransferResult | null>(null);
  
  // Token selection
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [amount, setAmount] = useState<string>('');
  const [recipientAddress, setRecipientAddress] = useState<string>('');
  const [addressError, setAddressError] = useState<string | null>(null);

  // USD amount calculated from input amount and token price
  const usdAmount = useMemo(() => {
    if (!selectedToken || !amount) return 0;
    const price = Number(selectedToken.usdPrice || 0);
    const qty = Number(amount || 0);
    if (!isFinite(price) || !isFinite(qty)) return 0;
    return qty * price;
  }, [amount, selectedToken]);

  // Available tokens from wallet (with balance > 0)
  const availableTokens = useMemo(() => {
    return tokens
      .map(t => {
        const tokenInfo = getTokenInfo(t.address);
        return {
          ...t,
          tokenInfo,
        };
      })
      .filter(token => {
        // Filter tokens with balance > 0
        const balance = Number(token.amount || 0);
        return balance > 0 && token.tokenInfo;
      })
      .sort((a, b) => {
        // Sort by total value USD (balance × price)
        const aBalance = Number(a.amount || 0) / Math.pow(10, a.tokenInfo?.decimals || 8);
        const bBalance = Number(b.amount || 0) / Math.pow(10, b.tokenInfo?.decimals || 8);
        const aPrice = Number(a.price || 0);
        const bPrice = Number(b.price || 0);
        const aValueUSD = aBalance * aPrice;
        const bValueUSD = bBalance * bPrice;
        if (!isFinite(aValueUSD) && !isFinite(bValueUSD)) return 0;
        if (!isFinite(aValueUSD)) return 1;
        if (!isFinite(bValueUSD)) return -1;
        return bValueUSD - aValueUSD;
      });
  }, [tokens]);

  function getTokenInfo(address: string): Token | undefined {
    // Normalize addresses by removing leading zeros after 0x
    const normalizeAddress = (addr: string) => {
      if (!addr || !addr.startsWith('0x')) return addr;
      return '0x' + addr.slice(2).replace(/^0+/, '') || '0x0';
    };
    
    const normalizedAddress = normalizeAddress(address);
    
    return (tokenList.data.data as Token[]).find(token => {
      const normalizedTokenAddress = normalizeAddress(token.tokenAddress || '');
      const normalizedFaAddress = normalizeAddress(token.faAddress || '');
      
      return normalizedTokenAddress === normalizedAddress || 
             normalizedFaAddress === normalizedAddress;
    });
  }

  function normalizeAddress(address?: string) {
    return (address || '').toLowerCase();
  }

  function findTokenBalance(token: Token): number {
    const tokenAddresses = [
      token.tokenAddress ?? undefined,
      token.faAddress ?? undefined,
    ].filter(Boolean).map(normalizeAddress);

    const found = tokens.find(
      t =>
        tokenAddresses.includes(normalizeAddress(t.address))
    );

    if (!found) return 0;
    const rawAmount = Number(found.amount || 0);
    const decimals = token.decimals || 8;
    return rawAmount / Math.pow(10, decimals);
  }

  // Refresh portfolio data when modal opens
  useEffect(() => {
    if (isOpen) {
      refreshPortfolio();
      // Reset form
      setSelectedToken(null);
      setAmount('');
      setRecipientAddress('');
      setAddressError(null);
      setError(null);
      setTransferResult(null);
    }
  }, [isOpen, refreshPortfolio]);

  // Set default token on load
  useEffect(() => {
    if (availableTokens.length > 0 && !selectedToken && isOpen) {
      const firstToken = availableTokens[0];
      if (firstToken.tokenInfo) {
        setSelectedToken(firstToken.tokenInfo);
      }
    }
  }, [availableTokens, selectedToken, isOpen]);

  // Validate recipient address in real-time
  useEffect(() => {
    if (!recipientAddress) {
      setAddressError(null);
      return;
    }

    // Normalize address (handle with/without 0x prefix)
    const normalized = recipientAddress.trim();
    const withPrefix = normalized.startsWith('0x') ? normalized : `0x${normalized}`;

    if (isValidAptosAddress(withPrefix)) {
      setAddressError(null);
    } else {
      setAddressError('Invalid Aptos address format');
    }
  }, [recipientAddress]);

  // Validate amount against balance
  const amountError = useMemo(() => {
    if (!amount || !selectedToken) return null;
    const amountNum = Number(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return 'Amount must be greater than 0';
    }
    const balance = findTokenBalance(selectedToken);
    if (amountNum > balance) {
      return 'Insufficient balance';
    }
    return null;
  }, [amount, selectedToken, tokens]);

  const canTransfer = useMemo(() => {
    return (
      connected &&
      selectedToken &&
      amount &&
      Number(amount) > 0 &&
      recipientAddress &&
      !addressError &&
      !amountError &&
      !loading
    );
  }, [connected, selectedToken, amount, recipientAddress, addressError, amountError, loading]);

  const executeTransfer = async () => {
    if (!connected) {
      setError('Wallet not connected. Please connect your wallet first.');
      toast({
        variant: "destructive",
        title: "Wallet Not Connected",
        description: "Please connect your Aptos wallet to transfer tokens",
      });
      return;
    }

    if (!selectedToken || !amount || !recipientAddress || !account) {
      setError('Please fill in all fields');
      return;
    }

    // Normalize recipient address
    const normalizedRecipient = recipientAddress.trim();
    const recipient = normalizedRecipient.startsWith('0x') 
      ? normalizedRecipient 
      : `0x${normalizedRecipient}`;

    if (!isValidAptosAddress(recipient)) {
      setError('Invalid recipient address');
      return;
    }

    setLoading(true);
    setError(null);
    setTransferResult(null);

    try {
      const amountNum = Number(amount);
      const decimals = selectedToken.decimals || 8;
      const amountInSmallestUnit = BigInt(Math.floor(amountNum * Math.pow(10, decimals)));

      // Determine token type
      // APT: symbol is 'APT' or faAddress is '0xa'
      const isAPT = selectedToken.symbol === 'APT' || (selectedToken.faAddress || '').toLowerCase() === '0xa';
      // Legacy Coin: has tokenAddress with "::" (e.g., 0xf22...::asset::USDT)
      const isLegacyCoin = !isAPT && selectedToken.tokenAddress && selectedToken.tokenAddress.includes('::');
      // Fungible Asset (FA): long address without "::" (e.g., 0xbae207...)
      const isFungibleAsset = !isAPT && !isLegacyCoin;

      let txHash: string;
      
      const transactionData: any = {
        data: {
          function: '',
          typeArguments: [] as string[],
          functionArguments: [] as any[],
        },
        options: {
          maxGasAmount: 20000,
        }
      };

      if (isAPT) {
        // --- 1. Transfer APT ---
        transactionData.data.function = '0x1::aptos_account::transfer';
        transactionData.data.typeArguments = [];
        transactionData.data.functionArguments = [
          recipient,
          amountInSmallestUnit.toString()
        ];
        transactionData.options.maxGasAmount = 2000;
      } else if (isLegacyCoin) {
        // --- 2. Transfer Legacy Coin (USDT LayerZero, etc.) ---
        // Use transfer_coins, as it automatically registers the recipient if needed
        transactionData.data.function = '0x1::aptos_account::transfer_coins';
        transactionData.data.typeArguments = [selectedToken.tokenAddress!]; // Important: pass coin type
        transactionData.data.functionArguments = [
          recipient,
          amountInSmallestUnit.toString()
        ];
      } else if (isFungibleAsset) {
        // --- 3. Transfer Fungible Asset (FA) ---
        // Use primary_fungible_store::transfer for FA tokens
        // For FA, use either faAddress or tokenAddress (if faAddress is empty)
        const assetAddress = selectedToken.faAddress || selectedToken.tokenAddress;
        
        if (!assetAddress) {
          throw new Error('Token does not have a fungible asset address');
        }

        transactionData.data.function = '0x1::primary_fungible_store::transfer';
        // IMPORTANT: FA tokens require type argument '0x1::fungible_asset::Metadata'
        // Without this, you get "expected 1, received 0" error
        transactionData.data.typeArguments = ['0x1::fungible_asset::Metadata'];
        transactionData.data.functionArguments = [
          assetAddress, // FA token address (e.g., 0xbae207...)
          recipient,   // Recipient address
          amountInSmallestUnit.toString() // Amount
        ];
      } else {
        throw new Error('Unable to determine token type');
      }

      // Log transaction data for debugging
      console.log('[TransferModal] Transaction data:', {
        tokenType: isAPT ? 'APT' : isLegacyCoin ? 'Legacy Coin' : 'Fungible Asset',
        function: transactionData.data.function,
        typeArguments: transactionData.data.typeArguments,
        functionArguments: transactionData.data.functionArguments,
        tokenSymbol: selectedToken.symbol,
        tokenAddress: selectedToken.tokenAddress,
        faAddress: selectedToken.faAddress,
        amount: amountInSmallestUnit.toString(),
        recipient,
      });

      // Execute transaction
      const tx = await signAndSubmitTransaction(transactionData);
      txHash = tx.hash || 'Transaction submitted successfully';

      setTransferResult({
        success: true,
        hash: txHash,
      });

      // Show success toast
      toast({
        title: "Transfer Successful",
        description: `Transaction: ${formatHash(txHash)}`,
      });

      // Clear form
      setAmount('');
      setRecipientAddress('');

      // Refresh portfolio after delay
      setTimeout(() => {
        refreshPortfolio();
      }, 2000);

    } catch (error: any) {
      // Log full error for debugging
      console.error('[TransferModal] Transfer error:', {
        error,
        message: error?.message,
        name: error?.name,
        code: error?.code,
        stack: error?.stack,
        fullError: JSON.stringify(error, Object.getOwnPropertyNames(error)),
      });

      let errorMessage = 'Failed to execute transfer';
      if (error?.message) {
        errorMessage = error.message;
      } else if (error?.name === 'PetraApiError') {
        errorMessage = 'Petra wallet error. Please check your wallet connection and try again.';
      } else if (isUserRejectedError(error)) {
        errorMessage = 'Transaction was rejected by user.';
      } else if (error?.code === 'WALLET_NOT_CONNECTED') {
        errorMessage = 'Wallet not connected. Please connect your wallet first.';
      } else if (error?.code === 'WALLET_LOCKED') {
        errorMessage = 'Wallet is locked. Please unlock your wallet and try again.';
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error?.toString) {
        errorMessage = error.toString();
      }

      setTransferResult({
        success: false,
        error: errorMessage,
      });

      toast({
        variant: "destructive",
        title: "Transfer Failed",
        description: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number | string) => {
    return Number(num).toLocaleString('en-US', { maximumFractionDigits: 6 });
  };

  const formatHash = (hash: string) => {
    if (hash.length <= 12) return hash;
    return `${hash.slice(0, 6)}...${hash.slice(-6)}`;
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied",
        description: "Transaction hash copied to clipboard",
      });
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const openExplorer = (hash: string) => {
    const explorerUrl = `https://explorer.aptoslabs.com/txn/${hash}?network=mainnet`;
    window.open(explorerUrl, '_blank');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto p-6 rounded-2xl w-[calc(100vw-2rem)] sm:w-auto [&>button:last-child]:hidden">
        <DialogHeader>
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <Image 
                src="/logo.png" 
                alt="Yield AI" 
                width={24} 
                height={24} 
                className="rounded-full"
              />
              <DialogTitle>Transfer Tokens</DialogTitle>
            </div>
            <Button
              onClick={onClose}
              variant="ghost"
              size="icon"
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <DialogDescription>
            Transfer tokens to another Aptos wallet address
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Token Selection */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Token</Label>
            <Select
              value={selectedToken?.faAddress || selectedToken?.tokenAddress || ''}
              onValueChange={(value) => {
                const token = getTokenInfo(value);
                if (token) {
                  setSelectedToken(token);
                  setAmount('');
                  setError(null);
                  setTransferResult(null);
                }
              }}
            >
              <SelectTrigger className="h-10">
                <SelectValue>
                  {selectedToken ? (
                    <div className="flex items-center gap-2">
                      <Image
                        src={selectedToken.logoUrl || '/file.svg'}
                        alt={selectedToken.symbol}
                        width={20}
                        height={20}
                        className="rounded-full"
                      />
                      <span className="text-sm">{selectedToken.symbol}</span>
                    </div>
                  ) : (
                    <span className="text-sm">Select token</span>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <div className="p-2">
                  <div className="text-sm font-medium mb-2">Your Tokens</div>
                  {availableTokens.map((token) => {
                    const tokenInfo = token.tokenInfo;
                    if (!tokenInfo) return null;
                    const balance = findTokenBalance(tokenInfo);
                    return (
                      <SelectItem
                        key={tokenInfo.faAddress || tokenInfo.tokenAddress || ''}
                        value={tokenInfo.faAddress || tokenInfo.tokenAddress || ''}
                      >
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-2">
                            <Image
                              src={tokenInfo.logoUrl || '/file.svg'}
                              alt={tokenInfo.symbol}
                              width={16}
                              height={16}
                              className="rounded-full"
                            />
                            <span className="text-sm">{tokenInfo.symbol}</span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatNumber(balance)}
                            {token.price && Math.abs(balance) >= 0.001 && (
                              <span> (${(balance * Number(token.price)).toFixed(2)})</span>
                            )}
                          </div>
                        </div>
                      </SelectItem>
                    );
                  })}
                </div>
              </SelectContent>
            </Select>
            
            {selectedToken && (
              <div className="text-xs text-muted-foreground">
                Balance: {formatNumber(findTokenBalance(selectedToken))} {selectedToken.symbol}
              </div>
            )}
          </div>

          {/* Amount Input */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Amount
              {selectedToken && amount && (
                <span className="text-muted-foreground ml-2">
                  ${usdAmount.toFixed(2)}
                </span>
              )}
            </Label>
            <Input
              type="number"
              placeholder="0.0"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setError(null);
                setTransferResult(null);
              }}
              className="h-10 text-sm"
            />
            
            {selectedToken && (
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    const balance = findTokenBalance(selectedToken);
                    setAmount((balance * 0.25).toString());
                  }}
                  className="h-7 text-xs px-2"
                >
                  25%
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    const balance = findTokenBalance(selectedToken);
                    setAmount((balance * 0.5).toString());
                  }}
                  className="h-7 text-xs px-2"
                >
                  50%
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    const balance = findTokenBalance(selectedToken);
                    setAmount(balance.toString());
                  }}
                  className="h-7 text-xs px-2"
                >
                  Max
                </Button>
              </div>
            )}

            {amountError && (
              <div className="text-xs text-red-500">{amountError}</div>
            )}
          </div>

          {/* Recipient Address */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Recipient Address</Label>
            <Input
              type="text"
              placeholder="0x..."
              value={recipientAddress}
              onChange={(e) => {
                setRecipientAddress(e.target.value);
                setError(null);
                setTransferResult(null);
              }}
              className="h-10 text-sm font-mono"
            />
            {addressError && (
              <div className="text-xs text-red-500">{addressError}</div>
            )}
          </div>

          {/* Transfer Result */}
          {transferResult && (
            <div className="p-3 rounded-lg space-y-2">
              {transferResult.success ? (
                <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                    <CheckCircle className="h-4 w-4" />
                    <span className="font-medium text-sm">Transfer executed successfully!</span>
                  </div>
                  
                  <div className="space-y-2 text-sm mt-2">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Transaction Hash:</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs">{formatHash(transferResult.hash || '')}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(transferResult.hash || '')}
                          className="h-6 w-6 p-0"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openExplorer(transferResult.hash || '')}
                          className="h-6 w-6 p-0"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Gas Fee:</span>
                      <span className="font-medium text-green-600 dark:text-green-400">Paid by Gas Station</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
                    <XCircle className="h-4 w-4" />
                    <span className="font-medium text-sm">Transfer failed</span>
                  </div>
                  
                  {transferResult.error && (
                    <div className="text-sm text-yellow-700 dark:text-yellow-300 mt-2">
                      {transferResult.error}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <span className="text-red-700 dark:text-red-300 text-sm">{error}</span>
            </div>
          )}

          {/* Transfer Button */}
          <Button 
            onClick={executeTransfer}
            disabled={!canTransfer}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Transferring...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Transfer
              </>
            )}
          </Button>

          {/* Info */}
          <div className="text-xs text-muted-foreground text-center">
            Gasless transaction - no APT required for gas fees.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

