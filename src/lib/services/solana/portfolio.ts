import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";
import { Token } from "@/lib/types/token";

const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const WRAPPED_SOL_MINT = "So11111111111111111111111111111111111111112";

type JupiterPriceResponse = {
  data?: Record<string, { price?: number }>;
};

const KNOWN_TOKENS: Record<
  string,
  { symbol: string; name: string }
> = {
  [WRAPPED_SOL_MINT]: { symbol: "SOL", name: "Solana" },
};

export interface SolanaPortfolio {
  tokens: Token[];
  totalValueUsd: number;
}

export class SolanaPortfolioService {
  private static instance: SolanaPortfolioService;
  private connection: Connection;

  private constructor() {
    const endpoint =
      process.env.SOLANA_RPC_URL ??
      process.env.NEXT_PUBLIC_SOLANA_RPC_URL ??
      clusterApiUrl("mainnet-beta");

    this.connection = new Connection(endpoint, "confirmed");
  }

  static getInstance(): SolanaPortfolioService {
    if (!SolanaPortfolioService.instance) {
      SolanaPortfolioService.instance = new SolanaPortfolioService();
    }
    return SolanaPortfolioService.instance;
  }

  async getPortfolio(address: string): Promise<SolanaPortfolio> {
    const owner = new PublicKey(address);

    const [tokenAccounts, lamports] = await Promise.all([
      this.connection.getParsedTokenAccountsByOwner(
        owner,
        { programId: TOKEN_PROGRAM_ID },
        "confirmed",
      ),
      this.connection.getBalance(owner, "confirmed"),
    ]);

    const tokens: Token[] = [];

    for (const { account } of tokenAccounts.value) {
      const parsed = account.data as {
        program: string;
        parsed?: {
          info?: {
            mint?: string;
            tokenAmount?: {
              amount?: string;
              decimals?: number;
              uiAmount?: number | null;
              uiAmountString?: string;
            };
          };
        };
      };

      const info = parsed.parsed?.info;
      const mint = info?.mint;
      const tokenAmount = info?.tokenAmount;

      if (!mint || !tokenAmount) {
        continue;
      }

      const rawAmount = tokenAmount.amount ?? "0";
      const uiAmount = tokenAmount.uiAmount ?? parseFloat(tokenAmount.uiAmountString ?? "0");
      const decimals = tokenAmount.decimals ?? 0;

      if (!uiAmount || uiAmount <= 0) {
        continue;
      }

      tokens.push({
        address: mint,
        name: KNOWN_TOKENS[mint]?.name ?? mint,
        symbol: KNOWN_TOKENS[mint]?.symbol ?? `${mint.slice(0, 4)}…`,
        decimals,
        amount: rawAmount,
        price: null,
        value: null,
      });
    }

    const hasWrappedSol = tokens.some((token) => token.address === WRAPPED_SOL_MINT);
    if (!hasWrappedSol && lamports > 0) {
      tokens.push({
        address: WRAPPED_SOL_MINT,
        name: KNOWN_TOKENS[WRAPPED_SOL_MINT].name,
        symbol: KNOWN_TOKENS[WRAPPED_SOL_MINT].symbol,
        decimals: 9,
        amount: lamports.toString(),
        price: null,
        value: null,
      });
    }

    const uniqueMints = Array.from(new Set(tokens.map((token) => token.address)));

    const priceMap = await this.fetchUsdPrices(uniqueMints);

    let totalValueUsd = 0;

    for (const token of tokens) {
      const price = priceMap[token.address];
      if (typeof price !== "number") {
        continue;
      }

      const amountInUnits = parseFloat(token.amount) / Math.pow(10, token.decimals);
      const usdValue = amountInUnits * price;

      token.price = price.toString();
      token.value = usdValue.toString();
      totalValueUsd += usdValue;
    }

    tokens.sort((a, b) => {
      const valueA = a.value ? parseFloat(a.value) : 0;
      const valueB = b.value ? parseFloat(b.value) : 0;
      return valueB - valueA;
    });

    return {
      tokens,
      totalValueUsd,
    };
  }

  private async fetchUsdPrices(mints: string[]): Promise<Record<string, number>> {
    if (!mints.length) {
      return {};
    }

    const url = new URL("https://price.jup.ag/v6/price");
    url.searchParams.set("ids", mints.join(","));

    try {
      // TODO: proxy Jupiter Price API through our backend service to avoid direct client calls.
      const response = await fetch(url.toString(), { cache: "no-store" });
      if (!response.ok) {
        return {};
      }

      const data: JupiterPriceResponse = await response.json();
      const result: Record<string, number> = {};

      for (const [mint, value] of Object.entries(data.data ?? {})) {
        if (typeof value?.price === "number") {
          result[mint] = value.price;
        }
      }

      return result;
    } catch (error) {
      console.error("Failed to fetch Solana token prices:", error);
      return {};
    }
  }
}

