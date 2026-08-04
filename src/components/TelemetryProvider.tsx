"use client";

import React, { createContext, useContext, useEffect, useState, useRef } from "react";

// ── VPN User type (mirrors worker/telemetry.ts VpnUserDetail) ────────
export interface VpnUserDetail {
  name: string;
  service: string;
  profile: string;
  callerID: string;
  address: string;
  uptime: string;
  connected: boolean;
  rxBytes?: number;
  txBytes?: number;
}

// ── Complete shape of the live telemetry SSE payload ─────────────────
// Mirrors TelemetrySnapshot in worker/telemetry.ts (bigints arrive as numbers over JSON)
export interface TelemetryData {
  cpuLoad: number;
  freeMemory: number;
  totalMemory: number;
  hddFree: number;
  hddTotal: number;
  temperature: number;
  voltage: number;
  uptime: string;
  wan1Rx: number;
  wan1Tx: number;
  wan2Rx: number;
  wan2Tx: number;
  vpnCount: number;
  activeConnections: number;
  wan1Ip: string;
  wan1Status: string;
  wan2Ip: string;
  wan2Status: string;
  pingAvgMs: number | null;
  pingLossPercent: number | null;
  vpnProfilesDetail: VpnUserDetail[];
  dhcpLeases: number;
  queueCount: number;
  // Active alerts embedded in the stream
  alerts?: LiveAlert[];
  // Worker metadata fields
  createdAt?: string;
  _workerStatus?: ConnectionStatus;
  _workerConsecutiveFailures?: number;
  _workerStatusAt?: string;
}

export interface LiveAlert {
  id: string;
  alertType: string;
  severity: "Warning" | "Critical";
  message: string;
  createdAt: string;
  resolvedAt: string | null;
}

export type ConnectionStatus = "connecting" | "connected" | "reconnecting" | "error" | "disconnected";

interface TelemetryContextValue {
  data: TelemetryData | null;
  error: Error | null;
  connectionStatus: ConnectionStatus;
  consecutiveFailures: number;
  lastUpdated: Date | null;
}

const TelemetryContext = createContext<TelemetryContextValue>({
  data: null,
  error: null,
  connectionStatus: "connecting",
  consecutiveFailures: 0,
  lastUpdated: null,
});

// If the file hasn't been updated in this long, the worker itself is dead/crashed
const WORKER_DEAD_THRESHOLD_MS = 30_000;

export function TelemetryProvider({ children, initialData }: { children: React.ReactNode, initialData?: TelemetryData }) {
  const [data, setData] = useState<TelemetryData | null>(initialData ?? null);
  const [error, setError] = useState<Error | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting");
  const [consecutiveFailures, setConsecutiveFailures] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const lastWorkerWriteRef = useRef<number | null>(null);

  // ── SSE stream for live telemetry data ────────────────────────────
  useEffect(() => {
    let es: EventSource | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout>;
    let reconnectDelay = 2000;
    let staleInterval: ReturnType<typeof setInterval> | null = null;

    const connect = () => {
      console.log(`[Telemetry] Connecting to SSE... (delay was ${reconnectDelay}ms)`);
      es = new EventSource("/api/telemetry/stream");

      es.onopen = () => {
        console.log("[Telemetry] SSE connection established.");
      };

      es.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data) as TelemetryData;
          const workerStatus: ConnectionStatus = parsed._workerStatus ?? "connected";
          const failures: number = parsed._workerConsecutiveFailures ?? 0;
          const statusAt: number = parsed._workerStatusAt
            ? new Date(parsed._workerStatusAt).getTime()
            : Date.now();

          lastWorkerWriteRef.current = statusAt;
          reconnectDelay = 2000;

          // If the data is fresh, trust _workerStatus directly
          const ageMs = Date.now() - statusAt;
          if (ageMs <= WORKER_DEAD_THRESHOLD_MS) {
            setConnectionStatus(workerStatus);
            setConsecutiveFailures(failures);
          } else {
            // Data is stale: worker is dead or crashed
            setConnectionStatus("disconnected");
            setConsecutiveFailures(0);
          }

          // Always update data regardless of connection status (show last known values)
          setData(parsed);
          setError(null);
          setLastUpdated(new Date());
        } catch {
          // Silently ignore parse errors
        }
      };

      es.onerror = (e) => {
        console.warn(`[Telemetry] SSE error — closing and reconnecting in ${reconnectDelay}ms`, e);
        es?.close();
        reconnectDelay = Math.min(reconnectDelay * 2, 30_000);
        reconnectTimeout = setTimeout(connect, reconnectDelay);
      };
    };

    // Stale check: if we haven't received ANY SSE message in 30s, mark as disconnected
    staleInterval = setInterval(() => {
      if (lastWorkerWriteRef.current === null) return;
      const ageMs = Date.now() - lastWorkerWriteRef.current;
      if (ageMs > WORKER_DEAD_THRESHOLD_MS) {
        setConnectionStatus("disconnected");
      }
    }, 5_000);

    connect();

    return () => {
      clearTimeout(reconnectTimeout);
      if (staleInterval) clearInterval(staleInterval);
      if (es) es.close();
    };
  }, []);

  return (
    <TelemetryContext.Provider value={{ data, error, connectionStatus, consecutiveFailures, lastUpdated }}>
      {children}
    </TelemetryContext.Provider>
  );
}

export function useTelemetry() {
  return useContext(TelemetryContext);
}
