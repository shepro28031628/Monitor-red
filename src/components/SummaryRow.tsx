"use client";

import React from "react";
import { useTelemetry } from "./TelemetryProvider";
import { motion } from "framer-motion";
import { Cpu, HardDrive, ShieldCheck, Wifi, Activity, Network, Zap, Thermometer, Clock, Server, Layers } from "lucide-react";



function formatMemory(bytes: number): string {
  if (!bytes) return "— GB";
  const gb = bytes / 1_073_741_824;
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / 1_048_576;
  return `${mb.toFixed(0)} MB`;
}

function formatHdd(bytes: number): string {
  if (!bytes) return "—";
  const mb = bytes / 1_048_576;
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb.toFixed(0)} MB`;
}

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

function getStatusConfig(value: number, warnAt: number, critAt: number, inverted = false) {
  const isGood = inverted ? value > critAt : value < warnAt;
  const isWarn = inverted
    ? value <= critAt && value > warnAt
    : value >= warnAt && value < critAt;

  if (isGood)  return { status: "Normal",  bgColor: "rgba(16,185,129,0.1)",  borderColor: "rgba(16,185,129,0.25)",  textColor: "#10b981" };
  if (isWarn)  return { status: "Elevado", bgColor: "rgba(245,158,11,0.1)",  borderColor: "rgba(245,158,11,0.25)",  textColor: "#f59e0b" };
  return         { status: "Crítico", bgColor: "rgba(239,68,68,0.1)",   borderColor: "rgba(239,68,68,0.25)",   textColor: "#ef4444" };
}

export default function SummaryRow({ compact = false }: { compact?: boolean }) {
  const { data } = useTelemetry();

  const cpuLoad         = data?.cpuLoad ?? 0;
  const freeMemory      = data?.freeMemory ?? 0;
  const totalMemory     = data?.totalMemory ?? 1;
  const hddFree         = data?.hddFree ?? 0;
  const hddTotal        = data?.hddTotal ?? 1;
  const memoryPct       = totalMemory > 0 ? (freeMemory / totalMemory) * 100 : 100;
  const hddPct          = hddTotal > 0 ? (hddFree / hddTotal) * 100 : 100;
  const pingMs          = data?.pingAvgMs ?? 0;
  const temperature     = data?.temperature ?? 0;
  const activeConnections = data?.activeConnections ?? 0;
  const vpnCount        = data?.vpnCount ?? 0;
  const voltage         = Number(data?.voltage ?? 0);
  const uptime          = formatUptime(data?.uptime ?? "—");
  const dhcpLeases      = data?.dhcpLeases ?? 0;
  const queueCount      = data?.queueCount ?? 0;
  const pingLoss        = data?.pingLossPercent ?? 0;

  const cpuConfig  = getStatusConfig(cpuLoad,   70, 85);
  const memConfig  = getStatusConfig(memoryPct, 30, 15, true);
  const pingConfig = getStatusConfig(pingMs,    50, 100);
  const tempConfig = getStatusConfig(temperature, 55, 65);
  const voltConfig = voltage > 0
    ? getStatusConfig(Math.abs(voltage - 24), 3, 5)
    : { status: "N/A", bgColor: "rgba(100,116,139,0.1)", borderColor: "rgba(100,116,139,0.2)", textColor: "var(--text-muted)" };

  const barColor = (pct: number) =>
    pct > 85 ? "#ef4444" : pct > 70 ? "#f59e0b" : "#6366f1";

  const kpis = [
    {
      label: "CPU Load",
      value: `${cpuLoad}%`,
      icon: <Cpu style={{ width: 18, height: 18, color: "#6366f1" }} />,
      ...cpuConfig,
      bar: cpuLoad,
      barColor: barColor(cpuLoad),
    },
    {
      label: "RAM Libre",
      value: formatMemory(freeMemory),
      subtitle: `de ${formatMemory(totalMemory)}`,
      icon: <HardDrive style={{ width: 18, height: 18, color: "#6366f1" }} />,
      ...memConfig,
      bar: 100 - memoryPct,
      barColor: memoryPct < 15 ? "#ef4444" : memoryPct < 30 ? "#f59e0b" : "#6366f1",
    },
    {
      label: "Disco Libre",
      value: formatHdd(hddFree),
      subtitle: `de ${formatHdd(hddTotal)}`,
      icon: <Server style={{ width: 18, height: 18, color: "#6366f1" }} />,
      status: hddPct > 30 ? "Normal" : "Bajo",
      bgColor: hddPct > 30 ? "rgba(100,116,139,0.1)" : "rgba(245,158,11,0.1)",
      borderColor: hddPct > 30 ? "rgba(100,116,139,0.2)" : "rgba(245,158,11,0.25)",
      textColor: hddPct > 30 ? "var(--text-muted)" : "#f59e0b",
      bar: 100 - hddPct,
      barColor: hddPct < 15 ? "#ef4444" : hddPct < 30 ? "#f59e0b" : "#6366f1",
    },
    {
      label: "Latencia",
      value: pingMs > 0 ? `${Number(pingMs).toFixed(1)} ms` : "— ms",
      subtitle: pingLoss > 0 ? `${pingLoss}% pérdida` : undefined,
      icon: <Wifi style={{ width: 18, height: 18, color: "#6366f1" }} />,
      ...pingConfig,
    },
    {
      label: "Temperatura",
      value: temperature > 0 ? `${temperature}°C` : "— °C",
      icon: <Thermometer style={{ width: 18, height: 18, color: "#6366f1" }} />,
      ...tempConfig,
    },
    {
      label: "Voltaje",
      value: voltage > 0 ? `${voltage.toFixed(1)} V` : "— V",
      icon: <Zap style={{ width: 18, height: 18, color: "#6366f1" }} />,
      ...voltConfig,
    },
    {
      label: "Uptime",
      value: uptime,
      icon: <Clock style={{ width: 18, height: 18, color: "#6366f1" }} />,
      status: "Activo",
      bgColor: "rgba(16,185,129,0.1)",
      borderColor: "rgba(16,185,129,0.25)",
      textColor: "#10b981",
    },
    {
      label: "Conex. Activas",
      value: activeConnections.toString(),
      icon: <Activity style={{ width: 18, height: 18, color: "#6366f1" }} />,
      status: "Activo",
      bgColor: "rgba(16,185,129,0.1)",
      borderColor: "rgba(16,185,129,0.25)",
      textColor: "#10b981",
    },
    {
      label: "VPN Online",
      value: vpnCount.toString(),
      icon: <Network style={{ width: 18, height: 18, color: "#6366f1" }} />,
      status: vpnCount > 0 ? "Activo" : "Sin conex.",
      bgColor: vpnCount > 0 ? "rgba(16,185,129,0.1)" : "rgba(100,116,139,0.1)",
      borderColor: vpnCount > 0 ? "rgba(16,185,129,0.25)" : "rgba(100,116,139,0.2)",
      textColor: vpnCount > 0 ? "#10b981" : "var(--text-muted)",
    },
    {
      label: "DHCP Leases",
      value: dhcpLeases.toString(),
      icon: <ShieldCheck style={{ width: 18, height: 18, color: "#6366f1" }} />,
      status: dhcpLeases > 0 ? "Activo" : "Sin asignar",
      bgColor: dhcpLeases > 0 ? "rgba(16,185,129,0.1)" : "rgba(100,116,139,0.1)",
      borderColor: dhcpLeases > 0 ? "rgba(16,185,129,0.25)" : "rgba(100,116,139,0.2)",
      textColor: dhcpLeases > 0 ? "#10b981" : "var(--text-muted)",
    },
  ];

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0 },
        show: { opacity: 1, transition: { staggerChildren: 0.04 } },
      }}
      initial="hidden"
      animate="show"
      style={{
        display: "grid",
        gridTemplateColumns: compact
          ? "repeat(11, minmax(0, 1fr))"
          : "repeat(auto-fill, minmax(160px, 1fr))",
        gap: compact ? "0.375rem" : "1rem",
      }}
    >
      {kpis.map((kpi, idx) => (
        <motion.div
          variants={{
            hidden: { opacity: 0, y: 12 },
            show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 280, damping: 22 } },
          }}
          key={idx}
          className="card-kpi"
          style={{
            padding: compact ? "0.375rem 0.625rem" : "1rem",
            display: "flex",
            flexDirection: compact ? "row" : "column",
            alignItems: compact ? "center" : undefined,
            justifyContent: compact ? "space-between" : "space-between",
            gap: compact ? "0.375rem" : undefined,
            borderRadius: compact ? "0.5rem" : "0.875rem",
          }}
        >
          <div style={{ display: "flex", justifyContent: compact ? "flex-start" : "space-between", alignItems: "center", gap: "0.375rem", flex: compact ? 1 : undefined, marginBottom: compact ? 0 : "0.75rem", minWidth: 0 }}>
            {compact && <div style={{ flexShrink: 0 }}>{kpi.icon}</div>}
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{ fontSize: compact ? "0.5625rem" : "0.625rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", marginBottom: "0.1rem" }}>
                {kpi.label}
              </p>
              <h3 style={{ fontSize: compact ? "1rem" : "1.2rem", fontWeight: 700, lineHeight: 1.1, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {kpi.value}
              </h3>
            </div>
            {!compact && (
              <div style={{ padding: "0.5rem", borderRadius: "0.5rem", flexShrink: 0, background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)" }}>
                {kpi.icon}
              </div>
            )}
          </div>

          <div style={{ marginTop: compact ? 0 : "auto" }}>
            {!compact && "bar" in kpi && kpi.bar !== undefined && (
              <div style={{ width: "100%", height: 4, borderRadius: 2, overflow: "hidden", background: "var(--border-default)", marginBottom: "0.625rem" }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, kpi.bar as number)}%` }}
                  transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
                  style={{ height: "100%", borderRadius: 2, background: (kpi as { barColor?: string }).barColor ?? "#6366f1" }}
                />
              </div>
            )}
            <span style={{
              fontSize: compact ? "0.5625rem" : "0.5625rem",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              fontWeight: 700,
              padding: compact ? "0.125rem 0.375rem" : "0.25rem 0.5rem",
              borderRadius: "0.25rem",
              border: `1px solid ${kpi.borderColor}`,
              background: kpi.bgColor,
              color: kpi.textColor,
              display: "inline-flex",
              alignItems: "center",
              whiteSpace: "nowrap",
            }}>
              {kpi.status}
            </span>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}
