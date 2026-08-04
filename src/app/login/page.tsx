"use client";

import React, { useState } from "react";
import { Activity, Lock, User, ArrowRight, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const { signIn } = await import("next-auth/react");
      const res = await signIn("credentials", {
        redirect: false,
        username,
        password,
      });

      if (res?.error) {
        throw new Error(res.error || "Credenciales inválidas");
      }

      if (res?.ok) {
        router.push("/");
        router.refresh();
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-[var(--bg-base)] relative overflow-hidden transition-all duration-350">
      {/* Background Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-500/20 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md p-8 relative z-10 animate-fade-in">
        <div className="p-10 rounded-2xl border shadow-2xl backdrop-blur-xl" style={{ backgroundColor: 'var(--bg-panel)', borderColor: 'var(--border-default)' }}>

          <div className="flex flex-col items-center mb-10 text-center">
            <div className="flex items-center justify-center p-4 bg-white rounded-2xl shadow-xl shadow-indigo-500/10 mb-6 border border-gray-100">
              <img src="/logo.png" alt="Logo" width="80" height="80" className="object-contain" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight mb-2" style={{ color: 'var(--text-primary)' }}>Monitor Microtik</h1>
          </div>

          {error && (
            <div className="mb-6 p-3 rounded-lg border text-sm text-center" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.2)', color: 'var(--accent-red)' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Usuario</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5" style={{ color: 'var(--text-muted)' }} />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border rounded-xl leading-5 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all sm:text-sm"
                  style={{ backgroundColor: 'var(--bg-muted)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                  placeholder="admin"
                  required
                  autoComplete="username"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Contraseña</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5" style={{ color: 'var(--text-muted)' }} />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border rounded-xl leading-5 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all sm:text-sm"
                  style={{ backgroundColor: 'var(--bg-muted)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed group relative overflow-hidden"
            >
              <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Iniciar Sesión
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

        </div>
      </div>
    </main>
  );
}
