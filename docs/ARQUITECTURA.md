# Convenciones de arquitectura

**Español** · [English](en/ARCHITECTURE.md) · [Русский](ru/ARCHITECTURE.md)

Reservet comienza como monolito modular: un proceso HTTP y PostgreSQL.
El worker llegará en el ejercicio de colas. No crees servicios adicionales sin
una necesidad que puedas explicar y comprobar.

## Responsabilidades

| Parte                              | Responsabilidad                                   |
| ---------------------------------- | ------------------------------------------------- |
| `src/server.ts`                    | Abrir HTTP y cerrar los recursos ante señales     |
| `src/app.ts`                       | Middleware, rutas y errores HTTP                  |
| `src/shared/config.ts`             | Cargar y validar configuración al arrancar        |
| `src/shared/database.ts`           | Pool y límites de conexión/consultas              |
| `src/modules/<module>/*.routes.ts` | Validar entrada HTTP y traducir resultados        |
| `*.service.ts`                     | Reglas de negocio y coordinación de transacciones |
| `*.repository.ts`                  | SQL parametrizado y mapeo de filas                |
| `public/`                          | Presentación y consumo HTTP                       |
| `migrations/`                      | Evolución versionada del esquema                  |

Las dependencias van de rutas a servicios y repositorios. Los tres archivos son
una guía para el primer ejercicio, no una razón para crear capas vacías.
El servicio no debe depender de Request/Response de Express.

## Datos y errores

- Valida JSON recibido en el servidor: TypeScript no valida datos externos.
- Usa restricciones PostgreSQL además de validaciones de aplicación.
- Usa parámetros SQL; nunca concatenes entradas del usuario.
- Traduce errores esperados a 400, 404 o 409; no los presentes como 500.
- Para nuevos errores de negocio devuelve `{ code, message, requestId }`, por
  ejemplo `TABLE_NAME_CONFLICT`. La interfaz puede traducir `code` sin depender
  del idioma de `message`. Los endpoints de mesas siguen pendientes del junior.
- No expongas stack traces, consultas, contraseñas ni objetos Error completos.
- No registres cuerpos, credenciales o datos personales innecesarios en logs.

Una transacción debe utilizar el mismo cliente desde BEGIN hasta COMMIT/ROLLBACK
y liberarlo en `finally`. No ejecutes sus pasos con `pool.query`: podrían usar
conexiones diferentes. Prueba concurrencia cuando implementes reservas.

Las migraciones se ejecutan explícitamente, con transacción por archivo y bloqueo
entre ejecutores. No corren al iniciar HTTP. Este ejecutor educativo no incluye
rollback automático ni checksum: las migraciones aplicadas son inmutables por
convención y revisión de código.

## Interfaz e idiomas

`public/app.js` coordina una pantalla; `public/i18n.js` contiene traducciones y
preferencia de idioma. Al añadir más pantallas, separa módulos por funcionalidad.
Los valores del contrato HTTP (`available`, etc.) son estables en todos los idiomas.

Los datos externos se insertan con `textContent`; las plantillas HTML contienen
solo valores constantes. El modo demo es explícito y no oculta errores del modo
API. Las peticiones tienen timeout y se impiden envíos repetidos mientras esperan.
Las fuentes tienen alternativas locales y no requieren solicitudes a terceros.

## Alcance y verificación

El servidor escucha en localhost por defecto. Dentro de Docker escucha en todas
las interfaces del contenedor, con el puerto publicado solo en localhost del host.
Consulta [ambientes y pipeline](DEPLOYMENT.md). Las credenciales de ejemplo son locales.
Helmet configura cabeceras y CSP; HTTP local no fuerza HTTPS/HSTS. Al desplegar
revisa HTTPS, orígenes, secretos y permisos. Consulta las
[recomendaciones oficiales de Express](https://expressjs.com/advanced/best-practice-security/).

Autenticación y autorización son tareas del junior; este es un entorno de práctica
local. SQS, outbox, roles, límites de frecuencia y observabilidad completa llegarán
con sus ejercicios. Las pruebas actuales no verifican migraciones en PostgreSQL
real ni sustituyen una revisión visual en navegador.
