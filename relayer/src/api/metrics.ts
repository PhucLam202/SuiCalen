import { Request, Response } from 'express';
import { MetricsCollector } from '../monitoring/MetricsCollector';

export function metricsHandler(metrics: MetricsCollector) {
  return (_req: Request, res: Response): void => {
    const m = metrics.getMetrics();
    res.status(200).json(m);
  };
}

