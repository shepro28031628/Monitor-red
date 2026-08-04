/**
 * Prisma Database Seed Script
 *
 * Creates the initial admin user if no users exist.
 * Run with: npx prisma db seed
 */

import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const userCount = await prisma.user.count();

  if (userCount === 0) {
    const hashedPassword = await bcrypt.hash("admin123", 10);
    await prisma.user.create({
      data: {
        username: "admin",
        name: "Administrador",
        password: hashedPassword,
        role: "ADMIN",
      },
    });
    console.log("✅ Usuario admin creado: admin / admin123");
  } else {
    console.log(`ℹ️  La base de datos ya tiene ${userCount} usuario(s), omitiendo seed.`);
  }
}

main()
  .catch((e) => {
    console.error("❌ Seed falló:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
