import "dotenv/config";
import { RouterOSAPI } from "node-routeros";

async function main() {
  const api = new RouterOSAPI({
    host: process.env.MIKROTIK_HOST!,
    user: process.env.MIKROTIK_USER!,
    password: process.env.MIKROTIK_PASSWORD!,
    port: Number(process.env.MIKROTIK_PORT) || 8728,
  });

  try {
    await api.connect();
    console.log("Connected");
    const actives = await api.write("/ppp/active/print");
    console.log("Actives:", JSON.stringify(actives, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    api.close();
  }
}

main();
