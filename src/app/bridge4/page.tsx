"use client";

import { Suspense, useEffect, useState } from "react";
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
  Ed25519PublicKey, 
  Ed25519Signature,
  AnyPublicKey,
  AnySignature,
  AccountAuthenticatorSingleKey,
  AccountAuthenticatorAbstraction
} from "@aptos-labs/ts-sdk";
import { signAptosTransactionWithSolana } from "@aptos-labs/derived-wallet-solana";
import { StandardWalletAdapter as SolanaWalletAdapter } from "@solana/wallet-standard-wallet-adapter-base";
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

// CCTP Circle constants for Aptos
// For deposit_for_burn, we use precompiled Move script (.mv file) as bytecode
// This is loaded from Circle's GitHub repository
// Gas Station doesn't support bytecode transactions, so we use fee payer Account instead

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
      console.log('[Bridge4] No fee payer private key found in env');
      return undefined;
    }
    const account = Account.fromPrivateKey({
      privateKey: new Ed25519PrivateKey(privateKeyHex),
    });
    const expectedAddress = process.env.NEXT_PUBLIC_APTOS_PAYER_WALLET_ADDRESS;
    if (expectedAddress && account.accountAddress.toString().toLowerCase() !== expectedAddress.toLowerCase()) {
      console.warn('[Bridge4] Fee payer address mismatch:', expectedAddress, account.accountAddress.toString());
    }
    console.log('[Bridge4] Fee payer account created:', account.accountAddress.toString());
    return account;
  } catch (error) {
    console.error('[Bridge4] Failed to create fee payer account:', error);
    return undefined;
  }
}

// Helper: получить expireTimestamp на основе времени сети Aptos
async function getAptosExpireTimestampSecs(ttlSeconds: number = 1800): Promise<number | undefined> {
  try {
    const res = await fetch("https://fullnode.mainnet.aptoslabs.com/v1");
    if (!res.ok) {
      console.warn("[Bridge4] Failed to fetch ledger info for expireTimestamp, status:", res.status);
      return undefined;
    }
    const ledgerInfo = await res.json();
    if (!ledgerInfo.ledger_timestamp) {
      console.warn("[Bridge4] ledger_timestamp not found in ledger info");
      return undefined;
    }
    const ledgerTimestamp = parseInt(ledgerInfo.ledger_timestamp, 10);
    if (Number.isNaN(ledgerTimestamp)) {
      console.warn("[Bridge4] Invalid ledger_timestamp:", ledgerInfo.ledger_timestamp);
      return undefined;
    }
    const ledgerTimestampSecs = Math.floor(ledgerTimestamp / 1_000_000);
    return ledgerTimestampSecs + ttlSeconds;
  } catch (e) {
    console.warn("[Bridge4] Error while fetching ledger info for expireTimestamp:", e);
    return undefined;
  }
}

