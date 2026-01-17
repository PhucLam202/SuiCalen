import { logger } from '../logger';

export type ErrorKind = 'InsufficientGas' | 'Network' | 'ObjectNotFound' | 'TimeNotReady' | 'ContractPaused' | 'Unknown';

export class ErrorRecovery {
  classifyError(err: unknown): ErrorKind {
    const message = String(err);
    if (message.includes('Insufficient')) return 'InsufficientGas';
    if (message.includes('network') || message.includes('Network')) return 'Network';
    if (message.includes('not found') || message.includes('object not found')) return 'ObjectNotFound';
    if (message.includes('NotReady') || message.includes('NotReadyYet')) return 'TimeNotReady';
    if (message.includes('paused') || message.includes('ContractPaused')) return 'ContractPaused';
    return 'Unknown';
  }

  async backoffDelay(attempt: number): Promise<void> {
    const base = 1000;
    const delay = Math.min(base * 2 ** attempt, 30_000);
    logger.info(`Retry backoff delay ${delay}ms for attempt ${attempt}`);
    return new Promise((resolve) => setTimeout(resolve, delay));
  }
}

