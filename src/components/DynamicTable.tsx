"use client";

import React, { useState } from "react";
import { Search } from "lucide-react";

interface DynamicTableProps {
  data: Record<string, unknown>[];
  isLoading: boolean;
  error?: string | null;
}

export default function DynamicTable({ data, isLoading, error }: DynamicTableProps) {
  const [searchTerm, setSearchTerm] = useState("");

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center gap-3" style={{ color: 'var(--text-secondary)' }}>
        <div className="animate-spin rounded-full h-7 w-7 border-2 border-indigo-500 border-t-transparent" />
        <span className="text-sm">Cargando datos del router...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="m-4 p-4 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
        <strong>Error:</strong> {error}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="m-4 p-8 text-center text-sm rounded-lg" style={{ color: 'var(--text-muted)', background: 'var(--bg-muted)', border: '1px dashed var(--border-default)' }}>
        No hay datos para mostrar con este comando.
      </div>
    );
  }

  const columnsSet = new Set<string>();
  data.forEach(item => Object.keys(item).forEach(k => columnsSet.add(k)));
  const columns = Array.from(columnsSet).filter(c => !c.startsWith("."));

  const filteredData = data.filter(item => {
    if (!searchTerm) return true;
    return Object.values(item).some(val =>
      String(val).toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Search bar */}
      <div className="px-4 py-3 flex items-center gap-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--border-default)' }}>
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Filtrar resultados..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg focus:outline-none"
            style={{
              background: 'var(--bg-muted)',
              border: '1px solid var(--border-default)',
              color: 'var(--text-primary)',
            }}
          />
        </div>
        <span className="text-xs font-medium px-2.5 py-1 rounded-md flex-shrink-0" style={{ background: 'var(--bg-muted)', color: 'var(--text-muted)' }}>
          {filteredData.length} filas
        </span>
      </div>

      {/* Table */}
      <div className="overflow-auto flex-1 custom-scrollbar">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 z-10">
            <tr style={{ background: 'var(--bg-muted)' }}>
              {columns.map(col => (
                <th key={col} className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-default)' }}>
                  {col.replace(/-/g, " ")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredData.map((row, idx) => (
              <tr
                key={idx}
                style={{ borderBottom: '1px solid var(--border-subtle)' }}
                className="transition-colors"
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-muted)')}
                onMouseLeave={e => (e.currentTarget.style.background = '')}
              >
                {columns.map(col => (
                  <td key={col} className="px-4 py-2.5 whitespace-nowrap text-xs" style={{ color: 'var(--text-primary)' }}>
                    {row[col] !== undefined && row[col] !== null
                      ? (typeof row[col] === 'object' ? JSON.stringify(row[col]) : String(row[col]))
                      : <span style={{ color: 'var(--text-muted)' }}>—</span>
                    }
                  </td>
                ))}
              </tr>
            ))}
            {filteredData.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                  No se encontraron coincidencias
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
