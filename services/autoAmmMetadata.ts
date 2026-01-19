import type { YieldProtocol } from './yieldApi';

export type AutoAmmToken = 'SUI';

export interface AutoAmmStrategyChoice {
  protocol: YieldProtocol;
  apr: number;
}

export interface AutoAmmMetadataV1 {
  version: 1;
  description: string;
  autoAmm: true;
  token: AutoAmmToken;
  amountMist: string; // BigInt string
  targetDate: string; // ISO string
  recommendation: AutoAmmStrategyChoice;
  /**
   * Optional: store extra context for UI.
   */
  reasoning?: string;
  consideredTop?: Array<{
    protocol: YieldProtocol;
    apr: number;
    riskScore: number;
    tvl: string; // bigint string
  }>;
}

export type AutoAmmMetadata = AutoAmmMetadataV1;

export interface FormattedTaskMetadata {
  title: string;
  badge?: {
    label: string;
    protocol: YieldProtocol;
    apr: number;
  };
  warning?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isYieldProtocol(value: unknown): value is YieldProtocol {
  return value === 'scallop' || value === 'navi' || value === 'cetus' || value === 'suilend';
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isConsideredTop(value: unknown): value is AutoAmmMetadataV1['consideredTop'] {
  if (!Array.isArray(value)) return false;
  return value.every((item: unknown) => {
    if (!isRecord(item)) return false;
    return (
      isYieldProtocol(item.protocol) &&
      isFiniteNumber(item.apr) &&
      isFiniteNumber(item.riskScore) &&
      isString(item.tvl)
    );
  });
}

export function parseAutoAmmMetadata(text: string): AutoAmmMetadata | null {
  const trimmed = text.trim();
  if (trimmed.length === 0) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed) as unknown;
  } catch {
    return null;
  }

  if (!isRecord(parsed)) return null;
  if (parsed.autoAmm !== true) return null;

  const version = parsed.version;
  if (version !== 1) return null;

  if (!isString(parsed.description)) return null;
  if (parsed.token !== 'SUI') return null;
  if (!isString(parsed.amountMist)) return null;
  if (!isString(parsed.targetDate)) return null;

  const rec = parsed.recommendation;
  if (!isRecord(rec)) return null;
  if (!isYieldProtocol(rec.protocol)) return null;
  if (!isFiniteNumber(rec.apr)) return null;

  const reasoning = parsed.reasoning;
  if (reasoning !== undefined && !isString(reasoning)) return null;

  const consideredTop = parsed.consideredTop;
  if (consideredTop !== undefined && !isConsideredTop(consideredTop)) return null;

  return {
    version: 1,
    description: parsed.description,
    autoAmm: true,
    token: 'SUI',
    amountMist: parsed.amountMist,
    targetDate: parsed.targetDate,
    recommendation: {
      protocol: rec.protocol,
      apr: rec.apr,
    },
    reasoning: reasoning,
    consideredTop: consideredTop,
  };
}

export function formatTaskMetadata(metadataText: string): FormattedTaskMetadata {
  const parsed = parseAutoAmmMetadata(metadataText);
  if (!parsed) {
    const fallback = metadataText.trim().length > 0 ? metadataText : 'Payment';
    return { title: fallback };
  }

  const title = parsed.description.trim().length > 0 ? parsed.description : 'Payment';

  return {
    title,
    badge: {
      label: 'AutoAMM',
      protocol: parsed.recommendation.protocol,
      apr: parsed.recommendation.apr,
    },
  };
}

