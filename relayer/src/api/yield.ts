/**
 * Yield API endpoints
 * GET /api/yield/apr/all - Get all APR data
 * GET /api/yield/apr/:token - Get APR by token
 */

import { Request, Response } from 'express';
import { fetchAllAPRs, fetchAPRByToken } from '../services/yield/yieldAggregator';
import { logger } from '../logger';
import { analyzeAndSelectProtocol } from '../services/ai/strategyEngine';
import { selectBestProtocol } from '../services/ai/heuristicStrategy';
import type { AIStrategyModel } from '../services/ai/types';
import type { ProtocolAPR } from '../services/yield/types';
import dotenv from 'dotenv';

dotenv.config();

// Separate network configurations:
// - CONTRACT_NETWORK: For Sui contract operations (testnet for testing, mainnet for production)
// - YIELD_NETWORK: For APR data fetching (mainnet recommended for real APR data)
const CONTRACT_NETWORK = (process.env.SUI_NETWORK || 'testnet') as 'mainnet' | 'testnet' | 'devnet';
const YIELD_NETWORK = (process.env.YIELD_NETWORK || 'mainnet') as 'mainnet' | 'testnet' | 'devnet';

export interface OptimizeYieldRequestDto {
  amountMist: string;
  token: string;
  targetDate: string; // ISO string
  maxRiskScore?: number; // 0-10
}

export interface OptimizeYieldRecommendationDto {
  protocol: ProtocolAPR['protocol'];
  apr: number;
  estimatedYieldMist: string;
  reasoning: string;
  confidence: number; // 0-1
  model: AIStrategyModel;
}

export interface OptimizeYieldResponseDto {
  success: true;
  contractNetwork: 'mainnet' | 'testnet' | 'devnet';
  yieldNetwork: 'mainnet' | 'testnet' | 'devnet';
  amountMist: string;
  token: string;
  targetDate: string;
  recommendation: OptimizeYieldRecommendationDto;
  considered: Array<{
    protocol: ProtocolAPR['protocol'];
    token: string;
    apr: number;
    tvl: string;
    riskScore: number;
    timestamp: string;
  }>;
  timestamp: string;
}

