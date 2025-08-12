'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { isUserRejectedError } from '@/lib/utils/errors';

// Add Aptos wallet types
declare global {
  interface Window {
    aptos?: {
      signAndSubmitTransaction: (payload: any) => Promise<{ hash: string }>;
      account: () => Promise<{ address: string }>;
    };
  }
}
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ArrowLeftRight, Info, AlertCircle, CheckCircle, XCircle, ArrowLeft } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useWalletData } from '@/contexts/WalletContext';
import tokenList from '@/lib/data/tokenList.json';
import { Token } from '@/lib/types/panora';

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

export default function TestPanoraPage() {
  const { tokens, address: userAddress } = useWalletData();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [swapQuote, setSwapQuote] = useState<SwapQuote | null>(null);
  const [swapResult, setSwapResult] = useState<SwapResult | null>(null);
  const [quoteDebug, setQuoteDebug] = useState<any>(null);
  
  // Token selection
  const [fromToken, setFromToken] = useState<Token | null>(null);
  const [toToken, setToToken] = useState<Token | null>(null);
  const [amount, setAmount] = useState<string>('');
  const [slippage, setSlippage] = useState<number>(2.0); // 2% - increased for better success rate
  
  // Available tokens from wallet
  const availableTokens = useMemo(() => {
    return tokens
      .map(t => {
        const tokenInfo = getTokenInfo(t.address);
        return {
          ...t,
          tokenInfo,
          value: tokenInfo
            ? (Number(t.amount) / Math.pow(10, tokenInfo.decimals)) * (Number(tokenInfo.usdPrice) || 0)
            : 0
        };
      })
      .filter(token => token.value > 0 && token.tokenInfo)
      .sort((a, b) => b.value - a.value);
  }, [tokens]);

  // Popular tokens for quick selection
  const popularTokens = useMemo(() => {
    const popular = ['APT', 'USDC', 'USDt', 'WBTC', 'ECHO', 'MKL', 'AMI'];
    return (tokenList.data.data as Token[])
      .filter(token => popular.includes(token.symbol))
      .slice(0, 10);
  }, []);

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
    
    if (popularTokens.length > 0 && !toToken) {
      // Set USDC as default to token if available
      const usdc = popularTokens.find(t => t.symbol === 'USDC');
      if (usdc) {
        setToToken(usdc);
      } else if (popularTokens.length > 0) {
        setToToken(popularTokens[0]);
      }
    }
  }, [availableTokens, popularTokens, fromToken, toToken]);

  const getQuote = async () => {
    if (!fromToken || !toToken || !amount || parseFloat(amount) <= 0 || !userAddress) {
      setError('Please select tokens, enter amount, and connect wallet');
      return;
    }

    setLoading(true);
    setError(null);
    setSwapQuote(null);
    setQuoteDebug(null);

    try {
      // Panora API expects human-readable amounts (e.g., "1" for 1 APT, not minimal units)
      const humanReadableAmount = amount;

      // Get quote using Panora API endpoint
      const response = await fetch('/api/panora/swap-quote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chainId: 1, // Aptos mainnet
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

      // Extract relevant data from Panora response
      // The API returns data in quotes array
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
    console.log('executeSwap called');
    console.log('fromToken:', fromToken);
    console.log('toToken:', toToken);
    console.log('amount:', amount);
    console.log('swapQuote:', swapQuote);
    console.log('userAddress:', userAddress);
    console.log('quoteDebug:', quoteDebug);

    // Check wallet connection first
    if (typeof window === 'undefined' || !window.aptos) {
      setError('Aptos wallet not available. Please install Petra or Martian wallet.');
      return;
    }

    try {
      // Check if wallet is connected
      const account = await window.aptos.account();
      console.log('Connected account:', account);
      
      if (!account.address) {
        setError('Wallet not connected. Please connect your wallet first.');
        return;
      }
    } catch (walletError: any) {
      console.error('Wallet connection error:', walletError);
      setError('Failed to connect to wallet. Please check your wallet connection.');
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
      console.log('Sending swap request...');
      const requestBody = {
        quoteData: quoteDebug,
        walletAddress: userAddress
      };
      console.log('Request body:', requestBody);

      // Build transaction using Panora API endpoint
      const response = await fetch('/api/panora/execute-swap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('API Error:', errorData);
        throw new Error(errorData.error || 'Failed to execute swap');
      }

      const swapData = await response.json();
      console.log('Swap response:', swapData);
      
      // Check if the response contains an error
      if (swapData.error) {
        throw new Error(swapData.error);
      }
      
      // Also log to browser console for debugging
      console.log('=== SWAP EXECUTION DEBUG ===');
      console.log('Request sent to server');
      console.log('Response received:', swapData);

      // Sign and submit transaction using Aptos wallet
      if (swapData && !swapData.error) {
        console.log('Signing transaction with Aptos wallet...');
        
        try {
          // Check if Aptos wallet is available
          if (typeof window !== 'undefined' && window.aptos) {
            // 1) Take payload from server/Panora as-is
            const txPayload =
              quoteDebug?.transactionPayload ??
              quoteDebug?.quotes?.[0]?.txData ??
              swapData?.transactionPayload ??
              swapData?.txData ?? swapData;

            // 2) Validate minimal structure only; do not mutate args
            if (!txPayload?.function || !Array.isArray(txPayload?.type_arguments) || !Array.isArray(txPayload?.arguments)) {
              console.error('Invalid transaction payload from server/Panora:', txPayload);
              throw new Error('Invalid transaction payload from server/Panora');
            }

            console.log('Transaction payload (as-is) for signing:', txPayload);
            console.log('TX args preview:', txPayload.arguments);
            
            // Sign and submit transaction
            console.log('Sending transaction to wallet for signing...');
            
            // Use the new wallet format as recommended by the warning
            let tx;
            try {
              // New format: { payload }
              tx = await window.aptos.signAndSubmitTransaction({
                payload: {
                  type: "entry_function_payload",
                  function: txPayload.function,
                  type_arguments: txPayload.type_arguments,
                  arguments: txPayload.arguments
                }
              });
            } catch (newFormatError) {
              console.log('New format failed, trying legacy format:', newFormatError);
              try {
                // Legacy format: direct payload
                tx = await window.aptos.signAndSubmitTransaction({
                  type: "entry_function_payload",
                  function: txPayload.function,
                  type_arguments: txPayload.type_arguments,
                  arguments: txPayload.arguments
                });
              } catch (legacyFormatError) {
                console.log('Legacy format failed, trying data wrapper:', legacyFormatError);
                // Data wrapper format
                tx = await window.aptos.signAndSubmitTransaction({
                  data: {
                    function: txPayload.function,
                    typeArguments: txPayload.type_arguments,
                    functionArguments: txPayload.arguments
                  },
                  options: {
                    maxGasAmount: 20000,
                  }
                });
              }
            }
            console.log('Transaction signed and submitted:', tx);
            
            setSwapResult({
              success: true,
              hash: tx.hash || 'Transaction submitted successfully',
              receivedAmount: quoteDebug?.quotes?.[0]?.toTokenAmount || swapQuote.amount,
              receivedSymbol: toToken.symbol,
            });
          } else {
            console.error('Aptos wallet not available');
            setSwapResult({
              success: false,
              error: 'Aptos wallet not available. Please install Petra or Martian wallet.',
            });
          }
        } catch (walletError: any) {
          console.error('Wallet signing error:', walletError);
          console.error('Error details:', {
            name: walletError.name,
            message: walletError.message,
            stack: walletError.stack,
            code: walletError.code
          });
          
          let errorMessage = 'Failed to sign transaction';
          if (walletError.message) {
            errorMessage = walletError.message;
          } else if (walletError.name === 'PetraApiError') {
            errorMessage = 'Petra wallet error. Please check your wallet connection and try again.';
          } else if (isUserRejectedError(walletError)) {
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
      console.error('Execute swap error:', error);
      console.log('=== SWAP ERROR DEBUG ===');
      console.log('Error details:', error);
      
      // Check if it's a slippage error and suggest increasing it
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
    return Number(num).toLocaleString('en-US', { maximumFractionDigits: 6 });
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
    const usdValue = humanBalance * (Number(token.usdPrice) || 0);
    return { balance: humanBalance, usdValue };
  };

  // Получить human readable amount для получаемого токена
  const getHumanAmount = (raw: string | undefined, decimals: number | undefined) => {
    if (!raw || !decimals) return 0;
    return Number(raw) / Math.pow(10, decimals);
  };

  // Получить цену токена (USD) с учётом decimals
  const getTokenPrice = (token: Token | null) => {
    if (!token || !token.usdPrice) return 0;
    return Number(token.usdPrice);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/test">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Tests
          </Button>
        </Link>
      </div>
      
      <div>
        <h1 className="text-3xl font-bold mb-2">Test Panora Swap</h1>
        <p className="text-muted-foreground">
          Test swap functionality using Panora SDK. This is a testing interface for development purposes.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Swap Interface */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Image 
                src="/public/logo.png" 
                alt="Panora" 
                width={24} 
                height={24} 
                className="rounded-full"
              />
              Panora Swap Interface
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* From Token */}
            <div className="space-y-2">
              <Label>From Token</Label>
              <Select
                value={fromToken?.faAddress || fromToken?.tokenAddress || ''}
                onValueChange={(value) => {
                  const token = getTokenInfo(value);
                  if (token) setFromToken(token);
                }}
              >
                <SelectTrigger>
                  <SelectValue>
                    {fromToken ? (
                      <div className="flex items-center gap-2">
                        <Image
                          src={fromToken.logoUrl || '/file.svg'}
                          alt={fromToken.symbol}
                          width={20}
                          height={20}
                          className="rounded-full"
                        />
                        <span>{fromToken.symbol}</span>
                        {fromToken.usdPrice && (
                          <Badge variant="secondary">
                            {formatUSD(fromToken.usdPrice)}
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <span>Select token</span>
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
                              <span>{tokenInfo.symbol}</span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {getHumanAmount(balance.balance.toString(), tokenInfo.decimals)} (${formatNumber(getHumanAmount(balance.balance.toString(), tokenInfo.decimals) * getTokenPrice(tokenInfo))})
                            </div>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </div>
                </SelectContent>
              </Select>
              
              {fromToken && (
                <div className="text-sm text-muted-foreground">
                  Balance: {getHumanAmount(getTokenBalance(fromToken).balance.toString(), fromToken.decimals)} {fromToken.symbol}
                  {' '}({formatUSD(getHumanAmount(getTokenBalance(fromToken).balance.toString(), fromToken.decimals) * getTokenPrice(fromToken))})
                </div>
              )}
            </div>

            {/* Amount Input */}
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input
                type="number"
                placeholder="0.0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="text-lg"
              />
              {fromToken && (
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                      const balance = getTokenBalance(fromToken);
                      setAmount((balance.balance * 0.5).toString());
                    }}
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
                  >
                    Max
                  </Button>
                </div>
              )}
            </div>

            {/* Swap Direction */}
            <div className="flex justify-center">
              <div className="p-2 bg-muted rounded-full">
                <ArrowLeftRight className="h-4 w-4" />
              </div>
            </div>

            {/* To Token */}
            <div className="space-y-2">
              <Label>To Token</Label>
              <Select
                value={toToken?.faAddress || toToken?.tokenAddress || ''}
                onValueChange={(value) => {
                  const token = getTokenInfo(value);
                  if (token) setToToken(token);
                }}
              >
                <SelectTrigger>
                  <SelectValue>
                    {toToken ? (
                      <div className="flex items-center gap-2">
                        <Image
                          src={toToken.logoUrl || '/file.svg'}
                          alt={toToken.symbol}
                          width={20}
                          height={20}
                          className="rounded-full"
                        />
                        <span>{toToken.symbol}</span>
                        {toToken.usdPrice && (
                          <Badge variant="secondary">
                            {formatUSD(toToken.usdPrice)}
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <span>Select token</span>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <div className="p-2">
                    <div className="text-sm font-medium mb-2">Popular Tokens</div>
                    {popularTokens.map((token) => (
                      <SelectItem
                        key={token.faAddress || token.tokenAddress || ''}
                        value={token.faAddress || token.tokenAddress || ''}
                      >
                        <div className="flex items-center gap-2">
                          <Image
                            src={token.logoUrl || '/file.svg'}
                            alt={token.symbol}
                            width={16}
                            height={16}
                            className="rounded-full"
                          />
                          <span>{token.symbol}</span>
                          {token.usdPrice && (
                            <span className="text-xs text-muted-foreground">
                              {formatUSD(token.usdPrice)}
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </div>
                </SelectContent>
              </Select>
            </div>

            {/* Slippage */}
            <div className="space-y-2">
              <Label>Slippage Tolerance</Label>
              <Select value={slippage.toString()} onValueChange={(value) => setSlippage(Number(value))}>
                <SelectTrigger>
                  <SelectValue>{slippage}%</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0.5">0.5%</SelectItem>
                  <SelectItem value="1.0">1.0%</SelectItem>
                  <SelectItem value="2.0">2.0%</SelectItem>
                  <SelectItem value="5.0">5.0%</SelectItem>
                </SelectContent>
              </Select>
            </div>

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
                onClick={() => {
                  console.log('Execute Swap button clicked!');
                  executeSwap();
                }} 
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

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="h-4 w-4 text-red-500" />
                <span className="text-red-700 text-sm">{error}</span>
              </div>
            )}
            

          </CardContent>
        </Card>

        {/* Results Panel */}
        <div className="space-y-6">
          {/* Quote Results */}
          {swapQuote && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="h-5 w-5" />
                  Swap Quote
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">You Pay:</span>
                  <div className="text-right">
                    <div className="font-medium">{amount} {fromToken?.symbol}</div>
                    {quoteDebug?.fromTokenAmountUSD && (
                      <div className="text-sm text-muted-foreground">
                        {formatUSD(parseFloat(quoteDebug.fromTokenAmountUSD))}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">You Receive:</span>
                  <div className="text-right">
                    <div className="font-medium">
                      {quoteDebug?.quotes?.[0]?.toTokenAmount || swapQuote.estimatedToAmount || swapQuote.amount} {toToken?.symbol}
                    </div>
                    {quoteDebug?.quotes?.[0]?.toTokenAmountUSD && parseFloat(quoteDebug.quotes[0].toTokenAmountUSD) > 0 && (
                      <div className="text-sm text-muted-foreground">
                        {formatUSD(parseFloat(quoteDebug.quotes[0].toTokenAmountUSD))}
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                <div className="text-xs text-muted-foreground">
                  <div>Slippage: {slippage}%</div>
                  {quoteDebug?.quotes?.[0]?.minToTokenAmount && (
                    <div>Min Received: {quoteDebug.quotes[0].minToTokenAmount} {toToken?.symbol}</div>
                  )}
                  {quoteDebug?.quotes?.[0]?.priceImpact && (
                    <div>Price Impact: {quoteDebug.quotes[0].priceImpact}%</div>
                  )}
                  {quoteDebug?.quotes?.[0]?.feeAmountUSD && parseFloat(quoteDebug.quotes[0].feeAmountUSD) > 0 && (
                    <div>Fee: ${parseFloat(quoteDebug.quotes[0].feeAmountUSD).toFixed(6)}</div>
                  )}
                </div>

                {/* Debug info */}
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                  <div className="font-bold text-yellow-700 mb-2">Debug Info (Panora API):</div>
                  <div className="text-xs text-yellow-900 whitespace-pre-wrap break-all">
                    <div>Panora Quote Response: {JSON.stringify(quoteDebug, null, 2)}</div>
                    <div className="mt-2">
                      <div>toTokenAmountUSD: {quoteDebug?.quotes?.[0]?.toTokenAmountUSD}</div>
                      <div>Parsed value: {quoteDebug?.quotes?.[0]?.toTokenAmountUSD ? parseFloat(quoteDebug.quotes[0].toTokenAmountUSD) : 'undefined'}</div>
                      <div>Formatted USD: {quoteDebug?.quotes?.[0]?.toTokenAmountUSD ? formatUSD(parseFloat(quoteDebug.quotes[0].toTokenAmountUSD)) : 'undefined'}</div>
                      <div className="mt-2">
                        <div><strong>Swap Details:</strong></div>
                        <div>From: {quoteDebug?.fromToken?.address} ({quoteDebug?.fromTokenAmount} tokens)</div>
                        <div>To: {quoteDebug?.toToken?.address} ({quoteDebug?.quotes?.[0]?.toTokenAmount} tokens)</div>
                        <div>Price Impact: {quoteDebug?.quotes?.[0]?.priceImpact}%</div>
                        <div>Min Received: {quoteDebug?.quotes?.[0]?.minToTokenAmount}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Swap Result */}
          {swapResult && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {swapResult.success ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500" />
                  )}
                  Swap Result
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {swapResult.success ? (
                  <>
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle className="h-4 w-4" />
                      <span className="font-medium">Swap executed successfully!</span>
                    </div>
                    
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Transaction Hash:</span>
                        <span className="font-mono text-xs">{swapResult.hash}</span>
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
                  </>
                ) : (
                  <div className="flex items-center gap-2 text-red-600">
                    <XCircle className="h-4 w-4" />
                    <span className="font-medium">Swap failed</span>
                  </div>
                )}
                
                {swapResult.error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="text-sm text-red-700">{swapResult.error}</div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Info Panel */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5" />
                Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div>
                <strong>This is a test interface</strong> for development and testing purposes.
                Real transactions are not executed in this mode.
              </div>
              
              <div>
                <strong>Panora Protocol:</strong> A cross-chain DEX aggregator providing efficient token swaps
                with competitive pricing across multiple blockchains including Aptos.
              </div>
              
              <div>
                <strong>Features:</strong>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li>Multi-hop routing for best prices</li>
                  <li>Low slippage and fees</li>
                  <li>Real-time price quotes</li>
                  <li>Safe transaction execution</li>
                </ul>
              </div>

              {userAddress && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="text-sm">
                    <strong>Connected Wallet:</strong>
                    <div className="font-mono text-xs mt-1">{userAddress}</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
} 