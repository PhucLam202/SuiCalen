import { RELAYER_CONFIG } from '../config';
import { logger } from '../logger';
import { MetricsCollector } from '../monitoring/MetricsCollector';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { fromB64 } from '@mysten/sui/utils';
import type { SuiObjectResponse, SuiEvent } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { YieldExecutor, type YieldProtocol } from '../services/yield/yieldExecutor';

export class OptimisticExecutor {
  private metrics: MetricsCollector;
  private running: boolean;
  private client: SuiClient | null;
  private keypair: Ed25519Keypair | null;
  private packageId: string | null;
  private registryId: string | null;

  constructor(metrics: MetricsCollector) {
    this.metrics = metrics;
    this.running = false;
    this.client = null;
    this.keypair = null;
    this.packageId = null;
    this.registryId = null;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.initialize();
    this.loop();
  }

  stop(): void {
    this.running = false;
  }

  private initialize(): void {
    const packageId = process.env.VITE_AUTOPAY_PACKAGE_ID?.trim();
    const registryId = process.env.VITE_REGISTRY_ID?.trim();
    const relayerPrivateKey = process.env.RELAYER_PRIVATE_KEY?.trim();

    if (!packageId || !registryId) {
      logger.warn('Executor disabled: VITE_AUTOPAY_PACKAGE_ID/VITE_REGISTRY_ID not set');
      return;
    }

    this.packageId = packageId;
    this.registryId = registryId;

    const networkRaw = (process.env.SUI_NETWORK || 'testnet').toLowerCase();
    const network: 'mainnet' | 'testnet' | 'devnet' =
      networkRaw === 'mainnet' || networkRaw === 'testnet' || networkRaw === 'devnet' ? networkRaw : 'testnet';
    const rpcUrl = process.env.SUI_RPC_URL?.trim() || getFullnodeUrl(network);
    this.client = new SuiClient({ url: rpcUrl });

    if (!relayerPrivateKey) {
      logger.warn('Executor running in read-only mode: RELAYER_PRIVATE_KEY not set');
      return;
    }

    try {
      this.keypair = Ed25519Keypair.fromSecretKey(fromB64(relayerPrivateKey));
    } catch (e: unknown) {
      logger.error(`Executor failed to load RELAYER_PRIVATE_KEY: ${String(e)}`);
      this.keypair = null;
    }
  }

  private async loop(): Promise<void> {
    while (this.running) {
      try {
        await this.scanAndExecute();
      } catch (err) {
        logger.error(`Executor loop error: ${String(err)}`);
      }
      await new Promise((r) => setTimeout(r, RELAYER_CONFIG.scanInterval));
    }
  }

  private parseTaskIdFromEvent(event: SuiEvent): string | null {
    const parsed: unknown = event.parsedJson;
    if (typeof parsed !== 'object' || parsed === null) {
      return null;
    }
    const record = parsed as Record<string, unknown>;
    const taskId = record.task_id;
    return typeof taskId === 'string' && taskId.startsWith('0x') ? taskId : null;
  }

  private decodeMetadata(raw: unknown): string | null {
    if (typeof raw === 'string') {
      return raw;
    }
    if (Array.isArray(raw) && raw.every((x: unknown) => typeof x === 'number')) {
      const bytes = Uint8Array.from(raw);
      try {
        return new TextDecoder().decode(bytes);
      } catch {
        return null;
      }
    }
    if (typeof raw === 'object' && raw !== null) {
      const record = raw as Record<string, unknown>;
      const maybe = record.bytes;
      if (typeof maybe === 'string') {
        return maybe;
      }
    }
    return null;
  }

  private parseAutoAmmProtocol(metadataText: string | null): YieldProtocol | null {
    if (!metadataText) return null;
    try {
      const parsed: unknown = JSON.parse(metadataText);
      if (typeof parsed !== 'object' || parsed === null) return null;
      const record = parsed as Record<string, unknown>;
      if (record.autoAmm !== true) return null;
      const rec = record.recommendation;
      if (typeof rec !== 'object' || rec === null) return null;
      const recRecord = rec as Record<string, unknown>;
      const protocol = recRecord.protocol;
      if (protocol === 'scallop' || protocol === 'navi' || protocol === 'cetus' || protocol === 'suilend') {
        return protocol;
      }
      return null;
    } catch {
      return null;
    }
  }

