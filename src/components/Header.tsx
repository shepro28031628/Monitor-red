"use client";

import React, { useState } from 'react';
import { Activity, User, LogOut, MonitorPlay, Compass, Home, Sun, Moon, Shield, Map, WifiOff, Wifi } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useTheme } from '@/components/ThemeProvider';
import { useTelemetry } from '@/components/TelemetryProvider';

export default function Header({ onToggleNoc }: { onToggleNoc?: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const [showMenu, setShowMenu] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { connectionStatus, lastUpdated } = useTelemetry();

  const handleLogout = async () => {
    try {
      await fetch("/api/logout", { method: "POST" });
    } catch {
      // ignore errors, proceed with redirect anyway
    } finally {
      // Hard redirect clears client state and session cookie
      window.location.href = "/login";
    }
  };

  return (
    <header className="app-header w-full">
      <div className="max-w-[1600px] mx-auto px-5 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="flex items-center justify-center p-1 bg-white rounded-xl shadow-lg shadow-indigo-500/10">
            <img src="/logo.png" alt="Logo" width="32" height="32" className="object-contain w-8 h-8 rounded-lg" />
          </div>
          <div className="hidden sm:block">
            <h1 className="text-base font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Monitor MikroTik</h1>
          </div>
        </div>

        {/* Nav tabs */}
        <nav className="flex items-center gap-1 flex-1 justify-center">
          <Link
            href="/"
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${pathname === '/'
              ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--border-subtle)]'
              }`}
          >
            <Home className="w-4 h-4" />
            <span className="hidden md:inline">Dashboard</span>
          </Link>
          <Link
            href="/explorer"
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${pathname === '/explorer'
              ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--border-subtle)]'
              }`}
          >
            <Compass className="w-4 h-4" />
            <span className="hidden md:inline">Explorer</span>
          </Link>
          <Link
            href="/audit"
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${pathname === '/audit'
              ? 'bg-violet-500/15 text-violet-400 border border-violet-500/30'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--border-subtle)]'
              }`}
          >
            <Shield className="w-4 h-4" />
            <span className="hidden md:inline">Auditoría</span>
          </Link>
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Live indicator */}
          {connectionStatus === 'connected' ? (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full border"
              style={{ background: 'rgba(16,185,129,0.08)', borderColor: 'rgba(16,185,129,0.25)' }}>
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-semibold text-emerald-500 dark:text-emerald-400">En Vivo</span>
            </div>
          ) : connectionStatus === 'disconnected' ? (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full border animate-pulse"
              style={{ background: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.4)' }}>
              <WifiOff className="w-3.5 h-3.5 text-red-400" />
              <span className="text-xs font-semibold text-red-400">Sin Conexión</span>
            </div>
          ) : connectionStatus === 'reconnecting' ? (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full border animate-pulse"
              style={{ background: 'rgba(245,158,11,0.12)', borderColor: 'rgba(245,158,11,0.4)' }}>
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-xs font-semibold text-amber-500">Reconectando...</span>
            </div>
          ) : connectionStatus === 'error' ? (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full border animate-pulse"
              style={{ background: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.4)' }}>
              <WifiOff className="w-3.5 h-3.5 text-red-400" />
              <span className="text-xs font-semibold text-red-400">Error de Lectura</span>
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full border"
              style={{ background: 'rgba(245,158,11,0.08)', borderColor: 'rgba(245,158,11,0.25)' }}>
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-xs font-semibold text-amber-500">Conectando...</span>
            </div>
          )}

          {/* NOC Mode */}
          {onToggleNoc && pathname !== '/explorer' && (
            <button
              onClick={onToggleNoc}
              title="Activar Modo NOC"
              className="flex items-center justify-center w-9 h-9 rounded-lg transition-all border"
              style={{
                background: 'var(--bg-surface)',
                borderColor: 'var(--border-default)',
                color: 'var(--text-secondary)'
              }}
            >
              <MonitorPlay className="w-4 h-4" />
            </button>
          )}

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            title={theme === 'light' ? 'Modo Oscuro' : 'Modo Claro'}
            className="flex items-center justify-center w-9 h-9 rounded-lg transition-all border"
            style={{
              background: 'var(--bg-surface)',
              borderColor: 'var(--border-default)',
              color: 'var(--text-secondary)'
            }}
          >
            {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="flex items-center justify-center w-9 h-9 rounded-lg transition-all border"
              style={{
                background: 'var(--bg-surface)',
                borderColor: 'var(--border-default)',
                color: 'var(--text-secondary)'
              }}
            >
              <User className="w-4 h-4" />
            </button>

            {showMenu && (
              <div className="absolute right-0 mt-2 w-44 rounded-xl shadow-xl py-1 z-50 border"
                style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-default)' }}>
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2.5 text-sm text-red-500 hover:text-red-400 flex items-center gap-2 transition-colors rounded-lg mx-0.5 hover:bg-red-500/10"
                >
                  <LogOut className="w-4 h-4" />
                  Cerrar Sesión
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
