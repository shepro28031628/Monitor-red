"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useTelemetry } from "./TelemetryProvider";
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
} from "chart.js";
import { Line } from "react-chartjs-2";
import { useTheme } from "@/components/ThemeProvider";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function TrafficChart({ fillHeight = false }: { fillHeight?: boolean }) {
  const [timeframe, setTimeframe] = React.useState<number>(0);
  const { theme } = useTheme();
  const isLight = theme === "light";
  
  const { data: apiData } = useQuery({
    queryKey: ['telemetry-history', timeframe],
    queryFn: () => fetcher(`/api/telemetry/history?minutes=${timeframe}`),
    refetchInterval: false,
  });

  const { data: liveData } = useTelemetry();
  const [chartHistory, setChartHistory] = React.useState<any[]>([]);

  React.useEffect(() => {
    if (apiData?.data) {
      setChartHistory(apiData.data);
    }
  }, [apiData]);

  React.useEffect(() => {
    if (timeframe === 0 && liveData) {
      setChartHistory(prev => {
        // if the new point is already there, skip (based on createdAt)
        if (prev.length > 0 && prev[prev.length - 1].createdAt === liveData.createdAt) return prev;
        const next = [...prev, liveData];
        if (next.length > 20) return next.slice(next.length - 20);
        return next;
      });
    }
  }, [liveData, timeframe]);

  const [mountTime] = React.useState(() => Date.now());

  const rawData = chartHistory.length > 0 ? chartHistory : (timeframe === 0 ? Array.from({ length: 20 }, (_, i) => ({
    createdAt: new Date(mountTime - (20 - i) * 2000),
    wan1Rx: 0,
    wan1Tx: 0,
    wan2Rx: 0,
    wan2Tx: 0,
  })) : []);

  const chartData = {
    labels: rawData.map((d: { createdAt: string | Date }) => {
      const date = new Date(d.createdAt);
      if (timeframe > 1440) {
        // For 7D or 30D, show day and hour (e.g. "Lun 14:00" or "Jun 25")
        if (timeframe > 10080) {
          return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
        }
        return date.toLocaleDateString([], { weekday: 'short', hour: '2-digit' });
      }
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }),
    datasets: [
      {
        label: "WAN 1 - Descarga (Rx)",
        data: rawData.map((d: { wan1Rx: number }) => (d.wan1Rx || 0) / 1000000),
        borderColor: "rgb(59, 130, 246)", // blue-500
        backgroundColor: "rgba(59, 130, 246, 0.06)",
        fill: true,
        tension: 0.4,
        pointRadius: timeframe === 0 ? 0 : 2,
        pointHoverRadius: 4,
      },
      {
        label: "WAN 1 - Subida (Tx)",
        data: rawData.map((d: { wan1Tx: number }) => (d.wan1Tx || 0) / 1000000),
        borderColor: "rgb(168, 85, 247)", // purple-500
        backgroundColor: "rgba(168, 85, 247, 0.06)",
        fill: true,
        tension: 0.4,
        pointRadius: timeframe === 0 ? 0 : 2,
        pointHoverRadius: 4,
      },
      {
        label: "WAN 2 - Descarga (Rx)",
        data: rawData.map((d: { wan2Rx: number }) => (d.wan2Rx || 0) / 1000000),
        borderColor: "rgb(6, 182, 212)", // cyan-500
        backgroundColor: "rgba(6, 182, 212, 0.06)",
        fill: true,
        tension: 0.4,
        pointRadius: timeframe === 0 ? 0 : 2,
        pointHoverRadius: 4,
      },
      {
        label: "WAN 2 - Subida (Tx)",
        data: rawData.map((d: { wan2Tx: number }) => (d.wan2Tx || 0) / 1000000),
        borderColor: "rgb(20, 184, 166)", // teal-500
        backgroundColor: "rgba(20, 184, 166, 0.06)",
        fill: true,
        tension: 0.4,
        pointRadius: timeframe === 0 ? 0 : 2,
        pointHoverRadius: 4,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top" as const,
        labels: {
          color: isLight ? "rgba(15, 23, 42, 0.7)" : "rgba(255, 255, 255, 0.7)",
          font: { family: "var(--font-inter)", size: 11 },
          usePointStyle: true,
          boxWidth: 8,
          padding: 20,
        },
      },
      tooltip: {
        mode: "index" as const,
        intersect: false,
        backgroundColor: isLight ? "rgba(255, 255, 255, 0.95)" : "rgba(15, 23, 42, 0.95)",
        titleColor: isLight ? "#0f172a" : "#fff",
        bodyColor: isLight ? "#475569" : "rgba(255,255,255,0.8)",
        borderColor: isLight ? "rgba(15, 23, 42, 0.1)" : "rgba(255,255,255,0.08)",
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8,
      },
    },
    scales: {
      y: {
        grid: {
          color: isLight ? "rgba(15, 23, 42, 0.05)" : "rgba(255, 255, 255, 0.03)",
          drawBorder: false,
        },
        ticks: {
          color: isLight ? "rgba(15, 23, 42, 0.5)" : "rgba(255, 255, 255, 0.4)",
          font: { size: 10 },
          callback: function (value: string | number) {
            return value + " Mbps";
          },
        },
      },
      x: {
        grid: {
          display: false,
          drawBorder: false,
        },
        ticks: {
          color: isLight ? "rgba(15, 23, 42, 0.5)" : "rgba(255, 255, 255, 0.4)",
          font: { size: 10 },
          maxTicksLimit: timeframe === 0 ? 6 : 10,
          maxRotation: 0,
        },
      },
    },
    interaction: {
      mode: "nearest" as const,
      axis: "x" as const,
      intersect: false,
    },
  };

  const btnStyle = (active: boolean): React.CSSProperties => ({
    fontSize: "0.625rem",
    fontWeight: 500,
    padding: "0.25rem 0.625rem",
    borderRadius: "0.375rem",
    border: "none",
    cursor: "pointer",
    transition: "all 0.15s",
    background: active ? "rgba(99,102,241,0.18)" : "transparent",
    color: active ? "#818cf8" : "var(--text-muted)",
  });

  return (
    <div className="glass-card" style={{ padding: "1.25rem", display: "flex", flexDirection: "column", height: fillHeight ? "100%" : 300, minHeight: 0, overflow: "hidden" }}>
      <div style={{ marginBottom: "1rem", display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: "1rem", borderBottom: "1px solid var(--border-default)" }}>
        <div>
          <h3 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>Tráfico de Red</h3>
          <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>Ancho de banda WAN</p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <div style={{ display: "flex", padding: "0.25rem", borderRadius: "0.5rem", background: "var(--bg-muted)", border: "1px solid var(--border-default)" }}>
            {[{ label: "Vivo", val: 0 }, { label: "1H", val: 60 }, { label: "6H", val: 360 }, { label: "24H", val: 1440 }, { label: "7D", val: 10080 }, { label: "30D", val: 43200 }].map(t => (
              <button key={t.val} onClick={() => setTimeframe(t.val)} style={btnStyle(timeframe === t.val)}>{t.label}</button>
            ))}
          </div>
          {timeframe === 0 && (
            <span style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)", padding: "0.375rem 0.75rem", borderRadius: 999 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981", display: "inline-block", animation: "pulse-glow 2s ease-in-out infinite" }} />
              <span style={{ fontSize: "0.625rem", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, color: "#10b981" }}>En Vivo</span>
            </span>
          )}
        </div>
      </div>
      <div style={{ flex: 1, width: "100%", position: "relative", paddingTop: "0.5rem" }}>
        <Line data={chartData} options={options} />
      </div>
    </div>
  );
}
