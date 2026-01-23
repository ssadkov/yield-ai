"use client";

import { Suspense, useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useWallet as useSolanaWallet } from "@solana/wallet-adapter-react";
import { useWallet as useAptosWallet } from "@aptos-labs/wallet-adapter-react";
import bs58 from "bs58";

import { BridgeView } from "@/components/bridge/BridgeView";
import { useToast } from "@/components/ui/use-toast";
import { SolanaWalletProviderWrapper } from "../bridge3/SolanaWalletProvider";
import { useAptosClient } from "@/contexts/AptosClientContext";
import { WalletSelector } from "@/components/WalletSelector";
import { 
  Account, 
  AccountAddress,
  MoveVector,
  U32,
  U64,
  Ed25519PrivateKey, 
  AccountAuthenticatorAbstraction
} from "@aptos-labs/ts-sdk";
import { signAptosTransactionWithSolana } from "@aptos-labs/derived-wallet-solana";
import { StandardWalletAdapter as SolanaWalletAdapter } from "@solana/wallet-standard-wallet-adapter-base";
import { UserResponseStatus } from "@aptos-labs/wallet-standard";
import { GasStationService } from "@/lib/services/gasStation";
import { normalizeAuthenticator } from "@/lib/hooks/useTransactionSubmitter";

// USDC token addresses
const USDC_SOLANA = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"; // USDC on Solana
const USDC_APTOS =
  "0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b"; // USDC on Aptos

// Chains configuration
const CHAINS = [
  { id: "Solana", name: "Solana" },
  { id: "Aptos", name: "Aptos" },
];

// Tokens configuration
const TOKENS = [
  {
    id: USDC_SOLANA,
    symbol: "USDC",
    name: "USD Coin",
    chain: "Solana",
  },
  {
    id: USDC_APTOS,
    symbol: "USDC",
    name: "USD Coin",
    chain: "Aptos",
  },
];

// CCTP Circle constants for Aptos
// Entry function from Aptos Explorer:
// https://explorer.aptoslabs.com/account/0x35e75139eea19566dc8ac00be056e9bd605e788370d76e8bacf87177aeb32dac/modules/code/cctp_tools/deposit_for_burn?network=mainnet
const CCTP_DEPOSIT_FOR_BURN_ENTRY_FUNCTION = 
  "0x35e75139eea19566dc8ac00be056e9bd605e788370d76e8bacf87177aeb32dac::cctp_tools::deposit_for_burn";

// Domain IDs for CCTP
const DOMAIN_SOLANA = 5;
const DOMAIN_APTOS = 9;

// Helper to convert Solana address to hex bytes (for CCTP mint_recipient)
function solanaAddressToHexBytes(solanaAddress: string): Uint8Array {
  const decoded = bs58.decode(solanaAddress);
  return new Uint8Array(decoded);
}

// Helper to get Associated Token Account (ATA) address for Solana
// For Solana destination, mint_recipient must be the token account address (ATA), not the public key
async function getSolanaTokenAccountAddress(
  ownerPublicKey: string,
  mintAddress: string
): Promise<string> {
  const { getAssociatedTokenAddress } = await import("@solana/spl-token");
  const { PublicKey } = await import("@solana/web3.js");
  
  const ownerPubkey = new PublicKey(ownerPublicKey);
  const mintPubkey = new PublicKey(mintAddress);
  
  const ataAddress = await getAssociatedTokenAddress(
    mintPubkey,
    ownerPubkey,
    false // allowOwnerOffCurve
  );
  
  return ataAddress.toBase58();
}

