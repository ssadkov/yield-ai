import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";
import { Token } from "@/lib/types/token";
import { JupiterTokenMetadataService } from "./tokenMetadata";

const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const WRAPPED_SOL_MINT = "So11111111111111111111111111111111111111112";

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
  private rpcEndpoints: string[];

  private constructor() {
    // List of RPC endpoints to try
    this.rpcEndpoints = [
      process.env.SOLANA_RPC_URL,
      process.env.NEXT_PUBLIC_SOLANA_RPC_URL,
      "https://rpc.ankr.com/solana",
      "https://solana-api.projectserum.com",
      clusterApiUrl("mainnet-beta"),
    ].filter(Boolean) as string[];

    const endpoint = this.rpcEndpoints[0] || clusterApiUrl("mainnet-beta");
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

    // Try multiple RPC endpoints if the first one fails
    let tokenAccounts: Awaited<ReturnType<Connection["getParsedTokenAccountsByOwner"]>> | null = null;
    let lamports: number | null = null;

    let lastError: Error | null = null;
    for (const endpoint of this.rpcEndpoints) {
      try {
        const connection = new Connection(endpoint, "confirmed");
        const [accounts, balance] = await Promise.all([
          connection.getParsedTokenAccountsByOwner(
            owner,
            { programId: TOKEN_PROGRAM_ID },
            "confirmed",
          ),
          connection.getBalance(owner, "confirmed"),
        ]);
        
        tokenAccounts = accounts;
        lamports = balance;
        
        // Update connection if successful
        this.connection = connection;
        break;
      } catch (error: any) {
        console.warn(`Failed to fetch portfolio from ${endpoint}:`, error.message);
        lastError = error;
        continue;
      }
    }

    if (!tokenAccounts || lamports === null) {
      throw lastError || new Error("Failed to fetch portfolio from all RPC endpoints");
    }

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

    const metadataService = JupiterTokenMetadataService.getInstance();
    const metadataMap = await metadataService.getMetadataMap(
      tokens.map((token) => token.address),
    );

    for (const token of tokens) {
      const metadata = metadataMap[token.address];
      if (!metadata) {
        console.log(`[SolanaPortfolio] No metadata found for token: ${token.address}`);
        continue;
      }

      if (metadata.symbol) {
        token.symbol = metadata.symbol;
      }
      if (metadata.name) {
        token.name = metadata.name;
      }
      if (metadata.logoUrl) {
        token.logoUrl = metadata.logoUrl;
        console.log(`[SolanaPortfolio] Set logoUrl for ${token.symbol || token.address}: ${metadata.logoUrl}`);
      } else {
        console.log(`[SolanaPortfolio] No logoUrl in metadata for ${token.symbol || token.address}`);
      }
      if (
        typeof metadata.decimals === "number" &&
        Number.isFinite(metadata.decimals)
      ) {
        token.decimals = metadata.decimals;
      }
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

    const result: Record<string, number> = {};

    const ids = [...new Set(mints)];
    const chunkSize = 50;

    const fetchBatch = async (idsChunk: string[]) => {
      if (!idsChunk.length) return;

      const url = new URL("https://api.jup.ag/price/v3");
      url.searchParams.set("ids", idsChunk.join(","));

      try {
        const headers: HeadersInit = {
          'Accept': 'application/json',
        };
        
        // Добавляем API ключ, если он есть
        const apiKey = process.env.NEXT_PUBLIC_JUP_API_KEY || process.env.JUP_API_KEY;
        if (apiKey) {
          headers['x-api-key'] = apiKey;
        }

        // TODO: proxy Jupiter Price API through our backend service to avoid direct client calls.
        const response = await fetch(url.toString(), { 
          cache: "no-store",
          headers,
        });
        
        if (!response.ok) {
          console.warn(`[SolanaPortfolio] Price API response not OK: ${response.status} ${response.statusText}`);
          return;
        }

        const data = (await response.json()) as Record<
          string,
          { usdPrice?: number }
        >;

        for (const [mint, value] of Object.entries(data)) {
          if (typeof value?.usdPrice === "number") {
            result[mint] = value.usdPrice;
          }
        }
      } catch (error) {
        console.error("Failed to fetch Solana token prices:", error);
      }
    };

    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);
      await fetchBatch(chunk);
    }

    return result;
  }
}

