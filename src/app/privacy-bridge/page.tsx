"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useWallet as useSolanaWallet, useConnection } from "@solana/wallet-adapter-react";
import { useWallet as useAptosWallet } from "@aptos-labs/wallet-adapter-react";
import { WalletReadyState, WalletName } from "@solana/wallet-adapter-base";
import { PublicKey, Keypair } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/use-toast";
import { WalletSelector } from "@/components/WalletSelector";
import { Loader2, Eye, EyeOff, ArrowLeft, Copy, LogOut, ChevronDown } from "lucide-react";
import bs58 from "bs58";
import { ActionLog, type ActionLogItem } from "@/components/bridge/ActionLog";
import { isDerivedAptosWalletReliable, getAptosWalletNameFromStorage } from "@/lib/aptosWalletUtils";
import { useSolanaPortfolio } from "@/hooks/useSolanaPortfolio";
import { AptosPortfolioService } from "@/lib/services/aptos/portfolio";
import { Token } from "@/lib/types/token";
import { TokenList } from "@/components/portfolio/TokenList";
import { formatCurrency } from "@/lib/utils/numberFormat";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

const PRIVACY_SIGN_MESSAGE = "Privacy Money account sign in";
const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const TMP_WALLET_STORAGE_KEY = "privacy_cash_tmp_wallet_usdc";

const TMP_SEED_WORDS = [
  "alpha", "bravo", "charlie", "delta", "echo", "foxtrot",
  "golf", "hotel", "india", "juliet", "kilo", "lima",
  "mike", "november", "oscar", "papa", "quebec", "romeo",
  "sierra", "tango", "uniform", "victor", "whiskey", "xray",
  "yankee", "zulu"
];

type TmpWallet = {
  address: string;
  privateKey: string;
  seedPhrase: string;
};

