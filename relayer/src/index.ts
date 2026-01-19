import express, { Application } from 'express';
import { healthHandler } from './api/health';
import { metricsHandler } from './api/metrics';
import { getAllAPRsHandler, getAPRByTokenHandler, optimizeYieldHandler } from './api/yield';
import { MetricsCollector } from './monitoring/MetricsCollector';
import { OptimisticExecutor } from './execution/OptimisticExecutor';
import { connectMongoDB, closeMongoDB } from './db/mongoClient';
import { logger } from './logger';

const app: Application = express();
const metrics = new MetricsCollector();
const executor = new OptimisticExecutor(metrics);

// Middleware
app.use(express.json());

// Health and metrics endpoints
app.get('/health', healthHandler);
app.get('/metrics', metricsHandler(metrics));

// Yield API endpoints
app.get('/api/yield/apr/all', getAllAPRsHandler);
app.get('/api/yield/apr/:token', getAPRByTokenHandler);
app.post('/api/yield/optimize', optimizeYieldHandler);

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;

// Initialize MongoDB connection
async function startServer(): Promise<void> {
  try {
    // Connect to MongoDB
    if (process.env.MONGODB_URI) {
      await connectMongoDB();
      logger.info('MongoDB connected');
    } else {
      logger.warn('MONGODB_URI not set, database features will be disabled');
    }

    // Start Express server
    app.listen(PORT, () => {
      logger.info(`Relayer API listening on ${PORT}`);
      executor.start();
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('Shutting down gracefully...');
      await closeMongoDB();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('Shutting down gracefully...');
      await closeMongoDB();
      process.exit(0);
    });

  } catch (error) {
    logger.error(`Failed to start server: ${String(error)}`);
    process.exit(1);
  }
}

startServer();

