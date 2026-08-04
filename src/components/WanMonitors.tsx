"use client";

import React, { useState, useEffect, useRef } from "react";
import { useTelemetry } from "./TelemetryProvider";
import { Activity, Globe, ArrowUpRight, ArrowDownRight, Shield, ChevronLeft, ChevronRight } from "lucide-react";

function formatUptime(uptimeStr: string): string {
  if (!uptimeStr || uptimeStr === "—") return "—";
  let formatted = uptimeStr;
  formatted = formatted.replace(/w/g, " sem ");
  formatted = formatted.replace(/d/g, " d ");
  formatted = formatted.replace(/h/g, " h ");
  formatted = formatted.replace(/m/g, " m ");
  formatted = formatted.replace(/s/g, " s");
  return formatted.trim().replace(/\s+/g, ' ');
}

interface WanData {
  name: string;
  status: string;
  ip: string;
  uptime: string;
  speedRx: string;
  speedTx: string;
  isOnline: boolean;
}

function WanCard({ wan, className }: { wan: WanData; className?: string }) {
  const onlineCls = {
    icon: "bg-emerald-500/10 border border-emerald-500/25 text-emerald-500",
    badge: "bg-emerald-500/10 border border-emerald-500/30 text-emerald-500",
    glow: "shadow-[0_0_30px_rgba(16,185,129,0.15)]",
  };
  const offlineCls = {
    icon: "bg-red-500/10 border border-red-500/25 text-red-500",
    badge: "bg-red-500/10 border border-red-500/30 text-red-500",
    glow: "shadow-[0_0_30px_rgba(239,68,68,0.1)]",
  };
  const cls = wan.isOnline ? onlineCls : offlineCls;

  return (
    <div className={`card p-4 flex flex-col gap-3 ${cls.glow} ${className ?? ""}`}>
      {/* Header */}
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-[10px] ${cls.icon}`}>
            {wan.isOnline
              ? <Globe className="w-4 h-4" />
              : <Shield className="w-4 h-4" />}
          </div>
          <div>
            <h4 className="font-semibold text-sm text-[var(--text-primary)] m-0">{wan.name}</h4>
            <p className="text-xs font-mono mt-0.5 text-[var(--text-muted)]">{wan.ip}</p>
          </div>
        </div>
        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 ${cls.badge}`}>
          {wan.isOnline && <span className="w-1.5 h-1.5 rounded-full bg-current inline-block animate-pulse" />}
          {wan.status}
        </span>
      </div>

      {/* Speed */}
      <div className="grid grid-cols-2 gap-2">
        <div className="p-3 rounded-lg bg-[var(--bg-muted)] border border-[var(--border-default)]">
          <div className="flex items-center gap-1.5 text-[var(--text-muted)] mb-1.5">
            <ArrowDownRight className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-[10px] uppercase tracking-wider font-semibold">Descarga</span>
          </div>
          <p className="text-base font-bold text-[var(--text-primary)] m-0">{wan.speedRx}</p>
        </div>
        <div className="p-3 rounded-lg bg-[var(--bg-muted)] border border-[var(--border-default)]">
          <div className="flex items-center gap-1.5 text-[var(--text-muted)] mb-1.5">
            <ArrowUpRight className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-[10px] uppercase tracking-wider font-semibold">Subida</span>
          </div>
          <p className="text-base font-bold text-[var(--text-primary)] m-0">{wan.speedTx}</p>
        </div>
      </div>

      {/* Uptime */}
      <div className="flex justify-between items-center pt-2 border-t border-[var(--border-subtle)]">
        <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
          <Activity className="w-3.5 h-3.5" />
          <span className="text-[10px] uppercase tracking-wider font-semibold">Uptime</span>
        </div>
        <span className="text-xs font-mono px-2 py-1 rounded text-[var(--text-secondary)] bg-[var(--bg-muted)]">
          {wan.uptime}
        </span>
      </div>
    </div>
  );
}

