import { describe, it, expect } from 'vitest';
import { isMarketOpen } from '../utils/marketHours.js';

/** Helper to build a UTC Date from day-of-week, hour, minute */
function utcDate(dayOfWeek: number, hour: number, minute: number): Date {
  // 2026-01-05 is a Monday (dayOfWeek=1)
  const baseMonday = new Date(Date.UTC(2026, 0, 5, 0, 0, 0));
  const offset = dayOfWeek - 1; // days from Monday
  const d = new Date(baseMonday);
  d.setUTCDate(d.getUTCDate() + offset);
  d.setUTCHours(hour, minute, 0, 0);
  return d;
}

describe('isMarketOpen', () => {
  describe('weekends', () => {
    it('should return both closed on Saturday', () => {
      const sat = utcDate(6, 15, 0); // Saturday 15:00 UTC
      expect(isMarketOpen(sat)).toEqual({ us: false, eu: false });
    });

    it('should return both closed on Sunday', () => {
      const sun = utcDate(0, 10, 0); // Sunday 10:00 UTC
      expect(isMarketOpen(sun)).toEqual({ us: false, eu: false });
    });
  });

  describe('US market hours (14:30-21:00 UTC)', () => {
    it('should be closed before 14:30 UTC', () => {
      const before = utcDate(1, 14, 29); // Monday 14:29 UTC
      expect(isMarketOpen(before).us).toBe(false);
    });

    it('should be open at 14:30 UTC (market open)', () => {
      const open = utcDate(1, 14, 30); // Monday 14:30 UTC
      expect(isMarketOpen(open).us).toBe(true);
    });

    it('should be open at 17:00 UTC (mid-session)', () => {
      const mid = utcDate(3, 17, 0); // Wednesday 17:00 UTC
      expect(isMarketOpen(mid).us).toBe(true);
    });

    it('should be open at 20:59 UTC (just before close)', () => {
      const beforeClose = utcDate(2, 20, 59); // Tuesday 20:59 UTC
      expect(isMarketOpen(beforeClose).us).toBe(true);
    });

    it('should be closed at 21:00 UTC (market close)', () => {
      const closed = utcDate(2, 21, 0); // Tuesday 21:00 UTC
      expect(isMarketOpen(closed).us).toBe(false);
    });
  });

  describe('EU market hours (8:00-16:30 UTC)', () => {
    it('should be closed before 8:00 UTC', () => {
      const before = utcDate(1, 7, 59); // Monday 07:59 UTC
      expect(isMarketOpen(before).eu).toBe(false);
    });

    it('should be open at 8:00 UTC (market open)', () => {
      const open = utcDate(1, 8, 0); // Monday 08:00 UTC
      expect(isMarketOpen(open).eu).toBe(true);
    });

    it('should be open at 12:00 UTC (mid-session)', () => {
      const mid = utcDate(4, 12, 0); // Thursday 12:00 UTC
      expect(isMarketOpen(mid).eu).toBe(true);
    });

    it('should be open at 16:29 UTC (just before close)', () => {
      const beforeClose = utcDate(5, 16, 29); // Friday 16:29 UTC
      expect(isMarketOpen(beforeClose).eu).toBe(true);
    });

    it('should be closed at 16:30 UTC (market close)', () => {
      const closed = utcDate(5, 16, 30); // Friday 16:30 UTC
      expect(isMarketOpen(closed).eu).toBe(false);
    });
  });

  describe('overlap period (both open)', () => {
    it('should have both US and EU open at 15:00 UTC', () => {
      const overlap = utcDate(3, 15, 0); // Wednesday 15:00 UTC
      const status = isMarketOpen(overlap);
      expect(status.us).toBe(true);
      expect(status.eu).toBe(true);
    });
  });

  describe('EU-only period', () => {
    it('should have only EU open at 10:00 UTC', () => {
      const euOnly = utcDate(2, 10, 0); // Tuesday 10:00 UTC
      const status = isMarketOpen(euOnly);
      expect(status.us).toBe(false);
      expect(status.eu).toBe(true);
    });
  });

  describe('US-only period', () => {
    it('should have only US open at 18:00 UTC', () => {
      const usOnly = utcDate(4, 18, 0); // Thursday 18:00 UTC
      const status = isMarketOpen(usOnly);
      expect(status.us).toBe(true);
      expect(status.eu).toBe(false);
    });
  });

  describe('default (no argument)', () => {
    it('should use current time when no argument provided', () => {
      const result = isMarketOpen();
      expect(result).toHaveProperty('us');
      expect(result).toHaveProperty('eu');
      expect(typeof result.us).toBe('boolean');
      expect(typeof result.eu).toBe('boolean');
    });
  });
});
