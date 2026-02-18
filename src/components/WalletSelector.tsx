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
import { useWallet as useSolanaWallet } from "@solana/wallet-adapter-react";
import { WalletReadyState, WalletName } from "@solana/wallet-adapter-base";
import { DialogDescription } from "./ui/dialog";
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
import { isDerivedAptosWalletReliable } from "@/lib/aptosWalletUtils";

interface WalletSelectorProps extends WalletSortingOptions {
  /** External control for dialog open state */
  externalOpen?: boolean;
  /** Callback when dialog open state changes (for external control) */
  onExternalOpenChange?: (open: boolean) => void;
}

export function WalletSelector({ externalOpen, onExternalOpenChange, ...walletSortingOptions }: WalletSelectorProps) {
  const { account, connected: aptosConnected, disconnect, wallet } = useWallet();
  const { publicKey: solanaPublicKey, connected: solanaConnected, wallet: solanaWallet, disconnect: disconnectSolana, wallets: solanaWallets, select: selectSolana, connect: connectSolana } = useSolanaWallet();
  const [internalDialogOpen, setInternalDialogOpen] = useState(false);
  
  // Use external control if provided, otherwise use internal state
  const isDialogOpen = externalOpen !== undefined ? externalOpen : internalDialogOpen;
  const setIsDialogOpen = onExternalOpenChange !== undefined ? onExternalOpenChange : setInternalDialogOpen;
  const [mounted, setMounted] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSolanaDialogOpen, setIsSolanaDialogOpen] = useState(false);
  const [isSolanaConnecting, setIsSolanaConnecting] = useState(false);
  const { toast } = useToast();

  // Cross-chain Solana address (from Aptos derived wallet)
  const crossChainSolanaAddress = useMemo(() => getSolanaWalletAddress(wallet), [wallet]);
  
  // Direct Solana address (from Solana adapter)
  const directSolanaAddress = useMemo(() => solanaPublicKey?.toBase58() ?? null, [solanaPublicKey]);
  
  // Also check adapter state directly for Phantom
  const adapterSolanaAddress = useMemo(() => solanaWallet?.adapter?.publicKey?.toBase58() ?? null, [solanaWallet]);
  
  // Polled address state for Phantom (which doesn't trigger React updates properly)
  const [polledSolanaAddress, setPolledSolanaAddress] = useState<string | null>(null);
  
  // Effective Solana address - prefer cross-chain, then direct, then adapter, then polled
  const solanaAddress = crossChainSolanaAddress ?? directSolanaAddress ?? adapterSolanaAddress ?? polledSolanaAddress;
  
  // Check if any wallet is connected
  const isAnyWalletConnected = aptosConnected || solanaConnected || !!solanaAddress;

  useEffect(() => {
    setMounted(true);
  }, []);

  // Poll adapter state for Phantom (which doesn't trigger React state updates properly)
  useEffect(() => {
    if (!solanaWallet?.adapter) return;
    
    // If we already have an address from other sources, no need to poll
    if (crossChainSolanaAddress || directSolanaAddress || adapterSolanaAddress) {
      setPolledSolanaAddress(null);
      return;
    }
    
    const checkAdapter = () => {
      const adapterPk = solanaWallet.adapter.publicKey?.toBase58() ?? null;
      if (adapterPk && adapterPk !== polledSolanaAddress) {
        console.log('[WalletSelector] Adapter publicKey detected via polling:', adapterPk);
        setPolledSolanaAddress(adapterPk);
      }
    };
    
    // Check immediately and then poll
    checkAdapter();
    const interval = setInterval(checkAdapter, 500);
    
    // Stop polling after 10 seconds
    const timeout = setTimeout(() => clearInterval(interval), 10000);
    
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [solanaWallet, crossChainSolanaAddress, directSolanaAddress, adapterSolanaAddress, polledSolanaAddress]);

  // Reset connecting state when wallet connects
  useEffect(() => {
    if (aptosConnected || solanaConnected) {
      // connecting state from wallet adapter will be reset automatically
    }
  }, [aptosConnected, solanaConnected]);

  const closeDialog = useCallback(() => setIsDialogOpen(false), []);
  const closeSolanaDialog = useCallback(() => setIsSolanaDialogOpen(false), []);

  // Available Solana wallets (excluding not detected)
  const availableSolanaWallets = useMemo(() => {
    const filtered = solanaWallets.filter(
      (w) => w.readyState !== WalletReadyState.NotDetected
    );
    // Remove duplicates by name
    const seen = new Set<string>();
    return filtered.filter((w) => {
      const name = w.adapter.name;
      if (seen.has(name)) return false;
      seen.add(name);
      return true;
    });
  }, [solanaWallets]);

  // Handle Solana wallet selection
  const handleSolanaWalletSelect = useCallback(async (walletName: string) => {
    try {
      setIsSolanaConnecting(true);
      // Clear skip flags so derived Aptos auto-connects for the new Solana wallet
      // Also set walletName synchronously BEFORE selectSolana (React state update is async,
      // so localStorage might not be written immediately by the adapter)
      if (typeof window !== "undefined") {
        try {
          window.sessionStorage.removeItem("skip_auto_connect_solana");
          window.sessionStorage.removeItem("skip_auto_connect_derived_aptos");
          window.localStorage.setItem("walletName", JSON.stringify(walletName));
        } catch {}
      }
      selectSolana(walletName as WalletName);
      setIsSolanaDialogOpen(false);
      
      // Auto-connect after selection
      setTimeout(async () => {
        try {
          await connectSolana();
          toast({
            title: "Wallet Connected",
            description: `Connected to ${walletName}`,
          });
        } catch (err: unknown) {
          // Don't show toast — connection often succeeds via restore mechanism
          // even when connectSolana() throws (race condition with Phantom etc.)
          const message = err instanceof Error ? err.message : String(err);
          console.log('[WalletSelector] connectSolana failed (suppressed):', message);
        } finally {
          setIsSolanaConnecting(false);
        }
      }, 100);
    } catch (err: unknown) {
      setIsSolanaConnecting(false);
      toast({
        variant: "destructive",
        title: "Selection Failed",
        description: err instanceof Error ? err.message : "Failed to select wallet",
      });
    }
  }, [selectSolana, connectSolana, toast, solanaWallet]);

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
      // Disconnect both Aptos and Solana if connected
      if (aptosConnected) {
        await disconnect();
      }
      if (solanaConnected) {
        await disconnectSolana();
      }
      toast({
        title: "Success",
        description: "Wallet disconnected successfully",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to disconnect wallet",
      });
    }
  }, [aptosConnected, solanaConnected, disconnect, disconnectSolana, toast]);

  // Handler for disconnecting only Solana (mirrors /bridge handleDisconnectSolana)
  const handleDisconnectSolanaOnly = useCallback(async () => {
    try {
      // Determine if current Aptos is derived
      const isAptosDerived = aptosConnected && wallet && isDerivedAptosWalletReliable(wallet);
      
      // Get native Aptos name (if any) to preserve it
      let savedAptosNativeName: string | null = null;
      if (typeof window !== "undefined") {
        const rawAptos = window.localStorage.getItem("AptosWalletName");
        if (rawAptos) {
          try {
            let parsed = rawAptos;
            try { parsed = JSON.parse(rawAptos) as string; } catch {}
            if (parsed && !parsed.endsWith(' (Solana)')) {
              savedAptosNativeName = parsed;
            }
          } catch {}
        }
      }
      if (!savedAptosNativeName && wallet?.name && !wallet.name.endsWith(' (Solana)') && aptosConnected) {
        savedAptosNativeName = wallet.name;
      }
      
      console.log('[WalletSelector] handleDisconnectSolanaOnly:', { isAptosDerived, savedAptosNativeName });
      
      // Set skip flags BEFORE disconnect
      if (typeof window !== "undefined") {
        try { window.sessionStorage.setItem("skip_auto_connect_solana", "1"); } catch {}
      }
      
      // If Aptos is derived, disconnect it first (it depends on Solana)
      if (isAptosDerived) {
        console.log('[WalletSelector] Disconnecting derived Aptos before Solana');
        if (typeof window !== "undefined") {
          try {
            sessionStorage.setItem("skip_auto_connect_derived_aptos", "1");
          } catch {}
        }
        try {
          await disconnect();
        } catch (e) {
          console.log('[WalletSelector] disconnect derived Aptos error (benign):', e);
        }
        if (typeof window !== "undefined") {
          try { window.localStorage.removeItem("AptosWalletName"); } catch {}
        }
      }
      
      // Disconnect Solana
      if (solanaConnected) {
        await disconnectSolana();
      }
      
      // Clean up localStorage
      if (typeof window !== "undefined") {
        try { window.localStorage.removeItem("walletName"); } catch {}
      }
      
      toast({ title: "Success", description: "Solana wallet disconnected" });
      
      // If native Aptos was connected, ensure its AptosWalletName is preserved
      // (cascade disconnect from Solana might have cleared it)
      if (savedAptosNativeName) {
        setTimeout(() => {
          if (typeof window !== "undefined") {
            try { window.localStorage.setItem("AptosWalletName", savedAptosNativeName!); } catch {}
          }
        }, 500);
      }
      
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to disconnect Solana wallet",
      });
    }
  }, [solanaConnected, aptosConnected, wallet, disconnectSolana, disconnect, toast]);

  // Handler for disconnecting only Aptos (mirrors /bridge handleDisconnectAptos)
  const handleDisconnectAptosOnly = useCallback(async () => {
    const isDerived = wallet && isDerivedAptosWalletReliable(wallet);
    console.log('[WalletSelector] handleDisconnectAptosOnly:', { isDerived, walletName: wallet?.name });
    
    // Set skip flag to prevent derived auto-reconnect
    if (typeof window !== "undefined") {
      try {
        sessionStorage.setItem("skip_auto_connect_derived_aptos", "1");
      } catch {}
    }
    
    // Remove AptosWalletName from localStorage BEFORE disconnect
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem("AptosWalletName");
        // Clear Solana skip flag so Solana can restore if needed
        window.sessionStorage.removeItem("skip_auto_connect_solana");
      } catch {}
    }
    
    // Save Solana wallet name in case derived disconnect cascades
    let savedSolanaName: string | null = null;
    if (isDerived && typeof window !== "undefined") {
      const fromAdapter = solanaWallet?.adapter?.name;
      const fromStorage = window.localStorage.getItem("walletName");
      let raw = fromAdapter ?? fromStorage;
      if (typeof raw === "string" && raw.startsWith('"') && raw.endsWith('"')) {
        try { raw = JSON.parse(raw) as string; } catch {}
      }
      savedSolanaName = (typeof raw === "string" ? raw.trim() : null) || null;
    }
    
    let disconnectSucceeded = false;
    
    try {
      if (aptosConnected) {
        await disconnect();
      }
      disconnectSucceeded = true;
      toast({ title: "Success", description: "Aptos wallet disconnected" });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      const name = (error as { name?: string })?.name;
      const isBenign =
        name === "WalletDisconnectedError" ||
        name === "WalletNotConnectedError" ||
        msg.includes("WalletDisconnectedError") ||
        msg.includes("WalletNotConnectedError");
      const isUserRejected =
        msg === "User has rejected the request" ||
        msg.includes("User rejected") ||
        msg.includes("rejected the request");
      const isDerivedSoftError = isDerived && !isUserRejected;
      
      console.log('[WalletSelector] disconnect Aptos error:', { msg, isBenign, isDerivedSoftError, isUserRejected });
      
      if (isUserRejected) {
        return; // User rejected - don't continue
      } else if (isBenign || isDerivedSoftError) {
        disconnectSucceeded = true;
        toast({ title: "Success", description: "Aptos wallet disconnected" });
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: msg || "Failed to disconnect Aptos wallet",
        });
        return;
      }
    }
    
    // Restore Solana if derived disconnect cascaded and cleared walletName
    if (disconnectSucceeded && isDerived && savedSolanaName && typeof window !== "undefined") {
      // Clear skip flag so SolanaWalletRestore can reconnect
      try { window.sessionStorage.removeItem("skip_auto_connect_solana"); } catch {}
      
      const restoreSolana = (attempt: number) => {
        try {
          const currentWalletName = window.localStorage.getItem("walletName");
          const adapterConnected = solanaWallet?.adapter?.connected ?? false;
          console.log(`[WalletSelector] Solana restore check (attempt ${attempt}):`, { savedSolanaName, currentWalletName, adapterConnected });
          
          if (!currentWalletName || !adapterConnected) {
            console.log('[WalletSelector] Restoring Solana walletName:', savedSolanaName);
            window.localStorage.setItem("walletName", JSON.stringify(savedSolanaName));
            // Also try to re-select and connect the wallet directly
            const targetWallet = solanaWallets.find(w => w.adapter.name === savedSolanaName);
            if (targetWallet) {
              selectSolana(savedSolanaName as any);
              setTimeout(async () => {
                try {
                  await connectSolana();
                  console.log('[WalletSelector] Solana reconnected after derived Aptos disconnect');
                } catch (e) {
                  console.log('[WalletSelector] Solana reconnect attempt failed (benign):', e);
                }
              }, 200);
            }
          }
        } catch (e) {
          console.log('[WalletSelector] Error restoring Solana:', e);
        }
      };
      
      // Try at multiple intervals — cascade disconnect is async
      setTimeout(() => restoreSolana(1), 500);
      setTimeout(() => restoreSolana(2), 1500);
      setTimeout(() => restoreSolana(3), 3000);
    }
  }, [aptosConnected, wallet, solanaWallet, solanaWallets, selectSolana, connectSolana, disconnect, toast]);

  if (!mounted) {
    return null;
  }

  // Determine what address to show in the button
  const displayAddress = account?.ansName || 
    truncateAddress(account?.address?.toString()) || 
    (solanaAddress ? truncateAddress(solanaAddress) : null) ||
    "Unknown";

  return (
    <>
      {isAnyWalletConnected ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button>
              {displayAddress}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            {/* Solana Block */}
            <div className="px-3 py-2 border-b">
              <p className="text-xs font-medium uppercase text-muted-foreground mb-2">
                Solana
              </p>
              {solanaAddress ? (
                <>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-mono text-sm truncate">
                      {truncateAddress(solanaAddress)}
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 shrink-0"
                      onClick={copySolanaAddress}
                      aria-label="Copy Solana address"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
                    onClick={handleDisconnectSolanaOnly}
                  >
                    <LogOut className="h-4 w-4" /> Disconnect
                  </Button>
                </>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start gap-2"
                  onClick={() => setIsSolanaDialogOpen(true)}
                >
                  Connect Solana
                </Button>
              )}
            </div>

            {/* Aptos Block */}
            <div className="px-3 py-2">
              <p className="text-xs font-medium uppercase text-muted-foreground mb-2">
                Aptos
              </p>
              {aptosConnected && account?.address ? (
                <>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-mono text-sm truncate">
                      {truncateAddress(account.address.toString())}
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 shrink-0"
                      onClick={copyAddress}
                      aria-label="Copy Aptos address"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
                    onClick={handleDisconnectAptosOnly}
                  >
                    <LogOut className="h-4 w-4" /> Disconnect
                  </Button>
                </>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start gap-2"
                  onClick={() => setIsDialogOpen(true)}
                >
                  Connect Aptos
                </Button>
              )}
            </div>
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
      )}

      {/* Dialog for connecting Aptos wallets (external control) - always render for external open */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <ConnectWalletDialog close={closeDialog} isConnecting={isConnecting} {...walletSortingOptions} />
      </Dialog>

      {/* Dialog for connecting Solana wallets */}
      <Dialog open={isSolanaDialogOpen} onOpenChange={setIsSolanaDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select Solana Wallet</DialogTitle>
            <DialogDescription>
              Choose a wallet to connect to your Solana account
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 mt-4">
            {availableSolanaWallets.length === 0 ? (
              <div className="text-sm text-muted-foreground p-4 text-center">
                No Solana wallets detected. Please install a wallet extension.
              </div>
            ) : (
              availableSolanaWallets.map((w, i) => (
                <Button
                  key={`${w.adapter.name}-${i}`}
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => handleSolanaWalletSelect(w.adapter.name)}
                  disabled={isSolanaConnecting}
                >
                  <div className="flex items-center gap-2">
                    {w.adapter.icon && (
                      <img src={w.adapter.icon} alt={w.adapter.name} className="w-6 h-6" />
                    )}
                    <span>{w.adapter.name}</span>
                    {w.readyState === WalletReadyState.Loadable && (
                      <span className="ml-auto text-xs text-muted-foreground">(Install)</span>
                    )}
                  </div>
                </Button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
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
