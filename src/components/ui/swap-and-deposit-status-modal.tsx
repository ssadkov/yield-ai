import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { HyperionSwapService } from '@/lib/services/protocols/hyperion/swap';
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import tokenList from '@/lib/data/tokenList.json';
import { useDeposit } from '@/lib/hooks/useDeposit';
import { ProtocolKey } from '@/lib/transactions/types';
import Image from 'next/image';

interface SwapAndDepositStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
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
}

type Status = 'idle' | 'loading' | 'success' | 'error';

export function SwapAndDepositStatusModal({ isOpen, onClose, amount, fromToken, toToken, protocol, userAddress }: SwapAndDepositStatusModalProps) {
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
        const swapService = HyperionSwapService.getInstance();

        // Преобразуем amount в минимальные единицы
        const decimalsA = fromToken.decimals || 8;
        const amountInMinimalUnits = Math.floor(parseFloat(amount) * Math.pow(10, decimalsA));
        console.log('Amount in minimal units:', amountInMinimalUnits);

        // Предварительная оценка через estFromAmount и estToAmount
        const estFromAmount = await swapService.estFromAmount({
          amount: amountInMinimalUnits,
          from: fromToken.address,
          to: toToken.address,
          safeMode: true, // Включаем safeMode для более точной оценки
        });
        console.log('Estimated from amount:', estFromAmount);

        const estToAmount = await swapService.estToAmount({
          amount: amountInMinimalUnits,
          from: fromToken.address,
          to: toToken.address,
          safeMode: true, // Включаем safeMode для более точной оценки
        });
        console.log('Estimated to amount:', estToAmount);

        // Проверяем, что оценки не нулевые
        if (!estFromAmount?.amountOut || !estToAmount?.amountOut) {
          throw new Error('No liquidity available for this swap');
        }

        // Проверяем минимальное выходное количество
        const minAmountOut = Math.floor(parseFloat(estToAmount.amountOut) * 0.99); // 1% slippage
        if (minAmountOut <= 0) {
          throw new Error('Output amount too small for swap');
        }

        // 1. Получить quote и path
        const quote = await swapService.getQuoteAndPath({
          amount: amountInMinimalUnits,
          from: fromToken.address,
          to: toToken.address,
        });

        // Преобразуем amount и amountOut в минимальные единицы (BigInt)
        const decimalsB = toToken.decimals || 8;
        const amountOutRaw = parseFloat(quote.amountOut);
        if (isNaN(amountOutRaw) || amountOutRaw <= 0) throw new Error('No liquidity or amount too small for swap (amountOut=0)');
        
        // Используем значение из estToAmount без дополнительной конвертации
        const amountOut = estToAmount.amountOut;
        if (!amountOut || amountOut === '0') throw new Error('Amount out is zero');

        // Используем path из estToAmount, так как он короче и эффективнее
        const path = estToAmount.path;
        if (!path || path.length === 0) {
          throw new Error('No valid swap path found');
        }

        // Нормализуем адреса в path
        const normalizedPath = path.map((addr: string) => {
          if (addr === '0xa') {
            return '0x000000000000000000000000000000000000000000000000000000000000000a';
          }
          return addr;
        });

        console.log('Hyperion swap params:', {
          amountUser: amount,
          amountIn: amountInMinimalUnits.toString(),
          amountOut,
          decimalsA,
          decimalsB,
          from: fromToken.address,
          to: toToken.address,
          recipient: userAddress,
          poolRoute: normalizedPath,
          estimatedFromAmount: estFromAmount,
          estimatedToAmount: estToAmount,
          minAmountOut,
        });

        // 2. Получить payload
        const payload = await swapService.getSwapPayload({
          currencyA: fromToken.address,
          currencyB: toToken.address,
          currencyAAmount: amountInMinimalUnits.toString(),
          currencyBAmount: amountOut,
          slippage: 0.01, // 1% slippage
          poolRoute: normalizedPath,
          recipient: userAddress,
        });

        // Добавляем type_arguments к payload
        const modifiedPayload = {
          ...payload,
          type_arguments: ['0x1::aptos_coin::AptosCoin']
        };

        // 3. Отправить payload через wallet-адаптер
        // В некоторых версиях wallet-adapter нужно передавать просто payload, а не { data: payload }
        if (!wallet.signAndSubmitTransaction) throw new Error('Wallet not connected');
        let txResult;
        try {
          txResult = await wallet.signAndSubmitTransaction({
            data: modifiedPayload,
            options: { maxGasAmount: 100000 },
          });
        } catch (e: any) {
          // Попробовать без обертки, если ошибка формата
          if (e?.message?.includes('Invalid transaction format') || e?.message?.includes('data')) {
            txResult = await wallet.signAndSubmitTransaction(modifiedPayload);
          } else {
            throw e;
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
    if (status === 'success' && result?.hash) {
      fetch(`https://fullnode.mainnet.aptoslabs.com/v1/transactions/by_hash/${result.hash}`)
        .then(res => res.json())
        .then(async data => {
          const events = data.events || [];
          // 1. Ищем SwapEventV3
          const swapEvent = events.find((e: any) => e.type && e.type.includes('SwapEventV3'));
          let amount = null;
          let tokenAddress = null;
          if (swapEvent && swapEvent.data) {
            amount = swapEvent.data.amount_out;
            tokenAddress = swapEvent.data.to_token?.inner;
          }
          // 2. Если нет SwapEventV3, ищем Deposit с amount > 0
          if (!amount) {
            const depositEvent = events.find((e: any) => e.type && e.type.includes('Deposit') && e.data && e.data.amount && Number(e.data.amount) > 0);
            if (depositEvent) {
              amount = depositEvent.data.amount;
              tokenAddress = depositEvent.data.store;
            }
          }
          if (amount && tokenAddress) {
            // 3. Ищем метаданные токена
            let symbol = null;
            let decimals = 8;
            const tokensArr = Array.isArray((tokenList as any).data?.data) ? (tokenList as any).data.data : (tokenList as any);
            const tokenMeta = tokensArr.find((t: any) => t.faAddress === tokenAddress || t.address === tokenAddress);
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
              // protocol и token берём из пропсов, amount — из свапа
              const depositRes = await deposit(
                protocol.key as ProtocolKey,
                tokenAddress,
                BigInt(amount)
              );
              setDepositResult(depositRes);
              setDepositStatus('success');
            } catch (e: any) {
              setDepositError(typeof e === 'string' ? e : e.message);
              setDepositStatus('error');
            }
          }
        });
    }
  }, [status, result]);

  const handleRetry = () => {
    setRetryCount((c) => c + 1);
    setHasRun(false);
  };

  // Получение логотипа токена по адресу
  const getTokenLogo = (address: string): string => {
    const tokensArr = Array.isArray((tokenList as any).data?.data) ? (tokenList as any).data.data : (tokenList as any);
    const tokenMeta = tokensArr.find((t: any) => t.faAddress === address || t.address === address);
    return tokenMeta?.logoUrl || '/file.svg';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[400px] p-6 rounded-2xl flex flex-col items-center">
        <DialogHeader>
          <DialogTitle>Swap and Deposit</DialogTitle>
          <DialogDescription>
            Processing your swap and deposit transaction. Please wait...<br/>
            You will need to sign 2 transactions: 1 for swap, 2 for deposit of received tokens.
          </DialogDescription>
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
                <Image src={protocol.logo || ''} alt={protocol.name} width={24} height={24} className="rounded-full bg-white border" />
                <span className="font-semibold">Depositing to {protocol.name}...</span>
              </div>
              <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
            </div>
          )}
          {depositStatus === 'success' && depositResult?.hash && (
            <div className="text-green-600 text-center mt-2">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Image src={protocol.logo || ''} alt={protocol.name} width={24} height={24} className="rounded-full bg-white border" />
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
              {/* APY и финальный месседж */}
              {protocol.apy !== undefined && protocol.apy !== null && (
                <div className="mt-1 text-base text-green-700 font-medium">
                  Now you are earning {protocol.apy.toFixed(2)}% APY!
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