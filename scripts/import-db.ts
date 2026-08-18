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

const inputFile = process.argv[2] 
  ? path.resolve(process.argv[2]) 
  : path.join(process.cwd(), "backup.sql");

if (!fs.existsSync(inputFile)) {
  console.error(`❌ Error: El archivo de respaldo '${inputFile}' no existe.`);
  process.exit(1);
}

try {
  const parsedUrl = new URL(dbUrl.replace(/^postgresql:\/\//, "http://"));
  const user = parsedUrl.username;
  const password = parsedUrl.password;
  const host = parsedUrl.hostname || "localhost";
  const port = parsedUrl.port || "5432";
  const dbName = parsedUrl.pathname.replace(/^\//, "").split("?")[0];

  console.log(`📥 Preparando restauración de base de datos '${dbName}' desde '${inputFile}'...`);

  const envVars = { ...process.env, PGPASSWORD: password };

  // Crear la base de datos si no existe en el servidor destino
  try {
    const createDbCmd = `psql -h ${host} -p ${port} -U ${user} -d postgres -c "CREATE DATABASE \\"${dbName}\\";"`;
    execSync(createDbCmd, { env: envVars, stdio: "ignore" });
    console.log(`⚙️ Base de datos '${dbName}' creada automáticamente.`);
  } catch (_e) {
    // Si la BD ya existe o ya fue creada, ignoramos la excepción y procedemos
  }

  const command = `psql -h ${host} -p ${port} -U ${user} -d ${dbName} -f "${inputFile}"`;

  execSync(command, { env: envVars, stdio: "inherit" });
  console.log("✅ Restauración y réplica completada exitosamente.");
} catch (error: any) {
  console.error("❌ Error al importar la base de datos:", error.message || error);
  console.log("\n💡 Asegúrate de tener psql instalado en tu sistema y accesible en la variable PATH.");
  console.log("Alternativamente, puedes usar herramientas gráficas como DBeaver o pgAdmin para importar.");
}
