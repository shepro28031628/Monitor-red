"use client";

import React, { useState, useEffect } from "react";
import Header from "@/components/Header";
import DynamicTable from "@/components/DynamicTable";
import DeviceList from "@/components/DeviceList";
import AlertHistory from "@/components/AlertHistory";
import NetworkMap from "@/components/NetworkMap";
import PingChart from "@/components/PingChart";
import ReportsPanel from "@/components/ReportsPanel";
import { TelemetryProvider } from "@/components/TelemetryProvider";
import { NotificationProvider } from "@/components/NotificationProvider";
import { Terminal, Network, Router, Shield, FileText, Database, Send, Wifi, Layers, Activity, Eye, Radio, Bell, Map, FileBarChart } from "lucide-react";

const ALERT_HISTORY_KEY = "__alert_history__";
const NETWORK_MAP_KEY = "__network_map__";
const PING_CHART_KEY = "__ping_chart__";
const REPORTS_KEY = "__reports__";
const MENU_ITEMS = [
  { label: "Interfaces",      path: "/interface/print",               icon: Network },
  { label: "Direcciones IP",  path: "/ip/address/print",              icon: Database },
  { label: "Rutas",           path: "/ip/route/print",                icon: Router },
  { label: "DHCP Leases",     path: "/ip/dhcp-server/lease/print",    icon: Database },
  { label: "Firewall",        path: "/ip/firewall/filter/print",      icon: Shield },
  { label: "Logs",            path: "/log/print",                     icon: FileText },
  { label: "Wireless",        path: "/interface/wireless/registration-table/print", icon: Wifi },
  { label: "Colas (Queues)",  path: "/queue/simple/print",            icon: Layers },
  { label: "Netwatch",        path: "/tool/netwatch/print",           icon: Eye },
  { label: "Hotspot Activos", path: "/ip/hotspot/active/print",       icon: Radio },
  { label: "Salud (Health)",  path: "/system/health/print",           icon: Activity },
  { label: "Historial Alertas", path: ALERT_HISTORY_KEY,              icon: Bell },
  { label: "Topología de Red", path: NETWORK_MAP_KEY,                 icon: Map },
  { label: "Latencia Ping",   path: PING_CHART_KEY,                   icon: Activity },
  { label: "Exportar Reportes", path: REPORTS_KEY,                      icon: FileBarChart },
];

export default function ExplorerPage() {
  const [activePath, setActivePath] = useState(MENU_ITEMS[0].path);
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAlertHistory = activePath === ALERT_HISTORY_KEY;
  const isNetworkMap = activePath === NETWORK_MAP_KEY;
  const isPingChart = activePath === PING_CHART_KEY;
  const isReports = activePath === REPORTS_KEY;

  useEffect(() => {
    if (isAlertHistory || isNetworkMap || isPingChart || isReports) return; // Don't query MikroTik for these
    let active = true;
    const run = async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      if (!active) return;
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/router/query?path=${encodeURIComponent(activePath)}`);
        const json = await res.json();
        if (!active) return;
        if (!res.ok || !json.success) throw new Error(json.error || "Error de conexión");
        setData(json.data || []);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : String(err));
        setData([]);
      } finally {
        if (active) setIsLoading(false);
      }
    };
    run();
    return () => { active = false; };
  }, [activePath, isAlertHistory, isNetworkMap, isPingChart, isReports]);

  return (
    <TelemetryProvider>
      <NotificationProvider>
        <div className="page-wrapper">
          <Header />

      {/* Explorer body */}
      <div className="page-content" style={{ paddingTop: '1.5rem' }}>
        <div className="grid grid-cols-1 xl:grid-cols-[240px_1fr_300px] gap-5 h-[calc(100vh-7rem)]">

          {/* ── Sidebar ───────────────────────────────── */}
          <aside className="flex flex-col gap-4 overflow-y-auto custom-scrollbar min-h-0">
            {/* Nav */}
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-4 pb-3" style={{ borderBottom: '1px solid var(--border-default)' }}>
                <div className="p-1.5 rounded-lg" style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)' }}>
                  <Terminal className="w-3.5 h-3.5 text-indigo-400" />
                </div>
                <h2 className="text-xs font-bold tracking-widest uppercase" style={{ color: 'var(--text-muted)' }}>
                  Categorías
                </h2>
              </div>
              <nav className="flex flex-col gap-1">
                {MENU_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const isActive = activePath === item.path;
                  return (
                    <button
                      key={item.path}
                      onClick={() => setActivePath(item.path)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left"
                      style={isActive ? {
                        background: 'rgba(99,102,241,0.12)',
                        color: '#818cf8',
                        border: '1px solid rgba(99,102,241,0.3)',
                      } : {
                        color: 'var(--text-secondary)',
                        border: '1px solid transparent',
                      }}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" style={{ color: isActive ? '#818cf8' : 'var(--text-muted)' }} />
                      {item.label}
                    </button>
                  );
                })}
              </nav>
            </div>
          </aside>

          {/* ── Query Results ─────────────────────────── */}
          <main className="card flex flex-col min-h-0 overflow-hidden">
            {isNetworkMap ? (
              <NetworkMap />
            ) : isReports ? (
              <div style={{ flex: 1, padding: "1.5rem", overflowY: "auto" }}>
                <ReportsPanel />
              </div>
            ) : isPingChart ? (
              <div style={{ flex: 1, padding: "1.5rem", overflowY: "auto" }}>
                <PingChart fillHeight />
              </div>
            ) : isAlertHistory ? (
              <AlertHistory />
            ) : (
              <>
                {/* Table header */}
                <div className="flex items-center justify-between px-5 py-3.5 flex-shrink-0" style={{ borderBottom: '1px solid var(--border-default)' }}>
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    Resultados de Consulta
                  </h3>
                  <span className="font-mono text-xs font-medium flex items-center gap-2 px-3 py-1.5 rounded-lg"
                    style={{
                      background: 'rgba(99,102,241,0.1)',
                      border: '1px solid rgba(99,102,241,0.25)',
                      color: '#818cf8',
                    }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                    {activePath}
                  </span>
                </div>
                {/* Table body */}
                <div className="flex-1 overflow-hidden">
                  <DynamicTable data={data} isLoading={isLoading} error={error} />
                </div>
              </>
            )}
          </main>

          {/* ── Device Inventory ──────────────────────── */}
          <aside className="min-h-0 overflow-hidden">
            <DeviceList />
          </aside>
        </div>
      </div>
    </div>
      </NotificationProvider>
    </TelemetryProvider>
  );
}
