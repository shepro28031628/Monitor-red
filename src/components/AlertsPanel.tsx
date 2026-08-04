"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Bell, CheckCircle, XCircle, Volume2, VolumeX } from "lucide-react";

interface Alert {
  id: number;
  alertType: string;
  severity: string | null;
  message: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

const SEVERITY_CONFIG: Record<string, { icon: React.ReactNode; colorCls: string; bgCls: string; borderCls: string; badgeCls: string }> = {
  Critical: {
    icon: <XCircle className="w-4 h-4" />,
    colorCls: "text-red-400",
    bgCls: "bg-red-500/10",
    borderCls: "border-red-500/30",
    badgeCls: "bg-red-500/15 text-red-300 border-red-500/30",
  },
  Warning: {
    icon: <AlertTriangle className="w-4 h-4" />,
    colorCls: "text-amber-400",
    bgCls: "bg-amber-500/10",
    borderCls: "border-amber-500/30",
    badgeCls: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  },
};

function getAlertLabel(alertType: string): string {
  const labels: Record<string, string> = {
    HIGH_CPU: "CPU Crítico",
    HIGH_CPU_WARNING: "CPU Elevado",
    LOW_MEMORY: "Memoria Baja",
    HIGH_TEMP: "Temperatura Crítica",
    HIGH_TEMP_WARNING: "Temperatura Elevada",
    PACKET_LOSS: "Pérdida de Paquetes",
    INTERNET_DOWN: "🔴 Internet Caído",
    INTERNET_DEGRADED: "⚠️ Internet Inestable",
    WAN1_DOWN: "WAN 1 Offline",
    WAN2_DOWN: "WAN 2 Offline",
    MIKROTIK_UNREACHABLE: "Router Inalcanzable",
  };
  return labels[alertType] || alertType;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Hace un momento";
  if (minutes < 60) return `Hace ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Hace ${days}d`;
}

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (sharedAudioCtx && sharedAudioCtx.state !== "closed") return sharedAudioCtx;
  const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtxClass) return null;
  sharedAudioCtx = new AudioCtxClass();
  return sharedAudioCtx;
}

function playAlertSound() {
  try {
    const audioCtx = getAudioContext();
    if (!audioCtx) return;
    if (audioCtx.state === "suspended") audioCtx.resume();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.type = "square";
    oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
    oscillator.frequency.setValueAtTime(0, audioCtx.currentTime + 0.1);
    oscillator.frequency.setValueAtTime(880, audioCtx.currentTime + 0.15);
    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.3);
  } catch (e) {
    console.error("Audio play failed", e);
  }
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Error al cargar alertas");
  return res.json();
};

export default function AlertsPanel({ fillHeight = false }: { fillHeight?: boolean }) {
  const { data: apiData } = useQuery({
    queryKey: ['alerts'],
    queryFn: () => fetcher("/api/alerts"),
    refetchInterval: 5000,
  });

  const alerts: Alert[] = React.useMemo(() => apiData?.data || [], [apiData?.data]);
  const prevAlertsRef = React.useRef<Alert[]>([]);
  const [isMuted, setIsMuted] = React.useState(true);

  const toggleMute = React.useCallback(() => {
    setIsMuted((prev) => {
      if (prev) {
        const ctx = getAudioContext();
        if (ctx?.state === "suspended") ctx.resume();
      }
      return !prev;
    });
  }, []);

  React.useEffect(() => {
    const prevAlerts = prevAlertsRef.current;
    if (alerts.length > 0) {
      const isNewAlert = prevAlerts.length === 0 || alerts[0].id !== prevAlerts[0].id;
      if (isNewAlert && prevAlerts.length !== 0 && !isMuted) playAlertSound();
    }
    prevAlertsRef.current = alerts;
  }, [alerts, isMuted]);

  const hasAlerts = alerts.length > 0;

  return (
    <div className={`card p-5 flex flex-col overflow-hidden ${fillHeight ? "h-full" : ""}`} style={{ minHeight: 0 }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-[var(--border-default)]">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-[10px] bg-[var(--bg-muted)] border border-[var(--border-default)]">
            <Bell className="w-4 h-4 text-amber-500" />
          </div>
          <h3 className="text-base font-semibold text-[var(--text-primary)] m-0">Alertas</h3>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleMute}
            title={isMuted ? "Activar sonido" : "Silenciar"}
            className={`p-2 rounded-lg cursor-pointer flex items-center justify-center border transition-colors ${
              isMuted
                ? "border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-muted)]"
                : "border-amber-500/30 bg-amber-500/10 text-amber-500"
            }`}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {!hasAlerts ? (
            <span className="text-[10px] uppercase tracking-widest font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-500">
              <CheckCircle className="w-3.5 h-3.5" /> OK
            </span>
          ) : (
            <span className="text-[10px] uppercase tracking-widest font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 bg-red-500/10 border border-red-500/30 text-red-400 animate-[pulse-glow_2s_ease-in-out_infinite]">
              <AlertTriangle className="w-3.5 h-3.5" /> Atención
            </span>
          )}
        </div>
      </div>

      {/* Alert List */}
      <div className="custom-scrollbar flex flex-col gap-3 overflow-y-auto flex-1 min-h-0">
        <AnimatePresence mode="popLayout">
          {!hasAlerts && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center justify-center py-10 text-center rounded-xl border border-dashed border-[var(--border-default)] bg-[var(--bg-muted)]"
            >
              <div className="p-4 rounded-full bg-emerald-500/10 mb-3">
                <CheckCircle className="w-10 h-10 text-emerald-500/50" />
              </div>
              <p className="text-sm font-semibold text-[var(--text-primary)] m-0">Sin alertas activas</p>
              <p className="text-[11px] text-[var(--text-muted)] mt-1 max-w-[200px]">
                Sistema y túneles VPN dentro de los umbrales normales.
              </p>
            </motion.div>
          )}

          {alerts.map((alert) => {
            const config = SEVERITY_CONFIG[alert.severity || "Warning"] || SEVERITY_CONFIG.Warning;
            return (
              <motion.div
                layout
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3, type: "spring", stiffness: 300, damping: 30 }}
                key={alert.id}
                className={`flex items-start gap-3 p-4 rounded-xl border ${config.bgCls} ${config.borderCls}`}
              >
                <div className={`shrink-0 mt-0.5 p-2 rounded-lg bg-white/5 border border-white/5 ${config.colorCls}`}>
                  {config.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[9px] uppercase tracking-widest font-bold px-2 py-0.5 rounded border ${config.badgeCls}`}>
                      {alert.severity}
                    </span>
                    <span className="text-sm font-semibold text-[var(--text-primary)]">
                      {getAlertLabel(alert.alertType || "")}
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed mt-1 break-words whitespace-pre-wrap">
                    {alert.message}
                  </p>
                  <div className="flex justify-end mt-2">
                    <span className="text-[9px] font-mono px-2 py-0.5 rounded text-[var(--text-muted)] bg-black/15">
                      {timeAgo(alert.createdAt)}
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
