"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import Image from "next/image";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { PanoraPricesService } from "@/lib/services/panora/prices";
import { Token } from "@/lib/types/token";
import { APTOS_COIN_TYPE } from "@/lib/constants/yieldAiVault";
import type { TokenPrice } from "@/lib/types/panora";
import { formatCurrency, formatNumber } from "@/lib/utils/numberFormat";
import { useToast } from "@/components/ui/use-toast";
import { getTokenList } from "@/lib/tokens/getTokenList";
import { normalizeAddress } from "@/lib/utils/addressNormalization";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Copy } from "lucide-react";

export function YieldAIPositions() {
  const { account } = useWallet();
  const { toast } = useToast();
  const [safeAddresses, setSafeAddresses] = useState<string[]>([]);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    const walletAddress = account?.address?.toString();
    if (!walletAddress) {
      setSafeAddresses([]);
      setTokens([]);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const safesRes = await fetch(
        `/api/protocols/yield-ai/safes?owner=${encodeURIComponent(walletAddress)}`
      );
      const safesJson = await safesRes.json();
      const list = safesJson?.data?.safeAddresses ?? [];
      const addresses = Array.isArray(list) ? list : [];
      setSafeAddresses(addresses);

      if (addresses.length === 0) {
        setTokens([]);
        return;
      }

      const safeAddress = addresses[0];
      const contentsRes = await fetch(
        `/api/protocols/yield-ai/safe-contents?safeAddress=${encodeURIComponent(safeAddress)}`
      );
      const contentsJson = await contentsRes.json();
      const data = contentsJson?.data;
      const faTokens = data?.tokens ?? [];
      const aptBalance = data?.aptBalance ?? "0";

      const tokenAddresses = [
        ...faTokens.map((t: { asset_type: string }) => t.asset_type),
        APTOS_COIN_TYPE,
      ].filter(Boolean);
      const pricesService = PanoraPricesService.getInstance();
      let prices: TokenPrice[] = [];
      try {
        const pr = await pricesService.getPrices(1, tokenAddresses);
        prices = Array.isArray(pr) ? pr : (pr?.data ?? []);
      } catch {
        // no prices
      }

      const built: Token[] = [];
      const tokenListAptos = getTokenList(1);
      const resolveLogo = (addressOrType: string, symbol: string) => {
        const addr = addressOrType.includes("::")
          ? addressOrType.split("::")[0]
          : addressOrType;
        const norm = normalizeAddress(addr);
        const byAddr = tokenListAptos.find(
          (t: { faAddress?: string; tokenAddress?: string }) => {
            const tFa = t.faAddress && normalizeAddress(t.faAddress);
            const tTa = (t as any).tokenAddress && normalizeAddress((t as any).tokenAddress);
            return tFa === norm || tTa === norm;
          }
        );
        if ((byAddr as any)?.logoUrl) return (byAddr as any).logoUrl;
        const bySymbol = tokenListAptos.find(
          (t: { symbol?: string }) => t.symbol === symbol
        );
        return (bySymbol as any)?.logoUrl;
      };
      for (const t of faTokens) {
        const price = prices.find(
          (p) => p.faAddress === t.asset_type || p.tokenAddress === t.asset_type
        );
        const decimals = price?.decimals ?? 8;
        const amount = parseFloat(t.amount) / Math.pow(10, decimals);
        const usd = price ? amount * parseFloat(price.usdPrice) : 0;
        const symbol = price?.symbol ?? t.asset_type.split("::").pop() ?? "?";
        built.push({
          address: t.asset_type,
          name: price?.name ?? t.asset_type.split("::").pop() ?? "",
          symbol,
          decimals,
          amount: t.amount,
          price: price?.usdPrice ?? null,
          value: price ? String(usd) : null,
          logoUrl: resolveLogo(t.asset_type, symbol),
        });
      }
      if (BigInt(aptBalance) > 0) {
        const aptPrice = prices.find(
          (p) =>
            p.tokenAddress === APTOS_COIN_TYPE || p.faAddress === APTOS_COIN_TYPE
        );
        const decimals = aptPrice?.decimals ?? 8;
        const amount = Number(aptBalance) / Math.pow(10, decimals);
        const usd = aptPrice ? amount * parseFloat(aptPrice.usdPrice) : 0;
        built.push({
          address: APTOS_COIN_TYPE,
          name: "Aptos Coin",
          symbol: "APT",
          decimals,
          amount: aptBalance,
          price: aptPrice?.usdPrice ?? null,
          value: aptPrice ? String(usd) : null,
          logoUrl: resolveLogo(APTOS_COIN_TYPE, "APT"),
        });
      }
      built.sort((a, b) => {
        const va = a.value ? parseFloat(a.value) : 0;
        const vb = b.value ? parseFloat(b.value) : 0;
        return vb - va;
      });
      setTokens(built);
    } catch {
      setError("Failed to load AI agent safe data");
      setTokens([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [account?.address]);

  useEffect(() => {
    const handleRefresh: EventListener = (evt) => {
      const event = evt as CustomEvent<{ protocol: string }>;
      if (event?.detail?.protocol === "yield-ai") {
        void loadData();
      }
    };
    window.addEventListener("refreshPositions", handleRefresh);
    return () => window.removeEventListener("refreshPositions", handleRefresh);
  }, [account?.address]);

  const handleDepositStub = () => {
    toast({
      title: "Coming soon",
      description: "Deposit will be implemented later.",
    });
  };

  const handleWithdrawStub = () => {
    toast({
      title: "Coming soon",
      description: "Withdraw will be implemented later.",
    });
  };

  const totalValue = tokens.reduce(
    (sum, t) => sum + (t.value ? parseFloat(t.value) : 0),
    0
  );

  if (loading) {
    return <div className="py-4 text-muted-foreground">Loading safe assets...</div>;
  }
  if (error) {
    return <div className="py-4 text-red-500">{error}</div>;
  }
  if (safeAddresses.length === 0) {
    return (
      <div className="py-4 text-muted-foreground">
        No safe found. Create a safe to see assets here.
      </div>
    );
  }

  return (
    <div className="space-y-4 text-base">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-muted-foreground font-medium">
            Safe {safeAddresses[0].slice(0, 6)}...{safeAddresses[0].slice(-4)}
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={() => {
                  navigator.clipboard
                    .writeText(safeAddresses[0])
                    .then(() =>
                      toast({
                        title: "Copied",
                        description: "Safe address copied to clipboard",
                      })
                    )
                    .catch(() =>
                      toast({
                        title: "Copy failed",
                        variant: "destructive",
                      })
                    );
                }}
                aria-label="Copy safe address"
              >
                <Copy className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Copy safe address</p>
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="default" onClick={handleDepositStub}>
            Deposit
          </Button>
          <Button size="sm" variant="outline" onClick={handleWithdrawStub}>
            Withdraw
          </Button>
        </div>
      </div>

      <ScrollArea className="max-h-[420px]">
        {tokens.length === 0 ? (
          <div className="py-4 text-muted-foreground">No assets in this safe.</div>
        ) : (
          tokens.map((token) => {
            const value = token.value ? parseFloat(token.value) : 0;
            const amount =
              parseFloat(token.amount) / Math.pow(10, token.decimals);
            const price = token.price ? parseFloat(token.price) : 0;
            return (
              <div
                key={token.address}
                className="p-3 sm:p-4 border-b last:border-b-0 flex justify-between items-center gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 relative shrink-0 rounded-full bg-muted flex items-center justify-center text-sm font-semibold">
                    {token.logoUrl ? (
                      <Image
                        src={token.logoUrl}
                        alt={token.symbol}
                        width={32}
                        height={32}
                        className="object-contain rounded-full"
                        unoptimized
                      />
                    ) : (
                      <span>{token.symbol.slice(0, 1)}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold">{token.symbol}</div>
                    {price > 0 && (
                      <div className="text-sm text-muted-foreground">
                        {formatCurrency(price, 4)}
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-bold">{formatCurrency(value, 2)}</div>
                  <div className="text-sm text-muted-foreground">
                    {formatNumber(amount, 4)}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </ScrollArea>

      <div className="flex items-center justify-between pt-6 pb-6">
        <span className="text-xl">Total assets in safe:</span>
        <span className="text-xl text-primary font-bold">
          {formatCurrency(totalValue, 2)}
        </span>
      </div>
    </div>
  );
}
