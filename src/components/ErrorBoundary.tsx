"use client";

import React from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="flex flex-col items-center justify-center p-6 h-full min-h-[200px] bg-red-500/10 border border-red-500/20 rounded-xl text-center">
          <AlertTriangle className="w-8 h-8 text-red-500 mb-3" />
          <h3 className="text-red-600 dark:text-red-400 font-semibold text-sm mb-1">
            Error al cargar componente
          </h3>
          <p className="text-red-500/80 text-xs max-w-[250px] truncate">
            {this.state.error?.message || "Ocurrió un error inesperado"}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: undefined })}
            className="mt-4 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-600 dark:text-red-400 text-xs font-medium rounded-lg transition-colors"
          >
            Reintentar
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
