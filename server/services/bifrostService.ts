import { maskSecret } from './tavilyService.ts';
import { storageService } from './storageService.ts';

export interface BifrostCompletionRequest {
  systemInstruction: string;
  userPrompt: string;
  jsonMode?: boolean;
  timeoutMs?: number;
}

export interface BifrostCompletionResponse {
  success: boolean;
  text?: string;
  modelUsed?: string;
  authSchemeUsed?: 'Basic' | 'Bearer' | 'None';
  error?: string;
  statusCode?: number;
}

/**
 * Formats Bifrost credentials into the appropriate Authorization header.
 * Supports:
 * 1. Explicit "Basic ..." or "Bearer ..." prefix
 * 2. Raw "username:password" -> encodes to Base64 and prefixes with "Basic "
 * 3. Pre-encoded Base64 "username:password" (decodes to UTF-8 containing ":") -> prefixes with "Basic "
 * 4. Standard Basic Auth fallback for Bifrost credentials
 */
export function buildBifrostAuthHeader(rawCredential: string | null): {
  headerValue: string | null;
  scheme: 'Basic' | 'Bearer' | 'None';
} {
  if (!rawCredential || !rawCredential.trim()) {
    return { headerValue: null, scheme: 'None' };
  }
  const trimmed = rawCredential.trim();

  if (/^basic\s+/i.test(trimmed)) {
    return {
      headerValue: `Basic ${trimmed.replace(/^basic\s+/i, '').trim()}`,
      scheme: 'Basic',
    };
  }

  if (/^bearer\s+/i.test(trimmed)) {
    return {
      headerValue: `Bearer ${trimmed.replace(/^bearer\s+/i, '').trim()}`,
      scheme: 'Bearer',
    };
  }

  // Raw username:password containing a colon
  if (trimmed.includes(':')) {
    const encoded = Buffer.from(trimmed, 'utf-8').toString('base64');
    return {
      headerValue: `Basic ${encoded}`,
      scheme: 'Basic',
    };
  }

  // Check if already Base64-encoded username:password
  try {
    const decoded = Buffer.from(trimmed, 'base64').toString('utf-8');
    if (decoded.includes(':') && /^[\x20-\x7E]+$/.test(decoded)) {
      return {
        headerValue: `Basic ${trimmed}`,
        scheme: 'Basic',
      };
    }
  } catch {
    // Fallback below
  }

  // Default to Basic Auth for Bifrost credentials
  return {
    headerValue: `Basic ${trimmed}`,
    scheme: 'Basic',
  };
}

