import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function wipeDB() {
  console.log("Limpiando la base de datos...");
  try {
    await prisma.connectionSession.deleteMany({});
    console.log("- ConnectionSession eliminadas");
    await prisma.routerStat.deleteMany({});
    console.log("- RouterStat eliminados");
    await prisma.systemAlert.deleteMany({});
    console.log("- SystemAlert eliminadas");
    await prisma.deviceInventory.deleteMany({});
    console.log("- DeviceInventory eliminado");
    await prisma.speedHistory.deleteMany({});
    console.log("- SpeedHistory eliminado");
    await prisma.networkLog.deleteMany({});
    console.log("- NetworkLog eliminado");
    console.log("¡Base de datos limpiada con exito!");
  } catch (error) {
    console.error("Error limpiando la base de datos:", error);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

wipeDB();
