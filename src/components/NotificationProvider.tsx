"use client";

import React, { useEffect, useRef } from "react";
import { useTelemetry } from "./TelemetryProvider";
import type { LiveAlert } from "./TelemetryProvider";

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { data } = useTelemetry();
  const prevAlertIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Request permission on mount
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission();
      }
    }
  }, []);

  useEffect(() => {
    if (!data?.alerts) return;

    const currentAlerts: LiveAlert[] = data.alerts;
    const currentIds = new Set(currentAlerts.map(a => a.id));

    if (prevAlertIds.current.size > 0) {
      // Find new alerts
      for (const alert of currentAlerts) {
        if (!prevAlertIds.current.has(alert.id)) {
          // It's a new alert! Show notification
          if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
            const isCritical = alert.severity === "Critical";
            const icon = isCritical ? "🔴" : "🟡";
            const title = `${icon} Alerta ${alert.severity}: ${alert.alertType.replace(/_/g, " ")}`;
            const options = {
              body: alert.message,
              icon: "/logo.png",
              tag: alert.id,
              requireInteraction: isCritical
            };
            new Notification(title, options);
          }
        }
      }
    }

    prevAlertIds.current = currentIds;
  }, [data?.alerts]);

  return <>{children}</>;
}
