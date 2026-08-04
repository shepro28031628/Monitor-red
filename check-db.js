const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    },
  },
});

async function check() {
  const devices = await prisma.deviceInventory.findMany({
    where: { owner: { not: null } }
  });
  console.log("Dispositivos con owner asignado:", devices.length);
  if (devices.length > 0) {
    console.log("Ejemplo:", devices[0]);
  }
  
  const allDevices = await prisma.deviceInventory.findMany({ take: 5 });
  console.log("Primeros 5 dispositivos en general:");
  console.log(allDevices.map(d => ({ hostname: d.hostname, mac: d.macAddress })));

  await prisma.$disconnect();
}
check();
