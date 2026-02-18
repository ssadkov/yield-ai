import { useEffect, useRef } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { getAptosWalletNameFromStorage } from "@/lib/aptosWalletUtils";

/**
 * Hook to restore native Aptos wallet connection on page load.
 * 
 * The Aptos adapter has autoConnect, but it sometimes fails for native wallets
 * (like Petra) especially after page refresh. This hook ensures native wallets
 * are reconnected by checking localStorage and calling connect() if needed.
 * 
 * Use this hook in Sidebar and MobileTabs components to ensure native Aptos
 * wallet cards are displayed correctly.
 */
export function useAptosNativeRestore() {
  const { connected, wallets, connect, wallet, account } = useWallet();
  const hasRestoredRef = useRef(false);

  useEffect(() => {
    // Skip if already connected to the correct wallet
    if (connected && account?.address) {
      hasRestoredRef.current = false; // Reset for future disconnects
      return;
    }

    // Skip if we've already tried restoring this session
    if (hasRestoredRef.current) return;

    // Only run on client
    if (typeof window === "undefined") return;

    // Get stored wallet name
    const storedName = getAptosWalletNameFromStorage();
    
    // Skip if no stored wallet or if it's a derived wallet
    if (!storedName || storedName.endsWith(" (Solana)")) return;

    // Skip if no wallets available yet
    if (!wallets?.length) return;

    // Check if the stored wallet exists in available wallets
    const walletExists = wallets.some((w) => w.name === storedName);
    if (!walletExists) {
      console.log("[useAptosNativeRestore] Stored wallet not found:", storedName);
      return;
    }

    // Mark as attempted
    hasRestoredRef.current = true;

    // Attempt to connect
    console.log("[useAptosNativeRestore] Attempting to restore native Aptos wallet:", storedName);
    
    // Use async IIFE to handle potential errors
    (async () => {
      try {
        await connect(storedName);
        console.log("[useAptosNativeRestore] Successfully restored:", storedName);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        // Silently ignore user rejection and already connected errors
        if (
          message.includes("User") ||
          message.includes("rejected") ||
          message.includes("already connected")
        ) {
          console.log("[useAptosNativeRestore] User rejected or already connected:", message);
        } else {
          console.error("[useAptosNativeRestore] Failed to restore:", error);
        }
      }
    })();
  }, [connected, wallets, connect, account?.address]);

  // Return the wallet state for convenience
  return {
    connected,
    account,
    wallet,
    address: account?.address?.toString() ?? null,
  };
}