export default function WanMonitors({ fillHeight = false, carousel = false }: { fillHeight?: boolean; carousel?: boolean }) {
  const { data } = useTelemetry();
  const [current, setCurrent] = useState(0);
  const [visibleIdx, setVisibleIdx] = useState(0);
  const [hiddenIdx, setHiddenIdx] = useState(1);
  const [fading, setFading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const wans: WanData[] = [
    {
      name: "WAN 1 — Principal",
      status: data?.wan1Status || "Cargando...",
      ip: data?.wan1Ip || "Desconocida",
      uptime: formatUptime(data?.uptime || "—"),
      speedRx: data ? `${(data.wan1Rx / 1000000).toFixed(2)} Mbps` : "0.00 Mbps",
      speedTx: data ? `${(data.wan1Tx / 1000000).toFixed(2)} Mbps` : "0.00 Mbps",
      isOnline: data?.wan1Status === "Online",
    },
    {
      name: "WAN 2 — Backup",
      status: data?.wan2Status || "Cargando...",
      ip: data?.wan2Ip || "Desconocida",
      uptime: formatUptime(data?.uptime || "—"),
      speedRx: data ? `${(data.wan2Rx / 1000000).toFixed(2)} Mbps` : "0.00 Mbps",
      speedTx: data ? `${(data.wan2Tx / 1000000).toFixed(2)} Mbps` : "0.00 Mbps",
      isOnline: data?.wan2Status === "Online",
    },
  ];

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      navigate(1);
    }, 6000);
  };

  useEffect(() => {
    if (!carousel) return;
    startTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [carousel, current]);

  const navigate = (delta: number) => {
    if (fading) return;
    const next = (current + delta + wans.length) % wans.length;
    setHiddenIdx(next);
    setFading(true);
    setTimeout(() => {
      setVisibleIdx(next);
      setCurrent(next);
      setFading(false);
    }, 500);
  };

  const goTo = (idx: number) => {
    if (idx === current || fading) return;
    navigate(idx - current);
    startTimer();
  };

  // ── Normal (non-carousel) mode ──────────────────────────────────────
  if (!carousel) {
    return (
      <div
        className={`custom-scrollbar flex flex-col gap-3 ${fillHeight ? "h-full overflow-y-auto" : ""}`}
      >
        {wans.map((wan, idx) => (
          <WanCard key={idx} wan={wan} />
        ))}
      </div>
    );
  }

  // ── Carousel mode (NOC) ─────────────────────────────────────────────
  return (
    <div className={`flex flex-col gap-3 ${fillHeight ? "h-full" : ""}`}>
      {/* Crossfade container */}
      <div className="flex-1 relative min-h-0">
        {/* Background card (next) */}
        <div
          className="absolute inset-0 pointer-events-none transition-opacity duration-500"
          style={{ opacity: fading ? 1 : 0 }}
        >
          <WanCard wan={wans[hiddenIdx]} className="h-full" />
        </div>
        {/* Foreground card (current) */}
        <div
          className="absolute inset-0 transition-opacity duration-500"
          style={{ opacity: fading ? 0 : 1 }}
        >
          <WanCard wan={wans[visibleIdx]} className="h-full" />
        </div>
      </div>

      {/* Controls */}
      <div className="flex justify-between items-center shrink-0">
        {/* Dots */}
        <div className="flex gap-1.5 items-center">
          {wans.map((w, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              title={w.name}
              className="h-2 rounded-full border-none cursor-pointer transition-all duration-400"
              style={{
                width: i === current ? 22 : 8,
                background: i === current
                  ? (w.isOnline ? "#10b981" : "#ef4444")
                  : "var(--border-default)",
              }}
            />
          ))}
        </div>

        {/* Arrows */}
        <div className="flex gap-1.5">
          <button
            onClick={() => { navigate(-1); startTimer(); }}
            className="w-7 h-7 rounded-lg border border-[var(--border-default)] bg-[var(--bg-muted)] text-[var(--text-muted)] cursor-pointer flex items-center justify-center transition-all hover:border-[var(--border-accent)] hover:text-[var(--text-primary)]"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => { navigate(1); startTimer(); }}
            className="w-7 h-7 rounded-lg border border-[var(--border-default)] bg-[var(--bg-muted)] text-[var(--text-muted)] cursor-pointer flex items-center justify-center transition-all hover:border-[var(--border-accent)] hover:text-[var(--text-primary)]"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
