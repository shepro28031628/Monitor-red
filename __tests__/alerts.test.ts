import { describe, it, expect, vi, beforeEach } from 'vitest';
import { evaluateAlerts, TelemetryData } from '../src/lib/alerts';
import { PrismaClient } from '@prisma/client';

// Mock queue
vi.mock('../worker/queue', () => ({
  emailQueue: {
    add: vi.fn().mockResolvedValue(true),
  },
}));

describe('Alert Evaluation Engine', () => {
  let prismaMock: any;
  let activeAlerts: any[];

  beforeEach(() => {
    activeAlerts = [];
    prismaMock = {
      systemAlert: {
        findMany: vi.fn().mockImplementation(async () => activeAlerts),
        create: vi.fn().mockImplementation(async (data) => {
          activeAlerts.push(data.data);
          return data.data;
        }),
        updateMany: vi.fn().mockImplementation(async (args) => {
          activeAlerts = activeAlerts.filter(a => a.alertType !== args.where.alertType);
          return { count: 1 };
        }),
      },
    };
  });

  it('should trigger HIGH_CPU alert when CPU > 85%', async () => {
    const snapshot: TelemetryData = {
      cpuLoad: 90,
      freeMemory: 500000000n,
      totalMemory: 1000000000n,
      temperature: 40,
    };

    await evaluateAlerts(snapshot, prismaMock as any);

    expect(prismaMock.systemAlert.create).toHaveBeenCalled();
    const callArgs = prismaMock.systemAlert.create.mock.calls[0][0];
    expect(callArgs.data.alertType).toBe('HIGH_CPU');
    expect(callArgs.data.severity).toBe('Critical');
  });

  it('should trigger LOW_MEMORY alert when memory < 15%', async () => {
    const snapshot: TelemetryData = {
      cpuLoad: 20,
      freeMemory: 100000000n, // 10%
      totalMemory: 1000000000n,
      temperature: 40,
    };

    await evaluateAlerts(snapshot, prismaMock as any);

    expect(prismaMock.systemAlert.create).toHaveBeenCalled();
    const callArgs = prismaMock.systemAlert.create.mock.calls[0][0];
    expect(callArgs.data.alertType).toBe('LOW_MEMORY');
  });

  it('should resolve alert when condition returns to normal', async () => {
    activeAlerts.push({ alertType: 'HIGH_CPU', resolvedAt: null });

    const snapshot: TelemetryData = {
      cpuLoad: 50, // Normal
      freeMemory: 500000000n,
      totalMemory: 1000000000n,
      temperature: 40,
    };

    await evaluateAlerts(snapshot, prismaMock as any);

    expect(prismaMock.systemAlert.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ alertType: 'HIGH_CPU', resolvedAt: null }),
      })
    );
  });
});
