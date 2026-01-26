"use client";

import {
  APTOS_CONNECT_ACCOUNT_URL,
  AboutAptosConnect,
  AboutAptosConnectEducationScreen,
  AdapterNotDetectedWallet,
  AdapterWallet,
  AptosPrivacyPolicy,
  WalletItem,
  WalletSortingOptions,
  groupAndSortWallets,
  isAptosConnectWallet,
  isInstallRequired,
  truncateAddress,
  useWallet,
} from "@aptos-labs/wallet-adapter-react";
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  Copy,
  LogOut,
  User,
  Loader2,
} from "lucide-react";
import { useCallback, useState, useEffect, useMemo } from "react";
import { Button } from "./ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { useToast } from "./ui/use-toast";
import { getSolanaWalletAddress } from "@/lib/wallet/getSolanaWalletAddress";

export function WalletSelector(walletSortingOptions: WalletSortingOptions) {
  const { account, connected, disconnect, wallet } = useWallet();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const { toast } = useToast();

  const solanaAddress = useMemo(() => getSolanaWalletAddress(wallet), [wallet]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Reset connecting state when wallet connects
  useEffect(() => {
    if (connected) {
      // connecting state from wallet adapter will be reset automatically
    }
  }, [connected]);

  const closeDialog = useCallback(() => setIsDialogOpen(false), []);

  const copyAddress = useCallback(async () => {
    if (!account?.address) return;
    try {
      await navigator.clipboard.writeText(account.address.toString());
      toast({
        title: "Success",
        description: "Copied wallet address to clipboard",
      });
    } catch {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to copy wallet address",
      });
    }
  }, [account?.address, toast]);

  const copySolanaAddress = useCallback(async () => {
    if (!solanaAddress) return;
    try {
      await navigator.clipboard.writeText(solanaAddress);
      toast({
        title: "Success",
        description: "Copied Solana address to clipboard",
      });
    } catch {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to copy Solana address",
      });
    }
  }, [solanaAddress, toast]);

  const handleDisconnect = useCallback(async () => {
    try {
      if (connected) {
        await disconnect();
        toast({
          title: "Success",
          description: "Wallet disconnected successfully",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to disconnect wallet",
      });
    }
  }, [connected, disconnect, toast]);

  if (!mounted) {
    return null;
  }

  return connected ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button>
          {account?.ansName ||
            truncateAddress(account?.address?.toString()) ||
            "Unknown"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {solanaAddress && (
          <div className="px-4 py-3 text-sm">
            <p className="text-xs uppercase text-muted-foreground">
              Cross-chain Solana wallet
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span className="font-mono text-xs">
                {truncateAddress(solanaAddress)}
              </span>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={copySolanaAddress}
                aria-label="Copy Solana address"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
        <DropdownMenuItem onSelect={copyAddress} className="gap-2">
          <Copy className="h-4 w-4" /> Copy address
        </DropdownMenuItem>
        {wallet && isAptosConnectWallet(wallet) && (
          <DropdownMenuItem asChild>
            <a
              href={APTOS_CONNECT_ACCOUNT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex gap-2"
            >
              <User className="h-4 w-4" /> Account
            </a>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={handleDisconnect} className="gap-2">
          <LogOut className="h-4 w-4" /> Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ) : (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button disabled={isConnecting}>
          {isConnecting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Connecting...
            </>
          ) : (
            'Connect Wallet'
          )}
        </Button>
      </DialogTrigger>
      <ConnectWalletDialog close={closeDialog} isConnecting={isConnecting} {...walletSortingOptions} />
    </Dialog>

    
  );
}

interface ConnectWalletDialogProps extends WalletSortingOptions {
  close: () => void;
  isConnecting?: boolean;
}

function ConnectWalletDialog({
  close,
  isConnecting = false,
  ...walletSortingOptions
}: ConnectWalletDialogProps) {
  const { wallets = [], notDetectedWallets = [] } = useWallet();

  const { aptosConnectWallets, availableWallets, installableWallets } =
    groupAndSortWallets(
      [...wallets, ...notDetectedWallets],
      walletSortingOptions
    );

  const hasAptosConnectWallets = !!aptosConnectWallets.length;

  return (
    <DialogContent className="max-h-screen overflow-auto">
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
                isConnecting={isConnecting}
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
            <WalletRow key={wallet.name} wallet={wallet} onConnect={close} isConnecting={isConnecting} />
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
                    isConnecting={isConnecting}
                  />
                ))}
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      </AboutAptosConnect>
    </DialogContent>
  );
}

interface WalletRowProps {
  wallet: AdapterWallet | AdapterNotDetectedWallet;
  onConnect?: () => void;
}

interface WalletRowProps {
  wallet: AdapterWallet | AdapterNotDetectedWallet;
  onConnect?: () => void;
  isConnecting?: boolean;
}

function WalletRow({ wallet, onConnect, isConnecting = false }: WalletRowProps) {
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
          <Button size="sm" disabled={isConnecting}>
            {isConnecting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Connecting...
              </>
            ) : (
              'Connect'
            )}
          </Button>
        </WalletItem.ConnectButton>
      )}
    </WalletItem>
  );
}

function AptosConnectWalletRow({ wallet, onConnect, isConnecting = false }: WalletRowProps) {
  return (
    <WalletItem wallet={wallet} onConnect={onConnect}>
      <WalletItem.ConnectButton asChild>
        <Button size="lg" variant="outline" className="w-full gap-4" disabled={isConnecting}>
          {isConnecting ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-base font-normal">Connecting...</span>
            </>
          ) : (
            <>
              <WalletItem.Icon className="h-5 w-5" />
              <WalletItem.Name className="text-base font-normal" />
            </>
          )}
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
