export type Metrics = {
  uptimeStart: number;
  tasksExecuted: number;
  tasksFailed: number;
  totalExecutionDelayMs: number;
  totalGasCost: number;
};

export class MetricsCollector {
  private metrics: Metrics;

  constructor() {
    this.metrics = {
      uptimeStart: Date.now(),
      tasksExecuted: 0,
      tasksFailed: 0,
      totalExecutionDelayMs: 0,
      totalGasCost: 0
    };
  }

  recordExecution(delayMs: number, gasCost: number): void {
    this.metrics.tasksExecuted += 1;
    this.metrics.totalExecutionDelayMs += delayMs;
    this.metrics.totalGasCost += gasCost;
  }

  recordFailure(): void {
    this.metrics.tasksFailed += 1;
  }

  getMetrics(): Metrics & { uptimeMs: number; avgDelayMs: number } {
    const uptimeMs = Date.now() - this.metrics.uptimeStart;
    const avgDelayMs =
      this.metrics.tasksExecuted > 0
        ? Math.floor(this.metrics.totalExecutionDelayMs / this.metrics.tasksExecuted)
        : 0;
    return { ...this.metrics, uptimeMs, avgDelayMs };
  }
}

