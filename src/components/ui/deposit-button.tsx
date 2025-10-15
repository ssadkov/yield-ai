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
  poolAddress?: string;
}

export function DepositButton({ 
  protocol, 
  className,
  tokenIn,
  tokenOut = tokenIn,
  balance,
  priceUSD,
  poolAddress,
}: DepositButtonProps) {
  
  const [isExternalDialogOpen, setIsExternalDialogOpen] = useState(false);
  const [isNativeDialogOpen, setIsNativeDialogOpen] = useState(false);
  const [protocolAPY, setProtocolAPY] = useState<number>(8.4); // Default fallback
  const walletData = useWalletData();

  // Fetch real APR data for Amnis Finance, Echelon, and Kofi Finance
  useEffect(() => {
    if (protocol.name === 'Amnis Finance') {
      const fetchAmnisAPR = async () => {
        try {
          const response = await fetch('/api/protocols/amnis/pools');
          if (response.ok) {
            const data = await response.json();
            if (data.success && data.pools && data.pools.length > 0) {
              // Use APT staking pool APR
              const aptPool = data.pools.find((pool: any) => pool.asset === 'APT');
              if (aptPool && aptPool.apr) {
                setProtocolAPY(aptPool.apr);
              }
            }
          }
        } catch (error) {
          console.error('Error fetching Amnis APR:', error);
        }
      };
      
      fetchAmnisAPR();
    } else if (protocol.name === 'Echelon') {
      const fetchEchelonAPY = async () => {
        try {
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
              } else {
              }
            }
          }
        } catch (error) {
          console.error('Error fetching Echelon APR:', error);
        }
      };
      
      fetchEchelonAPY();
    } else if (protocol.name === 'Kofi Finance') {
      const fetchKofiAPY = async () => {
        try {
          const response = await fetch('/api/protocols/kofi/pools');
          if (response.ok) {
            const data = await response.json();
            if (data.success && data.data && data.data.length > 0) {
              // Find stkAPT staking pool
              const stkAPTPool = data.data.find((pool: any) => 
                pool.stakingToken === 'stkAPT' || pool.asset?.includes('stkAPT')
              );
              if (stkAPTPool && stkAPTPool.stakingApr) {
                setProtocolAPY(stkAPTPool.stakingApr);
              } else {
              }
            }
          }
        } catch (error) {
          console.error('Error fetching Kofi Finance APR:', error);
        }
      };
      
      fetchKofiAPY();
    }
  }, [protocol.name, tokenIn?.address]);

  const handleClick = () => {
    
    if (protocol.depositType === 'external') {
      setIsExternalDialogOpen(true);
    } else if (protocol.depositType === 'native' && tokenIn && balance) {
      setIsNativeDialogOpen(true);
    } else {
    }
  };

  const handleExternalConfirm = () => {
    if (protocol.depositUrl) {
      window.open(protocol.depositUrl, '_blank');
    }
    setIsExternalDialogOpen(false);
  };

  const handleNativeConfirm = (data: { amount: bigint }) => {
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
              return protocolAPY;
            })(),
            key: protocol.key
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
          poolAddress={(() => {
            console.log('🔍 DEPOSIT BUTTON DEBUG - poolAddress received:', poolAddress);
            console.log('🔍 DEPOSIT BUTTON DEBUG - protocol:', protocol.name);
            return poolAddress;
          })()}
        />
      )}
    </>
  );
} 