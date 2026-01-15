"use client";

import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { ArrowLeftRight, Loader2, Info, AlertCircle, CheckCircle, XCircle, Copy, ExternalLink, Settings, X } from 'lucide-react';
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
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { isUserRejectedError } from '@/lib/utils/errors';
import { Token } from '@/lib/types/panora';
import tokenList from '@/lib/data/tokenList.json';
import { getProtocolsList } from '@/lib/protocols/getProtocolsList';
// Убираем useWalletStore - используем готовые цены из tokens
// import { useWalletStore } from '@/lib/stores/walletStore';

// Extended token type with actual price from wallet
interface TokenWithActualPrice extends Token {
  actualPrice?: string | null;
}

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
  const { tokens, address: userAddress, refreshPortfolio } = useWalletData();
  const { signAndSubmitTransaction, connected } = useWallet();

  // Убираем fetchPrices - используем готовые цены из tokens
  // const { prices, fetchPrices } = useWalletStore();

  // Используем готовые цены из tokens кошелька - не нужно логировать
  // console.log('[SwapModal] Current tokens with prices:', tokens);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [swapQuote, setSwapQuote] = useState<SwapQuote | null>(null);
  const [swapResult, setSwapResult] = useState<SwapResult | null>(null);
  const [quoteDebug, setQuoteDebug] = useState<any>(null);
  const [showSlippage, setShowSlippage] = useState(false);

  // Local optimistic balances override for UI after successful swap
  const [balancesOverride, setBalancesOverride] = useState<Record<string, number>>({});

  // Состояние для отслеживания изменений данных
  const [lastQuoteData, setLastQuoteData] = useState({
    fromToken: null as TokenWithActualPrice | null,
    toToken: null as TokenWithActualPrice | null,
    amount: '',
    slippage: 0.5
  });

  // Token selection
  const [fromToken, setFromToken] = useState<TokenWithActualPrice | null>(null);
  const [toToken, setToToken] = useState<TokenWithActualPrice | null>(null);
  const [amount, setAmount] = useState<string>('');
  const [slippage, setSlippage] = useState<number>(0.5);

  // USD amount calculated from input amount and fromToken actual price from wallet
  const usdAmount = useMemo(() => {
    const price = Number((fromToken as any)?.actualPrice || 0);
    const qty = Number(amount || 0);
    if (!isFinite(price) || !isFinite(qty)) return 0;
    return qty * price;
  }, [amount, fromToken]);

  // If a quote is available, prefer USD value from quote; otherwise fallback to usdAmount
  const quotedUsdAmount = useMemo(() => {
    const q = (quoteDebug as any)?.quotes?.[0];
    if (q?.fromTokenAmountUSD) return Number(q.fromTokenAmountUSD);
    if (swapQuote?.estimatedFromAmount && (fromToken as any)?.actualPrice) {
      return Number(swapQuote.estimatedFromAmount) * Number((fromToken as any).actualPrice);
    }
    return null;
  }, [quoteDebug, swapQuote, fromToken]);

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
        // Use actual price from wallet only (no fallback to static prices)
        const actualPrice = t.price;
        return {
          ...t,
          tokenInfo,
          actualPrice
        };
      })
      .filter(token => token.tokenInfo)
      .sort((a, b) => Number(b.amount) - Number(a.amount));
  }, [tokens]);

  // Available tokens for "To" selection
  const availableToTokens = useMemo(() => {
    // 1) Start with user's tokens (with tokenInfo attached)
    const userTokens = tokens
      .map(t => {
        const tokenInfo = getTokenInfo(t.address);
        // Use actual price from wallet only (no fallback to static prices)
        const actualPrice = t.price;
        return {
          ...t,
          tokenInfo,
          actualPrice
        };
      })
      .filter(token =>
        token.tokenInfo &&
        token.tokenInfo.faAddress !== fromToken?.faAddress
      )
      .sort((a, b) => Number(b.amount) - Number(a.amount));

    // 2) Ensure only native tokens are always present: APT, USDt, USDC (native), USD1, WBTC (native)
    // Native faAddresses (lowercase)
    const requiredFaAddresses = [
      '0xa', // APT
      '0x357b0b74bc833e95a115ad22604854d6b0fca151cecd94111770e5d6ffc9dc2b', // USDt (native)
      '0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b', // USDC (native)
      '0x05fabd1b12e39967a3c24e91b7b8f67719a6dacee74f3c8b9fb7d93e855437d2', // USD1 (native)
      '0x68844a0d7f2587e726ad0579f3d640865bb4162c08a4589eeda3f9689ec52a3d', // WBTC (native)
    ];

    const requiredTokens = (tokenList.data.data as Token[])
      .filter(token => requiredFaAddresses.includes((token.faAddress || '').toLowerCase()))
      .filter(token => token.faAddress !== fromToken?.faAddress)
      .map(token => ({
        address: token.faAddress || token.tokenAddress || '',
        name: token.name || token.symbol,
        symbol: token.symbol,
        decimals: token.decimals,
        amount: '0',
        price: null as string | null,
        tokenInfo: token,
        actualPrice: null // No price for tokens not in wallet
      }));

    // 3) Merge with deduplication by token address
    const byAddr = new Map<string, any>();
    const put = (item: any) => {
      const addr = (item.tokenInfo?.faAddress || item.tokenInfo?.tokenAddress || item.address || '').toLowerCase();
      if (!addr) return;
      if (!byAddr.has(addr)) byAddr.set(addr, item);
    };

    userTokens.forEach(put);
    requiredTokens.forEach(put);

    return Array.from(byAddr.values());
  }, [tokens, fromToken]);

  // Type guard to check if token has tokenInfo property
  const hasTokenInfo = (token: any): token is { tokenInfo: Token; value: number; address: string; name: string; symbol: string; decimals: number; amount: string; price: string | null; actualPrice?: string | null } => {
    return 'tokenInfo' in token && token.tokenInfo !== undefined;
  };

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

  // Refresh portfolio data when modal opens
  useEffect(() => {
    if (isOpen) {
      console.log('[SwapModal] Refreshing portfolio data on modal open');
      refreshPortfolio();
    }
  }, [isOpen, refreshPortfolio]);

  // Set default tokens on load
  useEffect(() => {
    if (availableTokens.length > 0 && !fromToken) {
      const firstToken = availableTokens[0];
      const token = getTokenInfo(firstToken.address);
      if (token) {
        // Attach actual price from wallet
        setFromToken({ ...token, actualPrice: firstToken.actualPrice });
      }
    }

    if (availableToTokens.length > 0 && !toToken) {
      // Select second token from the list (next available)
      const secondToken = availableToTokens[1] || availableToTokens[0];
      if (hasTokenInfo(secondToken)) {
        // Attach actual price from wallet
        setToToken({ ...secondToken.tokenInfo, actualPrice: secondToken.actualPrice });
      } else {
        setToToken({ ...(secondToken as Token), actualPrice: secondToken.actualPrice });
      }
    }

  }, [availableTokens, availableToTokens, fromToken, toToken, tokens]);

  // Auto-fetch quote: Debounced for amount changes (600ms delay)
  useEffect(() => {
    // Validate all required fields
    if (!fromToken || !toToken || !amount || parseFloat(amount) <= 0 || !userAddress) {
      return;
    }

    // Debounce: wait 600ms after user stops typing
    const timer = setTimeout(() => {
      getQuote();
    }, 600);

    return () => clearTimeout(timer);
  }, [amount]); // Only trigger on amount change

  // Auto-fetch quote: Fast reaction for token changes (100ms delay)
  useEffect(() => {
    // Validate all required fields
    if (!fromToken || !toToken || !amount || parseFloat(amount) <= 0 || !userAddress) {
      return;
    }

    // Small delay to avoid aggressive requests
    const timer = setTimeout(() => {
      getQuote();
    }, 100);

    return () => clearTimeout(timer);
  }, [fromToken, toToken, slippage]); // Trigger on token or slippage change

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

    // Используем готовые цены из tokens кошелька - не нужно загружать свежие цены
    // Цены уже актуальные и загружены при открытии приложения

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

      // Сохраняем данные для отслеживания изменений
      setLastQuoteData({
        fromToken,
        toToken,
        amount,
        slippage
      });

    } catch (error: any) {
      setError(`Quote error: ${error.message || error}`);
    } finally {
      setLoading(false);
    }
  };

  const executeSwap = async () => {
    if (!connected) {
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

          console.log('Executing swap via signAndSubmitTransaction with Gas Station...');

          // Use signAndSubmitTransaction with global Gas Station transactionSubmitter from WalletProvider
          // Gas Station will automatically sponsor the transaction (free for user)
          if (!connected || !signAndSubmitTransaction) {
            throw new Error('Wallet not connected');
          }

          const tx = await signAndSubmitTransaction({
            data: {
              function: txPayload.function as `${string}::${string}::${string}`,
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

          // Сбрасываем quote после успешного выполнения
          setSwapQuote(null);
          setQuoteDebug(null);
          setLastQuoteData({
            fromToken: null,
            toToken: null,
            amount: '',
            slippage: 0.5
          });

          // Optimistically update UI balances and clear amount
          try {
            const fromKey = (fromToken.faAddress || fromToken.tokenAddress || '').toLowerCase();
            const toKey = (toToken.faAddress || toToken.tokenAddress || '').toLowerCase();

            const currentFrom = getTokenBalance(fromToken).balance;
            const currentTo = getTokenBalance(toToken).balance;

            const spent = Number(amount || '0');
            const received = Number(quoteDebug?.quotes?.[0]?.toTokenAmount || swapQuote.amount || '0');

            const next: Record<string, number> = { ...balancesOverride };
            if (fromKey) next[fromKey] = Math.max(0, (currentFrom - spent));
            if (toKey) next[toKey] = Math.max(0, (currentTo + received));
            setBalancesOverride(next);

            setAmount('');
          } catch {}
        } catch (walletError: any) {
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

  // Убираем formatUSD - он больше не используется
  // const formatUSD = (num: number | string) => { ... };

  // Убираем функцию getTokenPrice - она больше не используется
  // const getTokenPrice = (token: Token) => { ... };

  // Проверяем, изменились ли данные с момента получения quote
  const hasDataChanged = () => {
    if (!lastQuoteData.fromToken || !lastQuoteData.toToken) return true;

    return (
      lastQuoteData.fromToken.faAddress !== fromToken?.faAddress ||
      lastQuoteData.toToken.faAddress !== toToken?.faAddress ||
      lastQuoteData.amount !== amount ||
      lastQuoteData.slippage !== slippage
    );
  };

  // Получаем конфигурацию кнопки
  const getButtonConfig = () => {
    if (!swapQuote || hasDataChanged()) {
      return {
        text: 'Get Quote',
        action: getQuote,
        disabled: !fromToken || !toToken || !amount,
        variant: 'default' as const
      };
    }

    return {
      text: 'Execute Swap',
      action: executeSwap,
      disabled: false,
      variant: 'default' as const
    };
  };

  const getTokenBalance = (token: Token) => {
    const balance = findTokenBalance(tokens, token);
    const humanBalance = Number(balance) / Math.pow(10, token.decimals);

    const key = (token.faAddress || token.tokenAddress || '').toLowerCase();
    const override = key ? balancesOverride[key] : undefined;
    const effective = typeof override === 'number' ? override : humanBalance;

    return { balance: effective };
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
      // Сбрасываем данные для отслеживания изменений
      setLastQuoteData({
        fromToken: null,
        toToken: null,
        amount: '',
        slippage: 0.5
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto p-6 rounded-2xl w-[calc(100vw-2rem)] sm:w-auto [&>button:last-child]:hidden">
        <DialogHeader>
          <div className="flex items-start justify-between gap-2">
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
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowSlippage(!showSlippage)}
                  className="h-8 w-8 p-0"
                >
                  <Settings className="h-4 w-4" />
                </Button>
                <Button
                  onClick={onClose}
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          <div className="flex items-center">
            <div className="flex-1 min-w-0 pr-2">
              <DialogDescription>
              Swap tokens using Panora DEX aggregator with gasless transactions
              </DialogDescription>
            </div>
            {showSlippage && (
              <div className="shrink-0 ml-10 w-18 sm:w-18">
                <Label className="text-xs">Slippage</Label>
                <Select value={slippage.toString()} onValueChange={(value) => {
                  setSlippage(Number(value));
                  setSwapResult(null);
                  setSwapQuote(null);
                  setQuoteDebug(null);
                  setLastQuoteData({
                    fromToken: null,
                    toToken: null,
                    amount: '',
                    slippage: 0.5
                  });
                }}>
                  <SelectTrigger className="h-8">
                    <SelectValue className="text-xs">{slippage}%</SelectValue>
                  </SelectTrigger>
                  <SelectContent className="w-[--radix-select-trigger-width] min-w-0">
                    <SelectItem value="0.5">0.5%</SelectItem>
                    <SelectItem value="1.0">1.0%</SelectItem>
                    <SelectItem value="2.0">2.0%</SelectItem>
                    <SelectItem value="5.0">5.0%</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
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
                  // Find actual price from wallet
                  const walletToken = availableTokens.find(t =>
                    (t.tokenInfo?.faAddress || t.tokenInfo?.tokenAddress) === value
                  );
                  if (token) {
                    setFromToken({ ...token, actualPrice: walletToken?.actualPrice });
                    // Сбрасываем quote при смене токена
                    setSwapQuote(null);
                    setQuoteDebug(null);
                    setError(null);
                    setSwapResult(null); // Clear swap result when changing token
                    // Сбрасываем данные для отслеживания изменений
                    setLastQuoteData({
                      fromToken: null,
                      toToken: null,
                      amount: '',
                      slippage: 0.5
                    });
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
                    {[...availableTokens]
                      .sort((a, b) => {
                        // Sort by total value USD (balance × price) instead of price per token
                        // Convert raw amount to human-readable format using decimals
                        const aBalance = Number(a.amount || 0) / Math.pow(10, a.tokenInfo?.decimals || 8);
                        const bBalance = Number(b.amount || 0) / Math.pow(10, b.tokenInfo?.decimals || 8);
                        const aPrice = Number(a.actualPrice || 0);
                        const bPrice = Number(b.actualPrice || 0);
                        const aValueUSD = aBalance * aPrice;
                        const bValueUSD = bBalance * bPrice;
                        if (!isFinite(aValueUSD) && !isFinite(bValueUSD)) return 0;
                        if (!isFinite(aValueUSD)) return 1;
                        if (!isFinite(bValueUSD)) return -1;
                        return bValueUSD - aValueUSD;
                      })
                      .map((token) => {
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
                              <span className="text-sm">{tokenInfo.symbol}&nbsp;</span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {formatNumber(balance.balance)}
                              {token.actualPrice && Math.abs(balance.balance) >= 0.001 &&  (
                                <span> (${(balance.balance * Number(token.actualPrice)).toFixed(2)})</span>
                              )}
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

			  {fromToken && (fromToken as any).actualPrice && (
			    <div className="text-xs text-muted-foreground">
				  ${ (getTokenBalance(fromToken).balance * Number((fromToken as any).actualPrice)).toFixed(2) }
			    </div>
			  )}
            </div>

            {/* Amount Input */}
            <div className="space-y-1">
              <Label className="text-xs">Amount
			    {fromToken && amount ? (
				  <span className="text-muted-foreground">${((!swapQuote || hasDataChanged()) ? usdAmount : (quotedUsdAmount ?? usdAmount)).toFixed(2)}</span>
			    ) : (
				  <span></span>
			    )}
			  </Label>

              <div className="space-y-1">
                  <Input
                    type="number"
                    placeholder="0.0"
                    value={amount}
                    onChange={(e) => {
                      setAmount(e.target.value);
                      setSwapResult(null); // Clear swap result when changing amount
                      // Сбрасываем quote при изменении количества
                      setSwapQuote(null);
                      setQuoteDebug(null);
                      setLastQuoteData({
                        fromToken: null,
                        toToken: null,
                        amount: '',
                        slippage: 0.5
                      });
                    }}
                    className="h-9 text-sm"
                  />

                  {/* Убираем отображение USD стоимости */}
                </div>
              {fromToken && (
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const balance = getTokenBalance(fromToken);
                      setAmount((balance.balance * 0.25).toString());
                    }}
                    className="h-6 text-xs px-2"
                  >
                    25%
                  </Button>
				  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const balance = getTokenBalance(fromToken);
                      setAmount((balance.balance * 0.5).toString());
                    }}
                    className="h-6 text-xs px-2"
                  >
                    50%
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
                    // Find actual price from wallet
                    const walletToken = availableToTokens.find(t =>
                      (t.tokenInfo?.faAddress || t.tokenInfo?.tokenAddress) === value
                    );
                    if (token) {
                      setToToken({ ...token, actualPrice: walletToken?.actualPrice });
                      // Сбрасываем quote при смене токена
                      setSwapQuote(null);
                      setQuoteDebug(null);
                      setError(null);
                      setSwapResult(null); // Clear swap result when changing token
                      // Сбрасываем данные для отслеживания изменений
                      setLastQuoteData({
                        fromToken: null,
                        toToken: null,
                        amount: '',
                        slippage: 0.5
                      });
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
                                    <span className="text-sm">{tokenInfo.symbol}&nbsp;</span>
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {formatNumber(balance.balance)}

									{ /*
                                    {tokenInfo.usdPrice && Math.abs(parseFloat(balance.balance)) >= 0.001 &&  (
                                      <span> (${(balance.balance * Number(balance.balance)).toFixed(2)})</span>
                                    )}
									*/ }
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
                                  {/* Убираем отображение цены */}
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
                      ${formatNumber(parseFloat(quoteDebug.quotes[0].toTokenAmountUSD))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>



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
                <div className="border border-success rounded-lg p-3">
                  <div className="flex items-center gap-2 text-success">
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
                      <span className="font-medium text-success">Paid by Gas Station</span>
                    </div>

                    {swapResult.receivedAmount && (
                      <div className="flex justify-between">
                        <span className="font-bold text-lg">Received:</span>
                        <span className="font-bold text-lg">
                          {formatNumber(swapResult.receivedAmount)} {swapResult.receivedSymbol}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-warning-muted border border-warning rounded-lg p-3">
                  <div className="flex items-center gap-2 text-warning">
                    <XCircle className="h-4 w-4" />
                    <span className="font-medium text-sm">Swap cancelled</span>
                  </div>

                  {swapResult.error && (
                    <div className="text-sm text-warning mt-2">User rejected swap{/*swapResult.error*/}</div>
                  )}
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-3 bg-error-muted border border-error rounded-lg">
              <AlertCircle className="h-4 w-4 text-error" />
              <span className="text-error text-sm">{error}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              onClick={getButtonConfig().action}
              disabled={loading || getButtonConfig().disabled}
              variant={getButtonConfig().variant}
              className="flex-1"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {getButtonConfig().text === 'Get Quote' ? 'Getting Quote...' : 'Executing...'}
                </>
              ) : (
                getButtonConfig().text
              )}
            </Button>
          </div>

          {/* Auto-update hint */}
          {!loading && !swapQuote && fromToken && toToken && amount && parseFloat(amount) > 0 && (
            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Quote will update automatically...</span>
            </div>
          )}

          {/* Fee Information */}
          <div className="text-xs text-muted-foreground text-center">
            Gasless transaction - no APT required for gas fees. {panoraFee}% swap fee applies.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
