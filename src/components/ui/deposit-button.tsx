import { Button } from "@/components/ui/button";
import { ExternalLink, ArrowLeft, ArrowRight, ChevronDown } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useState, useEffect, useCallback } from "react";
import { DepositModal } from "./deposit-modal";
import { useWalletData } from "@/contexts/WalletContext";
import { cn } from "@/lib/utils";
import {
  useWallet,
  AboutAptosConnect,
  AboutAptosConnectEducationScreen,
  AdapterNotDetectedWallet,
  AdapterWallet,
  AptosPrivacyPolicy,
  WalletItem,
  groupAndSortWallets,
  isInstallRequired,
} from "@aptos-labs/wallet-adapter-react";

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
  const [isWalletDialogOpen, setIsWalletDialogOpen] = useState(false);
  const [protocolAPY, setProtocolAPY] = useState<number>(0); // No fallback - use real APR from API
  const walletData = useWalletData();
  const { connected } = useWallet();

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
    } else if (protocol.name === 'Moar Market') {
      const fetchMoarAPY = async () => {
        try {
          const response = await fetch('/api/protocols/moar/pools');
          if (response.ok) {
            const data = await response.json();
            if (data.success && data.data && data.data.length > 0) {
              // Find the pool for this specific token
              const pool = data.data.find((pool: any) =>
                pool.token === tokenIn?.address
              );
              if (pool && pool.totalAPY) {
                setProtocolAPY(pool.totalAPY);
              }
            }
          }
        } catch (error) {
          console.error('Error fetching Moar Market APR:', error);
        }
      };

      fetchMoarAPY();
    } else if (protocol.name === 'Auro Finance') {
      const fetchAuroAPY = async () => {
        try {
          const response = await fetch('/api/protocols/auro/pools');
          if (response.ok) {
            const data = await response.json();
            if (data.success && data.data && data.data.length > 0) {
              // Find the pool for this specific token - only COLLATERAL type
              const pool = data.data.find((pool: any) =>
                pool.type === 'COLLATERAL' && pool.collateralTokenAddress === tokenIn?.address
              );
              if (pool && pool.totalSupplyApr) {
                setProtocolAPY(pool.totalSupplyApr);
              }
            }
          }
        } catch (error) {
          console.error('Error fetching Auro Finance APR:', error);
        }
      };

      fetchAuroAPY();
    }
  }, [protocol.name, tokenIn?.address]);

  // Закрываем диалог подключения кошелька, когда кошелек подключится
  useEffect(() => {
    if (connected && isWalletDialogOpen) {
      setIsWalletDialogOpen(false);
    }
  }, [connected, isWalletDialogOpen]);

  const handleClick = () => {
    // Если кошелек не подключен, открываем диалог подключения
    if (!connected) {
      setIsWalletDialogOpen(true);
      return;
    }

    if (protocol.depositType === 'external') {
      setIsExternalDialogOpen(true);
    } else if (protocol.depositType === 'native' && tokenIn && balance) {
      setIsNativeDialogOpen(true);
    } else {
    }
  };

  const closeWalletDialog = useCallback(() => setIsWalletDialogOpen(false), []);

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
        poolAddress={poolAddress}
        />
      )}

      <Dialog open={isWalletDialogOpen} onOpenChange={setIsWalletDialogOpen}>
        <DialogContent className="max-h-screen overflow-auto">
          <ConnectWalletDialog close={closeWalletDialog} />
        </DialogContent>
      </Dialog>
    </>
  );
}

interface ConnectWalletDialogProps {
  close: () => void;
}

