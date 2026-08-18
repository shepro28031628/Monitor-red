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

## 🚀 Guía Rápida de Instalación y Replicación

Sigue estos pasos para replicar e iniciar el proyecto en cualquier otro equipo o entorno local:

### 1. Requerimientos e Instalación de Dependencias

Este proyecto utiliza **Node.js (v18+)** y **npm**. Toda la lista de dependencias y módulos requeridos ("requirements") se encuentra definida en el archivo [`package.json`](./package.json).

```bash
# Clonar el repositorio
git clone https://github.com/TU-USUARIO/Monitor-red.git
cd Monitor-red

# Instalar todas las dependencias necesarias
npm install
```

---

### 2. Configurar las Variables de Entorno

Copia la plantilla de variables de entorno segura y renómbrala a `.env`:

```bash
cp .env.example .env
```
Abre el archivo `.env` recién creado en tu editor de código y ajusta los parámetros de conexión:
- `DATABASE_URL`: Cadena de conexión a PostgreSQL (Ej: `postgresql://usuario:password@localhost:5432/monitor_red?schema=public`).
- Credenciales del Router MikroTik y configuración SMTP.

---

### 3. Replicar la Base de Datos PostgreSQL

Tienes **dos opciones** según lo que necesites al llevar el proyecto a otro equipo:

#### 🔹 Opción A: Base de datos limpia con usuario inicial (Recomendado para nuevas instalaciones)
Construye las tablas en PostgreSQL según el esquema de Prisma y genera el usuario `admin` por defecto:

```bash
npm run db:setup
```
*(O equivalente manual: `npx prisma db push && npx prisma db seed`)*

#### 🔹 Opción B: Migrar base de datos existente con TODOS sus registros (Backup & Restore SQL)
Si deseas transferir toda la información almacenada (historial de métricas, inventario, logs, etc.) desde tu equipo actual hacia el nuevo equipo:

1. **En el equipo de origen (exportar):**
   ```bash
   npm run db:export
   ```
   *Esto creará un archivo `backup.sql` en la raíz del proyecto.*

2. **Copiar `backup.sql` al nuevo equipo** (vía USB, red o Git/Drive).

3. **En el equipo de destino (importar):**
   ```bash
   npm run db:import
   ```
   *Esto cargará todo el esquema y los datos del dump en la base de datos PostgreSQL del nuevo equipo.*

---

### 🛠️ Comandos Útiles de Base de Datos

| Comando | Descripción |
| :--- | :--- |
| `npm run db:setup` | Crea las tablas en PostgreSQL y ejecuta el seed inicial |
| `npm run db:push` | Sincroniza la estructura del modelo Prisma en PostgreSQL |
| `npm run db:seed` | Registra los datos semilla iniciales (crea el usuario admin) |
| `npm run db:studio` | Abre una interfaz web gráfica (Prisma Studio) para explorar la BD |
| `npm run db:export` | Exporta un respaldo completo de la BD a `backup.sql` (`pg_dump`) |
| `npm run db:import` | Importa el archivo `backup.sql` en la BD (`psql`) |

---

### 4. Ejecutar la Aplicación

El siguiente comando levantará simultáneamente el panel web (Next.js en puerto 3000) y el recolector de telemetría (Worker):

```bash
npm run dev
```

El Dashboard estará disponible en [**http://localhost:3000**](http://localhost:3000).

> **Nota:** Para que las alertas por correo y las actualizaciones en tiempo real funcionen al máximo de su capacidad en producción, se recomienda contar con una instancia local de **Redis**.

---

<div align="center">
  <sub>Desarrollado con ❤️ para infraestructuras de alto rendimiento.</sub>
</div>
