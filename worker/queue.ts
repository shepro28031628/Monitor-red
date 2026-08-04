import { Queue, Worker, Job } from "bullmq";
import Redis from "ioredis";
import { sendAlertEmail } from "../src/lib/mailer";

// BullMQ Workers use blocking Redis commands (BRPOPLPUSH) that require
// maxRetriesPerRequest to be null. We create a dedicated ioredis instance
// instead of reusing the shared one from src/lib/redis.ts.
const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

let emailQueue: Queue | null = null;
let emailWorker: Worker | null = null;
let queueReady = false;

try {
  const bullRedis = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy(times: number) {
      // Give up after 3 retries — Redis is optional for this app
      if (times > 3) return null;
      return Math.min(times * 500, 3000);
    },
  });

  // Suppress unhandled error events (ioredis will retry internally)
  bullRedis.on("error", (err) => {
    if (!queueReady) {
      console.warn("[Queue] Redis no disponible — la cola de emails está deshabilitada.", err.message);
      queueReady = false; // mark as not ready
    }
  });

  bullRedis.on("connect", () => {
    queueReady = true;
    console.log("[Queue] ✅ Conectado a Redis — cola de emails activa.");
  });

  emailQueue = new Queue("emailQueue", { connection: bullRedis as any });
  emailQueue.on("error", (err) => {
    // Suppress internal queue errors
  });

  // Clone connection for the worker (BullMQ requires separate connections for Queue and Worker)
  const workerRedis = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy(times: number) {
      if (times > 3) return null;
      return Math.min(times * 500, 3000);
    },
  });
  workerRedis.on("error", () => { /* suppress */ });

  emailWorker = new Worker("emailQueue", async (job: Job) => {
    const { payload } = job.data;
    console.log(`[Queue] Procesando envío de email para: ${payload.alertType}`);
    await sendAlertEmail(payload);
  }, { connection: workerRedis as any });

  emailWorker.on("completed", (job) => {
    console.log(`[Queue] Email enviado correctamente (Job ${job.id})`);
  });

  emailWorker.on("failed", (job, err) => {
    console.error(`[Queue] Error enviando email (Job ${job?.id}):`, err);
  });

  emailWorker.on("error", (err) => {
    // Suppress internal worker errors
  });
} catch (err) {
  console.warn("[Queue] No se pudo inicializar BullMQ:", err instanceof Error ? err.message : err);
}

// If BullMQ fails or Redis is unavailable, provide a fallback mock queue
// so the application can still send emails directly without needing Redis.
if (!emailQueue) {
  console.log("[Queue] Usando fallback sin Redis — los correos se enviarán directamente en segundo plano.");
  emailQueue = {
    add: async (name: string, data: any) => {
      // Fire and forget send
      setImmediate(() => {
        console.log(`[Queue Fallback] Procesando envío de email para: ${data.payload?.alertType}`);
        sendAlertEmail(data.payload).then(() => {
          console.log(`[Queue Fallback] Email enviado correctamente`);
        }).catch(err => {
          console.error(`[Queue Fallback] Error enviando email:`, err);
        });
      });
    }
  } as any;
}

export { emailQueue };
