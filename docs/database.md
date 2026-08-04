# Estructura de la Base de Datos

El sistema utiliza **PostgreSQL** administrado mediante **Prisma ORM**. La base de datos está diseñada para soportar consultas analíticas sobre históricos de métricas y gestión de inventario de dispositivos.

## Diagrama de Entidad Relación (UML ERD)

```mermaid
erDiagram
    User ||--o{ Session : "has many"
    
    User {
        Int id PK
        String username "UNIQUE"
        String password
        String name
        String role
        DateTime createdAt
    }
    
    Session {
        String id PK
        Int userId FK
        String token "UNIQUE"
        DateTime expiresAt
        DateTime createdAt
    }
    
    RouterStat {
        Int id PK
        DateTime createdAt
        Int cpuLoad
        BigInt freeMemory
        BigInt totalMemory
        Int temperature
        String wan1Status
        String wan2Status
        Int activeConnections
        Int vpnCount
    }
    
    DeviceInventory {
        Int id PK
        String macAddress "UNIQUE"
        String ipAddress
        String hostname
        String vendor
        String owner
        Boolean isOnline
        DateTime lastSeen
    }
    
    ConnectionSession {
        Int id PK
        String username
        String macAddress
        String type "VPN or DHCP"
        String owner
        DateTime startedAt
        DateTime endedAt
        BigInt rxBytes
        BigInt txBytes
    }
    
    SystemAlert {
        Int id PK
        String alertType
        String severity
        String message
        DateTime createdAt
        DateTime resolvedAt
    }
```

## Descripción de Modelos Core

*   **User & Session**: Manejo del panel de acceso (NextAuth). Contiene roles y los tokens de sesión.
*   **RouterStat**: El historial de telemetría del router. Se crea una nueva fila cada 10 minutos (por defecto) o inmediatamente si ocurre un evento crítico (CPU > 85%, ping muy alto).
*   **DeviceInventory**: Registra cada dispositivo único (por Dirección MAC) visto en la red.
*   **ConnectionSession**: Audita los tiempos de sesión exacta de un usuario. Por ejemplo, al conectarse a la VPN se abre un registro; cuando el worker detecta que la sesión terminó, marca el `endedAt` y calcula los bytes traficados totales.
