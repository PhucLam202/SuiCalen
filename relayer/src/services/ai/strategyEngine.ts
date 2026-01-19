import OpenAI from 'openai';
import { logger } from '../../logger';
import { ProtocolAPR } from '../yield/types';
import { buildAIPrompts } from './prompts';
import { getOpenAIClient } from './openaiClient';
import { SlidingWindowRateLimiter } from './rateLimiter';
import { ProtocolAPRInputForAI, SelectedProtocolDecision } from './types';

interface AIEngineConfig {
  model: 'gpt-5-nano';
  maxRetries: number;
  timeoutMs: number;
  maxRequestsPerMinute: number;
}

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

function getEnvNumber(name: string, fallback: number): number {
  const raw = getEnvString(name);
  if (!raw) {
    return fallback;
  }
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getEnvModel(name: string, fallback: AIEngineConfig['model']): AIEngineConfig['model'] {
  const raw = getEnvString(name);
  if (!raw) {
    return fallback;
  }
  const normalized = raw.trim().toLowerCase();
  if (normalized === 'gpt-5-nano') {
    return normalized;
  }
  return fallback;
}

function getAIEngineConfig(): AIEngineConfig {
  return {
    model: getEnvModel('AI_MODEL', 'gpt-5-nano'),
    maxRetries: getEnvInt('OPENAI_MAX_RETRIES', 3),
    timeoutMs: getEnvInt('OPENAI_TIMEOUT_MS', 30000),
    maxRequestsPerMinute: getEnvInt('OPENAI_MAX_REQUESTS_PER_MIN', 10),
  };
}

const limiter = new SlidingWindowRateLimiter({
  maxRequests: getAIEngineConfig().maxRequestsPerMinute,
  windowMs: 60_000,
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseAndValidateDecisionJson(raw: string): { selectedProtocol: string; reasoning: string; confidence: number } {
  const parsed: unknown = JSON.parse(raw);
  if (!isRecord(parsed)) {
    throw new Error('AI response JSON is not an object');
  }

  const selectedProtocol = parsed.selectedProtocol;
  const reasoning = parsed.reasoning;
  const confidence = parsed.confidence;

  if (typeof selectedProtocol !== 'string' || selectedProtocol.trim().length === 0) {
    throw new Error('AI response missing/invalid selectedProtocol');
  }
  if (typeof reasoning !== 'string' || reasoning.trim().length === 0) {
    throw new Error('AI response missing/invalid reasoning');
  }

  const conf = typeof confidence === 'number' ? confidence : getEnvNumber('OPENAI_DEFAULT_CONFIDENCE', 0.8);
  if (!Number.isFinite(conf)) {
    throw new Error('AI response invalid confidence');
  }

  return {
    selectedProtocol: selectedProtocol.trim(),
    reasoning: reasoning.trim(),
    confidence: Math.max(0, Math.min(1, conf)),
  };
}

function toAIInput(aprs: ProtocolAPR[]): ProtocolAPRInputForAI[] {
  return aprs.map((p: ProtocolAPR) => ({
    protocol: p.protocol,
    token: p.token,
    apr: p.apr,
    tvl: p.tvl,
    riskScore: p.riskScore,
  }));
}

async function callOpenAIOnce(aprs: ProtocolAPR[]): Promise<SelectedProtocolDecision> {
  const config = getAIEngineConfig();
  const openai = getOpenAIClient();

  const prompts = buildAIPrompts(toAIInput(aprs));

  await limiter.acquire();

  logger.info(`Calling OpenAI with model: ${config.model}`);

  const response = await openai.chat.completions.create(
    {
      model: config.model,
      messages: [
        { role: 'system', content: prompts.system },
        { role: 'user', content: prompts.user },
      ],
      response_format: { type: 'json_object' },
    },
    { timeout: config.timeoutMs }
  );

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('OpenAI returned empty message content');
  }

  const parsed = parseAndValidateDecisionJson(content);

  // Validate that selectedProtocol matches one of the input protocols.
  const allowed = aprs.map((p: ProtocolAPR) => p.protocol);
  const normalized = parsed.selectedProtocol.toLowerCase();
  const matched = allowed.find((p: ProtocolAPR['protocol']) => p.toLowerCase() === normalized);
  if (!matched) {
    throw new Error(`AI selectedProtocol not in input: ${parsed.selectedProtocol}`);
  }

  return {
    selectedProtocol: matched,
    reasoning: parsed.reasoning,
    confidence: parsed.confidence,
    model: config.model,
    timestamp: new Date(),
  };
}

function isRetryableOpenAIError(error: unknown): boolean {
  if (error instanceof OpenAI.APIError) {
    // Retry on 429/5xx; not on 4xx (except 429).
    if (error.status === 429) {
      return true;
    }
    if (typeof error.status === 'number' && error.status >= 500) {
      return true;
    }
    return false;
  }

  const message = String(error).toLowerCase();
  return message.includes('timeout') || message.includes('connection') || message.includes('econnreset');
}

function isUnsupportedResponseFormatError(error: unknown): boolean {
  if (error instanceof OpenAI.APIError && error.status === 400) {
    const message = String(error.message).toLowerCase();
    return message.includes('response_format') || message.includes('json_object');
  }
  return false;
}

export async function analyzeAndSelectProtocol(aprs: ProtocolAPR[]): Promise<SelectedProtocolDecision> {
  const config = getAIEngineConfig();

  if (aprs.length === 0) {
    throw new Error('No APR data provided to strategy engine');
  }

  let lastError: unknown = null;
  let allowResponseFormat = true;

  for (let attempt = 0; attempt < config.maxRetries; attempt += 1) {
    try {
      if (allowResponseFormat) {
        return await callOpenAIOnce(aprs);
      }

      // Retry with stricter prompt-only JSON (no response_format) if model rejects response_format.
      const openai = getOpenAIClient();
      const prompts = buildAIPrompts(toAIInput(aprs));
      await limiter.acquire();
      logger.info(`Calling OpenAI with model: ${config.model} (response_format disabled)`);

      const response = await openai.chat.completions.create(
        {
          model: config.model,
          messages: [
            {
              role: 'system',
              content: `${prompts.system}\n\nIMPORTANT: Return ONLY a valid JSON object. Do not wrap it in markdown.`,
            },
            { role: 'user', content: prompts.user },
          ],
          // no response_format
        },
        { timeout: config.timeoutMs }
      );

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('OpenAI returned empty message content');
      }

      const parsed = parseAndValidateDecisionJson(content);
      const allowed = aprs.map((p: ProtocolAPR) => p.protocol);
      const normalized = parsed.selectedProtocol.toLowerCase();
      const matched = allowed.find((p: ProtocolAPR['protocol']) => p.toLowerCase() === normalized);
      if (!matched) {
        throw new Error(`AI selectedProtocol not in input: ${parsed.selectedProtocol}`);
      }

      return {
        selectedProtocol: matched,
        reasoning: parsed.reasoning,
        confidence: parsed.confidence,
        model: config.model,
        timestamp: new Date(),
      };
    } catch (error) {
      lastError = error;

      if (isUnsupportedResponseFormatError(error)) {
        allowResponseFormat = false;
      }

      const retryable = isRetryableOpenAIError(error);
      const isLast = attempt === config.maxRetries - 1;

      logger.warn(`AI strategy attempt ${attempt + 1}/${config.maxRetries} failed (retryable=${retryable}): ${String(error)}`);

      if (!retryable || isLast) {
        throw error;
      }

      const delayMs = 1000 * Math.pow(2, attempt);
      await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError ?? new Error('AI strategy failed');
}