  private extractTaskFields(obj: SuiObjectResponse): { taskId: string; executeAtMs: number; status: number; metadataText: string | null } | null {
    const taskId = obj.data?.objectId;
    const content = obj.data?.content;
    if (!taskId || !content || content.dataType !== 'moveObject') {
      return null;
    }

    const fields = content.fields as unknown as Record<string, unknown>;
    const executeAtRaw = fields.execute_at;
    const statusRaw = fields.status;
    const metadataRaw = fields.metadata;

    const executeAtMs = typeof executeAtRaw === 'string' ? Number.parseInt(executeAtRaw, 10) : Number.NaN;
    const status = typeof statusRaw === 'number' ? statusRaw : typeof statusRaw === 'string' ? Number.parseInt(statusRaw, 10) : Number.NaN;
    if (!Number.isFinite(executeAtMs) || !Number.isFinite(status)) {
      return null;
    }

    const metadataText = this.decodeMetadata(metadataRaw);
    return { taskId, executeAtMs, status, metadataText };
  }

  private async scanAndExecute(): Promise<void> {
    if (!this.client || !this.packageId || !this.registryId) {
      logger.debug('Executor not initialized; skipping scan');
      return;
    }

    logger.info('Scanning for ready tasks (optimistic executor)');

    const events = await this.client.queryEvents({
      query: { MoveEventType: `${this.packageId}::autopay::TaskCreated` },
      limit: 50,
      order: 'descending',
    });

    const taskIds: string[] = events.data
      .map((e) => this.parseTaskIdFromEvent(e))
      .filter((x: string | null): x is string => x !== null);

    if (taskIds.length === 0) {
      return;
    }

    const objects = await this.client.multiGetObjects({
      ids: taskIds,
      options: { showContent: true },
    });

    const now = Date.now();
    const due = objects
      .map((o) => this.extractTaskFields(o))
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .filter((t) => t.status === 0 && now >= t.executeAtMs);

    if (due.length === 0) {
      return;
    }

    if (!this.keypair) {
      logger.warn(`Found ${due.length} due task(s) but RELAYER_PRIVATE_KEY is not set; skipping execution`);
      return;
    }

    const yieldExecutor = new YieldExecutor({
      packageId: this.packageId,
      registryId: this.registryId,
      clockObjectId: '0x6',
    });

    for (const task of due) {
      const selectedProtocol = this.parseAutoAmmProtocol(task.metadataText);

      try {
        const txResult =
          selectedProtocol !== null
            ? yieldExecutor.buildYieldOptimizedPaymentTx({
                taskId: task.taskId,
                selectedProtocol,
                currentProtocol: null,
                maxSlippageBps: 100,
              })
            : (() => {
                const tx = new Transaction();
                tx.moveCall({
                  target: `${this.packageId}::autopay::execute_task`,
                  arguments: [tx.object(task.taskId), tx.object(this.registryId), tx.object('0x6')],
                });
                return { transaction: tx, notes: ['Standard execute_task'] };
              })();

        const result = await this.client.signAndExecuteTransaction({
          signer: this.keypair,
          transaction: txResult.transaction,
          options: { showEffects: true, showEvents: true },
        });

        if (result.effects?.status.status === 'success') {
          logger.info(`Executed task ${task.taskId} (autoAmm=${String(selectedProtocol !== null)}) digest=${result.digest}`);
        } else {
          logger.error(`Execution failed for task ${task.taskId}: ${String(result.effects?.status.error)}`);
        }
      } catch (err: unknown) {
        logger.error(`Error executing task ${task.taskId}: ${String(err)}`);
      }
    }
  }
}

