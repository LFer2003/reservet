# Reservet: guía de aprendizaje e implementación

**Español** · [English](en/JUNIOR_GUIDE.md) · [Русский](ru/JUNIOR_GUIDE.md)

**Prueba técnica:** sigue el [README principal](../README.md) para el alcance,
instalación local sin Docker y entrega en tu GitHub. Este documento es una ruta
de aprendizaje ampliada: sus instrucciones Docker, reservas y SQS no son requisitos
de la prueba. El login sí es obligatorio en el alcance del README.

Consulta también [cómo contribuir](../CONTRIBUTING.md) y las
[convenciones de arquitectura](ARQUITECTURA.md). Ejecuta `npm run check` antes de entregar.

## 1. Qué vamos a construir

Una aplicación para que el personal de un restaurante administre mesas, gestione
reservas y notifique a clientes. Primero construiremos una API; después una
pantalla que la consuma. Finalmente separaremos las notificaciones en un worker
con SQS. No necesitamos una cuenta de AWS para las primeras etapas.

Objetivo inicial: entender una petición completa desde HTTP hasta PostgreSQL.
Objetivo final: explicar cómo se comporta el sistema cuando hay concurrencia,
mensajes duplicados y fallos de servicios externos.

Trabaja por entregas pequeñas. Antes de programar, escribe qué comportamiento
quieres conseguir. Al terminar, demuestra los casos correctos y los errores.
Las etapas no tienen una fecha fija: avanza cuando puedas explicar la anterior.

## 2. Herramientas y conceptos iniciales

Usaremos TypeScript, Express, PostgreSQL y Docker Compose. TypeScript permite
detectar errores de tipos; Express recibe peticiones HTTP; PostgreSQL conserva
los datos; Compose levanta una base reproducible para desarrollo.

Antes del primer ejercicio practica: variables, funciones, objetos, arrays,
promesas, `async/await`, `try/catch`, módulos y tipos de TypeScript. Aprende también
qué son GET, POST, PATCH, JSON y los códigos HTTP 200, 201, 400, 404, 409 y 500.
Con Git practica `status`, `diff`, ramas y commits pequeños; no subas `.env`.

## 3. Preparar el equipo

