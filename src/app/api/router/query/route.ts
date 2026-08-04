import { NextResponse } from "next/server";
import { RouterOSAPI } from "node-routeros";
import "dotenv/config";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const path = searchParams.get("path");

  if (!path) {
    return NextResponse.json({ error: "Parámetro 'path' es requerido (ej. /ip/address/print)" }, { status: 400 });
  }

  // Medida de seguridad: Permitir únicamente comandos de lectura
  if (!path.endsWith("print")) {
    return NextResponse.json({ error: "Seguridad: Solo se permiten comandos terminados en 'print'." }, { status: 403 });
  }

  const host = process.env.MIKROTIK_HOST;
  const user = process.env.MIKROTIK_USER;
  const password = process.env.MIKROTIK_PASSWORD;
  const port = Number(process.env.MIKROTIK_PORT) || 8728;

  if (!host || !user || !password) {
    return NextResponse.json({ error: "Credenciales de MikroTik no configuradas en el servidor." }, { status: 500 });
  }

  try {
    const conn = new RouterOSAPI({
      host,
      user,
      password,
      port,
      timeout: 5,
    });

    await conn.connect();
    
    // Ejecutar el comando. Si la API de MikroTik falla, node-routeros lanza un error.
    const results = await conn.write(path);
    
    await conn.close();

    return NextResponse.json({ success: true, data: results });
  } catch (error) {
    console.error(`Error ejecutando comando MikroTik [${path}]:`, error);
    const err = error as Error;
    return NextResponse.json({ success: false, error: err.message || "Fallo de conexión o comando inválido" }, { status: 500 });
  }
}
