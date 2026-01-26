"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useWallet as useSolanaWallet, useConnection } from "@solana/wallet-adapter-react";
import { useWallet as useAptosWallet } from "@aptos-labs/wallet-adapter-react";
import bs58 from "bs58";

import { BridgeView } from "@/components/bridge/BridgeView";
import { useToast } from "@/components/ui/use-toast";
import { SolanaWalletProviderWrapper } from "../bridge3/SolanaWalletProvider";
import { useAptosClient } from "@/contexts/AptosClientContext";
import { WalletSelector } from "@/components/WalletSelector";
import { performMintOnSolana } from "@/lib/cctp-mint-core";
import { ActionLog, type ActionLogItem } from "@/components/bridge/ActionLog";
import {
  Account,
  AccountAddress,
  MoveVector,
  U32,
  U64,
  Ed25519PrivateKey,
} from "@aptos-labs/ts-sdk";
import { UserResponseStatus } from "@aptos-labs/wallet-standard";

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

// Helper function to create fee payer Account from env vars
async function getFeePayerAccount(): Promise<Account | undefined> {
  try {
    const privateKeyHex = process.env.NEXT_PUBLIC_APTOS_PAYER_WALLET_PRIVATE_KEY;
    if (!privateKeyHex) {
      console.log("[Bridge5] No fee payer private key found in env");
      return undefined;
    }
    const account = Account.fromPrivateKey({
      privateKey: new Ed25519PrivateKey(privateKeyHex),
    });
    const expectedAddress = process.env.NEXT_PUBLIC_APTOS_PAYER_WALLET_ADDRESS;
    if (
      expectedAddress &&
      account.accountAddress.toString().toLowerCase() !==
        expectedAddress.toLowerCase()
    ) {
      console.warn(
        "[Bridge5] Fee payer address mismatch:",
        expectedAddress,
        account.accountAddress.toString(),
      );
    }
    console.log("[Bridge5] Fee payer account created:", account.accountAddress.toString());
    return account;
  } catch (error) {
    console.error("[Bridge5] Failed to create fee payer account:", error);
    return undefined;
  }
}

// Helper: получить expireTimestamp на основе времени сети Aptos
async function getAptosExpireTimestampSecs(
  ttlSeconds: number = 1800,
): Promise<number | undefined> {
  try {
    const res = await fetch("https://fullnode.mainnet.aptoslabs.com/v1");
    if (!res.ok) {
      console.warn(
        "[Bridge5] Failed to fetch ledger info for expireTimestamp, status:",
        res.status,
      );
      return undefined;
    }
    const ledgerInfo = await res.json();
    if (!ledgerInfo.ledger_timestamp) {
      console.warn("[Bridge5] ledger_timestamp not found in ledger info");
      return undefined;
    }
    const ledgerTimestamp = parseInt(ledgerInfo.ledger_timestamp, 10);
    if (Number.isNaN(ledgerTimestamp)) {
      console.warn("[Bridge5] Invalid ledger_timestamp:", ledgerInfo.ledger_timestamp);
      return undefined;
    }
    const ledgerTimestampSecs = Math.floor(ledgerTimestamp / 1_000_000);
    return ledgerTimestampSecs + ttlSeconds;
  } catch (e) {
    console.warn("[Bridge5] Error while fetching ledger info for expireTimestamp:", e);
    return undefined;
  }
}

