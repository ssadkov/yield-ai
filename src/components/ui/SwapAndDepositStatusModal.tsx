import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { HyperionSwapService } from '@/lib/services/protocols/hyperion/swap';
import { useWallet } from "@aptos-labs/wallet-adapter-react";

interface SwapAndDepositStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  amount: string;
  fromToken: {
    symbol: string;
    address: string;
    decimals?: number;
  };
  toToken: {
    symbol: string;
    address: string;
    decimals?: number;
  };
  protocol: {
    name: string;
    key: string;
  };
  userAddress: string;
}

type Status = 'idle' | 'loading' | 'success' | 'error';

export function SwapAndDepositStatusModal({ isOpen, onClose, amount, fromToken, toToken, protocol, userAddress }: SwapAndDepositStatusModalProps) {
  const [status, setStatus] = useState<Status>('idle');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const wallet = useWallet();

  useEffect(() => {
    if (!isOpen) return;
    setStatus('loading');
    setResult(null);
    setError(null);

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
  }, [isOpen, amount, fromToken.address, toToken.address, userAddress, wallet, retryCount]);

  const handleRetry = () => {
    setRetryCount((c) => c + 1);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[400px] p-6 rounded-2xl flex flex-col items-center">
        <DialogHeader>
          <DialogTitle>Swap and Deposit</DialogTitle>
          <DialogDescription>
            Processing your swap and deposit transaction. Please wait...
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 mt-4">
          {status === 'loading' && <Loader2 className="h-10 w-10 animate-spin text-primary" />}
          {status === 'loading' && <div className="text-lg font-medium">Processing swap and deposit...</div>}
          {status === 'success' && (
            <div className="text-green-600 text-center">
              Swap transaction sent!<br />
              <pre className="text-xs mt-2 bg-muted p-2 rounded max-w-xs overflow-x-auto">{JSON.stringify(result, null, 2)}</pre>
            </div>
          )}
          {status === 'error' && (
            <div className="text-red-600 text-center">
              Swap failed:<br />
              <pre className="text-xs mt-2 bg-muted p-2 rounded max-w-xs overflow-x-auto">{error}</pre>
              <Button variant="outline" className="mt-2" onClick={handleRetry}>Retry</Button>
            </div>
          )}
          <div className="text-xs text-muted-foreground mt-2">
            <div>Amount: {amount}</div>
            <div>From: {fromToken.symbol} ({fromToken.address})</div>
            <div>To: {toToken.symbol} ({toToken.address})</div>
            <div>Protocol: {protocol.name} ({protocol.key})</div>
            <div>User: {userAddress}</div>
          </div>
        </div>
        <div className="flex justify-end w-full mt-6">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
} 