"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Bell, Filter, AlertTriangle, CheckCircle2, Clock, XCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface Alert {
  id: string;
  alertType: string;
  severity: "Warning" | "Critical";
  message: string;
  createdAt: string;
  resolvedAt: string | null;
}

function formatDuration(start: string, end: string | null): string {
  if (!end) return "⏳ Activa";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ${sec % 60}s`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs}h ${min % 60}m`;
  const days = Math.floor(hrs / 24);
  return `${days}d ${hrs % 24}h`;
}

function formatAlertType(type: string): string {
  return type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

const ALERT_TYPES = [
  "HIGH_CPU", "HIGH_CPU_WARNING", "LOW_MEMORY",
  "HIGH_TEMP", "HIGH_TEMP_WARNING", "PACKET_LOSS",
  "WAN1_DOWN", "WAN2_DOWN", "INTERNET_DOWN", "INTERNET_DEGRADED",
];

export default function AlertHistory() {
  const [page, setPage] = useState(1);
  const [severity, setSeverity] = useState("");
  const [alertType, setAlertType] = useState("");
  const [status, setStatus] = useState("");
  const limit = 20;

  const { data, isLoading, error } = useQuery({
    queryKey: ['alert-history', page, limit, severity, alertType, status],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        ...(severity ? { severity } : {}),
        ...(alertType ? { alertType } : {}),
        ...(status ? { status } : {}),
      });
      const res = await fetch(`/api/alerts?${params}`);
      if (!res.ok) throw new Error("Error al cargar historial de alertas");
      return res.json();
    }
  });

  const alerts = data?.data || [];
  const total = data?.total || 0;

  const totalPages = Math.ceil(total / limit);
  const activeCount = alerts.filter((a: Alert) => !a.resolvedAt).length;
  const resolvedCount = alerts.filter((a: Alert) => a.resolvedAt).length;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header Stats */}
      <div className="px-5 py-4 border-b border-[var(--border-default)] shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Bell className="w-[18px] h-[18px] text-[#818cf8]" />
            <h3 className="text-[15px] font-semibold text-[var(--text-primary)] m-0">
              Historial de Alertas
            </h3>
          </div>
          <span className="text-xs text-[var(--text-muted)]">
            {total} alertas en total
          </span>
        </div>

        {/* Quick Stats */}
        <div className="flex gap-2 mb-3">
          <div className="flex-1 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
            <span className="text-lg font-bold text-red-500">{activeCount}</span>
            <span className="text-[10px] text-[var(--text-muted)] block">Activas</span>
          </div>
          <div className="flex-1 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <span className="text-lg font-bold text-emerald-500">{resolvedCount}</span>
            <span className="text-[10px] text-[var(--text-muted)] block">Resueltas</span>
          </div>
          <div className="flex-1 px-3 py-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
            <span className="text-lg font-bold text-[#818cf8]">{total}</span>
            <span className="text-[10px] text-[var(--text-muted)] block">Total</span>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap items-center">
          <Filter className="w-3.5 h-3.5 text-[var(--text-muted)]" />
          <select
            value={severity}
            onChange={e => { setSeverity(e.target.value); setPage(1); }}
            className="px-2 py-1.5 rounded-md border border-[var(--border-default)] bg-[var(--bg-muted)] text-[var(--text-primary)] text-xs outline-none"
          >
            <option value="">Toda Severidad</option>
            <option value="Critical">🔴 Crítica</option>
            <option value="Warning">🟡 Advertencia</option>
          </select>
          <select
            value={alertType}
            onChange={e => { setAlertType(e.target.value); setPage(1); }}
            className="px-2 py-1.5 rounded-md border border-[var(--border-default)] bg-[var(--bg-muted)] text-[var(--text-primary)] text-xs outline-none"
          >
            <option value="">Todos los Tipos</option>
            {ALERT_TYPES.map(t => (
              <option key={t} value={t}>{formatAlertType(t)}</option>
            ))}
          </select>
          <select
            value={status}
            onChange={e => { setStatus(e.target.value); setPage(1); }}
            className="px-2 py-1.5 rounded-md border border-[var(--border-default)] bg-[var(--bg-muted)] text-[var(--text-primary)] text-xs outline-none"
          >
            <option value="">Todo Estado</option>
            <option value="active">⏳ Activas</option>
            <option value="resolved">✅ Resueltas</option>
          </select>
          {(severity || alertType || status) && (
            <button
              onClick={() => { setSeverity(""); setAlertType(""); setStatus(""); setPage(1); }}
              className="px-2.5 py-1.5 rounded-md border border-red-500/30 bg-red-500/10 text-red-500 text-[11px] cursor-pointer"
            >
              Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Alert List */}
      <div className="custom-scrollbar flex-1 overflow-y-auto px-4 py-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-[var(--text-muted)]">
            <div className="animate-spin w-5 h-5 border-2 border-[var(--border-default)] border-t-[#818cf8] rounded-full mr-3" />
            Cargando alertas...
          </div>
        ) : error ? (
           <div className="text-center py-12 text-red-500 text-sm">
             Error al cargar alertas.
           </div>
        ) : alerts.length === 0 ? (
          <div className="text-center py-12 text-[var(--text-muted)]">
            <Bell className="w-8 h-8 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No se encontraron alertas</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {alerts.map((alert: Alert) => {
              const isActive = !alert.resolvedAt;
              const isCritical = alert.severity === "Critical";
              const accentColor = isActive
                ? (isCritical ? "#ef4444" : "#f59e0b")
                : "#10b981";
              
              const containerClasses = isActive
                ? (isCritical 
                   ? "bg-red-500/10 border-red-500/20 border-l-red-500" 
                   : "bg-amber-500/10 border-amber-500/20 border-l-amber-500")
                : "bg-emerald-500/10 border-emerald-500/20 border-l-emerald-500";
                
              const badgeClasses = isActive
                ? (isCritical
                   ? "bg-red-500/15 text-red-500 border-red-500/20"
                   : "bg-amber-500/15 text-amber-500 border-amber-500/20")
                : "bg-emerald-500/15 text-emerald-500 border-emerald-500/20";

              return (
                <div
                  key={alert.id}
                  className={`px-4 py-3 rounded-[10px] border border-l-4 transition-all duration-150 ${containerClasses}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {isActive ? (
                          isCritical ? <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                            : <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        )}
                        <span className="text-[13px] font-semibold text-[var(--text-primary)]">
                          {formatAlertType(alert.alertType)}
                        </span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-[4px] uppercase tracking-wider border ${badgeClasses}`}>
                          {isActive ? alert.severity : "Resuelta"}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed overflow-hidden text-ellipsis whitespace-nowrap">
                        {alert.message}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-[11px] text-[var(--text-muted)] font-mono">
                        {new Date(alert.createdAt).toLocaleString("es-CO", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <span className="flex items-center gap-1 text-[10px]" style={{ color: isActive ? accentColor : "#10b981" }}>
                        <Clock className="w-2.5 h-2.5" />
                        {formatDuration(alert.createdAt, alert.resolvedAt)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-4 py-3 border-t border-[var(--border-default)] flex items-center justify-between shrink-0">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-[var(--border-default)] bg-[var(--bg-muted)] text-xs cursor-pointer ${page === 1 ? 'text-[var(--text-muted)] cursor-not-allowed opacity-50' : 'text-[var(--text-primary)]'}`}
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Anterior
          </button>
          <span className="text-xs text-[var(--text-muted)]">
            Página {page} de {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-[var(--border-default)] bg-[var(--bg-muted)] text-xs cursor-pointer ${page === totalPages ? 'text-[var(--text-muted)] cursor-not-allowed opacity-50' : 'text-[var(--text-primary)]'}`}
          >
            Siguiente <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
