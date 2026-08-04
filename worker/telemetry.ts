/**
 * REN Enterprise Monitor — Telemetry Worker
 *
 * - Live dashboard stream: polls every POLL_INTERVAL_MS (2s by default)
 * - RouterStat DB write: max every 10 min (600s), or immediately on critical events
 * - Connection Session Tracker: opens a session when a user appears, closes it when gone
 * - Device Inventory: ARP/DHCP mapping every 5 minutes
 */

import "dotenv/config";
import { RouterOSAPI } from "node-routeros";
import { prisma } from "../src/lib/prisma";
import { Prisma } from "@prisma/client";
import { evaluateAlerts } from "../src/lib/alerts";
import * as fs from "fs";
import * as path from "path";
import { redis } from "../src/lib/redis";
import "./queue";

// ── Config (from .env) ─────────────────────────────────────────────
const MIKROTIK_PORT = Number(process.env.MIKROTIK_PORT) || 8728;
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS) || 2000;
const WAN1_IFACE = process.env.WAN1_IFACE || "v_2689";
const WAN2_IFACE = process.env.WAN2_IFACE || "WAN2-ether3";
const PING_TARGET = process.env.PING_TARGET || "1.1.1.1";

// How often to write a RouterStat record to the DB (for audit trail)
const DB_WRITE_INTERVAL_MS = Number(process.env.DB_WRITE_INTERVAL_MS) || 10 * 60 * 1000; // 10 min
// Force a DB write if CPU or ping loss crosses these thresholds (critical events)
const CRITICAL_CPU = Number(process.env.CRITICAL_CPU) || 85;
const CRITICAL_PING_LOSS = Number(process.env.CRITICAL_PING_LOSS) || 50;
// Force a DB write every 60s when in critical state
const CRITICAL_DB_WRITE_INTERVAL_MS = 60_000;

const MAX_RECONNECT_DELAY_MS = 30_000;
const MIN_RECONNECT_DELAY_MS = 2_000;

// ── Jira Assets Config ──────────────────────────────────────────────
const JIRA_URL = process.env.JIRA_URL || "https://api.atlassian.com";
const JIRA_EMAIL = process.env.JIRA_EMAIL || "";
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN || "";
const JIRA_WORKSPACE_ID = process.env.JIRA_WORKSPACE_ID || "";
import * as https from "https";

interface MikrotikConfig {
  host: string;
  user: string;
  password: string;
  port: number;
}

let mikrotikConfig: MikrotikConfig;

// ── Required env validation ────────────────────────────────────────
function validateEnv(): MikrotikConfig {
  const host = process.env.MIKROTIK_HOST;
  const user = process.env.MIKROTIK_USER;
  const password = process.env.MIKROTIK_PASSWORD;

  const missing: string[] = [];
  if (!host) missing.push("MIKROTIK_HOST");
  if (!user) missing.push("MIKROTIK_USER");
  if (!password) missing.push("MIKROTIK_PASSWORD");

  if (missing.length > 0) {
    logError(`Faltan variables de entorno: ${missing.join(", ")}.`);
    process.exit(1);
  }
  if (Number.isNaN(POLL_INTERVAL_MS) || POLL_INTERVAL_MS < 1000) {
    logError(`POLL_INTERVAL_MS invalido. Debe ser >= 1000.`);
    process.exit(1);
  }
  return { host: host as string, user: user as string, password: password as string, port: MIKROTIK_PORT };
}

// ── State ───────────────────────────────────────────────────────────
let api: RouterOSAPI | null = null;
let connecting = false;
let prevWan1Rx = 0n;
let prevWan1Tx = 0n;
let prevWan2Rx = 0n;
let prevWan2Tx = 0n;
let firstSample = true;
let reconnectDelayMs = MIN_RECONNECT_DELAY_MS;
let shuttingDown = false;

// ── Cached values for slow-polling parameters ──────────────────────
let cachedUptime = "—";
let cachedWan1Ip = "Desconocida";
let cachedWan2Ip = "Desconocida";
let cachedPingAvgMs: number | null = null;
let cachedPingLossPercent: number | null = null;
let cachedVpnProfilesDetail: VpnUserDetail[] = [];
let cachedVpnCount = 0;
let cachedActiveConnections = 0;
let cachedVoltage = 0;
let cachedTemperature = 0;
let cachedDhcpLeases = 0;
let cachedQueueCount = 0;

let lastSlowPollTime = 0;
const SLOW_POLL_INTERVAL_MS = 15_000; // 15 s — balance between real-time and MikroTik CPU load

// ── DB write timing ────────────────────────────────────────────────
let lastDbWriteTime = 0;
let lastCriticalDbWriteTime = 0;

// ── Session Tracking (for audit) ───────────────────────────────────
// key: "VPN:username" or "DHCP:macAddress"
const activeSessions = new Map<string, { dbId: number; rxBytes: bigint; txBytes: bigint }>();

// ── Live status (written to Redis every poll so UI always has fresh info) ─
const LIVE_STATUS_KEY = "live_telemetry";

function writeLiveStatus(payload: Record<string, unknown>) {
  try {
    const dataStr = JSON.stringify(payload, (_, v) =>
      typeof v === "bigint" ? Number(v) : v
    );

    // Write to local file as a robust fallback
    try {
      fs.writeFileSync(path.join(process.cwd(), ".live_telemetry.json"), dataStr, "utf8");
    } catch (fsErr) {
      // ignore fs errors to not spam
    }

    if (redis.status !== "ready") return; // Skip Redis if unavailable
    
    // Write to redis with an expiration of 15 seconds (so it auto-clears if worker dies)
    redis.set(LIVE_STATUS_KEY, dataStr, "EX", 15).catch((err) => {
      // Catch async errors like "Connection is closed"
      if (!global._redisErrorLogged) {
        console.warn("[Redis] No se pudo guardar live status:", err.message);
      }
    });
  } catch (e) {
    logError("Error serializando live status", e);
  }
}

