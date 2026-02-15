import yahooFinance from '../lib/yahooFinance.js';
import { cacheService } from './CacheService.js';

const NEWS_CACHE_TTL = 900; // 15 minutes
const DEFAULT_NEWS_LIMIT = 10;

export interface NewsItem {
  title: string;
  link: string;
  publisher: string;
  publishedAt: string;
  summary?: string;
  thumbnail?: string;
}

export class NewsService {
  /**
   * Get news for a single symbol.
   * Results are cached for 15 minutes.
   */
  async getNewsBySymbol(symbol: string, limit = DEFAULT_NEWS_LIMIT): Promise<NewsItem[]> {
    const cacheKey = `news:${symbol}`;
    const cached = cacheService.get<NewsItem[]>(cacheKey);
    if (cached) return cached.slice(0, limit);

    const result: any = await yahooFinance.search(symbol, { newsCount: DEFAULT_NEWS_LIMIT });

    const news: NewsItem[] = (result.news ?? [])
      .filter((item: any) => item.title && item.link)
      .map((item: any) => {
        const summary =
          typeof (item as { summary?: unknown }).summary === 'string'
            ? ((item as { summary?: string }).summary as string)
            : undefined;

        return {
          title: item.title,
          link: item.link,
          publisher: item.publisher ?? 'Unknown',
          publishedAt: item.providerPublishTime
            ? new Date(item.providerPublishTime).toISOString()
            : new Date().toISOString(),
          summary,
          thumbnail: item.thumbnail?.resolutions?.[0]?.url,
        };
      })
      .sort(
        (a: NewsItem, b: NewsItem) =>
          new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
      );

    cacheService.set(cacheKey, news, NEWS_CACHE_TTL);
    return news.slice(0, limit);
  }

  /**
   * Get aggregated news for multiple symbols.
   * Each symbol is fetched/cached independently.
   */
  async getNewsForSymbols(symbols: string[], limit = DEFAULT_NEWS_LIMIT): Promise<NewsItem[]> {
    const allNews: NewsItem[] = [];

    await Promise.all(
      symbols.map(async (symbol) => {
        try {
          const news = await this.getNewsBySymbol(symbol);
          allNews.push(...news);
        } catch {
          // Skip symbols that fail
        }
      })
    );

    // Deduplicate by link, sort by date desc, apply limit
    const seen = new Set<string>();
    return allNews
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
      .filter((item) => {
        if (seen.has(item.link)) return false;
        seen.add(item.link);
        return true;
      })
      .slice(0, limit);
  }
}

export const newsService = new NewsService();
