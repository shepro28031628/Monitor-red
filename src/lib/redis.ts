import Redis from "ioredis";

// Configuración de Redis.
// Se usa la URL de la variable de entorno REDIS_URL o un fallback a localhost.
const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

// Se mantiene una única instancia global en desarrollo para evitar problemas con Next.js HMR.
declare global {
  var redisClient: Redis | undefined;
}

export const redis = global.redisClient || new Redis(redisUrl, {
  retryStrategy(times: number) {
    // Limit retries to prevent infinite reconnect spam in logs
    if (times > 10) return null;
    return Math.min(times * 500, 5000);
  },
  enableReadyCheck: false,
});

// Suppress unhandled error events to prevent worker crash when Redis is down
redis.on("error", (err) => {
  // Only log the first error, not every retry
  if (!global._redisErrorLogged) {
    console.warn("[Redis] Conexión no disponible:", err.message);
    global._redisErrorLogged = true;
  }
});

redis.on("connect", () => {
  global._redisErrorLogged = false;
  console.log("[Redis] ✅ Conectado.");
});

declare global {
  var _redisErrorLogged: boolean | undefined;
}

if (process.env.NODE_ENV !== "production") {
  global.redisClient = redis;
}
