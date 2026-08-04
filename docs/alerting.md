# Motor de Alertas (Alert Engine)

El Worker no solo guarda históricos, sino que monitorea condiciones y evalúa de manera constante si el estado del enrutador es anómalo para emitir notificaciones proactivas.

## Diagrama de Actividades (UML)

Este diagrama representa el árbol de decisiones que toma el motor de alertas (Alert Engine) en cada ciclo del Worker.

```mermaid
stateDiagram-v2
    [*] --> CicloDeWorker
    CicloDeWorker --> ExtraerMetricas : Ping, CPU, RAM, WAN
    
    ExtraerMetricas --> EvaluarReglas
    
    state EvaluarReglas {
        direction TB
        
        state if_ping <<choice>>
        state if_cpu <<choice>>
        
        [*] --> if_ping
        if_ping --> RouterCaido : Falla ping > 3 veces
        if_ping --> if_cpu : Ping Normal
        
        if_cpu --> CargaCritica : CPU > 85%
        if_cpu --> Normal : CPU < 85%
    }
    
    RouterCaido --> GenerarIncidente
    CargaCritica --> GenerarIncidente
    Normal --> [*]
    
    GenerarIncidente --> ColaRedis : Añadir Job a BullMQ
    ColaRedis --> EnviarSMTP : Worker procesa cola
    EnviarSMTP --> [*] : Correo Enviado al Admin
```

## Cola de Correos (BullMQ)

El paso de `GenerarIncidente` a `ColaRedis` es crucial. Si el servidor SMTP (ej. Gmail) demora en responder o deniega temporalmente el inicio de sesión, la cola en **Redis** (gestionada por BullMQ) asegura que la alerta no se pierda en la memoria volatil. El sistema reintentará su envío de forma automática con retroceso exponencial (Exponential Backoff).
