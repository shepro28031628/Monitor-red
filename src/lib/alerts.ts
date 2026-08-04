/**
 * REN Enterprise Monitor — Alert Evaluation Engine
 *
 * Evaluates telemetry snapshots against defined thresholds and
 * creates SystemAlert records when anomalies are detected.
 * Optionally sends email notifications via the mailer service.
 */

import { PrismaClient } from "@prisma/client";
import { emailQueue } from "../../worker/queue";

// ── Threshold Configuration ─────────────────────────────────────────
// Read thresholds from environment variables with sensible defaults.
// Operators can override any value via .env without recompiling.
const CPU_CRITICAL     = process.env.ALERT_CPU_CRITICAL !== undefined ? Number(process.env.ALERT_CPU_CRITICAL) : 85;
const CPU_WARNING      = process.env.ALERT_CPU_WARNING !== undefined ? Number(process.env.ALERT_CPU_WARNING) : 70;
const MEMORY_MIN_PCT   = process.env.ALERT_MEMORY_MIN_PCT !== undefined ? Number(process.env.ALERT_MEMORY_MIN_PCT) : 15;
const MEMORY_WARN_PCT  = process.env.ALERT_MEMORY_WARN_PCT !== undefined ? Number(process.env.ALERT_MEMORY_WARN_PCT) : 25;
const HDD_CRITICAL_PCT = process.env.ALERT_HDD_CRITICAL_PCT !== undefined ? Number(process.env.ALERT_HDD_CRITICAL_PCT) : 10;
const HDD_WARN_PCT     = process.env.ALERT_HDD_WARN_PCT !== undefined ? Number(process.env.ALERT_HDD_WARN_PCT) : 20;
const TEMP_CRITICAL    = process.env.ALERT_TEMP_CRITICAL !== undefined ? Number(process.env.ALERT_TEMP_CRITICAL) : 65;
const TEMP_WARNING     = process.env.ALERT_TEMP_WARNING !== undefined ? Number(process.env.ALERT_TEMP_WARNING) : 55;
const PACKET_LOSS_PCT  = process.env.ALERT_PACKET_LOSS_PCT !== undefined ? Number(process.env.ALERT_PACKET_LOSS_PCT) : 5;
const VOLTAGE_MIN      = process.env.ALERT_VOLTAGE_MIN !== undefined ? Number(process.env.ALERT_VOLTAGE_MIN) : 10;
const VOLTAGE_MAX      = process.env.ALERT_VOLTAGE_MAX !== undefined ? Number(process.env.ALERT_VOLTAGE_MAX) : 30;

interface AlertThreshold {
  alertType: string;
  severity: "Warning" | "Critical";
  message: (value: number) => string;
  evaluate: (snapshot: TelemetryData) => number | null; // returns the violating value, or null if OK
}

export interface TelemetryData {
  cpuLoad: number;
  freeMemory: bigint;
  totalMemory: bigint;
  temperature: number;
  pingLossPercent?: number | null;
  voltage?: number;
  hddFree?: bigint;
  hddTotal?: bigint;
}