// ── Helpers ─────────────────────────────────────────────────────────
function log(msg: string) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${msg}`);
}

function logError(msg: string, err?: unknown) {
  const ts = new Date().toISOString();
  console.error(`[${ts}] X ${msg}`, err instanceof Error ? err.message : err ?? "");
}

function parseUptime(raw: string): string {
  const match = raw.match(/(?:(\d+)w)?(?:(\d+)d)?(\d{2}):(\d{2}):(\d{2})/);
  if (!match) return raw;
  const weeks = Number(match[1] || 0);
  const days = Number(match[2] || 0) + weeks * 7;
  const h = match[3];
  const m = match[4];
  return `${days}d ${h}h ${m}m`;
}

function safeBigInt(val: string | undefined): bigint {
  if (!val) return 0n;
  try { return BigInt(val); } catch { return 0n; }
}

function nonNegativeDelta(current: bigint, previous: bigint): bigint {
  const delta = current - previous;
  return delta < 0n ? 0n : delta;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── MikroTik Connection ─────────────────────────────────────────────
async function connectToRouter(): Promise<boolean> {
  if (connecting) return false;
  connecting = true;
  try {
    const conn = new RouterOSAPI({
      host: mikrotikConfig.host,
      user: mikrotikConfig.user,
      password: mikrotikConfig.password,
      port: mikrotikConfig.port,
      timeout: 10,
      keepalive: true,
    });
    // Ensure connect doesn't hang on DNS or silent socket drops
    await Promise.race([
      conn.connect(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timeout trying to connect to MikroTik")), 10000))
    ]);
    api = conn;
    log(`Conectado a MikroTik en ${mikrotikConfig.host}:${mikrotikConfig.port}`);
    firstSample = true;
    reconnectDelayMs = MIN_RECONNECT_DELAY_MS;
    api.on("close", () => { log("Conexion cerrada. Reconectando..."); api = null; });
    api.on("error", (err: unknown) => { logError("Error en conexion MikroTik", err); api = null; });
    return true;
  } catch (err) {
    logError(`No se pudo conectar (espera ${reconnectDelayMs}ms).`, err);
    api = null;
    return false;
  } finally {
    connecting = false;
  }
}

// ── Interfaces ──────────────────────────────────────────────────────
interface VpnUserDetail {
  name: string;
  service: string;
  profile: string;
  callerID: string;
  address: string;
  uptime: string;
  connected: boolean;
  rxBytes?: bigint;
  txBytes?: bigint;
}

interface TelemetrySnapshot {
  cpuLoad: number;
  freeMemory: bigint;
  totalMemory: bigint;
  hddFree: bigint;
  hddTotal: bigint;
  temperature: number;
  voltage: number;
  uptime: string;
  wan1Rx: bigint;
  wan1Tx: bigint;
  wan2Rx: bigint;
  wan2Tx: bigint;
  vpnCount: number;
  activeConnections: number;
  wan1Ip: string;
  wan1Status: string;
  wan2Ip: string;
  wan2Status: string;
  pingAvgMs: number | null;
  pingLossPercent: number | null;
  vpnProfilesDetail: VpnUserDetail[];
  dhcpLeases: number;
  queueCount: number;
}

// ── Collector ───────────────────────────────────────────────────────
async function collectFromRouter(): Promise<TelemetrySnapshot> {
  if (!api || !api.connected) throw new Error("Not connected");

  const [res] = await api.write("/system/resource/print");
  const [wan1] = await api.write("/interface/print", [`?name=${WAN1_IFACE}`]);
  const [wan2] = await api.write("/interface/print", [`?name=${WAN2_IFACE}`]);

  const currentWan1Rx = safeBigInt(wan1?.["rx-byte"]);
  const currentWan1Tx = safeBigInt(wan1?.["tx-byte"]);
  const currentWan2Rx = safeBigInt(wan2?.["rx-byte"]);
  const currentWan2Tx = safeBigInt(wan2?.["tx-byte"]);
  const wan1Status = (wan1?.running === "true" || wan1?.running === true) ? "Online" : "Offline";
  const wan2Status = (wan2?.running === "true" || wan2?.running === true) ? "Online" : "Offline";

  let wan1RxBps = 0n, wan1TxBps = 0n, wan2RxBps = 0n, wan2TxBps = 0n;
  if (!firstSample) {
    const intervalSeconds = BigInt(Math.max(1, Math.round(POLL_INTERVAL_MS / 1000)));
    wan1RxBps = (nonNegativeDelta(currentWan1Rx, prevWan1Rx) * 8n) / intervalSeconds;
    wan1TxBps = (nonNegativeDelta(currentWan1Tx, prevWan1Tx) * 8n) / intervalSeconds;
    wan2RxBps = (nonNegativeDelta(currentWan2Rx, prevWan2Rx) * 8n) / intervalSeconds;
    wan2TxBps = (nonNegativeDelta(currentWan2Tx, prevWan2Tx) * 8n) / intervalSeconds;
  }
  firstSample = false;
  prevWan1Rx = currentWan1Rx; prevWan1Tx = currentWan1Tx;
  prevWan2Rx = currentWan2Rx; prevWan2Tx = currentWan2Tx;

  const now = Date.now();
  const shouldPollSlow = (now - lastSlowPollTime >= SLOW_POLL_INTERVAL_MS) || lastSlowPollTime === 0;

  if (shouldPollSlow) {
    lastSlowPollTime = now;
    // log("[Worker] Consulta lenta al MikroTik (VPN, DHCP, ping, health)...");

    try {
      interface IpAddressInfo { interface: string; address?: string;[key: string]: unknown; }
      const ips = (await api.write("/ip/address/print")) as IpAddressInfo[];
      cachedWan1Ip = ips.find(ip => ip.interface === WAN1_IFACE)?.address?.split("/")[0] || "Desconocida";
      cachedWan2Ip = ips.find(ip => ip.interface === WAN2_IFACE)?.address?.split("/")[0] || "Desconocida";
    } catch (err) { logError("Error al consultar IPs", err); }

    await new Promise(r => setTimeout(r, 500));

    try {
      const pingRes = await api.write("/ping", [`=address=${PING_TARGET}`, "=count=3"]);
      const lastPing = pingRes[pingRes.length - 1];
      if (lastPing) {
        cachedPingAvgMs = lastPing["avg-rtt"] ? parseFloat(lastPing["avg-rtt"].replace("ms", "")) : null;
        cachedPingLossPercent = lastPing["packet-loss"] ? parseInt(lastPing["packet-loss"]) : 0;
      }
    } catch (err) {
      logError(`Error al hacer ping hacia ${PING_TARGET}`, err);
      cachedPingAvgMs = null;
      cachedPingLossPercent = 100;
    }

    await new Promise(r => setTimeout(r, 500));

    try {
      const secrets = await api.write("/ppp/secret/print");
      const actives = await api.write("/ppp/active/print");
      const ifaces = await api.write("/interface/print");
      const list: VpnUserDetail[] = [];
      const str = (v: unknown, fallback = "") => typeof v === "string" ? v : fallback;

      for (const secret of secrets) {
        const userName = str(secret["name"]);
        const activeEntry = (actives as Record<string, unknown>[]).find(a => a["name"] === userName);
        
        let rx = 0n;
        let tx = 0n;
        if (activeEntry) {
          const ifaceEntry = (ifaces as Record<string, unknown>[]).find(i => 
            String(i["name"]).includes(userName)
          );
          if (ifaceEntry) {
            rx = safeBigInt(ifaceEntry["rx-byte"] as string);
            tx = safeBigInt(ifaceEntry["tx-byte"] as string);
          }
        }

        list.push({
          name: userName,
          service: str(activeEntry?.["service"]) || str(secret["service"]) || "pptp",
          profile: str(secret["profile"]) || "default",
          callerID: str(activeEntry?.["caller-id"]),
          address: str(activeEntry?.["address"]),
          uptime: str(activeEntry?.["uptime"]),
          connected: !!activeEntry,
          rxBytes: rx,
          txBytes: tx,
        });
      }

      const secretNames = new Set(secrets.map(s => s["name"] as string));
      for (const active of (actives as Record<string, unknown>[])) {
        const userName = active["name"] as string;
        if (userName && !secretNames.has(userName)) {
          const serviceName = str(active["service"]) || "pptp";
          const ifaceEntry = (ifaces as Record<string, unknown>[]).find(i => 
            String(i["name"]).includes(userName)
          );
          
          let rx = 0n;
          let tx = 0n;
          if (ifaceEntry) {
            rx = safeBigInt(ifaceEntry["rx-byte"] as string);
            tx = safeBigInt(ifaceEntry["tx-byte"] as string);
          }

          list.push({
            name: userName,
            service: serviceName,
            profile: "radius/dynamic",
            callerID: str(active["caller-id"]),
            address: str(active["address"]),
            uptime: str(active["uptime"]),
            connected: true,
            rxBytes: rx,
            txBytes: tx,
          });
        }
      }

      cachedVpnProfilesDetail = list;
      cachedVpnCount = list.filter(v => v.connected).length;
      await trackVpnSessions(list);
    } catch (err) { logError("Error al consultar PPP secrets/active", err); }

    await new Promise(r => setTimeout(r, 500));

    try {
      const conns = await api.write("/ip/firewall/connection/print", ["=count-only="]);
      cachedActiveConnections = Number(conns[0]?.ret ?? 0);
    } catch { /* ignore */ }

    try {
      let voltage = 0;
      let temperature = Number(res["cpu-temperature"] ?? 0);
      const healthItems = await api.write("/system/health/print");
      for (const item of healthItems) {
        if (item["name"] === "voltage" || item["name"] === "board-voltage") voltage = parseFloat(item["value"] || "0");
        else if (item["name"] === "temperature" || item["name"] === "board-temperature" || item["name"] === "board-temperature1") {
          const t = parseFloat(item["value"] || "0");
          if (t > 0) temperature = t;
        }
        if (item["voltage"]) voltage = parseFloat(item["voltage"]);
        if (item["temperature"] && !temperature) temperature = parseFloat(item["temperature"]);
      }
      cachedVoltage = voltage;
      cachedTemperature = temperature;
    } catch (err) { logError("Error al consultar /system/health", err); }

    try {
      const leases = await api.write("/ip/dhcp-server/lease/print");
      cachedDhcpLeases = leases.length;
      await trackDhcpSessions(leases as Record<string, unknown>[]);
    } catch { /* ignore */ }

    try {
      const queues = await api.write("/queue/simple/print");
      cachedQueueCount = queues.length;
    } catch { /* ignore */ }

    cachedUptime = parseUptime(res["uptime"] ?? "0d00:00:00");
  }

  return {
    cpuLoad: Number(res["cpu-load"] ?? 0),
    freeMemory: safeBigInt(res["free-memory"]),
    totalMemory: safeBigInt(res["total-memory"]),
    hddFree: safeBigInt(res["free-hdd-space"]),
    hddTotal: safeBigInt(res["total-hdd-space"]),
    temperature: cachedTemperature,
    voltage: cachedVoltage,
    uptime: cachedUptime,
    wan1Rx: wan1RxBps,
    wan1Tx: wan1TxBps,
    wan2Rx: wan2RxBps,
    wan2Tx: wan2TxBps,
    vpnCount: cachedVpnCount,
    activeConnections: cachedActiveConnections,
    wan1Ip: cachedWan1Ip,
    wan1Status,
    wan2Ip: cachedWan2Ip,
    wan2Status,
    pingAvgMs: cachedPingAvgMs,
    pingLossPercent: cachedPingLossPercent,
    vpnProfilesDetail: cachedVpnProfilesDetail,
    dhcpLeases: cachedDhcpLeases,
    queueCount: cachedQueueCount,
  };
}

// ── Session Trackers ────────────────────────────────────────────────
async function trackVpnSessions(vpnList: VpnUserDetail[]) {
  const currentlyConnected = new Set<string>();

  for (const vpn of vpnList) {
    if (!vpn.connected) continue;
    const key = `VPN:${vpn.name}`;
    currentlyConnected.add(key);

    if (!activeSessions.has(key)) {
      // ── New session: create DB record ──
      try {
        let locationStr: string | null = null;
        if (vpn.callerID && vpn.callerID.match(/^(\d{1,3}\.){3}\d{1,3}$/)) {
          try {
            // ipwho.is allows 10k req/mo for free and has good uptime
            const locRes = await fetch(`https://ipwho.is/${vpn.callerID}`, {
              signal: AbortSignal.timeout(5000),
              headers: { 'User-Agent': 'MikroTik-Monitor/1.0' },
            });
            const locData = await locRes.json();
            if (locData && locData.success && locData.country) {
              locationStr = locData.city ? `${locData.city}, ${locData.country}` : locData.country;
            }
          } catch {
            // Geolocation is optional — network may not allow outbound HTTPS. Silently skip.
          }
        }
        // Find or create device for VPN user so Jira sync can find it
        let device = await prisma.deviceInventory.findFirst({ where: { hostname: vpn.name } });
        if (!device) {
          device = await prisma.deviceInventory.create({
            data: {
              macAddress: `VPN-${vpn.name}`,
              hostname: vpn.name,
              isOnline: true,
              firstSeen: new Date(),
              lastSeen: new Date(),
            }
          });
        }



        const rxNow = vpn.rxBytes ?? 0n;
        const txNow = vpn.txBytes ?? 0n;
        const record = await prisma.connectionSession.create({
          data: {
            username: vpn.name,
            ipAddress: vpn.address || null,
            type: "VPN",
            vpnProfile: vpn.profile || null,
            rxBytes: rxNow,
            txBytes: txNow,
            owner: device?.owner || null,
            location: locationStr,
          },
        });
        activeSessions.set(key, { dbId: record.id, rxBytes: rxNow, txBytes: txNow });
        log(`[Auditoria] Sesion VPN abierta: ${vpn.name} -> IP ${vpn.address}`);
      } catch (err) { logError(`Error abriendo sesion VPN ${vpn.name}`, err); }
    } else {
      // ── Existing session: update bytes in-memory and in DB (live traffic) ──
      const session = activeSessions.get(key)!;
      const rxNow = vpn.rxBytes ?? 0n;
      const txNow = vpn.txBytes ?? 0n;
      // Only update if MikroTik reports a higher value (bytes are cumulative)
      if (rxNow > session.rxBytes || txNow > session.txBytes) {
        session.rxBytes = rxNow;
        session.txBytes = txNow;
        try {
          await prisma.connectionSession.update({
            where: { id: session.dbId },
            data: { rxBytes: rxNow, txBytes: txNow },
          });
        } catch (err) { logError(`Error actualizando bytes VPN ${vpn.name}`, err); }
      }
    }
  }

  for (const [key, session] of activeSessions.entries()) {
    if (!key.startsWith("VPN:")) continue;
    if (!currentlyConnected.has(key)) {
      try {
        await prisma.connectionSession.update({
          where: { id: session.dbId },
          data: { endedAt: new Date(), rxBytes: session.rxBytes, txBytes: session.txBytes },
        });
        log(`[Auditoria] Sesion VPN cerrada: ${key.replace("VPN:", "")} | RX ${session.rxBytes} bytes`);
        activeSessions.delete(key);
      } catch (err) { logError(`Error cerrando sesion VPN ${key}`, err); }
    }
  }
}

