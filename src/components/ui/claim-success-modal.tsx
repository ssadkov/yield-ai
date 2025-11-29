"use client"

import React from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { CheckCircle2, ExternalLink } from "lucide-react"
import { formatNumber, formatCurrency } from "@/lib/utils/numberFormat"
import Image from "next/image"

interface ClaimedReward {
  symbol: string
  amount: number
  usdValue: number
  logoUrl?: string | null
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
  const totalUsdValue = rewards.reduce((sum, reward) => sum + reward.usdValue, 0)

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] p-8">
        <DialogHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-green-100 p-4">
              <CheckCircle2 className="h-12 w-12 text-green-600" />
            </div>
          </div>
          <DialogTitle className="text-3xl font-bold text-center">
            Rewards Claimed!
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-6">
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

          {/* Transaction Link */}
          {transactionHash && (
            <div className="pt-4 border-t">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  window.open(
                    `https://explorer.aptoslabs.com/txn/${transactionHash}?network=mainnet`,
                    "_blank"
                  )
                }}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                View Transaction
              </Button>
            </div>
          )}

          {/* Close Button */}
          <Button onClick={onClose} className="w-full" size="lg">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

