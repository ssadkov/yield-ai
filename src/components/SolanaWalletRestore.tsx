"use client";

import { useEffect, useRef } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletName, WalletReadyState } from "@solana/wallet-adapter-base";

const STORAGE_KEY = "walletName";
const APTOS_WALLET_NAME_KEY = "AptosWalletName";
const SOLANA_SUFFIX = " (Solana)";
const LOG = "[solana-restore]";

/**
 * How restoration works on the MAIN page (same mechanism we mirror here):
 * - WalletProvider from @solana/wallet-adapter-react uses useLocalStorage('walletName', null).
 * - When the component first mounts on the CLIENT, useState's initializer runs and calls
 *   localStorage.getItem('walletName'). If the user had connected before, that returns e.g. '"Trust"',
 *   so the initial state is 'Trust' → adapter is set → autoConnect runs → connection is restored.
 * - When the user selects a wallet (Connect → choose Trust), select() → setWalletName('Trust') is called,
 *   and the useLocalStorage useEffect writes localStorage.setItem('walletName', JSON.stringify('Trust')).
 * So on a full page load, restoration on the main page is that single read in the initializer.
 * On /bridge or /privacy-bridge we run in an effect (after mount); we read the same key and call select()
 * so the same WalletProvider state is updated. If 'walletName' is missing in localStorage (e.g. bridge
 * opened in a new tab before connecting elsewhere), no restore is possible until the user connects again.
 */
function isWalletReady(readyState: WalletReadyState): boolean {
  return (
    readyState === WalletReadyState.Installed ||
    readyState === WalletReadyState.Loadable
  );
}

/**
 * Restores Solana wallet from localStorage after load (SSR leaves adapter=null).
 * Runs inside SolanaProvider so the same connection is shown on all pages after refresh.
 */
export function SolanaWalletRestore({ children }: { children: React.ReactNode }) {
  const { wallets, wallet, connected, select, connect } = useWallet();
  const hasTriggeredSelect = useRef(false);
  const hasTriggeredConnect = useRef(false);

  // 0) Keep localStorage in sync when connected (so other tabs / new tab get the key)
  useEffect(() => {
    if (typeof window === "undefined" || !connected || !wallet) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(wallet.adapter.name));
    } catch {}
  }, [connected, wallet]);

  // 1) Restore selection from localStorage — same key as WalletProvider ('walletName'), retry so we run after hydration
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (connected) {
      if (typeof console !== "undefined" && console.log) {
        console.log(LOG, "Skip restore: already connected");
      }
      return;
    }

    const readSavedName = (): string | null => {
      try {
        const walletNames = new Set<string>(wallets?.map((w) => String(w.adapter.name)) ?? []);

        // Primary: AptosWalletName — on main page only this is often set (e.g. "Trust (Solana)")
        const aptosRaw = window.localStorage.getItem(APTOS_WALLET_NAME_KEY);
        if (aptosRaw) {
          let aptosName: string | null = null;
          try {
            aptosName = JSON.parse(aptosRaw) as string | null;
          } catch {
            aptosName = aptosRaw;
          }
          if (aptosName && typeof aptosName === "string" && aptosName.endsWith(SOLANA_SUFFIX)) {
            const solanaName = aptosName.slice(0, -SOLANA_SUFFIX.length).trim();
            if (solanaName && walletNames.has(solanaName)) return solanaName;
          }
        }

        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as string | null;
          if (parsed && typeof parsed === "string" && walletNames.has(parsed)) return parsed;
        }

        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i);
          if (!key) continue;
          const val = window.localStorage.getItem(key);
          if (!val) continue;
          try {
            const parsed = JSON.parse(val);
            if (typeof parsed === "string" && walletNames.has(parsed)) return parsed;
          } catch {
            if (walletNames.has(val)) return val;
          }
        }
        return null;
      } catch {
        return null;
      }
    };

    let selectCleanup: (() => void) | null = null;

    const runRestore = (attempt?: number): boolean => {
      if (connected) return false;
      const savedName = readSavedName();
      if (!savedName) {
        if (typeof console !== "undefined" && console.log && attempt !== undefined) {
          const keys: string[] = [];
          try {
            for (let i = 0; i < window.localStorage.length; i++) {
              const k = window.localStorage.key(i);
              if (k) keys.push(k);
            }
          } catch {}
          console.log(LOG, "No saved wallet; origin:", window.location.origin, "localStorage keys:", keys.length ? keys : "(empty)", "attempt", attempt);
        }
        return false;
      }

      if (typeof console !== "undefined" && console.log) {
        console.log(LOG, "Restore attempt: savedName=", savedName, "walletsCount=", wallets?.length ?? 0);
      }

      const tryRestoreSelect = () => {
        if (connected) return;
        if (!wallets?.length) return;
        const exists = wallets.some((w) => w.adapter.name === savedName);
        if (!exists) {
          if (typeof console !== "undefined" && console.log) {
            console.log(LOG, "Saved wallet not in list:", savedName, "available:", wallets.map((w) => w.adapter.name));
          }
          return;
        }
        if (hasTriggeredSelect.current) return;
        hasTriggeredSelect.current = true;
        if (typeof console !== "undefined" && console.log) {
          console.log(LOG, "Selecting wallet from localStorage:", savedName);
        }
        select(savedName as WalletName);
      };

      tryRestoreSelect();
      const t1 = setTimeout(tryRestoreSelect, 400);
      const t2 = setTimeout(tryRestoreSelect, 1200);
      const t3 = setTimeout(tryRestoreSelect, 2500);
      const t4 = setTimeout(tryRestoreSelect, 4500);
      selectCleanup = () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
        clearTimeout(t4);
      };
      return true;
    };

    // First run and retries when raw was null (bridge may run before storage is ready)
    runRestore();
    const retryDelays = [100, 300, 800, 2000];
    const retryTimers = retryDelays.map((ms, i) =>
      setTimeout(() => {
        if (connected || hasTriggeredSelect.current) return;
        runRestore(i + 1);
      }, ms)
    );
    return () => {
      retryTimers.forEach((t) => clearTimeout(t));
      selectCleanup?.();
    };
  }, [wallets, connected, select]);

  // 2) When wallet is selected but not connected, call connect() once when adapter is ready
  useEffect(() => {
    if (connected || !wallet) return;
    if (hasTriggeredConnect.current) return;

    const tryConnect = () => {
      if (connected) return;
      const ready = isWalletReady(wallet.readyState);
      if (typeof console !== "undefined" && console.log) {
        console.log(LOG, "Wallet state:", {
          name: wallet.adapter.name,
          readyState: wallet.readyState,
          ready,
        });
      }
      if (!ready) return false;
      hasTriggeredConnect.current = true;
      if (typeof console !== "undefined" && console.log) {
        console.log(LOG, "Calling connect() for", wallet.adapter.name);
      }
      connect().catch((err) => {
        if (typeof console !== "undefined" && console.warn) {
          console.warn(LOG, "connect() failed:", err?.message ?? err);
        }
      });
      return true;
    };

    if (tryConnect()) return;

    const delays = [150, 400, 900, 1800, 3500];
    const timers = delays.map((ms) =>
      setTimeout(() => {
        if (hasTriggeredConnect.current || connected) return;
        tryConnect();
      }, ms)
    );
    return () => timers.forEach((t) => clearTimeout(t));
  }, [wallet, connected, connect]);

  return <>{children}</>;
}
