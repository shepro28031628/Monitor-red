# Monitor MikroTik

Una aplicación web desarrollada con Next.js y TypeScript diseñada para la monitorización avanzada, gestión de estadísticas y control de un Router MikroTik. El proyecto incluye un panel de control interactivo, un backend robusto basado en PostgreSQL con Prisma, y tareas en segundo plano gestionadas con BullMQ y Redis para recolectar métricas del router (CPU, memoria, tráfico de WAN, VPNs, etc.).

## 📚 Documentación

Toda la documentación técnica y de configuración se encuentra en la carpeta [`docs/`](./docs/):

- 🏗️ **[Arquitectura](./docs/architecture.md)**: Detalles sobre el stack tecnológico (Next.js, Prisma, BullMQ, Tailwind CSS) y los componentes principales del sistema.
- 🗄️ **[Base de Datos](./docs/database.md)**: Información sobre el esquema de la base de datos (PostgreSQL), incluyendo métricas, registros y sesiones.
- ⚙️ **[Guía de Configuración](./docs/setup.md)**: Instrucciones paso a paso para la instalación, configuración de variables de entorno, y comandos para correr el proyecto de forma local.

## 🚀 Inicio Rápido

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar base de datos (asegúrate de tener PostgreSQL y tus variables .env)
npx prisma generate
npx prisma db push

# 3. Iniciar el servidor de desarrollo y los workers
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador para ver la aplicación.
