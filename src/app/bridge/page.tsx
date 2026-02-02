"use client";

import { useState, useEffect, useRef, Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Copy, LogOut, ChevronDown, Loader2 } from 'lucide-react';
import { BridgeView } from '@/components/bridge/BridgeView';
import { useWallet as useSolanaWallet } from '@solana/wallet-adapter-react';
import { useWallet as useAptosWallet } from '@aptos-labs/wallet-adapter-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/ui/use-toast';
import { SolanaWalletSelector } from '@/components/SolanaWalletSelector';
import { WalletSelector } from '@/components/WalletSelector';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletReadyState, WalletName } from '@solana/wallet-adapter-base';
import { useSolanaPortfolio } from '@/hooks/useSolanaPortfolio';
import { AptosPortfolioService } from '@/lib/services/aptos/portfolio';
import { Token } from '@/lib/types/token';
import { TokenList } from '@/components/portfolio/TokenList';
import { formatCurrency } from '@/lib/utils/numberFormat';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { executeSolanaToAptosBridge } from '@/components/bridge/SolanaToAptosBridge';
import { executeAptosToSolanaBridge } from '@/components/bridge/AptosToSolanaBridge';
import { executeAptosNativeToSolanaBridge } from '@/components/bridge/AptosNativeToSolanaBridge';
import { isDerivedAptosWallet, isDerivedAptosWalletReliable, getAptosWalletNameFromStorage } from '@/lib/aptosWalletUtils';
import { ActionLog, type ActionLogItem } from '@/components/bridge/ActionLog';
import { useAptosClient } from '@/contexts/AptosClientContext';
import { GasStationService } from '@/lib/services/gasStation';
import { performMintOnSolana } from '@/lib/cctp-mint-core';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog';

// USDC token addresses
const USDC_SOLANA = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'; // USDC on Solana
const USDC_APTOS = '0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b'; // USDC on Aptos

// Chains configuration
const CHAINS = [
  { id: 'Solana', name: 'Solana' },
  { id: 'Aptos', name: 'Aptos' },
];

// Tokens configuration
const TOKENS = [
  {
    id: USDC_SOLANA,
    symbol: 'USDC',
    name: 'USD Coin',
    chain: 'Solana',
  },
  {
    id: USDC_APTOS,
    symbol: 'USDC',
    name: 'USD Coin',
    chain: 'Aptos',
  },
];

function BridgePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  // Wallet connections
  const { publicKey: solanaPublicKey, connected: solanaConnected, disconnect: disconnectSolana, wallet: solanaWallet, wallets, select, connect: connectSolana, signTransaction: signSolanaTransaction, signMessage: signSolanaMessage } = useSolanaWallet();
  const { connection: solanaConnection } = useConnection();
  const { account: aptosAccount, connected: aptosConnected, wallet: aptosWallet, wallets: aptosWallets, connect: connectAptos, disconnect: disconnectAptos } = useAptosWallet();

  // Re-check both wallets before mint (state may be lost during attestation wait)
  const solanaConnectedRef = useRef(solanaConnected);
  const solanaPublicKeyRef = useRef(solanaPublicKey);
  const signSolanaTransactionRef = useRef(signSolanaTransaction);
  const solanaWalletRef = useRef(solanaWallet);
  const aptosConnectedRef = useRef(aptosConnected);
  const aptosAccountRef = useRef(aptosAccount);
  useEffect(() => {
    solanaConnectedRef.current = solanaConnected;
    solanaPublicKeyRef.current = solanaPublicKey;
    signSolanaTransactionRef.current = signSolanaTransaction;
    solanaWalletRef.current = solanaWallet;
    aptosConnectedRef.current = aptosConnected;
    aptosAccountRef.current = aptosAccount;
  }, [solanaConnected, solanaPublicKey, signSolanaTransaction, solanaWallet, aptosConnected, aptosAccount]);

  // Solana wallet selector state
  const [isSolanaDialogOpen, setIsSolanaDialogOpen] = useState(false);
  const [isSolanaConnecting, setIsSolanaConnecting] = useState(false);
  // Aptos wallet selector state
  const [isAptosDialogOpen, setIsAptosDialogOpen] = useState(false);
  const [isAptosConnecting, setIsAptosConnecting] = useState(false);

  // Balance expansion state
  const [isSolanaBalanceExpanded, setIsSolanaBalanceExpanded] = useState(false);
  const [isAptosBalanceExpanded, setIsAptosBalanceExpanded] = useState(false);

  // Solana portfolio
  const {
    tokens: solanaTokens,
    totalValueUsd: solanaTotalValue,
    isLoading: isSolanaLoading,
    refresh: refreshSolana,
  } = useSolanaPortfolio();

  // Aptos portfolio state
  const [aptosTokens, setAptosTokens] = useState<Token[]>([]);
  const [aptosTotalValue, setAptosTotalValue] = useState<number>(0);
  const [isAptosLoading, setIsAptosLoading] = useState(false);

  // Form state variables (must be declared before useMemo hooks that use them)
  const [sourceChain, setSourceChain] = useState<typeof CHAINS[0] | null>(CHAINS[0]);
  const [sourceToken, setSourceToken] = useState<typeof TOKENS[0] | null>(
    TOKENS.find((t) => t.chain === 'Solana') || null
  );
  const [destChain, setDestChain] = useState<typeof CHAINS[0] | null>(CHAINS[1]);
  const [destToken, setDestToken] = useState<typeof TOKENS[0] | null>(
    TOKENS.find((t) => t.chain === 'Aptos') || null
  );
  const [transferAmount, setTransferAmount] = useState<string>('0.1');
  const [destinationAddress, setDestinationAddress] = useState<string>('');
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferStatus, setTransferStatus] = useState<string>('');
  const [actionLog, setActionLog] = useState<ActionLogItem[]>([]);
  const [lastSolanaToAptosParams, setLastSolanaToAptosParams] = useState<{ signature: string; finalRecipient: string } | null>(null);
  const [lastAptosToSolanaParams, setLastAptosToSolanaParams] = useState<{ signature: string; finalRecipient: string } | null>(null);

  // Reliable derived vs native: localStorage AptosWalletName first ("X (Solana)" = derived), then wallet.name
  const solanaWalletNameForDerived = (solanaWallet as { adapter?: { name?: string }; name?: string })?.adapter?.name ?? (solanaWallet as { name?: string })?.name ?? '';
  const isDerivedWallet = useMemo(() => {
    if (aptosWallet) {
      if (isDerivedAptosWalletReliable(aptosWallet)) return true;
      return Boolean(solanaWalletNameForDerived && aptosWallet.name === solanaWalletNameForDerived);
    }
    const stored = getAptosWalletNameFromStorage();
    return Boolean(stored != null && stored !== '' && String(stored).trim().endsWith(' (Solana)'));
  }, [aptosWallet, solanaWalletNameForDerived]);

  // Restore Solana wallet from localStorage on bridge load (AptosWalletName e.g. "Trust (Solana)" first, then walletName)
  const hasTriggeredRestore = useRef(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (solanaConnected) return;
    const walletNames = new Set<string>(wallets?.map((w) => String(w.adapter.name)) ?? []);
    let savedName: string | null = null;
    const aptosRaw = window.localStorage.getItem('AptosWalletName');
    if (aptosRaw) {
      try {
        const parsed = JSON.parse(aptosRaw) as string | null;
        const aptosName = typeof parsed === 'string' ? parsed : aptosRaw;
        if (aptosName?.endsWith(' (Solana)')) {
          const name = aptosName.slice(0, -' (Solana)'.length).trim();
          if (name && walletNames.has(name)) savedName = name;
        }
      } catch {}
    }
    if (!savedName) {
      const raw = window.localStorage.getItem('walletName');
      if (raw) {
        try {
          const p = JSON.parse(raw) as string | null;
          if (p && walletNames.has(p)) savedName = p;
        } catch {}
      }
    }
    if (!savedName) return;

    const tryRestore = () => {
      if (solanaConnected || !wallets?.length) return;
      const exists = wallets.some((w) => w.adapter.name === savedName);
      if (!exists) return;
      if (hasTriggeredRestore.current) return;
      hasTriggeredRestore.current = true;
      select(savedName as WalletName);
      setTimeout(() => connectSolana().catch(() => {}), 100);
      setTimeout(() => connectSolana().catch(() => {}), 600);
    };

    tryRestore();
    const t1 = setTimeout(tryRestore, 400);
    const t2 = setTimeout(tryRestore, 1200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [wallets, solanaConnected, select, connectSolana]);

  // Skip auto-connect derived when user explicitly disconnected Aptos (set synchronously on click)
  const skipAutoConnectDerivedRef = useRef(false);
  const hasTriedAutoConnectDerived = useRef(false);
  useEffect(() => {
    if (!aptosConnected || !aptosWallet || typeof window === "undefined") return;
    const derived = isDerivedAptosWalletReliable(aptosWallet) || Boolean(solanaWalletNameForDerived && aptosWallet.name === solanaWalletNameForDerived);
    if (!derived) {
      sessionStorage.removeItem("skip_auto_connect_derived_aptos");
      skipAutoConnectDerivedRef.current = false;
      hasTriedAutoConnectDerived.current = false;
    }
  }, [aptosConnected, aptosWallet, solanaWalletNameForDerived]);
  useEffect(() => {
    if (!solanaConnected || aptosConnected || !aptosWallets?.length || !solanaWallet) return;
    if (skipAutoConnectDerivedRef.current) return;
    if (typeof window !== "undefined" && sessionStorage.getItem("skip_auto_connect_derived_aptos") === "1") return;
    const solanaWalletName = (solanaWallet as { adapter?: { name?: string }; name?: string }).adapter?.name ?? (solanaWallet as { name?: string }).name ?? '';
    const derivedNameForCurrentSolana = `${solanaWalletName} (Solana)`;
    const derived = aptosWallets.find((w) => w.name === derivedNameForCurrentSolana);
    if (derived && !hasTriedAutoConnectDerived.current) {
      hasTriedAutoConnectDerived.current = true;
      connectAptos(derived.name);
    }
  }, [solanaConnected, aptosConnected, aptosWallets, connectAptos, solanaWallet]);

  const aptosClient = useAptosClient();
  const aptosTransactionSubmitter = useMemo(() => GasStationService.getInstance().getTransactionSubmitter(), []);

  // Get Solana address
  const solanaAddress = solanaPublicKey?.toBase58() || null;

  const DOMAIN_APTOS = 9;

  // Check if both wallets are connected
  const bothWalletsConnected = Boolean(solanaConnected && aptosConnected && aptosAccount);

  // Determine missing wallet for alert
  const missingWallet = useMemo(() => {
    if (!solanaConnected) return 'Solana';
    if (!aptosConnected || !aptosAccount) return 'Aptos';
    return null;
  }, [solanaConnected, aptosConnected, aptosAccount]);

  // Check if bridge button should be disabled
  const bridgeButtonDisabled = useMemo(() => {
    if (!bothWalletsConnected) return true;
    if (!sourceChain || !destChain) return true;
    if (sourceChain.id === destChain.id) return true; // Same chain selected
    if (!sourceToken || !destToken) return true;
    if (!transferAmount || !transferAmount.trim()) return true;
    const amountNum = parseFloat(transferAmount);
    if (isNaN(amountNum) || amountNum <= 0) return true;
    return false;
  }, [bothWalletsConnected, sourceChain, destChain, sourceToken, destToken, transferAmount]);

  // Bridge button alert message
  const bridgeButtonAlert = useMemo(() => {
    if (!bothWalletsConnected) return null;
    if (sourceChain && destChain && sourceChain.id === destChain.id) {
      return 'Please select different blockchains for "From" and "To" to enable bridging.';
    }
    return null;
  }, [bothWalletsConnected, sourceChain, destChain]);

  // Copy address handlers
  const copySolanaAddress = async () => {
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
  };

  const copyAptosAddress = async () => {
    if (!aptosAccount?.address) return;
    try {
      await navigator.clipboard.writeText(aptosAccount.address.toString());
      toast({
        title: "Success",
        description: "Copied Aptos address to clipboard",
      });
    } catch {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to copy Aptos address",
      });
    }
  };

  // Disconnect handlers
  const handleDisconnectSolana = async () => {
    try {
      await disconnectSolana();
      toast({
        title: "Success",
        description: "Solana wallet disconnected",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to disconnect Solana wallet",
      });
    }
  };

  const handleDisconnectAptos = async () => {
    skipAutoConnectDerivedRef.current = true;
    if (typeof window !== "undefined") sessionStorage.setItem("skip_auto_connect_derived_aptos", "1");
    try {
      await disconnectAptos();
      toast({
        title: "Success",
        description: "Aptos wallet disconnected",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to disconnect Aptos wallet",
      });
    }
  };

  // Helper to truncate address
  const truncateAddress = (address: string) => {
    if (!address) return '';
    return `${address.slice(0, 8)}...${address.slice(-8)}`;
  };

  // Solana wallet selection logic
  const availableSolanaWallets = useMemo(() => {
    const filtered = wallets.filter(
      (wallet) => wallet.readyState !== WalletReadyState.NotDetected
    );
    const seen = new Set<string>();
    return filtered.filter((wallet) => {
      const name = wallet.adapter.name;
      if (seen.has(name)) {
        return false;
      }
      seen.add(name);
      return true;
    });
  }, [wallets]);

  const handleSolanaWalletSelect = async (walletName: string) => {
    try {
      setIsSolanaConnecting(true);
      select(walletName as WalletName);
      setIsSolanaDialogOpen(false);
      setTimeout(async () => {
        try {
          await connectSolana();
          toast({
            title: "Wallet Connected",
            description: `Connected to ${walletName}`,
          });
        } catch (error: any) {
          toast({
            variant: "destructive",
            title: "Connection Failed",
            description: error.message || "Failed to connect wallet",
          });
        } finally {
          setIsSolanaConnecting(false);
        }
      }, 100);
    } catch (error: any) {
      setIsSolanaConnecting(false);
      toast({
        variant: "destructive",
        title: "Selection Failed",
        description: error.message || "Failed to select wallet",
      });
    }
  };


  // Ensure source and destination chains/tokens are always set
  useEffect(() => {
    if (!sourceChain) {
      setSourceChain(CHAINS[0]); // Solana
    }
    if (!sourceToken) {
      const solanaToken = TOKENS.find((t) => t.chain === 'Solana');
      if (solanaToken) {
        setSourceToken(solanaToken);
      }
    }
    if (!destChain) {
      setDestChain(CHAINS[1]); // Aptos
    }
    if (!destToken) {
      const aptosToken = TOKENS.find((t) => t.chain === 'Aptos');
      if (aptosToken) {
        setDestToken(aptosToken);
      }
    }
  }, []); // Run once on mount

  // Read destination address from query parameter
  useEffect(() => {
    const destination = searchParams.get('destination');
    if (destination) {
      // Decode and set destination address
      const decodedAddress = decodeURIComponent(destination);
      setDestinationAddress(decodedAddress);
    }
  }, [searchParams]);

  // Load Aptos portfolio when wallet is connected
  useEffect(() => {
    const loadAptosPortfolio = async () => {
      if (!aptosAccount?.address) {
        setAptosTokens([]);
        setAptosTotalValue(0);
        return;
      }

      try {
        setIsAptosLoading(true);
        const portfolioService = new AptosPortfolioService();
        const portfolio = await portfolioService.getPortfolio(aptosAccount.address.toString());
        setAptosTokens(portfolio.tokens);
        
        // Calculate total value from tokens
        const total = portfolio.tokens.reduce((sum, token) => {
          return sum + (token.value ? parseFloat(token.value) : 0);
        }, 0);
        setAptosTotalValue(total);
      } catch (error) {
        console.error('Error loading Aptos portfolio:', error);
        setAptosTokens([]);
        setAptosTotalValue(0);
      } finally {
        setIsAptosLoading(false);
      }
    };

    loadAptosPortfolio();
  }, [aptosAccount?.address]);

  // Helper function to add action to log
  const addAction = (message: string, status: 'pending' | 'success' | 'error', link?: string, linkText?: string, startTime?: number) => {
    const now = Date.now();
    const newAction: ActionLogItem = {
      id: now.toString() + Math.random().toString(36).substr(2, 9),
      message,
      status,
      timestamp: new Date(),
      link,
      linkText,
      startTime: startTime || now,
      duration: startTime ? now - startTime : undefined,
    };
    setActionLog(prev => [...prev, newAction]);
    console.log(`[Bridge Action] ${status.toUpperCase()}: ${message}`, link ? `Link: ${link}` : '');
    return newAction.id;
  };

  // Helper function to update last action
  const updateLastAction = (message: string, status: 'pending' | 'success' | 'error', link?: string, linkText?: string) => {
    const now = Date.now();
    setActionLog(prev => {
      const newLog = [...prev];
      if (newLog.length > 0) {
        const lastAction = newLog[newLog.length - 1];
        const startTime = lastAction.startTime || lastAction.timestamp.getTime();
        newLog[newLog.length - 1] = {
          ...lastAction,
          message,
          status,
          link,
          linkText,
          duration: now - startTime,
        };
      }
      return newLog;
    });
  };

  // Handle transfer - route to appropriate bridge component
  const handleTransfer = async () => {
    if (!sourceChain || !destChain || !sourceToken || !destToken) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select source and destination chains/tokens",
      });
      return;
    }

    setIsTransferring(true);
    setTransferStatus('Initializing transfer...');
    setActionLog([]);
    setLastSolanaToAptosParams(null);
    setLastAptosToSolanaParams(null);
    const transferStartTime = Date.now();
    addAction('Initializing transfer...', 'pending', undefined, undefined, transferStartTime);

    try {
      // Determine bridge direction
      const isSolanaToAptos = sourceChain.id === 'Solana' && destChain.id === 'Aptos';
      const isAptosToSolana = sourceChain.id === 'Aptos' && destChain.id === 'Solana';

      if (isSolanaToAptos) {
        // Solana -> Aptos: Use SolanaToAptosBridge
        if (!solanaPublicKey || !signSolanaTransaction || !solanaConnection || !aptosAccount) {
          throw new Error('Please connect both Solana and Aptos wallets');
        }

        setTransferStatus('Starting Solana -> Aptos bridge...');
        updateLastAction('Starting Solana -> Aptos bridge...', 'pending');
        console.log('[Bridge] Solana -> Aptos transfer initiated');

        // Execute burn on Solana
        const burnTxSignature = await executeSolanaToAptosBridge(
          transferAmount,
          solanaPublicKey,
          signSolanaTransaction,
          solanaConnection,
          aptosAccount.address.toString(),
          (status) => {
            setTransferStatus(status);
            updateLastAction(status, 'pending');
          }
        );

        console.log('[Bridge] Burn transaction completed:', burnTxSignature);
        // Last action is "Burn completed! Transaction: ..." (pending) from callback — mark it success
        updateLastAction(
          `Burn completed! Transaction: ${burnTxSignature.slice(0, 8)}...${burnTxSignature.slice(-8)}`,
          'success',
          `https://solscan.io/tx/${burnTxSignature}`,
          'View transaction on Solscan'
        );
        addAction(
          'Burn transaction sent on Solana',
          'success',
          `https://solscan.io/tx/${burnTxSignature}`,
          'View transaction on Solscan'
        );
        setLastSolanaToAptosParams({ signature: burnTxSignature, finalRecipient: aptosAccount.address.toString() });
        setLastAptosToSolanaParams(null);

        // Wait for Solana confirmation
        setTransferStatus('Waiting for Solana transaction confirmation...');
        addAction('Waiting for Solana transaction confirmation...', 'pending');
        
        const waitForSolanaConfirmation = async (): Promise<void> => {
          const { Connection } = await import('@solana/web3.js');
          const connection = solanaConnection || new Connection(
            process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 
            process.env.SOLANA_RPC_URL || 
            'https://mainnet.helius-rpc.com/?api-key=29798653-2d13-4d8a-96ad-df70b015e234',
            'confirmed'
          );

          const maxConfirmationAttempts = 30;
          const confirmationDelay = 2000;

          for (let attempt = 1; attempt <= maxConfirmationAttempts; attempt++) {
            try {
              const txStatus = await connection.getSignatureStatus(burnTxSignature);
              
              if (txStatus?.value?.confirmationStatus === 'finalized' || 
                  txStatus?.value?.confirmationStatus === 'confirmed') {
                updateLastAction(
                  'Solana transaction confirmed',
                  'success',
                  `https://solscan.io/tx/${burnTxSignature}`,
                  'View transaction on Solscan'
                );
                return;
              }
              
              if (txStatus?.value?.err) {
                throw new Error(`Transaction failed: ${JSON.stringify(txStatus.value.err)}`);
              }
              
              if (attempt % 5 === 0) {
                updateLastAction(
                  `Waiting for confirmation... (${attempt}/${maxConfirmationAttempts})`,
                  'pending'
                );
              }
            } catch (error: any) {
              if (attempt === maxConfirmationAttempts) {
                throw new Error(`Failed to confirm transaction: ${error.message}`);
              }
            }
            
            await new Promise(resolve => setTimeout(resolve, confirmationDelay));
          }
          
          throw new Error('Transaction confirmation timeout');
        };

        // Poll for attestation with exponential backoff (same logic as bridge2)
        const pollForAttestation = async (): Promise<void> => {
          const maxAttempts = 15;
          const initialDelay = 10000;
          const maxDelay = 30000;

          await new Promise(resolve => setTimeout(resolve, initialDelay));

          for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            const delay = Math.min(initialDelay * Math.pow(1.5, attempt - 1), maxDelay);
            const attemptStartTime = Date.now();
            
            if (attempt === 1) {
              addAction(
                `Requesting attestation from Circle... (attempt ${attempt}/${maxAttempts})`,
                'pending',
                `https://iris-api.circle.com/v1/messages/5/${burnTxSignature}`,
                'View attestation request',
                attemptStartTime
              );
            } else {
              updateLastAction(
                `Requesting attestation from Circle... (attempt ${attempt}/${maxAttempts})`,
                'pending',
                `https://iris-api.circle.com/v1/messages/5/${burnTxSignature}`,
                'View attestation request'
              );
            }
            
            try {
              const requestBody = {
                signature: burnTxSignature.trim(),
                sourceDomain: '5', // Solana CCTP V1 domain
                finalRecipient: aptosAccount.address.toString().trim(),
              };
              
              console.log(`[Bridge] Calling mint API, attempt ${attempt}/${maxAttempts}`);

              const response = await fetch('/api/aptos/mint-cctp', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
              });

              const data = await response.json();

              // 200 + pending = attestation not ready, retry (no 404 in console)
              if (response.ok && data.data?.pending) {
                if (attempt < maxAttempts) {
                  updateLastAction(
                    `Requesting attestation from Circle... (attempt ${attempt}/${maxAttempts}) — ${data.data?.message || 'waiting'}`,
                    'pending',
                    `https://iris-api.circle.com/v1/messages/5/${burnTxSignature}`,
                    'View attestation request'
                  );
                  await new Promise(resolve => setTimeout(resolve, delay));
                  continue;
                }
              }

              if (response.ok) {
                // Success! Attestation received and minting completed
                updateLastAction(
                  'Attestation received and minting completed',
                  'success',
                  `https://iris-api.circle.com/v1/messages/5/${burnTxSignature}`,
                  'View attestation'
                );
                
                console.log('[Bridge] USDC minted successfully on Aptos', data);
                
                // Add recipient wallet action
                const recipientAddress = data.data?.transaction?.finalRecipient || aptosAccount.address.toString();
                if (recipientAddress) {
                  addAction(
                    'Recipient wallet',
                    'success',
                    `https://explorer.aptoslabs.com/account/${recipientAddress}?network=mainnet`,
                    'View recipient wallet on Aptos Explorer'
                  );
                }
                
                // Add minting action
                const mintTxHash = data.data?.transaction?.hash;
                if (mintTxHash) {
                  addAction(
                    'USDC minted successfully on Aptos',
                    'success',
                    `https://explorer.aptoslabs.com/txn/${mintTxHash}?network=mainnet`,
                    'View mint transaction on Aptos Explorer'
                  );
                }
                
                toast({
                  title: "USDC Minted on Aptos",
                  description: `USDC has been automatically minted on Aptos. Account: ${data.data?.accountAddress || 'N/A'}`,
                });
                setTransferStatus(`Transfer complete! USDC minted on Aptos. Transaction: ${burnTxSignature.slice(0, 8)}...${burnTxSignature.slice(-8)}`);
                return; // Success
              } else {
                const errorMessage = data.error?.message || '';
                const isAttestationError = 
                  errorMessage.includes('404') ||
                  errorMessage.includes('not found') ||
                  errorMessage.includes('EINVALID_ATTESTATION') ||
                  errorMessage.includes('EINVALID_ATTESTATION_LENGTH') ||
                  errorMessage.includes('attestation') ||
                  response.status === 404;

                if (isAttestationError && attempt < maxAttempts) {
                  updateLastAction(
                    `Requesting attestation from Circle... (attempt ${attempt}/${maxAttempts}) - ${errorMessage.substring(0, 50)}${errorMessage.length > 50 ? '...' : ''}`,
                    'pending',
                    `https://iris-api.circle.com/v1/messages/5/${burnTxSignature}`,
                    'View attestation request'
                  );
                  await new Promise(resolve => setTimeout(resolve, delay));
                  continue;
                } else if (attempt < maxAttempts) {
                  updateLastAction(
                    `Requesting attestation from Circle... (attempt ${attempt}/${maxAttempts}) - ${errorMessage.substring(0, 50)}${errorMessage.length > 50 ? '...' : ''}`,
                    'pending',
                    `https://iris-api.circle.com/v1/messages/5/${burnTxSignature}`,
                    'View attestation request'
                  );
                  await new Promise(resolve => setTimeout(resolve, delay));
                  continue;
                } else {
                  updateLastAction(
                    `Requesting attestation from Circle failed. Max attempts reached: ${errorMessage.substring(0, 80)}${errorMessage.length > 80 ? '...' : ''}`,
                    'error',
                    `https://iris-api.circle.com/v1/messages/5/${burnTxSignature}`,
                    'View attestation request'
                  );
                  throw new Error(data.error?.message || 'Failed to get attestation after all attempts');
                }
              }
            } catch (error: any) {
              const errorMessage = error.message || '';
              const isNetworkError = errorMessage.includes('fetch') || 
                                    errorMessage.includes('network') ||
                                    errorMessage.includes('ECONNREFUSED');
              const isAttestationError = errorMessage.includes('EINVALID_ATTESTATION') ||
                                        errorMessage.includes('attestation');
              
              if (attempt < maxAttempts) {
                const errorType = isNetworkError ? 'Network error' : 
                                 isAttestationError ? 'Attestation error' : 
                                 'Error';
                updateLastAction(
                  `Requesting attestation from Circle... (attempt ${attempt}/${maxAttempts}) - ${errorType}: ${errorMessage.substring(0, 50)}${errorMessage.length > 50 ? '...' : ''}`,
                  'pending',
                  `https://iris-api.circle.com/v1/messages/5/${burnTxSignature}`,
                  'View attestation request'
                );
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
              }
              
              updateLastAction(
                `Requesting attestation from Circle failed. Max attempts reached: ${errorMessage.substring(0, 80)}${errorMessage.length > 80 ? '...' : ''}`,
                'error',
                `https://iris-api.circle.com/v1/messages/5/${burnTxSignature}`,
                'View attestation request'
              );
              throw error;
            }
          }
          
          throw new Error('Attestation polling timeout - attestation not ready after all attempts');
        };

        // Execute: wait for confirmation, then poll for attestation
        // Note: Don't set isTransferring to false in finally - wait for async operations to complete
        waitForSolanaConfirmation()
          .then(() => {
            setTransferStatus('Solana transaction confirmed. Waiting for Circle attestation...');
            return pollForAttestation();
          })
          .then(() => {
            // Success - minting completed
            setIsTransferring(false);
          })
          .catch((error) => {
            console.error('[Bridge] Error in confirmation or attestation polling:', error);
            const mintingAptosUrl = `/minting-aptos?signature=${encodeURIComponent(burnTxSignature)}`;
            updateLastAction(
              `Error: ${error.message || 'Failed to complete minting'}`,
              'error',
              mintingAptosUrl,
              'Mint manually on /minting-aptos'
            );
            
            addAction(
              `Recipient wallet`,
              'pending',
              `https://explorer.aptoslabs.com/account/${aptosAccount.address.toString()}?network=mainnet`,
              'View recipient wallet on Aptos Explorer'
            );
            
            addAction(
              `Minting failed: ${error.message || 'Unknown error'}`,
              'error',
              mintingAptosUrl,
              'Mint manually on /minting-aptos'
            );
            toast({
              title: "Minting Failed",
              description: error.message || "Failed to automatically mint USDC on Aptos. You can mint manually later.",
              variant: "destructive",
            });
            setTransferStatus(`Transfer initiated! Transaction: ${burnTxSignature.slice(0, 8)}...${burnTxSignature.slice(-8)}. Minting failed, you can mint manually later.`);
            setIsTransferring(false);
          });

        // Don't set isTransferring to false here - wait for async operations above
        return; // Exit early, async operations will handle setIsTransferring(false)

      } else if (isAptosToSolana) {
        // Aptos -> Solana: derived (Gas Station + Solana sign) или native (bytecode + Aptos sign, газ — кошелёк пользователя)
        if (!aptosAccount || !aptosWallet || !solanaPublicKey || !signSolanaTransaction || !solanaConnection) {
          throw new Error('Please connect both Solana and Aptos wallets');
        }
        const destSolana = destinationAddress || solanaAddress;
        if (!destSolana) {
          throw new Error('Solana destination address is required');
        }

        setTransferStatus('Starting Aptos -> Solana bridge...');
        updateLastAction('Starting Aptos -> Solana bridge...', 'pending');

        let burnTxHash: string;
        if (isDerivedWallet) {
          if (!solanaWallet || !signSolanaMessage) {
            throw new Error('Please connect Solana wallet (required for derived Aptos).');
          }
          console.log('[Bridge] Aptos -> Solana (derived wallet)');
          burnTxHash = await executeAptosToSolanaBridge({
            amount: transferAmount,
            aptosAccount,
            aptosWallet: aptosWallet as any,
            aptosClient,
            solanaPublicKey,
            solanaWallet,
            signMessage: signSolanaMessage ?? undefined,
            transactionSubmitter: aptosTransactionSubmitter as any,
            destinationSolanaAddress: destSolana,
            onStatusUpdate: (s) => {
              setTransferStatus(s);
              updateLastAction(s, 'pending');
            },
          });
        } else {
          if (isDerivedAptosWalletReliable(aptosWallet)) {
            throw new Error('Use a native Aptos wallet (e.g. Petra) or connect via Solana for derived wallet.');
          }
          console.log('[Bridge] Aptos -> Solana (native wallet, bytecode, user pays gas)');
          burnTxHash = await executeAptosNativeToSolanaBridge({
            amount: transferAmount,
            aptosAccount,
            aptosWallet: aptosWallet as any,
            aptosClient,
            destinationSolanaAddress: destSolana,
            onStatusUpdate: (s) => {
              setTransferStatus(s);
              updateLastAction(s, 'pending');
            },
          });
        }

        updateLastAction(
          `Burn completed! Transaction: ${burnTxHash.slice(0, 8)}...${burnTxHash.slice(-8)}`,
          'success',
          `https://explorer.aptoslabs.com/txn/${burnTxHash}?network=mainnet`,
          'View transaction on Aptos Explorer'
        );
        addAction(
          'Burn transaction sent on Aptos',
          'success',
          `https://explorer.aptoslabs.com/txn/${burnTxHash}?network=mainnet`,
          'View transaction on Aptos Explorer'
        );
        setLastAptosToSolanaParams({ signature: burnTxHash, finalRecipient: destSolana });
        setLastSolanaToAptosParams(null);

        setTransferStatus('Waiting for Aptos transaction confirmation...');
        addAction('Waiting for Aptos transaction confirmation...', 'pending', `https://explorer.aptoslabs.com/txn/${burnTxHash}?network=mainnet`, 'View on Aptos Explorer');

        const waitForAptosConfirmation = async (): Promise<void> => {
          const maxAttempts = 30;
          const delay = 2000;
          for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            const res = await fetch(`https://fullnode.mainnet.aptoslabs.com/v1/transactions/by_hash/${burnTxHash}`);
            if (res.ok) {
              const txData = await res.json();
              if (txData.success && txData.vm_status === 'Executed successfully') {
                updateLastAction('Aptos transaction confirmed', 'success', `https://explorer.aptoslabs.com/txn/${burnTxHash}?network=mainnet`, 'View on Aptos Explorer');
                return;
              }
              if (txData.vm_status) throw new Error(`Transaction failed: ${txData.vm_status}`);
            }
            if (attempt % 5 === 0) {
              updateLastAction(`Waiting for Aptos confirmation... (${attempt}/${maxAttempts})`, 'pending', `https://explorer.aptoslabs.com/txn/${burnTxHash}?network=mainnet`, 'View on Aptos Explorer');
            }
            await new Promise((r) => setTimeout(r, delay));
          }
          throw new Error('Aptos transaction confirmation timeout');
        };
        await waitForAptosConfirmation();

        // Circle API: GET /v1/messages/{sourceDomainId}/{transactionHash} — без дублирования "messages"
        let irisBase = typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_CIRCLE_CCTP_ATTESTATION_URL
          ? process.env.NEXT_PUBLIC_CIRCLE_CCTP_ATTESTATION_URL
          : 'https://iris-api.circle.com/v1';
        irisBase = irisBase.replace(/\/messages\/?$/, '') || irisBase;
        const maxAttestationAttempts = 15;
        const initialAttestationDelay = 10000;
        const maxAttestationDelay = 60000;
        let attestationData: { messages: Array<{ message?: string; attestation?: string; eventNonce?: string }> } | null = null;
        const attestationUrl = `${irisBase}/messages/${DOMAIN_APTOS}/${burnTxHash.trim()}`;

        setTransferStatus('Waiting for attestation from Circle...');
        addAction('Requesting attestation from Circle...', 'pending', attestationUrl, 'View attestation request');

        for (let att = 1; att <= maxAttestationAttempts; att++) {
          updateLastAction(
            `Requesting attestation from Circle... (attempt ${att}/${maxAttestationAttempts})`,
            'pending',
            attestationUrl,
            'View attestation request'
          );
          setTransferStatus(`Waiting for attestation... (attempt ${att}/${maxAttestationAttempts})`);
          const attDelay = Math.min(initialAttestationDelay * Math.pow(2, att - 1), maxAttestationDelay);
          if (att > 1) await new Promise((r) => setTimeout(r, attDelay));
          const ar = await fetch(attestationUrl, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
          if (!ar.ok) {
            if (ar.status === 404) continue;
            throw new Error(`Circle API error: ${ar.status} ${ar.statusText}`);
          }
          const data = await ar.json();
          if (!data?.messages?.length || !data.messages[0].message || !data.messages[0].attestation) continue;
          const attVal = (data.messages[0].attestation || '').toUpperCase().trim();
          if (attVal === 'PENDING' || attVal === 'PENDING...') continue;
          attestationData = data;
          break;
        }
        if (!attestationData) throw new Error('Attestation not ready after max attempts. Please try again later.');

        updateLastAction('Attestation received from Circle', 'success', attestationUrl, 'View attestation');
        setTransferStatus('Attestation received! Preparing mint on Solana (sign in wallet)...');
        addAction('Preparing mint transaction on Solana...', 'pending');

        // Re-check both wallets — context can be lost during long attestation wait
        if (!aptosConnectedRef.current || !aptosAccountRef.current) {
          throw new Error(
            'Aptos wallet no longer detected. Please reconnect your Aptos wallet and retry the mint (use the attestation link above on the manual minting page), or try again with both wallets connected from the start.'
          );
        }
        if (!solanaConnectedRef.current || !solanaPublicKeyRef.current || !signSolanaTransactionRef.current) {
          throw new Error(
            'Solana wallet no longer detected. Please reconnect your Solana wallet (the one that will receive USDC and sign the mint tx) and retry, or use the manual minting page with the attestation link above.'
          );
        }

        // Re-establish Solana connection before mint (adapter can report "not connected" after long attestation wait)
        if (solanaWalletRef.current) {
          try {
            await connectSolana();
            await new Promise((r) => setTimeout(r, 400));
          } catch (_) {
            // ignore reconnect errors, proceed with current refs
          }
        }

        let mintTxSignature: string;
        try {
          mintTxSignature = await performMintOnSolana(
            attestationData as any,
            destSolana,
            solanaConnection,
            solanaPublicKeyRef.current!,
            signSolanaTransactionRef.current!,
            (s) => { setTransferStatus(s); updateLastAction(s, 'pending'); }
          );
        } catch (mintErr: any) {
          const msg = mintErr?.message || 'Unknown error';
          const isNotConnected = typeof msg === 'string' && msg.toLowerCase().includes('not connected');
          const mintingSolanaUrl = `/minting-solana?signature=${encodeURIComponent(burnTxHash)}`;

          // On "not connected", try once: reconnect and retry mint (adapter state can be stale after long wait)
          if (isNotConnected && solanaWalletRef.current) {
            updateLastAction('Solana wallet reported not connected. Reconnecting and retrying mint...', 'pending');
            setTransferStatus('Reconnecting Solana wallet...');
            try {
              await connectSolana();
              await new Promise((r) => setTimeout(r, 600));
              if (signSolanaTransactionRef.current && solanaPublicKeyRef.current) {
                updateLastAction('Retrying mint on Solana...', 'pending');
                mintTxSignature = await performMintOnSolana(
                  attestationData as any,
                  destSolana,
                  solanaConnection,
                  solanaPublicKeyRef.current,
                  signSolanaTransactionRef.current,
                  (s) => { setTransferStatus(s); updateLastAction(s, 'pending'); }
                );
                updateLastAction('USDC minted successfully on Solana', 'success', `https://solscan.io/tx/${mintTxSignature}`, 'View transaction on Solscan');
                addAction('Bridge complete!', 'success');
                setTransferStatus(`Transfer complete! USDC minted on Solana. Transaction: ${mintTxSignature.slice(0, 8)}...${mintTxSignature.slice(-8)}`);
                toast({ title: 'USDC Minted on Solana', description: `USDC has been minted on Solana. Transaction: ${mintTxSignature.slice(0, 8)}...${mintTxSignature.slice(-8)}` });
                setIsTransferring(false);
                return;
              }
            } catch (_) {
              // fall through to error handling below
            }
          }

          updateLastAction(`Minting on Solana failed: ${msg}`, 'error', mintingSolanaUrl, 'Mint manually on Solana');
          addAction('Mint manually on Solana', 'error', mintingSolanaUrl, 'Open /minting-solana');
          setTransferStatus(`Minting failed: ${msg}`);
          toast({
            variant: 'destructive',
            title: 'Minting on Solana Failed',
            description: isNotConnected
              ? 'Solana wallet reported "not connected" when signing the mint transaction (Aptos burn was successful). Keep the Solana wallet connected and unlocked during the whole flow, then retry, or use the manual minting page with the attestation link from the log above.'
              : msg + (msg.includes('sign') ? ' You can retry or mint manually on the minting page.' : ''),
          });
          setIsTransferring(false);
          return;
        }

        updateLastAction('USDC minted successfully on Solana', 'success', `https://solscan.io/tx/${mintTxSignature}`, 'View transaction on Solscan');
        addAction('Bridge complete!', 'success');
        setTransferStatus(`Transfer complete! USDC minted on Solana. Transaction: ${mintTxSignature.slice(0, 8)}...${mintTxSignature.slice(-8)}`);
        toast({
          title: 'USDC Minted on Solana',
          description: `USDC has been minted on Solana. Transaction: ${mintTxSignature.slice(0, 8)}...${mintTxSignature.slice(-8)}`,
        });
        setIsTransferring(false);
        return;
      } else {
        throw new Error('Invalid bridge direction. Please select different chains for source and destination.');
      }
    } catch (error: any) {
      console.error('[Bridge] Transfer error:', error);
      setTransferStatus(`Error: ${error.message || 'Unknown error'}`);
      addAction(
        `Transfer failed: ${error.message || 'Unknown error'}`,
        'error'
      );
      toast({
        variant: "destructive",
        title: "Transfer Failed",
        description: error.message || "Failed to initiate transfer",
      });
      setIsTransferring(false);
    }
  };

  return (
    <div className="w-full h-screen overflow-y-auto bg-gradient-to-br from-gray-50 via-white to-gray-100">
      <div className="w-full min-h-full flex items-start justify-center p-4 md:items-center">
        <div className="w-full max-w-2xl space-y-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => router.push("/")}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </button>
            <Link href="/privacy-bridge">
              <Button variant="outline" size="sm" className="bg-black text-white border-black hover:bg-gray-800 hover:text-white hover:border-gray-800">
                Private Bridge
              </Button>
            </Link>
          </div>

          <BridgeView
            sourceChain={sourceChain}
            sourceToken={sourceToken}
            destChain={destChain}
            destToken={destToken}
            amount={transferAmount}
            destinationAddress={destinationAddress}
            onSourceChainSelect={setSourceChain as any}
            onSourceTokenSelect={setSourceToken as any}
            onDestChainSelect={setDestChain as any}
            onDestTokenSelect={setDestToken as any}
            onAmountChange={setTransferAmount}
            onDestinationAddressChange={setDestinationAddress}
            onTransfer={handleTransfer}
            isTransferring={isTransferring}
            transferStatus={transferStatus}
            chains={CHAINS}
            tokens={TOKENS}
            showSwapButton={true}
            hideSourceWallet={true}
            hideDestinationAddress={true}
            bothWalletsConnected={bothWalletsConnected}
            missingWalletAlert={
              missingWallet ? (
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded text-sm text-yellow-800 dark:text-yellow-200">
                  Please connect {missingWallet} wallet to enable bridging.
                </div>
              ) : null
            }
            bridgeButtonDisabled={bridgeButtonDisabled}
            bridgeButtonAlert={bridgeButtonAlert ? (
              <div>{bridgeButtonAlert}</div>
            ) : null}
            walletSection={
              solanaConnected && solanaAddress ? (
                <div className="p-3 border rounded-lg bg-card w-auto space-y-2">
                  {/* Solana Wallet */}
                  <div>
                    <div className="flex items-center justify-between cursor-pointer hover:bg-accent/50 rounded p-1 -m-1 transition-colors" onClick={() => setIsSolanaBalanceExpanded(!isSolanaBalanceExpanded)}>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-medium text-muted-foreground shrink-0">Solana</span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" className="h-auto p-0 font-mono text-sm truncate">
                              {truncateAddress(solanaAddress)}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={copySolanaAddress} className="gap-2">
                              <Copy className="h-4 w-4" /> Copy address
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={handleDisconnectSolana} className="gap-2">
                              <LogOut className="h-4 w-4" /> Disconnect
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 shrink-0 transition-transform text-muted-foreground",
                          isSolanaBalanceExpanded ? "transform rotate-0" : "transform -rotate-90"
                        )}
                      />
                    </div>
                    {isSolanaBalanceExpanded && (
                      <div className="mt-2 pt-2 border-t">
                        <div className="text-sm font-medium pb-2">
                          {isSolanaLoading ? '...' : solanaTotalValue !== null ? formatCurrency(solanaTotalValue, 2) : 'N/A'}
                        </div>
                        <ScrollArea className="max-h-48">
                          {solanaTokens.length > 0 ? (
                            <TokenList tokens={solanaTokens} disableDrag={true} />
                          ) : (
                            <div className="text-sm text-muted-foreground p-2">No tokens found</div>
                          )}
                        </ScrollArea>
                      </div>
                    )}
                  </div>

                  {/* Aptos Wallet: Derived or Native or Connect Button */}
                  {aptosConnected && aptosAccount ? (
                    <div>
                      <div className="flex items-center justify-between cursor-pointer hover:bg-accent/50 rounded p-1 -m-1 transition-colors" onClick={() => setIsAptosBalanceExpanded(!isAptosBalanceExpanded)}>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm font-medium text-muted-foreground shrink-0">
                            Aptos {isDerivedWallet ? '(Derived)' : '(Native)'}
                          </span>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" className="h-auto p-0 font-mono text-sm truncate">
                                {truncateAddress(aptosAccount.address.toString())}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onSelect={copyAptosAddress} className="gap-2">
                                <Copy className="h-4 w-4" /> Copy address
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={handleDisconnectAptos} className="gap-2">
                                <LogOut className="h-4 w-4" /> Disconnect
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        <ChevronDown
                          className={cn(
                            "h-4 w-4 shrink-0 transition-transform text-muted-foreground",
                            isAptosBalanceExpanded ? "transform rotate-0" : "transform -rotate-90"
                          )}
                        />
                      </div>
                      {isAptosBalanceExpanded && (
                        <div className="mt-2 pt-2 border-t">
                          <div className="text-sm font-medium pb-2">
                            {isAptosLoading ? '...' : formatCurrency(aptosTotalValue, 2)}
                          </div>
                          <ScrollArea className="max-h-48">
                            {aptosTokens.length > 0 ? (
                              <TokenList tokens={aptosTokens} disableDrag={true} />
                            ) : (
                              <div className="text-sm text-muted-foreground p-2">No tokens found</div>
                            )}
                          </ScrollArea>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="relative">
                      <div className="[&>button]:hidden">
                        <WalletSelector />
                      </div>
                      <Button 
                        size="sm" 
                        className="w-full"
                        disabled={isAptosConnecting}
                        onClick={(e) => {
                          e.stopPropagation();
                          // Find and click the hidden WalletSelector button
                          const wrapper = e.currentTarget.parentElement;
                          const hiddenButton = wrapper?.querySelector('button') as HTMLElement;
                          if (hiddenButton) {
                            hiddenButton.click();
                          }
                        }}
                      >
                        {isAptosConnecting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Connecting...
                          </>
                        ) : (
                          'Connect Aptos Wallet'
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              ) : !solanaConnected ? (
                <div className="flex flex-col items-end gap-2">
                  <Dialog open={isSolanaDialogOpen} onOpenChange={setIsSolanaDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" disabled={isSolanaConnecting}>
                        {isSolanaConnecting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Connecting...
                          </>
                        ) : (
                          'Connect Solana Wallet'
                        )}
                      </Button>
                    </DialogTrigger>
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
                          availableSolanaWallets.map((w, index) => (
                            <Button
                              key={`${w.adapter.name}-${index}-${w.adapter.url || ''}`}
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
                  <div className="relative">
                    <div className="[&>button]:hidden">
                      <WalletSelector />
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isAptosConnecting}
                      onClick={(e) => {
                        e.stopPropagation();
                        const wrapper = e.currentTarget.parentElement;
                        const hiddenButton = wrapper?.querySelector('div button') as HTMLElement | null;
                        if (hiddenButton) hiddenButton.click();
                      }}
                    >
                      {isAptosConnecting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Connecting...
                        </>
                      ) : (
                        'Connect Aptos Wallet'
                      )}
                    </Button>
                  </div>
                </div>
              ) : null
            }
          />

          <ActionLog items={actionLog} />
          {(lastSolanaToAptosParams || lastAptosToSolanaParams) && (
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              {lastSolanaToAptosParams && (
                <Link
                  href={`/minting-aptos?signature=${encodeURIComponent(lastSolanaToAptosParams.signature)}&sourceDomain=5&finalRecipient=${encodeURIComponent(lastSolanaToAptosParams.finalRecipient)}`}
                  className="text-blue-600 hover:underline"
                >
                  Mint on Aptos →
                </Link>
              )}
              {lastAptosToSolanaParams && (
                <Link
                  href={`/minting-solana?signature=${encodeURIComponent(lastAptosToSolanaParams.signature)}&sourceDomain=9&finalRecipient=${encodeURIComponent(lastAptosToSolanaParams.finalRecipient)}`}
                  className="text-blue-600 hover:underline"
                >
                  Mint on Solana →
                </Link>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

export default function BridgePage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <BridgePageContent />
    </Suspense>
  );
}
