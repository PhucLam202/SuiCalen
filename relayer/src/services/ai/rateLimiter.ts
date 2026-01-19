export interface RateLimiterConfig {
  maxRequests: number;
  windowMs: number;
}

/**
 * Simple sliding-window rate limiter.
 * Not distributed; intended for a single relayer instance.
 */
export class SlidingWindowRateLimiter {
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private readonly timestamps: number[] = [];

  constructor(config: RateLimiterConfig) {
    this.maxRequests = config.maxRequests;
    this.windowMs = config.windowMs;
  }

  private cleanup(nowMs: number): void {
    while (this.timestamps.length > 0 && nowMs - this.timestamps[0] >= this.windowMs) {
      this.timestamps.shift();
    }
  }

  /**
   * Wait until one request slot is available, then record it.
   */
  async acquire(): Promise<void> {
    while (true) {
      const now = Date.now();
      this.cleanup(now);

      if (this.timestamps.length < this.maxRequests) {
        this.timestamps.push(now);
        return;
      }

      const oldest = this.timestamps[0];
      const waitMs = Math.max(0, this.windowMs - (now - oldest));
      await new Promise<void>((resolve) => setTimeout(resolve, waitMs));
    }
  }
}
