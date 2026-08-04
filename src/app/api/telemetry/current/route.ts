import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const livePath = require('path').join(process.cwd(), '.live_telemetry.json');
    if (require('fs').existsSync(livePath)) {
      const raw = require('fs').readFileSync(livePath, 'utf-8');
      return NextResponse.json(JSON.parse(raw));
    } else {
      return NextResponse.json({ error: "No live telemetry data available" }, { status: 404 });
    }
  } catch (error) {
    console.error("Prisma error:", error);
    return NextResponse.json({ error: "Internal server error connecting to DB" }, { status: 500 });
  }
}