async function trackDhcpSessions(leases: Record<string, unknown>[]) {
  const currentlyActive = new Set<string>();

  for (const lease of leases) {
    const mac = lease["mac-address"] as string | undefined;
    const ip = lease["address"] as string | undefined;
    const hostname = (lease["host-name"] as string) || (lease["comment"] as string) || mac || "Desconocido";
    const status = lease["status"] as string | undefined;
    if (!mac || status === "waiting") continue;

    const key = `DHCP:${mac}`;
    currentlyActive.add(key);

    if (!activeSessions.has(key)) {
      try {
        // For DHCP, we match by MAC because multiple IPs/hostnames could shift
        let device = await prisma.deviceInventory.findUnique({ where: { macAddress: mac } });

        // If device has no owner yet, try to find one by normalized hostname
        // (Jira sync may have populated an entry with a matching hostname but different MAC)
        if (!device?.owner && hostname && hostname !== mac) {
          const normHost = hostname.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
          // Look for any device whose hostname normalizes to the same string and has an owner
          const allDevicesWithOwner = await prisma.deviceInventory.findMany({
            where: { owner: { not: null }, hostname: { not: null } },
            select: { id: true, hostname: true, owner: true },
          });
          const matched = allDevicesWithOwner.find(d =>
            d.hostname!.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === normHost
          );
          if (matched?.owner) {
            // Back-fill the owner on the MAC-based record so future lookups are instant
            if (device) {
              await prisma.deviceInventory.update({ where: { macAddress: mac }, data: { owner: matched.owner } });
              device = { ...device, owner: matched.owner };
            }
            log(`[DHCP] Colaborador asociado: ${hostname} (${mac}) -> ${matched.owner}`);
          }
        }

        const record = await prisma.connectionSession.create({
          data: {
            username: hostname,
            macAddress: mac,
            ipAddress: ip || null,
            type: "DHCP",
            rxBytes: 0n,
            txBytes: 0n,
            owner: device?.owner || null,
          },
        });
        activeSessions.set(key, { dbId: record.id, rxBytes: 0n, txBytes: 0n });
        log(`[Auditoria] Sesion DHCP abierta: ${hostname} (${mac}) -> ${ip}${device?.owner ? ` [${device.owner}]` : ""}`);
      } catch (err) { logError(`Error abriendo sesion DHCP ${mac}`, err); }
    }
  }

  for (const [key, session] of activeSessions.entries()) {
    if (!key.startsWith("DHCP:")) continue;
    if (!currentlyActive.has(key)) {
      try {
        await prisma.connectionSession.update({
          where: { id: session.dbId },
          data: { endedAt: new Date(), rxBytes: session.rxBytes, txBytes: session.txBytes },
        });
        log(`[Auditoria] Sesion DHCP cerrada: ${key}`);
        activeSessions.delete(key);
      } catch (err) { logError(`Error cerrando sesion DHCP ${key}`, err); }
    }
  }
}

