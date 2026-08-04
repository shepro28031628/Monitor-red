import { Pool } from "pg";
import * as dotenv from "dotenv";
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT "createdAt", "pingAvgMs", "pingLossPercent" FROM "RouterStat" ORDER BY "createdAt" DESC LIMIT 5`
    );
    console.log("Recent RouterStats:");
    result.rows.forEach(r => {
      console.log(`- ${r.createdAt} | Ping: ${r.pingAvgMs}ms | Loss: ${r.pingLossPercent}%`);
    });
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
