"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ChartOptions,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { Activity } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

interface HistoryItem {
  time?: string;
  createdAt?: string;
  pingAvgMs: number;
  pingLossPercent: number;
}

const RANGES = [
  { label: "1h", minutes: 60 },
  { label: "6h", minutes: 360 },
  { label: "24h", minutes: 1440 },
  { label: "7d", minutes: 10080 },
];

export default function PingChart({ fillHeight = false }: { fillHeight?: boolean }) {
  const [range, setRange] = useState(60);
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const { data: queryData, isLoading: loading } = useQuery({
    queryKey: ['ping-history', range],
    queryFn: async () => {
      const res = await fetch(`/api/telemetry/history?minutes=${range}`);
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        return [];
      }
      const json = await res.json();
      if (Array.isArray(json)) return json;
      if (json && Array.isArray(json.data)) return json.data;
      return [];
    },
    refetchInterval: 60000,
  });

  const history = queryData || [];

  const gridColor = isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(15, 23, 42, 0.05)";
  const tickColor = isDark ? "rgba(255, 255, 255, 0.5)" : "rgba(15, 23, 42, 0.5)";

  const options: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: "index",
      intersect: false,
    },
    plugins: {
      legend: {
        display: true,
        position: "top",
        labels: {
          color: tickColor,
          usePointStyle: true,
          boxWidth: 8,
          font: { family: "Inter, sans-serif", size: 11 },
        },
      },
      tooltip: {
        backgroundColor: isDark ? "rgba(15,23,42,0.9)" : "rgba(255,255,255,0.9)",
        titleColor: isDark ? "#fff" : "#0f172a",
        bodyColor: isDark ? "#cbd5e1" : "#475569",
        borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(15,23,42,0.1)",
        borderWidth: 1,
        padding: 10,
        boxPadding: 4,
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: tickColor, maxTicksLimit: range === 0 ? 6 : range <= 360 ? 6 : 10 },
      },
      y: {
        type: "linear",
        display: true,
        position: "left",
        grid: { color: gridColor },
        ticks: { color: tickColor, font: { size: 10 }, callback: (val) => `${val}ms` },
        min: 0,
      },
      y1: {
        type: "linear",
        display: true,
        position: "right",
        grid: { display: false },
        ticks: { color: tickColor, font: { size: 10 }, callback: (val) => `${val}%` },
        min: 0,
        max: 100,
      },
    },
    elements: {
      point: { radius: 0, hitRadius: 10, hoverRadius: 4 },
      line: { tension: 0.4 },
    },
  };

  const getLabel = (item: HistoryItem) => {
    const raw = item.time || item.createdAt;
    if (!raw) return "";
    const date = new Date(raw);
    if (isNaN(date.getTime())) return "";
    // Use UTC to avoid timezone discrepancies
    const timeOptions: Intl.DateTimeFormatOptions = {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "UTC",
    };
    // 1‑hour range: round to the nearest minute for cleaner labels
    if (range === 60) {
      const rounded = new Date(date);
      rounded.setSeconds(0, 0);
      return rounded.toLocaleTimeString("es-CO", timeOptions);
    }
    if (range >= 10080) {
      // 7 days or more: show only month/day in UTC
      return date.toLocaleDateString("es-CO", { month: "2-digit", day: "2-digit", timeZone: "UTC" });
    }
    if (range >= 1440) {
      // 1 day to <7 days: show date and time in UTC
      return date.toLocaleString("es-CO", { month: "2-digit", day: "2-digit", ...timeOptions });
    }
    // Less than 1 day (except 1‑hour handled above): show time only in UTC
    return date.toLocaleTimeString("es-CO", timeOptions);
  };

  const data = {
    labels: Array.isArray(history) ? history.map(getLabel) : [],
    datasets: [
      {
        label: "Latencia Promedio (ms)",
        data: Array.isArray(history) ? history.map((d) => d.pingAvgMs) : [],
        borderColor: "#f59e0b",
        backgroundColor: "rgba(245, 158, 11, 0.1)",
        borderWidth: 2,
        fill: true,
        yAxisID: "y",
      },
      {
        label: "Pérdida de Paquetes (%)",
        data: Array.isArray(history) ? history.map((d) => d.pingLossPercent) : [],
        borderColor: "#ef4444",
        backgroundColor: "rgba(239, 68, 68, 0.0)",
        borderWidth: 2,
        borderDash: [5, 5],
        fill: false,
        yAxisID: "y1",
      },
    ],
  };

  const rangeLabel = RANGES.find(r => r.minutes === range)?.label ?? "1h";

  return (
    <div className="card" style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.5rem", height: fillHeight ? "100%" : "auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div style={{ padding: "0.5rem", borderRadius: "0.625rem", background: "rgba(245, 158, 11, 0.1)", border: "1px solid rgba(245, 158, 11, 0.25)" }}>
            <Activity style={{ width: 18, height: 18, color: "#f59e0b" }} />
          </div>
          <div>
            <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)" }}>Latencia y Pérdida de Ping</h3>
            <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginTop: 2 }}>
              Historial de la última {rangeLabel} hacia 8.8.8.8 / 1.1.1.1
            </p>
          </div>
        </div>

        {/* Range selector */}
        <div style={{ display: "flex", gap: "0.375rem" }}>
          {RANGES.map((r) => (
            <button
              key={r.minutes}
              onClick={() => setRange(r.minutes)}
              style={{
                padding: "0.3rem 0.75rem",
                borderRadius: "0.5rem",
                border: "1px solid",
                fontSize: "0.75rem",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s",
                borderColor: range === r.minutes ? "#f59e0b" : "var(--border-default)",
                background: range === r.minutes ? "rgba(245,158,11,0.15)" : "var(--bg-surface)",
                color: range === r.minutes ? "#f59e0b" : "var(--text-secondary)",
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 250, position: "relative" }}>
        {loading && (
          <div style={{ position: "absolute", top: 8, right: 8, fontSize: "0.7rem", color: "var(--text-muted)" }}>
            Cargando...
          </div>
        )}
        {Array.isArray(history) && history.length > 0 ? (
          <Line options={options} data={data} />
        ) : (
          <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: "0.875rem" }}>
            Esperando datos históricos...
          </div>
        )}
      </div>
    </div>
  );
}