// Helper: получить expireTimestamp на основе времени сети Aptos
async function getAptosExpireTimestampSecs(ttlSeconds: number = 1800): Promise<number | undefined> {
  try {
    const res = await fetch("https://fullnode.mainnet.aptoslabs.com/v1");
    if (!res.ok) {
      console.warn("[Bridge6] Failed to fetch ledger info for expireTimestamp, status:", res.status);
      return undefined;
    }
    const ledgerInfo = await res.json();
    if (!ledgerInfo.ledger_timestamp) {
      console.warn("[Bridge6] ledger_timestamp not found in ledger info");
      return undefined;
    }
    const ledgerTimestamp = parseInt(ledgerInfo.ledger_timestamp, 10);
    if (Number.isNaN(ledgerTimestamp)) {
      console.warn("[Bridge6] Invalid ledger_timestamp:", ledgerInfo.ledger_timestamp);
      return undefined;
    }
    const ledgerTimestampSecs = Math.floor(ledgerTimestamp / 1_000_000);
    return ledgerTimestampSecs + ttlSeconds;
  } catch (e) {
    console.warn("[Bridge6] Error while fetching ledger info for expireTimestamp:", e);
    return undefined;
  }
}

function Bridge6PageContent() {
  const router = useRouter();
  const { toast } = useToast();
  const aptosClient = useAptosClient();

  const { publicKey: solanaPublicKey, wallet: solanaWallet, signMessage } = useSolanaWallet();
  const { 
    account: aptosAccount, 
    connected: aptosConnected,
    wallet: aptosWallet,
    signTransaction,
    signAndSubmitTransaction 
  } = useAptosWallet();

  // Get Gas Station transaction submitter for sponsored transactions
  const gasStationService = useMemo(() => GasStationService.getInstance(), []);
  const transactionSubmitter = useMemo(() => gasStationService.getTransactionSubmitter(), [gasStationService]);

  // Form state variables (same as /bridge4)
  const [sourceChain, setSourceChain] = useState<(typeof CHAINS)[0] | null>(
    CHAINS[1]
  ); // Aptos
  const [sourceToken, setSourceToken] = useState<(typeof TOKENS)[0] | null>(
    TOKENS.find((t) => t.chain === "Aptos") || null
  );
  const [destChain, setDestChain] = useState<(typeof CHAINS)[0] | null>(
    CHAINS[0]
  ); // Solana
  const [destToken, setDestToken] = useState<(typeof TOKENS)[0] | null>(
    TOKENS.find((t) => t.chain === "Solana") || null
  );
  const [transferAmount, setTransferAmount] = useState<string>("0.1");
  const [destinationAddress, setDestinationAddress] = useState<string>("");
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferStatus, setTransferStatus] = useState<string>("");

  const solanaAddress = solanaPublicKey?.toBase58() || null;

  // Same UX as /bridge4: default destination = connected Solana wallet
  useEffect(() => {
    if (solanaAddress) setDestinationAddress(solanaAddress);
  }, [solanaAddress]);

  // Ensure source/dest are always set (matches /bridge4 behavior)
  useEffect(() => {
    if (!sourceChain) setSourceChain(CHAINS[1]);
    if (!sourceToken) setSourceToken(TOKENS.find((t) => t.chain === "Aptos") || null);
    if (!destChain) setDestChain(CHAINS[0]);
    if (!destToken) setDestToken(TOKENS.find((t) => t.chain === "Solana") || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTransfer = async () => {
    setIsTransferring(true);
    setTransferStatus("Initializing CCTP burn...");

    try {
      if (!solanaAddress) {
        throw new Error("Connect a Solana wallet first");
      }

      console.log('[Bridge6] Wallet connection status:', {
        aptosConnected,
        hasAptosAccount: !!aptosAccount,
        hasAptosWallet: !!aptosWallet,
        aptosAccountAddress: aptosAccount?.address?.toString(),
        aptosWalletName: aptosWallet?.name,
      });

      if (!aptosConnected || !aptosAccount || !aptosWallet) {
        throw new Error(
          `Please connect an Aptos wallet. Status: connected=${aptosConnected}, account=${!!aptosAccount}, wallet=${!!aptosWallet}`
        );
      }
      if (!signTransaction) {
        throw new Error("Wallet does not support signTransaction");
      }

      // Validate amount
      const amountNum = parseFloat(transferAmount);
      if (isNaN(amountNum) || amountNum <= 0) {
        throw new Error("Please enter a valid amount");
      }

      // Convert amount to octas (USDC has 6 decimals)
      const amountOctas = BigInt(Math.floor(amountNum * 1_000_000));

      console.log('[Bridge6] Starting CCTP burn:', {
        amount: amountNum,
        amountOctas: amountOctas.toString(),
        solanaAddress,
        aptosAccount: aptosAccount.address.toString(),
        gasStationAvailable: !!transactionSubmitter,
        gasStationServiceAvailable: gasStationService.isAvailable(),
      });

      // Check USDC balance on Aptos account
      setTransferStatus("Checking USDC balance...");
      try {
        const response = await fetch(
          `https://api.mainnet.aptoslabs.com/v1/accounts/${aptosAccount.address.toString()}/resources`
        );
        
        if (!response.ok) {
          console.warn('[Bridge6] Could not fetch account resources:', response.status, response.statusText);
        } else {
          const resources: any[] = await response.json();
          console.log('[Bridge6] Account resources fetched:', resources.length);
          
          const usdcResource = resources.find((resource: any) => {
            const resourceType = resource.type || '';
            if (!resourceType.includes('0x1::coin::CoinStore<')) return false;
            const usdcAddress = USDC_APTOS.startsWith('0x') ? USDC_APTOS.slice(2) : USDC_APTOS;
            return resourceType.includes(usdcAddress);
          });
          
          if (usdcResource && usdcResource.data?.coin?.value) {
            const balance = BigInt(usdcResource.data.coin.value);
            console.log('[Bridge6] USDC balance found:', {
              balance: balance.toString(),
              balanceFormatted: (Number(balance) / 1_000_000).toFixed(6),
              required: amountOctas.toString(),
              requiredFormatted: (Number(amountOctas) / 1_000_000).toFixed(6),
              hasEnough: balance >= amountOctas,
            });
            
            if (balance < amountOctas) {
              throw new Error(
                `Insufficient USDC balance. Required: ${(Number(amountOctas) / 1_000_000).toFixed(6)} USDC, ` +
                `Available: ${(Number(balance) / 1_000_000).toFixed(6)} USDC`
              );
            }
          } else {
            console.warn('[Bridge6] USDC coin resource not found');
            setTransferStatus(`Warning: USDC balance not found. Transaction may fail if balance is insufficient.`);
          }
        }
      } catch (balanceError: any) {
        if (balanceError.message?.includes('Insufficient USDC balance')) {
          throw balanceError;
        }
        console.warn('[Bridge6] Could not check USDC balance:', balanceError.message);
      }

      // ВАЖНО: Для Solana destination mint_recipient должен быть адресом токен-аккаунта (ATA),
      // а НЕ публичным ключом владельца!
      setTransferStatus("Computing Solana token account address (ATA)...");
      const tokenAccountAddress = await getSolanaTokenAccountAddress(
        destinationAddress || solanaAddress,
        USDC_SOLANA
      );
      
      console.log("[Bridge6] Solana token account (ATA) address:", tokenAccountAddress);
      console.log("[Bridge6] Solana owner public key:", destinationAddress || solanaAddress);
      
      // Convert Solana token account address (ATA) to bytes for mint_recipient
      const mintRecipientBytes = solanaAddressToHexBytes(tokenAccountAddress);
      
      // TODO: Check entry function signature to determine correct argument types
      // Expected arguments for deposit_for_burn entry function:
      // [ amount: u64, destinationDomain: u32, mintRecipient: vector<u8>, burnToken: address ]
      // OR
      // [ amount: u64, destinationDomain: u32, mintRecipient: address, burnToken: address ]
      // Need to check actual function signature from Aptos Explorer
      
      setTransferStatus("Building entry function transaction...");

      const isDerivedWallet = aptosWallet && !aptosWallet.isAptosNativeWallet;
      const useGasStation = !!transactionSubmitter;

      // Check APT balance on derived wallet only if Gas Station is not available
      // If Gas Station is available, it will pay for gas (sponsored transaction)
      if (isDerivedWallet && !useGasStation) {
        try {
          const accountResources = await aptosClient.getAccountResources({
            accountAddress: aptosAccount.address,
          });
          
          const aptCoinResource = accountResources.find(
            (r: any) => r.type === "0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>"
          );
          
          const aptBalance = aptCoinResource 
            ? BigInt((aptCoinResource.data as any).coin.value)
            : BigInt(0);
          
          const minRequiredApt = BigInt(100000) * BigInt(100) / BigInt(1e8);
          
          console.log('[Bridge6] Derived wallet APT balance check (Gas Station not available):', {
            balance: aptBalance.toString(),
            balanceFormatted: (Number(aptBalance) / 1e8).toFixed(8),
            minRequired: minRequiredApt.toString(),
            minRequiredFormatted: (Number(minRequiredApt) / 1e8).toFixed(8),
            hasEnoughBalance: aptBalance >= minRequiredApt,
          });
          
          if (aptBalance < minRequiredApt) {
            throw new Error(
              `Insufficient APT balance for gas. Required: ${(Number(minRequiredApt) / 1e8).toFixed(8)} APT, ` +
              `Available: ${(Number(aptBalance) / 1e8).toFixed(8)} APT. ` +
              `Note: Gas Station is not available. Please ensure NEXT_PUBLIC_APTOS_GAS_STATION_KEY is configured.`
            );
          }
        } catch (balanceErr: any) {
          if (balanceErr.message?.includes('Insufficient APT balance')) {
            throw balanceErr;
          }
          console.warn('[Bridge6] Failed to check APT balance (may be new account):', balanceErr?.message);
        }
      } else if (isDerivedWallet && useGasStation) {
        console.log('[Bridge6] Gas Station available - skipping APT balance check (Gas Station will pay for gas)');
      }

      // Ставим expireTimestamp по времени сети Aptos
      // Gas Station имеет ограничение: expireTimestamp не может быть больше чем "сейчас + 120 секунд"
      // Поэтому для Gas Station используем 100 секунд (с запасом), для обычных транзакций - 30 минут
      const ttlSeconds = useGasStation ? 100 : 1800; // Gas Station: 100 сек, обычные: 30 минут
      const expireTimestamp = await getAptosExpireTimestampSecs(ttlSeconds);

      // Function signature from Aptos Explorer:
      // deposit_for_burn(&signer, u64, u32, address, 0x1::object::Object<0x1::fungible_asset::Metadata>)
      // Parameters:
      // 1. &signer - automatically added (sender)
      // 2. u64 - amount
      // 3. u32 - destination_domain
      // 4. address - mint_recipient (Solana ATA address as Aptos address)
      // 5. 0x1::object::Object<0x1::fungible_asset::Metadata> - burn_token (USDC Metadata Object ID)
      
      // Convert mint_recipient bytes to Aptos address
      const mintRecipientAddress = AccountAddress.from(mintRecipientBytes).toString();
      
      // For burn_token, we need the Object ID of the USDC Metadata
      // USDC on Aptos is a fungible asset, so we need to get its Metadata Object ID
      // For now, try using the USDC address directly - if it fails, we'll need to fetch Object ID
      // TODO: May need to fetch Object ID via view function if direct address doesn't work
      const burnTokenObjectId = USDC_APTOS; // Try address first, may need Object ID
      
      const transaction = await aptosClient.transaction.build.simple({
        sender: aptosAccount.address,
        withFeePayer: useGasStation, // Gas Station requires withFeePayer: true
        data: {
          function: CCTP_DEPOSIT_FOR_BURN_ENTRY_FUNCTION as `${string}::${string}::${string}`,
          typeArguments: [], // No generic type parameters
          functionArguments: [
            amountOctas.toString(), // amount: u64 (as string)
            DOMAIN_SOLANA.toString(), // destination_domain: u32 (as string)
            mintRecipientAddress, // mint_recipient: address (as string)
            burnTokenObjectId, // burn_token: Object<Metadata> (as string - try address first)
          ],
        },
        options: {
          maxGasAmount: 100000,
          gasUnitPrice: 100,
          ...(expireTimestamp ? { expireTimestamp } : {}),
        },
      });

      console.log('[Bridge6] Entry function transaction built');
      console.log('[Bridge6] Transaction details:', {
        sender: aptosAccount.address.toString(),
        function: CCTP_DEPOSIT_FOR_BURN_ENTRY_FUNCTION,
        functionArguments: [
          amountOctas.toString(),
          DOMAIN_SOLANA.toString(),
          mintRecipientAddress,
          burnTokenObjectId,
        ],
        mintRecipientBytesLength: mintRecipientBytes.length,
        tokenAccountAddress,
        isDerivedWallet,
        useGasStation,
        hasTransactionSubmitter: !!transactionSubmitter,
      });

      // Prepare signing helpers (we may need to re-sign on Gas Station fallback)
      const authenticationFunction = isDerivedWallet
        ? (aptosWallet as any)?.authenticationFunction || "0x1::solana_derivable_account::authenticate"
        : undefined;
      const domain = isDerivedWallet
        ? (aptosWallet as any)?.domain || (typeof window !== "undefined" ? window.location.host : "localhost")
        : undefined;

      const solanaWalletAdapter: SolanaWalletAdapter | undefined = isDerivedWallet
        ? ({
            ...solanaWallet,
            publicKey: solanaPublicKey,
            signMessage: signMessage || (solanaWallet as any)?.adapter?.signMessage,
            name: (solanaWallet as any)?.adapter?.name || (solanaWallet as any)?.name || "Solana Wallet",
          } as unknown as SolanaWalletAdapter)
        : undefined;

      if (isDerivedWallet) {
        console.log("[Bridge6] Derived wallet detected");
        console.log("[Bridge6] Derived wallet address:", aptosAccount.address.toString());
        console.log("[Bridge6] Derived wallet capabilities:", {
          hasSignAndSubmitTransaction: !!signAndSubmitTransaction,
          hasSignTransaction: !!signTransaction,
          hasAptosSignTransaction: !!aptosWallet?.features?.["aptos:signTransaction"],
        });
        console.log("[Bridge6] Using authentication function:", authenticationFunction);
        console.log("[Bridge6] Using domain:", domain);
        console.log("[Bridge6] Solana wallet adapter prepared:", {
          hasPublicKey: !!solanaWalletAdapter?.publicKey,
          publicKeyBase58: solanaPublicKey?.toBase58(),
          hasSignMessage: !!solanaWalletAdapter?.signMessage,
          walletName: (solanaWalletAdapter as any)?.name,
        });

        if (!solanaWallet || !solanaPublicKey || !solanaWalletAdapter?.signMessage) {
          throw new Error("Solana wallet not connected or signMessage not available. Please connect a Solana wallet that supports signing messages.");
        }
      } else {
        console.log("[Bridge6] Native Aptos wallet detected, requesting aptos:signTransaction");
        if (!aptosWallet?.features?.["aptos:signTransaction"]) {
          throw new Error("Wallet does not support aptos:signTransaction feature");
        }
      }

      const buildSenderAuthenticator = async (tx: any, statusText: string) => {
        if (isDerivedWallet) {
          setTransferStatus(statusText);
          console.log("[Bridge6] Signing (derived wallet) raw tx details:", {
            transactionType: tx?.constructor?.name,
            hasRawTransaction: !!(tx as any)?.rawTransaction,
            rawTransactionNestedType: (tx as any)?.rawTransaction?.constructor?.name,
            withFeePayer: Boolean((tx as any)?.feePayerAddress) || Boolean((tx as any)?.rawTransaction?.feePayerAddress),
          });

          const signResult = await signAptosTransactionWithSolana({
            solanaWallet: solanaWalletAdapter as SolanaWalletAdapter,
            authenticationFunction: authenticationFunction as string,
            rawTransaction: tx,
            domain: domain as string,
          });

          if (signResult.status === UserResponseStatus.REJECTED) {
            throw new Error("User rejected the transaction");
          }
          if (signResult.status !== UserResponseStatus.APPROVED || !signResult.args) {
            throw new Error("Transaction signing failed or was rejected");
          }

          console.log("[Bridge6] Sender authenticator built via signAptosTransactionWithSolana");
          console.log("[Bridge6] Sender authenticator instanceof AccountAuthenticatorAbstraction:", signResult.args instanceof AccountAuthenticatorAbstraction);
          return signResult.args;
        }

        setTransferStatus(statusText);
        const walletSignResult = await aptosWallet!.features["aptos:signTransaction"].signTransaction(tx);
        if (walletSignResult.status === UserResponseStatus.REJECTED) {
          throw new Error("User rejected the transaction");
        }
        if (walletSignResult.status !== UserResponseStatus.APPROVED || !walletSignResult.args) {
          throw new Error("Transaction signing failed or was rejected");
        }
        return walletSignResult.args;
      };

      const senderAuthenticator = await buildSenderAuthenticator(
        transaction as any,
        isDerivedWallet ? "Please sign the transaction in your Solana wallet..." : "Please approve the transaction in your wallet...",
      );

      // Simulate before submit
      try {
        setTransferStatus("Simulating transaction (debug)...");
        const sim = await aptosClient.transaction.simulate.simple({
          transaction,
        });
        const first = sim?.[0];
        console.log("[Bridge6] Simulation result:", {
          success: first?.success,
          vm_status: first?.vm_status,
          gas_used: first?.gas_used,
          hash: first?.hash,
        });
        
        if (first && first.success === false) {
          console.warn("[Bridge6] Simulation failed with vm_status:", first.vm_status);
        } else if (first && first.success === true) {
          console.log("[Bridge6] Simulation passed - transaction should succeed");
        }
      } catch (simErr: any) {
        console.warn("[Bridge6] Simulation failed (may be normal for derived wallets):", simErr?.message || simErr);
      }

      console.log('[Bridge6] Submitting transaction...');
      setTransferStatus(useGasStation ? "Submitting transaction via Gas Station..." : "Submitting transaction (derived wallet pays gas)...");

      // Normalize authenticator for Gas Station compatibility
      const normalizedAuthenticator = normalizeAuthenticator(senderAuthenticator);

      console.log('[Bridge6] Transaction details before submission:', {
        sender: aptosAccount.address.toString(),
        hasSenderAuthenticator: !!senderAuthenticator,
        hasNormalizedAuthenticator: !!normalizedAuthenticator,
        transactionHash: (transaction as any).hash?.toString(),
        isDerivedWallet,
        senderAuthenticatorType: senderAuthenticator?.constructor?.name,
        useGasStation,
        hasTransactionSubmitter: !!transactionSubmitter,
      });

      let response;
      let usedGasStation = false;

      if (useGasStation && transactionSubmitter) {
        // Submit via Gas Station (sponsored transaction - free for user)
        console.log('[Bridge6] Submitting via GasStationTransactionSubmitter...');
        try {
          response = await transactionSubmitter.submitTransaction({
            aptosConfig: aptosClient.config as any,
            transaction: transaction as any,
            senderAuthenticator: normalizedAuthenticator as any,
          });
          usedGasStation = true;
          console.log('[Bridge6] Transaction submitted via Gas Station:', response?.hash);
        } catch (gasStationError: any) {
          console.error('[Bridge6] Gas Station submission failed:', gasStationError);

          const statusCode = gasStationError?.statusCode ?? gasStationError?.response?.status;
          const message =
            gasStationError?.message ||
            gasStationError?.error ||
            (typeof gasStationError === "string" ? gasStationError : "Unknown Gas Station error");

          // No fallback: we do NOT want to spend user funds if Gas Station can't sponsor.
          setTransferStatus(
            `Gas Station rejected sponsorship (${statusCode ?? "unknown"}): ${message}. ` +
              `Please add/enable a rule for ${CCTP_DEPOSIT_FOR_BURN_ENTRY_FUNCTION}`,
          );
          throw new Error(
            `Gas Station rejected sponsorship (${statusCode ?? "unknown"}): ${message}. ` +
              `Rule required for ${CCTP_DEPOSIT_FOR_BURN_ENTRY_FUNCTION}`,
          );
        }
      } else {
        // Submit transaction WITHOUT fee payer - derived wallet pays gas
        console.log('[Bridge6] Submitting without Gas Station (derived wallet pays gas)...');
        response = await aptosClient.transaction.submit.simple({
          transaction: transaction,
          senderAuthenticator: normalizedAuthenticator,
        });
      }

      if (!response || !response.hash) {
        throw new Error(`Transaction submission failed: no hash returned`);
      }

      console.log('[Bridge6] Transaction submitted:', response.hash);
      const gasStationNote = usedGasStation ? " (sponsored by Gas Station)" : "";
      setTransferStatus(`Burn transaction submitted! Hash: ${response.hash.slice(0, 8)}...${response.hash.slice(-8)}${gasStationNote}`);

      toast({
        title: "Burn Transaction Submitted",
        description: `Transaction hash: ${response.hash.slice(0, 8)}...${response.hash.slice(-8)}${gasStationNote}`,
      });

      // TODO: Wait for transaction to be finalized, then:
      // 1. Extract messageHash from transaction events
      // 2. Poll Circle Attestation API for attestation
      // 3. Call mint on Solana with message + attestation

      setTransferStatus(`✅ Burn completed! Next: waiting for attestation... (TODO: implement attestation polling and Solana mint)`);

    } catch (e: any) {
      console.error('[Bridge6] Transfer error:', e);
      try {
        const errorDetails: any = {
          message: e?.message,
          status: e?.status,
          data: e?.data,
          response: e?.response,
        };
        
        if (e?.data?.vm_error_code) {
          errorDetails.vm_error_code = e.data.vm_error_code;
          errorDetails.vm_error_type = e.data.error_code;
        }
        
        if (e?.data?.message) {
          errorDetails.dataMessage = e.data.message;
        }
        
        console.error("[Bridge6] AptosApiError details:", errorDetails);
        
        let userMessage = e?.message || "Failed to initiate burn transaction";
        if (e?.data?.vm_error_code === 4016) {
          userMessage = "Transaction aborted. This usually means insufficient USDC balance or invalid transaction parameters. Please check your USDC balance and try again.";
        } else if (e?.data?.vm_error_code) {
          userMessage = `Transaction failed with error code ${e.data.vm_error_code}. ${e?.data?.message || e?.message || "Please try again."}`;
        }
        
        setTransferStatus(`Error: ${userMessage}`);
        toast({
          variant: "destructive",
          title: "Transfer Failed",
          description: userMessage,
        });
      } catch {}
    } finally {
      setIsTransferring(false);
    }
  };

  return (
    <div className="w-full h-screen overflow-y-auto bg-gradient-to-br from-gray-50 via-white to-gray-100">
      <div className="w-full min-h-full flex items-start justify-center p-4 md:items-center">
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

          {/* Aptos Wallet Selector */}
          {sourceChain?.id === "Aptos" && (
            <div className="mb-4 p-4 border rounded-lg bg-card">
              <label className="text-sm font-medium text-muted-foreground mb-2 block">
                Aptos Wallet (Source)
              </label>
              <WalletSelector />
              {aptosConnected && aptosAccount && (
                <div className="mt-2 text-xs text-muted-foreground">
                  Connected: {aptosAccount.address.toString().slice(0, 8)}...
                  {aptosAccount.address.toString().slice(-8)}
                </div>
              )}
            </div>
          )}

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
            showSwapButton={false}
            disableAssetSelection={true}
            hideSourceWallet={true}
            hideDestinationAddress={true}
          />
        </div>
      </div>
    </div>
  );
}

export default function Bridge6Page() {
  return (
    <SolanaWalletProviderWrapper>
      <Suspense fallback={<div>Loading...</div>}>
        <Bridge6PageContent />
      </Suspense>
    </SolanaWalletProviderWrapper>
  );
}
