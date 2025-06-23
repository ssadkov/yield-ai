import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { Protocol } from "@/lib/protocols/getProtocolsList";
import { ProtocolKey } from "@/lib/transactions/types";
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
import { cn } from "@/lib/utils";

interface DepositButtonProps {
  protocol: Protocol;
  className?: string;
  tokenIn?: {
    symbol: string;
    logo: string;
    decimals: number;
    address?: string;
  };
  tokenOut?: {
    symbol: string;
    logo: string;
    address?: string;
    decimals: number;
  };
  balance?: bigint;
  priceUSD?: number;
}

export function DepositButton({ 
  protocol, 
  className,
  tokenIn,
  tokenOut = tokenIn,
  balance,
  priceUSD,
}: DepositButtonProps) {
  console.log('DepositButton render:', { protocol, tokenIn, balance, priceUSD });
  
  const [isExternalDialogOpen, setIsExternalDialogOpen] = useState(false);
  const [isNativeDialogOpen, setIsNativeDialogOpen] = useState(false);
  const walletData = useWalletData();

  const handleClick = () => {
    console.log('DepositButton clicked:', {
      protocol,
      depositType: protocol.depositType,
      tokenIn,
      tokenInAddress: tokenIn?.address,
      balance,
      priceUSD,
      condition: protocol.depositType === 'native' && tokenIn && balance,
      tokenInExists: !!tokenIn,
      balanceExists: !!balance,
      priceUSDExists: !!priceUSD
    });
    
    if (protocol.depositType === 'external') {
      console.log('Opening external dialog');
      setIsExternalDialogOpen(true);
    } else if (protocol.depositType === 'native' && tokenIn && balance) {
      console.log('Opening native dialog');
      setIsNativeDialogOpen(true);
    } else {
      console.log('No conditions met for opening dialog');
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
        variant={protocol.depositType === 'native' ? "default" : "secondary"}
        className={cn(
          className,
          protocol.depositType === 'native' && "bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
        )}
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

      {protocol.depositType === 'native' && tokenIn && tokenIn.address && balance && (
        <DepositModal
          isOpen={isNativeDialogOpen}
          onClose={() => setIsNativeDialogOpen(false)}
          protocol={{
            name: protocol.name,
            logo: protocol.logoUrl,
            apy: 8.4, // TODO: Get from protocol data
            key: protocol.name.toLowerCase() as ProtocolKey
          }}
          tokenIn={{
            symbol: tokenIn.symbol,
            logo: tokenIn.logo,
            decimals: tokenIn.decimals,
            address: tokenIn.address
          }}
          tokenOut={tokenIn}
          priceUSD={priceUSD || 0}
        />
      )}
    </>
  );
} 