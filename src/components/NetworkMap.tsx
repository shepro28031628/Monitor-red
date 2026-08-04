"use client";

import React, { useMemo, useState } from "react";
import { useTelemetry } from "./TelemetryProvider";
import type { VpnUserDetail } from "./TelemetryProvider";
import { useTheme } from "./ThemeProvider";
import { Router, Server, Globe, Users, Wifi } from "lucide-react";

type NodeStatus = "online" | "warning" | "critical" | "offline";

interface NodeProps {
  x: number;
  y: number;
  label: string;
  sublabel?: string;
  icon: React.ReactNode;
  status?: NodeStatus;
  onClick?: () => void;
}

export default function NetworkMap() {
  const { data } = useTelemetry();
  const { theme } = useTheme();
  const isLight = theme === "light";

  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  // Parse telemetry to get node statuses
  const cpuLoad = data?.cpuLoad || 0;
  const freeMemory = data?.freeMemory || 0;
  const totalMemory = data?.totalMemory || 1;
  const memUsage = ((totalMemory - freeMemory) / totalMemory) * 100;
  const pingLoss = data?.pingLossPercent || 0;

  const wan1Rx = ((data?.wan1Rx || 0) / 1000000).toFixed(1);
  const wan1Tx = ((data?.wan1Tx || 0) / 1000000).toFixed(1);
  const wan2Rx = ((data?.wan2Rx || 0) / 1000000).toFixed(1);
  const wan2Tx = ((data?.wan2Tx || 0) / 1000000).toFixed(1);

  const activeVpns = (data?.vpnProfilesDetail || []).filter((u: VpnUserDetail) => u.connected).length;
  const totalVpns = (data?.vpnProfilesDetail || []).length;
  
  const dhcpLeases = data?.dhcpLeases || 0;

  // Layout constants
  const centerX = 400;
  const centerY = 300;
  
  const getColor = (status?: string) => {
    switch (status) {
      case "online": return "#10b981"; // emerald-500
      case "warning": return "#f59e0b"; // amber-500
      case "critical": return "#ef4444"; // red-500
      case "offline": return "#64748b"; // slate-500
      default: return isLight ? "#94a3b8" : "#475569";
    }
  };

  const getRouterStatus = () => {
    if (cpuLoad > 90 || memUsage > 90) return "critical";
    if (cpuLoad > 75 || memUsage > 75) return "warning";
    return "online";
  };

  const getInternetStatus = () => {
    if (pingLoss > 50) return "critical";
    if (pingLoss > 10) return "warning";
    return "online";
  };

  const nodes = [
    {
      id: "internet",
      x: centerX,
      y: 50,
      label: "Internet",
      sublabel: `${data?.pingAvgMs || 0}ms`,
      icon: <Globe size={24} />,
      status: getInternetStatus()
    },
    {
      id: "wan1",
      x: centerX - 150,
      y: 150,
      label: "WAN 1",
      sublabel: `${wan1Rx}↓ ${wan1Tx}↑ Mbps`,
      icon: <Server size={20} />,
      status: (data?.wan1Rx ?? 0) > 0 || (data?.wan1Tx ?? 0) > 0 ? "online" : "warning"
    },
    {
      id: "wan2",
      x: centerX + 150,
      y: 150,
      label: "WAN 2 (Backup)",
      sublabel: `${wan2Rx}↓ ${wan2Tx}↑ Mbps`,
      icon: <Server size={20} />,
      status: (data?.wan2Rx ?? 0) > 0 || (data?.wan2Tx ?? 0) > 0 ? "online" : "offline"
    },
    {
      id: "router",
      x: centerX,
      y: 280,
      label: "MikroTik Core",
      sublabel: `CPU ${cpuLoad.toFixed(1)}% | RAM ${memUsage.toFixed(1)}%`,
      icon: <Router size={32} />,
      status: getRouterStatus()
    },
    {
      id: "vpn",
      x: centerX - 180,
      y: 450,
      label: "Túneles VPN",
      sublabel: `${activeVpns} / ${totalVpns} Activos`,
      icon: <Users size={24} />,
      status: activeVpns > 0 ? "online" : "offline"
    },
    {
      id: "lan",
      x: centerX + 180,
      y: 450,
      label: "Red Local (LAN)",
      sublabel: `${dhcpLeases} Dispositivos`,
      icon: <Wifi size={24} />,
      status: "online"
    }
  ];

  const edges = [
    { from: "internet", to: "wan1", active: true },
    { from: "internet", to: "wan2", active: (data?.wan2Rx ?? 0) > 0 || (data?.wan2Tx ?? 0) > 0 },
    { from: "wan1", to: "router", active: true },
    { from: "wan2", to: "router", active: (data?.wan2Rx ?? 0) > 0 || (data?.wan2Tx ?? 0) > 0 },
    { from: "router", to: "vpn", active: activeVpns > 0 },
    { from: "router", to: "lan", active: true },
  ];

  return (
    <div className="card p-6" style={{ height: "100%", minHeight: 600, display: "flex", flexDirection: "column" }}>
      <div className="mb-4">
        <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>Topología de Red</h2>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>Vista en tiempo real de la arquitectura del sistema</p>
      </div>

      <div style={{ flex: 1, position: "relative", background: isLight ? "#f8fafc" : "#0f172a", borderRadius: "12px", overflow: "hidden", border: "1px solid var(--border-default)" }}>
        <svg width="100%" height="100%" viewBox="0 0 800 600" preserveAspectRatio="xMidYMid meet">
          {/* Draw grid background */}
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke={isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.03)"} strokeWidth="1" />
            </pattern>
            {/* Glow effect for lines */}
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />

          {/* Draw Edges */}
          {edges.map((edge, i) => {
            const fromNode = nodes.find(n => n.id === edge.from)!;
            const toNode = nodes.find(n => n.id === edge.to)!;
            const strokeColor = edge.active ? (isLight ? "#3b82f6" : "#60a5fa") : (isLight ? "#cbd5e1" : "#334155");
            return (
              <g key={`edge-${i}`}>
                <line
                  x1={fromNode.x}
                  y1={fromNode.y}
                  x2={toNode.x}
                  y2={toNode.y}
                  stroke={strokeColor}
                  strokeWidth={edge.active ? 3 : 2}
                  strokeDasharray={edge.active ? "none" : "5,5"}
                  opacity={edge.active ? 0.8 : 0.4}
                />
                {edge.active && (
                  <circle r="4" fill={strokeColor} filter="url(#glow)">
                    <animateMotion
                      dur={fromNode.id === "router" ? "2s" : "1.5s"}
                      repeatCount="indefinite"
                      path={`M ${fromNode.x} ${fromNode.y} L ${toNode.x} ${toNode.y}`}
                    />
                  </circle>
                )}
              </g>
            );
          })}

          {/* Draw Nodes */}
          {nodes.map(node => {
            const isHovered = hoveredNode === node.id;
            const nodeColor = getColor(node.status);
            const bgColor = isLight ? "#ffffff" : "#1e293b";
            const textColor = isLight ? "#0f172a" : "#f8fafc";
            const subTextColor = isLight ? "#64748b" : "#94a3b8";
            
            return (
              <g 
                key={node.id} 
                transform={`translate(${node.x}, ${node.y})`}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                style={{ cursor: "pointer", transition: "all 0.2s" }}
              >
                {/* Node Circle */}
                <circle 
                  r={node.id === "router" ? 45 : 35} 
                  fill={bgColor} 
                  stroke={isHovered ? nodeColor : (isLight ? "#e2e8f0" : "#334155")}
                  strokeWidth={isHovered ? 3 : 2}
                  style={{ transition: "all 0.2s" }}
                />
                
                {/* Icon wrapper to center it */}
                <g transform={`translate(-12, -22)`} fill="none" stroke={nodeColor} strokeWidth={2}>
                  {node.icon}
                </g>

                {/* Status indicator dot */}
                <circle 
                  cx={node.id === "router" ? 30 : 22} 
                  cy={node.id === "router" ? -30 : -22} 
                  r="6" 
                  fill={nodeColor} 
                  stroke={bgColor} 
                  strokeWidth="2" 
                />

                {/* Labels */}
                <text 
                  y={node.id === "router" ? 58 : 48} 
                  textAnchor="middle" 
                  fill={textColor} 
                  fontSize="14" 
                  fontWeight="600"
                  fontFamily="system-ui, sans-serif"
                >
                  {node.label}
                </text>
                <text 
                  y={node.id === "router" ? 75 : 65} 
                  textAnchor="middle" 
                  fill={subTextColor} 
                  fontSize="12" 
                  fontFamily="monospace"
                >
                  {node.sublabel}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
