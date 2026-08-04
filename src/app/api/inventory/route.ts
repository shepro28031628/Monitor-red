import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const devices = await prisma.deviceInventory.findMany({
      orderBy: [
        { isOnline: "desc" },
        { lastSeen: "desc" },
      ],
    });

    return NextResponse.json({ success: true, data: devices });
  } catch (error) {
    console.error("Prisma error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error connecting to DB" },
      { status: 500 }
    );
  }
}
