import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function run() {
  // Verify REN-LT-099
  const dev099 = await prisma.deviceInventory.findMany({
    where: { hostname: { contains: '099' } },
    select: { hostname: true, owner: true }
  });
  console.log("REN-LT-099 inventory:", dev099);

  const sess099 = await prisma.connectionSession.findMany({
    where: { username: { contains: '099' } },
    select: { id: true, username: true, owner: true },
    take: 5
  });
  console.log("REN-LT-099 sessions:", sess099);

  // Stats
  const sessWithOwner = await prisma.connectionSession.count({ where: { owner: { not: null } } });
  const totalSess = await prisma.connectionSession.count();
  console.log(`\nSessions with owners: ${sessWithOwner}/${totalSess}`);

  // Sample sessions still without owner
  const noOwner = await prisma.connectionSession.findMany({
    where: { owner: null },
    select: { username: true, type: true },
    take: 15
  });
  console.log("\nSample sessions still without owner:");
  noOwner.forEach(s => console.log(`  ${s.type}: ${s.username}`));

  await prisma.$disconnect();
  await pool.end();
}
run();
