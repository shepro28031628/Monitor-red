import "dotenv/config";
import * as https from "https";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const JIRA_EMAIL = process.env.JIRA_EMAIL || "";
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN || "";
const JIRA_WORKSPACE_ID = process.env.JIRA_WORKSPACE_ID || "";

async function fetchAllJiraPortatiles(): Promise<Map<string, string>> {
  const auth = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64');
  const ownerMap = new Map<string, string>(); // normalizedLabel -> ownerName
  let startAt = 0;
  const pageSize = 50;
  let hasMore = true;

  while (hasMore) {
    const data = JSON.stringify({
      qlQuery: 'objectType = "Portatiles"',
      includeAttributes: true
    });

    const items: any[] = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'api.atlassian.com',
        path: `/jsm/assets/workspace/${JIRA_WORKSPACE_ID}/v1/object/aql?startAt=${startAt}&maxResults=${pageSize}`,
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Content-Length': data.length
        }
      }, (res) => {
        let resData = '';
        res.on('data', (chunk: string) => resData += chunk);
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

    if (items.length === 0) { hasMore = false; break; }

    for (const item of items) {
      if (!item.label) continue;
      const normalizedLabel = item.label.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      const ownerAttr = item.attributes.find((a: any) => a.objectTypeAttributeId === "642");
      const owner = ownerAttr?.objectAttributeValues?.map((v: any) => v.displayValue).join(", ") || null;
      if (owner) {
        ownerMap.set(normalizedLabel, owner);
      }
    }

    startAt += pageSize;
  }

  console.log(`[Jira] Loaded ${ownerMap.size} portatiles with owners from Jira.`);
  return ownerMap;
}

async function syncDeviceInventory(ownerMap: Map<string, string>) {
  const allDevices = await prisma.deviceInventory.findMany({
    where: { hostname: { not: null } },
    select: { id: true, hostname: true, owner: true }
  });

  let updated = 0;
  for (const device of allDevices) {
    const hostNorm = device.hostname!.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const owner = ownerMap.get(hostNorm);
    if (owner && owner !== device.owner) {
      await prisma.deviceInventory.update({
        where: { id: device.id },
        data: { owner }
      });
      updated++;
    }
  }
  console.log(`[DeviceInventory] Updated ${updated}/${allDevices.length} devices with owners.`);
}

async function syncAllSessions(ownerMap: Map<string, string>) {
  // Get ALL sessions without owners (not just open ones)
  const sessionsWithoutOwner = await prisma.connectionSession.findMany({
    where: { owner: null },
    select: { id: true, username: true, macAddress: true },
  });

  console.log(`[Sessions] Found ${sessionsWithoutOwner.length} sessions without owner.`);

  // Also get devices with owners for MAC-based matching
  const devicesWithOwner = await prisma.deviceInventory.findMany({
    where: { owner: { not: null }, hostname: { not: null } },
    select: { macAddress: true, hostname: true, owner: true },
  });

  let updated = 0;
  for (const session of sessionsWithoutOwner) {
    let owner: string | null = null;

    // Try by MAC address
    if (session.macAddress) {
      const byMac = devicesWithOwner.find(d => d.macAddress === session.macAddress);
      if (byMac?.owner) owner = byMac.owner;
    }

    // Try by username (hostname normalization)
    if (!owner && session.username) {
      const normUser = session.username.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      // Direct Jira lookup
      const jiraOwner = ownerMap.get(normUser);
      if (jiraOwner) {
        owner = jiraOwner;
      } else {
        // Fallback: match against device inventory hostnames
        const byHost = devicesWithOwner.find(d => {
          const hostNorm = d.hostname!.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
          return hostNorm === normUser;
        });
        if (byHost?.owner) owner = byHost.owner;
      }
    }

    if (owner) {
      await prisma.connectionSession.update({
        where: { id: session.id },
        data: { owner },
      });
      updated++;
    }
  }

  console.log(`[Sessions] Updated ${updated}/${sessionsWithoutOwner.length} sessions with owners.`);
}

async function main() {
  console.log("=== Full Jira Sync ===");
  const ownerMap = await fetchAllJiraPortatiles();
  await syncDeviceInventory(ownerMap);
  await syncAllSessions(ownerMap);
  console.log("=== Done ===");
  await prisma.$disconnect();
  await pool.end();
}

main().catch(console.error);
