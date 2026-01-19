/**
 * Investment Journal Service
 * Manages saving and retrieving investment decisions to/from Walrus
 */

import { uploadToWalrus, getFromWalrus } from './walrusClient';
import { ProtocolAPR } from '../yield/types';
import { updateYieldStrategy } from '../db/yieldStrategyService';
import { logger } from '../../logger';

/**
 * Investment Decision structure
 * Stores the decision-making process and reasoning for investment choices
 */
export interface InvestmentDecision {
  taskId: string;
  timestamp: Date;
  selectedProtocol: string;
  availableProtocols: ProtocolAPR[];
  reasoning: string;
  aiModel?: string; // 'gpt-4o-mini' or 'heuristic'
  userAddress: string;
  amount: bigint;
  targetDate: Date;
}

/**
 * Serialize InvestmentDecision to JSON-compatible format
 * Handles BigInt and Date serialization
 */
function serializeDecision(decision: InvestmentDecision): unknown {
  return {
    taskId: decision.taskId,
    timestamp: decision.timestamp.toISOString(),
    selectedProtocol: decision.selectedProtocol,
    availableProtocols: decision.availableProtocols.map(apr => ({
      protocol: apr.protocol,
      token: apr.token,
      apr: apr.apr,
      tvl: apr.tvl.toString(), // Convert BigInt to string
      riskScore: apr.riskScore,
      timestamp: apr.timestamp.toISOString()
    })),
    reasoning: decision.reasoning,
    aiModel: decision.aiModel,
    userAddress: decision.userAddress,
    amount: decision.amount.toString(), // Convert BigInt to string
    targetDate: decision.targetDate.toISOString()
  };
}

/**
 * Deserialize JSON data to InvestmentDecision
 * Handles BigInt and Date deserialization
 */
function deserializeDecision(data: unknown): InvestmentDecision {
  const obj = data as {
    taskId: string;
    timestamp: string;
    selectedProtocol: string;
    availableProtocols: Array<{
      protocol: ProtocolAPR['protocol'];
      token: string;
      apr: number;
      tvl: string;
      riskScore: number;
      timestamp: string;
    }>;
    reasoning: string;
    aiModel?: string;
    userAddress: string;
    amount: string;
    targetDate: string;
  };

  return {
    taskId: obj.taskId,
    timestamp: new Date(obj.timestamp),
    selectedProtocol: obj.selectedProtocol,
    availableProtocols: obj.availableProtocols.map(apr => ({
      protocol: apr.protocol,
      token: apr.token,
      apr: apr.apr,
      tvl: BigInt(apr.tvl), // Convert string back to BigInt
      riskScore: apr.riskScore,
      timestamp: new Date(apr.timestamp)
    })),
    reasoning: obj.reasoning,
    aiModel: obj.aiModel,
    userAddress: obj.userAddress,
    amount: BigInt(obj.amount), // Convert string back to BigInt
    targetDate: new Date(obj.targetDate)
  };
}

/**
 * Save investment decision to Walrus
 * Optionally updates yield strategy in database with Walrus snapshot ID
 * @param decision - Investment decision to save
 * @param updateStrategyId - Optional yield strategy ID to update with walrusSnapshotId
 * @returns BlobId if successful, null if failed
 */
export async function saveInvestmentDecision(
  decision: InvestmentDecision,
  updateStrategyId?: string
): Promise<string | null> {
  try {
    const serialized = serializeDecision(decision);
    
    logger.info(`Saving investment decision to Walrus for task: ${decision.taskId}`);
    
    const blobId = await uploadToWalrus(serialized);
    
    if (!blobId) {
      logger.error(`Failed to save investment decision to Walrus for task: ${decision.taskId}`);
      return null;
    }
    
    // Update yield strategy in database if strategy ID provided
    if (updateStrategyId) {
      try {
        await updateYieldStrategy(updateStrategyId, {
          walrusSnapshotId: blobId
        });
        logger.info(`Updated yield strategy ${updateStrategyId} with Walrus snapshot ID: ${blobId}`);
      } catch (error) {
        logger.warn(`Failed to update yield strategy ${updateStrategyId} with Walrus snapshot ID: ${String(error)}`);
        // Don't fail the whole operation if DB update fails
      }
    }
    
    logger.info(`Saved investment decision to Walrus: ${blobId} for task: ${decision.taskId}`);
    return blobId;
    
  } catch (error) {
    logger.error(`Error saving investment decision: ${String(error)}`);
    return null;
  }
}

/**
 * Retrieve investment decision from Walrus
 * @param blobId - Blob ID from Walrus
 * @returns InvestmentDecision if successful, null if failed
 */
export async function getInvestmentDecision(blobId: string): Promise<InvestmentDecision | null> {
  try {
    logger.info(`Retrieving investment decision from Walrus: ${blobId}`);
    
    const data = await getFromWalrus(blobId);
    
    if (!data) {
      logger.error(`Failed to retrieve investment decision from Walrus: ${blobId}`);
      return null;
    }
    
    const decision = deserializeDecision(data);
    
    logger.info(`Retrieved investment decision from Walrus: ${blobId}`);
    return decision;
    
  } catch (error) {
    logger.error(`Error retrieving investment decision: ${String(error)}`);
    return null;
  }
}
