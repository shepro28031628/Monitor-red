"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Header from "@/components/Header";
import SummaryRow from "@/components/SummaryRow";
import TrafficChart from "@/components/TrafficChart";
import ResourceChart from "@/components/ResourceChart";
import WanMonitors from "@/components/WanMonitors";
import AlertsPanel from "@/components/AlertsPanel";
import VpnDistribution from "@/components/VpnDistribution";
import { MonitorPlay, WifiOff } from "lucide-react";
import { TelemetryProvider, useTelemetry } from "@/components/TelemetryProvider";
import type { TelemetryData } from "@/components/TelemetryProvider";
import { NotificationProvider } from "@/components/NotificationProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// Permitir el tipo 'any' temporalmente para la estructura JSON
// Inner component that has access to TelemetryProvider context
function DashboardContent({ nocMode, enterNoc, exitNoc }: { nocMode: boolean; enterNoc: () => void; exitNoc: () => void }) {
  const { connectionStatus, consecutiveFailures } = useTelemetry();
  const isDisconnected = connectionStatus === 'disconnected';
  const isReconnecting = connectionStatus === 'reconnecting';
  const isError = connectionStatus === 'error';
  const showBanner = isDisconnected || isReconnecting || isError;

  const bannerMessage = isReconnecting
    ? `⚠️ RECONECTANDO AL MIKROTIK — Intento #${consecutiveFailures}. Los últimos datos conocidos se muestran a continuación.`
    : isError
    ? `⚠️ ERROR AL LEER DATOS — El monitor se reconectó pero falló al recolectar telemetría. Reintentando...`
    : `⚠️ CONEXIÓN PERDIDA — El monitor no puede comunicarse con el MikroTik. Reconectando...`;

  const bannerColor = isReconnecting ? 'rgba(245,158,11,0.95)' : 'rgba(239,68,68,0.95)';

  return (
    <>
      <AnimatePresence>
        {showBanner && (
          <motion.div
            initial={{ opacity: 0, y: -40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -40 }}
            transition={{ duration: 0.3 }}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 9999,
              background: bannerColor,
              backdropFilter: 'blur(8px)',
              borderBottom: `1px solid ${isReconnecting ? 'rgba(245,158,11,0.5)' : 'rgba(239,68,68,0.5)'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.75rem',
              padding: '0.625rem 1rem',
            }}
          >
            <WifiOff style={{ width: 18, height: 18, color: '#fff' }} />
            <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#fff', letterSpacing: '0.02em' }}>
              {bannerMessage}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {nocMode ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="w-full h-screen overflow-hidden flex flex-col bg-[var(--bg-base)]"
          style={{ paddingTop: isDisconnected ? '40px' : 0 }}
        >
          {/* NOC Top Bar */}
          <div className="flex items-center justify-between px-6 py-2 bg-[var(--bg-panel)] border-b border-[var(--border-default)] shrink-0">
            <div className="flex items-center gap-3">
              <MonitorPlay className="w-[20px] h-[20px] text-indigo-400" />
              <span className="text-xs font-bold tracking-[0.15em] uppercase text-[var(--text-secondary)]">
                NOC Operations Center
              </span>
              {isDisconnected ? (
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/25 ml-3 animate-pulse">
                  <WifiOff className="w-3 h-3 text-red-400" />
                  <span className="text-[10px] font-bold tracking-[0.1em] uppercase text-red-400">Sin Conexión</span>
                </span>
              ) : (
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 ml-3">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse-glow" />
                  <span className="text-[10px] font-bold tracking-[0.1em] uppercase text-emerald-500">En Vivo</span>
                </span>
              )}
            </div>
            <button
              onClick={exitNoc}
              className="text-xs font-semibold px-4 py-1.5 rounded-lg border border-indigo-500/35 text-indigo-400 bg-transparent cursor-pointer hover:bg-indigo-500/10 transition-colors"
            >
              Salir (Esc)
            </button>
          </div>

          <div className="flex-1 flex flex-col p-4 gap-4 overflow-hidden min-h-0">
            {/* KPI Cards row - Full size */}
            <div className="shrink-0">
              <ErrorBoundary>
                <SummaryRow />
              </ErrorBoundary>
            </div>

            {/* Main content grid */}
            <div className="flex-1 grid grid-cols-12 gap-4 min-h-0 overflow-hidden">
              {/* Left Column: Charts (takes 8 cols) */}
              <div className="col-span-8 flex flex-col gap-4 min-h-0">
                <div className="flex-1 min-h-0">
                  <ErrorBoundary><TrafficChart fillHeight /></ErrorBoundary>
                </div>
                <div className="flex-1 min-h-0">
                  <ErrorBoundary><ResourceChart fillHeight /></ErrorBoundary>
                </div>
              </div>

              {/* Right Column: Status Panels (takes 4 cols) */}
              <div className="col-span-4 flex flex-col gap-4 min-h-0">
                <div className="flex-1 min-h-0">
                  <ErrorBoundary><WanMonitors fillHeight carousel /></ErrorBoundary>
                </div>
                <div className="flex-1 min-h-0">
                  <ErrorBoundary><VpnDistribution fillHeight /></ErrorBoundary>
                </div>
                <div className="flex-[1.5] min-h-0">
                  <ErrorBoundary><AlertsPanel fillHeight /></ErrorBoundary>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      ) : (
        <div className="page-wrapper" style={{ paddingTop: isDisconnected ? '40px' : 0 }}>
          <Header onToggleNoc={enterNoc} />
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="page-content pt-12"
          >
            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05, duration: 0.45 }}
              className="mb-8"
            >
              <ErrorBoundary><SummaryRow /></ErrorBoundary>
            </motion.section>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.10, duration: 0.45 }}
              className="charts-row grid grid-cols-2 gap-6 mb-6"
            >
              <ErrorBoundary><TrafficChart /></ErrorBoundary>
              <ErrorBoundary><ResourceChart /></ErrorBoundary>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.45 }}
              className="bottom-row grid grid-cols-[1fr_340px_320px] gap-6 mb-8"
            >
              <ErrorBoundary><VpnDistribution /></ErrorBoundary>
              <ErrorBoundary><WanMonitors /></ErrorBoundary>
              <ErrorBoundary><AlertsPanel /></ErrorBoundary>
            </motion.div>
          </motion.div>
        </div>
      )}
    </>
  );
}

export default function DashboardLayout({ initialStat }: { initialStat?: TelemetryData }) {
  const [nocMode, setNocMode] = useState(false);

  const enterNoc = useCallback(async () => {
    setNocMode(true);
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      console.warn("[NOC] Browser denied fullscreen request.");
    }
  }, []);

  const exitNoc = useCallback(async () => {
    setNocMode(false);
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
    } catch { /* noop */ }
  }, []);

  useEffect(() => {
    const onFsChange = () => { if (!document.fullscreenElement && nocMode) setNocMode(false); };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, [nocMode]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && nocMode) exitNoc(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [nocMode, exitNoc]);

  return (
    <TelemetryProvider initialData={initialStat}>
      <NotificationProvider>
        <DashboardContent nocMode={nocMode} enterNoc={enterNoc} exitNoc={exitNoc} />
      </NotificationProvider>
    </TelemetryProvider>
  );
}