// ── Smart Persist (Audit-grade) ─────────────────────────────────────
async function maybePersistSnapshot(snap: TelemetrySnapshot) {
  const now = Date.now();
  const isCritical =
    snap.cpuLoad >= CRITICAL_CPU ||
    (snap.pingLossPercent !== null && snap.pingLossPercent >= CRITICAL_PING_LOSS) ||
    snap.wan1Status === "Offline";

  const timeSinceLastWrite = now - lastDbWriteTime;
  const timeSinceLastCritical = now - lastCriticalDbWriteTime;

  const shouldWrite =
    lastDbWriteTime === 0 ||
    timeSinceLastWrite >= DB_WRITE_INTERVAL_MS ||
    (isCritical && timeSinceLastCritical >= CRITICAL_DB_WRITE_INTERVAL_MS);

  if (!shouldWrite) return;

  await prisma.routerStat.create({
    data: {
      cpuLoad: snap.cpuLoad,
      freeMemory: snap.freeMemory,
      totalMemory: snap.totalMemory,
      hddFree: snap.hddFree,
      hddTotal: snap.hddTotal,
      temperature: snap.temperature,
      voltage: snap.voltage,
      uptime: snap.uptime,
      wan1Rx: snap.wan1Rx,
      wan1Tx: snap.wan1Tx,
      wan2Rx: snap.wan2Rx,
      wan2Tx: snap.wan2Tx,
      wan1Ip: snap.wan1Ip,
      wan1Status: snap.wan1Status,
      wan2Ip: snap.wan2Ip,
      wan2Status: snap.wan2Status,
      vpnCount: snap.vpnCount,
      activeConnections: snap.activeConnections,
      pingAvgMs: snap.pingAvgMs,
      pingLossPercent: snap.pingLossPercent,
      vpnProfilesDetail: snap.vpnProfilesDetail as unknown as Prisma.InputJsonValue,
      dhcpLeases: snap.dhcpLeases,
      queueCount: snap.queueCount,
    },
  });

  lastDbWriteTime = now;
  if (isCritical) lastCriticalDbWriteTime = now;

  log(`[DB] RouterStat guardado${isCritical ? " [CRITICO]" : ""} (CPU ${snap.cpuLoad}% | Ping perdida ${snap.pingLossPercent ?? 0}%)`);
}

