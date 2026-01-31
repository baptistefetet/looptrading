import { SchedulerService } from '../SchedulerService.js';

/**
 * Register heartbeat job - runs every minute in development only.
 * Useful for verifying the scheduler is working.
 */
export function registerHeartbeatJob(scheduler: SchedulerService): void {
  if (process.env.NODE_ENV !== 'development') return;

  scheduler.registerJob('heartbeat', '* * * * *', async () => {
    // Simple heartbeat - just confirms the scheduler is alive
  });
}
