"use client";

import React, { useState, useEffect, useCallback } from "react";
import Header from "@/components/Header";
import { Search, Download, Shield, Clock, Wifi, Monitor, ChevronLeft, ChevronRight, Calendar, RefreshCw, Building2 } from "lucide-react";

interface Session {
  id: number;
  username: string | null;
  macAddress: string | null;
  ipAddress: string | null;
  owner: string | null;
  type: string;
  vpnProfile: string | null;
  startedAt: string;
  endedAt: string | null;
  rxBytes: string | null;
  txBytes: string | null;
  location: string | null;
}

function formatBytes(bytes: string | null): string {
  if (!bytes || bytes === "0") return "—";
  const n = Number(bytes);
  if (n >= 1_073_741_824) return `${(n / 1_073_741_824).toFixed(2)} GB`;
  if (n >= 1_048_576)     return `${(n / 1_048_576).toFixed(1)} MB`;
  if (n >= 1024)          return `${(n / 1024).toFixed(0)} KB`;
  return `${n} B`;
}

function formatDuration(startedAt: string, endedAt: string | null): string {
  const start = new Date(startedAt).getTime();
  const end = endedAt ? new Date(endedAt).getTime() : Date.now();
  const diffMs = end - start;
  const hours   = Math.floor(diffMs / 3_600_000);
  const minutes = Math.floor((diffMs % 3_600_000) / 60_000);
  const secs    = Math.floor((diffMs % 60_000) / 1000);
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("es-CO", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  });
}

// Unique color per VPN profile (assigned on first encounter)
const PROFILE_COLORS: Record<string, { bg: string; border: string; color: string }> = {};
const PALETTE = [
  { bg: "rgba(99,102,241,0.12)",  border: "rgba(99,102,241,0.35)",  color: "#818cf8" },
  { bg: "rgba(14,165,233,0.12)",  border: "rgba(14,165,233,0.35)",  color: "#38bdf8" },
  { bg: "rgba(168,85,247,0.12)",  border: "rgba(168,85,247,0.35)",  color: "#c084fc" },
  { bg: "rgba(245,158,11,0.12)",  border: "rgba(245,158,11,0.35)",  color: "#fbbf24" },
  { bg: "rgba(16,185,129,0.12)",  border: "rgba(16,185,129,0.35)",  color: "#34d399" },
  { bg: "rgba(239,68,68,0.12)",   border: "rgba(239,68,68,0.35)",   color: "#f87171" },
  { bg: "rgba(251,146,60,0.12)",  border: "rgba(251,146,60,0.35)",  color: "#fb923c" },
  { bg: "rgba(52,211,153,0.12)",  border: "rgba(52,211,153,0.35)",  color: "#6ee7b7" },
];
let paletteIdx = 0;
function getProfileColor(profile: string) {
  if (!PROFILE_COLORS[profile]) {
    PROFILE_COLORS[profile] = PALETTE[paletteIdx % PALETTE.length];
    paletteIdx++;
  }
  return PROFILE_COLORS[profile];
}

