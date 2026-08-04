import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const page     = Math.max(1, Number(sp.get("page")) || 1);
    const limit    = Math.min(100, Math.max(1, Number(sp.get("limit")) || 20));
    const severity = sp.get("severity") || "";      // "Warning" | "Critical"
    const alertType = sp.get("alertType") || "";     // e.g. "HIGH_CPU"
    const status   = sp.get("status") || "";         // "active" | "resolved"
    const from     = sp.get("from") || "";
    const to       = sp.get("to") || "";

    // Build where clause
    const where: Record<string, unknown> = {};

    if (severity) where.severity = severity;
    if (alertType) where.alertType = { contains: alertType, mode: "insensitive" };
    if (status === "active") where.resolvedAt = null;
    if (status === "resolved") where.resolvedAt = { not: null };
    if (from || to) {
      const createdAt: Record<string, Date> = {};
      if (from) createdAt.gte = new Date(from);
      if (to)   createdAt.lte = new Date(to);
      where.createdAt = createdAt;
    }

    // If no query params provided (original behavior), return only active alerts
    const isFullQuery = sp.has("page") || sp.has("status") || sp.has("severity") || sp.has("alertType") || sp.has("from") || sp.has("to");

    if (!isFullQuery) {
      // Original behavior: return active alerts only
      const alerts = await prisma.systemAlert.findMany({
        where: { resolvedAt: null },
        orderBy: { createdAt: "desc" },
      });

      const data = JSON.parse(
        JSON.stringify(alerts, (_key, value) =>
          typeof value === "bigint" ? Number(value) : value
        )
      );

      return NextResponse.json({ data, count: data.length });
    }

    // Full query with pagination
    const [alerts, total] = await Promise.all([
      prisma.systemAlert.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.systemAlert.count({ where }),
    ]);

    const data = JSON.parse(
      JSON.stringify(alerts, (_key, value) =>
        typeof value === "bigint" ? Number(value) : value
      )
    );

    return NextResponse.json({ data, total, page, limit });
  } catch (error) {
    console.error("Error fetching alerts:", error);
    return NextResponse.json({ data: [], count: 0, error: "DB unavailable" });
  }
}
