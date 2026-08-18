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

### 1. Requerimientos del Sistema e Instalación de Dependencias

Antes de iniciar, asegúrate de contar con los siguientes prerrequisitos instalados en el sistema:

- 🟢 **Node.js (v18+)** y **npm**
- 🐘 **PostgreSQL (v14+)** con las herramientas cliente (`pg_dump` y `psql`) incluidas en la variable de entorno `PATH` del sistema.
- 🔴 **Redis** *(Recomendado para la gestión de colas BullMQ y telemetría en tiempo real)*.

Toda la lista de dependencias de la aplicación se encuentra definida en el archivo [`package.json`](./package.json).

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

### 3. Replicar la Base de Datos PostgreSQL en Otro Equipo

Para desplegar y replicar la base de datos en un nuevo equipo, tienes dos alternativas automáticas:

#### 🔹 Opción A: Migración Completa y Réplica con Datos (Recomendado)
Para transferir la base de datos exacta con todo su historial (métricas, dispositivos, usuarios y configuración):

1. **En el equipo de origen (exportar datos):**
   ```bash
   npm run db:export
   ```
   *Esto generará automáticamente el archivo de respaldo `backup.sql` en la raíz del proyecto.*

2. **Copiar `backup.sql` al nuevo equipo** (vía USB, carpeta compartida, red o Git).

3. **En el equipo de destino (importación automática):**
   Asegúrate de configurar la variable `DATABASE_URL` en tu `.env` del nuevo equipo y ejecuta:
   ```bash
   npm run db:import
   ```
   *El script creará automáticamente la base de datos si aún no existe en el servidor PostgreSQL de destino y restaurará todo el esquema y los datos sin intervención manual.*

#### 🔹 Opción B: Nueva Instalación Limpia
Si prefieres iniciar desde cero creando la estructura y el usuario administrador por defecto (`admin`):

```bash
npm run db:setup
```
*(Crea las tablas mediante Prisma y ejecuta el seed inicial).*

---

### 🛠️ Comandos Útiles de Base de Datos y Aplicación

| Comando | Descripción |
| :--- | :--- |
| `npm run dev` | Inicia el servidor de desarrollo (Next.js) y el recolector de telemetría (Worker) simultáneamente |
| `npm run build` | Compila la aplicación Next.js para producción |
| `npm run worker` | Ejecuta de manera independiente únicamente el worker de telemetría |
| `npm run db:export` | Exporta un respaldo completo de la BD a `backup.sql` |
| `npm run db:import` | Crea la BD destino (si no existe) e importa automáticamente `backup.sql` |
| `npm run db:setup` | Crea la estructura de tablas en PostgreSQL y ejecuta el seed inicial |
| `npm run db:push` | Sincroniza la estructura del esquema Prisma en PostgreSQL |
| `npm run db:seed` | Registra los datos iniciales por defecto (crea el usuario admin) |
| `npm run db:studio` | Abre una interfaz web gráfica (Prisma Studio) para explorar la BD |

---

### 🔧 Solución de Problemas Frecuentes (Troubleshooting)

#### ❌ Error: `pg_dump` o `psql` no se reconoce como un comando interno o externo
**Causa:** Las herramientas CLI de PostgreSQL no están agregadas a las variables de entorno del sistema (`PATH`).
**Solución (Windows):**
1. Agrega la ruta de instalación de PostgreSQL a la variable `PATH` de tu sistema (Ej: `C:\Program Files\PostgreSQL\16\bin`).
2. Reinicia la terminal o editor de código (VS Code) para aplicar los cambios.

#### ❌ Error al conectar con PostgreSQL (`DATABASE_URL`)
**Solución:** Verifica que el servicio de PostgreSQL esté en ejecución (`services.msc` en Windows o `sudo systemctl status postgresql` en Linux) y que el usuario y la contraseña definidos en `.env` tengan permisos suficientes.

---

### 4. Ejecutar la Aplicación

El siguiente comando levantará simultáneamente el panel web (Next.js en puerto 3000) y el recolector de telemetría (Worker):

```bash
npm run dev
```

El Dashboard estará disponible en [**http://localhost:3000**](http://localhost:3000).

---

<div align="center">
  <sub>Desarrollado con ❤️ para infraestructuras de alto rendimiento.</sub>
</div>
