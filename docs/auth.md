# Autenticación y Seguridad (NextAuth)

El sistema de autenticación de **REN MikroTik Monitor** se basa en **NextAuth.js (v5)** para proveer seguridad y manejo de sesiones de forma robusta.

## Diagrama de Secuencia de Autenticación (UML)

A continuación, se detalla el proceso completo desde que el administrador intenta iniciar sesión hasta que obtiene acceso al panel:

```mermaid
sequenceDiagram
    actor Admin
    participant Frontend as Next.js (Client)
    participant Auth as NextAuth (API)
    participant DB as PostgreSQL (Prisma)
    
    Admin->>Frontend: Ingresa usuario y contraseña
    Frontend->>Auth: POST /api/auth/callback/credentials
    
    Auth->>DB: SELECT * FROM User WHERE username = ?
    DB-->>Auth: Retorna datos del usuario (Hash de Password)
    
    Auth->>Auth: Compara Hash Bcrypt con Password ingresado
    
    alt Credenciales Válidas
        Auth->>DB: UPDATE / Registra evento de inicio de sesión
        Auth-->>Frontend: Retorna JWT (Token de Acceso Seguro)
        Frontend->>Frontend: Redirige a /dashboard
    else Credenciales Inválidas
        Auth-->>Frontend: Error "CredentialsSignin"
        Frontend->>Admin: Muestra mensaje de error
    end
```

## Middleware de Protección

El sistema utiliza el Middleware perimetral de Next.js (`middleware.ts`). Este middleware intercepta todas las peticiones a rutas protegidas (como `/dashboard`, `/inventory` o cualquier endpoint bajo `/api/`) y valida la existencia y vigencia del JWT antes de permitir que la petición llegue al servidor.
