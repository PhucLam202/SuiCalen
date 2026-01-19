import { ProtocolAPR } from '../yield/types';

export interface APRHistoryPoint {
  apr: number;
  timestamp: Date;
  tvl: bigint;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function calculateVolatility(history: APRHistoryPoint[]): number {
  if (history.length < 2) {
    return 0;
  }

  // Use absolute APR deltas between consecutive points.
  const sorted = [...history].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  const deltas: number[] = [];

  for (let i = 1; i < sorted.length; i += 1) {
    deltas.push(Math.abs(sorted[i].apr - sorted[i - 1].apr));
  }

  if (deltas.length === 0) {
    return 0;
  }

  const mean = deltas.reduce((sum, v) => sum + v, 0) / deltas.length;
  const variance =
    deltas.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / deltas.length;

  return Math.sqrt(variance);
}

/**
 * Calculate a 0-10 risk score based on volatility + TVL heuristics.
 * Lower is safer.
 */
export function calculateRiskScore(protocol: ProtocolAPR, history: APRHistoryPoint[]): number {
  const volatility = calculateVolatility(history);

  // Map volatility (in APR %-points) to a 0-8 range.
  // Rough calibration: 0 => 0, 1 => ~1.6, 3 => ~4.8, 5+ => 8.
  const volatilityComponent = clamp((volatility / 5) * 8, 0, 8);

  // TVL adjustment: higher TVL generally reduces risk (liquidity / stability).
  const tvl = protocol.tvl;
  let tvlAdjustment = 0;
  if (tvl < 100000n) {
    tvlAdjustment = 2;
  } else if (tvl < 1000000n) {
    tvlAdjustment = 1;
  } else if (tvl >= 10000000n) {
    tvlAdjustment = -2;
  } else if (tvl >= 1000000n) {
    tvlAdjustment = -1;
  }

  // Base risk starts at 2, then add components.
  const raw = 2 + volatilityComponent + tvlAdjustment;
  return clamp(raw, 0, 10);
}
