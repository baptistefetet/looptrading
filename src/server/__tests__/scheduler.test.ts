import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SchedulerService } from '../services/SchedulerService.js';

const silentLogger = {
  info: vi.fn(),
  error: vi.fn(),
};

describe('SchedulerService', () => {
  let scheduler: SchedulerService;

  beforeEach(() => {
    silentLogger.info.mockClear();
    silentLogger.error.mockClear();
    scheduler = new SchedulerService(silentLogger);
  });

  describe('registerJob', () => {
    it('should register a job', () => {
      scheduler.registerJob('test', '* * * * *', async () => {});

      const status = scheduler.getStatus();
      expect(status).toHaveLength(1);
      expect(status[0].name).toBe('test');
      expect(status[0].expression).toBe('* * * * *');
      expect(status[0].running).toBe(false);
      expect(status[0].lastRun).toBeNull();
    });

    it('should throw on duplicate job name', () => {
      scheduler.registerJob('test', '* * * * *', async () => {});

      expect(() => {
        scheduler.registerJob('test', '*/5 * * * *', async () => {});
      }).toThrow('Job "test" is already registered');
    });

    it('should throw on invalid cron expression', () => {
      expect(() => {
        scheduler.registerJob('test', 'invalid', async () => {});
      }).toThrow('Invalid cron expression');
    });
  });

  describe('start / stop', () => {
    it('should start and stop', () => {
      scheduler.registerJob('test', '* * * * *', async () => {});

      expect(scheduler.isRunning()).toBe(false);

      scheduler.start();
      expect(scheduler.isRunning()).toBe(true);

      const status = scheduler.getStatus();
      expect(status[0].running).toBe(true);

      scheduler.stop();
      expect(scheduler.isRunning()).toBe(false);
      expect(scheduler.getStatus()[0].running).toBe(false);
    });

    it('should be idempotent (no error on double start/stop)', () => {
      scheduler.registerJob('test', '* * * * *', async () => {});

      scheduler.start();
      scheduler.start(); // should not throw

      scheduler.stop();
      scheduler.stop(); // should not throw
    });
  });

  describe('getStatus', () => {
    it('should return empty array when no jobs registered', () => {
      expect(scheduler.getStatus()).toEqual([]);
    });

    it('should return status for multiple jobs', () => {
      scheduler.registerJob('job1', '* * * * *', async () => {});
      scheduler.registerJob('job2', '*/5 * * * *', async () => {});

      const status = scheduler.getStatus();
      expect(status).toHaveLength(2);
      expect(status.map((j) => j.name)).toEqual(['job1', 'job2']);
    });
  });
});
