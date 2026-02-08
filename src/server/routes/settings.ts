import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { prisma } from '../lib/prisma.js';
import { getOrCreateUserSettings } from '../services/UserSettingsService.js';

const hhmmSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected HH:MM format');

const updateAlertSettingsSchema = z
  .object({
    strategies: z
      .object({
        pullback: z.boolean().optional(),
        breakout: z.boolean().optional(),
        macdCross: z.boolean().optional(),
      })
      .optional(),
    minScore: z.number().int().min(0).max(100).optional(),
    pushNotifications: z.boolean().optional(),
    quietHours: z
      .object({
        enabled: z.boolean().optional(),
        start: hhmmSchema.nullable().optional(),
        end: hhmmSchema.nullable().optional(),
      })
      .optional(),
  })
  .refine(
    (value) =>
      value.strategies !== undefined ||
      value.minScore !== undefined ||
      value.pushNotifications !== undefined ||
      value.quietHours !== undefined,
    { message: 'At least one field must be provided' },
  );

function toAlertSettings(settings: {
  strategyPullback: boolean;
  strategyBreakout: boolean;
  strategyMacdCross: boolean;
  minScoreAlert: number;
  pushEnabled: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
}) {
  return {
    strategies: {
      pullback: settings.strategyPullback,
      breakout: settings.strategyBreakout,
      macdCross: settings.strategyMacdCross,
    },
    minScore: settings.minScoreAlert,
    pushNotifications: settings.pushEnabled,
    quietHours: {
      enabled: settings.quietHoursEnabled,
      start: settings.quietHoursStart,
      end: settings.quietHoursEnd,
    },
  };
}

export const settingsRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  // GET /api/settings/alerts
  app.get('/api/settings/alerts', async (_request, reply) => {
    const settings = await getOrCreateUserSettings();
    return reply.send({ data: toAlertSettings(settings) });
  });

  // PUT /api/settings/alerts
  app.put(
    '/api/settings/alerts',
    {
      schema: {
        body: updateAlertSettingsSchema,
      },
    },
    async (request, reply) => {
      const existing = await getOrCreateUserSettings();
      const { strategies, minScore, pushNotifications, quietHours } = request.body;

      const nextQuietEnabled = quietHours?.enabled ?? existing.quietHoursEnabled;
      const nextQuietStart =
        quietHours && Object.prototype.hasOwnProperty.call(quietHours, 'start')
          ? quietHours.start
          : existing.quietHoursStart;
      const nextQuietEnd =
        quietHours && Object.prototype.hasOwnProperty.call(quietHours, 'end')
          ? quietHours.end
          : existing.quietHoursEnd;

      if (nextQuietEnabled && (!nextQuietStart || !nextQuietEnd)) {
        return reply.code(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'quietHours.start and quietHours.end are required when quiet hours are enabled',
          },
        });
      }

      const updated = await prisma.userSettings.update({
        where: { id: 'default' },
        data: {
          ...(strategies?.pullback !== undefined
            ? { strategyPullback: strategies.pullback }
            : {}),
          ...(strategies?.breakout !== undefined
            ? { strategyBreakout: strategies.breakout }
            : {}),
          ...(strategies?.macdCross !== undefined
            ? { strategyMacdCross: strategies.macdCross }
            : {}),
          ...(minScore !== undefined ? { minScoreAlert: minScore } : {}),
          ...(pushNotifications !== undefined ? { pushEnabled: pushNotifications } : {}),
          ...(quietHours?.enabled !== undefined
            ? { quietHoursEnabled: quietHours.enabled }
            : {}),
          ...(quietHours?.start !== undefined
            ? { quietHoursStart: quietHours.start }
            : {}),
          ...(quietHours?.end !== undefined ? { quietHoursEnd: quietHours.end } : {}),
        },
      });

      return reply.send({
        data: toAlertSettings(updated),
      });
    },
  );
};