// ── Jira Assets Sync ──────────────────────────────────────────────────
async function syncJiraInventory() {
  if (!JIRA_EMAIL || !JIRA_API_TOKEN || !JIRA_WORKSPACE_ID) {
    log("[Jira Sync] Omitiendo: faltan credenciales JIRA_EMAIL, JIRA_API_TOKEN o JIRA_WORKSPACE_ID.");
    return;
  }
  
  log("[Jira Sync] Iniciando sincronizacion de inventario desde Jira Assets...");
  
  interface JiraAttributeValue {
    displayValue: string;
  }
  interface JiraAttribute {
    objectTypeAttributeId: string;
    objectAttributeValues: JiraAttributeValue[];
  }
  interface JiraAssetItem {
    label: string;
    attributes: JiraAttribute[];
  }

  const auth = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64');
  let startAt = 0;
  const resultPerPage = 50;
  let hasMore = true;
  let totalUpdated = 0;

  try {
    const allDevices = await prisma.deviceInventory.findMany({
      where: { hostname: { not: null } },
      select: { id: true, hostname: true }
    });

    while (hasMore) {
      const data = JSON.stringify({
        qlQuery: 'objectType = "Portatiles"',
        includeAttributes: true
      });

      const items: JiraAssetItem[] = await new Promise((resolve, reject) => {
        const req = https.request({
          hostname: 'api.atlassian.com',
          path: `/jsm/assets/workspace/${JIRA_WORKSPACE_ID}/v1/object/aql?startAt=${startAt}&maxResults=${resultPerPage}`,
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Content-Length': data.length
          }
        }, (res) => {
          let resData = '';
          res.on('data', (chunk) => resData += chunk);
          res.on('end', () => {
            if (res.statusCode === 200) {
              try { resolve(JSON.parse(resData).values || []); }
              catch(e) { reject(e); }
            } else {
              reject(new Error(`Jira API Error: ${res.statusCode} ${resData}`));
            }
          });
        });
        req.on('error', reject);
        req.write(data);
        req.end();
      });

      if (items.length === 0) {
        hasMore = false;
        break;
      }

      for (const item of items) {
        if (!item.label) continue;
        const normalizedLabel = item.label.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        
        // Attr 642 is "Asignado a"
        const ownerAttr = item.attributes.find((a: JiraAttribute) => a.objectTypeAttributeId === "642");
        const owner = ownerAttr?.objectAttributeValues?.map((v: JiraAttributeValue) => v.displayValue).join(", ") || null;
        
        if (owner) {
          const matchingDevices = allDevices.filter(d => {
            const hostNorm = d.hostname!.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
            return hostNorm === normalizedLabel;
          });
          
          for (const d of matchingDevices) {
            await prisma.deviceInventory.update({
              where: { id: d.id },
              data: { owner }
            });
            totalUpdated++;
          }
        }
      }
      
      startAt += resultPerPage;
    }
    
    log(`[Jira Sync] Sincronizacion completada: ${totalUpdated} dispositivos mapeados con sus empleados.`);
    // After syncing owners from Jira, propagate them to currently-open sessions
    await propagateOwnersToOpenSessions();
  } catch (err) {
    logError("[Jira Sync] Error al sincronizar inventario de Jira", err);
  }
}

