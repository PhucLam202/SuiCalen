import express, { Application } from 'express';
import { healthHandler } from './api/health';
import { metricsHandler } from './api/metrics';
import { MetricsCollector } from './monitoring/MetricsCollector';
import { OptimisticExecutor } from './execution/OptimisticExecutor';
import { logger } from './logger';

const app: Application = express();
const metrics = new MetricsCollector();
const executor = new OptimisticExecutor(metrics);

app.get('/health', healthHandler);
app.get('/metrics', metricsHandler(metrics));

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;
app.listen(PORT, () => {
  logger.info(`Relayer API listening on ${PORT}`);
  executor.start();
});

