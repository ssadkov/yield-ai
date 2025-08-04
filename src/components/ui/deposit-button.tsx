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
import { useState, useEffect } from "react";
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
  const [protocolAPY, setProtocolAPY] = useState<number>(8.4); // Default fallback
  const walletData = useWalletData();

  // Fetch real APY data for Amnis Finance and Echelon
  useEffect(() => {
    if (protocol.name === 'Amnis Finance') {
      const fetchAmnisAPY = async () => {
        try {
          const response = await fetch('/api/protocols/amnis/pools');
          if (response.ok) {
            const data = await response.json();
            if (data.success && data.pools && data.pools.length > 0) {
              // Use APT staking pool APR
              const aptPool = data.pools.find((pool: any) => pool.asset === 'APT');
              if (aptPool && aptPool.apr) {
                setProtocolAPY(aptPool.apr);
                console.log('Fetched Amnis APY:', aptPool.apr);
              }
            }
          }
        } catch (error) {
          console.error('Error fetching Amnis APY:', error);
        }
      };
      
      fetchAmnisAPY();
    } else if (protocol.name === 'Echelon') {
      const fetchEchelonAPY = async () => {
        try {
          console.log('Fetching Echelon APY for token:', tokenIn?.address);
          const response = await fetch('/api/protocols/echelon/v2/pools');
          if (response.ok) {
            const data = await response.json();
            if (data.success && data.data && data.data.length > 0) {
              // Find the pool for this specific token
              const pool = data.data.find((pool: any) => 
                pool.token === tokenIn?.address && pool.asset && !pool.asset.includes('(Borrow)')
              );
              if (pool && pool.depositApy) {
                setProtocolAPY(pool.depositApy);
                console.log('Fetched Echelon APY:', pool.depositApy, 'for token:', tokenIn?.address);
              } else {
                console.log('No matching Echelon pool found for token:', tokenIn?.address);
                console.log('Available pools:', data.data.map((p: any) => ({ token: p.token, asset: p.asset, apy: p.depositApy })));
              }
            }
          }
        } catch (error) {
          console.error('Error fetching Echelon APY:', error);
        }
      };
      
      fetchEchelonAPY();
    }
  }, [protocol.name, tokenIn?.address]);

  const handleClick = () => {
    console.log('DepositButton clicked:', {
      protocol: protocol.name,
      depositType: protocol.depositType,
      tokenIn,
      tokenInAddress: tokenIn?.address,
      balance,
      priceUSD,
      protocolAPY, // Add this to see the current APY value
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
            logo: protocol.logoUrl || '/file.svg', // Add fallback
            apy: (() => {
              console.log(`DepositModal - APY for ${protocol.name}:`, protocolAPY);
              return protocolAPY;
            })(),
            key: (protocol.name === 'Amnis Finance' ? 'amnis' : protocol.name.toLowerCase()) as ProtocolKey
          }}
          tokenIn={{
            symbol: tokenIn.symbol,
            logo: tokenIn.logo || '/file.svg', // Add fallback
            decimals: tokenIn.decimals,
            address: tokenIn.address
          }}
          tokenOut={{
            symbol: tokenIn.symbol,
            logo: tokenIn.logo || '/file.svg', // Add fallback
            decimals: tokenIn.decimals,
            address: tokenIn.address
          }}
          priceUSD={priceUSD || 0}
        />
      )}
    </>
  );
} 