// ── Propagate Jira owners to ConnectionSessions ─────────────────────
// Runs after every Jira sync so collaborators are associated for
// all sessions (open and closed) that don't yet have an owner.
async function propagateOwnersToOpenSessions() {
  try {
    // Find all sessions without an owner
    const openWithoutOwner = await prisma.connectionSession.findMany({
      where: { owner: null },
      select: { id: true, username: true, macAddress: true, type: true },
    });

    if (openWithoutOwner.length === 0) return;

    // Pre-load all devices with an owner to avoid N+1 queries
    const devicesWithOwner = await prisma.deviceInventory.findMany({
      where: { owner: { not: null }, hostname: { not: null } },
      select: { macAddress: true, hostname: true, owner: true },
    });

    let updated = 0;
    for (const session of openWithoutOwner) {
      let owner: string | null = null;

      // 1. Try direct MAC lookup
      if (session.macAddress) {
        const byMac = devicesWithOwner.find(d => d.macAddress === session.macAddress);
        if (byMac?.owner) owner = byMac.owner;
      }

      // 2. Try normalized hostname match (for VPN or DHCP without MAC)
      if (!owner && session.username) {
        const normUser = session.username.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        const byHost = devicesWithOwner.find(d => {
          const hostNorm = d.hostname!.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
          return hostNorm === normUser;
        });
        if (byHost?.owner) owner = byHost.owner;
      }

      if (owner) {
        await prisma.connectionSession.update({
          where: { id: session.id },
          data: { owner },
        });
        updated++;
        log(`[Owner Sync] Colaborador asociado a sesion ${session.id} (${session.username || session.macAddress}): ${owner}`);
      }
    }

    if (updated > 0) log(`[Owner Sync] ${updated} sesiones actualizadas con colaborador.`);
  } catch (err) {
    logError("[Owner Sync] Error propagando colaboradores", err);
  }
}

// ── Inventory Mapping ───────────────────────────────────────────────
async function runInventoryMapping() {
  if (!api || !api.connected) return;
  try {
    const arps = await api.write("/ip/arp/print");
    const leases = await api.write("/ip/dhcp-server/lease/print");
    const now = new Date();
    let count = 0;

    for (const arp of arps) {
      const mac = arp["mac-address"] as string | undefined;
      const ip = (arp["address"] as string | undefined) ?? null;
      if (!mac) continue;

      const lease = (leases as Record<string, unknown>[]).find(l => l["mac-address"] === mac);
      const hostname = (lease?.["host-name"] as string) || (lease?.["comment"] as string) || (arp["comment"] as string) || null;

      const device = await prisma.deviceInventory.upsert({
        where: { macAddress: mac },
        update: { ipAddress: ip, hostname, isOnline: true, lastSeen: now },
        create: { macAddress: mac, ipAddress: ip, hostname, isOnline: true, firstSeen: now, lastSeen: now },
      });

      if (!device.vendor) {
        try {
          const res = await fetch(`https://api.macvendors.com/${encodeURIComponent(mac)}`, { signal: AbortSignal.timeout(5000) });
          if (res.ok) {
            const vendor = await res.text();
            if (vendor) await prisma.deviceInventory.update({ where: { macAddress: mac }, data: { vendor } });
          }
        } catch { /* ignore */ }
      }
      count++;
    }
    log(`[Inventario] ${count} dispositivos actualizados.`);
  } catch (err) { logError("Error actualizando inventario", err); }
}


