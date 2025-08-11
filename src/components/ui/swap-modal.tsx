"use client";

import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { ArrowLeftRight, Loader2, Info, AlertCircle, CheckCircle, XCircle, Copy, ExternalLink, Settings } from 'lucide-react';
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
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useWalletData } from '@/contexts/WalletContext';
import { useTransactionSubmitter } from '@/lib/hooks/useTransactionSubmitter';
import { Token } from '@/lib/types/panora';
import tokenList from '@/lib/data/tokenList.json';
import { getProtocolsList } from '@/lib/protocols/getProtocolsList';

interface SwapQuote {
  amount: string;
  path: string[];
  estimatedFromAmount?: string;
  estimatedToAmount?: string;
}

interface SwapResult {
  success: boolean;
  hash?: string;
  error?: string;
  receivedAmount?: string;
  receivedSymbol?: string;
}

interface SwapModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SwapModal({ isOpen, onClose }: SwapModalProps) {
  const { tokens, address: userAddress } = useWalletData();
  const { submitTransaction, isConnected } = useTransactionSubmitter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [swapQuote, setSwapQuote] = useState<SwapQuote | null>(null);
  const [swapResult, setSwapResult] = useState<SwapResult | null>(null);
  const [quoteDebug, setQuoteDebug] = useState<any>(null);
  const [showSlippage, setShowSlippage] = useState(false);
  
  // Token selection
  const [fromToken, setFromToken] = useState<Token | null>(null);
  const [toToken, setToToken] = useState<Token | null>(null);
  const [amount, setAmount] = useState<string>('');
  const [slippage, setSlippage] = useState<number>(0.5);

  // Get Panora fee from configuration
  const panoraFee = useMemo(() => {
    const protocols = getProtocolsList();
    const panoraProtocol = protocols.find(p => p.name === 'Panora');
    const feePercentage = panoraProtocol?.panoraConfig?.integratorFeePercentage;
    return feePercentage || '0.25';
  }, []);

  // Available tokens from wallet
  const availableTokens = useMemo(() => {
    return tokens
      .map(t => {
        const tokenInfo = getTokenInfo(t.address);
        return {
          ...t,
          tokenInfo
        };
      })
      .filter(token => token.tokenInfo)
      .sort((a, b) => Number(b.amount) - Number(a.amount));
  }, [tokens]);

  // Available tokens for "To" selection
  const availableToTokens = useMemo(() => {
    const userTokens = tokens
      .map(t => {
        const tokenInfo = getTokenInfo(t.address);
        return {
          ...t,
          tokenInfo
        };
      })
      .filter(token => 
        token.tokenInfo && 
        token.tokenInfo.faAddress !== fromToken?.faAddress
      )
      .sort((a, b) => Number(b.amount) - Number(a.amount));

    // If user has tokens, return them
    if (userTokens.length > 0) {
      return userTokens;
    }

    // Otherwise return popular tokens
    const popularSymbols = ['USDt', 'USDC', 'APT', 'stAPT', 'xBTC', 'aBTC', 'wBTC', 'RION', 'THL', 'AURO'];
    return (tokenList.data.data as Token[])
      .filter(token => popularSymbols.includes(token.symbol))
      .slice(0, 10);
  }, [tokens, fromToken]);

  // Type guard to check if token has tokenInfo property
  const hasTokenInfo = (token: any): token is { tokenInfo: Token; value: number; address: string; name: string; symbol: string; decimals: number; amount: string; price: string | null } => {
    return 'tokenInfo' in token && token.tokenInfo !== undefined;
  };

  function getTokenInfo(address: string): Token | undefined {
    const norm = address.toLowerCase();
    return (tokenList.data.data as Token[]).find(token =>
      (token.tokenAddress?.toLowerCase?.() === norm) ||
      (token.faAddress?.toLowerCase?.() === norm)
    );
  }

  function normalizeAddress(address?: string) {
    return (address || '').toLowerCase();
  }

