# Casos de Uso del Sistema

La siguiente documentación describe las acciones e interacciones permitidas para el perfil de Administrador dentro del ecosistema de monitorización.

## Diagrama de Casos de Uso (UML)

```mermaid
usecaseDiagram
    actor Administrador as Admin
    
    package "REN MikroTik Monitor" {
        usecase "Iniciar Sesión" as UC1
        usecase "Visualizar Dashboard (Tiempo Real)" as UC2
        usecase "Consultar Inventario (Jira)" as UC3
        usecase "Revisar Auditoría (VPN/DHCP)" as UC4
        usecase "Gestionar Reglas de Alertas" as UC5
        usecase "Recibir Alertas SMTP" as UC6
    }
    
    package "Sistemas Externos" {
        actor "RouterOS" as Router
        actor "Mail Server" as SMTP
    }
    
    Admin --> UC1
    Admin --> UC2
    Admin --> UC3
    Admin --> UC4
    Admin --> UC5
    
    UC2 .> UC1 : <<include>>
    UC4 .> UC3 : <<extend>>
    
    Router --> UC2 : Provee métricas
    Router --> UC4 : Provee logs de conexión
    
    SMTP --> UC6 : Entrega Notificaciones Críticas
    UC6 <-- Admin : Lee las alertas
```

## Detalles de los Casos de Uso Principales

1. **Visualizar Dashboard**: El administrador puede observar en gráficas de react-chartjs la evolución de la memoria, CPU y red (RX/TX).
2. **Consultar Inventario**: Ver qué empleados (nombres sincronizados desde Jira) están consumiendo ancho de banda.
3. **Revisar Auditoría**: Ver históricos de conexión (cuánto tiempo estuvo activa una VPN y cuántos megabytes descargó).
