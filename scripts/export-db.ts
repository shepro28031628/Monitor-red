import { execSync } from "child_process";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config();

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.error("❌ Error: DATABASE_URL no está definida en el archivo .env");
  process.exit(1);
}

try {
  const parsedUrl = new URL(dbUrl.replace(/^postgresql:\/\//, "http://"));
  const user = parsedUrl.username;
  const password = parsedUrl.password;
  const host = parsedUrl.hostname || "localhost";
  const port = parsedUrl.port || "5432";
  const dbName = parsedUrl.pathname.replace(/^\//, "").split("?")[0];

  const outputFile = path.join(process.cwd(), "backup.sql");
  console.log(`📦 Respaldando base de datos '${dbName}' a '${outputFile}'...`);

  const envVars = { ...process.env, PGPASSWORD: password };
  const command = `pg_dump -h ${host} -p ${port} -U ${user} -d ${dbName} -F p -f "${outputFile}"`;

  execSync(command, { env: envVars, stdio: "inherit" });
  console.log("✅ Respaldo completado exitosamente en backup.sql");
} catch (error: any) {
  console.error("❌ Error al exportar la base de datos:", error.message || error);
  console.log("\n💡 Asegúrate de tener pg_dump instalado en tu sistema y accesible en la variable PATH.");
  console.log("Alternativamente, puedes usar herramientas gráficas como DBeaver o pgAdmin para exportar.");
}
