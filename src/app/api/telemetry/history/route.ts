import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const minutes = Number(req.nextUrl.searchParams.get("minutes")) || 0;
    
    if (minutes === 0) {
      // Default: last 20 for live view
      const history = await prisma.routerStat.findMany({
        take: 20,
        orderBy: { createdAt: "desc" },
        select: { 
          createdAt: true, 
          wan1Rx: true, 
          wan1Tx: true, 
          wan2Rx: true, 
          wan2Tx: true,
          cpuLoad: true,
          freeMemory: true,
          totalMemory: true,
          pingAvgMs: true,
          pingLossPercent: true
        }
      });
      
      const data = JSON.parse(
        JSON.stringify(history.reverse(), (key, value) =>
          typeof value === "bigint" ? Number(value) : value
        )
      );
      
      return NextResponse.json({ data });
    }

    // Historical view with server-side grouping (downsampling)
    const sinceDate = new Date(Date.now() - minutes * 60000);
    
    interface GroupedTelemetryRow {
      createdAt: Date;
      wan1Rx: string | number | null;
      wan1Tx: string | number | null;
      wan2Rx: string | number | null;
      wan2Tx: string | number | null;
      cpuLoad: string | number | null;
      freeMemory: string | number | null;
      totalMemory: string | number | null;
      pingAvgMs: string | number | null;
      pingLossPercent: string | number | null;
    }

    // Group by minute or hour depending on timeframe
    const truncUnit = minutes > 1440 ? 'hour' : 'minute';
    
    // Group using Postgres date_trunc
    let data: GroupedTelemetryRow[];
    
    if (truncUnit === 'hour') {
      data = await prisma.$queryRaw`
        SELECT 
          date_trunc('hour', "createdAt") as "time_bucket",
          MIN("createdAt") as "createdAt",
          AVG("wan1Rx"::numeric) as "wan1Rx",
          AVG("wan1Tx"::numeric) as "wan1Tx",
          AVG("wan2Rx"::numeric) as "wan2Rx",
          AVG("wan2Tx"::numeric) as "wan2Tx",
          AVG("cpuLoad"::numeric) as "cpuLoad",
          AVG("freeMemory"::numeric) as "freeMemory",
          AVG("totalMemory"::numeric) as "totalMemory",
          AVG("pingAvgMs"::numeric) as "pingAvgMs",
          AVG("pingLossPercent"::numeric) as "pingLossPercent"
        FROM "RouterStat"
        WHERE "createdAt" >= ${sinceDate}
        GROUP BY 1
        ORDER BY 1 ASC
      `;
    } else {
      data = await prisma.$queryRaw`
        SELECT 
          date_trunc('minute', "createdAt") as "time_bucket",
          MIN("createdAt") as "createdAt",
          AVG("wan1Rx"::numeric) as "wan1Rx",
          AVG("wan1Tx"::numeric) as "wan1Tx",
          AVG("wan2Rx"::numeric) as "wan2Rx",
          AVG("wan2Tx"::numeric) as "wan2Tx",
          AVG("cpuLoad"::numeric) as "cpuLoad",
          AVG("freeMemory"::numeric) as "freeMemory",
          AVG("totalMemory"::numeric) as "totalMemory",
          AVG("pingAvgMs"::numeric) as "pingAvgMs",
          AVG("pingLossPercent"::numeric) as "pingLossPercent"
        FROM "RouterStat"
        WHERE "createdAt" >= ${sinceDate}
        GROUP BY 1
        ORDER BY 1 ASC
      `;
    }

    const parsedData = data.map(row => ({
      createdAt: row.createdAt,
      wan1Rx: Number(row.wan1Rx || 0),
      wan1Tx: Number(row.wan1Tx || 0),
      wan2Rx: Number(row.wan2Rx || 0),
      wan2Tx: Number(row.wan2Tx || 0),
      cpuLoad: Number(row.cpuLoad || 0),
      freeMemory: Number(row.freeMemory || 0),
      totalMemory: Number(row.totalMemory || 1), // Avoid division by zero
      time: row.createdAt, // PingChart expects 'time'
      pingAvgMs: Number(row.pingAvgMs || 0),
      pingLossPercent: Number(row.pingLossPercent || 0),
    }));

    // If still too many rows (e.g. 24h = 1440 minutes = 1440 rows), downsample in JS to ~60 points.
    let finalData = parsedData;
    if (finalData.length > 80) {
      const bucketSize = Math.ceil(finalData.length / 60);
      const sampled = [];
      for (let i = 0; i < finalData.length; i += bucketSize) {
        const bucket = finalData.slice(i, i + bucketSize);
        sampled.push({
          createdAt: bucket[0].createdAt,
          wan1Rx: bucket.reduce((acc, val) => acc + val.wan1Rx, 0) / bucket.length,
          wan1Tx: bucket.reduce((acc, val) => acc + val.wan1Tx, 0) / bucket.length,
          wan2Rx: bucket.reduce((acc, val) => acc + val.wan2Rx, 0) / bucket.length,
          wan2Tx: bucket.reduce((acc, val) => acc + val.wan2Tx, 0) / bucket.length,
          cpuLoad: bucket.reduce((acc, val) => acc + val.cpuLoad, 0) / bucket.length,
          freeMemory: bucket.reduce((acc, val) => acc + val.freeMemory, 0) / bucket.length,
          totalMemory: bucket.reduce((acc, val) => acc + val.totalMemory, 0) / bucket.length,
          time: bucket[0].time,
          pingAvgMs: bucket.reduce((acc, val) => acc + val.pingAvgMs, 0) / bucket.length,
          pingLossPercent: bucket.reduce((acc, val) => acc + val.pingLossPercent, 0) / bucket.length,
        });
      }
      finalData = sampled;
    }

    return NextResponse.json({ data: finalData });
  } catch (error) {
    console.error("Prisma error:", error);
    return NextResponse.json({ error: "Internal server error connecting to DB", data: [] }, { status: 500 });
  }
}