// ── Incident Tracking (connectivity events for audit) ───────────────
// Tracks whether certain conditions are active so we can open/close alerts
let incidentMikrotikDown = false;   // Can't reach MikroTik API
let incidentWan1Down = false;       // WAN1 offline
let incidentWan2Down = false;       // WAN2 offline
let incidentInternetDown = false;   // 100% ping loss (total internet outage)
let incidentInternetDegraded = false; // Partial packet loss >=50% but <100%
let consecutiveFailures = 0;        // How many poll cycles have failed in a row

async function createIncidentAlert(alertType: string, severity: "Warning" | "Critical", message: string) {
  try {
    // Check if one is already open
    const existing = await prisma.systemAlert.findFirst({
      where: { alertType, resolvedAt: null },
    });
    if (existing) return; // Already tracked

    await prisma.systemAlert.create({
      data: { alertType, severity, message },
    });
    log(`[Incidente] ${severity}: ${alertType} — ${message}`);
    
    try {
      const { emailQueue } = await import("./queue");
      // Fire and forget so we don't block the worker loop
      emailQueue?.add("sendAlert", {
        payload: {
          alertType,
          severity,
          message,
          timestamp: new Date(),
        }
      }).catch((e: Error) => logError("No se pudo encolar correo de incidente", e));
    } catch (e) {
      logError("No se pudo cargar la cola", e);
    }
  } catch (err) { logError(`Error creando alerta ${alertType}`, err); }
}

async function resolveIncidentAlert(alertType: string) {
  try {
    const result = await prisma.systemAlert.updateMany({
      where: { alertType, resolvedAt: null },
      data: { resolvedAt: new Date() },
    });
    if (result.count > 0) {
      log(`[Incidente] RESUELTO: ${alertType}`);
      try {
        const { emailQueue } = await import("./queue");
        // Fire and forget
        emailQueue?.add("sendAlert", {
          payload: {
            alertType: `${alertType}_RESOLVED`,
            severity: "Warning", // or derive from previous if needed
            message: `El incidente ${alertType} ha sido resuelto.`,
            timestamp: new Date(),
          }
        }).catch((e: Error) => logError("No se pudo encolar correo de resolucion de incidente", e));
      } catch (e) {
        logError("No se pudo cargar la cola", e);
      }
    }
  } catch (err) { logError(`Error resolviendo alerta ${alertType}`, err); }
}

// ── Main Loop ───────────────────────────────────────────────────────
let lastGoodSnapshot: Record<string, unknown> | null = null;

