import OpenAI from 'openai';

export interface OpenAIClientConfig {
  apiKey: string;
  timeoutMs: number;
}

let cachedClient: OpenAI | null = null;

function getEnvString(name: string): string | null {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    return null;
  }
  return value.trim();
}

function getEnvInt(name: string, fallback: number): number {
  const raw = getEnvString(name);
  if (!raw) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getOpenAIClientConfig(): OpenAIClientConfig {
  const apiKey = getEnvString('OPENAI_API_KEY');
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }

  const timeoutMs = getEnvInt('OPENAI_TIMEOUT_MS', 30000);

  return { apiKey, timeoutMs };
}

export function getOpenAIClient(): OpenAI {
  if (cachedClient) {
    return cachedClient;
  }

  const config = getOpenAIClientConfig();
  cachedClient = new OpenAI({
    apiKey: config.apiKey,
    timeout: config.timeoutMs,
  });

  return cachedClient;
}
