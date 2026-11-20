import { GoogleGenAI, Schema } from '@google/genai';
import { bifrostService } from './bifrostService.ts';
import { storageService } from './storageService.ts';

const DEFAULT_GEMINI_MODEL = 'gemini-4-hydrogen';

export interface ModelGenerationResult {
  text: string;
  gatewayUsed: 'bifrost' | 'gemini-direct';
  modelName: string;
  bifrostFallbackReason?: string;
}

class GeminiService {
  private getClient(): GoogleGenAI {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      throw new Error(
        'GEMINI_API_KEY is not configured. Check your API key in the Google AI Studio Settings > Secrets panel.'
      );
    }
    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }

  public getStatus() {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    const isConfigured = Boolean(apiKey && apiKey !== 'MY_GEMINI_API_KEY');
    return {
      configured: isConfigured,
      status: isConfigured ? ('connected' as const) : ('missing_key' as const),
      model: DEFAULT_GEMINI_MODEL,
      message: isConfigured
        ? `Server-side Gemini reasoning engine ready (${DEFAULT_GEMINI_MODEL}).`
        : 'GEMINI_API_KEY is not configured in the server environment.',
    };
  }

  /**
   * Direct Gemini text generation (used for connectivity testing and direct verification).
   */
  public async generateTextDirect(prompt: string, systemInstruction?: string): Promise<{
    text: string;
    modelName: string;
  }> {
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      throw new Error('Prompt cannot be empty.');
    }

    const ai = this.getClient();
    const response = await ai.models.generateContent({
      model: DEFAULT_GEMINI_MODEL,
      contents: prompt.trim(),
      config: systemInstruction
        ? { systemInstruction: systemInstruction.trim() }
        : undefined,
    });

    storageService.updateUsage((u) => ({
      ...u,
      geminiDirectRequestsCount: u.geminiDirectRequestsCount + 1,
    }));

    const text = (response.text ?? '').trim();
    if (!text) {
      throw new Error('Gemini returned an empty text response.');
    }

    return {
      text,
      modelName: DEFAULT_GEMINI_MODEL,
    };
  }

  public async testConnection(): Promise<{
    success: boolean;
    message: string;
    latencyMs?: number;
    model?: string;
  }> {
    const startMs = Date.now();
    try {
      const res = await this.generateTextDirect(
        'Reply with the exact phrase: MeetWise Gemini Ready',
        'You are a connectivity diagnostic assistant.'
      );
      const latencyMs = Date.now() - startMs;
      return {
        success: true,
        message: `Direct Gemini API verified (${res.modelName} responded in ${latencyMs}ms).`,
        latencyMs,
        model: res.modelName,
      };
    } catch (err: unknown) {
      const latencyMs = Date.now() - startMs;
      return {
        success: false,
        message:
          err instanceof Error
            ? err.message
            : 'Failed to connect to server-side Gemini API.',
        latencyMs,
        model: DEFAULT_GEMINI_MODEL,
      };
    }
  }

  /**
   * Routes model request through Bifrost if configured and reachable;
   * otherwise uses native Google AI Studio server-side Gemini SDK.
   */
  public async generateStructuredJson(params: {
    systemInstruction: string;
    userPrompt: string;
    responseSchema: Schema;
  }): Promise<ModelGenerationResult> {
    if (!params.userPrompt || typeof params.userPrompt !== 'string' || !params.userPrompt.trim()) {
      throw new Error('User prompt for structured generation cannot be empty.');
    }

    let bifrostFallbackReason: string | undefined;

    // 1. Check if Bifrost is configured
    const bifrostCfg = bifrostService.getConfig();
    if (bifrostCfg.isConfigured) {
      const bifrostRes = await bifrostService.generateCompletion({
        systemInstruction:
          params.systemInstruction +
          '\n\nCRITICAL: Return ONLY valid JSON matching the requested structure without markdown code fences.',
        userPrompt: params.userPrompt,
        jsonMode: true,
      });

      if (bifrostRes.success && bifrostRes.text) {
        const cleaned = bifrostRes.text
          .replace(/^```json\s*/i, '')
          .replace(/^```\s*/i, '')
          .replace(/```\s*$/i, '')
          .trim();
        return {
          text: cleaned,
          gatewayUsed: 'bifrost',
          modelName: bifrostRes.modelUsed || bifrostCfg.model || 'bifrost-gateway',
        };
      } else {
        bifrostFallbackReason = bifrostRes.error || 'Bifrost request failed; fell back to Gemini.';
      }
    }

    // 2. Direct server-side Gemini fallback
    const ai = this.getClient();
    const response = await ai.models.generateContent({
      model: DEFAULT_GEMINI_MODEL,
      contents: params.userPrompt,
      config: {
        systemInstruction: params.systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: params.responseSchema,
      },
    });

    storageService.updateUsage((u) => ({
      ...u,
      geminiDirectRequestsCount: u.geminiDirectRequestsCount + 1,
    }));

    const text = (response.text ?? '{}').trim();
    return {
      text,
      gatewayUsed: 'gemini-direct',
      modelName: DEFAULT_GEMINI_MODEL,
      bifrostFallbackReason,
    };
  }
}

export const geminiService = new GeminiService();
