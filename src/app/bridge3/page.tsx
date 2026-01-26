"use client";

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useWallet as useSolanaWallet } from '@solana/wallet-adapter-react';
import { useWallet as useAptosWallet } from '@aptos-labs/wallet-adapter-react';
import { CrossChainCore, Network } from '@aptos-labs/cross-chain-core';
import { Account, Ed25519PrivateKey } from '@aptos-labs/ts-sdk';
import { BridgeView } from '@/components/bridge/BridgeView';
import { SolanaWalletProviderWrapper } from './SolanaWalletProvider';
import { useToast } from '@/components/ui/use-toast';
import { GasStationService } from '@/lib/services/gasStation';

// Helper function to create fee payer Account
// First tries to use NEXT_PUBLIC_ env vars (for client-side), 
// then falls back to API endpoint (for server-side env vars)
async function getFeePayerAccount(): Promise<Account | undefined> {
  try {
    // First, try to get private key from NEXT_PUBLIC_ env (client-side access)
    const privateKeyHex = process.env.NEXT_PUBLIC_APTOS_PAYER_WALLET_PRIVATE_KEY;
    
    if (privateKeyHex) {
      const account = Account.fromPrivateKey({
        privateKey: new Ed25519PrivateKey(privateKeyHex),
      });

      const expectedAddress = process.env.NEXT_PUBLIC_APTOS_PAYER_WALLET_ADDRESS;
      if (expectedAddress && account.accountAddress.toString().toLowerCase() !== expectedAddress.toLowerCase()) {
        console.warn('[Bridge3] Fee payer address mismatch:', expectedAddress, account.accountAddress.toString());
      }

      console.log('[Bridge3] Fee payer account created from NEXT_PUBLIC_ env:', account.accountAddress.toString());
      return account;
    }

    // If NEXT_PUBLIC_ not available, try to get from API endpoint (server-side env vars)
    // Note: This requires the private key to be available on the server
    // For security, we'll need to pass the Account through a different mechanism
    // For now, we'll return undefined and let the user add NEXT_PUBLIC_ prefix
    console.log('[Bridge3] No fee payer private key found in NEXT_PUBLIC_ env vars');
    console.log('[Bridge3] Please add NEXT_PUBLIC_APTOS_PAYER_WALLET_PRIVATE_KEY to .env.local for client-side access');
    return undefined;
  } catch (error) {
    console.error('[Bridge3] Failed to create fee payer account:', error);
    return undefined;
  }
}

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

