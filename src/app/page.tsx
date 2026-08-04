import { prisma } from "@/lib/prisma";
import DashboardLayout from "@/components/DashboardLayout";

export default async function Home() {
  const initialStat = await prisma.routerStat.findFirst({
    orderBy: { createdAt: 'desc' }
  });

  // Serialize BigInts safely before passing to client components
  const serializedStat = initialStat ? JSON.parse(
    JSON.stringify(initialStat, (key, value) =>
      typeof value === 'bigint' ? Number(value) : value
    )
  ) : null;

  return <DashboardLayout initialStat={serializedStat} />;
}
