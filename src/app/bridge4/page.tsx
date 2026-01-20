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
  AccountAuthenticatorSingleKey
} from "@aptos-labs/ts-sdk";

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

      // Note: Gas Station doesn't support bytecode transactions
      // We'll use fee payer Account instead for sponsoring the transaction

      // Convert Solana address to bytes and wrap as Aptos address for mint_recipient
      const mintRecipientBytes = solanaAddressToHexBytes(solanaAddress);
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

      // Build bytecode transaction with fee payer
      // For bytecode transactions, we need to use the correct format
      // Function arguments for deposit_for_burn:
      // - amount: u64
      // - destination_domain: u32 (5 for Solana)
      // - mint_recipient: vector<u8> (Solana address as bytes)
      // - burn_token: address (USDC token address on Aptos)
      
      // IMPORTANT: For bytecode Script payloads, Aptos TS-SDK expects *ScriptFunctionArgumentTypes*
      // (BCS-serializable objects), not raw bigint/number/arrays/strings.
      // См. официальный пример Circle: depositForBurn.ts
      // https://github.com/circlefin/aptos-cctp/blob/master/typescript/example/depositForBurn.ts
      // Порядок и типы аргументов:
      // [ amount: u64, destinationDomain: u32, mintRecipient: address, burnToken: address ]
      const scriptFunctionArguments = [
        new U64(amountOctas),                // amount: u64
        new U32(DOMAIN_SOLANA),             // destination_domain: u32
        mintRecipientAddress,               // mint_recipient: address (derived from Solana pubkey bytes)
        AccountAddress.fromString(USDC_APTOS), // burn_token: address (USDC on Aptos)
      ];

      // Build a proper sponsored bytecode transaction.
      // Key detail: `feePayerAddress` must be provided to `build.simple` (top-level), otherwise
      // `getSigningMessage()` can crash trying to read it from the internal raw transaction.
      const isDerivedWallet = aptosWallet && !aptosWallet.isAptosNativeWallet;

      // Ставим expireTimestamp по времени сети Aptos, чтобы транзакция не протухала во время подписи
      const expireTimestamp = await getAptosExpireTimestampSecs(1800); // 30 минут

      const transaction = await aptosClient.transaction.build.simple({
        sender: aptosAccount.address,
        withFeePayer: true,
        // TS types sometimes don't expose this yet; runtime supports it.
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

      console.log('[Bridge4] Sponsored bytecode transaction built (with feePayerAddress)');

      let senderAuthenticator;

      if (isDerivedWallet) {
        console.log('[Bridge4] Derived wallet detected');

        // Prefer the Aptos wallet adapter signing path first.
        // Now that Script args are proper BCS types, many derived wallets can sign successfully.
        if (aptosWallet?.features?.["aptos:signTransaction"]) {
          try {
            setTransferStatus("Please approve the transaction in your wallet...");
            const walletSignResult = await aptosWallet.features["aptos:signTransaction"].signTransaction(transaction as any);
            if (walletSignResult.status === "rejected") {
              throw new Error("User rejected the transaction");
            }
            senderAuthenticator = walletSignResult.args;
            console.log("[Bridge4] Sender signed via aptos:signTransaction (derived wallet)");
          } catch (e: any) {
            console.warn("[Bridge4] aptos:signTransaction failed for derived wallet, falling back to Solana signMessage:", e?.message || e);
          }
        }

        // Fallback: sign Aptos signing message via Solana signMessage (not supported by all Solana wallets).
        if (!senderAuthenticator) {
          console.log('[Bridge4] Using Solana signMessage fallback for derived wallet');

          const signingMessage = aptosClient.transaction.getSigningMessage({ transaction });
          console.log('[Bridge4] Signing message obtained, length:', signingMessage.length);

          if (!solanaWallet?.signMessage) {
            throw new Error('Solana wallet does not support signMessage. Please use a Solana wallet that supports message signing (e.g. Phantom/Solflare) or a native Aptos wallet.');
          }

          setTransferStatus('Please sign the message in your Solana wallet...');
          const signatureResult = await solanaWallet.signMessage(new Uint8Array(signingMessage));

          if (!signatureResult?.signature) {
            throw new Error('Failed to get signature from Solana wallet');
          }

          const signatureBytes = signatureResult.signature;
          if (signatureBytes.length !== 64) {
            throw new Error(`Invalid signature length: expected 64 bytes, got ${signatureBytes.length}`);
          }

          const publicKey = aptosAccount.publicKey;
          const publicKeyBytes =
            publicKey instanceof Ed25519PublicKey ? publicKey.toUint8Array() : publicKey.toUint8Array();

          const ed25519PublicKey = new Ed25519PublicKey(publicKeyBytes);
          const ed25519Signature = new Ed25519Signature(new Uint8Array(signatureBytes));
          senderAuthenticator = new AccountAuthenticatorSingleKey(
            new AnyPublicKey(ed25519PublicKey),
            new AnySignature(ed25519Signature),
          );

          console.log('[Bridge4] Sender authenticator built from Solana signature');
        }
      } else {
        console.log('[Bridge4] Native Aptos wallet detected, requesting aptos:signTransaction');
        setTransferStatus('Please approve the transaction in your wallet...');

        if (!aptosWallet?.features?.['aptos:signTransaction']) {
          throw new Error('Wallet does not support aptos:signTransaction feature');
        }

        const walletSignResult = await aptosWallet.features['aptos:signTransaction'].signTransaction(transaction);
        if (walletSignResult.status === 'rejected') {
          throw new Error('User rejected the transaction');
        }
        senderAuthenticator = walletSignResult.args;
      }

      console.log('[Bridge4] User transaction signed, signing as fee payer...');
      setTransferStatus("Fee payer is signing the transaction...");

      // Sign as fee payer (service wallet pays for gas)
      const feePayerAuthenticator = aptosClient.transaction.signAsFeePayer({
        signer: feePayerAccount,
        transaction: transaction,
      });

      // Simulate before submit to получить vm_status (но не блокировать отправку,
      // если симуляция не поддерживает наш тип ключей, как в случае derived кошельков).
      try {
        setTransferStatus("Simulating transaction (debug)...");
        const sim = await aptosClient.transaction.simulate.simple({
          transaction,
          // signerPublicKey / feePayerPublicKey опускаем — для debug нам важен vm_status,
          // а не корректная подпись симуляции.
        });
        const first = sim?.[0];
        console.log("[Bridge4] Simulation result:", first);
        if (first && first.success === false) {
          console.warn("[Bridge4] Simulation vm_status:", first.vm_status);
          // Пока только логируем vm_status, но не блокируем отправку — так мы увидим
          // причину abort в логах, не ломая UX.
        }
      } catch (simErr: any) {
        console.warn("[Bridge4] Simulation failed (still may submit):", simErr?.message || simErr);
        // Ошибка "Unsupported PublicKey used for simulations" для derived кошельков — нормальная,
        // просто игнорируем и продолжаем отправку.
      }

      console.log('[Bridge4] Fee payer signed, submitting transaction...');
      setTransferStatus("Submitting transaction with fee payer...");

      // Submit transaction with both authenticators (user + fee payer)
      const response = await aptosClient.transaction.submit.simple({
        transaction: transaction,
        senderAuthenticator: senderAuthenticator,
        feePayerAuthenticator: feePayerAuthenticator,
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
        console.error("[Bridge4] AptosApiError details:", {
          message: e?.message,
          status: e?.status,
          data: e?.data,
          response: e?.response,
        });
      } catch {}
      setTransferStatus(`Error: ${e?.message || "Unknown error"}`);
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

