import { logger } from '../../logger';
import { connectMongoDB } from '../../db/mongoClient';
import { ProtocolAPR } from '../yield/types';
import { fetchAPRByToken } from '../yield/yieldAggregator';
import { Cache } from '../yield/cache';
import { analyzeAndSelectProtocol } from './strategyEngine';
import { calculateRiskScore, APRHistoryPoint } from './riskCalculator';
import { getAPRHistory } from '../db/aprSnapshotService';
import { createYieldStrategy, getYieldStrategyByTaskId, updateYieldStrategy } from '../db/yieldStrategyService';
import { snapshotFullWorkflow } from '../snapshot/snapshotOrchestrator';
import { GetOptimalStrategyParams, OptimalStrategyResult, SelectedProtocolDecision } from './types';

interface OrchestratorConfig {
  cacheTtlMs: number;
  riskHistoryLimit: number;
  yieldNetwork: 'mainnet' | 'testnet' | 'devnet';
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

function getYieldNetwork(): 'mainnet' | 'testnet' | 'devnet' {
  const raw = (process.env.YIELD_NETWORK || 'mainnet').toLowerCase();
  if (raw === 'mainnet' || raw === 'testnet' || raw === 'devnet') {
    return raw;
  }
  return 'mainnet';
}

function getOrchestratorConfig(): OrchestratorConfig {
  return {
    cacheTtlMs: getEnvInt('AI_STRATEGY_CACHE_TTL_MS', 3600000),
    riskHistoryLimit: getEnvInt('AI_RISK_HISTORY_LIMIT', 24),
    yieldNetwork: getYieldNetwork(),
  };
}

const strategyCache = new Cache<OptimalStrategyResult>(getOrchestratorConfig().cacheTtlMs);

function isMongoEnabled(): boolean {
  return Boolean(process.env.MONGODB_URI && process.env.MONGODB_URI.trim().length > 0);
}

function hasOpenAIKey(): boolean {
  return Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim().length > 0);
}

async function ensureMongoConnectedIfEnabled(): Promise<void> {
  if (!isMongoEnabled()) {
    return;
  }
  await connectMongoDB();
}

async function computeRiskScores(aprs: ProtocolAPR[], historyLimit: number): Promise<ProtocolAPR[]> {
  const withRisk: ProtocolAPR[] = [];

  for (const apr of aprs) {
    try {
      if (!isMongoEnabled()) {
        withRisk.push({ ...apr, riskScore: apr.riskScore ?? 5 });
        continue;
      }

      const historyDocs = await getAPRHistory(apr.protocol, apr.token, historyLimit);
      const history: APRHistoryPoint[] = historyDocs.map((h) => ({
        apr: h.apr,
        timestamp: h.timestamp,
        tvl: h.tvl,
      }));

      const risk = calculateRiskScore(apr, history);
      withRisk.push({ ...apr, riskScore: risk });
    } catch (error) {
      logger.warn(`Risk calculation failed for ${apr.protocol}/${apr.token}: ${String(error)}`);
      withRisk.push({ ...apr, riskScore: apr.riskScore ?? 5 });
    }
  }

  return withRisk;
}

async function decide(aprs: ProtocolAPR[]): Promise<SelectedProtocolDecision> {
  if (!hasOpenAIKey()) {
    throw new Error('OPENAI_API_KEY not set; AI strategy is required and fallback is disabled');
  }

  return analyzeAndSelectProtocol(aprs);
}

async function upsertStrategy(params: GetOptimalStrategyParams, decision: SelectedProtocolDecision, aprs: ProtocolAPR[]): Promise<{ strategyId?: string; walrusSnapshotId?: string | null }> {
  if (!isMongoEnabled()) {
    return {};
  }

  await ensureMongoConnectedIfEnabled();

  const selectedApr = aprs.find((p) => p.protocol === (decision.selectedProtocol as ProtocolAPR['protocol']));
  const aprAtSelection = selectedApr ? selectedApr.apr : 0;

  const existing = await getYieldStrategyByTaskId(params.taskId);
  if (existing && existing._id) {
    const existingId = String(existing._id);
    await updateYieldStrategy(existingId, {
      userAddress: params.userAddress,
      amount: params.amount,
      targetDate: params.targetDate,
      targetAddress: params.targetAddress,
      selectedProtocol: decision.selectedProtocol,
      aprAtSelection,
      currentProtocol: null,
    });

    // Snapshot + DB update of walrusSnapshotId is done via snapshotFullWorkflow.
    const refreshed = await getYieldStrategyByTaskId(params.taskId);
    if (!refreshed) {
      return { strategyId: existingId };
    }

    const blobId = await snapshotFullWorkflow(aprs, refreshed, decision.selectedProtocol, aprs, decision.reasoning, decision.model);
    return { strategyId: existingId, walrusSnapshotId: blobId };
  }

  const created = await createYieldStrategy({
    userAddress: params.userAddress,
    taskId: params.taskId,
    amount: params.amount,
    targetDate: params.targetDate,
    targetAddress: params.targetAddress,
    currentProtocol: null,
    selectedProtocol: decision.selectedProtocol,
    aprAtSelection,
    walrusSnapshotId: null,
  });

  const createdId = created._id ? String(created._id) : undefined;
  const blobId = await snapshotFullWorkflow(aprs, created, decision.selectedProtocol, aprs, decision.reasoning, decision.model);
  return { strategyId: createdId, walrusSnapshotId: blobId };
}

export async function getOptimalStrategy(params: GetOptimalStrategyParams): Promise<OptimalStrategyResult> {
  const config = getOrchestratorConfig();
  const cacheKey = `strategy:${params.taskId}:${params.token.toUpperCase()}:${config.yieldNetwork}`;
  const cached = strategyCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  // Fetch APRs for token (Phase 10.1)
  const aprsRaw = await fetchAPRByToken(params.token, config.yieldNetwork, {
    scallopConfig: {
      addressId: process.env.SCALLOP_ADDRESS_ID,
      rpcUrl: process.env.SUI_RPC_URL || (config.yieldNetwork === 'mainnet' ? 'https://sui-mainnet.nodeinfra.com' : undefined),
    },
    suilendConfig: {
      lendingMarketId: process.env.SUILEND_LENDING_MARKET_ID,
      lendingMarketType: process.env.SUILEND_LENDING_MARKET_TYPE,
    },
  });

  if (aprsRaw.length === 0) {
    throw new Error(`No APRs found for token: ${params.token}`);
  }

  // Compute risk scores (Phase 10.3.6)
  const aprs = await computeRiskScores(aprsRaw, config.riskHistoryLimit);

  // Decide (AI only; no fallback)
  const decision = await decide(aprs);

  // Persist (DB + Walrus) when enabled
  const persisted = await upsertStrategy(params, decision, aprs);

  const result: OptimalStrategyResult = {
    decision,
    considered: aprs,
    createdOrUpdatedStrategyId: persisted.strategyId,
    walrusSnapshotId: persisted.walrusSnapshotId,
  };

  strategyCache.set(cacheKey, result);
  return result;
}

export async function recalculateStrategy(params: GetOptimalStrategyParams): Promise<OptimalStrategyResult> {
  const config = getOrchestratorConfig();
  const cacheKey = `strategy:${params.taskId}:${params.token.toUpperCase()}:${config.yieldNetwork}`;
  strategyCache.delete(cacheKey);
  return getOptimalStrategy(params);
}
