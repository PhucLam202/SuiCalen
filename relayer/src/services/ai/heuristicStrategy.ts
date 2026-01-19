import { ProtocolAPR } from '../yield/types';
import { SelectedProtocolDecision } from './types';

export interface HeuristicStrategyConfig {
  minTvl: bigint;
  minApr: number;
  assumedMaxApr: number;
}

export function defaultHeuristicConfig(): HeuristicStrategyConfig {
  return {
    minTvl: 100000n,
    minApr: 1.0,
    assumedMaxApr: 50.0,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function calculateWeightedScore(protocol: ProtocolAPR, config: HeuristicStrategyConfig): number {
  const aprWeight = 0.7;
  const riskWeight = 0.3;

  const normalizedApr = clamp(protocol.apr / config.assumedMaxApr, 0, 1) * 100;
  const normalizedRisk = clamp((10 - protocol.riskScore) / 10, 0, 1) * 100;

  return normalizedApr * aprWeight + normalizedRisk * riskWeight;
}

export function selectBestProtocol(
  aprs: ProtocolAPR[],
  config: HeuristicStrategyConfig = defaultHeuristicConfig()
): SelectedProtocolDecision {
  const valid = aprs.filter((p: ProtocolAPR) => p.tvl >= config.minTvl && p.apr >= config.minApr);

  if (valid.length === 0) {
    throw new Error('No valid protocols found (failed TVL/APR thresholds)');
  }

  const scored = valid
    .map((p: ProtocolAPR) => ({ protocol: p, score: calculateWeightedScore(p, config) }))
    .sort((a, b) => b.score - a.score);

  const best = scored[0];

  return {
    selectedProtocol: best.protocol.protocol,
    reasoning: [
      `Selected ${best.protocol.protocol} for token ${best.protocol.token}.`,
      `APR=${best.protocol.apr.toFixed(4)}%, TVL=${best.protocol.tvl.toString()}, riskScore=${best.protocol.riskScore.toFixed(2)}.`,
      `Heuristic score=${best.score.toFixed(2)} (APR weight 0.7, risk weight 0.3).`,
    ].join(' '),
    confidence: 0.7,
    model: 'heuristic',
    timestamp: new Date(),
  };
}
