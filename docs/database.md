# Base de Datos (Prisma Schema)

El proyecto utiliza Prisma como ORM sobre una base de datos PostgreSQL.

## Modelos Principales

- **User / Session**: Manejo de autenticación, usuarios del sistema y roles.
- **RouterStat**: Almacena telemetría histórica del Router MikroTik (Carga de CPU, Memoria, Temperatura, WAN Tx/Rx, Latencia/Ping, Pérdida de paquetes).
- **SystemAlert**: Historial de alertas del sistema, indicando el tipo de alerta, severidad y tiempo de resolución.
- **SpeedHistory**: Registro de tests de velocidad, con velocidades de subida, bajada, ping y proveedor ISP.
- **DeviceInventory**: Inventario de dispositivos en la red, con dirección MAC, IP, hostname y visibilidad en línea.
- **NetworkLog**: Logs del sistema y de eventos de red.
- **ConnectionSession**: Sesiones de conexión específicas (ej. VPN o DHCP), registrando quién se conectó, inicio/fin, y tráfico de red (bytes transferidos).
