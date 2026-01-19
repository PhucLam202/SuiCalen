/**
 * Yield Strategy Service
 * CRUD operations for yield strategies stored in MongoDB
 */

import { ObjectId } from 'mongodb';
import { getCollection } from '../../db/mongoClient';
import { COLLECTIONS, YieldStrategyDocument, YieldStrategyInput } from '../../db/schemas';
import { logger } from '../../logger';

/**
 * Convert YieldStrategyInput to YieldStrategyDocument (for insertion)
 */
function inputToDocument(input: YieldStrategyInput): Omit<YieldStrategyDocument, '_id'> {
  const now = new Date();
  return {
    userAddress: input.userAddress,
    taskId: input.taskId,
    amount: input.amount.toString(), // Convert BigInt to string
    targetDate: input.targetDate,
    targetAddress: input.targetAddress,
    token: input.token ?? null,
    coinType: input.coinType ?? null,
    targetToken: input.targetToken ?? null,
    targetCoinType: input.targetCoinType ?? null,
    currentProtocol: input.currentProtocol ?? null,
    selectedProtocol: input.selectedProtocol,
    aprAtSelection: input.aprAtSelection,
    walrusSnapshotId: input.walrusSnapshotId ?? null,
    positionRef: input.positionRef ?? null,
    swapConfig: input.swapConfig ?? null,
    createdAt: now,
    updatedAt: now
  };
}

/**
 * Convert YieldStrategyDocument to return format (with BigInt conversion)
 */
function documentToStrategy(doc: YieldStrategyDocument): YieldStrategyDocument & { amount: bigint } {
  return {
    ...doc,
    amount: BigInt(doc.amount) // Convert string back to BigInt
  };
}

/**
 * Create a new yield strategy
 */
export async function createYieldStrategy(input: YieldStrategyInput): Promise<YieldStrategyDocument & { amount: bigint }> {
  try {
    const collection = getCollection<YieldStrategyDocument>(COLLECTIONS.YIELD_STRATEGIES);
    
    const document = inputToDocument(input);
    const result = await collection.insertOne(document as YieldStrategyDocument);
    
    if (!result.insertedId) {
      throw new Error('Failed to insert yield strategy');
    }
    
    const inserted = await collection.findOne({ _id: result.insertedId });
    
    if (!inserted) {
      throw new Error('Failed to retrieve inserted yield strategy');
    }
    
    logger.info(`Created yield strategy: ${result.insertedId} for task: ${input.taskId}`);
    
    return documentToStrategy(inserted);
  } catch (error) {
    logger.error(`Error creating yield strategy: ${String(error)}`);
    throw error;
  }
}

/**
 * Get yield strategy by task ID
 */
export async function getYieldStrategyByTaskId(taskId: string): Promise<(YieldStrategyDocument & { amount: bigint }) | null> {
  try {
    const collection = getCollection<YieldStrategyDocument>(COLLECTIONS.YIELD_STRATEGIES);
    const document = await collection.findOne({ taskId });
    
    if (!document) {
      return null;
    }
    
    return documentToStrategy(document);
  } catch (error) {
    logger.error(`Error getting yield strategy by taskId ${taskId}: ${String(error)}`);
    throw error;
  }
}

/**
 * Get all yield strategies for a user
 * Sorted by createdAt DESC (newest first)
 */
export async function getYieldStrategiesByUser(userAddress: string): Promise<(YieldStrategyDocument & { amount: bigint })[]> {
  try {
    const collection = getCollection<YieldStrategyDocument>(COLLECTIONS.YIELD_STRATEGIES);
    const documents = await collection.find({ userAddress })
      .sort({ createdAt: -1 })
      .toArray();
    
    return documents.map(doc => documentToStrategy(doc));
  } catch (error) {
    logger.error(`Error getting yield strategies for user ${userAddress}: ${String(error)}`);
    throw error;
  }
}

/**
 * Update yield strategy
 */
export async function updateYieldStrategy(
  id: string,
  updates: Partial<Omit<YieldStrategyInput, 'taskId'>> & { walrusSnapshotId?: string | null }
): Promise<void> {
  try {
    const collection = getCollection<YieldStrategyDocument>(COLLECTIONS.YIELD_STRATEGIES);
    
    const updateDoc: Partial<YieldStrategyDocument> = {
      updatedAt: new Date()
    };
    
    // Map updates to document format
    if (updates.amount !== undefined) {
      updateDoc.amount = updates.amount.toString();
    }
    if (updates.token !== undefined) {
      updateDoc.token = updates.token ?? null;
    }
    if (updates.coinType !== undefined) {
      updateDoc.coinType = updates.coinType ?? null;
    }
    if (updates.targetToken !== undefined) {
      updateDoc.targetToken = updates.targetToken ?? null;
    }
    if (updates.targetCoinType !== undefined) {
      updateDoc.targetCoinType = updates.targetCoinType ?? null;
    }
    if (updates.targetDate !== undefined) {
      updateDoc.targetDate = updates.targetDate;
    }
    if (updates.targetAddress !== undefined) {
      updateDoc.targetAddress = updates.targetAddress;
    }
    if (updates.currentProtocol !== undefined) {
      updateDoc.currentProtocol = updates.currentProtocol;
    }
    if (updates.selectedProtocol !== undefined) {
      updateDoc.selectedProtocol = updates.selectedProtocol;
    }
    if (updates.aprAtSelection !== undefined) {
      updateDoc.aprAtSelection = updates.aprAtSelection;
    }
    if (updates.walrusSnapshotId !== undefined) {
      updateDoc.walrusSnapshotId = updates.walrusSnapshotId;
    }
    if (updates.positionRef !== undefined) {
      updateDoc.positionRef = updates.positionRef ?? null;
    }
    if (updates.swapConfig !== undefined) {
      updateDoc.swapConfig = updates.swapConfig ?? null;
    }
    
    const result = await collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateDoc }
    );
    
    if (result.matchedCount === 0) {
      throw new Error(`Yield strategy not found: ${id}`);
    }
    
    logger.info(`Updated yield strategy: ${id}`);
  } catch (error) {
    logger.error(`Error updating yield strategy ${id}: ${String(error)}`);
    throw error;
  }
}

/**
 * Delete yield strategy
 */
export async function deleteYieldStrategy(id: string): Promise<void> {
  try {
    const collection = getCollection<YieldStrategyDocument>(COLLECTIONS.YIELD_STRATEGIES);
    
    const result = await collection.deleteOne({ _id: new ObjectId(id) });
    
    if (result.deletedCount === 0) {
      throw new Error(`Yield strategy not found: ${id}`);
    }
    
    logger.info(`Deleted yield strategy: ${id}`);
  } catch (error) {
    logger.error(`Error deleting yield strategy ${id}: ${String(error)}`);
    throw error;
  }
}