async function pollOnce() {
  const now = new Date().toISOString();

  if (!api || !api.connected) {
    consecutiveFailures++;
    log(`Sin conexion. Reconectando... [Fallo #${consecutiveFailures}]`);

    // Always write live status so the UI knows we are reconnecting
    writeLiveStatus({
      ...(lastGoodSnapshot ?? {}),
      _workerStatus: "reconnecting",
      _workerConsecutiveFailures: consecutiveFailures,
      _workerStatusAt: now,
    });

    const ok = await connectToRouter();

    if (!ok) {
      // Alert after 3 consecutive failures (~15s of real downtime)
      if (consecutiveFailures >= 3 && !incidentMikrotikDown) {
        incidentMikrotikDown = true;
        await createIncidentAlert(
          "MIKROTIK_UNREACHABLE",
          "Critical",
          `El router MikroTik (${mikrotikConfig.host}) no responde. No se ha podido establecer conexion API despues de ${consecutiveFailures} intentos consecutivos.`
        );
      }
      await sleep(5000);
    } else {
      // Connection restored
      consecutiveFailures = 0;
      if (incidentMikrotikDown) {
        incidentMikrotikDown = false;
        await resolveIncidentAlert("MIKROTIK_UNREACHABLE");
      }
      // Write a quick "reconnected" status (will be overwritten by real data next cycle)
      writeLiveStatus({
        ...(lastGoodSnapshot ?? {}),
        _workerStatus: "connected",
        _workerConsecutiveFailures: 0,
        _workerStatusAt: new Date().toISOString(),
      });
    }
    return;
  }

  // Reset failure counter on successful connection
  consecutiveFailures = 0;
  if (incidentMikrotikDown) {
    incidentMikrotikDown = false;
    await resolveIncidentAlert("MIKROTIK_UNREACHABLE");
  }

  let snapshot: TelemetrySnapshot;
  try {
    // Add a strict timeout to prevent the worker from hanging if the connection drops silently
    snapshot = await Promise.race([
      collectFromRouter(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timeout waiting for MikroTik response")), 15000))
    ]);
  } catch (err) {
    logError("Error al recolectar datos del router", err);
    if (api) { try { await api.close(); } catch { /* ignore */ } }
    api = null;
    // Write error status so the UI knows collection failed
    writeLiveStatus({
      ...(lastGoodSnapshot ?? {}),
      _workerStatus: "error",
      _workerStatusAt: new Date().toISOString(),
    });
    return;
  }

  // ── Detect WAN1 incidents ──
  if (snapshot.wan1Status === "Offline" && !incidentWan1Down) {
    incidentWan1Down = true;
    await createIncidentAlert("WAN1_DOWN", "Critical",
      `La interfaz WAN principal (${WAN1_IFACE}) esta OFFLINE. IP anterior: ${snapshot.wan1Ip}. El servicio de internet principal puede estar caido.`);
  } else if (snapshot.wan1Status === "Online" && incidentWan1Down) {
    incidentWan1Down = false;
    await resolveIncidentAlert("WAN1_DOWN");
  }

  // ── Detect WAN2 incidents ──
  if (snapshot.wan2Status === "Offline" && !incidentWan2Down) {
    incidentWan2Down = true;
    await createIncidentAlert("WAN2_DOWN", "Warning",
      `La interfaz WAN secundaria (${WAN2_IFACE}) esta OFFLINE. IP anterior: ${snapshot.wan2Ip}.`);
  } else if (snapshot.wan2Status === "Online" && incidentWan2Down) {
    incidentWan2Down = false;
    await resolveIncidentAlert("WAN2_DOWN");
  }

  // ── Detect total internet loss (100% ping loss) ──
  if (snapshot.pingLossPercent !== null && snapshot.pingLossPercent >= 100 && !incidentInternetDown) {
    incidentInternetDown = true;
    // If there was a degraded alert open, resolve it first (escalating to Critical)
    if (incidentInternetDegraded) {
      incidentInternetDegraded = false;
      await resolveIncidentAlert("INTERNET_DEGRADED");
    }
    await createIncidentAlert("INTERNET_DOWN", "Critical",
      `Perdida TOTAL de conectividad a internet. Ping a ${PING_TARGET} tiene 100% perdida de paquetes. Todas las WAN pueden estar caidas o hay un problema de enrutamiento.`);
  } else if (snapshot.pingLossPercent !== null && snapshot.pingLossPercent < 100 && incidentInternetDown) {
    incidentInternetDown = false;
    await resolveIncidentAlert("INTERNET_DOWN");
  }

  // ── Detect partial internet degradation (>=50% but <100% ping loss) ──
  const DEGRADED_THRESHOLD = process.env.DEGRADED_PING_LOSS !== undefined ? Number(process.env.DEGRADED_PING_LOSS) : 50;
  if (
    snapshot.pingLossPercent !== null &&
    snapshot.pingLossPercent >= DEGRADED_THRESHOLD &&
    snapshot.pingLossPercent < 100 &&
    !incidentInternetDown &&
    !incidentInternetDegraded
  ) {
    incidentInternetDegraded = true;
    await createIncidentAlert("INTERNET_DEGRADED", "Warning",
      `Conectividad a internet degradada. Ping a ${PING_TARGET} con ${snapshot.pingLossPercent}% de perdida de paquetes (latencia: ${snapshot.pingAvgMs?.toFixed(1) ?? "—"} ms). Puede haber inestabilidad en el ISP.`);
  } else if (
    snapshot.pingLossPercent !== null &&
    (snapshot.pingLossPercent < DEGRADED_THRESHOLD || snapshot.pingLossPercent >= 100) &&
    incidentInternetDegraded
  ) {
    incidentInternetDegraded = false;
    await resolveIncidentAlert("INTERNET_DEGRADED");
  }

  try {
    await maybePersistSnapshot(snapshot);

    await evaluateAlerts(
      {
        cpuLoad: snapshot.cpuLoad,
        freeMemory: snapshot.freeMemory,
        totalMemory: snapshot.totalMemory,
        temperature: snapshot.temperature,
        pingLossPercent: snapshot.pingLossPercent,
        voltage: snapshot.voltage,
        hddFree: snapshot.hddFree,
        hddTotal: snapshot.hddTotal,
      },
      prisma
    );

    // Always write fresh live status on successful collection
    const livePayload: Record<string, unknown> = {
      ...snapshot,
      createdAt: new Date().toISOString(),
      _workerStatus: "connected",
      _workerConsecutiveFailures: 0,
      _workerStatusAt: new Date().toISOString(),
    };
    lastGoodSnapshot = livePayload;
    writeLiveStatus(livePayload);

  } catch (err) {
    logError("Error al persistir telemetria o evaluar alertas", err);
  }
}

async function main() {
  mikrotikConfig = validateEnv();
  log("=========================================================");
  log("  REN Microtik Monitor — Auditoria Habilitada");
  log(`  MikroTik: ${mikrotikConfig.host}:${mikrotikConfig.port}`);
  log(`  Polling: ${POLL_INTERVAL_MS}ms | DB Write: cada ${DB_WRITE_INTERVAL_MS / 60000} min`);
  log("=========================================================");

  log("[Auditoria] Limpiando sesiones huerfanas (cierre inesperado anterior)...");
  try {
    const res = await prisma.connectionSession.updateMany({
      where: { endedAt: null },
      data: { endedAt: new Date() },
    });
    log(`[Auditoria] ${res.count} sesiones anteriores marcadas como cerradas.`);
  } catch (err) {
    logError("Error limpiando sesiones huerfanas", err);
  }

  await connectToRouter();

  setInterval(() => { if (!shuttingDown) runInventoryMapping(); }, 5 * 60 * 1000);
  setInterval(() => { if (!shuttingDown) syncJiraInventory(); }, 15 * 60 * 1000); // Every 15 min



  setTimeout(() => runInventoryMapping(), 10_000);
  setTimeout(() => syncJiraInventory(), 15_000);

  while (!shuttingDown) {
    await pollOnce();
    await sleep(POLL_INTERVAL_MS);
  }
}

// ── Graceful Shutdown ───────────────────────────────────────────────
async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  log("Cerrando worker...");

  log(`[Auditoria] Cerrando ${activeSessions.size} sesiones abiertas...`);
  const now = new Date();
  for (const [, session] of activeSessions.entries()) {
    try {
      await prisma.connectionSession.update({
        where: { id: session.dbId },
        data: { endedAt: now, rxBytes: session.rxBytes, txBytes: session.txBytes },
      });
    } catch { /* ignore */ }
  }
  activeSessions.clear();

  try { if (api && api.connected) await api.close(); } catch { /* ignore */ }
  try { await prisma.$disconnect(); } catch { /* ignore */ }
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

main().catch((err) => {
  logError("Error fatal en el worker", err);
  process.exit(1);
});