function ConnectWalletDialog({ close }: ConnectWalletDialogProps) {
  const { wallets = [], notDetectedWallets = [] } = useWallet();

  const { aptosConnectWallets, availableWallets, installableWallets } =
    groupAndSortWallets(
      [...wallets, ...notDetectedWallets],
      {}
    );

  const hasAptosConnectWallets = !!aptosConnectWallets.length;

  return (
    <AboutAptosConnect renderEducationScreen={renderEducationScreen}>
      <DialogHeader>
        <DialogTitle className="flex flex-col text-center leading-snug">
          {hasAptosConnectWallets ? (
            <>
              <span>Log in or sign up</span>
              <span>with Social + Aptos Connect</span>
            </>
          ) : (
            "Connect Wallet"
          )}
        </DialogTitle>
      </DialogHeader>

      {hasAptosConnectWallets && (
        <div className="flex flex-col gap-2 pt-3">
          {aptosConnectWallets.map((wallet) => (
            <AptosConnectWalletRow
              key={wallet.name}
              wallet={wallet}
              onConnect={close}
            />
          ))}
          <p className="flex gap-1 justify-center items-center text-muted-foreground text-sm">
            Learn more about{" "}
            <AboutAptosConnect.Trigger className="flex gap-1 py-3 items-center text-foreground">
              Aptos Connect <ArrowRight size={16} />
            </AboutAptosConnect.Trigger>
          </p>
          <AptosPrivacyPolicy className="flex flex-col items-center py-1">
            <p className="text-xs leading-5">
              <AptosPrivacyPolicy.Disclaimer />{" "}
              <AptosPrivacyPolicy.Link className="text-muted-foreground underline underline-offset-4" />
              <span className="text-muted-foreground">.</span>
            </p>
            <AptosPrivacyPolicy.PoweredBy className="flex gap-1.5 items-center text-xs leading-5 text-muted-foreground" />
          </AptosPrivacyPolicy>
          <div className="flex items-center gap-3 pt-4 text-muted-foreground">
            <div className="h-px w-full bg-secondary" />
            Or
            <div className="h-px w-full bg-secondary" />
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 pt-3">
        {availableWallets.map((wallet) => (
          <WalletRow key={wallet.name} wallet={wallet} onConnect={close} />
        ))}
        {!!installableWallets.length && (
          <Collapsible className="flex flex-col gap-3">
            <CollapsibleTrigger asChild>
              <Button size="sm" variant="ghost" className="gap-2">
                More wallets <ChevronDown />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="flex flex-col gap-3">
              {installableWallets.map((wallet) => (
                <WalletRow
                  key={wallet.name}
                  wallet={wallet}
                  onConnect={close}
                />
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    </AboutAptosConnect>
  );
}

interface WalletRowProps {
  wallet: AdapterWallet | AdapterNotDetectedWallet;
  onConnect?: () => void;
}

function WalletRow({ wallet, onConnect }: WalletRowProps) {
  return (
    <WalletItem
      wallet={wallet}
      onConnect={onConnect}
      className="flex items-center justify-between px-4 py-3 gap-4 border rounded-md"
    >
      <div className="flex items-center gap-4">
        <WalletItem.Icon className="h-6 w-6" />
        <WalletItem.Name className="text-base font-normal" />
      </div>
      {isInstallRequired(wallet) ? (
        <Button size="sm" variant="ghost" asChild>
          <WalletItem.InstallLink />
        </Button>
      ) : (
        <WalletItem.ConnectButton asChild>
          <Button size="sm">Connect</Button>
        </WalletItem.ConnectButton>
      )}
    </WalletItem>
  );
}

function AptosConnectWalletRow({ wallet, onConnect }: WalletRowProps) {
  return (
    <WalletItem wallet={wallet} onConnect={onConnect}>
      <WalletItem.ConnectButton asChild>
        <Button size="lg" variant="outline" className="w-full gap-4">
          <WalletItem.Icon className="h-5 w-5" />
          <WalletItem.Name className="text-base font-normal" />
        </Button>
      </WalletItem.ConnectButton>
    </WalletItem>
  );
}

function renderEducationScreen(screen: AboutAptosConnectEducationScreen) {
  return (
    <>
      <DialogHeader className="grid grid-cols-[1fr_4fr_1fr] items-center space-y-0">
        <Button variant="ghost" size="icon" onClick={screen.cancel}>
          <ArrowLeft />
        </Button>
        <DialogTitle className="leading-snug text-base text-center">
          About Aptos Connect
        </DialogTitle>
      </DialogHeader>

      <div className="flex h-[162px] pb-3 items-end justify-center">
        <screen.Graphic />
      </div>
      <div className="flex flex-col gap-2 text-center pb-4">
        <screen.Title className="text-xl" />
        <screen.Description className="text-sm text-muted-foreground [&>a]:underline [&>a]:underline-offset-4 [&>a]:text-foreground" />
      </div>

      <div className="grid grid-cols-3 items-center">
        <Button
          size="sm"
          variant="ghost"
          onClick={screen.back}
          className="justify-self-start"
        >
          Back
        </Button>
        <div className="flex items-center gap-2 place-self-center">
          {screen.screenIndicators.map((ScreenIndicator, i) => (
            <ScreenIndicator key={i} className="py-4">
              <div className="h-0.5 w-6 transition-colors bg-muted [[data-active]>&]:bg-foreground" />
            </ScreenIndicator>
          ))}
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={screen.next}
          className="gap-2 justify-self-end"
        >
          {screen.screenIndex === screen.totalScreens - 1 ? "Finish" : "Next"}
          <ArrowRight size={16} />
        </Button>
      </div>
    </>
  );
}
