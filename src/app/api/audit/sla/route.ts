import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const stats = await prisma.routerStat.findMany({
      where: {
        createdAt: { gte: startOfMonth },
      },
      select: {
        wan1Status: true,
        wan2Status: true,
      }
    });

    if (stats.length === 0) {
      return NextResponse.json({ wan1Sla: 100, wan2Sla: 100 });
    }

    let wan1OnlineCount = 0;
    let wan2OnlineCount = 0;

    for (const stat of stats) {
      if (stat.wan1Status === "Online") wan1OnlineCount++;
      if (stat.wan2Status === "Online") wan2OnlineCount++;
    }

    const wan1Sla = (wan1OnlineCount / stats.length) * 100;
    const wan2Sla = (wan2OnlineCount / stats.length) * 100;

    return NextResponse.json({
      wan1Sla: parseFloat(wan1Sla.toFixed(2)),
      wan2Sla: parseFloat(wan2Sla.toFixed(2)),
    });
  } catch (error) {
    console.error("Error calculating SLA:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