// Load bytecode from Circle CCTP GitHub repository
async function loadDepositForBurnBytecode(): Promise<Uint8Array> {
  const bytecodeUrl =
    "https://raw.githubusercontent.com/circlefin/aptos-cctp/master/typescript/example/precompiled-move-scripts/mainnet/deposit_for_burn.mv";

  try {
    console.log("[Bridge5] Loading bytecode from:", bytecodeUrl);
    const response = await fetch(bytecodeUrl);
    if (!response.ok) {
      throw new Error(
        `Failed to load bytecode: ${response.status} ${response.statusText}`,
      );
    }
    const arrayBuffer = await response.arrayBuffer();
    const bytecode = new Uint8Array(arrayBuffer);
    console.log("[Bridge5] Bytecode loaded, size:", bytecode.length, "bytes");
    return bytecode;
  } catch (error) {
    console.error("[Bridge5] Failed to load bytecode:", error);
    throw new Error(
      `Failed to load deposit_for_burn bytecode: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    );
  }
}

function Bridge5PageContent() {
  const router = useRouter();
  const { toast } = useToast();
  const aptosClient = useAptosClient();

  const { publicKey: solanaPublicKey, wallet: solanaWallet, signTransaction } = useSolanaWallet();
  const { connection: solanaConnection } = useConnection();
  const {
    account: aptosAccount,
    connected: aptosConnected,
    wallet: aptosWallet,
  } = useAptosWallet();

  // Form state variables (same as /bridge3)
  const [sourceChain, setSourceChain] = useState<(typeof CHAINS)[0] | null>(
    CHAINS[1],
  ); // Aptos
  const [sourceToken, setSourceToken] = useState<(typeof TOKENS)[0] | null>(
    TOKENS.find((t) => t.chain === "Aptos") || null,
  );
  const [destChain, setDestChain] = useState<(typeof CHAINS)[0] | null>(
    CHAINS[0],
  ); // Solana
  const [destToken, setDestToken] = useState<(typeof TOKENS)[0] | null>(
    TOKENS.find((t) => t.chain === "Solana") || null,
  );
  const [transferAmount, setTransferAmount] = useState<string>("0.1");
  const [destinationAddress, setDestinationAddress] = useState<string>("");
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferStatus, setTransferStatus] = useState<string>("");
  const [actionLog, setActionLog] = useState<ActionLogItem[]>([]);

  const solanaAddress = solanaPublicKey?.toBase58() || null;

  // Same UX as /bridge3: default destination = connected Solana wallet
  useEffect(() => {
    if (solanaAddress) setDestinationAddress(solanaAddress);
  }, [solanaAddress]);

  // Ensure source/dest are always set (matches /bridge3 behavior)
  useEffect(() => {
    if (!sourceChain) setSourceChain(CHAINS[1]);
    if (!sourceToken)
      setSourceToken(TOKENS.find((t) => t.chain === "Aptos") || null);
    if (!destChain) setDestChain(CHAINS[0]);
    if (!destToken)
      setDestToken(TOKENS.find((t) => t.chain === "Solana") || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    console.log(`[Bridge5 Action] ${status.toUpperCase()}: ${message}`, link ? `Link: ${link}` : '');
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
          startTime,
          duration: status !== 'pending' ? now - startTime : undefined,
        };
      }
      return newLog;
    });
  };

  // Helper: Fetch attestation with pending check (like in minting-solana)
  const fetchAttestationWithPendingCheck = async (
    sourceDomain: number,
    signature: string,
    onProgress?: (attempt: number, maxAttempts: number) => void
  ) => {
    const irisApiUrl = process.env.NEXT_PUBLIC_CIRCLE_CCTP_ATTESTATION_URL;
    
    if (!irisApiUrl) {
      throw new Error('NEXT_PUBLIC_CIRCLE_CCTP_ATTESTATION_URL environment variable is not set');
    }

    const maxAttempts = 15;
    const initialDelay = 10000; // 10 seconds
    const maxDelay = 60000; // 60 seconds

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (onProgress) {
        onProgress(attempt, maxAttempts);
      }

      const delay = Math.min(initialDelay * Math.pow(2, attempt - 1), maxDelay);
      if (attempt > 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      try {
        const url = `${irisApiUrl}/${sourceDomain}/${signature.trim()}`;
        console.log(`[Bridge5] Fetching attestation, attempt ${attempt}/${maxAttempts}:`, url);

        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          if (response.status === 404) {
            console.log(`[Bridge5] Attestation not ready yet (404), attempt ${attempt}/${maxAttempts}`);
            if (attempt === maxAttempts) {
              throw new Error(`Attestation not ready after ${maxAttempts} attempts. Please wait and try again.`);
            }
            continue;
          }

          const errorText = await response.text();
          console.error('[Bridge5] Circle API error:', response.status, errorText);
          throw new Error(`Circle API error: ${response.status} ${response.statusText}. ${errorText}`);
        }

        const attestationData = await response.json();

        // Validate attestation data
        if (!attestationData.messages || attestationData.messages.length === 0) {
          throw new Error('No messages found in attestation data');
        }

        const firstMessage = attestationData.messages[0];
        
        if (!firstMessage.message) {
          throw new Error('Message field is missing');
        }
        
        if (!firstMessage.attestation) {
          throw new Error('Attestation field is missing');
        }

        // Check if attestation is still pending
        const attestationValue = firstMessage.attestation;
        if (typeof attestationValue === 'string') {
          const upperAttestation = attestationValue.toUpperCase().trim();
          if (upperAttestation === 'PENDING' || upperAttestation === 'PENDING...') {
            console.log('[Bridge5] Attestation still pending:', {
              attestationValue: attestationValue.substring(0, 50),
            });
            if (attempt === maxAttempts) {
              throw new Error(`Attestation not ready yet. Status: ${attestationValue.substring(0, 50)}`);
            }
            continue;
          }
        }

        console.log('[Bridge5] Attestation received successfully:', {
          messageLength: firstMessage.message.length,
          attestationLength: firstMessage.attestation.length,
          eventNonce: firstMessage.eventNonce,
        });

        return attestationData;
      } catch (error: any) {
        if (attempt === maxAttempts) {
          throw error;
        }
        // Continue retrying for network errors
        if (error.message?.includes('Attestation not ready')) {
          continue;
        }
        // For other errors, wait a bit and retry
        console.warn(`[Bridge5] Error on attempt ${attempt}, retrying:`, error.message);
      }
    }

    throw new Error(`Failed to fetch attestation after ${maxAttempts} attempts`);
  };

  // Helper: Wait for Aptos transaction confirmation
  const waitForAptosConfirmation = async (txHash: string): Promise<void> => {
    const maxAttempts = 30; // 30 attempts * 2s = 60 seconds max
    const confirmationDelay = 2000; // 2 seconds

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const txResponse = await fetch(`https://fullnode.mainnet.aptoslabs.com/v1/transactions/by_hash/${txHash}`);
        
        if (!txResponse.ok) {
          if (txResponse.status === 404) {
            // Transaction not found yet, continue waiting
            if (attempt % 5 === 0) {
              updateLastAction(
                `Waiting for Aptos transaction confirmation... (${attempt}/${maxAttempts})`,
                'pending',
                `https://explorer.aptoslabs.com/txn/${txHash}?network=mainnet`,
                'View transaction on Aptos Explorer'
              );
            }
            await new Promise(resolve => setTimeout(resolve, confirmationDelay));
            continue;
          }
          throw new Error(`Failed to fetch transaction: ${txResponse.status} ${txResponse.statusText}`);
        }

        const txData = await txResponse.json();
        
        if (txData.success && txData.vm_status === "Executed successfully") {
          updateLastAction(
            'Aptos transaction confirmed',
            'success',
            `https://explorer.aptoslabs.com/txn/${txHash}?network=mainnet`,
            'View transaction on Aptos Explorer'
          );
          return;
        } else if (txData.vm_status) {
          throw new Error(`Transaction failed: ${txData.vm_status}`);
        }
        
        // Update status periodically
        if (attempt % 5 === 0) {
          updateLastAction(
            `Waiting for Aptos transaction confirmation... (${attempt}/${maxAttempts})`,
            'pending',
            `https://explorer.aptoslabs.com/txn/${txHash}?network=mainnet`,
            'View transaction on Aptos Explorer'
          );
        }
      } catch (error: any) {
        if (attempt === maxAttempts) {
          throw new Error(`Failed to confirm transaction: ${error.message}`);
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, confirmationDelay));
    }
    
    throw new Error('Transaction confirmation timeout');
  };

  const handleTransfer = async () => {
    setIsTransferring(true);
    setTransferStatus("Initializing CCTP burn...");
    setActionLog([]); // Clear previous actions
    const transferStartTime = Date.now();
    addAction('Initializing CCTP burn...', 'pending', undefined, undefined, transferStartTime);

    try {
      if (!solanaAddress) {
        throw new Error("Connect a Solana wallet first");
      }

      console.log("[Bridge5] Wallet connection status:", {
        aptosConnected,
        hasAptosAccount: !!aptosAccount,
        hasAptosWallet: !!aptosWallet,
        aptosAccountAddress: aptosAccount?.address?.toString(),
        aptosWalletName: aptosWallet?.name,
        isAptosNativeWallet: aptosWallet?.isAptosNativeWallet,
      });

      if (!aptosConnected || !aptosAccount || !aptosWallet) {
        throw new Error(
          `Please connect an Aptos wallet. Status: connected=${aptosConnected}, account=${!!aptosAccount}, wallet=${!!aptosWallet}`,
        );
      }

      // bridge5: поддерживаем **только нативные Aptos-кошельки** (Petra и т.п.)
      if (!aptosWallet.isAptosNativeWallet) {
        throw new Error(
          "This bridge (/bridge5) supports only native Aptos wallets (e.g. Petra). Please disconnect the Solana-derived wallet and connect a native Aptos wallet.",
        );
      }

      if (!aptosWallet.features?.["aptos:signTransaction"]) {
        throw new Error("Wallet does not support aptos:signTransaction feature");
      }

      // Validate amount
      const amountNum = parseFloat(transferAmount);
      if (isNaN(amountNum) || amountNum <= 0) {
        throw new Error("Please enter a valid amount");
      }

      // Convert amount to octas (USDC has 6 decimals)
      const amountOctas = BigInt(Math.floor(amountNum * 1_000_000));

      console.log("[Bridge5] Starting CCTP burn:", {
        amount: amountNum,
        amountOctas: amountOctas.toString(),
        solanaAddress,
        aptosAccount: aptosAccount.address.toString(),
      });

      // ВАЖНО: Для Solana destination mint_recipient должен быть адресом токен-аккаунта (ATA),
      // а НЕ публичным ключом владельца!
      // Программа на Solana сравнивает recipient_token_account.key() с mint_recipient из message_body
      setTransferStatus("Computing Solana token account address (ATA)...");
      const tokenAccountAddress = await getSolanaTokenAccountAddress(
        destinationAddress || solanaAddress,
        USDC_SOLANA
      );
      
      console.log("[Bridge5] Solana token account (ATA) address:", tokenAccountAddress);
      console.log("[Bridge5] Solana owner public key:", destinationAddress || solanaAddress);
      
      // Convert Solana token account address (ATA) to bytes and wrap as Aptos address for mint_recipient
      const mintRecipientBytes = solanaAddressToHexBytes(tokenAccountAddress);
      const mintRecipientAddress = AccountAddress.from(mintRecipientBytes);

      setTransferStatus("Loading bytecode for deposit_for_burn...");

      // Get fee payer account for sponsoring the transaction
      const feePayerAccount = await getFeePayerAccount();
      if (!feePayerAccount) {
        throw new Error(
          "Fee payer account not available. Please configure NEXT_PUBLIC_APTOS_PAYER_WALLET_PRIVATE_KEY",
        );
      }

      console.log(
        "[Bridge5] Fee payer account available:",
        feePayerAccount.accountAddress.toString(),
      );

      // Load bytecode from Circle's GitHub repository
      const bytecode = await loadDepositForBurnBytecode();

      setTransferStatus("Building bytecode transaction with fee payer...");

      // См. официальный пример Circle: depositForBurn.ts
      // https://github.com/circlefin/aptos-cctp/blob/master/typescript/example/depositForBurn.ts
      // Порядок и типы аргументов:
      // [ amount: u64, destinationDomain: u32, mintRecipient: address, burnToken: address ]
      const scriptFunctionArguments = [
        new U64(amountOctas), // amount: u64
        new U32(DOMAIN_SOLANA), // destination_domain: u32
        mintRecipientAddress, // mint_recipient: address (derived from Solana pubkey bytes)
        AccountAddress.fromString(USDC_APTOS), // burn_token: address (USDC on Aptos)
      ];

      // Ставим expireTimestamp по времени сети Aptos, чтобы транзакция не протухала во время подписи
      const expireTimestamp = await getAptosExpireTimestampSecs(1800); // 30 минут

      const transaction = await aptosClient.transaction.build.simple({
        sender: aptosAccount.address,
        withFeePayer: true,
        feePayerAddress: feePayerAccount.accountAddress,
        data: {
          bytecode: bytecode,
          typeArguments: [],
          functionArguments: scriptFunctionArguments,
        },
        options: {
          maxGasAmount: 100000,
          gasUnitPrice: 100,
          ...(expireTimestamp ? { expireTimestamp } : {}),
        },
      } as any);

      console.log("[Bridge5] Sponsored bytecode transaction built (with feePayerAddress)");

      // Подписываем транзакцию **только нативным Aptos-кошельком**
      setTransferStatus("Please approve the transaction in your Aptos wallet...");
      const walletSignResult =
        await aptosWallet.features["aptos:signTransaction"].signTransaction(
          transaction,
        );
      if (walletSignResult.status === UserResponseStatus.REJECTED) {
        throw new Error("User rejected the transaction");
      }
      if (walletSignResult.status !== UserResponseStatus.APPROVED || !walletSignResult.args) {
        throw new Error("Transaction signing failed or was rejected");
      }
      const senderAuthenticator = walletSignResult.args;
      console.log("[Bridge5] Sender signed via native Aptos wallet");

      console.log("[Bridge5] User transaction signed, signing as fee payer...");
      setTransferStatus("Fee payer is signing the transaction...");

      // Sign as fee payer (service wallet pays for gas)
      const feePayerAuthenticator = aptosClient.transaction.signAsFeePayer({
        signer: feePayerAccount,
        transaction,
      });

      // Опционально: симуляция (для debug логов)
      try {
        setTransferStatus("Simulating transaction (debug)...");
        const sim = await aptosClient.transaction.simulate.simple({
          transaction,
        });
        const first = sim?.[0];
        console.log("[Bridge5] Simulation result:", first);
        if (first && first.success === false) {
          console.warn("[Bridge5] Simulation vm_status:", first.vm_status);
        }
      } catch (simErr: any) {
        console.warn(
          "[Bridge5] Simulation failed (still may submit):",
          simErr?.message || simErr,
        );
      }

      console.log("[Bridge5] Fee payer signed, submitting transaction...");
      setTransferStatus("Submitting transaction with fee payer...");

      // Submit transaction with both authenticators (user + fee payer)
      const response = await aptosClient.transaction.submit.simple({
        transaction,
        senderAuthenticator,
        feePayerAuthenticator,
      });

      if (!response || !response.hash) {
        throw new Error(`Transaction submission failed: no hash returned`);
      }

      const aptosTxHash = response.hash;
      console.log("[Bridge5] Transaction submitted:", aptosTxHash);
      
      updateLastAction(
        `Burn transaction submitted`,
        'success',
        `https://explorer.aptoslabs.com/txn/${aptosTxHash}?network=mainnet`,
        'View transaction on Aptos Explorer'
      );

      setTransferStatus(
        `Burn transaction submitted! Hash: ${aptosTxHash.slice(
          0,
          8,
        )}...${aptosTxHash.slice(-8)}`,
      );

      toast({
        title: "Burn Transaction Submitted",
        description: `Transaction hash: ${aptosTxHash.slice(
          0,
          8,
        )}...${aptosTxHash.slice(-8)}`,
      });

      // Step 2: Wait for Aptos transaction confirmation
      setTransferStatus("Waiting for Aptos transaction confirmation...");
      addAction('Waiting for Aptos transaction confirmation...', 'pending', 
        `https://explorer.aptoslabs.com/txn/${aptosTxHash}?network=mainnet`,
        'View transaction on Aptos Explorer'
      );
      
      await waitForAptosConfirmation(aptosTxHash);

      // Step 3: Wait for attestation from Circle
      setTransferStatus("Waiting for attestation from Circle...");
      
      if (!solanaConnection || !solanaPublicKey || !signTransaction) {
        throw new Error("Solana wallet connection required for minting");
      }

      // Fetch attestation with pending check
      addAction('Requesting attestation from Circle...', 'pending',
        `https://iris-api.circle.com/v1/messages/${DOMAIN_APTOS}/${aptosTxHash}`,
        'View attestation request'
      );

      const attestationData = await fetchAttestationWithPendingCheck(
        DOMAIN_APTOS,
        aptosTxHash,
        (attempt, maxAttempts) => {
          setTransferStatus(`Waiting for attestation... (attempt ${attempt}/${maxAttempts})`);
          updateLastAction(
            `Requesting attestation from Circle... (attempt ${attempt}/${maxAttempts})`,
            'pending',
            `https://iris-api.circle.com/v1/messages/${DOMAIN_APTOS}/${aptosTxHash}`,
            'View attestation request'
          );
        }
      );

      updateLastAction(
        'Attestation received from Circle',
        'success',
        `https://iris-api.circle.com/v1/messages/${DOMAIN_APTOS}/${aptosTxHash}`,
        'View attestation'
      );

      setTransferStatus("Attestation received! Preparing mint transaction on Solana...");
      addAction('Preparing mint transaction on Solana...', 'pending');

      // Step 4: Mint on Solana
      const recipientAddress = destinationAddress || solanaAddress;
      if (!recipientAddress) {
        throw new Error("Recipient address is required");
      }

      const mintTxSignature = await performMintOnSolana(
        attestationData,
        recipientAddress,
        solanaConnection,
        solanaPublicKey,
        signTransaction,
        (status) => {
          setTransferStatus(status);
        }
      );

      updateLastAction(
        'USDC minted successfully on Solana',
        'success',
        `https://solscan.io/tx/${mintTxSignature}`,
        'View transaction on Solscan'
      );

      addAction(
        'Bridge complete!',
        'success'
      );

      setTransferStatus(`✅ Bridge complete! Mint transaction: ${mintTxSignature.slice(0, 8)}...${mintTxSignature.slice(-8)}`);

      toast({
        title: "Bridge Complete!",
        description: `USDC minted successfully on Solana! Transaction: ${mintTxSignature.slice(0, 8)}...${mintTxSignature.slice(-8)}. View on Solscan: https://solscan.io/tx/${mintTxSignature}`,
      });
      
    } catch (e: any) {
      console.error("[Bridge5] Transfer error:", e);
      try {
        console.error("[Bridge5] AptosApiError details:", {
          message: e?.message,
          status: e?.status,
          data: e?.data,
          response: e?.response,
        });
      } catch {}
      setTransferStatus(`Error: ${e?.message || "Unknown error"}`);
      addAction(
        `Transfer failed: ${e?.message || "Unknown error"}`,
        'error'
      );
      toast({
        variant: "destructive",
        title: "Transfer Failed",
        description: e?.message || "Failed to initiate burn transaction",
      });
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

          {/* Aptos Wallet Selector (since BridgeView doesn't support Aptos wallet selection) */}
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

          <ActionLog items={actionLog} />
        </div>
      </div>
    </div>
  );
}

export default function Bridge5Page() {
  return (
    <SolanaWalletProviderWrapper>
      <Suspense fallback={<div>Loading...</div>}>
        <Bridge5PageContent />
      </Suspense>
    </SolanaWalletProviderWrapper>
  );
}

