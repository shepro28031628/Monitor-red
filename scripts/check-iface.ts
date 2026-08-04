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
    const interfaces = await api.write("/interface/print", ["?type=ovpn-in"]); // or l2tp-in, pptp-in
    console.log("Interfaces OVPN:", JSON.stringify(interfaces, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    api.close();
  }
}

main();