export interface OptimizeYieldErrorResponseDto {
  success: false;
  error: string;
  timestamp: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseOptimizeYieldRequest(body: unknown): OptimizeYieldRequestDto {
  if (!isRecord(body)) {
    throw new Error('Request body must be an object');
  }

  const amountMist = body.amountMist;
  const token = body.token;
  const targetDate = body.targetDate;
  const maxRiskScore = body.maxRiskScore;

  if (typeof amountMist !== 'string' || amountMist.trim().length === 0) {
    throw new Error('amountMist is required (string BigInt)');
  }
  // Validate BigInt parsing without leaking details.
  try {
    const parsed = BigInt(amountMist);
    if (parsed <= 0n) {
      throw new Error('amountMist must be > 0');
    }
  } catch {
    throw new Error('amountMist must be a valid BigInt string');
  }

  if (typeof token !== 'string' || token.trim().length === 0) {
    throw new Error('token is required');
  }

  if (typeof targetDate !== 'string' || targetDate.trim().length === 0) {
    throw new Error('targetDate is required (ISO string)');
  }
  const parsedDate = new Date(targetDate);
  if (Number.isNaN(parsedDate.getTime())) {
    throw new Error('targetDate must be a valid ISO date string');
  }

  let maxRiskScoreNum: number | undefined;
  if (maxRiskScore !== undefined) {
    if (typeof maxRiskScore !== 'number' || !Number.isFinite(maxRiskScore)) {
      throw new Error('maxRiskScore must be a finite number');
    }
    maxRiskScoreNum = Math.max(0, Math.min(10, maxRiskScore));
  }

  return {
    amountMist: amountMist.trim(),
    token: token.trim(),
    targetDate: parsedDate.toISOString(),
    maxRiskScore: maxRiskScoreNum,
  };
}

function hasOpenAIKey(): boolean {
  const raw = process.env.OPENAI_API_KEY;
  return Boolean(raw && raw.trim().length > 0);
}

function pickWithScallopPreference(
  aprs: ProtocolAPR[],
  decisionProtocol: ProtocolAPR['protocol'],
  minScallopTvl: bigint
): ProtocolAPR['protocol'] {
  const best = aprs.find((p) => p.protocol === decisionProtocol);
  const scallop = aprs.find((p) => p.protocol === 'scallop');
  if (!best || !scallop) {
    return decisionProtocol;
  }

  // Only prefer Scallop for "liquidity" if Scallop TVL looks sane.
  if (scallop.tvl < minScallopTvl) {
    return decisionProtocol;
  }

  // If APR difference < 1%, prefer Scallop.
  const diff = Math.abs(best.apr - scallop.apr);
  if (diff < 1.0) {
    return 'scallop';
  }

  return decisionProtocol;
}

function estimateYieldMist(amountMist: bigint, aprPercent: number, targetDateIso: string): bigint {
  const targetMs = new Date(targetDateIso).getTime();
  const nowMs = Date.now();
  const durationMsNum = Math.max(0, targetMs - nowMs);

  // BigInt fixed-point: aprScaled = aprPercent * 1e6
  const aprScale = 1_000_000;
  const aprScaled = BigInt(Math.round(aprPercent * aprScale));
  const durationMs = BigInt(durationMsNum);
  const yearMs = BigInt(365 * 24 * 60 * 60 * 1000);

  // yield = amount * (apr/100) * (duration/year)
  // => amount * aprScaled * duration / (100 * aprScale * year)
  const denom = 100n * BigInt(aprScale) * yearMs;
  if (denom === 0n) {
    return 0n;
  }
  return (amountMist * aprScaled * durationMs) / denom;
}

/**
 * Get all APR data from all protocols
 * GET /api/yield/apr/all
 */
export async function getAllAPRsHandler(req: Request, res: Response): Promise<void> {
  try {
    logger.info(`GET /api/yield/apr/all requested (Contract Network: ${CONTRACT_NETWORK}, Yield Network: ${YIELD_NETWORK})`);

    const aprs = await fetchAllAPRs(YIELD_NETWORK, {
      scallopConfig: {
        addressId: process.env.SCALLOP_ADDRESS_ID,
        rpcUrl: process.env.SUI_RPC_URL || (YIELD_NETWORK === 'mainnet' ? 'https://sui-mainnet.nodeinfra.com' : undefined)
      },
      suilendConfig: {
        lendingMarketId: process.env.SUILEND_LENDING_MARKET_ID,
        lendingMarketType: process.env.SUILEND_LENDING_MARKET_TYPE
      }
    });

    // Convert BigInt to string for JSON serialization
    const serializedAPRs = aprs.map(apr => ({
      ...apr,
      tvl: apr.tvl.toString(),
      timestamp: apr.timestamp.toISOString()
    }));

    res.status(200).json({
      success: true,
      contractNetwork: CONTRACT_NETWORK,
      yieldNetwork: YIELD_NETWORK,
      data: serializedAPRs,
      count: serializedAPRs.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Error fetching all APRs: ${String(error)}`);
    res.status(500).json({
      success: false,
      error: String(error),
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Get APR data filtered by token
 * GET /api/yield/apr/:token
 */
export async function getAPRByTokenHandler(req: Request, res: Response): Promise<void> {
  try {
    const token = req.params.token as string;

    if (!token) {
      res.status(400).json({
        success: false,
        error: 'Token parameter is required',
        timestamp: new Date().toISOString()
      });
      return;
    }

    logger.info(`GET /api/yield/apr/${token} requested (Contract Network: ${CONTRACT_NETWORK}, Yield Network: ${YIELD_NETWORK})`);

    const aprs = await fetchAPRByToken(token, YIELD_NETWORK, {
      scallopConfig: {
        addressId: process.env.SCALLOP_ADDRESS_ID,
        rpcUrl: process.env.SUI_RPC_URL || (YIELD_NETWORK === 'mainnet' ? 'https://sui-mainnet.nodeinfra.com' : undefined)
      },
      suilendConfig: {
        lendingMarketId: process.env.SUILEND_LENDING_MARKET_ID,
        lendingMarketType: process.env.SUILEND_LENDING_MARKET_TYPE
      }
    });

    // Convert BigInt to string for JSON serialization
    const serializedAPRs = aprs.map(apr => ({
      ...apr,
      tvl: apr.tvl.toString(),
      timestamp: apr.timestamp.toISOString()
    }));

    res.status(200).json({
      success: true,
      contractNetwork: CONTRACT_NETWORK,
      yieldNetwork: YIELD_NETWORK,
      token: token.toUpperCase(),
      data: serializedAPRs,
      count: serializedAPRs.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Error fetching APR for token ${req.params.token}: ${String(error)}`);
    res.status(500).json({
      success: false,
      error: String(error),
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Optimize yield strategy for a given amount/token/targetDate
 * POST /api/yield/optimize
 */
export async function optimizeYieldHandler(req: Request, res: Response): Promise<void> {
  try {
    const parsed = parseOptimizeYieldRequest(req.body as unknown);
    const tokenUpper = parsed.token.toUpperCase();

    logger.info(`POST /api/yield/optimize requested for token=${tokenUpper} (Yield Network: ${YIELD_NETWORK})`);

    const aprsRaw = await fetchAPRByToken(tokenUpper, YIELD_NETWORK, {
      scallopConfig: {
        addressId: process.env.SCALLOP_ADDRESS_ID,
        rpcUrl: process.env.SUI_RPC_URL || (YIELD_NETWORK === 'mainnet' ? 'https://sui-mainnet.nodeinfra.com' : undefined),
      },
      suilendConfig: {
        lendingMarketId: process.env.SUILEND_LENDING_MARKET_ID,
        lendingMarketType: process.env.SUILEND_LENDING_MARKET_TYPE,
      },
    });

    if (aprsRaw.length === 0) {
      res.status(404).json({
        success: false,
        error: `No APR data found for token ${tokenUpper}`,
        timestamp: new Date().toISOString(),
      } satisfies OptimizeYieldErrorResponseDto);
      return;
    }

    const maxRisk = parsed.maxRiskScore ?? 6.999;
    const considered = aprsRaw.filter((p) => p.riskScore < maxRisk);
    const aprsForDecision = considered.length > 0 ? considered : aprsRaw;

    // Decide: AI when available, otherwise heuristic fallback.
    let decision: { selectedProtocol: ProtocolAPR['protocol']; reasoning: string; confidence: number; model: AIStrategyModel };
    if (hasOpenAIKey()) {
      const ai = await analyzeAndSelectProtocol(aprsForDecision);
      decision = {
        selectedProtocol: ai.selectedProtocol as ProtocolAPR['protocol'],
        reasoning: ai.reasoning,
        confidence: ai.confidence,
        model: ai.model,
      };
    } else {
      const h = selectBestProtocol(aprsForDecision);
      decision = {
        selectedProtocol: h.selectedProtocol as ProtocolAPR['protocol'],
        reasoning: h.reasoning,
        confidence: h.confidence,
        model: h.model,
      };
    }

    const preferredProtocol = pickWithScallopPreference(aprsForDecision, decision.selectedProtocol, 100_000n);
    const selectedApr = aprsForDecision.find((p) => p.protocol === preferredProtocol) ?? aprsForDecision[0];
    const amountMist = BigInt(parsed.amountMist);
    const estimatedYield = estimateYieldMist(amountMist, selectedApr.apr, parsed.targetDate);

    const response: OptimizeYieldResponseDto = {
      success: true,
      contractNetwork: CONTRACT_NETWORK,
      yieldNetwork: YIELD_NETWORK,
      amountMist: parsed.amountMist,
      token: tokenUpper,
      targetDate: parsed.targetDate,
      recommendation: {
        protocol: preferredProtocol,
        apr: selectedApr.apr,
        estimatedYieldMist: estimatedYield.toString(),
        reasoning:
          preferredProtocol === decision.selectedProtocol
            ? decision.reasoning
            : `${decision.reasoning} Prefer Scallop due to <1% APR difference.`,
        confidence: decision.confidence,
        model: decision.model,
      },
      considered: aprsForDecision.map((p) => ({
        protocol: p.protocol,
        token: p.token,
        apr: p.apr,
        tvl: p.tvl.toString(),
        riskScore: p.riskScore,
        timestamp: p.timestamp.toISOString(),
      })),
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  } catch (error) {
    logger.error(`Error optimizing yield: ${String(error)}`);
    res.status(400).json({
      success: false,
      error: String(error),
      timestamp: new Date().toISOString(),
    } satisfies OptimizeYieldErrorResponseDto);
  }
}
