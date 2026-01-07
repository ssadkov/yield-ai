export interface JupiterTokenData {
  id: string;
  name: string;
  symbol: string;
  icon: string;
  decimals: number;
  usdPrice?: number;
  priceBlockId?: number;
  stats24h?: {
    priceChange: number;
  };
  isVerified?: boolean;
  tags?: string[];
}

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
  private static batchCache = new Map<string, { data: JupiterTokenData[]; timestamp: number }>();
  private readonly ttlMs = 1000 * 60 * 30; // 30 minutes for individual cache
  private static readonly BATCH_CACHE_DURATION = 1000 * 60 * 5; // 5 minutes for batch cache
  private static readonly BASE_URL = 'https://api.jup.ag/tokens/v2/search';

  private constructor() {}

  static getInstance(): JupiterTokenMetadataService {
    if (!JupiterTokenMetadataService.instance) {
      JupiterTokenMetadataService.instance = new JupiterTokenMetadataService();
    }
    return JupiterTokenMetadataService.instance;
  }

  async getMetadataMap(mints: string[]): Promise<Record<string, MetadataRecord>> {
    if (mints.length === 0) {
      return {};
    }

    const now = Date.now();
    const pending: string[] = [];
    const result: Record<string, MetadataRecord> = {};

    // Проверяем индивидуальный кэш
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

    // Если есть токены, которые нужно загрузить
    if (pending.length > 0) {
      await this.fetchBatch(pending);
      
      // После загрузки проверяем кэш снова
      for (const mint of pending) {
        const cached = this.cache.get(mint);
        if (cached?.metadata) {
          result[mint] = cached.metadata;
        }
      }
    }

    return result;
  }

  /**
   * Загружает метаданные для нескольких токенов одним запросом
   */
  private async fetchBatch(mintAddresses: string[]): Promise<void> {
    if (mintAddresses.length === 0) {
      return;
    }

    // Jupiter API имеет лимит 100 mint адресов в одном запросе
    // Разбиваем на чанки по 100, если нужно
    const CHUNK_SIZE = 100;
    const chunks: string[][] = [];
    for (let i = 0; i < mintAddresses.length; i += CHUNK_SIZE) {
      chunks.push(mintAddresses.slice(i, i + CHUNK_SIZE));
    }

    // Обрабатываем каждый чанк
    for (const chunk of chunks) {
      // Проверяем batch кэш для этого чанка
      const cacheKey = chunk.sort().join(',');
      const cached = JupiterTokenMetadataService.batchCache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < JupiterTokenMetadataService.BATCH_CACHE_DURATION) {
        // Обновляем индивидуальный кэш из batch кэша
        this.updateIndividualCache(cached.data, chunk);
        continue;
      }

      try {
        // Передаем несколько mint адресов через запятую в одном запросе
        const query = chunk.join(',');
        const url = `${JupiterTokenMetadataService.BASE_URL}?query=${encodeURIComponent(query)}`;
        
        const headers: HeadersInit = {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        };
        
        // Добавляем API ключ, если он есть
        const apiKey = process.env.NEXT_PUBLIC_JUP_API_KEY || process.env.JUP_API_KEY;
        if (apiKey) {
          headers['x-api-key'] = apiKey;
        }

        console.log(`[JupiterTokenMetadata] Fetching batch for ${chunk.length} tokens (chunk ${chunks.indexOf(chunk) + 1}/${chunks.length})`);
        console.log(`[JupiterTokenMetadata] URL: ${url}`);
        console.log(`[JupiterTokenMetadata] Has API key: ${!!apiKey}`);
        
        const response = await fetch(url, {
          cache: 'no-store',
          headers,
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => '');
          console.error(`[JupiterTokenMetadata] Response not OK: ${response.status} ${response.statusText}`, errorText);
          if (response.status === 429) {
            console.warn(`[JupiterTokenMetadata] Rate limit exceeded, waiting 5 seconds...`);
            await new Promise(resolve => setTimeout(resolve, 5000));
          }
          // Помечаем токены этого чанка как отсутствующие
          this.markMissing(chunk);
          continue;
        }

        const data: JupiterTokenData[] = await response.json();
        
        // Проверяем, что ответ - массив
        if (!Array.isArray(data)) {
          console.error(`[JupiterTokenMetadata] Invalid response format, expected array, got:`, typeof data, data);
          this.markMissing(chunk);
          continue;
        }
        
        console.log(`[JupiterTokenMetadata] ✅ Received ${data.length} tokens from API`);
        console.log(`[JupiterTokenMetadata] Requested mints (${chunk.length}):`, chunk);
        console.log(`[JupiterTokenMetadata] Received tokens:`, data.map(t => ({ 
          id: t.id, 
          symbol: t.symbol, 
          icon: t.icon ? '✅' : '❌',
          hasIcon: !!t.icon 
        })));
        
        // Сохраняем в batch кэш
        JupiterTokenMetadataService.batchCache.set(cacheKey, {
          data,
          timestamp: Date.now(),
        });

        // Обновляем индивидуальный кэш
        this.updateIndividualCache(data, chunk);
        
      } catch (error) {
        console.error('[JupiterTokenMetadata] Error fetching batch from Jupiter API:', error);
        // Помечаем токены этого чанка как отсутствующие
        this.markMissing(chunk);
      }
    }
  }

  /**
   * Обновляет индивидуальный кэш из batch данных
   */
  private updateIndividualCache(data: JupiterTokenData[], requestedMints?: string[]): void {
    const now = Date.now();
    
    // Создаем Map для быстрого поиска по id
    const dataMap = new Map<string, JupiterTokenData>();
    for (const token of data) {
      if (token.id) {
        dataMap.set(token.id, token);
      }
    }

    console.log(`[JupiterTokenMetadata] updateIndividualCache:`, {
      dataLength: data.length,
      dataMapSize: dataMap.size,
      requestedMints: requestedMints?.length || 0,
      availableIds: Array.from(dataMap.keys()).slice(0, 5),
    });

    // Если указаны конкретные mint адреса, обновляем только их
    const mintsToUpdate = requestedMints || Array.from(dataMap.keys());
    
    for (const mint of mintsToUpdate) {
      const token = dataMap.get(mint);
      
      if (token) {
        console.log(`[JupiterTokenMetadata] ✅ Found metadata for ${mint}:`, {
          symbol: token.symbol,
          name: token.name,
          icon: token.icon,
          decimals: token.decimals,
        });
        
        this.cache.set(mint, {
          expiresAt: now + this.ttlMs,
          metadata: {
            symbol: token.symbol,
            name: token.name,
            logoUrl: token.icon, // ВАЖНО: icon, не logoURI
            decimals: token.decimals,
          },
        });
      } else {
        console.warn(`[JupiterTokenMetadata] ❌ No match found for mint: ${mint}`, {
          requestedMint: mint,
          availableIds: Array.from(dataMap.keys()).slice(0, 10),
          dataMapHasMint: dataMap.has(mint),
        });
        this.markMissing([mint]);
      }
    }
  }

  private markMissing(mints: string[]): void {
    const now = Date.now();
    for (const mint of mints) {
      this.cache.set(mint, {
        expiresAt: now + this.ttlMs,
        metadata: null,
      });
    }
  }

  /**
   * Очистить кэш
   */
  static clearCache(): void {
    JupiterTokenMetadataService.batchCache.clear();
    if (JupiterTokenMetadataService.instance) {
      JupiterTokenMetadataService.instance.cache.clear();
    }
  }

  /**
   * Получить размер кэша
   */
  static getCacheSize(): number {
    return JupiterTokenMetadataService.batchCache.size;
  }
}
