# Guía de Configuración y Despliegue

## Prerrequisitos
- Node.js (v20 o superior recomendado)
- PostgreSQL
- Redis (para BullMQ y colas de procesos)
- Router MikroTik accesible para `node-routeros`

## Configuración del Entorno
1. Copiar el archivo `.env.example` a `.env` si existe (o usar las variables actuales de `.env`).
2. Configurar la cadena de conexión de la base de datos (`DATABASE_URL`).
3. Configurar la URL de conexión a Redis (`REDIS_URL`).
4. Configurar las credenciales de acceso al Router MikroTik.

## Comandos Disponibles

- `npm run dev`: Inicia el entorno de desarrollo concurrente, incluyendo la aplicación Next.js en el puerto 3000 y los workers (`worker/telemetry.ts`).
- `npm run build`: Construye la aplicación Next.js para producción.
- `npm run start`: Inicia la aplicación Next.js en entorno de producción.
- `npm run worker`: Inicia el worker de telemetría por separado (útil para despliegues desacoplados).
- `npm run lint`: Ejecuta el linter ESLint.

## Base de datos (Prisma)
- Generar el cliente: `npx prisma generate`
- Empujar los esquemas a la BD (desarrollo): `npx prisma db push`
- Poblar datos (Seed): `npx prisma db seed` (Ejecuta `prisma/seed.ts` vía `tsx`)
