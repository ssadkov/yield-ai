import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { HyperionSwapService } from '@/lib/services/protocols/hyperion/swap';
import tokenList from '@/lib/data/tokenList.json';
import { useDeposit } from '@/lib/hooks/useDeposit';
import { ProtocolKey } from '@/lib/transactions/types';
import { showTransactionSuccessToast } from "@/components/ui/transaction-toast";
import Image from 'next/image';

interface SwapAndDepositStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  provider?: 'panora' | 'hyperion';
  amount: string;
  fromToken: {
    symbol: string;
    address: string;
    decimals?: number;
    logo?: string;
  };
  toToken: {
    symbol: string;
    address: string;
    decimals?: number;
    logo?: string;
  };
  protocol: {
    name: string;
    key: string;
    apy?: number;
    logo?: string;
  };
  userAddress: string;
  poolAddress?: string; // Add this for Auro Finance
}

type Status = 'idle' | 'loading' | 'success' | 'error';

export function SwapAndDepositStatusModal({ isOpen, onClose, provider = 'panora', amount, fromToken, toToken, protocol, userAddress, poolAddress }: SwapAndDepositStatusModalProps) {
  const [status, setStatus] = useState<Status>('idle');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [hasRun, setHasRun] = useState(false);
  const [receivedAmount, setReceivedAmount] = useState<string | null>(null);
  const [receivedSymbol, setReceivedSymbol] = useState<string | null>(null);
  const [receivedDecimals, setReceivedDecimals] = useState<number | null>(null);
  const [receivedHuman, setReceivedHuman] = useState<string | null>(null);
  const wallet = useWallet();
  const { deposit } = useDeposit();
  const [depositStatus, setDepositStatus] = useState<'idle' | 'loading' | 'success' | 'error' | null>(null);
  const [depositResult, setDepositResult] = useState<any>(null);
  const [depositError, setDepositError] = useState<string | null>(null);
  const [isCheckingTransaction, setIsCheckingTransaction] = useState(false);
  const [hasProcessedTransaction, setHasProcessedTransaction] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setHasRun(false);
      setStatus('idle');
      setResult(null);
      setError(null);
      setReceivedAmount(null);
      setReceivedSymbol(null);
      setReceivedDecimals(null);
      setReceivedHuman(null);
      setDepositStatus(null);
      setDepositResult(null);
      setDepositError(null);
      setIsCheckingTransaction(false);
      setHasProcessedTransaction(false);
      return;
    }
    if (hasRun) return;
    setStatus('loading');
    setResult(null);
    setError(null);
    setHasRun(true);

    (async () => {
      try {
        // Проверка формата адресов
        const isFA = (addr: string) => /^0x[a-fA-F0-9]{1,64}$/.test(addr);
        const isAptosAddr = (addr: string) => /^0x[a-fA-F0-9]{64}$/.test(addr);
        if (!isFA(fromToken.address)) throw new Error(`Invalid fromToken address: ${fromToken.address}`);
        if (!isFA(toToken.address)) throw new Error(`Invalid toToken address: ${toToken.address}`);
        if (!isAptosAddr(userAddress)) throw new Error(`Invalid user address: ${userAddress}`);
        if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) throw new Error('Invalid amount');
        let modifiedPayload: any;

        if (provider === 'panora') {
          // Старый проверенный путь Panora: сначала quote, затем execute-swap
          const slippagePercentage = '1'; // 1%
          const quoteResp = await fetch('/api/panora/swap-quote', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chainId: '1',
              fromTokenAddress: fromToken.address,
              toTokenAddress: toToken.address,
              fromTokenAmount: amount, // human-readable для Panora
              toWalletAddress: userAddress,
              slippagePercentage,
              getTransactionData: 'transactionPayload',
            }),
          });
          if (!quoteResp.ok) {
            const err = await quoteResp.json().catch(() => ({}));
            throw new Error(err.error || 'Failed to get Panora quote');
          }
          const quoteData = await quoteResp.json();

          const execResp = await fetch('/api/panora/execute-swap', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ quoteData, walletAddress: userAddress }),
          });
          if (!execResp.ok) {
            const err = await execResp.json().catch(() => ({}));
            throw new Error(err.error || 'Failed to build Panora transaction');
          }
          modifiedPayload = await execResp.json();
        } else {
          // Возврат к прежнему локальному пути Hyperion
          const swapService = HyperionSwapService.getInstance();

          const decimalsA = fromToken.decimals || 8;
          const amountInMinimalUnits = Math.floor(parseFloat(amount) * Math.pow(10, decimalsA));

          const estToAmount = await swapService.estToAmount({
            amount: amountInMinimalUnits,
            from: fromToken.address,
            to: toToken.address,
            safeMode: true,
          });
          if (!estToAmount?.amountOut) throw new Error('No liquidity available for this swap');

          const path = Array.isArray(estToAmount.path) ? estToAmount.path : [];
          if (path.length === 0) throw new Error('No valid swap path found');

          const normalizedPath = path.map((addr: string) =>
            addr === '0xa' ? '0x000000000000000000000000000000000000000000000000000000000000000a' : addr
          );

          const payload = await swapService.getSwapPayload({
            currencyA: fromToken.address,
            currencyB: toToken.address,
            currencyAAmount: amountInMinimalUnits.toString(),
            currencyBAmount: estToAmount.amountOut,
            slippage: 0.01,
            poolRoute: normalizedPath,
            recipient: userAddress,
          });

          modifiedPayload = { ...payload, type_arguments: ['0x1::aptos_coin::AptosCoin'] };
        }

        // 2) Отправить payload через wallet-адаптер (с нормализацией имён полей)
        if (!wallet.signAndSubmitTransaction) throw new Error('Wallet not connected');
        const normalizedCamel = {
          function: modifiedPayload.function,
          typeArguments: modifiedPayload.typeArguments || modifiedPayload.type_arguments || [],
          functionArguments: modifiedPayload.functionArguments || modifiedPayload.arguments || [],
        };
        const normalizedSnake = {
          function: modifiedPayload.function,
          type_arguments: modifiedPayload.type_arguments || modifiedPayload.typeArguments || [],
          arguments: modifiedPayload.arguments || modifiedPayload.functionArguments || [],
        } as any;

        let txResult;
        try {
          // Предпочтительно: новый формат с data + camelCase
          txResult = await wallet.signAndSubmitTransaction({
            data: normalizedCamel,
            options: { maxGasAmount: 20000 },
          });
        } catch (e1: any) {
          try {
            // Падение по формату — пробуем snake-case напрямую
            txResult = await wallet.signAndSubmitTransaction(normalizedSnake);
          } catch (e2: any) {
            // В некоторых кошельках нужен data + snake-case
            try {
              txResult = await wallet.signAndSubmitTransaction({
                data: normalizedSnake,
                options: { maxGasAmount: 20000 },
              });
            } catch (e3: any) {
              // Последняя попытка — прямой camelCase
              txResult = await wallet.signAndSubmitTransaction(normalizedCamel as any);
            }
          }
        }
        setResult(txResult);
        setStatus('success');
      } catch (e: any) {
        setError(typeof e === 'string' ? e : e.message);
        setStatus('error');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, amount, fromToken.address, toToken.address, userAddress, wallet, retryCount, hasRun]);

  useEffect(() => {
    if (!isOpen) setHasRun(false);
  }, [isOpen]);

  useEffect(() => {
    
    if (status === 'success' && result?.hash && !hasProcessedTransaction) {
      // Add retry logic for transaction status check
      const checkTransactionStatus = async () => {
        const maxAttempts = 10;
        const delay = 2000;
        
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          try {
            console.log(`Checking transaction status attempt ${attempt}/${maxAttempts} for hash: ${result.hash}`);
            
            const response = await fetch(`https://fullnode.mainnet.aptoslabs.com/v1/transactions/by_hash/${result.hash}`);
            
            if (!response.ok) {
              if (response.status === 404) {
                console.log(`Transaction not found yet (attempt ${attempt}), waiting ${delay}ms...`);
                if (attempt < maxAttempts) {
                  await new Promise(resolve => setTimeout(resolve, delay));
                  continue;
                } else {
                  throw new Error('Transaction not found after maximum attempts');
                }
              } else {
                throw new Error(`API error: ${response.status} ${response.statusText}`);
              }
            }
            
            const data = await response.json();
            console.log('Transaction data received:', data);
            
            // Check if transaction was successful
            if (data.vm_status && data.vm_status !== "Executed successfully") {
              throw new Error(`Transaction failed: ${data.vm_status}`);
            }
            
            const events = data.events || [];
            console.log('All events found:', events.map((e: any) => ({ type: e.type, data: e.data })));

            // 1) Для Panora сначала ищем PanoraSwapSummaryEvent
            let amount = null as string | null;
            let tokenAddress: string | null = null;
            if (provider === 'panora') {
              const summaryEvent = events.find((e: any) => e.type && e.type.includes('PanoraSwapSummaryEvent'));
              if (summaryEvent && summaryEvent.data) {
                const ev = summaryEvent.data;
                const evUser = (ev.user_address || '').toLowerCase?.();
                const wantUser = (userAddress || '').toLowerCase?.();

                // Проверяем только адрес пользователя, чтобы не спутать с другими внутренними событиями
                const matchesUser = evUser && wantUser && evUser === wantUser;
                
                console.log('Panora event validation:', {
                  evUser, wantUser, matchesUser,
                  evInput: ev.input_token_address,
                  evOutput: ev.output_token_address
                });
                
                if (matchesUser) {
                  amount = ev.output_token_amount;
                  tokenAddress = ev.output_token_address;
                  console.log('Found matching Panora event:', { amount, tokenAddress });
                }
              }
            }

            // 2) Если Panora summary не нашли — пробуем общий SwapEventV3
            if (!amount) {
              const swapEvent = events.find((e: any) => e.type && e.type.includes('SwapEventV3'));
              if (swapEvent && swapEvent.data) {
                amount = swapEvent.data.amount_out;
                tokenAddress = swapEvent.data.to_token?.inner;
                console.log('Found SwapEventV3:', { amount, tokenAddress });
              }
            }

            // 3) Если нет SwapEventV3 — ищем Deposit с amount > 0
            if (!amount) {
              const depositEvent = events.find((e: any) => e.type && e.type.includes('Deposit') && e.data && e.data.amount && Number(e.data.amount) > 0);
              if (depositEvent) {
                amount = depositEvent.data.amount;
                tokenAddress = depositEvent.data.store;
                console.log('Found Deposit event:', { amount, tokenAddress });
              }
            }
            // If we didn't find a token address from events, use the toToken address from props
            if (!tokenAddress && toToken.address) {
              tokenAddress = toToken.address;
              console.log('Using toToken address from props:', tokenAddress);
            }
            
            if (amount && tokenAddress && !hasProcessedTransaction) {
              console.log('Starting deposit process:', { amount, tokenAddress, protocol: protocol.key });
              // 3. Ищем метаданные токена
              let symbol = null;
              let decimals = 8;
              const tokensArr = Array.isArray((tokenList as any).data?.data) ? (tokenList as any).data.data : (tokenList as any);
              
              // Normalize addresses for comparison
              const normalizeAddress = (addr: string | null | undefined): string => {
                if (!addr) return '';
                if (!addr.startsWith('0x')) return addr.toLowerCase();
                const normalized = '0x' + addr.slice(2).replace(/^0+/, '');
                return (normalized === '0x' ? '0x0' : normalized).toLowerCase();
              };
              
              const normalizedTokenAddress = normalizeAddress(tokenAddress);
              const tokenMeta = tokensArr.find((t: any) => {
                const normalizedFaAddress = normalizeAddress(t.faAddress);
                const normalizedTokenListAddress = normalizeAddress(t.tokenAddress);
                
                return (normalizedFaAddress && normalizedFaAddress === normalizedTokenAddress) || 
                       (normalizedTokenListAddress && normalizedTokenListAddress === normalizedTokenAddress);
              });
              if (tokenMeta) {
                symbol = tokenMeta.symbol;
                decimals = tokenMeta.decimals;
              } else {
                const metaChange = (data.changes || []).find((c: any) => c.address === tokenAddress && c.data && c.data.type && c.data.type.includes('Metadata'));
                if (metaChange && metaChange.data && metaChange.data.data) {
                  symbol = metaChange.data.data.symbol;
                  decimals = metaChange.data.data.decimals;
                }
              }
              setReceivedAmount(amount);
              setReceivedSymbol(symbol);
              setReceivedDecimals(decimals);
              const human = (Number(amount) / Math.pow(10, decimals)).toFixed(decimals);
              setReceivedHuman(human);

              // 5. Автоматически запускаем депозит
              setDepositStatus('loading');
              setDepositResult(null);
              setDepositError(null);
              try {
                // Normalize token address before passing to deposit
                const normalizedTokenAddress = normalizeAddress(tokenAddress);
                console.log('Depositing with normalized token address:', normalizedTokenAddress);
                
                // Special handling for Auro Finance new position creation
                if (protocol.key === 'auro' && poolAddress) {
                  console.log('Creating new Auro Finance position via swap and deposit with poolAddress:', poolAddress);
                  
                  const { safeImport } = await import('@/lib/utils/safeImport');
                  const { AuroProtocol } = await safeImport(() => import('@/lib/protocols/auro'));
                  const auroProtocol = new AuroProtocol();
                  
                  // Build transaction payload
                  const payload = await auroProtocol.buildCreatePosition(
                    poolAddress,
                    BigInt(amount),
                    normalizedTokenAddress
                  );
                  
                  console.log('Generated Auro create position payload:', payload);
                  
                  // Submit transaction
                  if (!wallet.signAndSubmitTransaction) {
                    throw new Error('Wallet not connected');
                  }
                  
                  const depositRes = await wallet.signAndSubmitTransaction({
                    data: {
                      function: payload.function as `${string}::${string}::${string}`,
                      typeArguments: payload.type_arguments,
                      functionArguments: payload.arguments
                    },
                    options: {
                      maxGasAmount: 20000,
                    },
                  });
                  
                  console.log('Auro create position transaction result:', depositRes);
                  
                  // Check transaction status
                  if (depositRes.hash) {
                    const maxAttempts = 10;
                    const delay = 2000;
                    
                    for (let i = 0; i < maxAttempts; i++) {
                      console.log(`Checking deposit transaction status attempt ${i + 1}/${maxAttempts}`);
                      try {
                        const txResponse = await fetch(
                          `https://fullnode.mainnet.aptoslabs.com/v1/transactions/by_hash/${depositRes.hash}`
                        );
                        const txData = await txResponse.json();
                        
                        console.log('Deposit transaction success:', txData.success);
                        console.log('Deposit transaction vm_status:', txData.vm_status);
                        
                        if (txData.success && txData.vm_status === "Executed successfully") {
                          console.log('Deposit transaction confirmed successfully, showing toast...');
                          showTransactionSuccessToast({ 
                            hash: depositRes.hash, 
                            title: "Auro Finance position created!" 
                          });
                          console.log('Toast should be shown now');
                          
                          // Refresh positions
                          setTimeout(() => {
                            window.dispatchEvent(new CustomEvent('refreshPositions', { 
                              detail: { protocol: 'auro' }
                            }));
                          }, 2000);
                          
                          setDepositResult(depositRes);
                          setDepositStatus('success');
                          setHasProcessedTransaction(true);
                          return;
                        } else if (txData.vm_status) {
                          console.error('Deposit transaction failed with status:', txData.vm_status);
                          throw new Error(`Deposit transaction failed: ${txData.vm_status}`);
                        }
                      } catch (error) {
                        console.error(`Deposit attempt ${i + 1} failed:`, error);
                      }
                      
                      console.log(`Waiting ${delay}ms before next deposit attempt...`);
                      await new Promise(resolve => setTimeout(resolve, delay));
                    }
                    
                    console.error('Deposit transaction status check timeout');
                    throw new Error('Deposit transaction status check timeout');
                  }
                } else if (protocol.key === 'auro' && !poolAddress) {
                  throw new Error('Auro Finance requires pool address for deposit');
                } else {
                  // Standard deposit logic for other protocols
                  const depositRes = await deposit(
                    protocol.key as ProtocolKey,
                    normalizedTokenAddress,
                    BigInt(amount)
                  );
                  setDepositResult(depositRes);
                  setDepositStatus('success');
                }
                
                // Mark transaction as processed to prevent re-execution
                setHasProcessedTransaction(true);
              } catch (e: any) {
                setDepositError(typeof e === 'string' ? e : e.message);
                setDepositStatus('error');
                // Mark transaction as processed even on error to prevent re-execution
                setHasProcessedTransaction(true);
              }
            }
            
            // Success - break out of retry loop
            break;
            
          } catch (error) {
            console.error(`Attempt ${attempt} failed:`, error);
            if (attempt === maxAttempts) {
              console.error('All attempts failed to check transaction status');
              // Show error to user
              setDepositError('Failed to verify transaction status. Please check the transaction manually.');
              setDepositStatus('error');
            }
          }
        }
      };
      
      // Start checking transaction status
      setIsCheckingTransaction(true);
      setHasProcessedTransaction(true); // Mark as processing to prevent re-execution
      checkTransactionStatus().finally(() => {
        setIsCheckingTransaction(false);
      });
    }
  }, [status, result, tokenList, hasProcessedTransaction]);

  const handleRetry = () => {
    setRetryCount((c) => c + 1);
    setHasRun(false);
  };

  // Получение логотипа токена по адресу
  const getTokenLogo = (address: string): string => {
    const tokensArr = Array.isArray((tokenList as any).data?.data) ? (tokenList as any).data.data : (tokenList as any);
    
    // Normalize addresses for comparison
    const normalizeAddress = (addr: string | null | undefined): string => {
      if (!addr) return '';
      if (!addr.startsWith('0x')) return addr.toLowerCase();
      const normalized = '0x' + addr.slice(2).replace(/^0+/, '');
      return (normalized === '0x' ? '0x0' : normalized).toLowerCase();
    };
    
    const normalizedAddress = normalizeAddress(address);
    const tokenMeta = tokensArr.find((t: any) => {
      const normalizedFaAddress = normalizeAddress(t.faAddress);
      const normalizedTokenListAddress = normalizeAddress(t.tokenAddress);
      
      return (normalizedFaAddress && normalizedFaAddress === normalizedAddress) || 
             (normalizedTokenListAddress && normalizedTokenListAddress === normalizedAddress);
    });
    
    return tokenMeta?.logoUrl && tokenMeta.logoUrl !== '' ? tokenMeta.logoUrl : '/file.svg';
  };

  // Получение логотипа протокола
  const getProtocolLogo = (logo?: string) => logo && logo !== '' ? logo : '/file.svg';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[400px] p-6 rounded-2xl flex flex-col items-center">
        <DialogHeader>
          <DialogTitle>Swap and Deposit</DialogTitle>
          <DialogDescription>
            Processing your swap and deposit transaction. Please wait...<br/>
            You will need to sign 2 transactions: 1 for swap, 2 for deposit of received tokens
          </DialogDescription>
          <div className="flex items-center justify-center gap-2 mt-2 text-base font-medium">
            <span>Deposit on</span>
            <Image src={getProtocolLogo(protocol.logo)} alt={protocol.name} width={20} height={20} className="rounded-full bg-white border" />
            <span>{protocol.name}</span>
          </div>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 mt-4 w-full">
          {/* Блок обмена */}
          <div className="w-full flex flex-col items-center gap-2 mb-2">
            <div className="flex items-center gap-2">
              <Image src={getTokenLogo(fromToken.address)} alt={fromToken.symbol} width={28} height={28} className="rounded-full bg-white border" />
              <span className="font-semibold text-base">{amount} {fromToken.symbol}</span>
              <span className="text-xl">→</span>
              {receivedAmount && receivedSymbol && (
                <>
                  <Image src={getTokenLogo(toToken.address)} alt={receivedSymbol || ''} width={28} height={28} className="rounded-full bg-white border" />
                  <span className="font-semibold text-base">{receivedHuman} {receivedSymbol}</span>
                </>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              Swap: {fromToken.symbol} → {receivedSymbol || toToken.symbol}
            </div>
          </div>

          {/* Статус свапа */}
          {status === 'loading' && <Loader2 className="h-10 w-10 animate-spin text-primary" />}
          {status === 'loading' && <div className="text-lg font-medium">Processing swap and deposit...</div>}
          {status === 'loading' && (
            <div className="text-sm text-muted-foreground mt-2">Waiting for wallet confirmation and network response...</div>
          )}
          {status === 'success' && (
            <div className="text-green-600 text-center w-full">
              <div className="flex items-center justify-center gap-2 mt-2">
                <span className="font-mono text-sm bg-muted px-2 py-1 rounded">
                  {result.hash.slice(0, 6)}...{result.hash.slice(-4)}
                </span>
                <a
                  href={`https://explorer.aptoslabs.com/txn/${result.hash}?network=mainnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="View in Explorer"
                  className="text-blue-600 hover:underline"
                >
                  <ExternalLink className="inline w-4 h-4 align-text-bottom" />
                </a>
              </div>
              {isCheckingTransaction && (
                <div className="mt-2 text-sm text-blue-600 flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Verifying transaction...</span>
                </div>
              )}
              {receivedAmount && receivedSymbol && receivedHuman && (
                <div className="mt-2 text-sm text-green-700 flex items-center justify-center gap-2">
                  <Image src={getTokenLogo(toToken.address)} alt={receivedSymbol || ''} width={20} height={20} className="rounded-full bg-white border" />
                  <span>Received: <b>{receivedHuman}</b> {receivedSymbol}</span>
                </div>
              )}
            </div>
          )}

          {/* Статус депозита */}
          {depositStatus === 'loading' && (
            <div className="text-blue-600 text-center mt-2">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Image src={getProtocolLogo(protocol.logo)} alt={protocol.name} width={24} height={24} className="rounded-full bg-white border" />
                <span className="font-semibold">Depositing to {protocol.name}...</span>
              </div>
              <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
            </div>
          )}
          {depositStatus === 'success' && depositResult?.hash && (
            <div className="text-green-600 text-center mt-2">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Image src={getProtocolLogo(protocol.logo)} alt={protocol.name} width={24} height={24} className="rounded-full bg-white border" />
                <span className="font-semibold">Deposited to {protocol.name}:</span>
                <Image src={getTokenLogo(toToken.address)} alt={receivedSymbol || ''} width={20} height={20} className="rounded-full bg-white border" />
                <span><b>{receivedHuman}</b> {receivedSymbol}</span>
              </div>
              <div className="flex items-center justify-center gap-2 mt-2">
                <span className="font-mono text-sm bg-muted px-2 py-1 rounded">
                  {depositResult.hash.slice(0, 6)}...{depositResult.hash.slice(-4)}
                </span>
                <a
                  href={`https://explorer.aptoslabs.com/txn/${depositResult.hash}?network=mainnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="View in Explorer"
                  className="text-blue-600 hover:underline"
                >
                  <ExternalLink className="inline w-4 h-4 align-text-bottom" />
                </a>
              </div>
              {/* APR и финальный месседж */}
              {protocol.apy !== undefined && protocol.apy !== null && (
                <div className="mt-1 text-base text-green-700 font-medium">
                  Now you are earning {protocol.apy.toFixed(2)}% APR!
                </div>
              )}
            </div>
          )}
          {depositStatus === 'error' && (
            <div className="text-red-600 text-center mt-2">
              Deposit failed:<br />
              <pre className="text-xs mt-2 bg-muted p-2 rounded max-w-xs overflow-x-auto">{depositError}</pre>
            </div>
          )}
        </div>
        <div className="flex justify-end w-full mt-6">
          <Button variant="outline" onClick={onClose}>
            {depositStatus === 'success' ? 'Close' : 'Cancel'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
} 