1. Instala Node.js compatible (mínimo 22.13), Git y un editor, por ejemplo VS Code.
2. Instala [Docker Desktop para Windows](https://docs.docker.com/desktop/setup/install/windows-install/).
   Sigue sus requisitos de WSL 2/virtualización; puede requerir permisos de administrador
   y reiniciar Windows. Abre Docker Desktop y selecciona contenedores Linux.
3. Abre PowerShell en la carpeta del proyecto y verifica:

```powershell
node --version
npm --version
git --version
docker --version
docker compose version
docker info
```

Docker Desktop incluye Compose. Si acabas de instalarlo y el comando no aparece,
abre una terminal nueva. `docker info` debe poder conectarse al motor.

## 4. Instalar y arrancar por primera vez

Ejecuta en este orden desde la raíz del proyecto:

```powershell
cd E:\reservet
npm ci
# Ejecuta esta copia solo si todavía no tienes .env:
Copy-Item .env.example .env
npm run db:up
npm run db:migrate
npm run dev
```

`npm ci` instala las versiones del lockfile. `.env` configura el servidor y la
conexión. `db:up` descarga PostgreSQL 17 y espera a que esté listo. `db:migrate`
crea el esquema. `dev` mantiene el servidor abierto y lo recarga al editar.

En otra terminal:

```powershell
Invoke-RestMethod http://localhost:3000/health
Invoke-RestMethod http://localhost:3000/health/db
```

El primero devuelve `status: ok`; el segundo debe devolver `database: connected`.
El primero comprueba el proceso y el segundo la conexión, no la existencia de
todas las tablas. Para comprobar la migración:

```powershell
docker compose exec db psql -U reservet -d reservet -c "SELECT * FROM schema_migrations;"
docker compose exec db psql -U reservet -d reservet -c "SELECT * FROM restaurant_tables;"
```

Debe aparecer `001_create_restaurant_tables.sql` y una tabla de mesas vacía.
Vuelve a ejecutar `npm run db:migrate`: debe indicar que ya está aplicada.

En sesiones posteriores usa `npm run db:up` y `npm run dev`; ejecuta migraciones
cuando haya archivos nuevos. Detén la API con Ctrl+C y la base con `npm run db:down`.
El volumen conserva los datos. No uses `docker compose down -v` salvo que quieras
borrar deliberadamente toda la base local.

Si ya tienes PostgreSQL, puedes crear una base y usuario propios, ajustar
`DATABASE_URL` en `.env` y omitir los comandos Docker. Las migraciones son las mismas.

## 5. Cómo está organizado

```text
src/
  server.ts                 Arranque y cierre del proceso
  app.ts                    Express y rutas de salud
  shared/database.ts        Pool de conexiones
  modules/tables/           Aquí implementarás el módulo de mesas
scripts/migrate.ts          Ejecuta migraciones SQL pendientes
migrations/                Cambios versionados del esquema
compose.yaml               PostgreSQL local con volumen persistente
```

Comenzamos con un monolito modular: una aplicación dividida por negocio.
Dentro del módulo de mesas, usa este recorrido:

```text
Petición → ruta/controlador → servicio → repositorio → PostgreSQL
```

La ruta interpreta HTTP y devuelve códigos. El servicio expresa las reglas del
negocio. El repositorio ejecuta SQL usando parámetros (`$1`, `$2`); nunca concatena
datos del usuario. No crees interfaces y capas adicionales sin una necesidad clara.

## 6. Migraciones: cómo cambiar la base

Una migración es un cambio de esquema versionado. La primera crea
`restaurant_tables`: identificador, nombre único, capacidad entre 1 y 20,
estado y fecha de creación. Las restricciones también protegen la base si otro
programa escribe datos incorrectos.

Para añadir un campo en una entrega futura, crea un archivo nuevo como
`migrations/002_add_table_location.sql` con el `ALTER TABLE` correspondiente.
Luego ejecuta `npm run db:migrate` y comprueba el resultado con `psql`.
No edites una migración que ya se haya aplicado: el ejecutor registra su nombre
y no vuelve a ejecutarla. Usa nombres numerados con ceros y en orden.

El ejecutor usa una transacción por archivo: si falla, revierte ese archivo y no
lo registra. Las migraciones previas permanecen aplicadas. Un bloqueo evita que
dos ejecutores migren simultáneamente. No incluyas `BEGIN`/`COMMIT` propios ni
operaciones incompatibles con transacciones, como `CREATE INDEX CONCURRENTLY`.
No hay reversión automática; corrige con una migración nueva. En producción se
necesitarían además respaldos y una estrategia de despliegue compatible.

## 7. Primer encargo: API de mesas

**Aprender:** rutas, validación en ejecución, SQL, errores y separación de responsabilidades.

1. Lee `src/app.ts`, `database.ts` y la migración. Explica cómo se conectan.
2. Crea `tables.repository.ts`: listar mesas e insertar una mesa con SQL parametrizado.
3. Crea `tables.service.ts`: valida nombre no vacío de hasta 80 caracteres,
   capacidad entera entre 1 y 20 y estados permitidos. TypeScript no valida JSON recibido.
4. Crea `tables.routes.ts`, expórtalo como Router y móntalo en `app.ts`
   **antes** del manejador 404.
5. Implementa `GET /api/tables` y `POST /api/tables`.
6. Agrega `PATCH /api/tables/:id/status` para cambiar el estado de una mesa.

Contrato: GET devuelve un array con 200; POST recibe `{ "name": "Mesa 1",
"capacity": 4 }` y devuelve la mesa con 201 y estado `available`.
PATCH recibe `{ "status": "occupied" }` y devuelve la mesa actualizada con 200.
Estados: `available`, `occupied`, `out_of_service`. Datos inválidos: 400;
mesa inexistente: 404; nombre duplicado: 409. Traduce el error PostgreSQL `23505`
a conflicto y no expongas mensajes SQL internos. Valida también el identificador.

Prueba cuando los endpoints estén implementados:

```powershell
Invoke-RestMethod http://localhost:3000/api/tables
$body = @{ name = 'Mesa 1'; capacity = 4 } | ConvertTo-Json
Invoke-RestMethod http://localhost:3000/api/tables -Method Post -ContentType 'application/json' -Body $body
```

**Entrega aceptada:** puedes listar, crear y cambiar estados; los datos sobreviven
a un reinicio; un duplicado devuelve 409; capacidades 0 y 21 se rechazan;
un nombre vacío se rechaza; una mesa inexistente devuelve 404. Agrega pruebas
del contrato y de persistencia al implementar este módulo y ejecuta typecheck/build.

## 8. Segunda entrega: conectar la pantalla del encargado

**Aprender:** HTML, CSS, formularios, eventos, `fetch` y estados de carga/error.

Ya tienes una interfaz en `public/index.html`, `public/styles.css` y `public/app.js`,
servida por Express en http://localhost:3000. No necesita compilación adicional.
Puedes ejecutarla con `npm run dev` sin tener PostgreSQL listo para explorar la demostración.
La interfaz usa JavaScript de navegador; el backend usa TypeScript.

1. En modo **Demostración**, crea una mesa, cambia estados, busca y filtra.
   Sus datos viven en memoria y se reinician al recargar; no comprueban el backend.
2. Abre las herramientas del navegador, pestaña Red/Network, y elige **Mi API local**.
   Observa `GET /api/tables`; al principio dará 404 porque es tu primer ejercicio.
3. Implementa el GET del apartado 7 y pulsa Actualizar. Debes ver tus datos reales
   o un salón vacío si todavía no creaste mesas.
4. Implementa POST y prueba Nueva mesa. Debe recibir la mesa creada como un objeto,
   con `id` entero, `name`, `capacity` entera y `status`.
5. Implementa PATCH y prueba los selectores de estado. La respuesta debe ser
   la mesa completa actualizada, no solo un mensaje o un 204.
6. Recarga en modo API (vuelve a seleccionarlo después de recargar) y verifica
   que los datos persisten. Compruébalos también directamente en PostgreSQL.
7. Lee `request`, `load`, `render` y `changeStatus` en `public/app.js`. Explica
   la diferencia entre validación del navegador y validación obligatoria del servidor.

El modo API muestra fallos de conexión, códigos HTTP y respuestas incompatibles.
Nunca los oculta con mesas de ejemplo. La interfaz no accede directamente a la base.
El login queda pendiente del junior, junto con la protección de rutas del servidor;
esta pantalla de práctica no implementa autenticación.

**Entrega aceptada:** muestra mensajes útiles ante errores, evita envíos repetidos
mientras espera, funciona por teclado y actualiza la vista después de guardar.
Al recargar, las mesas siguen apareciendo.

## 9. Tercera entrega: reservas y concurrencia

**Aprender:** modelado relacional, claves foráneas, fechas, transacciones e índices.

Define primero las reglas: una reserva tiene mesa, nombre del cliente, número de
personas, inicio, fin y estado confirmado/cancelado. Guarda instantes con `timestamptz`
y muestra horas en `America/Cancun`. Fin debe ser posterior al inicio; no exceder
la capacidad; no permitir solapamientos activos. Dos intervalos se solapan si
`inicioA < finB` y `finA > inicioB`; pueden tocarse en el límite.

Haz una migración nueva y endpoints para crear, listar y cancelar. Después simula
dos peticiones simultáneas sobre la misma mesa. Una consulta seguida de un INSERT
sin protección permite que ambas vean disponibilidad.

Una solución inicial es una transacción que bloquee la fila de la mesa con
`SELECT ... FOR UPDATE`, compruebe disponibilidad e inserte. Todas las operaciones
que afecten esa disponibilidad deben seguir la misma disciplina. Lee la documentación
de [bloqueos de PostgreSQL](https://www.postgresql.org/docs/17/explicit-locking.html).
Más adelante compara esa solución con una restricción de exclusión en la base.

**Entrega aceptada:** cancelación libera el horario y dos reservas simultáneas
solapadas no pueden confirmarse. Incluye una prueba de integración concurrente.
El estado `occupied` describe la operación actual; no sustituye el calendario futuro.

## 10. Cuarta entrega: notificaciones con SQS

**Aprender:** productor, consumidor, cola, mensajes y separación de procesos.

Primero implementa una notificación simulada que escribe en consola. Introduce
demora y fallos para observar qué ocurre si se envía dentro de la petición HTTP.
Después crea un worker independiente y una cola de desarrollo, con emulador local
o una cuenta de AWS acordada con el mentor. Nunca uses credenciales en el código.

La API confirma la reserva y prepara un evento con `eventId`, `type`, `version`,
`occurredAt` y `reservationId`. El worker consume el mensaje, realiza la acción
y lo elimina solo cuando termina correctamente. Configura el tiempo de visibilidad
para dar margen al procesamiento. Verifica el comportamiento en la
[documentación oficial de SQS](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/welcome.html).

**Entrega aceptada:** el worker puede estar apagado mientras se crean reservas;
al volver procesa lo pendiente. La API no espera el envío. Inicialmente usa una
notificación simulada, sin mensajes a clientes reales.

## 11. Quinta entrega: fallos, duplicados y outbox

**Aprender:** entrega al menos una vez, idempotencia, reintentos, DLQ y consistencia eventual.

1. Procesa dos veces el mismo evento: usa `eventId` y un registro persistente para
   controlar duplicados. Discute el fallo entre enviar y registrar: para una garantía
   más fuerte, el proveedor externo debe soportar una clave de idempotencia.
2. Simula fallos temporales y verifica que el mensaje se reintenta.
3. Configura una DLQ con límite de intentos; provoca un fallo permanente, inspecciona
   el mensaje y practica su recuperación tras corregir el problema.
4. Simula una caída entre guardar la reserva y publicar en SQS. Implementa una
   tabla outbox: reserva y evento se guardan en la misma transacción; un publicador
   los envía y marca como enviados. Si cae después de publicar puede duplicar:
   por eso la idempotencia sigue siendo necesaria.

**Entrega aceptada:** no se pierde la intención de notificar una reserva confirmada;
los duplicados se manejan; un mensaje fallido puede rastrearse y recuperarse.

## 12. Etapas posteriores

Lista de espera: reaccionar a cancelaciones sin avisar a varias personas de forma
inconsistente. Roles: encargado y administrador, con autorización en servidor.
Auditoría: quién cambió una reserva. Observabilidad: logs con identificadores de
petición/evento y métricas de errores y antigüedad de cola. CI: tipos, compilación
y pruebas en cada cambio. Despliegue: configuración por ambiente, secretos,
migraciones controladas y respaldos.

Extrae un servicio solo cuando puedas explicar el beneficio y el costo en operación,
red y consistencia. El primer candidato es el worker de notificaciones.

## 13. Cómo trabajar con el mentor

Para cada tarea entrega: descripción del problema, decisión de diseño, cambio
pequeño, demostración y evidencia de verificación. El mentor revisa reglas de
negocio, SQL, manejo de errores y claridad; el junior debe poder explicar su código.

Preguntas útiles: ¿qué pasa si llegan dos peticiones a la vez?, ¿si PostgreSQL no
responde?, ¿si este mensaje llega dos veces?, ¿qué datos no debe registrar un log?

## 14. Problemas frecuentes

| Síntoma                             | Acción                                                                                                                             |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `docker` no existe                  | Instala Docker Desktop y abre otra terminal.                                                                                       |
| Docker no conecta                   | Abre Desktop y comprueba `docker info`.                                                                                            |
| Puerto 5433 ocupado                 | Cambia el puerto publicado a `5434:5432` y el puerto de DATABASE_URL a 5434.                                                       |
| Falta DATABASE_URL                  | Copia `.env.example` a `.env` desde la raíz.                                                                                       |
| Conexión rechazada                  | Ejecuta `db:up`, revisa `docker compose ps` y `docker compose logs db`.                                                            |
| Credenciales cambiadas no funcionan | Las variables de Compose inicializan solo un volumen nuevo; conserva las credenciales originales o cambia el usuario mediante SQL. |
| Tabla no existe                     | Ejecuta `db:migrate` contra la misma DATABASE_URL del servidor.                                                                    |
| Puerto 3000 ocupado                 | Cambia PORT en `.env` y reinicia.                                                                                                  |
| `/api/tables` devuelve 404          | Es el primer ejercicio: todavía no viene implementado.                                                                             |

## 15. Estado del punto de partida

Preparado: dependencias instaladas, configuración de desarrollo, servidor de salud,
Compose, ejecutor de migraciones, esquema de mesas e interfaz con modos demo/API.
Pendiente del junior: API de mesas, integración verificada, login, reservas,
pruebas de negocio y todas las etapas de SQS.
Configura tu propia base y ajusta DATABASE_URL a tu instalación. Comprueba las
migraciones en esa base local. Para la prueba técnica, sigue el alcance y la
instalación sin Docker del README; reservas y SQS son etapas opcionales de formación.
