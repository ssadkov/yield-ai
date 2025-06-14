import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { Protocol } from "@/lib/protocols/getProtocolsList";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState } from "react";
import { DepositModal } from "./deposit-modal";
import { useWalletData } from "@/contexts/WalletContext";

interface DepositButtonProps {
  protocol: Protocol;
  className?: string;
  tokenIn?: {
    symbol: string;
    logo: string;
    decimals: number;
  };
  balance?: bigint;
  priceUSD?: number;
}

export function DepositButton({ 
  protocol, 
  className,
  tokenIn,
  balance,
  priceUSD,
}: DepositButtonProps) {
  const [isExternalDialogOpen, setIsExternalDialogOpen] = useState(false);
  const [isNativeDialogOpen, setIsNativeDialogOpen] = useState(false);
  const walletData = useWalletData();

  const handleClick = () => {
    if (protocol.depositType === 'external') {
      setIsExternalDialogOpen(true);
    } else if (protocol.depositType === 'native' && tokenIn && balance && priceUSD) {
      setIsNativeDialogOpen(true);
    }
  };

  const handleExternalConfirm = () => {
    if (protocol.depositUrl) {
      window.open(protocol.depositUrl, '_blank');
    }
    setIsExternalDialogOpen(false);
  };

  const handleNativeConfirm = (data: { amount: bigint }) => {
    console.log('Native deposit:', data);
    setIsNativeDialogOpen(false);
  };

  return (
    <>
      <Button 
        variant="secondary" 
        className={className}
        onClick={handleClick}
      >
        Deposit
        {protocol.depositType === 'external' && (
          <ExternalLink className="ml-2 h-4 w-4" />
        )}
      </Button>

      <AlertDialog open={isExternalDialogOpen} onOpenChange={setIsExternalDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Go to protocol website?</AlertDialogTitle>
            <AlertDialogDescription>
              You will be redirected to {protocol.name} website to complete the deposit.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleExternalConfirm}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {protocol.depositType === 'native' && tokenIn && balance && priceUSD && (
        <DepositModal
          isOpen={isNativeDialogOpen}
          onClose={() => setIsNativeDialogOpen(false)}
          onConfirm={handleNativeConfirm}
          protocol={{
            name: protocol.name,
            logo: protocol.logoUrl,
            apy: 8.4, // TODO: Get from protocol data
          }}
          tokenIn={tokenIn}
          tokenOut={tokenIn}
          balance={balance}
          priceUSD={priceUSD}
          debugInfo={{
            walletAddress: walletData.address,
            tokens: JSON.stringify(walletData.tokens.map(token => ({
              symbol: token.symbol,
              address: token.address,
              amount: (Number(token.amount) / Math.pow(10, token.decimals)).toFixed(2),
              value: token.value ? `$${Number(token.value).toFixed(2)}` : 'N/A'
            })), null, 2)
          }}
        />
      )}
    </>
  );
} 