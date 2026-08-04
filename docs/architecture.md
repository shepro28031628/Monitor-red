# Arquitectura del Sistema

El proyecto **REN MikroTik Monitor** sigue una arquitectura distribuida que separa claramente la presentación, la base de datos y la recolección de métricas.

## Diagrama de Componentes (UML)

A continuación se muestra el diagrama de arquitectura general del sistema:

```mermaid
graph TD
    %% Entidades Externas
    Admin((Administrador))
    Router[Router MikroTik]
    Jira[Jira Assets API]
    Mail[Servidor SMTP]

    %% Componentes Core
    subgraph Servidor de Aplicaciones
        UI[Frontend Next.js React]
        Backend[Backend API Next.js]
        Worker[Worker de Telemetría Node.js]
    end

    %% Capa de Datos
    subgraph Capa de Persistencia
        DB[(PostgreSQL)]
        Redis[(Redis Caché / PubSub)]
    end

    %% Relaciones
    Admin <-->|HTTP / SSE| UI
    UI <-->|Peticiones Internas| Backend
    Backend <-->|Consultas Prisma| DB
    Backend <-->|Suscripción SSE| Redis
    
    Worker <-->|RouterOS API Puerto 8728| Router
    Worker -->|Escritura / Caché viva| Redis
    Worker -->|Persistencia Histórica| DB
    Worker -->|Envío de Alertas| Mail
    Worker <-->|Sincronización de Dueños| Jira
    
    classDef primary fill:#316192,stroke:#fff,stroke-width:2px,color:#fff;
    classDef secondary fill:#3982CE,stroke:#fff,stroke-width:2px,color:#fff;
    classDef external fill:#4a5568,stroke:#fff,stroke-width:2px,color:#fff;
    class DB,Redis,Router,Jira,Mail external;
    class UI,Backend primary;
    class Worker secondary;
```

## Secuencia de Telemetría (UML)

Este diagrama muestra cómo interactúa el Worker para recolectar datos y mostrarlos en tiempo real en la pantalla del administrador:

```mermaid
sequenceDiagram
    participant Worker as Telemetry Worker
    participant Router as MikroTik
    participant DB as PostgreSQL
    participant Redis as Redis Pub/Sub
    participant Web as Next.js Dashboard

    loop Cada 2 segundos
        Worker->>Router: Petición de Recursos (CPU, Memoria, Interfaces)
        Router-->>Worker: Respuesta de Recursos
        
        Worker->>Redis: Almacenar telemetría viva (TTL 15s)
        
        alt Si es un Cliente Conectado
            Redis-->>Web: Emisión por Server-Sent Events (SSE)
        end
    end
    
    loop Cada 10 minutos (o Evento Crítico)
        Worker->>DB: INSERT RouterStat (Histórico)
    end
```

## Decisiones Técnicas

- **Separación de Responsabilidades**: El recolector de datos (worker) corre de forma asíncrona mediante `concurrently` o en un contenedor separado. Esto asegura que si la API del router se retrasa, no afecta el rendimiento del entorno web de Next.js.
- **Server-Sent Events (SSE)**: En vez de hacer polling constante desde el navegador a la base de datos (lo que sobrecargaría PostgreSQL), Next.js consume los datos en caché desde Redis y los transmite vía SSE a la UI.
