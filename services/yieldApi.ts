/**
 * Frontend API client for Yield endpoints (Relayer API).
 * Uses Vite dev proxy: `/api` -> `http://localhost:3001`.
 */

export type YieldProtocol = 'scallop' | 'navi' | 'cetus' | 'suilend';

export interface YieldAprItemDto {
  protocol: YieldProtocol;
  token: string;
  apr: number;
  tvl: string; // bigint serialized as string
  riskScore: number;
  timestamp: string; // ISO string
}

export interface GetAllAprSuccessResponseDto {
  success: true;
  contractNetwork: 'mainnet' | 'testnet' | 'devnet';
  yieldNetwork: 'mainnet' | 'testnet' | 'devnet';
  data: YieldAprItemDto[];
  count: number;
  timestamp: string;
}

export interface GetAllAprErrorResponseDto {
  success: false;
  error: string;
  timestamp: string;
}

export type GetAllAprResponseDto = GetAllAprSuccessResponseDto | GetAllAprErrorResponseDto;

export class YieldApiError extends Error {
  public readonly status: number;
  public readonly bodyText: string;

  constructor(message: string, status: number, bodyText: string) {
    super(message);
    this.name = 'YieldApiError';
    this.status = status;
    this.bodyText = bodyText;
  }
}

async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new YieldApiError(`Request failed: ${res.status} ${res.statusText}`, res.status, text);
  }
  return (await res.json()) as T;
}

export async function getAllApr(): Promise<GetAllAprSuccessResponseDto> {
  const resp = await fetchJson<GetAllAprResponseDto>('/api/yield/apr/all', {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (!resp.success) {
    throw new Error(resp.error);
  }

  return resp;
}

export interface OptimizeYieldRequestDto {
  amountMist: string; // BigInt string
  token: string; // e.g. "SUI"
  targetDate: string; // ISO string
  maxRiskScore?: number; // 0-10
}

export interface OptimizeYieldRecommendationDto {
  protocol: YieldProtocol;
  apr: number;
  estimatedYieldMist: string; // BigInt string
  reasoning: string;
  confidence: number; // 0-1
  model: 'gpt-5-nano' | 'heuristic';
}

export interface OptimizeYieldSuccessResponseDto {
  success: true;
  contractNetwork: 'mainnet' | 'testnet' | 'devnet';
  yieldNetwork: 'mainnet' | 'testnet' | 'devnet';
  amountMist: string;
  token: string;
  targetDate: string;
  recommendation: OptimizeYieldRecommendationDto;
  considered: YieldAprItemDto[];
  timestamp: string;
}

export interface OptimizeYieldErrorResponseDto {
  success: false;
  error: string;
  timestamp: string;
}

export type OptimizeYieldResponseDto = OptimizeYieldSuccessResponseDto | OptimizeYieldErrorResponseDto;

export async function optimizeYield(req: OptimizeYieldRequestDto): Promise<OptimizeYieldSuccessResponseDto> {
  const resp = await fetchJson<OptimizeYieldResponseDto>('/api/yield/optimize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(req),
  });

  if (!resp.success) {
    throw new Error(resp.error);
  }

  return resp;
}
