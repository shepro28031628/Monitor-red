import { PrismaClient } from "@prisma/client";
import { sendAlertEmail } from "./mailer";

export async function generateDailyReport(prisma: PrismaClient) {
  const recipient = process.env.ALERT_EMAIL_TO;
  if (!recipient) return;

  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  
  const stats = await prisma.routerStat.findMany({
    where: { createdAt: { gte: yesterday } },
    select: { 
      cpuLoad: true, 
      activeConnections: true, 
      vpnCount: true,
      wan1Rx: true,
      wan1Tx: true,
      wan2Rx: true,
      wan2Tx: true,
      pingAvgMs: true,
      pingLossPercent: true
    }
  });

  const alerts = await prisma.systemAlert.findMany({
    where: { createdAt: { gte: yesterday } }
  });

  const numStats = stats.length;
  if (numStats === 0) return;

  // Safely handle possible nulls and Decimal types
  const avgCpu = (
    stats.reduce((acc, stat) => acc + Number(stat.cpuLoad ?? 0), 0) / numStats
  ).toFixed(1);
  const avgVpn = (
    stats.reduce((acc, stat) => acc + Number(stat.vpnCount ?? 0), 0) / numStats
  ).toFixed(1);
  const avgConns = (
    stats.reduce((acc, stat) => acc + Number(stat.activeConnections ?? 0), 0) /
    numStats
  ).toFixed(0);

  const avgWan1Rx = (
    stats.reduce((acc, stat) => acc + Number(stat.wan1Rx || 0n), 0) /
    numStats /
    1000000
  ).toFixed(2);
  const avgWan1Tx = (
    stats.reduce((acc, stat) => acc + Number(stat.wan1Tx || 0n), 0) /
    numStats /
    1000000
  ).toFixed(2);
  const avgWan2Rx = (
    stats.reduce((acc, stat) => acc + Number(stat.wan2Rx || 0n), 0) /
    numStats /
    1000000
  ).toFixed(2);
  const avgWan2Tx = (
    stats.reduce((acc, stat) => acc + Number(stat.wan2Tx || 0n), 0) /
    numStats /
    1000000
  ).toFixed(2);

  const avgPing = (
    stats.reduce((acc, stat) => acc + Number(stat.pingAvgMs ?? 0), 0) /
    numStats
  ).toFixed(1);

  const numAlerts = alerts.length;
  const criticalAlerts = alerts.filter(a => a.severity === "Critical").length;
  const activeAlerts = alerts.filter(a => !a.resolvedAt).length;

  const reportDate = new Date().toLocaleDateString("es-CO", { timeZone: "America/Bogota" });

  const message = `
    <div style="font-family: sans-serif; padding: 20px;">
      <h2>Resumen Diario de Red - ${reportDate}</h2>
      
      <h3>Métricas Promedio (Últimas 24h)</h3>
      <ul>
        <li><b>CPU:</b> ${avgCpu}%</li>
        <li><b>Conexiones Activas:</b> ${avgConns}</li>
        <li><b>Conexiones VPN:</b> ${avgVpn}</li>
        <li><b>Ping a Internet:</b> ${avgPing} ms</li>
      </ul>

      <h3>Tráfico Promedio (Mbps)</h3>
      <ul>
        <li><b>WAN 1:</b> ${avgWan1Rx} Rx / ${avgWan1Tx} Tx</li>
        <li><b>WAN 2:</b> ${avgWan2Rx} Rx / ${avgWan2Tx} Tx</li>
      </ul>

      <h3>Resumen de Alertas</h3>
      <ul>
        <li><b>Total de Alertas:</b> ${numAlerts}</li>
        <li><b>Alertas Críticas:</b> ${criticalAlerts}</li>
        <li><b>Alertas sin resolver:</b> ${activeAlerts}</li>
      </ul>
      
      <p style="margin-top: 20px; color: #666; font-size: 12px;">Generado automáticamente por REN Monitor.</p>
    </div>
  `;

  // Use the existing mailer infrastructure, but format it slightly differently if we want
  // However, sendAlertEmail works fine if we mock the payload
  await sendAlertEmail({
    alertType: "DAILY_REPORT",
    severity: "Warning", // Use warning color/style
    message: message,
    timestamp: new Date()
  });
}
