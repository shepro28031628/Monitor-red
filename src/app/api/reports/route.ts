// This endpoint has been disabled as per request to remove daily reports.
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ success: false, error: "Reporte diario deshabilitado" }, { status: 410 });
}
