/**
 * REN Enterprise Monitor — Diagnostics API
 *
 * Executes ping and traceroute commands directly on the MikroTik router
 * via the RouterOS API, instead of running them on the web server.
 */

import { NextResponse } from "next/server";
import { RouterOSAPI } from "node-routeros";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");
  const target = searchParams.get("target");

  if (!action || !target) {
    return NextResponse.json(
      { error: "Faltan parámetros 'action' o 'target'" },
      { status: 400 }
    );
  }

  // Sanitize the target to prevent command injection
  if (!/^[a-zA-Z0-9.-]+$/.test(target)) {
    return NextResponse.json(
      { error: "Target inválido" },
      { status: 400 }
    );
  }

  const conn = new RouterOSAPI({
    host: process.env.MIKROTIK_HOST || "192.168.88.1",
    user: process.env.MIKROTIK_USER || "admin",
    password: process.env.MIKROTIK_PASSWORD || "",
    port: Number(process.env.MIKROTIK_PORT) || 8728,
    timeout: 30,
  });

  try {
    await conn.connect();

    let output = "";

    if (action === "ping") {
      // RouterOS /ping command — count=4 equivalent
      const results = await conn.write("/ping", [
        `=address=${target}`,
        "=count=4",
      ]) as Record<string, string>[];

      if (results.length === 0) {
        output = `PING ${target}: No se recibió respuesta del router.`;
      } else {
        const lines: string[] = [
          `PING ${target} desde el router MikroTik (${process.env.MIKROTIK_HOST}):`,
          "",
        ];

        for (const row of results) {
          if (row.host) {
            const seq = row.seq || "?";
            const time = row.time || "timeout";
            const ttl = row.ttl || "?";
            const size = row.size || "?";
            lines.push(
              `  ${size} bytes de ${row.host}: seq=${seq} ttl=${ttl} tiempo=${time}`
            );
          }
        }

        // Summary from last row
        const last = results[results.length - 1];
        if (last) {
          const sent = last["sent"] || "4";
          const received = last["received"] || "0";
          const loss = last["packet-loss"] || "?";
          const avgRtt = last["avg-rtt"] || "?";
          const minRtt = last["min-rtt"] || "?";
          const maxRtt = last["max-rtt"] || "?";
          lines.push("");
          lines.push(`--- ${target} estadísticas de ping ---`);
          lines.push(
            `${sent} paquetes transmitidos, ${received} recibidos, ${loss}% pérdida`
          );
          lines.push(`rtt min/avg/max = ${minRtt}/${avgRtt}/${maxRtt} ms`);
        }

        output = lines.join("\n");
      }
    } else if (action === "traceroute") {
      // RouterOS /tool/traceroute
      const results = await conn.write("/tool/traceroute", [
        `=address=${target}`,
        "=count=1",
        "=timeout=3s",
      ]) as Record<string, string>[];

      const lines: string[] = [
        `TRACEROUTE a ${target} desde el router MikroTik (${process.env.MIKROTIK_HOST}):`,
        "",
      ];

      for (const hop of results) {
        const hopNum = hop[".order"] || hop["hop"] || "?";
        const address = hop.address || "*";
        const loss = hop.loss || "0";
        const lastTime = hop.last || "?";
        const avg = hop.avg || "?";
        const best = hop.best || "?";
        const worst = hop.worst || "?";
        const status = hop.status || "";

        lines.push(
          `  ${String(hopNum).padStart(2, " ")}  ${address.padEnd(16, " ")}  ${lastTime}ms  avg=${avg}ms  best=${best}ms  worst=${worst}ms  loss=${loss}%${status ? `  (${status})` : ""}`
        );
      }

      output = lines.join("\n");
    } else {
      await conn.close();
      return NextResponse.json(
        { error: "Acción no soportada. Usa 'ping' o 'traceroute'." },
        { status: 400 }
      );
    }

    await conn.close();
    return NextResponse.json({ success: true, output });
  } catch (error) {
    console.error("Error ejecutando diagnóstico en el router:", error);
    const err = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        success: false,
        error: "Fallo al ejecutar el diagnóstico en el router MikroTik",
        details: err,
      },
      { status: 500 }
    );
  }
}