const THRESHOLDS: AlertThreshold[] = [
  {
    alertType: "HIGH_CPU",
    severity: "Critical",
    message: (v) => `Uso de CPU extremadamente alto: ${v}%. Umbral máximo: ${CPU_CRITICAL}%.`,
    evaluate: (s) => (s.cpuLoad > CPU_CRITICAL ? s.cpuLoad : null),
  },
  {
    alertType: "HIGH_CPU_WARNING",
    severity: "Warning",
    message: (v) => `Uso de CPU elevado: ${v}%. Umbral de advertencia: ${CPU_WARNING}%.`,
    evaluate: (s) => (s.cpuLoad > CPU_WARNING && s.cpuLoad <= CPU_CRITICAL ? s.cpuLoad : null),
  },
  {
    alertType: "LOW_MEMORY",
    severity: "Critical",
    message: (v) =>
      `Memoria libre por debajo del ${MEMORY_MIN_PCT}%: ${v.toFixed(1)}% disponible.`,
    evaluate: (s) => {
      if (s.totalMemory === 0n) return null;
      const pct =
        (Number(s.freeMemory) / Number(s.totalMemory)) * 100;
      return pct < MEMORY_MIN_PCT ? pct : null;
    },
  },
  {
    alertType: "LOW_MEMORY_WARNING",
    severity: "Warning",
    message: (v) =>
      `Memoria libre por debajo del ${MEMORY_WARN_PCT}%: ${v.toFixed(1)}% disponible.`,
    evaluate: (s) => {
      if (s.totalMemory === 0n) return null;
      const pct =
        (Number(s.freeMemory) / Number(s.totalMemory)) * 100;
      return pct < MEMORY_WARN_PCT && pct >= MEMORY_MIN_PCT ? pct : null;
    },
  },
  {
    alertType: "LOW_HDD",
    severity: "Critical",
    message: (v) =>
      `Espacio en disco (flash) por debajo del ${HDD_CRITICAL_PCT}%: ${v.toFixed(1)}% disponible.`,
    evaluate: (s) => {
      if (s.hddTotal == null || s.hddFree == null || s.hddTotal === 0n) return null;
      const pct = (Number(s.hddFree) / Number(s.hddTotal)) * 100;
      return pct < HDD_CRITICAL_PCT ? pct : null;
    },
  },
  {
    alertType: "LOW_HDD_WARNING",
    severity: "Warning",
    message: (v) =>
      `Espacio en disco (flash) por debajo del ${HDD_WARN_PCT}%: ${v.toFixed(1)}% disponible.`,
    evaluate: (s) => {
      if (s.hddTotal == null || s.hddFree == null || s.hddTotal === 0n) return null;
      const pct = (Number(s.hddFree) / Number(s.hddTotal)) * 100;
      return pct < HDD_WARN_PCT && pct >= HDD_CRITICAL_PCT ? pct : null;
    },
  },
  {
    alertType: "ABNORMAL_VOLTAGE",
    severity: "Warning",
    message: (v) =>
      `Voltaje fuera de rango normal (${VOLTAGE_MIN}V - ${VOLTAGE_MAX}V): ${v}V detectados.`,
    evaluate: (s) => {
      if (s.voltage == null || s.voltage === 0) return null;
      return (s.voltage < VOLTAGE_MIN || s.voltage > VOLTAGE_MAX) ? s.voltage : null;
    },
  },
  {
    alertType: "HIGH_TEMP",
    severity: "Critical",
    message: (v) => `Temperatura interna crítica: ${v}°C. Umbral: ${TEMP_CRITICAL}°C.`,
    evaluate: (s) => (s.temperature > TEMP_CRITICAL ? s.temperature : null),
  },
  {
    alertType: "HIGH_TEMP_WARNING",
    severity: "Warning",
    message: (v) => `Temperatura interna elevada: ${v}°C. Umbral de advertencia: ${TEMP_WARNING}°C.`,
    evaluate: (s) =>
      s.temperature > TEMP_WARNING && s.temperature <= TEMP_CRITICAL ? s.temperature : null,
  },
  {
    alertType: "PACKET_LOSS",
    severity: "Critical",
    message: (v) =>
      `Pérdida de paquetes detectada: ${v}%. Umbral: ${PACKET_LOSS_PCT}%.`,
    evaluate: (s) =>
      s.pingLossPercent != null && s.pingLossPercent > PACKET_LOSS_PCT && s.pingLossPercent < 50
        ? s.pingLossPercent
        : null,
  },
];

// ── Cooldown (avoid alert flooding) ─────────────────────────────────
// Track last alert time per type so we don't spam every 2 seconds
const lastAlertTime = new Map<string, number>();
const ALERT_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes between repeated alerts

function isCooldownActive(alertType: string): boolean {
  const last = lastAlertTime.get(alertType);
  if (!last) return false;
  return Date.now() - last < ALERT_COOLDOWN_MS;
}

