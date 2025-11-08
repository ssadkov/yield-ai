type JupiterTokenMetadata = {
  address?: string;
  mint?: string;
  symbol?: string;
  name?: string;
  logoURI?: string;
  decimals?: number;
};

type MetadataRecord = {
  symbol?: string;
  name?: string;
  logoUrl?: string;
  decimals?: number;
};

type MetadataCacheEntry = {
  expiresAt: number;
  metadata: MetadataRecord | null;
};

export class JupiterTokenMetadataService {
  private static instance: JupiterTokenMetadataService;
  private cache = new Map<string, MetadataCacheEntry>();
  private readonly ttlMs = 1000 * 60 * 30; // 30 minutes
  private readonly chunkSize = 50;

  private constructor() {}

  static getInstance(): JupiterTokenMetadataService {
    if (!JupiterTokenMetadataService.instance) {
      JupiterTokenMetadataService.instance = new JupiterTokenMetadataService();
    }
    return JupiterTokenMetadataService.instance;
  }

  async getMetadataMap(mints: string[]): Promise<Record<string, MetadataRecord>> {
    const now = Date.now();
    const pending: string[] = [];
    const result: Record<string, MetadataRecord> = {};

    for (const mint of mints) {
      const cached = this.cache.get(mint);
      if (cached && cached.expiresAt > now) {
        if (cached.metadata) {
          result[mint] = cached.metadata;
        }
      } else {
        pending.push(mint);
      }
    }

    if (pending.length > 0) {
      await this.fetchAndCache(pending);
      for (const mint of pending) {
        const cached = this.cache.get(mint);
        if (cached?.metadata) {
          result[mint] = cached.metadata;
        }
      }
    }

    return result;
  }

  private async fetchAndCache(mints: string[]) {
    const uniqueMints = [...new Set(mints)];
    for (let i = 0; i < uniqueMints.length; i += this.chunkSize) {
      const chunk = uniqueMints.slice(i, i + this.chunkSize);
      await this.fetchChunk(chunk);
    }
  }

  private async fetchChunk(mints: string[]) {
    if (!mints.length) return;

    for (const mint of mints) {
      const url = new URL("https://lite-api.jup.ag/tokens/v2/search");
      url.searchParams.set("query", mint);

      try {
        // TODO: proxy Jupiter token metadata API through backend service for resiliency.
        const response = await fetch(url.toString(), { cache: "no-store" });
        if (!response.ok) {
          this.markMissing([mint]);
          continue;
        }

        const data = (await response.json()) as JupiterTokenMetadata[];
        const match =
          data?.find((item) => item.id === mint || item.mint === mint) ?? null;

        if (match) {
          this.cache.set(mint, {
            expiresAt: Date.now() + this.ttlMs,
            metadata: {
              symbol: match.symbol,
              name: match.name,
              logoUrl: match.icon ?? match.logoURI,
              decimals: match.decimals,
            },
          });
        } else {
          this.markMissing([mint]);
        }
      } catch (error) {
        console.error("Failed to fetch Jupiter token metadata:", error);
        this.markMissing([mint]);
      }
    }
  }

  private markMissing(mints: string[]) {
    const now = Date.now();
    for (const mint of mints) {
      this.cache.set(mint, {
        expiresAt: now + this.ttlMs,
        metadata: null,
      });
    }
  }
}

