import { describe, it, expect } from 'vitest';
import { z } from 'zod';

describe('Environment validation', () => {
  const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().default(3000),
    DATABASE_URL: z.string().default('file:./data/looptrading.db'),
  });

  it('should use default values when env vars are not set', () => {
    const result = envSchema.parse({});

    expect(result.NODE_ENV).toBe('development');
    expect(result.PORT).toBe(3000);
    expect(result.DATABASE_URL).toBe('file:./data/looptrading.db');
  });

  it('should parse PORT from string to number', () => {
    const result = envSchema.parse({ PORT: '8080' });

    expect(result.PORT).toBe(8080);
  });

  it('should reject invalid NODE_ENV', () => {
    const result = envSchema.safeParse({ NODE_ENV: 'invalid' });

    expect(result.success).toBe(false);
  });

  it('should accept valid NODE_ENV values', () => {
    const envs = ['development', 'production', 'test'];

    for (const env of envs) {
      const result = envSchema.safeParse({ NODE_ENV: env });
      expect(result.success).toBe(true);
    }
  });
});
