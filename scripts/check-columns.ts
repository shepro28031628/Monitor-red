import { Pool } from "pg";
import * as dotenv from "dotenv";
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'ConnectionSession' ORDER BY ordinal_position`
    );
    console.log("Columns in ConnectionSession:");
    result.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type}`));
  } finally {
    client.release();
    await pool.end();
  }
}

main();
