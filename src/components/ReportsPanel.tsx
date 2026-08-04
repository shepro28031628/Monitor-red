"use client";

import React, { useState } from "react";
import { Download, FileSpreadsheet, FileText, Calendar, Activity, AlertTriangle, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface AlertReportRow {
  id: string | number;
  alertType: string;
  severity: string | null;
  message: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

interface MetricReportRow {
  createdAt: string;
  cpuLoad: number | null;
  temperature: number | null;
  voltage: number | null;
  wan1Status: string | null;
  wan2Status: string | null;
  pingAvgMs: number | null;
  pingLossPercent: number | null;
  activeConnections: number | null;
}

export default function ReportsPanel() {
  const [reportType, setReportType] = useState<"alerts" | "metrics">("alerts");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async (format: "excel" | "pdf") => {
    if (!startDate || !endDate) {
      setError("Por favor selecciona un rango de fechas.");
      return;
    }
    
    if (new Date(startDate) > new Date(endDate)) {
      setError("La fecha de inicio debe ser anterior a la fecha de fin.");
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const startIso = new Date(startDate).toISOString();
      const endIso = new Date(endDate).toISOString();
      
      const res = await fetch(`/api/reports?type=${reportType}&start=${startIso}&end=${endIso}`);
      const json = await res.json();
      
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Error al obtener datos");
      }

      const data = json.data;
      if (data.length === 0) {
        throw new Error("No hay datos en el rango seleccionado.");
      }

      if (format === "excel") {
        downloadExcel(data, reportType);
      } else {
        downloadPDF(data, reportType);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const downloadExcel = (data: AlertReportRow[] | MetricReportRow[], type: string) => {
    let formattedData: Record<string, unknown>[] = [];
    if (type === "alerts") {
      formattedData = (data as AlertReportRow[]).map(d => ({
        "ID": d.id,
        "Fecha": new Date(d.createdAt).toLocaleString(),
        "Tipo": d.alertType,
        "Severidad": d.severity,
        "Mensaje": d.message,
        "Resuelto": d.resolvedAt ? new Date(d.resolvedAt).toLocaleString() : "No"
      }));
    } else {
      formattedData = (data as MetricReportRow[]).map(d => ({
        "Fecha": new Date(d.createdAt).toLocaleString(),
        "CPU (%)": d.cpuLoad,
        "Temp (C)": d.temperature,
        "Voltaje": d.voltage,
        "WAN 1": d.wan1Status,
        "WAN 2": d.wan2Status,
        "Ping (ms)": d.pingAvgMs,
        "Perdida (%)": d.pingLossPercent,
        "Conexiones": d.activeConnections
      }));
    }

    const worksheet = XLSX.utils.json_to_sheet(formattedData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Reporte");
    XLSX.writeFile(workbook, `reporte-${type}-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const downloadPDF = (data: AlertReportRow[] | MetricReportRow[], type: string) => {
    const doc = new jsPDF("landscape");
    
    doc.setFontSize(18);
    doc.text(`Reporte de ${type === "alerts" ? "Alertas" : "Métricas"}`, 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Generado: ${new Date().toLocaleString()}`, 14, 30);
    doc.text(`Rango: ${startDate} hasta ${endDate}`, 14, 36);

    if (type === "alerts") {
      const tableData = (data as AlertReportRow[]).map(d => [
        d.id,
        new Date(d.createdAt).toLocaleString(),
        d.alertType,
        d.severity,
        d.message,
        d.resolvedAt ? new Date(d.resolvedAt).toLocaleString() : "No"
      ]);
      
      autoTable(doc, {
        startY: 42,
        head: [["ID", "Fecha", "Tipo", "Severidad", "Mensaje", "Resuelto"]],
        body: tableData,
      });
    } else {
      const tableData = (data as MetricReportRow[]).map(d => [
        new Date(d.createdAt).toLocaleString(),
        `${d.cpuLoad || 0}%`,
        `${d.temperature || 0}C`,
        d.wan1Status || "-",
        d.wan2Status || "-",
        `${d.pingAvgMs || 0}ms`,
        `${d.pingLossPercent || 0}%`,
        d.activeConnections || 0
      ]);
      
      autoTable(doc, {
        startY: 42,
        head: [["Fecha", "CPU", "Temp", "WAN 1", "WAN 2", "Ping", "Pérdida", "Conexiones"]],
        body: tableData,
      });
    }

    doc.save(`reporte-${type}-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", paddingBottom: "2rem" }}>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Generador de Reportes</h1>
        <p className="text-[var(--text-secondary)]">Descarga historiales de alertas o métricas de sistema en formato Excel o PDF.</p>
      </div>

      <div className="card p-6 flex flex-col gap-6">
        {/* Tipo de reporte */}
        <div>
          <label className="block text-sm font-semibold text-[var(--text-primary)] mb-3">Tipo de Reporte</label>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setReportType("alerts")}
              className={`p-4 rounded-xl border flex items-center gap-3 transition-all ${
                reportType === "alerts" 
                  ? "border-indigo-500 bg-indigo-500/10 text-indigo-400" 
                  : "border-[var(--border-default)] bg-[var(--bg-muted)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]"
              }`}
            >
              <AlertTriangle className="w-6 h-6" />
              <div className="text-left">
                <div className="font-bold text-sm">Historial de Alertas</div>
                <div className="text-xs opacity-75 mt-1">Incidentes y advertencias</div>
              </div>
            </button>
            
            <button
              onClick={() => setReportType("metrics")}
              className={`p-4 rounded-xl border flex items-center gap-3 transition-all ${
                reportType === "metrics" 
                  ? "border-emerald-500 bg-emerald-500/10 text-emerald-400" 
                  : "border-[var(--border-default)] bg-[var(--bg-muted)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]"
              }`}
            >
              <Activity className="w-6 h-6" />
              <div className="text-left">
                <div className="font-bold text-sm">Métricas del Router</div>
                <div className="text-xs opacity-75 mt-1">CPU, ping, uptime, WAN</div>
              </div>
            </button>
          </div>
        </div>

        {/* Rango de fechas */}
        <div>
          <label className="block text-sm font-semibold text-[var(--text-primary)] mb-3">Rango de Fechas</label>
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none focus:border-indigo-500"
              />
            </div>
            <span className="text-[var(--text-muted)]">hasta</span>
            <div className="flex-1 relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 text-sm">
            {error}
          </div>
        )}

        {/* Acciones */}
        <div className="pt-4 border-t border-[var(--border-subtle)] flex gap-4">
          <button
            onClick={() => handleDownload("excel")}
            disabled={isLoading}
            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold bg-[#107c41] hover:bg-[#0c5e31] text-white transition-colors disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileSpreadsheet className="w-5 h-5" />}
            Descargar Excel
          </button>
          <button
            onClick={() => handleDownload("pdf")}
            disabled={isLoading}
            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold bg-[#dc2626] hover:bg-[#b91c1c] text-white transition-colors disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileText className="w-5 h-5" />}
            Descargar PDF
          </button>
        </div>

      </div>
    </div>
  );
}
