<div align="center">
  <img src="https://img.shields.io/badge/Next.js-black?style=for-the-badge&logo=next.js&logoColor=white" alt="Next.js"/>
  <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript"/>
  <img src="https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL"/>
  <img src="https://img.shields.io/badge/Prisma-3982CE?style=for-the-badge&logo=Prisma&logoColor=white" alt="Prisma"/>
  <img src="https://img.shields.io/badge/MikroTik-RouterOS-gray?style=for-the-badge" alt="MikroTik RouterOS"/>
  
  <br />
  <br />
  
  <h1>📡 REN MikroTik Monitor (Monitor-red)</h1>
  
  <p>
    <b>Plataforma integral para el monitoreo avanzado, auditoría de sesiones y telemetría en tiempo real para routers MikroTik en entornos corporativos.</b>
  </p>
</div>

<hr />

## 🌟 Características Principales

- **Telemetría en Tiempo Real**: Recolección constante de métricas críticas como carga de CPU, RAM, almacenamiento, voltajes y estado de las interfaces WAN.
- **Auditoría de Sesiones (VPN y DHCP)**: Tracking automático de quién se conecta, cuándo y cuánto tráfico consume, identificando dispositivos por dirección MAC y Hostname.
- **Sincronización con Jira Assets**: Mapeo automatizado de los dispositivos de la red con el inventario de empleados en Jira Service Management.
- **Sistema de Alertas Inteligentes (SMTP)**: Envío automático de notificaciones por correo electrónico al detectar problemas como caídas de ping, CPU sobrecargado o desconexión del router.
- **Dashboard Interactivo**: Visualización gráfica del estado de la red impulsada por Next.js, React Chart.js y colas administradas con Redis y BullMQ.
- **Autenticación Segura**: Panel de administración protegido mediante *NextAuth*.

---

## 📚 Documentación Técnica

La documentación detallada se encuentra estructurada dentro de la carpeta [`docs/`](./docs/):

- 🏗️ **[Arquitectura del Sistema](./docs/architecture.md)**: Diagramas y explicación del stack tecnológico.
- 🗄️ **[Modelo de Base de Datos](./docs/database.md)**: Estructura relacional en PostgreSQL (Métricas, Registros, Usuarios).
- ⚙️ **[Guía de Configuración y Despliegue](./docs/setup.md)**: Instrucciones detalladas de despliegue en servidores y configuración del Worker.

---

## 🚀 Guía Rápida de Instalación (Desarrollo)

Sigue estos pasos para replicar e iniciar el proyecto en tu entorno local:

### 1. Clonar e instalar dependencias

```bash
git clone https://github.com/TU-USUARIO/Monitor-red.git
cd Monitor-red
npm install
```

### 2. Configurar el Entorno

Copia la plantilla de variables de entorno segura y renómbrala a `.env`:

```bash
cp .env.example .env
```
Abre el archivo `.env` recién creado en tu editor y configura tus credenciales reales (Conexión a PostgreSQL, credenciales del Router MikroTik, y accesos SMTP).

### 3. Preparar la Base de Datos

Migra la estructura a tu motor de bases de datos PostgreSQL y crea el usuario administrador por defecto:

```bash
# Construir las tablas (Prisma Schema Push)
npx prisma db push

# Poblar la base de datos (Creará el usuario "admin")
npx prisma db seed
```

### 4. Ejecutar la Aplicación

El siguiente comando levantará simultáneamente el entorno web (Next.js) y el recolector de telemetría (Worker) usando `concurrently`:

```bash
npm run dev
```

El Dashboard estará disponible en [**http://localhost:3000**](http://localhost:3000).

> **Nota:** Para que las alertas por correo y las actualizaciones en tiempo real funcionen al máximo de su capacidad en producción, se recomienda contar con una instancia local de **Redis**.

---

<div align="center">
  <sub>Desarrollado con ❤️ para infraestructuras de alto rendimiento.</sub>
</div>
