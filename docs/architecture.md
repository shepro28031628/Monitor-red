# Arquitectura del Proyecto

## Tecnologías Principales
- **Framework Web**: Next.js (App Router)
- **Lenguaje**: TypeScript
- **Base de Datos**: PostgreSQL
- **ORM**: Prisma
- **Colas y Tareas en Segundo Plano**: BullMQ con Redis (ioredis)
- **Estilos**: Tailwind CSS
- **Gráficos**: Chart.js / react-chartjs-2
- **Integración con MikroTik**: node-routeros

## Componentes del Sistema
1. **Frontend (Next.js)**: Paneles de control interactivos que muestran métricas de red, uso de VPN y conexiones activas.
2. **Backend API**: Endpoints en `/api` para obtener los datos desde la base de datos PostgreSQL.
3. **Workers (Background)**:
   - Procesos en segundo plano (ej. `worker/telemetry.ts`) que ejecutan tareas programadas o asíncronas utilizando BullMQ y Redis.
   - Estos workers se comunican con el router MikroTik (usando `node-routeros`) para extraer telemetría (CPU, RAM, uso de WAN, perfiles VPN, etc.) y guardarla en la base de datos.

## Autenticación
- El sistema cuenta con autenticación basada en `next-auth` (NextAuth v5 beta), con manejo de sesiones personalizadas y contraseñas cifradas con `bcryptjs`.
