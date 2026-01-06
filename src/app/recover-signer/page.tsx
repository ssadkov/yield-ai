"use client";

import { useEffect, useMemo, useState } from "react";
import { Connection, Keypair, SystemProgram, Transaction, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";

// Default Solana RPC (тот же, что и в основном приложении)
const SOLANA_RPC =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
  process.env.SOLANA_RPC_URL ||
  "https://mainnet.helius-rpc.com/?api-key=29798653-2d13-4d8a-96ad-df70b015e234";

export default function RecoverSignerPage() {
  const { toast } = useToast();

  const [secretKeyBase58, setSecretKeyBase58] = useState("");
  const [destinationAddress, setDestinationAddress] = useState("");
  const [rpcUrl, setRpcUrl] = useState(SOLANA_RPC);
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [walletAvailable, setWalletAvailable] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [providers, setProviders] = useState<Array<{ id: string; name: string; provider: any }>>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null); // явный выбор, иначе fee payer = signer

  // Поиск доступного провайдера: Phantom / Solflare / Trust / Coinbase / Backpack
  useEffect(() => {
    const w = window as any;
    const candidates = [
      { id: "phantom", name: "Phantom", provider: w?.solana },
      { id: "trust", name: "Trust", provider: w?.trustwallet?.solana || (w?.solana?.isTrust || w?.solana?.isTrustWallet ? w?.solana : undefined) },
      { id: "solflare", name: "Solflare", provider: w?.solflare || (w?.solana?.isSolflare ? w?.solana : undefined) },
      { id: "backpack", name: "Backpack", provider: w?.backpack },
      { id: "coinbase", name: "Coinbase", provider: w?.coinbaseWalletExt || (w?.solana?.isCoinbaseWallet ? w?.solana : undefined) },
    ]
      .filter((c) => !!c.provider)
      .filter((c, idx, arr) => arr.findIndex((x) => x.id === c.id) === idx)
      .filter((c) => typeof c.provider?.signTransaction === "function");

    setProviders(candidates as any);
    if (candidates.length > 0) {
      setWalletAvailable(true);
      // Не выбираем автоматически, чтобы не открывался Phantom сам по себе
    }
  }, []);

  const handleRecover = async () => {
    if (!secretKeyBase58.trim() || !destinationAddress.trim()) {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Введите secretKeyBase58 и адрес получателя",
      });
      return;
    }

    setIsProcessing(true);
    setStatus("Инициализация восстановления...");

    try {
      // 1. Декодируем приватный ключ
      let keypair: Keypair;
      try {
        const secretKey = bs58.decode(secretKeyBase58.trim());
        keypair = Keypair.fromSecretKey(secretKey);
      } catch (err: any) {
        throw new Error("Не удалось декодировать secretKeyBase58. Проверьте, что ключ корректен.");
      }

      const signerPubkey = keypair.publicKey;
      const destPubkey = new PublicKey(destinationAddress.trim());

      setStatus(`Подключение к RPC и проверка баланса signer'а ${signerPubkey.toBase58()}...`);

      // 2. Подключаемся к RPC и получаем баланс
      const connection = new Connection(rpcUrl.trim() || SOLANA_RPC, "confirmed");

      const balance = await connection.getBalance(signerPubkey);
      const rentExempt = await connection.getMinimumBalanceForRentExemption(0);

      if (balance === 0) {
        throw new Error("Баланс signer'а равен 0, нечего возвращать.");
      }

      setStatus(
        `Баланс signer'а: ${(balance / 1_000_000_000).toFixed(
          9
        )} SOL. Rent-exempt минимум: ${(rentExempt / 1_000_000_000).toFixed(9)} SOL.`
      );

      // 3. Считаем сумму к возврату: balance - rentExempt - небольшой запас на комиссию
      // Оставляем на аккаунте rentExempt + feeBuffer, всё остальное переводим
      const feeBuffer = 5_000; // ~0.000005 SOL
      const minLeft = rentExempt + feeBuffer;

      if (balance <= minLeft) {
        throw new Error(
          `Недостаточно средств для безопасного возврата. Баланс: ${
            balance / 1_000_000_000
          } SOL, требуется > ${(minLeft / 1_000_000_000).toFixed(
            9
          )} SOL (rent-exempt + комиссия).`
        );
      }

      const amountToRefund = balance - minLeft;

      setStatus(
        `Формирование транзакции возврата ~${(amountToRefund / 1_000_000_000).toFixed(
          9
        )} SOL на ${destPubkey.toBase58()}...`
      );

      // 4. Строим и отправляем транзакцию
      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: signerPubkey,
          toPubkey: destPubkey,
          lamports: amountToRefund,
        })
      );

      // --- Основное отличие: выбираем провайдер из списка и используем его как fee payer ---
      const provider = selectedProviderId
        ? providers.find((p) => p.id === selectedProviderId)?.provider
        : null;
      let feePayerPubkey: PublicKey | null = null;

      if (provider) {
        try {
          // Запрашиваем подключение, если ещё не подключён
          const res = await provider.connect();
          feePayerPubkey = provider.publicKey || (res?.publicKey ? new PublicKey(res.publicKey) : null);
          if (feePayerPubkey) {
            const feePayerAddress = feePayerPubkey.toBase58();
            setWalletAddress(feePayerAddress);
            setStatus((s) => `${s}\nИспользуем кошелёк ${feePayerAddress} как fee payer...`);
          }
        } catch (err: any) {
          console.warn("[RecoverSigner] Не удалось подключить кошелёк, пробуем старый режим fee payer = signer:", err?.message);
        }
      }

      // Если кошелёк недоступен, откатываемся к fee payer = signer (как было), но это может дать ошибку комиссии
      if (!feePayerPubkey) {
        feePayerPubkey = signerPubkey;
        setStatus((s) => `${s}\nВнимание: кошелёк не подключён, fee payer = signer (может не пройти).`);
      }

      tx.feePayer = feePayerPubkey;
      const { blockhash } = await connection.getLatestBlockhash("confirmed");
      tx.recentBlockhash = blockhash;

      // Всегда подписываем signer'ом (он источник средств)
      tx.partialSign(keypair);

      // Если есть внешний кошелёк, просим его подписать как fee payer
      if (provider && feePayerPubkey && !feePayerPubkey.equals(signerPubkey) && typeof provider.signTransaction === "function") {
        tx.serialize; // no-op to keep bundlers happy
        const signedByWallet = await provider.signTransaction(tx);
        const sig = await connection.sendRawTransaction(signedByWallet.serialize());

        setStatus(
          `Транзакция отправлена: ${sig.slice(0, 8)}...${sig.slice(
            -8
          )}. Ожидание подтверждения...`
        );

        try {
          await connection.confirmTransaction(sig, "confirmed");
          setStatus(
            `Возврат успешен! Переведено ~${(amountToRefund / 1_000_000_000).toFixed(
              9
            )} SOL. Solscan: https://solscan.io/tx/${sig}`
          );
          toast({
            title: "Возврат успешен",
            description: `Переведено ~${(amountToRefund / 1_000_000_000).toFixed(
              9
            )} SOL. Откройте Solscan для деталей.`,
          });
        } catch (confirmErr: any) {
          setStatus(
            `Транзакция отправлена, но подтверждение не получено (возможно, таймаут). Проверьте статус вручную: https://solscan.io/tx/${sig}`
          );
          toast({
            variant: "destructive",
            title: "Подтверждение не получено",
            description:
              "Транзакция могла пройти, но подтверждение не успело прийти. Проверьте статус вручную в Solscan.",
          });
        }

        setIsProcessing(false);
        return;
      }

      // Fallback: fee payer = signer (как было раньше)
      const sig = await connection.sendRawTransaction(tx.serialize());

      setStatus(
        `Транзакция отправлена: ${sig.slice(0, 8)}...${sig.slice(
          -8
        )}. Ожидание подтверждения...`
      );

      try {
        await connection.confirmTransaction(sig, "confirmed");
        setStatus(
          `Возврат успешен! Переведено ~${(amountToRefund / 1_000_000_000).toFixed(
            9
          )} SOL. Solscan: https://solscan.io/tx/${sig}`
        );
        toast({
          title: "Возврат успешен",
          description: `Переведено ~${(amountToRefund / 1_000_000_000).toFixed(
            9
          )} SOL. Откройте Solscan для деталей.`,
        });
      } catch (confirmErr: any) {
        setStatus(
          `Транзакция отправлена, но подтверждение не получено (возможно, таймаут). Проверьте статус вручную: https://solscan.io/tx/${sig}`
        );
        toast({
          variant: "destructive",
          title: "Подтверждение не получено",
          description:
            "Транзакция могла пройти, но подтверждение не успело прийти. Проверьте статус вручную в Solscan.",
        });
      }
    } catch (error: any) {
      console.error("[RecoverSigner] Error:", error);
      setStatus(`Ошибка: ${error.message || "Неизвестная ошибка"}`);
      toast({
        variant: "destructive",
        title: "Ошибка восстановления",
        description: error.message || "Не удалось выполнить возврат средств",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-gray-50 via-white to-gray-100">
      <Card className="w-full max-w-2xl border-2">
        <CardContent className="p-6 space-y-6">
          <div className="space-y-2 text-center">
            <h1 className="text-2xl font-bold">Recover Internal Signer</h1>
            <p className="text-sm text-muted-foreground">
              Восстановление SOL с внутреннего signer&apos;а (используя secretKeyBase58).
            </p>
            <p className="text-xs text-red-500">
              ВАЖНО: Вставляйте сюда только ключи от временных внутренних аккаунтов (signer&apos;ов),
              а не от основного кошелька.
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                secretKeyBase58 внутреннего signer&apos;а
              </label>
              <Input
                type="text"
                value={secretKeyBase58}
                onChange={(e) => setSecretKeyBase58(e.target.value)}
                placeholder="Вставьте secretKeyBase58 из JSON-лога"
                className="font-mono text-xs"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Адрес получателя (ваш основной Solana-кошелёк)
              </label>
              <Input
                type="text"
                value={destinationAddress}
                onChange={(e) => setDestinationAddress(e.target.value)}
                placeholder="Например, 9XL5jC..."
                className="font-mono text-xs"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                RPC endpoint (опционально)
              </label>
              <Input
                type="text"
                value={rpcUrl}
                onChange={(e) => setRpcUrl(e.target.value)}
                placeholder={SOLANA_RPC}
                className="font-mono text-xs"
              />
              <p className="text-[11px] text-muted-foreground">
                Можно оставить по умолчанию. При желании укажите свой RPC (Helius/QuickNode и т.п.)
                для более стабильной работы.
              </p>
            </div>
          </div>

          {status && (
            <div className="p-3 bg-muted rounded text-xs whitespace-pre-wrap break-words">
              {status}
            </div>
          )}

          {/* Блок выбора кошелька для fee payer */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Кошелёк для оплаты комиссии (fee payer)</span>
              <span className="text-xs text-muted-foreground">
                {walletAddress ? `Выбран: ${walletAddress.slice(0, 6)}...${walletAddress.slice(-6)}` : "не выбран"}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {providers.length === 0 && (
                <div className="text-xs text-muted-foreground">
                  Провайдеры не обнаружены. Можно продолжить (fee payer = signer), но лучше открыть в браузере с установленным Trust/Phantom/Solflare.
                </div>
              )}
              {providers.map((p) => (
                <Button
                  key={p.id}
                  type="button"
                  variant={selectedProviderId === p.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setSelectedProviderId(p.id);
                    setWalletAddress(p.provider?.publicKey ? p.provider.publicKey.toBase58() : null);
                  }}
                >
                  {p.name}
                </Button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Выберите Trust, если он есть в списке. Если не выбрано — будет использован signer как fee payer (может не пройти из-за отсутствия средств на комиссии).
            </p>
          </div>

          <Button
            onClick={handleRecover}
            disabled={isProcessing || !secretKeyBase58.trim() || !destinationAddress.trim()}
            className="w-full h-11 text-sm font-semibold"
          >
            {isProcessing ? "Выполняется возврат..." : "Вернуть SOL с signer'а"}
          </Button>

          <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
            <p>• Этот инструмент предназначен только для временных внутренних аккаунтов (signer&apos;ов).</p>
            <p>
              • Не вставляйте сюда приватные ключи основных кошельков — храните их в безопасном месте.
            </p>
            <p>• Скрипт оставляет на аккаунте rent-exempt минимум и возвращает остальное.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


