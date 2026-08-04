# Casos de Uso del Sistema

La siguiente documentación describe las acciones e interacciones permitidas para el perfil de Administrador dentro del ecosistema de monitorización.

## Diagrama de Casos de Uso (UML adaptado)

*Nota: Dado que Mermaid no soporta diagramas de casos de uso de forma nativa en GitHub, este diagrama se modela utilizando un Flowchart direccional.*

```mermaid
flowchart LR
    %% Actores
    Admin([Administrador])
    Router[[RouterOS]]
    SMTP[[Mail Server]]

    %% Casos de Uso
    UC1(Iniciar Sesión)
    UC2(Visualizar Dashboard)
    UC3(Consultar Inventario Jira)
    UC4(Revisar Auditoría VPN/DHCP)
    UC5(Gestionar Reglas de Alertas)
    UC6(Recibir Notificaciones)

    %% Relaciones
    Admin --> UC1
    Admin --> UC2
    Admin --> UC3
    Admin --> UC4
    Admin --> UC5
    Admin -.-> UC6
    
    UC2 -.->|include| UC1
    UC4 -.->|extend| UC3
    
    Router -->|Provee métricas| UC2
    Router -->|Provee logs| UC4
    
    SMTP -->|Envía Alertas| UC6
```

## Detalles de los Casos de Uso Principales

1. **Visualizar Dashboard**: El administrador puede observar en gráficas de react-chartjs la evolución de la memoria, CPU y red (RX/TX).
2. **Consultar Inventario**: Ver qué empleados (nombres sincronizados desde Jira) están consumiendo ancho de banda.
3. **Revisar Auditoría**: Ver históricos de conexión (cuánto tiempo estuvo activa una VPN y cuántos megabytes descargó).
