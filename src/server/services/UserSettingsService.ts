import { prisma } from '../lib/prisma.js';

export const DEFAULT_USER_SETTINGS = {
  id: 'default',
  strategyPullback: true,
  strategyBreakout: true,
  strategyMacdCross: true,
  minScoreAlert: 75,
  pushEnabled: true,
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '08:00',
} as const;

export async function getOrCreateUserSettings() {
  return prisma.userSettings.upsert({
    where: { id: 'default' },
    update: {},
    create: DEFAULT_USER_SETTINGS,
  });
}
