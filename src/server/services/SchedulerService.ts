import cron from 'node-cron';

export interface JobOptions {
  /** Prevent overlapping executions of the same job */
  preventOverlap?: boolean;
}

interface RegisteredJob {
  task: cron.ScheduledTask;
  name: string;
  expression: string;
  running: boolean;
  lastRun: string | null;
  options: Required<JobOptions>;
}

const DEFAULT_OPTIONS: Required<JobOptions> = {
  preventOverlap: true,
};

export class SchedulerService {
  private jobs: Map<string, RegisteredJob> = new Map();
  private started = false;
  private logger: { info: (...args: unknown[]) => void; error: (...args: unknown[]) => void };

  constructor(
    logger?: { info: (...args: unknown[]) => void; error: (...args: unknown[]) => void },
  ) {
    this.logger = logger ?? console;
  }

  registerJob(
    name: string,
    expression: string,
    handler: () => Promise<void>,
    options?: JobOptions,
  ): void {
    if (this.jobs.has(name)) {
      throw new Error(`Job "${name}" is already registered`);
    }

    if (!cron.validate(expression)) {
      throw new Error(`Invalid cron expression for job "${name}": ${expression}`);
    }

    const jobOptions = { ...DEFAULT_OPTIONS, ...options };
    let executing = false;

    const task = cron.schedule(
      expression,
      async () => {
        if (jobOptions.preventOverlap && executing) {
          this.logger.info(`[Scheduler] [${name}] Skipped (previous execution still running)`);
          return;
        }

        executing = true;
        const start = Date.now();
        this.logger.info(`[Scheduler] [${name}] Starting...`);

        try {
          await handler();
          const duration = Date.now() - start;
          const job = this.jobs.get(name);
          if (job) {
            job.lastRun = new Date().toISOString();
          }
          this.logger.info(`[Scheduler] [${name}] Completed in ${duration}ms`);
        } catch (error) {
          const duration = Date.now() - start;
          this.logger.error(
            `[Scheduler] [${name}] Failed after ${duration}ms:`,
            error instanceof Error ? error.stack ?? error.message : error,
          );
        } finally {
          executing = false;
        }
      },
      { scheduled: false },
    );

    this.jobs.set(name, {
      task,
      name,
      expression,
      running: false,
      lastRun: null,
      options: jobOptions,
    });

    this.logger.info(`[Scheduler] Registered job: ${name} (${expression})`);
  }

  start(): void {
    if (this.started) return;

    this.jobs.forEach((job) => {
      job.task.start();
      job.running = true;
      this.logger.info(`[Scheduler] Started job: ${job.name}`);
    });

    this.started = true;
    this.logger.info(`[Scheduler] All jobs started (${this.jobs.size} total)`);
  }

  stop(): void {
    if (!this.started) return;

    this.jobs.forEach((job) => {
      job.task.stop();
      job.running = false;
      this.logger.info(`[Scheduler] Stopped job: ${job.name}`);
    });

    this.started = false;
    this.logger.info(`[Scheduler] All jobs stopped`);
  }

  isRunning(): boolean {
    return this.started;
  }

  getStatus(): { name: string; expression: string; running: boolean; lastRun: string | null }[] {
    return Array.from(this.jobs.values()).map((job) => ({
      name: job.name,
      expression: job.expression,
      running: job.running,
      lastRun: job.lastRun,
    }));
  }
}
