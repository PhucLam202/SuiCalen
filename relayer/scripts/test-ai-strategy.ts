import dotenv from 'dotenv';
import { connectMongoDB, closeMongoDB } from '../src/db/mongoClient';
import { getOptimalStrategy } from '../src/services/ai/strategyOrchestrator';

dotenv.config();

function getEnvString(name: string, fallback: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    return fallback;
  }
  return value.trim();
}

function getEnvBigInt(name: string, fallback: bigint): bigint {
  const raw = process.env[name];
  if (!raw || raw.trim().length === 0) {
    return fallback;
  }
  try {
    return BigInt(raw.trim());
  } catch {
    return fallback;
  }
}

async function main(): Promise<void> {
  const token = getEnvString('TEST_TOKEN', 'USDC');
  const taskId = getEnvString('TEST_TASK_ID', `test-task-${Date.now()}`);
  const userAddress = getEnvString('TEST_USER_ADDRESS', `0x${'0'.repeat(64)}`);
  const targetAddress = getEnvString('TEST_TARGET_ADDRESS', `0x${'0'.repeat(64)}`);
  const amount = getEnvBigInt('TEST_AMOUNT', 1_000_000n);
  const targetDate = new Date(Date.now() + 60 * 60 * 1000);

  const mongoEnabled = Boolean(process.env.MONGODB_URI && process.env.MONGODB_URI.trim().length > 0);
  if (mongoEnabled) {
    await connectMongoDB();
  }

  const result = await getOptimalStrategy({
    taskId,
    token,
    userAddress,
    amount,
    targetDate,
    targetAddress,
  });

  console.log(JSON.stringify({
    decision: {
      ...result.decision,
      timestamp: result.decision.timestamp.toISOString(),
    },
    consideredCount: result.considered.length,
    strategyId: result.createdOrUpdatedStrategyId ?? null,
    walrusSnapshotId: result.walrusSnapshotId ?? null,
  }, null, 2));

  if (mongoEnabled) {
    await closeMongoDB();
  }
}

main().catch((error: unknown) => {
  console.error('test-ai-strategy failed:', error);
  process.exit(1);
});
