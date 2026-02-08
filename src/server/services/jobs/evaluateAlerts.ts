import type { SchedulerService } from '../SchedulerService.js';
import { evaluateAlerts } from '../AlertService.js';

type Logger = {
  info: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
};

export function registerEvaluateAlertsJob(
  scheduler: SchedulerService,
  logger: Logger,
): void {
  scheduler.registerJob('evaluateAlerts', '*/15 * * * *', async () => {
    await evaluateAlerts(logger);
  });
}