// ── Main Evaluation Function ────────────────────────────────────────

// ── In-Memory Cache for Active Alerts ─────────────────────────────
// This prevents hitting the database on every telemetry evaluation tick
import type { SystemAlert } from "@prisma/client";

let activeAlertsCache: SystemAlert[] | null = null;
let lastCacheUpdate = 0;
const CACHE_TTL_MS = 60000; // Force sync every 60 seconds

/**
 * Evaluate a telemetry snapshot against all configured thresholds.
 * Creates DB records and sends emails for any violations found.
 * Also resolves active alerts when values return to normal.
 */
export async function evaluateAlerts(
  snapshot: TelemetryData,
  prisma: PrismaClient
): Promise<void> {
  // Fetch currently active alerts, using cache if available and fresh
  if (!activeAlertsCache || Date.now() - lastCacheUpdate > CACHE_TTL_MS) {
    activeAlertsCache = await prisma.systemAlert.findMany({
      where: { resolvedAt: null },
    });
    lastCacheUpdate = Date.now();
  }

  for (const threshold of THRESHOLDS) {
    const violatingValue = threshold.evaluate(snapshot);
    const existingActiveAlert = activeAlertsCache.find(
      (a) => a.alertType === threshold.alertType
    );

    if (violatingValue !== null) {
      // Threshold is violated (alert condition present)
      if (existingActiveAlert) {
        // Already flagged, skip to avoid duplicates/spam
        continue;
      }

      if (isCooldownActive(threshold.alertType)) continue;

      const now = new Date();
      const message = threshold.message(violatingValue);

      // Persist to database
      try {
        const newAlert = await prisma.systemAlert.create({
          data: {
            alertType: threshold.alertType,
            severity: threshold.severity,
            message,
            createdAt: now,
          },
        });

        // Update in-memory cache
        activeAlertsCache.push(newAlert);

        console.log(
          `[Alerts] 🚨 ${threshold.severity}: ${threshold.alertType} — ${message}`
        );

        // Send email notification via queue
        emailQueue?.add("sendAlert", {
          payload: {
            alertType: threshold.alertType,
            severity: threshold.severity,
            message,
            timestamp: now,
          }
        }).catch(err => console.error(`[Alerts] ❌ Error encolando correo para ${threshold.alertType}:`, err));

        // Record cooldown
        lastAlertTime.set(threshold.alertType, Date.now());
      } catch (err) {
        console.error(
          `[Alerts] ❌ Error guardando alerta ${threshold.alertType}:`,
          err instanceof Error ? err.message : err
        );
      }
    } else {
      // Threshold is normal (condition not present)
      if (existingActiveAlert) {
        const now = new Date();
        const msgResolved = `El estado del sistema para ${threshold.alertType} ha vuelto a la normalidad.`;

        try {
          // Resolve alert in DB
          await prisma.systemAlert.updateMany({
            where: { alertType: threshold.alertType, resolvedAt: null },
            data: { resolvedAt: now },
          });

          // Update in-memory cache
          activeAlertsCache = activeAlertsCache.filter(
            (a) => a.alertType !== threshold.alertType
          );

          console.log(`[Alerts] ✅ RESOLVED: ${threshold.alertType}`);

          // Send resolution email via queue
          emailQueue?.add("sendAlert", {
            payload: {
              alertType: `${threshold.alertType}_RESOLVED`,
              severity: threshold.severity,
              message: msgResolved,
              timestamp: now,
            }
          }).catch(err => console.error(`[Alerts] ❌ Error encolando correo de resolucion para ${threshold.alertType}:`, err));

          // Reset cooldown on resolution
          lastAlertTime.delete(threshold.alertType);
        } catch (err) {
          console.error(
            `[Alerts] ❌ Error resolviendo alerta ${threshold.alertType}:`,
            err instanceof Error ? err.message : err
          );
        }
      }
    }
  }
}

