"use client";

import React, { useState, useMemo } from "react";
import { useTelemetry } from "./TelemetryProvider";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { Doughnut } from "react-chartjs-2";
import { Network, Wifi, WifiOff, Filter } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";

ChartJS.register(ArcElement, Tooltip, Legend);



interface VpnUser {
  name: string;
  service: string;
  profile: string;
  callerID: string;
  address: string;
  uptime: string;
  connected: boolean;
}

export default function VpnDistribution({ fillHeight = false }: { fillHeight?: boolean }) {
  const { data } = useTelemetry();
  const [showAll, setShowAll] = useState(false);
  const [sortBy, setSortBy] = useState<"name" | "status">("status");
  const [filterProfile, setFilterProfile] = useState<string>("all");
  const { theme } = useTheme();
  const isLight = theme === "light";

  const vpnUsers: VpnUser[] = useMemo(() => data?.vpnProfilesDetail || [], [data?.vpnProfilesDetail]);
  const connectedUsers = vpnUsers.filter(u => u.connected);
  const disconnectedUsers = vpnUsers.filter(u => !u.connected);
  const totalSecrets = vpnUsers.length;
  const totalConnected = connectedUsers.length;
  const totalDisconnected = disconnectedUsers.length;

  // Get unique profiles (organizations like Nueva EPS, Colpensiones, etc.)
  const profileTypes = useMemo(() => {
    const types = new Set<string>();
    vpnUsers.forEach(u => {
      if (u.profile) types.add(u.profile);
    });
    return Array.from(types).sort();
  }, [vpnUsers]);

  // Chart: group connected users by profile
  const profileCounts: Record<string, number> = {};
  connectedUsers.forEach(u => {
    const p = u.profile || "default";
    profileCounts[p] = (profileCounts[p] || 0) + 1;
  });

  const profileLabels = Object.keys(profileCounts);
  const profileData = Object.values(profileCounts);

  // Build display list: filter by status, then by service type
  let displayList = showAll ? [...vpnUsers] : [...connectedUsers];

  if (filterProfile !== "all") {
    displayList = displayList.filter(u => u.profile === filterProfile);
  }

  if (sortBy === "name") {
    displayList.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  } else if (sortBy === "status") {
    displayList.sort((a, b) => {
      if (a.connected === b.connected) return (a.name || "").localeCompare(b.name || "");
      return a.connected ? -1 : 1;
    });
  }

  const chartColors = [
    "rgba(99, 102, 241, 0.8)",
    "rgba(59, 130, 246, 0.8)",
    "rgba(14, 165, 233, 0.8)",
    "rgba(168, 85, 247, 0.8)",
    "rgba(139, 92, 246, 0.8)",
    "rgba(45, 212, 191, 0.8)",
  ];

  const chartData = {
    labels: profileLabels.length > 0 ? profileLabels : ["Sin conexiones"],
    datasets: [
      {
        data: profileData.length > 0 ? profileData : [1],
        backgroundColor: profileLabels.length > 0 ? chartColors.slice(0, profileLabels.length) : ["rgba(100,100,100,0.2)"],
        borderColor: profileLabels.length > 0 ? chartColors.slice(0, profileLabels.length).map(c => c.replace("0.8", "1")) : ["rgba(100,100,100,0.3)"],
        borderWidth: 1,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "72%",
    plugins: {
      legend: {
        position: "bottom" as const,
        labels: {
          color: isLight ? "rgba(15, 23, 42, 0.7)" : "rgba(255, 255, 255, 0.7)",
          font: { size: 10 },
          padding: 12,
        },
      },
      tooltip: {
        backgroundColor: isLight ? "rgba(255, 255, 255, 0.95)" : "rgba(15, 23, 42, 0.95)",
        titleColor: isLight ? "#0f172a" : "#fff",
        bodyColor: isLight ? "#475569" : "rgba(255,255,255,0.8)",
        borderColor: isLight ? "rgba(15, 23, 42, 0.1)" : "rgba(255,255,255,0.1)",
        borderWidth: 1,
      },
    },
  };

  // Count helpers for filter badges
  const connectedByProfile = (profile: string) => connectedUsers.filter(u => u.profile === profile).length;
  const totalByProfile = (profile: string) => vpnUsers.filter(u => u.profile === profile).length;

  return (
    <div className="card" style={{ padding: "1.25rem", display: "flex", flexDirection: "column", height: fillHeight ? "100%" : undefined, minHeight: 0, overflow: "hidden" }}>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between flex-shrink-0 pb-4" style={{ borderBottom: '1px solid var(--border-default)' }}>
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg" style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)' }}>
            <Network className="w-4 h-4 text-indigo-400" />
          </div>
          <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>VPN (PPP Secrets)</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', color: '#10b981' }}>
            {totalConnected} Online
          </span>
          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full" style={{ background: 'var(--bg-muted)', border: '1px solid var(--border-default)', color: 'var(--text-muted)' }}>
            {totalDisconnected} Offline
          </span>
        </div>
      </div>

      {/* Chart */}
      <div style={{ position: "relative", width: "100%", height: 150, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginBottom: "0.75rem" }}>
        <Doughnut data={chartData} options={options} />
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none", paddingBottom: "1.5rem" }}>
          <span style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--text-primary)" }}>{totalConnected}</span>
          <span style={{ fontSize: "0.625rem", color: "var(--text-muted)" }}>de {totalSecrets}</span>
        </div>
      </div>

      {/* Profile Filter */}
      {profileTypes.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.375rem", marginBottom: "0.75rem", flexShrink: 0 }}>
          <Filter style={{ width: 14, height: 14, color: "var(--text-muted)", marginRight: 4 }} />
          <button
            onClick={() => setFilterProfile("all")}
            style={{ fontSize: "0.625rem", fontWeight: 500, padding: "0.25rem 0.625rem", borderRadius: "0.375rem", border: `1px solid ${filterProfile === "all" ? "rgba(99,102,241,0.4)" : "var(--border-default)"}`, background: filterProfile === "all" ? "rgba(99,102,241,0.18)" : "transparent", color: filterProfile === "all" ? "#818cf8" : "var(--text-muted)", cursor: "pointer" }}
          >
            Todos ({showAll ? totalSecrets : totalConnected})
          </button>
          {profileTypes.map(profile => {
            const count = showAll ? totalByProfile(profile) : connectedByProfile(profile);
            const active = filterProfile === profile;
            return (
              <button
                key={profile}
                onClick={() => setFilterProfile(active ? "all" : profile)}
                style={{ fontSize: "0.625rem", fontWeight: 500, padding: "0.25rem 0.625rem", borderRadius: "0.375rem", border: `1px solid ${active ? "rgba(99,102,241,0.4)" : "var(--border-default)"}`, background: active ? "rgba(99,102,241,0.18)" : "transparent", color: active ? "#818cf8" : "var(--text-muted)", cursor: "pointer" }}
              >
                {profile} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem", marginBottom: "0.75rem", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", padding: "0.25rem", borderRadius: "0.5rem", background: "var(--bg-muted)", border: "1px solid var(--border-default)" }}>
          {[{ label: "Activos", val: false }, { label: "Todos", val: true }].map(opt => (
            <button
              key={String(opt.val)}
              onClick={() => setShowAll(opt.val)}
              style={{ fontSize: "0.625rem", fontWeight: 500, padding: "0.25rem 0.75rem", borderRadius: "0.375rem", border: "none", cursor: "pointer", background: showAll === opt.val ? "rgba(99,102,241,0.18)" : "transparent", color: showAll === opt.val ? "#818cf8" : "var(--text-muted)" }}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as "name" | "status")}
          style={{ borderRadius: "0.5rem", fontSize: "0.625rem", padding: "0.375rem 0.5rem", background: "var(--bg-muted)", border: "1px solid var(--border-default)", color: "var(--text-secondary)", outline: "none" }}
        >
          <option value="status">Por Estado</option>
          <option value="name">Alfabético</option>
        </select>
      </div>

      {/* Users list */}
      <div className="flex flex-col gap-1 custom-scrollbar" style={{ overflowY: "auto", flex: 1, minHeight: 0, maxHeight: fillHeight ? "none" : 280 }}>
        {displayList.length === 0 && (
          <div className="text-center text-xs py-6 rounded-lg" style={{ color: 'var(--text-muted)', background: 'var(--bg-muted)', border: '1px dashed var(--border-default)' }}>
            Sin usuarios {filterProfile !== "all" ? `en ${filterProfile}` : (showAll ? "configurados" : "conectados")}
          </div>
        )}
        {displayList.map((user, idx) => (
          <div
            key={idx}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0.625rem 0.875rem",
              borderRadius: "0.625rem",
              marginBottom: "0.25rem",
              transition: "all 0.2s",
              ...(user.connected
                ? { background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)" }
                : { background: "var(--bg-muted)", border: "1px solid var(--border-default)" })
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", minWidth: 0 }}>
              <div style={{
                padding: "0.5rem",
                borderRadius: "0.5rem",
                ...(user.connected
                  ? { background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)", color: "#10b981" }
                  : { background: "var(--bg-surface)", border: "1px solid var(--border-default)", color: "var(--text-muted)" })
              }}>
                {user.connected ? <Wifi style={{ width: 14, height: 14 }} /> : <WifiOff style={{ width: 14, height: 14 }} />}
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-primary)", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {user.name}
                </p>
                <p style={{ fontSize: "0.6875rem", fontFamily: "monospace", color: "var(--text-muted)", margin: "0.125rem 0 0 0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {user.connected ? (user.address || "Sin IP") : `Perfil: ${user.profile}`}
                </p>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", flexShrink: 0, marginLeft: "0.5rem" }}>
              <span style={{
                fontSize: "0.625rem",
                fontWeight: 700,
                padding: "0.125rem 0.5rem",
                borderRadius: "0.25rem",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                ...(user.connected
                  ? { background: "rgba(16,185,129,0.15)", color: "#10b981", border: "1px solid rgba(16,185,129,0.3)" }
                  : { background: "var(--bg-surface)", color: "var(--text-muted)", border: "1px solid var(--border-default)" })
              }}>
                {user.connected ? "Online" : "Offline"}
              </span>
              {user.connected && user.uptime && user.uptime !== "—" && (
                <span style={{ fontSize: "0.625rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>{user.uptime}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
