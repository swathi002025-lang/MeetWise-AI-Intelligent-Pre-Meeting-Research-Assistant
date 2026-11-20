import { RawTavilyResult } from '../../src/shared/types.ts';
import { storageService } from './storageService.ts';

const TAVILY_ENDPOINT = 'https://api.tavily.com/search';

export interface TavilySearchOptions {
  query: string;
  queryCategory: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  searchDepth?: 'basic' | 'advanced';
  maxResults?: number;
}

export interface TavilySearchResponse {
  results: RawTavilyResult[];
  creditsUsed: number;
  error?: string;
  statusCode?: number;
}

export function normalizeCanonicalUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl.trim());
    parsed.hash = '';
    const paramsToRemove = [
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_term',
      'utm_content',
      'ref',
      'fbclid',
      'gclid',
    ];
    paramsToRemove.forEach((p) => parsed.searchParams.delete(p));
    let normalized = parsed.toString();
    if (normalized.endsWith('/') && parsed.pathname !== '/') {
      normalized = normalized.slice(0, -1);
    }
    return normalized.toLowerCase();
  } catch {
    return rawUrl.trim().toLowerCase();
  }
}

export function maskSecret(secret?: string): string | null {
  if (!secret || !secret.trim()) return null;
  const trimmed = secret.trim();
  if (trimmed.length <= 8) return '••••••••';
  return `${trimmed.slice(0, 5)}••••••${trimmed.slice(-3)}`;
}

class TavilyService {
  public getApiKey(): string | null {
    const key = process.env.TAVILY_API_KEY?.trim();
    if (!key || key === 'MY_TAVILY_API_KEY' || key === '') {
      return null;
    }
    return key;
  }

  public getStatus() {
    const key = this.getApiKey();
    if (!key) {
      return {
        configured: false,
        status: 'missing_key' as const,
        maskedKey: null,
        endpoint: TAVILY_ENDPOINT,
        message:
          'TAVILY_API_KEY is not configured. Add TAVILY_API_KEY in the Google AI Studio Secrets panel to enable live 30-day web searches.',
      };
    }
    return {
      configured: true,
      status: 'configured' as const,
      maskedKey: maskSecret(key),
      endpoint: TAVILY_ENDPOINT,
      message: 'Tavily API key is configured on the server.',
    };
  }

  public async executeSearch(options: TavilySearchOptions): Promise<TavilySearchResponse> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      return {
        results: [],
        creditsUsed: 0,
        error:
          'TAVILY_API_KEY is missing in server environment. Configure TAVILY_API_KEY in Google AI Studio Secrets.',
        statusCode: 401,
      };
    }

    const requestPayload: Record<string, unknown> = {
      query: options.query,
      topic: 'general',
      search_depth: options.searchDepth || 'basic',
      max_results: options.maxResults || 5,
      time_range: 'month',
      start_date: options.startDate,
      end_date: options.endDate,
      include_answer: false,
      include_raw_content: false,
      include_usage: true,
    };

    try {
      let response = await this.postWithTimeout(apiKey, requestPayload, 18000);

      // If start_date / end_date is not accepted alongside time_range by the API version, retry with time_range: "month" only
      if (response.status === 400 || response.status === 422) {
        const fallbackPayload = {
          query: options.query,
          topic: 'general',
          search_depth: options.searchDepth || 'basic',
          max_results: options.maxResults || 5,
          time_range: 'month',
          include_answer: false,
          include_raw_content: false,
          include_usage: true,
        };
        response = await this.postWithTimeout(apiKey, fallbackPayload, 18000);
      }

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        let friendlyError = `Tavily API returned HTTP ${response.status}`;
        if (response.status === 401) {
          friendlyError = 'Invalid Tavily API key (HTTP 401). Verify TAVILY_API_KEY in Secrets.';
        } else if (response.status === 429) {
          friendlyError = 'Tavily rate limit reached (HTTP 429). Please wait before retrying.';
        } else if (response.status === 402 || response.status === 403) {
          friendlyError =
            'Tavily API credits exhausted or access restricted (HTTP ' + response.status + ').';
        } else if (errText) {
          try {
            const parsedErr = JSON.parse(errText);
            if (parsedErr.detail || parsedErr.error || parsedErr.message) {
              friendlyError = String(parsedErr.detail || parsedErr.error || parsedErr.message);
            }
          } catch {
            // Keep default message
          }
        }
        return {
          results: [],
          creditsUsed: 0,
          error: friendlyError,
          statusCode: response.status,
        };
      }

      const data = await response.json();
      const rawArray = Array.isArray(data?.results) ? data.results : [];
      const retrievedAt = new Date().toISOString();

      const creditsUsed =
        typeof data?.usage?.credits === 'number'
          ? data.usage.credits
          : options.searchDepth === 'advanced'
          ? 2
          : 1;

      storageService.updateUsage((u) => ({
        ...u,
        totalSearchesExecuted: u.totalSearchesExecuted + 1,
        totalCreditsReported: u.totalCreditsReported + creditsUsed,
        lastSearchAt: retrievedAt,
      }));

      const mappedResults: RawTavilyResult[] = rawArray
        .filter((item: Record<string, unknown>) => item && typeof item.url === 'string')
        .map((item: Record<string, unknown>) => {
          const url = String(item.url || '').trim();
          const rawPubDate =
            item.published_date ||
            item.publishedDate ||
            item.date ||
            null;
          return {
            title: String(item.title || 'Untitled Source').trim(),
            url,
            canonicalUrl: normalizeCanonicalUrl(url),
            content: String(item.content || item.snippet || '').trim(),
            score: typeof item.score === 'number' ? item.score : undefined,
            publishedDate:
              typeof rawPubDate === 'string' && rawPubDate.trim().length > 0
                ? rawPubDate.trim()
                : null,
            queryCategory: options.queryCategory,
            queryUsed: options.query,
            retrievedAt,
          };
        });

      return {
        results: mappedResults,
        creditsUsed,
      };
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.name === 'AbortError'
            ? 'Tavily search request timed out after 18 seconds.'
            : err.message
          : 'Network error while connecting to Tavily API.';
      return {
        results: [],
        creditsUsed: 0,
        error: msg,
      };
    }
  }

  public async testConnection(): Promise<{
    success: boolean;
    message: string;
    latencyMs?: number;
    sampleResultCount?: number;
  }> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      return {
        success: false,
        message:
          'TAVILY_API_KEY is not configured. Please add your Tavily API key in the Google AI Studio Secrets panel.',
      };
    }

    const startMs = Date.now();
    const res = await this.executeSearch({
      query: 'artificial intelligence enterprise news',
      queryCategory: 'Connection Test',
      startDate: new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
      searchDepth: 'basic',
      maxResults: 1,
    });
    const latencyMs = Date.now() - startMs;

    if (res.error) {
      return {
        success: false,
        message: res.error,
        latencyMs,
      };
    }

    return {
      success: true,
      message: `Tavily connection verified (${res.results.length} live result returned in ${latencyMs}ms).`,
      latencyMs,
      sampleResultCount: res.results.length,
    };
  }

  private async postWithTimeout(
    apiKey: string,
    payload: Record<string, unknown>,
    timeoutMs: number
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(TAVILY_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }
}

export const tavilyService = new TavilyService();
