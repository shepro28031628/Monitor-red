import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page   = Math.max(1, parseInt(searchParams.get("page")   || "1"));
  const limit  = Math.min(100, parseInt(searchParams.get("limit") || "50"));
  const search = searchParams.get("search") || "";
  const type   = searchParams.get("type")   || ""; // VPN | DHCP | ""
  const from   = searchParams.get("from");          // ISO date
  const to     = searchParams.get("to");
  const profile = searchParams.get("profile") || ""; // VPN profile filter

  const where: Record<string, unknown> = {};

  if (type) where.type = type;
  if (profile) where.vpnProfile = { contains: profile, mode: "insensitive" };
  if (search) {
    where.OR = [
      { username:   { contains: search, mode: "insensitive" } },
      { macAddress: { contains: search, mode: "insensitive" } },
      { ipAddress:  { contains: search, mode: "insensitive" } },
      { owner:      { contains: search, mode: "insensitive" } },
      { vpnProfile: { contains: search, mode: "insensitive" } },
    ];
  }
  if (from || to) {
    where.startedAt = {};
    if (from) (where.startedAt as Record<string, unknown>).gte = new Date(from);
    if (to)   (where.startedAt as Record<string, unknown>).lte = new Date(to);
  }

  try {
    // Set a 10-second statement timeout to prevent the query from hanging
    // when the worker is holding row locks during a session update cycle.
    await prisma.$executeRawUnsafe("SET LOCAL statement_timeout = '10000'");

    const [total, rows] = await Promise.all([
      prisma.connectionSession.count({ where }),
      prisma.connectionSession.findMany({
        where,
        orderBy: { startedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const serialized = rows.map(r => ({
      ...r,
      rxBytes: r.rxBytes !== null ? r.rxBytes.toString() : null,
      txBytes: r.txBytes !== null ? r.txBytes.toString() : null,
    }));

    return NextResponse.json({ success: true, total, page, limit, rows: serialized });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[audit/connections] DB error:", msg);
    // Return empty result instead of hanging — the client will retry on reload
    return NextResponse.json({ success: false, error: msg, total: 0, page, limit, rows: [] }, { status: 500 });
  }
}
