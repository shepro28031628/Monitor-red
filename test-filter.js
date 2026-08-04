const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const allDevices = await prisma.deviceInventory.findMany({
    where: { hostname: { not: null } },
    select: { id: true, hostname: true }
  });

  const testLabel = "REN-LT-087";
  const normalizedLabel = testLabel.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  
  const matchingDevices = allDevices.filter(d => {
    const hostNorm = d.hostname.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    return normalizedLabel.includes(hostNorm) || hostNorm.includes(normalizedLabel);
  });

  console.log("Matching devices for", testLabel, ":", matchingDevices);
  await prisma.$disconnect();
}

run();
