/**
 * End-to-end test for Phase 10.4 atomic PTB execution:
 * Withdraw (Navi/Suilend) -> optional Cetus swap -> Transfer to targetAddress.
 *
 * Usage:
 *   tsx relayer/scripts/test-yield-execution.ts <TASK_ID> [--dry-run]
 */
import dotenv from 'dotenv';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { fromB64 } from '@mysten/sui/utils';
import { connectMongoDB, closeMongoDB } from '../src/db/mongoClient';
import { getYieldStrategyByTaskId } from '../src/services/db/yieldStrategyService';
import { buildYieldWithdrawalTransaction, executeYieldWithdrawal } from '../src/services/execution/atomicYieldExecution';
import { logger } from '../src/logger';

dotenv.config();

type Network = 'mainnet' | 'testnet' | 'devnet';

function getEnvString(name: string): string | null {
  const value = process.env[name];
  if (!value || value.trim().length === 0) return null;
  return value.trim();
}

function getNetwork(): Network {
  const raw = (process.env.SUI_NETWORK || 'testnet').toLowerCase();
  if (raw === 'mainnet' || raw === 'testnet' || raw === 'devnet') return raw;
  return 'testnet';
}

function getRelayerAddressFromEnv(): string | null {
  const pk = getEnvString('RELAYER_PRIVATE_KEY');
  if (!pk) return null;
  const kp = Ed25519Keypair.fromSecretKey(fromB64(pk));
  return kp.getPublicKey().toSuiAddress();
}

function formatAmount(value: unknown): string {
  if (typeof value === 'bigint') return value.toString(10);
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (value === null || value === undefined) return String(value);
  return String(value);
}

async function main(): Promise<void> {
  const taskId = process.argv[2];
  const dryRun = process.argv.includes('--dry-run');
  if (!taskId) {
    logger.error('Usage: tsx relayer/scripts/test-yield-execution.ts <TASK_ID> [--dry-run]');
    process.exit(1);
  }

  const mongoUri = getEnvString('MONGODB_URI');
  if (!mongoUri) {
    logger.error('MONGODB_URI not set. This test script requires MongoDB to load a YieldStrategy by taskId.');
    process.exit(1);
  }

  const network = getNetwork();
  const rpcUrl = getEnvString('SUI_RPC_URL') ?? getFullnodeUrl(network);
  const client = new SuiClient({ url: rpcUrl });

  logger.info(`Running yield execution test`);
  logger.info(`  network=${network}`);
  logger.info(`  rpcUrl=${rpcUrl}`);
  logger.info(`  taskId=${taskId}`);
  logger.info(`  dryRun=${String(dryRun)}`);

  await connectMongoDB();
  try {
    const strategy = await getYieldStrategyByTaskId(taskId);
    if (!strategy) {
      logger.error(`Yield strategy not found for taskId: ${taskId}`);
      process.exit(1);
    }

    logger.info(
      `Loaded strategy: protocol=${strategy.selectedProtocol} amount=${formatAmount((strategy as unknown as Record<string, unknown>).amount)} target=${strategy.targetAddress}`
    );

    if (dryRun) {
      const senderFromKey = getRelayerAddressFromEnv();
      const senderFromEnv = getEnvString('DRY_RUN_SENDER_ADDRESS');
      const senderAddress = senderFromKey ?? senderFromEnv;
      if (!senderAddress) {
        logger.error(
          'Dry-run requires either RELAYER_PRIVATE_KEY (to derive sender) or DRY_RUN_SENDER_ADDRESS to be set.'
        );
        process.exit(1);
      }

      const built = await buildYieldWithdrawalTransaction(strategy, { client, network, senderAddress });
      built.tx.setSender(senderAddress);
      const txBytes = await built.tx.build({ client });

      const inspect = await client.devInspectTransactionBlock({
        transactionBlock: txBytes,
        sender: senderAddress,
      });

      logger.info(`Dev-inspect status: ${inspect.effects?.status.status}`);
      if (inspect.effects?.status.status !== 'success') {
        logger.warn(`Dev-inspect error: ${String(inspect.effects?.status.error)}`);
      }
      return;
    }

    const execResult = await executeYieldWithdrawal(strategy);
    logger.info(`Execution result: digest=${execResult.digest} status=${execResult.effectsStatus}`);

    const tx = await client.getTransactionBlock({
      digest: execResult.digest,
      options: { showEffects: true, showEvents: true, showObjectChanges: true, showBalanceChanges: true },
    });

    logger.info(`Transaction effects status: ${tx.effects?.status.status}`);
    if (tx.effects?.status.status !== 'success') {
      logger.warn(`Transaction error: ${String(tx.effects?.status.error)}`);
    }
  } finally {
    await closeMongoDB();
  }
}

main().catch((err: unknown) => {
  logger.error(`Fatal error: ${String(err)}`);
  process.exit(1);
});

