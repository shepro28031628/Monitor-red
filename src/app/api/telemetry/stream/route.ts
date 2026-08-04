import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import * as fs from "fs";
import * as path from "path";

export const dynamic = 'force-dynamic';

/** Returns true only if the ioredis client is in a usable ready state */
function isRedisReady(): boolean {
  return redis.status === "ready";
}

export async function GET(request: Request) {
  console.log(`[SSE] New connection. Redis status: ${redis.status}`);
  const encoder = new TextEncoder();
  let closed = false;
  let intervalId: ReturnType<typeof setInterval> | null = null;

  const cleanup = () => {
    if (closed) return;
    closed = true;
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };

  const stream = new ReadableStream({
    async start(controller) {
      const sendUpdate = async () => {
        // Bail out if connection is gone
        if (closed || request.signal.aborted) {
          cleanup();
          return;
        }

        try {
          let payload: string | null = null;

          // ── Path 1: Redis is ready — prefer live worker data ──────
          if (isRedisReady()) {
            const raw = await redis.get("live_telemetry");
            if (closed) return;

            if (raw) {
              const parsed = JSON.parse(raw);
              const enriched = { ...parsed, _workerLastWrite: new Date().toISOString() };
              payload = JSON.stringify(enriched);
            }
          }

          // ── Path 2: Redis miss OR Redis down — fall back to local JSON ────
          if (!payload) {
            try {
              const filePath = path.join(process.cwd(), ".live_telemetry.json");
              if (fs.existsSync(filePath)) {
                const raw = fs.readFileSync(filePath, "utf8");
                if (raw) {
                  const parsed = JSON.parse(raw);
                  const enriched = { ...parsed, _workerLastWrite: new Date().toISOString() };
                  payload = JSON.stringify(enriched);
                }
              }
            } catch (fsErr) {
              // ignore
            }
          }

          // ── Path 3: Both Redis and JSON missed — fall back to DB ────
          if (!payload) {
            const latestStat = await prisma.routerStat.findFirst({
              orderBy: { createdAt: "desc" },
            });
            if (closed) return;

            if (latestStat) {
              payload = JSON.stringify(latestStat, (_, value) =>
                typeof value === "bigint" ? Number(value) : value
              );
            }
          }

          // ── Send whatever we have ─────────────────────────────────
          if (payload && !closed) {
            try {
              controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
            } catch {
              // enqueue() threw — the HTTP response stream is truly gone
              cleanup();
            }
          }
        } catch (error) {
          // Transient error (DB timeout, Redis hiccup, etc.)
          // Log once and let the next interval tick retry — do NOT close the stream.
          if (!closed) {
            console.error("[SSE] Error fetching telemetry (will retry):", error);
          }
        }
      };

      // Register disconnect handler BEFORE any async work so early
      // client drops are caught before redis/DB calls run.
      request.signal.addEventListener("abort", () => {
        cleanup();
        try { controller.close(); } catch { /* already closed */ }
      });

      // Send initial data immediately
      await sendUpdate();

      // Poll every 2 seconds (only if still connected after the initial send)
      if (!closed) {
        intervalId = setInterval(sendUpdate, 2000);
      }
    },

    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
    },
  });
}
