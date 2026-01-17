import { RELAYER_CONFIG } from '../config';
import { logger } from '../logger';
import { MetricsCollector } from '../monitoring/MetricsCollector';

export class OptimisticExecutor {
  private metrics: MetricsCollector;
  private running: boolean;

  constructor(metrics: MetricsCollector) {
    this.metrics = metrics;
    this.running = false;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.loop();
  }

  stop(): void {
    this.running = false;
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

  private async scanAndExecute(): Promise<void> {
    // Placeholder: wire into Sui SDK to query objects ready to execute
    logger.info('Scanning for ready tasks (optimistic executor)');
    // For each task found:
    // - Attempt execution
    // - On success: metrics.recordExecution(...)
    // - On object not found: ignore
    // - On failure: push to retry queue (handled externally)
  }
}

