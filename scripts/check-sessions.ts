import { Pool } from "pg";
import * as dotenv from "dotenv";
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT "username", "location", "rxBytes", "txBytes" FROM "ConnectionSession" WHERE "type" = 'VPN' ORDER BY "startedAt" DESC LIMIT 10`
    );
    console.log("Recent VPN sessions:");
    result.rows.forEach(r => {
      console.log(`- ${r.username} | Loc: ${r.location} | Rx: ${r.rxBytes} | Tx: ${r.txBytes}`);
    });
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