  function findTokenBalance(tokens: any[], token: Token): string {
    const tokenAddresses = [
      token.tokenAddress ?? undefined,
      token.faAddress ?? undefined,
    ].filter(Boolean).map(normalizeAddress);

    const found = tokens.find(
      t =>
        tokenAddresses.includes(normalizeAddress(t.address)) ||
        tokenAddresses.includes(normalizeAddress(t.faAddress))
    );

    return found?.amount || '0';
  }

  // Set default tokens on load
  useEffect(() => {
    if (availableTokens.length > 0 && !fromToken) {
      const firstToken = availableTokens[0];
      const token = getTokenInfo(firstToken.address);
      if (token) setFromToken(token);
    }
    
    if (availableToTokens.length > 0 && !toToken) {
      // Select second token from the list (next available)
      const secondToken = availableToTokens[1] || availableToTokens[0];
      if (hasTokenInfo(secondToken)) {
        setToToken(secondToken.tokenInfo);
      } else {
        setToToken(secondToken as Token);
      }
    }
  }, [availableTokens, availableToTokens, fromToken, toToken]);

  const getQuote = async () => {
    if (!fromToken || !toToken || !amount || parseFloat(amount) <= 0 || !userAddress) {
      setError('Please select tokens, enter amount, and connect wallet');
      return;
    }

    setLoading(true);
    setError(null);
    setSwapQuote(null);
    setQuoteDebug(null);
    setSwapResult(null); // Clear previous swap result

    // Загружаем свежие цены для выбранных токенов перед получением котировки
    try {
      const tokenAddresses = [fromToken.faAddress || fromToken.tokenAddress, toToken.faAddress || toToken.tokenAddress]
        .filter((addr): addr is string => addr !== null);
      
      // Получаем свежие цены через API Panora
      const pricesResponse = await fetch(`/api/panora/tokenPrices?chainId=1&tokenAddress=${tokenAddresses.join(',')}`);
      if (pricesResponse.ok) {
        const pricesData = await pricesResponse.json();
        console.log('Loaded fresh prices for swap tokens:', pricesData);
        
        // Обновляем цены в токенах
        if (pricesData.data?.data) {
          const freshPrices = pricesData.data.data;
          
          // Обновляем цену fromToken
          const fromTokenPrice = freshPrices.find((p: any) => 
            p.tokenAddress === fromToken.tokenAddress || p.faAddress === fromToken.faAddress
          );
          if (fromTokenPrice) {
            setFromToken(prev => prev ? { ...prev, usdPrice: fromTokenPrice.usdPrice } : null);
          }
          
          // Обновляем цену toToken
          const toTokenPrice = freshPrices.find((p: any) => 
            p.tokenAddress === toToken.tokenAddress || p.faAddress === toToken.faAddress
          );
          if (toTokenPrice) {
            setToToken(prev => prev ? { ...prev, usdPrice: toTokenPrice.usdPrice } : null);
          }
        }
      }
    } catch (priceError) {
      console.warn('Failed to refresh prices, continuing with current prices:', priceError);
    }

    try {
      const humanReadableAmount = amount;

      const response = await fetch('/api/panora/swap-quote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chainId: "1",
          fromTokenAddress: fromToken.faAddress || fromToken.tokenAddress || '',
          toTokenAddress: toToken.faAddress || toToken.tokenAddress || '',
          fromTokenAmount: humanReadableAmount,
          toWalletAddress: userAddress,
          slippagePercentage: slippage.toString(),
          getTransactionData: "transactionPayload"
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get quote');
      }

      const quoteData = await response.json();
      setQuoteDebug(quoteData);
      console.log('Panora swap quote:', quoteData);

      const quote = quoteData.quotes?.[0];
      const toTokenAmount = quote?.toTokenAmount || '0';
      
      setSwapQuote({
        amount: toTokenAmount,
        path: quoteData.route || quoteData.path || [],
        estimatedFromAmount: humanReadableAmount,
        estimatedToAmount: toTokenAmount,
      });

    } catch (error: any) {
      setError(`Quote error: ${error.message || error}`);
    } finally {
      setLoading(false);
    }
  };