// Load bytecode from Circle CCTP GitHub repository
async function loadDepositForBurnBytecode(): Promise<Uint8Array> {
  // URL to the precompiled Move script from Circle's GitHub
  const bytecodeUrl = "https://raw.githubusercontent.com/circlefin/aptos-cctp/master/typescript/example/precompiled-move-scripts/mainnet/deposit_for_burn.mv";
  
  try {
    console.log('[Bridge4] Loading bytecode from:', bytecodeUrl);
    const response = await fetch(bytecodeUrl);
    if (!response.ok) {
      throw new Error(`Failed to load bytecode: ${response.status} ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const bytecode = new Uint8Array(arrayBuffer);
    console.log('[Bridge4] Bytecode loaded, size:', bytecode.length, 'bytes');
    return bytecode;
  } catch (error) {
    console.error('[Bridge4] Failed to load bytecode:', error);
    throw new Error(`Failed to load deposit_for_burn bytecode: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function Bridge4PageContent() {
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

  // Form state variables (same as /bridge3)
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

  // Same UX as /bridge3: default destination = connected Solana wallet
  useEffect(() => {
    if (solanaAddress) setDestinationAddress(solanaAddress);
  }, [solanaAddress]);

  // Ensure source/dest are always set (matches /bridge3 behavior)
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
      // Better logging for debugging
      console.log('[Bridge4] Wallet connection status:', {
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

      console.log('[Bridge4] Starting CCTP burn:', {
        amount: amountNum,
        amountOctas: amountOctas.toString(),
        solanaAddress,
        aptosAccount: aptosAccount.address.toString(),
      });

      // Check USDC balance on Aptos account (optional check, transaction will fail if insufficient)
      setTransferStatus("Checking USDC balance...");
      try {
        // Use direct REST API call (more reliable than aptosClient.getAccountResources)
        const response = await fetch(
          `https://api.mainnet.aptoslabs.com/v1/accounts/${aptosAccount.address.toString()}/resources`
        );
        
        if (!response.ok) {
          console.warn('[Bridge4] Could not fetch account resources:', response.status, response.statusText);
          // Continue anyway
        } else {
          const resources: any[] = await response.json();
          console.log('[Bridge4] Account resources fetched:', resources.length);
          
          // USDC on Aptos can be in different formats:
          // 1. 0x1::coin::CoinStore<0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b::coin::USDC>
          // 2. 0x1::coin::CoinStore<0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b>
          // Try to find USDC coin resource
          const usdcResource = resources.find((resource: any) => {
            const resourceType = resource.type || '';
            // Check if it's a CoinStore and contains USDC address
            if (!resourceType.includes('0x1::coin::CoinStore<')) return false;
            // Check for USDC address (with or without 0x prefix)
            const usdcAddress = USDC_APTOS.startsWith('0x') ? USDC_APTOS.slice(2) : USDC_APTOS;
            return resourceType.includes(usdcAddress);
          });
          
          if (usdcResource && usdcResource.data?.coin?.value) {
            const balance = BigInt(usdcResource.data.coin.value);
            console.log('[Bridge4] USDC balance found:', {
              balance: balance.toString(),
              balanceFormatted: (Number(balance) / 1_000_000).toFixed(6),
              required: amountOctas.toString(),
              requiredFormatted: (Number(amountOctas) / 1_000_000).toFixed(6),
              hasEnough: balance >= amountOctas,
              resourceType: usdcResource.type,
            });
            
            if (balance < amountOctas) {
              throw new Error(
                `Insufficient USDC balance. Required: ${(Number(amountOctas) / 1_000_000).toFixed(6)} USDC, ` +
                `Available: ${(Number(balance) / 1_000_000).toFixed(6)} USDC`
              );
            }
          } else {
            console.warn('[Bridge4] USDC coin resource not found');
            console.log('[Bridge4] Available CoinStore resources:', 
              resources
                .filter((r: any) => r.type?.includes('CoinStore'))
                .map((r: any) => r.type)
                .slice(0, 5)
            );
            // Don't throw - let transaction proceed, it will fail with better error if balance is insufficient
            setTransferStatus(`Warning: USDC balance not found. Transaction may fail if balance is insufficient.`);
          }
        }
      } catch (balanceError: any) {
        // If it's an explicit insufficient balance error, throw it
        if (balanceError.message?.includes('Insufficient USDC balance')) {
          throw balanceError;
        }
        // Otherwise, just warn and continue
        console.warn('[Bridge4] Could not check USDC balance:', balanceError.message);
        // Continue anyway, transaction will fail if balance is insufficient
      }

      // Note: Gas Station doesn't support bytecode transactions
      // We'll use fee payer Account instead for sponsoring the transaction

      // ВАЖНО: Для Solana destination mint_recipient должен быть адресом токен-аккаунта (ATA),
      // а НЕ публичным ключом владельца!
      // Программа на Solana сравнивает recipient_token_account.key() с mint_recipient из message_body
      setTransferStatus("Computing Solana token account address (ATA)...");
      const tokenAccountAddress = await getSolanaTokenAccountAddress(
        destinationAddress || solanaAddress,
        USDC_SOLANA
      );
      
      console.log("[Bridge4] Solana token account (ATA) address:", tokenAccountAddress);
      console.log("[Bridge4] Solana owner public key:", destinationAddress || solanaAddress);
      
      // Convert Solana token account address (ATA) to bytes and wrap as Aptos address for mint_recipient
      const mintRecipientBytes = solanaAddressToHexBytes(tokenAccountAddress);
      const mintRecipientAddress = AccountAddress.from(mintRecipientBytes);
      
      setTransferStatus("Loading bytecode for deposit_for_burn...");

      // Get fee payer account for sponsoring the transaction
      const feePayerAccount = await getFeePayerAccount();
      if (!feePayerAccount) {
        throw new Error("Fee payer account not available. Please configure NEXT_PUBLIC_APTOS_PAYER_WALLET_PRIVATE_KEY");
      }

      console.log('[Bridge4] Fee payer account available:', feePayerAccount.accountAddress.toString());

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
        mintRecipientAddress, // mint_recipient: address (derived from Solana ATA address bytes)
        AccountAddress.fromString(USDC_APTOS), // burn_token: address (USDC on Aptos)
      ];

      console.log('[Bridge4] Script function arguments:', {
        amount: amountOctas.toString(),
        amountFormatted: (Number(amountOctas) / 1_000_000).toFixed(6),
        destinationDomain: DOMAIN_SOLANA,
        mintRecipient: mintRecipientAddress.toString(),
        mintRecipientHex: Array.from(mintRecipientBytes).map(b => b.toString(16).padStart(2, '0')).join(''),
        burnToken: USDC_APTOS,
        tokenAccountAddress: tokenAccountAddress,
        solanaOwner: destinationAddress || solanaAddress,
      });

      // Build bytecode transaction WITHOUT fee payer - derived wallet will pay gas
      const isDerivedWallet = aptosWallet && !aptosWallet.isAptosNativeWallet;

      // Check APT balance on derived wallet to ensure it can pay for gas
      if (isDerivedWallet) {
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
          
          const minRequiredApt = BigInt(100000) * BigInt(100) / BigInt(1e8); // maxGasAmount * gasUnitPrice / octas per APT
          
          console.log('[Bridge4] Derived wallet APT balance check:', {
            balance: aptBalance.toString(),
            balanceFormatted: (Number(aptBalance) / 1e8).toFixed(8),
            minRequired: minRequiredApt.toString(),
            minRequiredFormatted: (Number(minRequiredApt) / 1e8).toFixed(8),
            hasEnoughBalance: aptBalance >= minRequiredApt,
          });
          
          if (aptBalance < minRequiredApt) {
            throw new Error(
              `Insufficient APT balance for gas. Required: ${(Number(minRequiredApt) / 1e8).toFixed(8)} APT, ` +
              `Available: ${(Number(aptBalance) / 1e8).toFixed(8)} APT`
            );
          }
        } catch (balanceErr: any) {
          console.warn('[Bridge4] Failed to check APT balance (may be new account):', balanceErr?.message);
          // Continue anyway - transaction will fail if balance is insufficient
        }
      }

      // Ставим expireTimestamp по времени сети Aptos, чтобы транзакция не протухала во время подписи
      const expireTimestamp = await getAptosExpireTimestampSecs(1800); // 30 минут

      const transaction = await aptosClient.transaction.build.simple({
        sender: aptosAccount.address,
        withFeePayer: false, // No fee payer - derived wallet pays gas
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
      });

      console.log('[Bridge4] Bytecode transaction built (NO fee payer - derived wallet pays gas)');
      console.log('[Bridge4] Transaction details:', {
        sender: aptosAccount.address.toString(),
        senderHex: aptosAccount.address.toString(),
        bytecodeSize: bytecode.length,
        scriptArgs: scriptFunctionArguments,
        mintRecipient: scriptFunctionArguments[2],
        isDerivedWallet,
      });

      let senderAuthenticator;

      if (isDerivedWallet) {
        console.log('[Bridge4] Derived wallet detected');
        console.log('[Bridge4] Derived wallet address:', aptosAccount.address.toString());
        console.log('[Bridge4] Derived wallet capabilities:', {
          hasSignAndSubmitTransaction: !!signAndSubmitTransaction,
          hasSignTransaction: !!signTransaction,
          hasAptosSignTransaction: !!aptosWallet?.features?.["aptos:signTransaction"],
        });

        // Note: signAndSubmitTransaction doesn't support bytecode transactions with fee payer
        // So we must use manual signing path for derived wallets with bytecode + fee payer

        // For derived wallets with Account Abstraction, we MUST use signAptosTransactionWithSolana
        // to get the correct AccountAuthenticatorAbstraction type.
        // aptos:signTransaction may return wrong authenticator type for bytecode transactions.
        console.log("[Bridge4] Using signAptosTransactionWithSolana for derived wallet (required for Account Abstraction)");

        // Get authentication function and domain from wallet if available, otherwise use defaults
        const authenticationFunction = (aptosWallet as any)?.authenticationFunction || 
          "0x1::solana_derivable_account::authenticate";
        const domain = (aptosWallet as any)?.domain || 
          (typeof window !== "undefined" ? window.location.host : "localhost");

        console.log('[Bridge4] Using authentication function:', authenticationFunction);
        console.log('[Bridge4] Using domain:', domain);

        // For signAptosTransactionWithSolana, we need to pass the transaction object itself
        // The transaction object from build.simple is already an AnyRawTransaction
        // It has a nested rawTransaction property that contains the actual RawTransaction
        const rawTransaction = transaction as any;
        
        console.log('[Bridge4] Raw transaction details:', {
          transactionType: transaction?.constructor?.name,
          hasRawTransaction: !!(rawTransaction as any).rawTransaction,
          rawTransactionNestedType: (rawTransaction as any).rawTransaction?.constructor?.name,
          hasFeePayerAddress: !!transaction.feePayerAddress,
          feePayerAddress: transaction.feePayerAddress?.toString(),
        });

        if (!solanaWallet || !solanaPublicKey) {
          throw new Error('Solana wallet not connected. Please connect a Solana wallet.');
        }

        // Create adapter object with publicKey and signMessage for signAptosTransactionWithSolana
        // signAptosTransactionWithSolana expects solanaWallet.publicKey and solanaWallet.signMessage to exist
        // Note: solanaWallet from useSolanaWallet() has signMessage in the hook, not directly on wallet
        // We need to create an adapter-like object that has both publicKey and signMessage
        const solanaWalletAdapter = {
          ...solanaWallet,
          publicKey: solanaPublicKey,
          signMessage: signMessage || (solanaWallet as any)?.adapter?.signMessage,
          name: (solanaWallet as any)?.adapter?.name || (solanaWallet as any)?.name || 'Solana Wallet',
        } as unknown as SolanaWalletAdapter;
        
        console.log('[Bridge4] Solana wallet adapter prepared:', {
          hasPublicKey: !!solanaWalletAdapter.publicKey,
          publicKeyBase58: solanaPublicKey?.toBase58(),
          hasSignMessage: !!solanaWalletAdapter.signMessage,
          walletName: solanaWalletAdapter.name,
        });

        setTransferStatus('Please sign the transaction in your Solana wallet...');
        
        try {
          const signResult = await signAptosTransactionWithSolana({
            solanaWallet: solanaWalletAdapter,
            authenticationFunction,
            rawTransaction,
            domain,
          });

          if (signResult.status === UserResponseStatus.REJECTED) {
            throw new Error("User rejected the transaction");
          }

          if (signResult.status !== UserResponseStatus.APPROVED || !signResult.args) {
            throw new Error("Transaction signing failed or was rejected");
          }

          senderAuthenticator = signResult.args;
          console.log('[Bridge4] Sender authenticator built via signAptosTransactionWithSolana');
          console.log('[Bridge4] Sender authenticator:', senderAuthenticator);
          console.log('[Bridge4] Sender authenticator type:', senderAuthenticator?.constructor?.name);
          console.log('[Bridge4] Sender authenticator instanceof AccountAuthenticatorAbstraction:', senderAuthenticator instanceof AccountAuthenticatorAbstraction);
          console.log('[Bridge4] Sender authenticator details:', {
            type: senderAuthenticator?.constructor?.name,
            functionInfo: (senderAuthenticator as any)?.functionInfo,
            hasAbstractionSignature: !!(senderAuthenticator as any)?.abstractionSignature,
            hasSigningMessageDigest: !!(senderAuthenticator as any)?.signingMessageDigest,
            hasAccountIdentity: !!(senderAuthenticator as any)?.accountIdentity,
            abstractionSignatureLength: (senderAuthenticator as any)?.abstractionSignature?.length,
            signingMessageDigestLength: (senderAuthenticator as any)?.signingMessageDigest?.length,
            accountIdentityLength: (senderAuthenticator as any)?.accountIdentity?.length,
            isAccountAuthenticatorAbstraction: senderAuthenticator instanceof AccountAuthenticatorAbstraction,
          });
        } catch (e: any) {
          console.error('[Bridge4] signAptosTransactionWithSolana failed:', e);
          throw new Error(`Failed to sign transaction with Solana wallet: ${e?.message || e}`);
        }
      } else {
        console.log('[Bridge4] Native Aptos wallet detected, requesting aptos:signTransaction');
        setTransferStatus('Please approve the transaction in your wallet...');

        if (!aptosWallet?.features?.['aptos:signTransaction']) {
          throw new Error('Wallet does not support aptos:signTransaction feature');
        }

        const walletSignResult = await aptosWallet.features['aptos:signTransaction'].signTransaction(transaction);
        if (walletSignResult.status === UserResponseStatus.REJECTED) {
          throw new Error('User rejected the transaction');
        }
        if (walletSignResult.status !== UserResponseStatus.APPROVED || !walletSignResult.args) {
          throw new Error('Transaction signing failed or was rejected');
        }
        senderAuthenticator = walletSignResult.args;
      }

      // Simulate before submit to получить vm_status
      // Для derived кошельков симуляция может не работать, но попробуем
      try {
        setTransferStatus("Simulating transaction (debug)...");
        const sim = await aptosClient.transaction.simulate.simple({
          transaction,
          // Для derived кошельков симуляция может требовать правильные ключи
          // но мы пропускаем их, так как симуляция может не поддерживать derived ключи
        });
        const first = sim?.[0];
        console.log("[Bridge4] Simulation result:", {
          success: first?.success,
          vm_status: first?.vm_status,
          gas_used: first?.gas_used,
          hash: first?.hash,
        });
        
        if (first && first.success === false) {
          console.warn("[Bridge4] Simulation failed with vm_status:", first.vm_status);
          // Если симуляция показывает ошибку, это может быть реальная проблема
          // Но для derived кошельков симуляция может быть неточной
        } else if (first && first.success === true) {
          console.log("[Bridge4] Simulation passed - transaction should succeed");
        }
      } catch (simErr: any) {
        console.warn("[Bridge4] Simulation failed (may be normal for derived wallets):", simErr?.message || simErr);
        // Ошибка "Unsupported PublicKey used for simulations" для derived кошельков — нормальная
      }

      console.log('[Bridge4] Submitting transaction (derived wallet pays gas)...');
      setTransferStatus("Submitting transaction...");

      // Log transaction details before submission
      console.log('[Bridge4] Transaction details before submission:', {
        sender: aptosAccount.address.toString(),
        hasSenderAuthenticator: !!senderAuthenticator,
        transactionHash: (transaction as any).hash?.toString(),
        isDerivedWallet,
        senderAuthenticatorType: senderAuthenticator?.constructor?.name,
        hasFeePayer: false,
      });

      // Transaction sender is already set correctly when building (aptosAccount.address)
      // No need to verify - we control the sender when building the transaction

      // Submit transaction WITHOUT fee payer - derived wallet pays gas
      const response = await aptosClient.transaction.submit.simple({
        transaction: transaction,
        senderAuthenticator: senderAuthenticator,
      });

      if (!response || !response.hash) {
        throw new Error(`Transaction submission failed: no hash returned`);
      }

      console.log('[Bridge4] Transaction submitted:', response.hash);
      setTransferStatus(`Burn transaction submitted! Hash: ${response.hash.slice(0, 8)}...${response.hash.slice(-8)}`);

      toast({
        title: "Burn Transaction Submitted",
        description: `Transaction hash: ${response.hash.slice(0, 8)}...${response.hash.slice(-8)}`,
      });

      // TODO: Wait for transaction to be finalized, then:
      // 1. Extract messageHash from transaction events
      // 2. Poll Circle Attestation API for attestation
      // 3. Call mint on Solana with message + attestation

      setTransferStatus(`✅ Burn completed! Next: waiting for attestation... (TODO: implement attestation polling and Solana mint)`);

    } catch (e: any) {
      console.error('[Bridge4] Transfer error:', e);
      // Print AptosApiError payload when available (contains vm_status / details)
      try {
        const errorDetails: any = {
          message: e?.message,
          status: e?.status,
          data: e?.data,
          response: e?.response,
        };
        
        // Extract vm_error_code if available
        if (e?.data?.vm_error_code) {
          errorDetails.vm_error_code = e.data.vm_error_code;
          errorDetails.vm_error_type = e.data.error_code;
        }
        
        // Extract error message from data if available
        if (e?.data?.message) {
          errorDetails.dataMessage = e.data.message;
        }
        
        console.error("[Bridge4] AptosApiError details:", errorDetails);
        
        // Provide more helpful error message for common errors
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
        </div>
      </div>
    </div>
  );
}

export default function Bridge4Page() {
  return (
    <SolanaWalletProviderWrapper>
      <Suspense fallback={<div>Loading...</div>}>
        <Bridge4PageContent />
      </Suspense>
    </SolanaWalletProviderWrapper>
  );
}