function Bridge3PageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { publicKey: solanaPublicKey, connected: solanaConnected } = useSolanaWallet();
  const {
    account: aptosAccount,
    wallet: aptosWallet,
    connected: aptosConnected,
    signTransaction,
    signAndSubmitTransaction,
  } = useAptosWallet();
  const { toast } = useToast();
  
  // Form state variables
  const [sourceChain, setSourceChain] = useState<typeof CHAINS[0] | null>(CHAINS[1]); // Aptos
  const [sourceToken, setSourceToken] = useState<typeof TOKENS[0] | null>(
    TOKENS.find((t) => t.chain === 'Aptos') || null
  );
  const [destChain, setDestChain] = useState<typeof CHAINS[0] | null>(CHAINS[0]); // Solana
  const [destToken, setDestToken] = useState<typeof TOKENS[0] | null>(
    TOKENS.find((t) => t.chain === 'Solana') || null
  );
  const [transferAmount, setTransferAmount] = useState<string>('0.1');
  const [destinationAddress, setDestinationAddress] = useState<string>('');
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferStatus, setTransferStatus] = useState<string>('');
  const [crossChainCore, setCrossChainCore] = useState<CrossChainCore | null>(null);
  const [quote, setQuote] = useState<any>(undefined);
  
  // Determine source chain from wallet type (like in CCTPWithdraw example)
  const [wormholeSourceChain, setWormholeSourceChain] = useState<string | null>(null);

  // Get Solana address from connected wallet
  const solanaAddress = solanaPublicKey?.toBase58() || null;

  // Update destination address when Solana wallet is connected
  useEffect(() => {
    if (solanaAddress) {
      setDestinationAddress(solanaAddress);
    }
  }, [solanaAddress]);

  // Determine source chain from wallet type (like in CCTPWithdraw example)
  // For withdraw: sourceChain is the origin chain of the wallet (Solana for derived wallets)
  // This is because we're withdrawing FROM the derived Aptos account TO the original Solana account
  useEffect(() => {
    if (!aptosWallet) {
      setWormholeSourceChain(null);
      return;
    }
    
    // Check if wallet is Solana derived wallet
    // Solana derived wallets have isAptosNativeWallet === false and name contains "Solana"
    // For withdraw, sourceChain should be the origin chain (Solana) when using derived wallet
    if (!aptosWallet.isAptosNativeWallet && aptosWallet.name?.includes('Solana')) {
      // This is a Solana-derived Aptos wallet
      // For withdraw, sourceChain is the origin chain (Solana)
      setWormholeSourceChain('Solana');
    } else {
      // Native Aptos wallet - sourceChain is Aptos
      setWormholeSourceChain('Aptos');
    }
  }, [aptosWallet]);

  // Log connected Aptos wallet info when Solana wallet is connected
  useEffect(() => {
    if (solanaConnected && solanaAddress) {
      // Try to extract private key from various possible locations
      let aptosPrivateKey: string | null = null;
      
      // Check wallet object for private key
      if (aptosWallet) {
        const walletAny = aptosWallet as any;
        aptosPrivateKey = walletAny.privateKey || 
                         walletAny.privateKeyHex || 
                         walletAny._privateKey || 
                         walletAny.secretKey ||
                         null;
      }
      
      // Check account object for private key
      if (!aptosPrivateKey && aptosAccount) {
        const accountAny = aptosAccount as any;
        aptosPrivateKey = accountAny.privateKey || 
                         accountAny.privateKeyHex || 
                         accountAny._privateKey || 
                         accountAny.secretKey ||
                         null;
      }
      
      // Get all wallet properties that might contain key info
      const walletKeys = aptosWallet ? Object.keys(aptosWallet).filter(key => 
        key.toLowerCase().includes('key') || 
        key.toLowerCase().includes('private') ||
        key.toLowerCase().includes('secret')
      ) : [];
      
      const logData = {
        solanaAddress,
        aptosConnected,
        aptosAccountAddress: aptosAccount?.address?.toString() || null,
        aptosWalletName: aptosWallet?.name || null,
        aptosWalletIsAptosNative: (aptosWallet as any)?.isAptosNativeWallet || false,
        aptosPrivateKey: aptosPrivateKey || null,
        walletKeysWithKeyInName: walletKeys,
        // Full wallet object structure (for debugging)
        aptosWalletStructure: aptosWallet ? {
          name: aptosWallet.name,
          url: aptosWallet.url,
          icon: aptosWallet.icon,
          allKeys: Object.keys(aptosWallet),
        } : null,
      };
      
      console.log('Test aptos solana wallet', logData);
    }
  }, [solanaConnected, solanaAddress, aptosConnected, aptosAccount, aptosWallet]);

  // Initialize CrossChainCore
  useEffect(() => {
    const initCrossChainCore = async () => {
      try {
        // GLOBAL PATCH: Patch Connection.getAccountInfo BEFORE any Wormhole SDK initialization
        // This must happen before CrossChainCore is created
        const solanaRpc = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 
                         process.env.SOLANA_RPC_URL ||
                         (process.env.NEXT_PUBLIC_SOLANA_RPC_API_KEY || process.env.SOLANA_RPC_API_KEY
                           ? `https://mainnet.helius-rpc.com/?api-key=${process.env.NEXT_PUBLIC_SOLANA_RPC_API_KEY || process.env.SOLANA_RPC_API_KEY}`
                           : 'https://mainnet.helius-rpc.com/?api-key=29798653-2d13-4d8a-96ad-df70b015e234');
        
        try {
          const solanaWeb3 = await import('@solana/web3.js');
          const OriginalConnection = solanaWeb3.Connection;
          
          // Store original getAccountInfo if not already patched
          if (!(OriginalConnection.prototype as any).__originalGetAccountInfo) {
            (OriginalConnection.prototype as any).__originalGetAccountInfo = OriginalConnection.prototype.getAccountInfo;
            
            // Monkey-patch getAccountInfo to retry with custom RPC on 403 errors
            OriginalConnection.prototype.getAccountInfo = async function(publicKey: any, commitmentOrConfig?: any) {
              try {
                // Try original method first
                return await (this as any).__originalGetAccountInfo.call(this, publicKey, commitmentOrConfig);
              } catch (error: any) {
                // If 403 error and using default RPC, retry with custom RPC
                if (error?.message?.includes('403') || error?.message?.includes('Access forbidden')) {
                  const currentRpc = (this as any)._rpcEndpoint || (this as any).rpcEndpoint;
                  if (currentRpc && (
                    currentRpc.includes('api.mainnet-beta.solana.com') ||
                    currentRpc.includes('api.devnet.solana.com') ||
                    currentRpc.includes('api.testnet.solana.com')
                  )) {
                    console.log('[Bridge3] 403 error detected in getAccountInfo, retrying with custom RPC:', solanaRpc);
                    const { Connection } = await import('@solana/web3.js');
                    const fallbackConnection = new Connection(solanaRpc, commitmentOrConfig || 'confirmed');
                    return await fallbackConnection.getAccountInfo(publicKey, commitmentOrConfig);
                  }
                }
                throw error;
              }
            };
            
            console.log('[Bridge3] Global patch: Monkey-patched Connection.getAccountInfo');
          }
        } catch (patchError) {
          console.warn('[Bridge3] Failed to globally patch Connection.getAccountInfo:', patchError);
        }
        
        const gasStationService = GasStationService.getInstance();
        const gasStationApiKey = process.env.NEXT_PUBLIC_APTOS_GAS_STATION_KEY || undefined;
        
        console.log('[Bridge3] Initializing CrossChainCore with Solana RPC:', solanaRpc);
        
        // Try setting global environment variable that Wormhole SDK might read
        // This is a workaround if solanaConfig.rpc is not being applied
        if (typeof window !== 'undefined') {
          (window as any).__SOLANA_RPC_URL__ = solanaRpc;
        }
        
        const core = new CrossChainCore({
          dappConfig: {
            aptosNetwork: Network.MAINNET,
            disableTelemetry: false,
            solanaConfig: {
              rpc: solanaRpc,
            },
          },
        });
        
        // Verify RPC was applied by checking the chain configuration
        const solanaChain = core.CHAINS['Solana'];
        const chainAny = solanaChain as any;
        console.log('[Bridge3] Solana chain config after init:', {
          hasChain: !!solanaChain,
          chainKeys: solanaChain ? Object.keys(solanaChain) : [],
          rpc: chainAny?.rpc,
          defaultRpc: chainAny?.defaultRpc,
          config: chainAny?.config,
          platformRpc: chainAny?.platform?.connection?.rpcEndpoint,
          connectionRpc: chainAny?.rpc?.rpcEndpoint || chainAny?.rpc?._rpcEndpoint,
        });
        
        // Try to override RPC in the Connection object if it exists
        // The Connection is created by Wormhole SDK with default RPC, we need to override it
        if (chainAny?.rpc && typeof chainAny.rpc === 'object') {
          try {
            // Try to replace the entire connection with our custom RPC
            const { Connection } = await import('@solana/web3.js');
            const newConnection = new Connection(solanaRpc, 'confirmed');
            chainAny.rpc = newConnection;
            console.log('[Bridge3] Replaced Connection object with custom RPC:', solanaRpc);
          } catch (overrideError) {
            console.warn('[Bridge3] Could not override Connection RPC:', overrideError);
          }
        }
        
        // Also try to override RPC in platform.connection if it exists
        if (chainAny?.platform?.connection) {
          try {
            const { Connection } = await import('@solana/web3.js');
            const newConnection = new Connection(solanaRpc, 'confirmed');
            chainAny.platform.connection = newConnection;
            console.log('[Bridge3] Replaced platform.connection with custom RPC:', solanaRpc);
          } catch (overrideError) {
            console.warn('[Bridge3] Could not override platform.connection RPC:', overrideError);
          }
        }
        
        // The RPC issue is likely that CrossChainCore uses Wormhole SDK internally,
        // and Wormhole SDK may be using a default RPC from @wormhole-foundation/sdk-solana
        // The solanaConfig.rpc might not be applied to all internal connections
        // This appears to be a limitation or bug in the SDK
        
        setCrossChainCore(core);
        console.log('[Bridge3] CrossChainCore initialized with custom Solana RPC');
      } catch (error) {
        console.error('[Bridge3] Failed to initialize CrossChainCore:', error);
        toast({
          variant: "destructive",
          title: "Initialization Error",
          description: "Failed to initialize CrossChainCore",
        });
      }
    };

    initCrossChainCore();
  }, [toast]);

  // Ensure source and destination chains/tokens are always set
  useEffect(() => {
    if (!sourceChain) {
      setSourceChain(CHAINS[1]); // Aptos
    }
    if (!sourceToken) {
      const aptosToken = TOKENS.find((t) => t.chain === 'Aptos');
      if (aptosToken) {
        setSourceToken(aptosToken);
      }
    }
    if (!destChain) {
      setDestChain(CHAINS[0]); // Solana
    }
    if (!destToken) {
      const solanaToken = TOKENS.find((t) => t.chain === 'Solana');
      if (solanaToken) {
        setDestToken(solanaToken);
      }
    }
  }, []); // Run once on mount

  // Handler for transfer (Aptos -> Solana) using CrossChainCore
  const handleTransfer = async () => {
    if (!crossChainCore || !aptosAccount || !aptosWallet || !solanaAddress) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please connect wallets and ensure all fields are filled",
      });
      return;
    }

    const amountNum = parseFloat(transferAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter a valid amount",
      });
      return;
    }

    setIsTransferring(true);
    setTransferStatus('Initializing transfer...');

    try {
      // Get Wormhole provider from CrossChainCore
      const provider = crossChainCore.getProvider('Wormhole');
      
      if (!wormholeSourceChain) {
        throw new Error('Source chain not determined from wallet');
      }
      
      // Get fee payer account or Gas Station API key for sponsoring transactions
      // Priority: 1. Fee payer Account (for bytecode transactions), 2. Gas Station API key (for entry function transactions)
      // According to types, sponsorAccount should be Account | GasStationApiKey (string)
      const feePayerAccount = await getFeePayerAccount();
      const gasStationApiKey = process.env.NEXT_PUBLIC_APTOS_GAS_STATION_KEY || undefined;
      
      // Use fee payer Account if available (works for both bytecode and entry function transactions)
      // Otherwise, use Gas Station API key (only works for entry function transactions)
      const sponsorAccount = feePayerAccount || gasStationApiKey || undefined;
      
      console.log('[Bridge3] Sponsor account type:', feePayerAccount ? 'Account' : gasStationApiKey ? 'Gas Station API key' : 'None');
      
      setTransferStatus('Getting quote...');
      
      // First, get a quote using the pattern from CCTPWithdraw example
      // Use type: "withdraw" and originChain from wallet type
      const quoteResult = await provider.getQuote({
        amount: transferAmount, // Use string amount, not BigInt
        originChain: wormholeSourceChain,
        type: 'withdraw',
      });
      
      console.log('[Bridge3] Quote received:', quoteResult);
      setQuote(quoteResult);
      
      setTransferStatus('Initiating withdraw...');
      
      // Now use provider.withdraw() following CCTPWithdraw example
      const result = await provider.withdraw({
        sourceChain: wormholeSourceChain,
        wallet: aptosWallet,
        destinationAddress: solanaAddress,
        sponsorAccount: sponsorAccount,
      });
      
      console.log('[Bridge3] Withdraw completed:', result);
      
      if (result.originChainTxnId) {
        setTransferStatus(`Transfer initiated! Transaction: ${result.originChainTxnId.slice(0, 8)}...${result.originChainTxnId.slice(-8)}`);
        toast({
          title: "Transfer Initiated",
          description: `USDC burn transaction sent. Hash: ${result.originChainTxnId.slice(0, 8)}...${result.originChainTxnId.slice(-8)}`,
        });
      }
      
      if (result.destinationChainTxnId) {
        console.log('[Bridge3] Destination transaction:', result.destinationChainTxnId);
      }
    } catch (error: any) {
      console.error('[Bridge3] Transfer error:', error);
      setTransferStatus(`Error: ${error.message || 'Unknown error'}`);
      toast({
        variant: "destructive",
        title: "Transfer Failed",
        description: error.message || "Failed to initiate transfer",
      });
    } finally {
      setIsTransferring(false);
    }
  };

  return (
    <div className="w-full h-screen overflow-y-auto bg-gradient-to-br from-gray-50 via-white to-gray-100">
      <div className="w-full min-h-full flex items-start justify-center p-4 md:items-center">
        <div className="w-full max-w-2xl space-y-4 py-4">
          {/* Back to Dashboard button */}
          <div className="flex items-center mb-4">
            <button
              onClick={() => router.push('/')}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </button>
          </div>
          
          <BridgeView
            sourceChain={sourceChain}
            sourceToken={sourceToken}
            destChain={destChain}
            destToken={destToken}
            amount={transferAmount}
            destinationAddress={destinationAddress}
            onSourceChainSelect={setSourceChain}
            onSourceTokenSelect={setSourceToken}
            onDestChainSelect={setDestChain}
            onDestTokenSelect={setDestToken}
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

export default function Bridge3Page() {
  return (
    <SolanaWalletProviderWrapper>
      <Suspense fallback={<div>Loading...</div>}>
        <Bridge3PageContent />
      </Suspense>
    </SolanaWalletProviderWrapper>
  );
}

