"use client"

import React, { useState, useEffect, useMemo } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { CheckCircle2, ExternalLink, ArrowLeftRight, Loader2, AlertCircle } from "lucide-react"
import { formatNumber, formatCurrency } from "@/lib/utils/numberFormat"
import Image from "next/image"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useWalletData } from "@/contexts/WalletContext"
import { useWallet } from "@aptos-labs/wallet-adapter-react"
import { Token } from "@/lib/types/panora"
import tokenList from "@/lib/data/tokenList.json"
import { Separator } from "@/components/ui/separator"

interface ClaimedReward {
  symbol: string
  amount: number
  usdValue: number
  logoUrl?: string | null
  tokenAddress?: string // Added for future swap functionality
}

interface ClaimSuccessModalProps {
  isOpen: boolean
  onClose: () => void
  transactionHash?: string
  rewards: ClaimedReward[]
  protocolName?: string
}

export function ClaimSuccessModal({
  isOpen,
  onClose,
  transactionHash,
  rewards,
  protocolName = "Protocol"
}: ClaimSuccessModalProps) {
  const { tokens, address: userAddress, refreshPortfolio } = useWalletData()
  const { signAndSubmitTransaction, connected } = useWallet()
  
  // For Moar: only one reward (APT), take the first one
  const fromReward = rewards.length > 0 ? rewards[0] : null
  
  // Swap state
  const [toToken, setToToken] = useState<Token | null>(null)
  const [swapQuote, setSwapQuote] = useState<any>(null)
  const [quoteDebug, setQuoteDebug] = useState<any>(null)
  const [swapLoading, setSwapLoading] = useState(false)
  const [swapError, setSwapError] = useState<string | null>(null)
  const [swapResult, setSwapResult] = useState<{ success: boolean; hash?: string } | null>(null)

  // Helper function to get token info
  const getTokenInfo = (address: string): Token | undefined => {
    if (!address) return undefined
    
    const normalizeAddress = (addr: string) => {
      if (!addr) return ''
      // For Move addresses (with ::), use case-insensitive comparison
      if (addr.includes('::')) return addr.toLowerCase()
      // For regular hex addresses, normalize
      if (addr.startsWith('0x')) {
        const normalized = '0x' + addr.slice(2).replace(/^0+/, '')
        return (normalized === '0x' ? '0x0' : normalized).toLowerCase()
      }
      return addr.toLowerCase()
    }
    
    const normalizedAddress = normalizeAddress(address)
    
    return (tokenList.data.data as Token[]).find(token => {
      const normalizedTokenAddress = normalizeAddress(token.tokenAddress || '')
      const normalizedFaAddress = normalizeAddress(token.faAddress || '')
      
      return normalizedTokenAddress === normalizedAddress || 
             normalizedFaAddress === normalizedAddress ||
             // Direct comparison for Move addresses
             (address.includes('::') && token.tokenAddress?.toLowerCase() === address.toLowerCase())
    })
  }

  // Get fromToken info from reward
  const fromToken = useMemo(() => {
    if (!fromReward?.tokenAddress) return null
    return getTokenInfo(fromReward.tokenAddress)
  }, [fromReward])

  // Available tokens for "To" selection (exclude fromToken)
  const availableToTokens = useMemo(() => {
    const requiredFaAddresses = [
      '0xa', // APT
      '0x357b0b74bc833e95a115ad22604854d6b0fca151cecd94111770e5d6ffc9dc2b', // USDt
      '0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b', // USDC
      '0x05fabd1b12e39967a3c24e91b7b8f67719a6dacee74f3c8b9fb7d93e855437d2', // USD1
      '0x68844a0d7f2587e726ad0579f3d640865bb4162c08a4589eeda3f9689ec52a3d', // WBTC
    ]

    const requiredTokens = (tokenList.data.data as Token[])
      .filter(token => requiredFaAddresses.includes((token.faAddress || '').toLowerCase()))
      .filter(token => {
        if (!fromToken) return true
        // Compare by faAddress first, then tokenAddress
        const fromFaAddr = (fromToken.faAddress || '').toLowerCase()
        const fromTokenAddr = (fromToken.tokenAddress || '').toLowerCase()
        const tokenFaAddr = (token.faAddress || '').toLowerCase()
        const tokenTokenAddr = (token.tokenAddress || '').toLowerCase()
        
        // Exclude if addresses match
        return !(
          (fromFaAddr && tokenFaAddr && fromFaAddr === tokenFaAddr) ||
          (fromTokenAddr && tokenTokenAddr && fromTokenAddr === tokenTokenAddr) ||
          (fromTokenAddr && tokenFaAddr && fromTokenAddr === tokenFaAddr) ||
          (fromFaAddr && tokenTokenAddr && fromFaAddr === tokenTokenAddr)
        )
      })

    return requiredTokens
  }, [fromToken])

  // Get quote when toToken is selected
  useEffect(() => {
    // Don't fetch quote if swap was successful
    if (!fromToken || !toToken || !fromReward || !userAddress || swapResult?.success) return
    
    const getQuote = async () => {
      setSwapLoading(true)
      setSwapError(null)
      setSwapQuote(null)
      setQuoteDebug(null)

      try {
        // For Panora API, prefer faAddress, fallback to tokenAddress
        // For Move addresses like "0x1::aptos_coin::AptosCoin", use faAddress if available
        const fromAddress = fromToken.faAddress || fromToken.tokenAddress || ''
        const toAddress = toToken.faAddress || toToken.tokenAddress || ''
        
        if (!fromAddress || !toAddress) {
          throw new Error('Invalid token addresses')
        }
        
        const response = await fetch('/api/panora/swap-quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chainId: "1",
            fromTokenAddress: fromAddress,
            toTokenAddress: toAddress,
            fromTokenAmount: fromReward.amount.toString(),
            toWalletAddress: userAddress,
            slippagePercentage: "0.5",
            getTransactionData: "transactionPayload"
          })
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to get quote')
        }

        const quoteData = await response.json()
        setQuoteDebug(quoteData)
        
        const quote = quoteData.quotes?.[0]
        const toTokenAmount = quote?.toTokenAmount || '0'
        
        setSwapQuote({
          amount: toTokenAmount,
          estimatedFromAmount: fromReward.amount.toString(),
          estimatedToAmount: toTokenAmount,
        })
      } catch (error: any) {
        setSwapError(`Quote error: ${error.message || error}`)
      } finally {
        setSwapLoading(false)
      }
    }

    // Debounce quote fetch
    const timer = setTimeout(() => {
      getQuote()
    }, 300)

    return () => clearTimeout(timer)
  }, [fromToken, toToken, fromReward?.amount, userAddress])

  // Execute swap
  const executeSwap = async () => {
    if (!connected || !signAndSubmitTransaction) {
      setSwapError('Wallet not connected')
      return
    }

    if (!fromToken || !toToken || !fromReward || !userAddress || !swapQuote || !quoteDebug) {
      setSwapError('Missing required data for swap')
      return
    }

    setSwapLoading(true)
    setSwapError(null)

    try {
      const response = await fetch('/api/panora/execute-swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteData: quoteDebug,
          walletAddress: userAddress
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to execute swap')
      }

      const swapData = await response.json()
      
      if (swapData.error) {
        throw new Error(swapData.error)
      }

      if (!swapData.function || !swapData.type_arguments || !swapData.arguments) {
        throw new Error('Invalid transaction payload structure')
      }

      const tx = await signAndSubmitTransaction({
        data: {
          function: swapData.function as `${string}::${string}::${string}`,
          typeArguments: swapData.type_arguments,
          functionArguments: swapData.arguments
        },
        options: { maxGasAmount: 20000 }
      })

      setSwapResult({ success: true, hash: tx.hash })
      
      // Refresh portfolio after successful swap
      setTimeout(() => {
        refreshPortfolio()
      }, 2000)

    } catch (error: any) {
      setSwapError(error.message || 'Failed to execute swap')
      setSwapResult({ success: false })
    } finally {
      setSwapLoading(false)
    }
  }

  // Reset swap state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setToToken(null)
      setSwapQuote(null)
      setQuoteDebug(null)
      setSwapError(null)
      setSwapResult(null)
    }
  }, [isOpen])

  const totalUsdValue = rewards.reduce((sum, reward) => sum + reward.usdValue, 0)

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[350px] p-6">
        <DialogHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-green-100 p-4">
              <CheckCircle2 className="h-12 w-12 text-green-600" />
            </div>
          </div>
          <DialogTitle className="text-3xl font-bold text-center">
            {swapResult?.success ? 'Swap Successful!' : 'Rewards Claimed!'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-6">
          {/* Show swap success or claim success */}
          {swapResult?.success ? (
            <>
              {/* Swap Success */}
              <div className="text-center">
                <div className="text-sm text-muted-foreground mb-1">Swapped Successfully</div>
                {fromReward && toToken && swapQuote && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-center gap-2 text-lg">
                      <span className="font-semibold">{formatNumber(fromReward.amount, 6)}</span>
                      <span className="text-muted-foreground">{fromReward.symbol}</span>
                      <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold">{formatNumber(parseFloat(swapQuote.estimatedToAmount || '0'), 6)}</span>
                      <span className="text-muted-foreground">{toToken.symbol}</span>
                    </div>
                    {quoteDebug?.quotes?.[0]?.toTokenAmountUSD && (
                      <div className="text-sm text-muted-foreground">
                        ${formatNumber(parseFloat(quoteDebug.quotes[0].toTokenAmountUSD), 2)}
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {swapResult.hash && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    window.open(
                      `https://explorer.aptoslabs.com/txn/${swapResult.hash}?network=mainnet`,
                      "_blank"
                    )
                  }}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View Swap Transaction
                </Button>
              )}
              
              <Button onClick={onClose} className="w-full" size="lg">
                Close
              </Button>
            </>
          ) : (
            <>
              {/* Total Value */}
              {rewards.length > 0 && (
                <div className="text-center">
                  <div className="text-sm text-muted-foreground mb-1">Total Claimed</div>
                  <div className="text-4xl font-bold text-primary">
                    {formatCurrency(totalUsdValue, 2)}
                  </div>
                </div>
              )}

              {/* Rewards Breakdown */}
              {rewards.length > 0 ? (
                <div className="space-y-3">
                  <div className="text-sm font-semibold text-center text-muted-foreground">
                    Claimed Tokens:
                  </div>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {rewards.map((reward, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          {reward.logoUrl && (
                            <div className="w-8 h-8 relative">
                              <Image
                                src={reward.logoUrl}
                                alt={reward.symbol}
                                width={32}
                                height={32}
                                className="object-contain rounded-full"
                              />
                            </div>
                          )}
                          <div>
                            <div className="font-semibold text-lg">{reward.symbol}</div>
                            <div className="text-sm text-muted-foreground">
                              {formatCurrency(reward.usdValue, 2)}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-lg">
                            {formatNumber(reward.amount, 6)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-4">
                  No rewards details available
                </div>
              )}

              {/* Transaction Link - Less prominent, above swap */}
              {transactionHash && (
                <div className="text-center">
                  <button
                    onClick={() => {
                      window.open(
                        `https://explorer.aptoslabs.com/txn/${transactionHash}?network=mainnet`,
                        "_blank"
                      )
                    }}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline flex items-center justify-center gap-1 mx-auto"
                  >
                    <ExternalLink className="h-3 w-3" />
                    View Claim Transaction
                  </button>
                </div>
              )}

              {/* Swap Section */}
              {fromReward && fromReward.tokenAddress && (
                <>
                  <Separator />
                  
                  <div className="space-y-4">
                    <div className="text-sm font-semibold text-center text-muted-foreground">
                      Swap Your Rewards
                    </div>
                    
                    {/* From Token (Fixed) */}
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="text-xs text-muted-foreground mb-1">From</div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {fromReward.logoUrl && (
                            <Image
                              src={fromReward.logoUrl}
                              alt={fromReward.symbol}
                              width={24}
                              height={24}
                              className="rounded-full"
                            />
                          )}
                          <span className="font-semibold">{fromReward.symbol}</span>
                        </div>
                        <span className="font-bold">{formatNumber(fromReward.amount, 6)}</span>
                      </div>
                    </div>

                    {/* To Token Select */}
                    <div className="space-y-2">
                      <div className="text-xs text-muted-foreground">To</div>
                      <Select
                        value={toToken?.faAddress || toToken?.tokenAddress || ''}
                        onValueChange={(value) => {
                          const token = getTokenInfo(value)
                          if (token) setToToken(token)
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select token to swap to">
                            {toToken ? (
                              <div className="flex items-center gap-2">
                                {toToken.logoUrl && (
                                  <Image
                                    src={toToken.logoUrl}
                                    alt={toToken.symbol}
                                    width={20}
                                    height={20}
                                    className="rounded-full"
                                  />
                                )}
                                <span>{toToken.symbol}</span>
                              </div>
                            ) : (
                              <span>Select token</span>
                            )}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {availableToTokens.map((token) => (
                            <SelectItem
                              key={token.faAddress || token.tokenAddress}
                              value={token.faAddress || token.tokenAddress || ''}
                            >
                              <div className="flex items-center gap-2">
                                {token.logoUrl && (
                                  <Image
                                    src={token.logoUrl}
                                    alt={token.symbol}
                                    width={20}
                                    height={20}
                                    className="rounded-full"
                                  />
                                )}
                                <span>{token.symbol}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Quote Results */}
                    {swapLoading && (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        <span className="ml-2 text-sm text-muted-foreground">Getting quote...</span>
                      </div>
                    )}

                    {swapError && (
                      <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
                        <AlertCircle className="h-4 w-4" />
                        <span>{swapError}</span>
                      </div>
                    )}

                    {swapQuote && toToken && !swapLoading && !swapError && (
                      <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                        <div className="text-xs text-muted-foreground">You will receive</div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {toToken.logoUrl && (
                              <Image
                                src={toToken.logoUrl}
                                alt={toToken.symbol}
                                width={24}
                                height={24}
                                className="rounded-full"
                              />
                            )}
                            <span className="font-semibold">{toToken.symbol}</span>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-lg">
                              {formatNumber(parseFloat(swapQuote.estimatedToAmount || '0'), 6)}
                            </div>
                            {quoteDebug?.quotes?.[0]?.toTokenAmountUSD && (
                              <div className="text-xs text-muted-foreground">
                                ${formatNumber(parseFloat(quoteDebug.quotes[0].toTokenAmountUSD), 2)}
                              </div>
                            )}
                          </div>
                        </div>
                        {quoteDebug?.quotes?.[0]?.priceImpact && (
                          <div className="text-xs text-muted-foreground">
                            Price Impact: {quoteDebug.quotes[0].priceImpact}%
                          </div>
                        )}
                      </div>
                    )}

                    {/* Swap Button */}
                    <Button
                      onClick={executeSwap}
                      disabled={!swapQuote || swapLoading || !connected || !!swapResult}
                      className="w-full"
                      size="lg"
                    >
                      {swapLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Swapping...
                        </>
                      ) : (
                        <>
                          <ArrowLeftRight className="h-4 w-4 mr-2" />
                          Swap
                        </>
                      )}
                    </Button>
                  </div>
                </>
              )}

              {/* Close Button */}
              <Button onClick={onClose} className="w-full" size="lg" variant="outline">
                Close
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

