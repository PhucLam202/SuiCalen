import { ProtocolAPR } from '../yield/types';

export type AIStrategyModel = 'gpt-5-nano' | 'heuristic';

export interface SelectedProtocolDecision {
  selectedProtocol: string;
  reasoning: string;
  confidence: number; // 0-1
  model: AIStrategyModel;
  timestamp: Date;
}

export interface ProtocolAPRInputForAI {
  protocol: ProtocolAPR['protocol'];
  token: string;
  apr: number;
  tvl: bigint;
  riskScore: number; // 0-10
}

export interface GetOptimalStrategyParams {
  taskId: string;
  token: string;
  userAddress: string;
  amount: bigint;
  targetDate: Date;
  targetAddress: string;
}

export interface OptimalStrategyResult {
  decision: SelectedProtocolDecision;
  considered: ProtocolAPR[];
  createdOrUpdatedStrategyId?: string;
  walrusSnapshotId?: string | null;
}
