# Integración con Jira Assets

El sistema cuenta con una integración nativa para sincronizar los dispositivos conectados al router (MikroTik) con la base de datos de inventario y empleados administrada en **Jira Service Management (Assets)**.

## Flujograma de Sincronización (UML)

Este diagrama ilustra la lógica que sigue el Worker de telemetría para auditar las conexiones (VPN/DHCP) y cruzar esa información con Jira.

```mermaid
flowchart TD
    Inicio((Inicio Sincronización)) --> ObtenerConexiones[Extraer DHCP Leases y PPP Secrets Activos del MikroTik]
    ObtenerConexiones --> BuscarDB[Consultar tabla DeviceInventory local]
    
    BuscarDB --> ForEach{Iterar cada Dispositivo}
    
    ForEach -->|Falta Dueño o Nuevo| CallJira[Llamar a la API REST de Jira Assets]
    ForEach -->|Ya está mapeado| Siguiente[Ignorar y Continuar]
    
    CallJira -->|Búsqueda por MAC/IP| ResultadoJira{¿Existe en Jira?}
    
    ResultadoJira -->|Sí| ActualizarLocal[Hacer UPDATE en PostgreSQL asignando 'owner']
    ResultadoJira -->|No| CrearAlert[Ignorar o registrar log de Dispositivo No Identificado]
    
    ActualizarLocal --> Siguiente
    CrearAlert --> Siguiente
    
    Siguiente --> ForEach
    ForEach -->|Fin de la lista| Fin((Fin Sincronización))
```

## Configuración Requerida

Para que este proceso (Flowchart) se ejecute correctamente, el archivo `.env` debe incluir las variables de entorno relacionadas con Atlassian:
- `JIRA_EMAIL`
- `JIRA_API_TOKEN`
- `JIRA_WORKSPACE_ID`