export default function AuditPage() {
  const [sessions, setSessions]           = useState<Session[]>([]);
  const [total, setTotal]                 = useState(0);
  const [page, setPage]                   = useState(1);
  const [isLoading, setIsLoading]         = useState(false);
  const [fetchError, setFetchError]       = useState<string | null>(null);
  const [search, setSearch]               = useState("");
  const [typeFilter, setTypeFilter]       = useState("");
  const [profileFilter, setProfileFilter] = useState("");
  const [fromDate, setFromDate]           = useState("");
  const [toDate, setToDate]               = useState("");
  const [profiles, setProfiles]           = useState<string[]>(["VPN-COLP", "VPN-COMPENSAR", "VPN-NUEVAEPS"]);
  const [sla, setSla]                     = useState<{wan1Sla: number, wan2Sla: number} | null>(null);
  const limit = 50;

  const fetchSla = useCallback(async () => {
    try {
      const res = await fetch('/api/audit/sla');
      const json = await res.json();
      setSla(json);
    } catch { /* ignore */ }
  }, []);

  const fetchData = useCallback(async (isBackground = false) => {
    if (!isBackground) { setIsLoading(true); setFetchError(null); }
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        ...(search        ? { search }                 : {}),
        ...(typeFilter    ? { type: typeFilter }       : {}),
        ...(profileFilter ? { profile: profileFilter } : {}),
        ...(fromDate      ? { from: fromDate }         : {}),
        ...(toDate        ? { to: toDate }             : {}),
      });
      const res  = await fetch(`/api/audit/connections?${params}`);
      const json = await res.json();
      if (json.success) {
        setSessions(json.rows);
        setTotal(json.total);
        setFetchError(null);
        // Accumulate unique profiles for the filter chips
        const seen = new Set<string>();
        (json.rows as Session[]).forEach(r => { if (r.vpnProfile) seen.add(r.vpnProfile); });
        setProfiles(prev => {
          const merged = new Set([...prev, ...seen]);
          return Array.from(merged).sort();
        });
      } else {
        setFetchError(json.error || "Error al cargar datos");
      }
    } catch (err) { 
      setFetchError(err instanceof Error ? err.message : "Error de red");
    }
    finally { if (!isBackground) setIsLoading(false); }
  }, [page, search, typeFilter, profileFilter, fromDate, toDate]);

  useEffect(() => { fetchData(); fetchSla(); }, [fetchData, fetchSla]);

  // Auto-refresh every 5 s for near real-time data
  useEffect(() => {
    const interval = setInterval(() => fetchData(true), 30_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const exportCSV = () => {
    const headers = [
      "ID", "Usuario/Hostname", "Colaborador Asignado", "VPN Perfil",
      "MAC", "IP", "Tipo", "Inicio", "Fin", "Duración", "RX (Bytes)", "TX (Bytes)",
    ];
    const rows = sessions.map(s => [
      s.id,
      s.username    || "",
      s.owner       || "",
      s.vpnProfile  || "",
      s.macAddress  || "",
      s.ipAddress   || "",
      s.type,
      formatDateTime(s.startedAt),
      s.endedAt ? formatDateTime(s.endedAt) : "Activa",
      formatDuration(s.startedAt, s.endedAt),
      s.rxBytes || "0",
      s.txBytes || "0",
      s.location || "",
    ]);
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `auditoria-conexiones-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalPages  = Math.ceil(total / limit);
  const hasFilters  = search || typeFilter || profileFilter || fromDate || toDate;

  return (
    <div className="page-wrapper">
      <Header />

      <div className="page-content" style={{ paddingTop: "1.5rem" }}>

        {/* ── Page Header ── */}
        <div style={{ marginBottom: "1.5rem", display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "0.25rem" }}>
              <div style={{ padding: "0.5rem", borderRadius: "0.625rem", background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.25)" }}>
                <Shield style={{ width: 20, height: 20, color: "#818cf8" }} />
              </div>
              <h1 style={{ fontSize: "1.375rem", fontWeight: 700, color: "var(--text-primary)" }}>
                Auditoría de Conexiones
              </h1>
            </div>
            <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
              Registro histórico de todas las sesiones VPN y LAN/DHCP del MikroTik
            </p>
          </div>

          {/* SLA Display */}
          {sla && (
            <div style={{ display: "flex", gap: "1rem", alignItems: "center", background: "var(--bg-card)", padding: "0.5rem 1rem", borderRadius: "0.75rem", border: "1px solid var(--border-default)", boxShadow: "var(--shadow-card)" }}>
              <div>
                <span style={{ fontSize: "0.6875rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>SLA WAN 1 (Mes)</span>
                <div style={{ fontSize: "1.125rem", fontWeight: 700, color: sla.wan1Sla >= 99 ? "#10b981" : "#f59e0b" }}>{sla.wan1Sla}%</div>
              </div>
              <div style={{ width: 1, height: 30, background: "var(--border-subtle)" }} />
              <div>
                <span style={{ fontSize: "0.6875rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>SLA WAN 2 (Mes)</span>
                <div style={{ fontSize: "1.125rem", fontWeight: 700, color: sla.wan2Sla >= 99 ? "#10b981" : "#f59e0b" }}>{sla.wan2Sla}%</div>
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: "0.625rem" }}>
            <button
              onClick={() => fetchData()}
              style={{ display: "flex", alignItems: "center", gap: "0.375rem", padding: "0.5rem 0.875rem", borderRadius: "0.625rem", border: "1px solid var(--border-default)", background: "var(--bg-surface)", color: "var(--text-secondary)", fontSize: "0.8125rem", cursor: "pointer" }}
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
              Actualizar
            </button>
            <button
              onClick={exportCSV}
              style={{ display: "flex", alignItems: "center", gap: "0.375rem", padding: "0.5rem 0.875rem", borderRadius: "0.625rem", border: "1px solid rgba(16,185,129,0.3)", background: "rgba(16,185,129,0.1)", color: "#10b981", fontSize: "0.8125rem", cursor: "pointer" }}
            >
              <Download className="w-4 h-4" />
              Exportar CSV
            </button>
          </div>
        </div>

        {/* ── Filters ── */}
        <div className="card" style={{ padding: "1rem", marginBottom: "1rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {/* Row 1: search + type + date */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "flex-end" }}>
            <div style={{ position: "relative", flex: "1 1 200px", minWidth: 180 }}>
              <Search style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", width: 15, height: 15, color: "var(--text-muted)" }} />
              <input
                type="text"
                placeholder="Buscar usuario, MAC, IP, perfil VPN..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                style={{ width: "100%", paddingLeft: "2.25rem", paddingRight: "0.75rem", paddingTop: "0.5rem", paddingBottom: "0.5rem", borderRadius: "0.5rem", border: "1px solid var(--border-default)", background: "var(--bg-muted)", color: "var(--text-primary)", fontSize: "0.8125rem", outline: "none" }}
              />
            </div>

            <select
              value={typeFilter}
              onChange={e => { setTypeFilter(e.target.value); setPage(1); if (e.target.value !== "VPN") setProfileFilter(""); }}
              style={{ padding: "0.5rem 0.75rem", borderRadius: "0.5rem", border: "1px solid var(--border-default)", background: "var(--bg-muted)", color: "var(--text-primary)", fontSize: "0.8125rem", outline: "none" }}
            >
              <option value="">Todos los tipos</option>
              <option value="VPN">VPN</option>
              <option value="DHCP">LAN / DHCP</option>
            </select>

            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Calendar style={{ width: 15, height: 15, color: "var(--text-muted)" }} />
              <input type="datetime-local" value={fromDate} onChange={e => { setFromDate(e.target.value); setPage(1); }} style={{ padding: "0.5rem 0.625rem", borderRadius: "0.5rem", border: "1px solid var(--border-default)", background: "var(--bg-muted)", color: "var(--text-primary)", fontSize: "0.75rem", outline: "none" }} />
              <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>→</span>
              <input type="datetime-local" value={toDate}   onChange={e => { setToDate(e.target.value);   setPage(1); }} style={{ padding: "0.5rem 0.625rem", borderRadius: "0.5rem", border: "1px solid var(--border-default)", background: "var(--bg-muted)", color: "var(--text-primary)", fontSize: "0.75rem", outline: "none" }} />
              {hasFilters && (
                <button onClick={() => { setSearch(""); setTypeFilter(""); setProfileFilter(""); setFromDate(""); setToDate(""); setPage(1); }} style={{ padding: "0.5rem 0.75rem", borderRadius: "0.5rem", border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.1)", color: "#ef4444", fontSize: "0.75rem", cursor: "pointer" }}>
                  Limpiar
                </button>
              )}
            </div>

            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginLeft: "auto" }}>
              {total.toLocaleString()} registros
            </span>
          </div>

          {/* Row 2: VPN profile chips */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", flexWrap: "wrap", paddingTop: "0.5rem", borderTop: "1px solid var(--border-subtle)" }}>
            <Building2 style={{ width: 13, height: 13, color: "var(--text-muted)", flexShrink: 0 }} />
            <span style={{ fontSize: "0.6875rem", color: "var(--text-muted)", marginRight: "0.25rem" }}>VPN Perfil:</span>
              <button
                onClick={() => { setProfileFilter(""); setPage(1); }}
                style={{ fontSize: "0.6875rem", fontWeight: 600, padding: "0.2rem 0.625rem", borderRadius: "0.375rem", cursor: "pointer", border: `1px solid ${!profileFilter ? "rgba(99,102,241,0.4)" : "var(--border-default)"}`, background: !profileFilter ? "rgba(99,102,241,0.15)" : "transparent", color: !profileFilter ? "#818cf8" : "var(--text-muted)" }}
              >
                Todos
              </button>
              {profiles.map(p => {
                const c = getProfileColor(p);
                const active = profileFilter === p;
                return (
                  <button key={p} onClick={() => { setProfileFilter(active ? "" : p); setPage(1); }} style={{ fontSize: "0.6875rem", fontWeight: 600, padding: "0.2rem 0.625rem", borderRadius: "0.375rem", cursor: "pointer", border: `1px solid ${active ? c.border : "var(--border-default)"}`, background: active ? c.bg : "transparent", color: active ? c.color : "var(--text-muted)" }}>
                    {p}
                  </button>
                );
              })}
          </div>
        </div>

        {/* ── Table ── */}
        <div className="card" style={{ overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-default)" }}>
                  {["Tipo", "Usuario / Hostname", "Colaborador", "VPN Perfil", "MAC", "IP", "Ubicación", "Inicio Sesión", "Fin Sesión", "Duración", "Desc.", "Sub.", "Estado"].map(h => (
                    <th key={h} style={{ padding: "0.75rem 1rem", textAlign: "left", fontWeight: 600, fontSize: "0.6875rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={13} style={{ padding: "3rem", textAlign: "center", color: "var(--text-muted)" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-indigo-500 border-t-transparent" />
                        Cargando registros...
                      </div>
                    </td>
                  </tr>
                ) : fetchError ? (
                  <tr>
                    <td colSpan={13} style={{ padding: "3rem", textAlign: "center" }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem", color: "#f87171" }}>
                        <span style={{ fontSize: "1.5rem" }}>⚠️</span>
                        <span style={{ fontWeight: 600 }}>Error al cargar registros</span>
                        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{fetchError}</span>
                        <button onClick={() => fetchData()} style={{ padding: "0.4rem 1rem", borderRadius: "0.5rem", border: "1px solid rgba(239,68,68,0.4)", background: "rgba(239,68,68,0.1)", color: "#f87171", fontSize: "0.8125rem", cursor: "pointer" }}>Reintentar</button>
                      </div>
                    </td>
                  </tr>
                ) : sessions.length === 0 ? (
                  <tr>
                    <td colSpan={13} style={{ padding: "3rem", textAlign: "center", color: "var(--text-muted)" }}>
                      No se encontraron registros con los filtros aplicados.
                    </td>
                  </tr>
                ) : sessions.map((s, i) => {
                  const profileStyle = s.vpnProfile ? getProfileColor(s.vpnProfile) : null;
                  return (
                    <tr key={s.id} style={{ borderBottom: "1px solid var(--border-subtle)", background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)", transition: "background 0.1s" }}>

                      {/* Tipo */}
                      <td style={{ padding: "0.625rem 1rem", whiteSpace: "nowrap" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", padding: "0.25rem 0.625rem", borderRadius: "0.375rem", fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.05em", background: s.type === "VPN" ? "rgba(99,102,241,0.12)" : "rgba(6,182,212,0.12)", border: `1px solid ${s.type === "VPN" ? "rgba(99,102,241,0.3)" : "rgba(6,182,212,0.3)"}`, color: s.type === "VPN" ? "#818cf8" : "#22d3ee" }}>
                          {s.type === "VPN" ? <Wifi className="w-3 h-3" /> : <Monitor className="w-3 h-3" />}
                          {s.type}
                        </span>
                      </td>

                      {/* Usuario */}
                      <td style={{ padding: "0.625rem 1rem", color: "var(--text-primary)", fontWeight: 500, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {s.username || "—"}
                      </td>

                      {/* Colaborador */}
                      <td style={{ padding: "0.625rem 1rem", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {s.owner
                          ? <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{s.owner}</span>
                          : <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>—</span>}
                      </td>

                      {/* VPN Perfil */}
                      <td style={{ padding: "0.625rem 1rem", whiteSpace: "nowrap" }}>
                        {s.vpnProfile && profileStyle ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", padding: "0.2rem 0.625rem", borderRadius: "0.375rem", fontSize: "0.6875rem", fontWeight: 600, background: profileStyle.bg, border: `1px solid ${profileStyle.border}`, color: profileStyle.color }}>
                            <Building2 style={{ width: 11, height: 11 }} />
                            {s.vpnProfile}
                          </span>
                        ) : (
                          <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>—</span>
                        )}
                      </td>

                      {/* MAC */}
                      <td style={{ padding: "0.625rem 1rem", fontFamily: "monospace", fontSize: "0.75rem", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>{s.macAddress || "—"}</td>

                      {/* IP */}
                      <td style={{ padding: "0.625rem 1rem", fontFamily: "monospace", fontSize: "0.75rem", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>{s.ipAddress || "—"}</td>

                      {/* Ubicación */}
                      <td style={{ padding: "0.625rem 1rem", fontSize: "0.75rem", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                        {s.location ? (
                           <span style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                             📍 {s.location}
                           </span>
                        ) : (
                          <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>—</span>
                        )}
                      </td>

                      {/* Inicio */}
                      <td style={{ padding: "0.625rem 1rem", fontSize: "0.75rem", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                          <Clock style={{ width: 12, height: 12, flexShrink: 0 }} />
                          {formatDateTime(s.startedAt)}
                        </div>
                      </td>

                      {/* Fin */}
                      <td style={{ padding: "0.625rem 1rem", fontSize: "0.75rem", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                        {s.endedAt ? formatDateTime(s.endedAt) : <span style={{ color: "#10b981", fontWeight: 600 }}>Activa ahora</span>}
                      </td>

                      {/* Duración */}
                      <td style={{ padding: "0.625rem 1rem", fontSize: "0.75rem", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>{formatDuration(s.startedAt, s.endedAt)}</td>

                      {/* RX */}
                      <td style={{ padding: "0.625rem 1rem", fontSize: "0.75rem", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>{formatBytes(s.rxBytes)}</td>

                      {/* TX */}
                      <td style={{ padding: "0.625rem 1rem", fontSize: "0.75rem", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>{formatBytes(s.txBytes)}</td>

                      {/* Estado */}
                      <td style={{ padding: "0.625rem 1rem" }}>
                        <span style={{ display: "inline-block", padding: "0.2rem 0.5rem", borderRadius: "0.25rem", fontSize: "0.6875rem", fontWeight: 700, background: s.endedAt ? "rgba(100,116,139,0.1)" : "rgba(16,185,129,0.1)", border: `1px solid ${s.endedAt ? "rgba(100,116,139,0.2)" : "rgba(16,185,129,0.3)"}`, color: s.endedAt ? "var(--text-muted)" : "#10b981" }}>
                          {s.endedAt ? "Cerrada" : "Activa"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", padding: "0.875rem 1rem", borderTop: "1px solid var(--border-default)" }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ display: "flex", alignItems: "center", gap: "0.25rem", padding: "0.375rem 0.75rem", borderRadius: "0.5rem", border: "1px solid var(--border-default)", background: "var(--bg-surface)", color: page === 1 ? "var(--text-muted)" : "var(--text-primary)", fontSize: "0.8125rem", cursor: page === 1 ? "not-allowed" : "pointer" }}>
                <ChevronLeft className="w-4 h-4" /> Anterior
              </button>
              <span style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
                Página {page} de {totalPages}
              </span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ display: "flex", alignItems: "center", gap: "0.25rem", padding: "0.375rem 0.75rem", borderRadius: "0.5rem", border: "1px solid var(--border-default)", background: "var(--bg-surface)", color: page === totalPages ? "var(--text-muted)" : "var(--text-primary)", fontSize: "0.8125rem", cursor: page === totalPages ? "not-allowed" : "pointer" }}>
                Siguiente <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