  const executeSwap = async () => {
    if (!isConnected) {
      setError('Wallet not connected. Please connect your wallet first.');
      return;
    }

    if (!fromToken || !toToken || !amount || !swapQuote || !userAddress || !quoteDebug) {
      const missing = [];
      if (!fromToken) missing.push('fromToken');
      if (!toToken) missing.push('toToken');
      if (!amount) missing.push('amount');
      if (!swapQuote) missing.push('swapQuote');
      if (!userAddress) missing.push('userAddress');
      if (!quoteDebug) missing.push('quoteDebug');
      
      setError(`Missing required data for swap: ${missing.join(', ')}`);
      return;
    }

    setLoading(true);
    setError(null);
    setSwapResult(null);

    try {
      const requestBody = {
        quoteData: quoteDebug,
        walletAddress: userAddress
      };

      const response = await fetch('/api/panora/execute-swap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to execute swap');
      }

      const swapData = await response.json();
      
      if (swapData.error) {
        throw new Error(swapData.error);
      }

      if (swapData && !swapData.error) {
        try {
          const txPayload = swapData;
          
          console.log('Transaction payload received:', txPayload);
          console.log('Function:', txPayload.function);
          console.log('Type arguments:', txPayload.type_arguments);
          console.log('Arguments:', txPayload.arguments);
          
          if (!txPayload.function || !txPayload.type_arguments || !txPayload.arguments) {
            console.error('Missing required fields in payload:', {
              function: !!txPayload.function,
              type_arguments: !!txPayload.type_arguments,
              arguments: !!txPayload.arguments
            });
            throw new Error('Invalid transaction payload structure');
          }
          
          // Ensure arguments is an array
          if (!Array.isArray(txPayload.arguments)) {
            console.error('Arguments is not an array:', txPayload.arguments);
            throw new Error('Transaction payload arguments must be an array');
          }
          
          const typeArguments = Array.isArray(txPayload.type_arguments) ? txPayload.type_arguments : [];
          const functionArguments = txPayload.arguments;
          
          console.log('Processed type arguments:', typeArguments);
          console.log('Function arguments (as is):', functionArguments);
          
          console.log('Executing swap via unified transaction submitter...');
          
          // Use the unified transaction submitter which handles gasless transactions automatically
          const tx = await submitTransaction({
            data: {
              function: txPayload.function,
              typeArguments: typeArguments,
              functionArguments: functionArguments
            },
            options: {
              maxGasAmount: 20000,
            }
          });
          
          setSwapResult({
            success: true,
            hash: tx.hash || 'Transaction submitted successfully',
            receivedAmount: quoteDebug?.quotes?.[0]?.toTokenAmount || swapQuote.amount,
            receivedSymbol: toToken.symbol,
          });
        } catch (walletError: any) {
          let errorMessage = 'Failed to sign transaction';
          if (walletError.message) {
            errorMessage = walletError.message;
          } else if (walletError.name === 'PetraApiError') {
            errorMessage = 'Petra wallet error. Please check your wallet connection and try again.';
          } else if (walletError.code === 'USER_REJECTED') {
            errorMessage = 'Transaction was rejected by user.';
          } else if (walletError.code === 'WALLET_NOT_CONNECTED') {
            errorMessage = 'Wallet not connected. Please connect your wallet first.';
          } else if (walletError.code === 'WALLET_LOCKED') {
            errorMessage = 'Wallet is locked. Please unlock your wallet and try again.';
          }
          
          setSwapResult({
            success: false,
            error: errorMessage,
          });
        }
      } else {
        setSwapResult({
          success: false,
          error: swapData.error || 'Failed to build transaction',
        });
      }

    } catch (error: any) {
      const errorMessage = error.message || error;
      if (errorMessage.includes('E_OUTPUT_LESS_THAN_MINIMUM') || errorMessage.includes('TRY_INCREASING_SLIPPAGE')) {
        setSwapResult({
          success: false,
          error: `Slippage too low. Try increasing slippage from ${slippage}% to ${Math.min(slippage + 1, 5)}% or higher. Error: ${errorMessage}`,
        });
      } else {
        setSwapResult({
          success: false,
          error: errorMessage,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number | string) => {
    return Number(num).toLocaleString('en-US', { maximumFractionDigits: 2 });
  };

  const formatUSD = (num: number | string) => {
    return Number(num).toLocaleString('en-US', { 
      style: 'currency', 
      currency: 'USD',
      maximumFractionDigits: 2 
    });
  };

  const getTokenBalance = (token: Token) => {
    const balance = findTokenBalance(tokens, token);
    const humanBalance = Number(balance) / Math.pow(10, token.decimals);
    return { balance: humanBalance };
  };

  const getHumanAmount = (raw: string | undefined, decimals: number | undefined) => {
    if (!raw || !decimals) return 0;
    return Number(raw) / Math.pow(10, decimals);
  };



  const formatHash = (hash: string) => {
    if (hash.length <= 12) return hash;
    return `${hash.slice(0, 6)}...${hash.slice(-6)}`;
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // Можно добавить toast уведомление здесь
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const openExplorer = (hash: string) => {
    const explorerUrl = `https://explorer.aptoslabs.com/txn/${hash}?network=mainnet`;
    window.open(explorerUrl, '_blank');
  };

  const swapTokens = () => {
    if (fromToken && toToken) {
      setFromToken(toToken);
      setToToken(fromToken);
      
      // Если есть quote, используем количество получаемых токенов как новое количество
      if (swapQuote && quoteDebug?.quotes?.[0]?.toTokenAmount) {
        setAmount(quoteDebug.quotes[0].toTokenAmount);
      } else {
        setAmount('');
      }
      
      setSwapQuote(null);
      setQuoteDebug(null);
      setError(null);
      setSwapResult(null); // Clear swap result when swapping tokens
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] p-6 rounded-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Image 
              src="/logo.png" 
              alt="Panora" 
              width={24} 
              height={24} 
              className="rounded-full"
            />
            <DialogTitle>Gasless Swap Tokens</DialogTitle>
          </div>
          <div className="flex items-center justify-between">
            <DialogDescription>
              Swap tokens using Panora DEX aggregator with gasless transactions
            </DialogDescription>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSlippage(!showSlippage)}
              className="h-8 w-8 p-0"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-3">
          {/* From Token and Amount - Horizontal Layout */}
          <div className="grid grid-cols-2 gap-3">
            {/* From Token */}
            <div className="col-span-1 space-y-1">
              <Label className="text-xs">From Token</Label>
              <Select
                value={fromToken?.faAddress || fromToken?.tokenAddress || ''}
                onValueChange={(value) => {
                  const token = getTokenInfo(value);
                  if (token) {
                    setFromToken(token);
                    // Сбрасываем quote при смене токена
                    setSwapQuote(null);
                    setQuoteDebug(null);
                    setError(null);
                    setSwapResult(null); // Clear swap result when changing token
                  }
                }}
              >
                <SelectTrigger className="h-9">
                  <SelectValue>
                    {fromToken ? (
                      <div className="flex items-center gap-2">
                        <Image
                          src={fromToken.logoUrl || '/file.svg'}
                          alt={fromToken.symbol}
                          width={16}
                          height={16}
                          className="rounded-full"
                        />
                        <span className="text-sm">{fromToken.symbol}</span>
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
                      const balance = getTokenBalance(tokenInfo);
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
                              <span className="text-sm">{tokenInfo.symbol} </span>
                            </div>
                                                         <div className="text-xs text-muted-foreground">
                               {formatNumber(balance.balance)} {tokenInfo.symbol}
                             </div>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </div>
                </SelectContent>
              </Select>
              
                             {fromToken && (
                 <div className="text-xs text-muted-foreground">
                   Balance: {formatNumber(getTokenBalance(fromToken).balance)} {fromToken.symbol}
                 </div>
               )}
            </div>

            {/* Amount Input */}
            <div className="space-y-1">
              <Label className="text-xs">Amount</Label>
              <div className="space-y-1">
                <Input
                  type="number"
                  placeholder="0.0"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setSwapResult(null); // Clear swap result when changing amount
                  }}
                  className="h-9 text-sm"
                />
                
              </div>
              {fromToken && (
                <div className="flex gap-1">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                      const balance = getTokenBalance(fromToken);
                      setAmount((balance.balance * 0.5).toString());
                    }}
                    className="h-6 text-xs px-2"
                  >
                    Half
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                      const balance = getTokenBalance(fromToken);
                      setAmount(balance.balance.toString());
                    }}
                    className="h-6 text-xs px-2"
                  >
                    Max
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Swap Direction */}
          <div className="flex justify-center items-center py-2">
            <button
              onClick={swapTokens}
              className="p-2 bg-muted rounded-full hover:bg-muted/80 transition-colors cursor-pointer border border-border flex items-center justify-center"
              disabled={!fromToken || !toToken}
            >
              <ArrowLeftRight className="h-4 w-4" />
            </button>
          </div>

          {/* To Token - Full Width with Receive Amount */}
          <div className="space-y-1">
            <Label className="text-xs">To Token</Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-1">
                <Select
                  value={toToken?.faAddress || toToken?.tokenAddress || ''}
                  onValueChange={(value) => {
                    const token = getTokenInfo(value);
                    if (token) {
                      setToToken(token);
                      // Сбрасываем quote при смене токена
                      setSwapQuote(null);
                      setQuoteDebug(null);
                      setError(null);
                      setSwapResult(null); // Clear swap result when changing token
                    }
                  }}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue>
                      {toToken ? (
                        <div className="flex items-center gap-2">
                          <Image
                            src={toToken.logoUrl || '/file.svg'}
                            alt={toToken.symbol}
                            width={16}
                            height={16}
                            className="rounded-full"
                          />
                          <span className="text-sm">{toToken.symbol}</span>
                        </div>
                      ) : (
                        <span className="text-sm">Select token</span>
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <div className="p-2">
                      {availableToTokens.length > 0 && hasTokenInfo(availableToTokens[0]) ? (
                        <>
                          <div className="text-sm font-medium mb-2">Your Tokens</div>
                          {availableToTokens.map((token) => {
                            if (!hasTokenInfo(token)) return null;
                            const tokenInfo = token.tokenInfo;
                            const balance = getTokenBalance(tokenInfo);
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
                                    <span className="text-sm">{tokenInfo.symbol} </span>
                                  </div>
                                                               <div className="text-xs text-muted-foreground">
                               {formatNumber(balance.balance)} {tokenInfo.symbol}
                             </div>
                                </div>
                              </SelectItem>
                            );
                          })}
                        </>
                      ) : (
                        <>
                          <div className="text-sm font-medium mb-2">Popular Tokens</div>
                          {availableToTokens.map((token) => {
                            const tokenData = token as Token;
                            return (
                              <SelectItem
                                key={tokenData.faAddress || tokenData.tokenAddress || ''}
                                value={tokenData.faAddress || tokenData.tokenAddress || ''}
                              >
                                <div className="flex items-center gap-2">
                                  <Image
                                    src={tokenData.logoUrl || '/file.svg'}
                                    alt={tokenData.symbol}
                                    width={16}
                                    height={16}
                                    className="rounded-full"
                                  />
                                                                     <span className="text-sm">{tokenData.symbol}</span>
                                </div>
                              </SelectItem>
                            );
                          })}
                        </>
                      )}
                    </div>
                  </SelectContent>
                </Select>
              </div>
              
              {/* You Receive Amount */}
              {swapQuote && toToken && (
                <div className="flex flex-col justify-center">
                  <div className="text-xs text-muted-foreground">You Receive:</div>
                  <div className="text-sm font-medium">
                    {quoteDebug?.quotes?.[0]?.toTokenAmount || swapQuote.estimatedToAmount || swapQuote.amount} {toToken.symbol}
                  </div>
                  {quoteDebug?.quotes?.[0]?.toTokenAmountUSD && parseFloat(quoteDebug.quotes[0].toTokenAmountUSD) > 0 && (
                    <div className="text-xs text-muted-foreground">
                      {formatUSD(parseFloat(quoteDebug.quotes[0].toTokenAmountUSD))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Slippage Settings - Only shown when settings are opened */}
          {showSlippage && (
            <div className="space-y-1">
              <Label className="text-xs">Slippage</Label>
              <Select value={slippage.toString()} onValueChange={(value) => {
                setSlippage(Number(value));
                setSwapResult(null); // Clear swap result when changing slippage
              }}>
                <SelectTrigger className="h-9">
                  <SelectValue className="text-sm">{slippage}%</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0.5">0.5%</SelectItem>
                  <SelectItem value="1.0">1.0%</SelectItem>
                  <SelectItem value="2.0">2.0%</SelectItem>
                  <SelectItem value="5.0">5.0%</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Quote Results - Simplified */}
          {swapQuote && (
            <div className="p-3 bg-muted rounded-lg space-y-2">
              <div className="flex items-center gap-2">
                <Info className="h-3 w-3" />
                <span className="font-medium text-sm">Swap Details</span>
              </div>
              <div className="text-xs text-muted-foreground grid grid-cols-2 gap-2">
                <div>Slippage: {slippage}%</div>
                <div>Fee: {panoraFee}%</div>
                {quoteDebug?.quotes?.[0]?.minToTokenAmount && (
                  <div>Min Received: {quoteDebug.quotes[0].minToTokenAmount} {toToken?.symbol}</div>
                )}
                {quoteDebug?.quotes?.[0]?.priceImpact && (
                  <div>Price Impact: {quoteDebug.quotes[0].priceImpact}%</div>
                )}
              </div>
            </div>
          )}

          {/* Swap Result */}
          {swapResult && (
            <div className="p-3 rounded-lg space-y-2">
              {swapResult.success ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    <span className="font-medium text-sm">Gasless swap executed successfully!</span>
                  </div>
                  
                  <div className="space-y-2 text-sm mt-2">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Transaction Hash:</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs">{formatHash(swapResult.hash || '')}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(swapResult.hash || '')}
                          className="h-6 w-6 p-0"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openExplorer(swapResult.hash || '')}
                          className="h-6 w-6 p-0"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Gas Fee:</span>
                      <span className="font-medium text-green-600">Paid by Gas Station</span>
                    </div>
                    
                    {swapResult.receivedAmount && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Received:</span>
                        <span className="font-medium">
                          {formatNumber(swapResult.receivedAmount)} {swapResult.receivedSymbol}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-red-600">
                    <XCircle className="h-4 w-4" />
                    <span className="font-medium text-sm">Swap failed</span>
                  </div>
                  
                  {swapResult.error && (
                    <div className="text-sm text-red-700 mt-2">{swapResult.error}</div>
                  )}
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <span className="text-red-700 text-sm">{error}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button 
              onClick={getQuote} 
              disabled={loading || !fromToken || !toToken || !amount}
              className="flex-1"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Getting Quote...
                </>
              ) : (
                'Get Quote'
              )}
            </Button>
            
            <Button 
              onClick={executeSwap} 
              disabled={loading || !swapQuote}
              variant="default"
              className="flex-1"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Executing...
                </>
              ) : (
                'Execute Swap'
              )}
            </Button>
          </div>

          {/* Fee Information */}
          <div className="text-xs text-muted-foreground text-center">
            Gasless transaction - no APT required for gas fees. {panoraFee}% swap fee applies.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 