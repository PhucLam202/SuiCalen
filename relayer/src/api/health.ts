import { Request, Response } from 'express';
import { logger } from '../logger';

export function healthHandler(req: Request, res: Response): void {
  logger.info('Health check requested');
  res.status(200).json({ status: 'ok', timestamp: Date.now() });
}

