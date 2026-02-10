"use client";

import { useEffect, useRef } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { getAptosWalletNameFromStorage } from "@/lib/aptosWalletUtils";

const LOG = "[aptos-restore]";
const SKIP_DERIVED_KEY = "skip_auto_connect_derived_aptos";

function isDerivedName(name: string): boolean {
  return String(name).trim().endsWith(" (Solana)");
}

/**
 * Controlled Aptos restore from localStorage ("AptosWalletName").
 * We keep Aptos and Solana independent by default:
 * - If user explicitly disconnected derived on /bridge, we set sessionStorage SKIP_DERIVED_KEY=1.
 *   In that case we DO NOT auto-connect derived again.
 * - Native wallets (Petra, etc.) are allowed to restore even when skip is set.
 */
export function AptosWalletRestore({ children }: { children: React.ReactNode }) {
  const { wallets, wallet, connected, connect, isLoading } = useWallet();
  const prevConnected = useRef<boolean>(connected);
  const restoreRunId = useRef(0);

  // If disconnected externally, allow restore again
  useEffect(() => {
    const was = prevConnected.current;
    if (was && !connected) {
      restoreRunId.current += 1;
    }
    prevConnected.current = connected;
  }, [connected]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (connected || isLoading) return;
    if (!wallets?.length) return;

    const stored = getAptosWalletNameFromStorage();
    if (!stored) return;

    const skipDerived = sessionStorage.getItem(SKIP_DERIVED_KEY) === "1";
    if (skipDerived && isDerivedName(stored)) {
      if (typeof console !== "undefined" && console.log) {
        console.log(LOG, "Skip derived restore due to user disconnect:", stored);
      }
      return;
    }

    const exists = wallets.some((w) => w.name === stored);
    if (!exists) return;

    const thisRun = (restoreRunId.current += 1);
    const derived = isDerivedName(stored);

    const attempt = () => {
      if (restoreRunId.current !== thisRun) return;
      if (connected || isLoading) return;
      try {
        if (typeof console !== "undefined" && console.log) {
          console.log(LOG, "Restoring Aptos wallet:", stored);
        }
        connect(stored);
      } catch (e) {
        if (typeof console !== "undefined" && console.warn) {
          console.warn(LOG, "connect() threw:", (e as any)?.message ?? e);
        }
      }
    };

    // Native wallets: single attempt (avoid repeated signature prompts).
    // Derived wallets: retry a few times (they usually reconnect silently).
    attempt();
    const delays = derived ? [300, 900, 2000, 4500] : [800];
    const timers = delays.map((ms) =>
      setTimeout(() => {
        attempt();
      }, ms)
    );
    return () => timers.forEach((t) => clearTimeout(t));
  }, [connected, isLoading, wallets, connect, wallet?.name]);

  return <>{children}</>;
}

