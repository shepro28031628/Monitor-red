import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  try {
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "ConnectionSession" ADD COLUMN IF NOT EXISTS location VARCHAR(100)'
    );
    console.log("✅ Columna 'location' verificada/agregada correctamente.");
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
