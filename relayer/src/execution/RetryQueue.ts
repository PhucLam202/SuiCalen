import { logger } from '../logger';

export type RetryJob = {
  taskId: string;
  attempt: number;
  executeAt: number;
};

export class RetryQueue {
  private queue: Map<string, NodeJS.Timeout>;

  constructor() {
    this.queue = new Map();
  }

  scheduleRetry(job: RetryJob, delayMs: number): void {
    const key = job.taskId;
    if (this.queue.has(key)) {
      // Replace existing scheduled retry
      clearTimeout(this.queue.get(key) as NodeJS.Timeout);
    }
    const t = setTimeout(() => {
      this.queue.delete(key);
      logger.info(`Retrying task ${key} attempt ${job.attempt}`);
      // actual retry handler should be wired by consumer
    }, delayMs);
    this.queue.set(key, t);
  }

  cancelRetry(taskId: string): void {
    const t = this.queue.get(taskId);
    if (t) {
      clearTimeout(t);
      this.queue.delete(taskId);
    }
  }
}

