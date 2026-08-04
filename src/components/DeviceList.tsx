"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { MonitorSmartphone, Search, Clock, Wifi, WifiOff, Fingerprint, MapPin } from "lucide-react";

interface Device {
  id: number;
  macAddress: string;
  ipAddress: string | null;
  hostname: string | null;
  vendor: string | null;
  isOnline: boolean;
  firstSeen: string;
  lastSeen: string;
  owner: string | null;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Error al cargar datos");
  return res.json();
};

export default function DeviceList() {
  const [searchTerm, setSearchTerm] = useState("");

  const { data, isLoading, error } = useQuery<{ success: boolean; data: Device[] }>({
    queryKey: ['inventory'],
    queryFn: () => fetcher("/api/inventory"),
    refetchInterval: 30000,
  });

  const devices = data?.data || [];

  const filteredDevices = devices.filter((device) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (device.hostname && device.hostname.toLowerCase().includes(term)) ||
      (device.ipAddress && device.ipAddress.toLowerCase().includes(term)) ||
      device.macAddress.toLowerCase().includes(term)
    );
  });

  const onlineCount = devices.filter(d => d.isOnline).length;

  return (
    <div className="card flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 py-4 shrink-0 border-b border-[var(--border-default)]">
        <div className="flex items-center gap-2 mb-1">
          <MonitorSmartphone className="w-4 h-4 text-indigo-400 shrink-0" />
          <h3 className="text-sm font-semibold truncate text-[var(--text-primary)]">
            Dispositivos MikroTik
          </h3>
        </div>
        <p className="text-[11px] mb-3 text-[var(--text-muted)]">
          ARP/DHCP · <span className="text-emerald-500 font-semibold">{onlineCount} activos</span> de {devices.length}
        </p>
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="IP, MAC o hostname..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg focus:outline-none bg-[var(--bg-muted)] border border-[var(--border-default)] text-[var(--text-primary)]"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar py-2 px-2">
        {isLoading ? (
          <div className="flex items-center justify-center h-32 gap-3 text-[var(--text-secondary)]">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-indigo-500 border-t-transparent" />
            <span className="text-xs">Cargando...</span>
          </div>
        ) : error ? (
          <div className="m-2 p-3 rounded-lg text-xs bg-red-500/10 border border-red-500/20 text-red-400">
            Error al cargar inventario
          </div>
        ) : filteredDevices.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-xs text-[var(--text-muted)]">
            {searchTerm ? "Sin coincidencias" : "Sin dispositivos registrados"}
          </div>
        ) : (
          <AnimatePresence>
            {filteredDevices.map((device) => (
              <motion.div
                key={device.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="flex items-center gap-3 p-3 rounded-xl mb-1 transition-colors cursor-default border border-transparent hover:bg-[var(--bg-muted)] hover:border-[var(--border-default)]"
              >
                {/* Status icon */}
                <div className={`shrink-0 p-1.5 rounded-lg border ${device.isOnline ? "bg-emerald-500/10 border-emerald-500/25" : "bg-[var(--bg-muted)] border-[var(--border-default)]"}`}>
                  {device.isOnline
                    ? <Wifi className="w-4 h-4 text-emerald-500" />
                    : <WifiOff className="w-4 h-4 text-[var(--text-muted)]" />
                  }
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate text-[var(--text-primary)]">
                    {device.hostname || (device.vendor ? `Dispositivo ${device.vendor}` : "Dispositivo sin nombre")}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5 text-[10px] font-mono text-[var(--text-muted)]">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-2.5 h-2.5" />
                      {device.ipAddress || "—"}
                    </span>
                    <span>·</span>
                    <span className="flex items-center gap-1 truncate" title={device.vendor || ""}>
                      <Fingerprint className="w-2.5 h-2.5 shrink-0" />
                      <span className="truncate">{device.macAddress}</span>
                    </span>
                    {device.hostname && device.vendor && (
                      <>
                        <span>·</span>
                        <span className="truncate text-indigo-400">{device.vendor}</span>
                      </>
                    )}
                  </div>
                  {device.owner && (
                    <div className="mt-1 flex items-center gap-1.5 text-[11px] text-[var(--text-primary)]">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      <span className="font-medium truncate">{device.owner}</span>
                    </div>
                  )}
                </div>

                {/* Time */}
                <div className="shrink-0 text-right">
                  <span className={`text-[9px] font-bold uppercase tracking-wider ${device.isOnline ? 'text-emerald-500' : 'text-[var(--text-muted)]'}`}>
                    {device.isOnline ? "Online" : "Offline"}
                  </span>
                  <div className="flex items-center gap-1 mt-0.5 text-[9px] font-mono justify-end text-[var(--text-muted)]">
                    <Clock className="w-2.5 h-2.5" />
                    {new Date(device.lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