function PrivacyBridgeContent() {
  const router = useRouter();
  const { toast } = useToast();
  const { connection: solanaConnection } = useConnection();
  const {
    publicKey: solanaPublicKey,
    connected: solanaConnected,
    wallet: solanaWallet,
    disconnect: disconnectSolana,
    wallets,
    select,
    connect: connectSolana,
    signMessage: solanaSignMessage,
    signTransaction: solanaSignTransaction,
  } = useSolanaWallet();
  const {
    account: aptosAccount,
    connected: aptosConnected,
    wallet: aptosWallet,
    wallets: aptosWallets,
    connect: connectAptos,
    disconnect: disconnectAptos,
    isLoading: aptosConnecting,
  } = useAptosWallet();

  const [isSolanaDialogOpen, setIsSolanaDialogOpen] = useState(false);
  const [isSolanaConnecting, setIsSolanaConnecting] = useState(false);
  const [isSolanaBalanceExpanded, setIsSolanaBalanceExpanded] = useState(false);
  const [isAptosBalanceExpanded, setIsAptosBalanceExpanded] = useState(false);
  const [privacyBalanceUsdc, setPrivacyBalanceUsdc] = useState<number | null>(null);
  const [privacyBalanceUsdcLoading, setPrivacyBalanceUsdcLoading] = useState(false);
  const [privacyBalanceUsdcError, setPrivacyBalanceUsdcError] = useState<string | null>(null);
  const [depositAmount, setDepositAmount] = useState<string>("");
  const [withdrawAmount, setWithdrawAmount] = useState<string>("");
  const [isDepositing, setIsDepositing] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [tmpWallet, setTmpWallet] = useState<TmpWallet | null>(null);
  const [showTmpSecrets, setShowTmpSecrets] = useState(false);
  const [withdrawConfig, setWithdrawConfig] = useState<any | null>(null);
  const [withdrawConfigError, setWithdrawConfigError] = useState<string | null>(null);
  const [isTmpBridgeRunning, setIsTmpBridgeRunning] = useState(false);
  /** Лог действий burn/mint как в основном бридже: крупно, со ссылками, не сбрасывается при автообновлении */
  const [actionLog, setActionLog] = useState<ActionLogItem[]>([]);
  const [lastBurnParams, setLastBurnParams] = useState<{ signature: string; finalRecipient: string } | null>(null);
  const [walletConnectMounted, setWalletConnectMounted] = useState(false);
  useEffect(() => {
    setWalletConnectMounted(true);
  }, []);

  /** Один раз за сессию для текущего адреса — чтобы не дергать кошелёк на подпись после burn/mint */
  const lastFetchedBalanceForAddress = useRef<string | null>(null);
  /** Блокировка одновременных вызовов signMessage (кошелёк допускает только один pending запрос) */
  const isFetchingPrivacyBalanceRef = useRef(false);

  /** По умолчанию в поле withdraw — весь баланс (реальное значение, не placeholder) */
  useEffect(() => {
    if (privacyBalanceUsdc != null && privacyBalanceUsdc > 0) {
      setWithdrawAmount(privacyBalanceUsdc.toFixed(6));
    } else {
      setWithdrawAmount("");
    }
  }, [privacyBalanceUsdc]);

  const solanaAddress = solanaPublicKey?.toBase58() ?? null;

  const solanaWalletNameForDerived =
    (solanaWallet as { adapter?: { name?: string }; name?: string })?.adapter?.name ??
    (solanaWallet as { name?: string })?.name ??
    "";
  const isDerivedWallet = useMemo(() => {
    if (aptosWallet) {
      if (isDerivedAptosWalletReliable(aptosWallet)) return true;
      return Boolean(solanaWalletNameForDerived && aptosWallet.name === solanaWalletNameForDerived);
    }
    const stored = getAptosWalletNameFromStorage();
    return Boolean(stored != null && stored !== "" && String(stored).trim().endsWith(" (Solana)"));
  }, [aptosWallet, solanaWalletNameForDerived]);

  // Restore Solana wallet from localStorage on bridge load (AptosWalletName e.g. "Trust (Solana)" first, then walletName)
  const hasTriggeredRestore = useRef(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (solanaConnected) return;
    const walletNames = new Set<string>(wallets?.map((w) => String(w.adapter.name)) ?? []);
    let savedName: string | null = null;
    const aptosRaw = window.localStorage.getItem("AptosWalletName");
    if (aptosRaw) {
      try {
        const parsed = JSON.parse(aptosRaw) as string | null;
        const aptosName = typeof parsed === "string" ? parsed : aptosRaw;
        if (aptosName?.endsWith(" (Solana)")) {
          const name = aptosName.slice(0, -" (Solana)".length).trim();
          if (name && walletNames.has(name)) savedName = name;
        }
      } catch {}
    }
    if (!savedName) {
      const raw = window.localStorage.getItem("walletName");
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
    const solanaWalletName =
      (solanaWallet as { adapter?: { name?: string }; name?: string }).adapter?.name ??
      (solanaWallet as { name?: string }).name ??
      "";
    const derivedNameForCurrentSolana = `${solanaWalletName} (Solana)`;
    const derived = aptosWallets.find(
      (w) => w.name === derivedNameForCurrentSolana
    );
    if (derived && !hasTriedAutoConnectDerived.current) {
      hasTriedAutoConnectDerived.current = true;
      connectAptos(derived.name);
    }
  }, [solanaConnected, aptosConnected, aptosWallets, connectAptos, solanaWallet]);

  const truncateAddress = (addr: string) =>
    addr ? `${addr.slice(0, 8)}...${addr.slice(-8)}` : "";

  const {
    tokens: solanaTokens,
    totalValueUsd: solanaTotalValue,
    isLoading: isSolanaLoading,
  } = useSolanaPortfolio();

  const [aptosTokens, setAptosTokens] = useState<Token[]>([]);
  const [aptosTotalValue, setAptosTotalValue] = useState<number>(0);
  const [isAptosLoading, setIsAptosLoading] = useState(false);

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
        const total = portfolio.tokens.reduce((sum, token) => sum + (token.value ? parseFloat(token.value) : 0), 0);
        setAptosTotalValue(total);
      } catch (error) {
        console.error("Error loading Aptos portfolio:", error);
        setAptosTokens([]);
        setAptosTotalValue(0);
      } finally {
        setIsAptosLoading(false);
      }
    };
    loadAptosPortfolio();
  }, [aptosAccount?.address]);

  const addAction = (
    message: string,
    status: "pending" | "success" | "error",
    link?: string,
    linkText?: string,
    startTime?: number
  ) => {
    const now = Date.now();
    const newAction: ActionLogItem = {
      id: now.toString() + Math.random().toString(36).slice(2, 11),
      message,
      status,
      timestamp: new Date(),
      link,
      linkText,
      startTime: startTime ?? now,
      duration: startTime ? now - startTime : undefined,
    };
    setActionLog((prev) => [...prev, newAction]);
    return newAction.id;
  };

  const updateLastAction = (
    message: string,
    status: "pending" | "success" | "error",
    link?: string,
    linkText?: string
  ) => {
    const now = Date.now();
    setActionLog((prev) => {
      const next = [...prev];
      if (next.length > 0) {
        const last = next[next.length - 1];
        const start = last.startTime ?? last.timestamp.getTime();
        next[next.length - 1] = {
          ...last,
          message,
          status,
          link,
          linkText,
          duration: now - start,
        };
      }
      return next;
    });
  };

  /** Только в консоль (баланс, withdraw config и т.д.); burn/mint — в actionLog */
  const pushLog = (level: "info" | "warning" | "error", message: string) => {
    if (level === "error") console.error("[privacy-bridge]", message);
    else if (level === "warning") console.warn("[privacy-bridge]", message);
    else console.log("[privacy-bridge]", message);
  };

  const generateSeedPhrase = (wordsCount = 12): string => {
    const words: string[] = [];
    for (let i = 0; i < wordsCount; i++) {
      const idx = Math.floor(Math.random() * TMP_SEED_WORDS.length);
      words.push(TMP_SEED_WORDS[idx]);
    }
    return words.join(" ");
  };

  const loadTmpWalletFromStorage = () => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(TMP_WALLET_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as TmpWallet;
      if (parsed?.address && parsed?.privateKey && parsed?.seedPhrase) {
        setTmpWallet(parsed);
        pushLog("info", "Loaded temporary Privacy Cash wallet from local storage.");
      }
    } catch {
      // ignore parse errors
    }
  };

  const ensureTmpWallet = async (): Promise<TmpWallet> => {
    if (tmpWallet) return tmpWallet;

    // Сначала проверяем localStorage: если там уже есть кошелёк с приватным ключом и сид-фразой — используем его
    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem(TMP_WALLET_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as TmpWallet;
          if (
            parsed?.address &&
            typeof parsed.address === "string" &&
            parsed?.privateKey &&
            typeof parsed.privateKey === "string" &&
            parsed?.seedPhrase &&
            typeof parsed.seedPhrase === "string"
          ) {
            setTmpWallet(parsed);
            pushLog("info", "Using existing temporary wallet from local storage.");
            return parsed;
          }
        }
      } catch {
        // некорректные данные в storage — создаём новый кошелёк ниже
      }
    }

    const kp = Keypair.generate();
    const address = kp.publicKey.toBase58();
    const privateKey = bs58.encode(kp.secretKey);
    const seedPhrase = generateSeedPhrase(12);
    const wallet: TmpWallet = { address, privateKey, seedPhrase };
    if (typeof window !== "undefined") {
      window.localStorage.setItem(TMP_WALLET_STORAGE_KEY, JSON.stringify(wallet));
    }
    setTmpWallet(wallet);
    pushLog("info", `Generated new temporary Privacy Cash wallet: ${address}`);
    return wallet;
  };

  const availableSolanaWallets = useMemo(() => {
    const filtered = wallets.filter(
      (w) => w.readyState !== WalletReadyState.NotDetected
    );
    const seen = new Set<string>();
    return filtered.filter((w) => {
      const name = w.adapter.name;
      if (seen.has(name)) return false;
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
        } catch (err: unknown) {
          toast({
            variant: "destructive",
            title: "Connection Failed",
            description: err instanceof Error ? err.message : "Failed to connect wallet",
          });
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
  };

  const handleDisconnectSolana = async () => {
    try {
      await disconnectSolana();
      lastFetchedBalanceForAddress.current = null;
      setPrivacyBalanceUsdc(null);
      setPrivacyBalanceUsdcError(null);
      toast({ title: "Success", description: "Solana wallet disconnected" });
    } catch (err: unknown) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to disconnect",
      });
    }
  };

  const handleDisconnectAptos = async () => {
    skipAutoConnectDerivedRef.current = true;
    if (typeof window !== "undefined") sessionStorage.setItem("skip_auto_connect_derived_aptos", "1");
    try {
      await disconnectAptos();
      toast({ title: "Success", description: "Aptos wallet disconnected" });
    } catch (err: unknown) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to disconnect",
      });
    }
  };

  const copySolanaAddress = async () => {
    if (!solanaAddress) return;
    try {
      await navigator.clipboard.writeText(solanaAddress);
      toast({ title: "Copied", description: "Solana address copied to clipboard" });
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Failed to copy address" });
    }
  };

  const copyAptosAddress = async () => {
    if (!aptosAccount?.address) return;
    try {
      await navigator.clipboard.writeText(aptosAccount.address.toString());
      toast({ title: "Copied", description: "Aptos address copied to clipboard" });
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Failed to copy address" });
    }
  };

  const fetchPrivacyUsdcBalance = async () => {
    if (!solanaPublicKey || !solanaConnection || !solanaSignMessage) {
      toast({
        variant: "destructive",
        title: "Cannot load USDC balance",
        description: "Connect a Solana wallet that supports message signing (e.g. Phantom, Solflare).",
      });
      pushLog("warning", "Cannot load USDC balance: Solana wallet or signMessage not available.");
      return;
    }
    setPrivacyBalanceUsdcLoading(true);
    setPrivacyBalanceUsdcError(null);
    pushLog("info", "Loading Privacy Cash USDC balance...");
    try {
      const msg = new TextEncoder().encode(PRIVACY_SIGN_MESSAGE);
      let sig: Uint8Array;
      try {
        const raw = await solanaSignMessage(msg);
        if (typeof raw === "object" && raw !== null && "signature" in raw && raw.signature instanceof Uint8Array) {
          sig = raw.signature;
        } else {
          sig = raw as Uint8Array;
        }
      } catch (e: unknown) {
        if (e instanceof Error && e.message?.toLowerCase().includes("reject")) {
          throw new Error("User rejected the signature request");
        }
        throw e;
      }
      if (!(sig instanceof Uint8Array)) {
        throw new Error("Wallet returned invalid signature format");
      }

      const {
        EncryptionService,
        getUtxosSPL,
        getBalanceFromUtxosSPL,
      } = await import("privacycash/utils");
      const enc = new EncryptionService();
      enc.deriveEncryptionKeyFromSignature(sig);

      const publicKey = solanaPublicKey instanceof PublicKey
        ? solanaPublicKey
        : new PublicKey(solanaPublicKey);

      const utxos = await getUtxosSPL({
        publicKey,
        connection: solanaConnection,
        encryptionService: enc,
        storage: typeof window !== "undefined" ? window.localStorage : ({} as Storage),
        mintAddress: USDC_MINT,
      });
      const { amount } = getBalanceFromUtxosSPL(utxos);
      setPrivacyBalanceUsdc(amount);
      setPrivacyBalanceUsdcError(null);
      pushLog("info", `USDC private balance loaded: ${amount.toFixed(6)} USDC`);
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : String(err);
      const isAlreadyPending = /already pending|please wait/i.test(raw);
      if (isAlreadyPending) {
        pushLog("warning", "Balance load skipped: another wallet sign request is in progress. Try again in a moment.");
        setPrivacyBalanceUsdcError(null);
        return;
      }
      const isMissingPrivacycashUtils =
        /cannot find module ['"]privacycash\/utils['"]|module not found.*privacycash\/utils|can't resolve ['"]privacycash\/utils['"]/i.test(
          raw
        );
      const isCryptoOrSes =
        /crypto|intrinsic|Function\.| not defined|unpermitted/i.test(raw);
      const msg = isMissingPrivacycashUtils
        ? "Dependency missing: install `privacycash` (e.g. `npm i privacycash@^1.1.11`) and restart the dev server."
        : isCryptoOrSes
          ? "Privacy Cash SDK needs a full browser environment. Try disabling wallet extensions’ site scripting or use a clean profile."
          : raw;
      setPrivacyBalanceUsdcError(msg);
      setPrivacyBalanceUsdc(null);
      toast({ variant: "destructive", title: "Privacy Cash USDC balance", description: msg });
      pushLog("error", `Failed to load USDC balance: ${msg}`);
    } finally {
      isFetchingPrivacyBalanceRef.current = false;
      setPrivacyBalanceUsdcLoading(false);
    }
  };

  useEffect(() => {
    loadTmpWalletFromStorage();

    const apiUrl = process.env.NEXT_PUBLIC_API_PRIVACY_CASH;
    if (apiUrl) {
      (async () => {
        try {
          const res = await fetch(apiUrl);
          if (!res.ok) {
            throw new Error(`Failed to load withdraw config: ${res.status} ${res.statusText}`);
          }
          const json = await res.json();
          setWithdrawConfig(json);
          setWithdrawConfigError(null);
          pushLog("info", "Loaded Privacy Cash withdraw config from API.");
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          setWithdrawConfigError(msg);
          pushLog("warning", `Failed to load Privacy Cash withdraw config: ${msg}`);
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSendToDeposit = async () => {
    if (!solanaPublicKey || !solanaConnection || !solanaSignMessage || !solanaSignTransaction) {
      toast({
        variant: "destructive",
        title: "Cannot prepare deposit",
        description: "Connect a Solana wallet that supports signing transactions and messages.",
      });
      pushLog("warning", "Cannot prepare deposit: wallet does not support required signing capabilities.");
      return;
    }
    if (!depositAmount || Number(depositAmount) <= 0) {
      toast({
        variant: "destructive",
        title: "Invalid amount",
        description: "Enter a positive USDC amount to deposit.",
      });
      pushLog("warning", `Invalid deposit amount: "${depositAmount}".`);
      return;
    }

    const amountNumber = Number(depositAmount);
    setIsDepositing(true);
    pushLog("info", `Preparing REAL USDC deposit for amount: ${amountNumber} USDC (will be sent to relayer / network)...`);

    try {
      const msg = new TextEncoder().encode(PRIVACY_SIGN_MESSAGE);
      let sig: Uint8Array;
      try {
        const raw = await solanaSignMessage(msg);
        if (typeof raw === "object" && raw !== null && "signature" in raw && raw.signature instanceof Uint8Array) {
          sig = raw.signature;
        } else {
          sig = raw as Uint8Array;
        }
      } catch (e: unknown) {
        if (e instanceof Error && e.message?.toLowerCase().includes("reject")) {
          throw new Error("User rejected the signature request");
        }
        throw e;
      }
      if (!(sig instanceof Uint8Array)) {
        throw new Error("Wallet returned invalid signature format");
      }
      pushLog("info", "Derived encryption key from signed message.");

      const {
        EncryptionService,
        depositSPL,
      } = await import("privacycash/utils");
      const { WasmFactory } = await import("@lightprotocol/hasher.rs");
      const lightWasm = await WasmFactory.getInstance();

      const enc = new EncryptionService();
      enc.deriveEncryptionKeyFromSignature(sig);
      pushLog("info", "Initialized EncryptionService with derived key.");

      const publicKey = solanaPublicKey instanceof PublicKey
        ? solanaPublicKey
        : new PublicKey(solanaPublicKey);

      await depositSPL({
        lightWasm,
        storage: typeof window !== "undefined" ? window.localStorage : ({} as Storage),
        keyBasePath: "/circuit2/transaction2",
        publicKey,
        connection: solanaConnection,
        amount: amountNumber,
        encryptionService: enc,
        mintAddress: USDC_MINT,
        transactionSigner: async (tx: any) => {
          const signed = await solanaSignTransaction(tx);
          pushLog("info", "Transaction signed by wallet. Sending to Privacy Cash relayer / network...");
          return signed;
        },
      } as any);

      pushLog("info", "Deposit submitted to Privacy Cash relayer / network. Wait for on-chain confirmation.");

      try {
        pushLog("info", "Refreshing Privacy Cash USDC balance after deposit...");
        await fetchPrivacyUsdcBalance();
        pushLog("info", "Privacy Cash USDC balance refreshed after deposit.");
      } catch (refreshErr) {
        pushLog(
          "warning",
          `Failed to refresh Privacy Cash USDC balance after deposit: ${
            refreshErr instanceof Error ? refreshErr.message : String(refreshErr)
          }`
        );
      }

      toast({
        title: "Deposit submitted",
        description: "USDC deposit transaction was signed and sent via Privacy Cash relayer.",
      });
      pushLog("info", "Deposit transaction completed on client side (SDK will handle relay and confirmation).");
    } catch (err: unknown) {
      toast({
        variant: "destructive",
        title: "Failed to prepare deposit",
        description: err instanceof Error ? err.message : "Unknown error while preparing deposit transaction.",
      });
      pushLog(
        "error",
        `Failed to prepare deposit: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setIsDepositing(false);
    }
  };

  /** Burn с tmp-кошелька на Solana (на сервере) + mint на Aptos. После успешного mint проверяет баланс tmp и при нуле удаляет кошелёк. */
  const runBurnAndMintToAptos = async (wallet: TmpWallet): Promise<void> => {
    if (!aptosAccount) return;

    const burnStartTime = Date.now();
    setActionLog([]);
    setLastBurnParams(null);
    addAction("Starting burn + mint to Aptos...", "pending", undefined, undefined, burnStartTime);

    try {
      updateLastAction("Preparing burn transaction on Solana (server)...", "pending");
      const burnResp = await fetch("/api/privacy-bridge/burn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tmpWalletPrivateKey: wallet.privateKey.trim(),
          aptosRecipient: aptosAccount.address.toString(),
        }),
      });
      const burnJson = await burnResp.json();
      if (!burnResp.ok) {
        throw new Error(burnJson?.error ?? `Burn failed: ${burnResp.status}`);
      }
      const sig = burnJson.signature as string;
      if (!sig) throw new Error("Server did not return burn signature");

      const solscanUrl = `https://solscan.io/tx/${sig}`;
      updateLastAction(
        `Burn completed! Transaction: ${sig.slice(0, 8)}...${sig.slice(-8)}`,
        "success",
        solscanUrl,
        "View transaction on Solscan"
      );
      addAction("Burn transaction sent on Solana", "success", solscanUrl, "View on Solscan");
      setLastBurnParams({ signature: sig, finalRecipient: aptosAccount.address.toString() });

      const attestationUrl = `https://iris-api.circle.com/v1/messages/5/${sig}`;
      addAction("Waiting for Circle attestation...", "pending", attestationUrl, "View attestation request");

      const maxAttempts = 15;
      const initialDelayMs = 10_000;
      const maxDelayMs = 30_000;
      const requestBody = {
        signature: sig.trim(),
        sourceDomain: "5",
        finalRecipient: aptosAccount.address.toString().trim(),
      };

      await new Promise((resolve) => setTimeout(resolve, initialDelayMs));

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const delay =
          attempt === 1
            ? initialDelayMs
            : Math.min(initialDelayMs * Math.pow(1.5, attempt - 1), maxDelayMs);

        updateLastAction(
          `Requesting attestation from Circle... (attempt ${attempt}/${maxAttempts})`,
          "pending",
          attestationUrl,
          "View attestation request"
        );

        try {
          const resp = await fetch("/api/aptos/mint-cctp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody),
          });
          const json = await resp.json();

          if (resp.ok && json?.data?.pending) {
            const pendingMsg = json?.data?.message || "attestation pending";
            if (attempt < maxAttempts) {
              updateLastAction(
                `Attestation not ready (attempt ${attempt}/${maxAttempts}): ${pendingMsg}`,
                "pending",
                attestationUrl,
                "View attestation"
              );
              await new Promise((resolve) => setTimeout(resolve, delay));
              continue;
            }
            updateLastAction(
              `Attestation still pending after ${maxAttempts} attempts: ${pendingMsg}`,
              "error",
              attestationUrl,
              "View attestation"
            );
            toast({
              variant: "destructive",
              title: "Aptos mint pending too long",
              description: "Attestation is still not ready after multiple attempts. Try again later.",
            });
            return;
          }

          if (resp.ok) {
            updateLastAction("Attestation received and minting completed", "success");
            const recipientAddress =
              json?.data?.transaction?.finalRecipient ||
              json?.data?.accountAddress ||
              aptosAccount.address.toString();
            const mintTxHash = json?.data?.transaction?.hash;

            if (mintTxHash) {
              addAction(
                "USDC minted successfully on Aptos",
                "success",
                `https://explorer.aptoslabs.com/txn/${mintTxHash}?network=mainnet`,
                "View mint transaction on Aptos Explorer"
              );
            }
            if (recipientAddress) {
              addAction(
                "Recipient wallet",
                "success",
                `https://explorer.aptoslabs.com/account/${recipientAddress}?network=mainnet`,
                "View recipient on Aptos Explorer"
              );
            }

            toast({
              title: "Aptos mint submitted",
              description: "USDC mint transaction has been submitted on Aptos via service wallet.",
            });

            // После успешного mint проверяем баланс tmp-кошелька; если USDC = 0 — удаляем кошелёк
            try {
              const tmpPubkey = new PublicKey(wallet.address);
              const tokenAccounts = await solanaConnection.getParsedTokenAccountsByOwner(tmpPubkey, {
                programId: TOKEN_PROGRAM_ID,
              });
              const usdcAccount = tokenAccounts.value.find(
                (ta) => ta.account.data.parsed?.info?.mint === USDC_MINT.toBase58()
              );
              const amountRaw = usdcAccount?.account?.data?.parsed?.info?.tokenAmount?.amount ?? "0";
              const amountNum = Number(amountRaw);
              if (amountNum <= 0) {
                if (typeof window !== "undefined") {
                  window.localStorage.removeItem(TMP_WALLET_STORAGE_KEY);
                }
                setTmpWallet(null);
                addAction("Tmp wallet balance is zero; cleared for next Withdraw.", "success");
                pushLog("info", "Tmp wallet cleared (zero USDC balance) for next withdraw.");
              }
            } catch (e) {
              pushLog(
                "warning",
                `Could not check tmp wallet balance after mint: ${e instanceof Error ? e.message : String(e)}`
              );
            }
            return;
          }

          const errorMessage =
            (json?.error && (json.error.message || json.error)) ||
            json?.message ||
            "Mint API returned error";
          if (attempt < maxAttempts) {
            updateLastAction(
              `Attestation/mint attempt ${attempt}/${maxAttempts}: ${errorMessage.slice(0, 60)}${errorMessage.length > 60 ? "…" : ""}`,
              "pending",
              attestationUrl,
              "View attestation"
            );
            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
          }
          updateLastAction(`Aptos mint failed: ${errorMessage}`, "error", attestationUrl, "View attestation");
          toast({ variant: "destructive", title: "Aptos mint failed", description: errorMessage });
          return;
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          if (attempt < maxAttempts) {
            updateLastAction(
              `Error (attempt ${attempt}/${maxAttempts}): ${msg.slice(0, 50)}…`,
              "pending",
              attestationUrl,
              "View attestation"
            );
            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
          }
          const mintingAptosUrl = `/minting-aptos?signature=${encodeURIComponent(sig)}`;
          updateLastAction(`Failed after ${maxAttempts} attempts: ${msg}`, "error", mintingAptosUrl, "Mint manually on Aptos");
          addAction("Mint manually on Aptos", "error", mintingAptosUrl, "Open /minting-aptos");
          toast({ variant: "destructive", title: "Aptos mint failed", description: msg });
          return;
        }
      }

      updateLastAction("Attestation polling timeout — not ready after all attempts.", "error", attestationUrl, "View attestation");
      toast({
        variant: "destructive",
        title: "Aptos mint failed",
        description: "Attestation polling timeout.",
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      updateLastAction(`Burn to Aptos failed: ${msg}`, "error");
      toast({ variant: "destructive", title: "Burn to Aptos failed", description: msg });
    }
  };

  /** Withdraw из Privacy Cash на tmp-кошелёк, затем сразу burn на Solana + mint на Aptos. Одна связка. */
  const handleWithdrawUsdc = async () => {
    if (!solanaPublicKey || !solanaConnection || !solanaSignMessage || !solanaSignTransaction) {
      toast({
        variant: "destructive",
        title: "Cannot prepare withdraw",
        description: "Connect a Solana wallet that supports signing transactions and messages.",
      });
      pushLog("warning", "Cannot prepare withdraw: wallet does not support required signing capabilities.");
      return;
    }
    if (!aptosConnected || !aptosAccount) {
      toast({
        variant: "destructive",
        title: "Connect Aptos wallet",
        description: "Connect an Aptos wallet to receive bridged USDC (withdraw → burn → mint to Aptos).",
      });
      pushLog("warning", "Cannot withdraw: Aptos wallet is not connected.");
      return;
    }
    if (!privacyBalanceUsdc || privacyBalanceUsdc <= 0) {
      toast({
        variant: "destructive",
        title: "Nothing to withdraw",
        description: "Your private USDC balance is zero.",
      });
      pushLog("warning", "Cannot withdraw: private USDC balance is zero.");
      return;
    }

    const rawWithdraw = withdrawAmount.trim() || privacyBalanceUsdc.toFixed(6);
    const amountNumber = Math.min(Number(rawWithdraw), privacyBalanceUsdc);
    if (amountNumber <= 0 || !Number.isFinite(amountNumber)) {
      toast({
        variant: "destructive",
        title: "Invalid amount",
        description: "Enter a positive amount not exceeding your balance.",
      });
      pushLog("warning", `Invalid withdraw amount: "${rawWithdraw}".`);
      return;
    }

    setIsWithdrawing(true);
    pushLog("info", `Preparing withdraw → burn → mint: ${amountNumber.toFixed(6)} USDC to tmp wallet, then to Aptos...`);

    try {
      const msg = new TextEncoder().encode(PRIVACY_SIGN_MESSAGE);
      let sig: Uint8Array;
      try {
        const raw = await solanaSignMessage(msg);
        if (typeof raw === "object" && raw !== null && "signature" in raw && raw.signature instanceof Uint8Array) {
          sig = raw.signature;
        } else {
          sig = raw as Uint8Array;
        }
      } catch (e: unknown) {
        if (e instanceof Error && e.message?.toLowerCase().includes("reject")) {
          throw new Error("User rejected the signature request");
        }
        throw e;
      }
      if (!(sig instanceof Uint8Array)) {
        throw new Error("Wallet returned invalid signature format");
      }
      pushLog("info", "Derived encryption key from signed message for withdraw.");

      const {
        EncryptionService,
        withdrawSPL,
      } = await import("privacycash/utils");
      const { WasmFactory } = await import("@lightprotocol/hasher.rs");
      const lightWasm = await WasmFactory.getInstance();

      const enc = new EncryptionService();
      enc.deriveEncryptionKeyFromSignature(sig);
      pushLog("info", "Initialized EncryptionService with derived key for withdraw.");

      const wallet = await ensureTmpWallet();
      const recipientPubkey = new PublicKey(wallet.address);

      const publicKey = solanaPublicKey instanceof PublicKey
        ? solanaPublicKey
        : new PublicKey(solanaPublicKey);

      await withdrawSPL({
        lightWasm,
        storage: typeof window !== "undefined" ? window.localStorage : ({} as Storage),
        keyBasePath: "/circuit2/transaction2",
        publicKey,
        connection: solanaConnection,
        amount: amountNumber,
        encryptionService: enc,
        mintAddress: USDC_MINT,
        recipient: recipientPubkey,
      } as any);

      pushLog("info", "Withdraw submitted to Privacy Cash relayer. Waiting for on-chain confirmation, then burn + mint...");

      try {
        pushLog("info", "Refreshing Privacy Cash USDC balance after withdraw...");
        await fetchPrivacyUsdcBalance();
        pushLog("info", "Privacy Cash USDC balance refreshed after withdraw.");
      } catch (refreshErr) {
        pushLog(
          "warning",
          `Failed to refresh Privacy Cash USDC balance after withdraw: ${
            refreshErr instanceof Error ? refreshErr.message : String(refreshErr)
          }`
        );
      }

      toast({
        title: "Withdraw submitted",
        description: "Withdraw sent. Starting burn on Solana and mint on Aptos...",
      });

      // Сразу после withdraw: burn на Solana + mint на Aptos
      await runBurnAndMintToAptos(wallet);
    } catch (err: unknown) {
      toast({
        variant: "destructive",
        title: "Failed to prepare withdraw",
        description: err instanceof Error ? err.message : "Unknown error while preparing withdraw transaction.",
      });
      pushLog(
        "error",
        `Failed to prepare withdraw: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setIsWithdrawing(false);
    }
  };

  // Авто-загрузка приватного баланса только при первом подключении кошелька (по адресу).
  // Не зависяем от solanaConnection/solanaSignMessage — иначе после burn/mint ре-рендер
  // перезапускал эффект и снова открывал кошелёк на подпись (burn/mint сами кошелёк не используют).
  // Задержка, чтобы не пересекаться с авто-подключением derived Aptos (тот тоже может дергать кошелёк).
  useEffect(() => {
    const address = solanaPublicKey?.toBase58() ?? null;
    if (!solanaConnected || !address || address === lastFetchedBalanceForAddress.current) {
      return;
    }
    lastFetchedBalanceForAddress.current = address;
    const t = setTimeout(() => {
      void fetchPrivacyUsdcBalance();
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solanaConnected, solanaPublicKey?.toBase58()]);

  return (
    <div className="w-full h-screen overflow-y-auto bg-gradient-to-br from-gray-50 via-white to-gray-100">
      <div className="w-full min-h-full flex items-center justify-center p-4">
        <div className="w-full max-w-2xl space-y-4 py-4">
          <div className="flex items-center mb-4">
            <button
              onClick={() => router.push("/")}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </button>
          </div>

          <div className="flex flex-col gap-4 w-full p-4 border rounded-lg bg-card">
            <h1 className="text-xl font-semibold text-center">Yield AI Private Bridge</h1>
            <h3 className="text-xl font-semibold text-center">Powered by Privacy Cash</h3>

            {/* Блок комиссий слева, блок кошельков справа */}
            {solanaConnected ? (
              <div className="flex flex-wrap items-start gap-4">
                <div className="w-full md:flex-[0_0_calc(50%-0.5rem)] md:min-w-0 p-3 border rounded-lg bg-card">
                  <span className="text-sm font-medium text-muted-foreground block mb-2">
                    Withdraw fees
                  </span>
                  {withdrawConfig ? (
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <p>
                        USDC protocol fee:{" "}
                        {typeof withdrawConfig.withdraw_fee_rate === "number"
                          ? `${(withdrawConfig.withdraw_fee_rate * 100).toFixed(3)}% of amount`
                          : "see relayer config"}
                        {withdrawConfig.usdc_withdraw_rent_fee
                          ? ` + ${withdrawConfig.usdc_withdraw_rent_fee} USDC rent`
                          : ""}
                        .
                      </p>
                      <p>
                        SOL network fee: approximately{" "}
                        <span className="font-mono">0.002 SOL</span> required for on-chain tx fees.
                      </p>
                    </div>
                  ) : withdrawConfigError ? (
                    <p className="text-sm text-muted-foreground">
                      Failed to load withdraw fees: {withdrawConfigError}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">Loading withdraw fees…</p>
                  )}
                </div>
                {solanaAddress ? (
              <div className="w-full md:flex-[0_0_calc(50%-0.5rem)] md:min-w-0 p-3 border rounded-lg bg-card space-y-2">
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
                          {isSolanaLoading ? "..." : solanaTotalValue !== null ? formatCurrency(solanaTotalValue, 2) : "N/A"}
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

                  {/* Aptos Wallet */}
                  {aptosConnected && aptosAccount ? (
                    <div>
                      <div className="flex items-center justify-between cursor-pointer hover:bg-accent/50 rounded p-1 -m-1 transition-colors" onClick={() => setIsAptosBalanceExpanded(!isAptosBalanceExpanded)}>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm font-medium text-muted-foreground shrink-0">
                            Aptos {isDerivedWallet ? "(Derived)" : "(Native)"}
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
                            {isAptosLoading ? "..." : formatCurrency(aptosTotalValue, 2)}
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
                      disabled={aptosConnecting}
                      onClick={(e) => {
                        e.stopPropagation();
                        const wrapper = e.currentTarget.parentElement;
                        const hiddenButton = wrapper?.querySelector("button") as HTMLElement;
                        if (hiddenButton) hiddenButton.click();
                      }}
                    >
                      {aptosConnecting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Connecting...
                        </>
                      ) : (
                        "Connect Aptos Wallet"
                      )}
                    </Button>
                  </div>
                )}
                </div>
              ) : null}
              </div>
            ) : !solanaConnected ? (
              <div className="flex flex-col items-end gap-2">
                {walletConnectMounted ? (
                  <Dialog open={isSolanaDialogOpen} onOpenChange={setIsSolanaDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" disabled={isSolanaConnecting}>
                        {isSolanaConnecting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Connecting...
                          </>
                        ) : (
                          "Connect Solana Wallet"
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
                        availableSolanaWallets.map((w, i) => (
                          <Button
                            key={`${w.adapter.name}-${i}-${w.adapter.url ?? ""}`}
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
                ) : (
                  <Button size="sm" disabled>
                    Connect Solana Wallet
                  </Button>
                )}
                <div className="relative">
                  <div className="[&>button]:hidden">
                    <WalletSelector />
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={aptosConnecting}
                    onClick={(e) => {
                      e.stopPropagation();
                      const wrapper = e.currentTarget.parentElement;
                      const hiddenButton = wrapper?.querySelector("div button") as HTMLElement | null;
                      if (hiddenButton) hiddenButton.click();
                    }}
                  >
                    {aptosConnecting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      "Connect Aptos Wallet"
                    )}
                  </Button>
                </div>
              </div>
            ) : null}

            {/* Ниже блока кошельков: баланс Privacy, депозит, вывод, Burn to Aptos и т.д. (только если подключён Solana) */}
            {solanaConnected && (
              <div className="pt-2 border-t space-y-3">
              <span className="text-sm font-medium text-muted-foreground block">
                Privacy Cash Balance (USDC)
              </span>

              {/* Первая строка: баланс */}
              <div>
                {privacyBalanceUsdcError && (
                  <p className="text-xs text-destructive">{privacyBalanceUsdcError}</p>
                )}
                {privacyBalanceUsdcLoading && !privacyBalanceUsdcError && (
                  <p className="text-xs text-muted-foreground flex items-center gap-2">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Loading private USDC balance…
                  </p>
                )}
                {privacyBalanceUsdc !== null && !privacyBalanceUsdcLoading && !privacyBalanceUsdcError && (
                  <p className="font-mono text-sm">
                    {privacyBalanceUsdc.toFixed(6)} USDC
                  </p>
                )}
              </div>

              {/* Amount to deposit USDC — над блоком Withdraw */}
              <div className="space-y-1">
                <span className="text-sm text-muted-foreground block">
                  Amount to deposit USDC
                </span>
                <div className="flex items-center gap-2 justify-between">
                  <Input
                    type="number"
                    min="0"
                    step="0.000001"
                    placeholder="0.000000"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleSendToDeposit}
                    disabled={isDepositing || !depositAmount || Number(depositAmount) <= 0}
                  >
                    {isDepositing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Preparing…
                      </>
                    ) : (
                      "Deposit to private pool"
                    )}
                  </Button>
                </div>
              </div>

              {/* Amount to withdraw USDC — под блоком Deposit */}
              {privacyBalanceUsdc !== null &&
                !privacyBalanceUsdcLoading &&
                !privacyBalanceUsdcError &&
                privacyBalanceUsdc > 0 && (
                  <div className="space-y-1">
                    <span className="text-sm text-muted-foreground block">
                      Amount to withdraw USDC
                    </span>
                    <div className="flex items-center gap-2 justify-between">
                      <Input
                        type="number"
                        min="0"
                        step="0.000001"
                        placeholder="0.000000"
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={handleWithdrawUsdc}
                        disabled={isWithdrawing || !aptosConnected}
                      >
                        {isWithdrawing ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Withdrawing…
                          </>
                        ) : (
                          "Withdraw from private pool and bridge"
                        )}
                      </Button>
                    </div>
                  </div>
                )}

              {tmpWallet && (
                <div className="pt-2 border-t text-xs space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-muted-foreground">
                      Temporary withdraw wallet (Solana)
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowTmpSecrets((v) => !v)}
                      className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                    >
                      {showTmpSecrets ? (
                        <>
                          <EyeOff className="w-4 h-4" />
                          <span>Hide</span>
                        </>
                      ) : (
                        <>
                          <Eye className="w-4 h-4" />
                          <span>Show</span>
                        </>
                      )}
                    </button>
                  </div>
                  {showTmpSecrets && (
                    <div className="space-y-1 font-mono break-all">
                      <div>
                        <span className="font-semibold">Address:</span>{" "}
                        <span>{tmpWallet.address}</span>
                      </div>
                      <div>
                        <span className="font-semibold">Seed phrase:</span>{" "}
                        <span>{tmpWallet.seedPhrase}</span>
                      </div>
                      <div>
                        <span className="font-semibold">Private key (base58):</span>{" "}
                        <span>{tmpWallet.privateKey}</span>
                      </div>
                      <div className="pt-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isTmpBridgeRunning || !aptosConnected || !aptosAccount}
                          onClick={async () => {
                            if (!tmpWallet || !aptosAccount) return;
                            setIsTmpBridgeRunning(true);
                            try {
                              await runBurnAndMintToAptos(tmpWallet);
                            } finally {
                              setIsTmpBridgeRunning(false);
                            }
                          }}
                        >
                          {isTmpBridgeRunning ? "Bridging…" : "Withdraw from tmp wallet and bridge"}
                        </Button>
                        <span className="ml-2 text-muted-foreground text-xs">
                          Use if funds are stuck on tmp wallet after a failed burn.
                        </span>
                      </div>
                    </div>
                  )}

                </div>
              )}
            </div>

            )}
          </div>

          <ActionLog items={actionLog} title="Privacy Bridge Actions" />
          {lastBurnParams && (
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <Link
                href={`/minting-aptos?signature=${encodeURIComponent(lastBurnParams.signature)}&sourceDomain=5&finalRecipient=${encodeURIComponent(lastBurnParams.finalRecipient)}`}
                className="text-blue-600 hover:underline"
              >
                Mint on Aptos →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PrivacyBridgePage() {
  return <PrivacyBridgeContent />;
}

