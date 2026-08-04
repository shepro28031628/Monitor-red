# JUSTIFICACIÓN PARA LA IMPLEMENTACIÓN DE LA HERRAMIENTA DE MONITOREO DE RED (REN Enterprise Monitor)

## 1. Introducción
En el entorno empresarial actual, la disponibilidad y seguridad de la infraestructura de red son pilares fundamentales para garantizar la continuidad del negocio. La implementación de **REN Enterprise Monitor**, una herramienta propia e integral de telemetría y auditoría para routers MikroTik, surge como una iniciativa estratégica para centralizar, analizar y proteger nuestras comunicaciones y accesos remotos.

## 2. Justificación Operativa
Desde el punto de vista del negocio y las operaciones diarias, la adopción de esta herramienta proporciona los siguientes beneficios inmediatos:
* **Visibilidad en Tiempo Real:** Permite a los equipos de TI y Operaciones visualizar el estado exacto de la red (consumo de ancho de banda, conexiones VPN activas y salud del hardware) en un panel de control único y amigable.
* **Respuesta Proactiva ante Incidentes:** Gracias a su motor de alertas automatizado, el equipo recibe notificaciones inmediatas ante comportamientos anómalos (alta carga de CPU, caídas del enlace WAN, temperaturas críticas). Esto reduce drásticamente el Tiempo Medio de Recuperación (MTTR) y evita caídas masivas del servicio.
* **Optimización de Recursos:** Al mantener un histórico del rendimiento de la red y las interfaces, se facilita la toma de decisiones informadas sobre la asignación de ancho de banda, la necesidad de mejoras de hardware o renegociaciones de contratos con los ISP.

## 3. Justificación Técnica
Técnicamente, el sistema resuelve problemas de "caja negra" que suelen presentar los equipos de enrutamiento al no estar debidamente integrados con plataformas de observabilidad:
* **Auditoría de Sesiones y Telemetría Histórica:** El sistema extrae métricas mediante la API de MikroTik de forma eficiente y no intrusiva. Toda la actividad (incluyendo conexiones y desconexiones VPN con direcciones IP asociadas) se almacena en una base de datos relacional robusta (PostgreSQL).
* **Escalabilidad y Modernización:** Construido sobre arquitecturas modernas (Next.js, Prisma, y Workers asíncronos), la herramienta es 100% escalable y puede integrarse fácilmente en el futuro con otras soluciones (SIEM, sistemas de tickets) mediante colas de mensajes (Redis).
* **Control de Accesos VPN:** Permite rastrear de forma exacta y en tiempo real quién se conecta a la red corporativa, desde qué IP pública y por cuánto tiempo, cerrando brechas de visibilidad.

## 4. Cumplimiento ISO/IEC 27001:2022
La herramienta actúa como un control técnico habilitador para cumplir con múltiples requisitos del estándar internacional ISO/IEC 27001:2022, específicamente apoyando los siguientes controles del Anexo A:

* **Control A.8.15 - Registro de eventos (Logging):** 
  * *Cómo apoya la herramienta:* Mantiene un registro inmutable e histórico de todas las sesiones de acceso remoto (VPN) establecidas contra el router principal. Guarda detalles críticos como nombre de usuario, direcciones IP de origen, timestamps de inicio/fin y tráfico transferido, permitiendo trazar cualquier anomalía o acceso no autorizado.
* **Control A.8.16 - Actividades de seguimiento (Monitoring activities):**
  * *Cómo apoya la herramienta:* La naturaleza principal del software es el monitoreo continuo. Evalúa en tiempo real (polling cada 2 segundos) la carga del sistema, estado de las interfaces (WAN1/WAN2), latencia (ping) y saturación de la red, detectando desviaciones del comportamiento esperado y documentándolas para su análisis.
* **Control A.8.20 - Seguridad de las redes (Networks security):**
  * *Cómo apoya la herramienta:* Otorga visibilidad total sobre la superficie de red, cantidad de conexiones activas y perfiles VPN conectados, asegurando que las capacidades de red sean gestionadas y controladas adecuadamente para proteger la información en tránsito.
* **Control A.5.24 - Planificación y preparación para la gestión de incidentes de seguridad de la información:**
  * *Cómo apoya la herramienta:* El sistema automatizado de alertas tempranas sirve como el primer nivel de detección (triage) para el equipo de respuesta a incidentes, permitiendo accionar los planes de contingencia antes de que un evento escale a un incidente mayor.

## 5. Conclusión
La adopción de **REN Enterprise Monitor** no es solo una mejora tecnológica, sino una inversión directa en la resiliencia operativa y en la madurez de nuestra postura de ciberseguridad. Al automatizar la vigilancia de la red, dotar de evidencias técnicas a los procesos de auditoría y asegurar el alineamiento con ISO/IEC 27001:2022, la organización mitiga riesgos significativos y garantiza la continuidad y calidad de sus servicios a clientes y colaboradores.