class BifrostService {
  public getConfig() {
    const baseUrl = process.env.BIFROST_BASE_URL?.trim() || '';
    const apiKey = process.env.BIFROST_API_KEY?.trim() || '';
    const model = process.env.BIFROST_MODEL?.trim() || 'gemini-2.5-flash';

    const isConfigured = Boolean(baseUrl && /^https?:\/\//i.test(baseUrl));
    const authInfo = buildBifrostAuthHeader(apiKey || null);

    return {
      isConfigured,
      baseUrl: isConfigured ? baseUrl.replace(/\/+$/, '') : null,
      apiKey: apiKey || null,
      authHeader: authInfo.headerValue,
      authScheme: authInfo.scheme,
      maskedKey: maskSecret(apiKey),
      model: isConfigured ? model : null,
    };
  }

  public getStatus() {
    const cfg = this.getConfig();
    if (!cfg.isConfigured || !cfg.baseUrl) {
      return {
        configured: false,
        status: 'not_configured' as const,
        baseUrl: null,
        model: null,
        maskedKey: null,
        message:
          'Bifrost not configured. Using native Google AI Studio server-side Gemini fallback automatically. Set BIFROST_BASE_URL, BIFROST_API_KEY, and BIFROST_MODEL in Secrets to route through a Bifrost gateway.',
      };
    }

    const isLocalLoopback =
      /^https?:\/\/(localhost|127\.0\.0\.1)(:(8080|3000))?(\/|$)/i.test(cfg.baseUrl);

    if (isLocalLoopback) {
      return {
        configured: true,
        status: 'unreachable' as const,
        baseUrl: cfg.baseUrl,
        model: cfg.model,
        maskedKey: cfg.maskedKey,
        message: `BIFROST_BASE_URL is set to ${cfg.baseUrl}, which points to this Cloud Run container's local loopback port (occupied by the container's Nginx/Express server) rather than an external Bifrost gateway host. Automatic fallback to server-side Gemini is active.`,
      };
    }

    return {
      configured: true,
      status: 'configured' as const,
      baseUrl: cfg.baseUrl,
      model: cfg.model,
      maskedKey: cfg.maskedKey,
      message: `Bifrost gateway configured at ${cfg.baseUrl} (model: ${cfg.model}, auth: ${cfg.authScheme}).`,
    };
  }

  private resolveChatEndpoint(baseUrl: string): string {
    if (baseUrl.endsWith('/chat/completions')) return baseUrl;
    if (baseUrl.endsWith('/v1')) return `${baseUrl}/chat/completions`;
    return `${baseUrl}/v1/chat/completions`;
  }

  public async generateCompletion(
    req: BifrostCompletionRequest
  ): Promise<BifrostCompletionResponse> {
    const cfg = this.getConfig();
    if (!cfg.isConfigured || !cfg.baseUrl) {
      return {
        success: false,
        error: 'Bifrost gateway is not configured.',
      };
    }

    if (!req.userPrompt || !req.userPrompt.trim()) {
      return {
        success: false,
        error: 'User prompt cannot be empty.',
        statusCode: 400,
      };
    }

    // Prevent self-loop into this Cloud Run container's own Nginx (port 8080) or Express (port 3000) server
    if (/^https?:\/\/(localhost|127\.0\.0\.1):(8080|3000)(\/|$)/i.test(cfg.baseUrl)) {
      return {
        success: false,
        authSchemeUsed: cfg.authScheme,
        statusCode: 404,
        error: `BIFROST_BASE_URL (${cfg.baseUrl}) resolves to this Cloud Run container's own Nginx/Express server (ports 8080/3000) instead of an external Bifrost instance. Provide a publicly reachable Bifrost URL (e.g., https://your-bifrost-gateway.example.com); falling back to direct Gemini API.`,
      };
    }

    const endpoint = this.resolveChatEndpoint(cfg.baseUrl);
    const timeoutMs = req.timeoutMs ?? 20000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (cfg.authHeader) {
        headers['Authorization'] = cfg.authHeader;
      }

      const body: Record<string, unknown> = {
        model: cfg.model || 'gemini-2.5-flash',
        messages: [
          { role: 'system', content: req.systemInstruction },
          { role: 'user', content: req.userPrompt },
        ],
      };

      if (req.jsonMode) {
        body.response_format = { type: 'json_object' };
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        // Detect if response came back from our own Express server
        if (
          response.status === 404 &&
          errText.includes('Cannot POST /v1/chat/completions')
        ) {
          return {
            success: false,
            authSchemeUsed: cfg.authScheme,
            statusCode: 404,
            error: `BIFROST_BASE_URL (${cfg.baseUrl}) routed back to the local Express server (HTTP 404 Cannot POST /v1/chat/completions). Configure an external Bifrost gateway URL; using direct Gemini fallback.`,
          };
        }

        return {
          success: false,
          authSchemeUsed: cfg.authScheme,
          statusCode: response.status,
          error: `Bifrost gateway returned HTTP ${response.status}${
            errText ? `: ${errText.slice(0, 180)}` : ''
          }`,
        };
      }

      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content;
      if (typeof content !== 'string' || !content.trim()) {
        return {
          success: false,
          authSchemeUsed: cfg.authScheme,
          error: 'Bifrost gateway returned an empty completion payload.',
        };
      }

      storageService.updateUsage((u) => ({
        ...u,
        bifrostRequestsCount: u.bifrostRequestsCount + 1,
      }));

      return {
        success: true,
        text: content.trim(),
        modelUsed: data?.model || cfg.model || 'bifrost-model',
        authSchemeUsed: cfg.authScheme,
        statusCode: 200,
      };
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.name === 'AbortError'
            ? `Bifrost gateway request timed out after ${Math.round(timeoutMs / 1000)}s.`
            : err.message
          : 'Failed to reach Bifrost gateway.';
      return {
        success: false,
        authSchemeUsed: cfg.authScheme,
        error: msg,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  public async testConnection(): Promise<{
    success: boolean;
    message: string;
    latencyMs?: number;
    endpoint?: string;
    authScheme?: string;
  }> {
    const cfg = this.getConfig();
    if (!cfg.isConfigured || !cfg.baseUrl) {
      return {
        success: false,
        message:
          'Bifrost not configured. Add BIFROST_BASE_URL (and optional BIFROST_API_KEY / BIFROST_MODEL) in the Google AI Studio Secrets panel.',
      };
    }

    const startMs = Date.now();
    const res = await this.generateCompletion({
      systemInstruction: 'Respond with a brief confirmation message.',
      userPrompt: 'Ping test from MeetWise AI.',
      jsonMode: false,
      timeoutMs: 10000,
    });
    const latencyMs = Date.now() - startMs;

    if (!res.success) {
      return {
        success: false,
        message: res.error || 'Unable to reach configured Bifrost gateway.',
        latencyMs,
        endpoint: cfg.baseUrl,
        authScheme: cfg.authScheme,
      };
    }

    return {
      success: true,
      message: `Connected to Bifrost gateway (${cfg.baseUrl}) via ${cfg.authScheme} auth in ${latencyMs}ms.`,
      latencyMs,
      endpoint: cfg.baseUrl,
      authScheme: cfg.authScheme,
    };
  }
}

export const bifrostService = new BifrostService();
