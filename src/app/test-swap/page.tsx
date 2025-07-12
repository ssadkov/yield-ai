'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
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
import { HyperionSwapService } from '@/lib/services/protocols/hyperion/swap';
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

export default function TestSwapPage() {
  const { tokens, address: userAddress } = useWalletData();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [swapQuote, setSwapQuote] = useState<SwapQuote | null>(null);
  const [swapResult, setSwapResult] = useState<SwapResult | null>(null);
  const [quoteDebug, setQuoteDebug] = useState<any>(null);
  const [reverseQuoteDebug, setReverseQuoteDebug] = useState<any>(null);
  
  // Token selection
  const [fromToken, setFromToken] = useState<Token | null>(null);
  const [toToken, setToToken] = useState<Token | null>(null);
  const [amount, setAmount] = useState<string>('');
  const [slippage, setSlippage] = useState<number>(1.0); // 1%
  
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
    if (!fromToken || !toToken || !amount || parseFloat(amount) <= 0) {
      setError('Please select tokens and enter amount');
      return;
    }

    setLoading(true);
    setError(null);
    setSwapQuote(null);
    setQuoteDebug(null);
    setReverseQuoteDebug(null);

    try {
      const swapService = HyperionSwapService.getInstance();
      const amountInMinimalUnits = Math.floor(parseFloat(amount) * Math.pow(10, fromToken.decimals));

      // Get quote
      const quote = await swapService.estToAmount({
        amount: amountInMinimalUnits,
        from: fromToken.faAddress || fromToken.tokenAddress || '',
        to: toToken.faAddress || toToken.tokenAddress || '',
        safeMode: true,
      });
      setQuoteDebug(quote);
      console.log('Hyperion estToAmount quote:', quote);

      // Get reverse quote for better estimation
      const reverseQuote = await swapService.estFromAmount({
        amount: amountInMinimalUnits,
        from: fromToken.faAddress || fromToken.tokenAddress || '',
        to: toToken.faAddress || toToken.tokenAddress || '',
        safeMode: true,
      });
      setReverseQuoteDebug(reverseQuote);
      console.log('Hyperion estFromAmount reverseQuote:', reverseQuote);

      setSwapQuote({
        amount: quote.amountOut || '0',
        path: quote.path || [],
        estimatedFromAmount: reverseQuote.amountIn,
        estimatedToAmount: quote.amountOut,
      });

    } catch (error: any) {
      setError(`Quote error: ${error.message || error}`);
    } finally {
      setLoading(false);
    }
  };

  const executeSwap = async () => {
    if (!fromToken || !toToken || !amount || !swapQuote || !userAddress) {
      setError('Missing required data for swap');
      return;
    }

    setLoading(true);
    setError(null);
    setSwapResult(null);

    try {
      const swapService = HyperionSwapService.getInstance();
      const amountInMinimalUnits = Math.floor(parseFloat(amount) * Math.pow(10, fromToken.decimals));
      
      // Calculate minimum amount out with slippage
      const minAmountOut = Math.floor(parseFloat(swapQuote.amount) * (1 - slippage / 100));

      // Get swap payload
      const payload = await swapService.getSwapPayload({
        currencyA: fromToken.faAddress || fromToken.tokenAddress || '',
        currencyB: toToken.faAddress || toToken.tokenAddress || '',
        currencyAAmount: amountInMinimalUnits.toString(),
        currencyBAmount: minAmountOut.toString(),
        slippage: slippage / 100,
        poolRoute: swapQuote.path,
        recipient: userAddress,
      });

      // For testing, we'll just simulate the transaction
      // In real implementation, you would use wallet.signAndSubmitTransaction
      setSwapResult({
        success: true,
        hash: '0x' + Math.random().toString(16).substr(2, 64),
        receivedAmount: swapQuote.amount,
        receivedSymbol: toToken.symbol,
      });

    } catch (error: any) {
      setSwapResult({
        success: false,
        error: error.message || error,
      });
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
        <h1 className="text-3xl font-bold mb-2">Test Hyperion Swap</h1>
        <p className="text-muted-foreground">
          Test swap functionality using Hyperion protocol. This is a testing interface for development purposes.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Swap Interface */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Image 
                src="/public/logo.png" 
                alt="Hyperion" 
                width={24} 
                height={24} 
                className="rounded-full"
              />
              Swap Interface
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
                    <div className="font-medium">{getHumanAmount(amount, fromToken?.decimals)} {fromToken?.symbol}</div>
                    {fromToken?.usdPrice && (
                      <div className="text-sm text-muted-foreground">
                        {formatUSD(getHumanAmount(amount, fromToken?.decimals) * getTokenPrice(fromToken))}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">You Receive:</span>
                  <div className="text-right">
                    <div className="font-medium">
                      {getHumanAmount(swapQuote.estimatedToAmount || swapQuote.amount, toToken?.decimals)} {toToken?.symbol}
                    </div>
                    {toToken?.usdPrice && (
                      <div className="text-sm text-muted-foreground">
                        {formatUSD(getHumanAmount(swapQuote.estimatedToAmount || swapQuote.amount, toToken?.decimals) * getTokenPrice(toToken))}
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                <div className="text-xs text-muted-foreground">
                  <div>Swap Path: {swapQuote.path.join(' → ')}</div>
                  <div>Slippage: {slippage}%</div>
                  <div>Min Received: {getHumanAmount(swapQuote.estimatedToAmount || swapQuote.amount, toToken?.decimals) * (1 - slippage / 100)} {toToken?.symbol}</div>
                </div>

                {/* Debug info if amount is 0 */}
                {((swapQuote.amount === '0' || swapQuote.estimatedToAmount === '0') || error) && (
                  <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                    <div className="font-bold text-yellow-700 mb-2">Debug Info (Hyperion API):</div>
                    <div className="text-xs text-yellow-900 whitespace-pre-wrap break-all">
                      <div>estToAmount (quote): {JSON.stringify(quoteDebug, null, 2)}</div>
                      <div>estFromAmount (reverseQuote): {JSON.stringify(reverseQuoteDebug, null, 2)}</div>
                    </div>
                  </div>
                )}
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
                <strong>Hyperion Protocol:</strong> A decentralized exchange on Aptos blockchain
                providing efficient token swaps with competitive pricing.
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