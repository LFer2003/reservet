# Decisiones y cambios de la solución

Las instrucciones de instalación están en el [README](../README.md). Este documento
explica la implementación y los errores corregidos. La evidencia de la revisión
final se recoge en [Verificación de entrega](VERIFICACION.md).

## Del login a PostgreSQL

1. El formulario envía usuario y contraseña a `POST /api/auth/login`.
2. La ruta valida el cuerpo y llama al servicio de autenticación.
3. El repositorio busca al usuario con una consulta parametrizada. El servicio
   deriva la contraseña con scrypt y compara el resultado con `timingSafeEqual`.
4. Si coincide, se genera un token aleatorio de 32 bytes. PostgreSQL almacena su
   hash SHA-256 y la fecha de caducidad; la contraseña nunca se guarda con SHA-256 simple.
5. El navegador recibe `reservet_session`, una cookie `HttpOnly`, `SameSite=Lax`,
   `Path=/`, con una duración de ocho horas. `Secure` se activa con `APP_ENV=pro`;
   el desarrollo local usa HTTP y mismo origen.
6. En una petición de mesas, el middleware verifica la sesión. La ruta HTTP delega
   la validación al servicio y las consultas al repositorio.
7. Al salir, se elimina la sesión en PostgreSQL y se borra la cookie. Reutilizar
   el token responde 401. Una sesión caducada tampoco permite acceder a mesas.

Las sesiones persistentes permiten conservar el acceso entre reinicios y revocarlo
al salir. El token no se guarda en localStorage; allí solo se conserva el idioma.

## Organización

| Ubicación             | Responsabilidad                                             |
| --------------------- | ----------------------------------------------------------- |
| `public/`             | Formularios, eventos, presentación y traducciones.          |
| `src/modules/auth/`   | Rutas, servicio, repositorio y middleware de autenticación. |
| `src/modules/tables/` | Contratos HTTP, validaciones de negocio y SQL de mesas.     |
| `src/shared/`         | Configuración y conexión PostgreSQL.                        |
| `migrations/`         | Esquema de mesas, usuarios y sesiones.                      |
| `scripts/`            | Aplicación de migraciones y creación del usuario local.     |
| `tests/`              | Pruebas de configuración, HTTP, interfaz e integración.     |

Las migraciones se registran en `schema_migrations`. Cada archivo y su registro se
confirman en una transacción; un advisory lock evita que dos ejecuciones migren a
la vez. El seed es repetible y actualiza la contraseña del usuario indicado.

## Contrato de mesas

Todas las rutas requieren una sesión válida.

| Método y ruta                  | Entrada            | Resultado                           |
| ------------------------------ | ------------------ | ----------------------------------- |
| `GET /api/tables`              | Sin cuerpo         | 200 y listado de mesas.             |
| `POST /api/tables`             | `name`, `capacity` | 201 y mesa creada como `available`. |
| `PATCH /api/tables/:id/status` | `status`           | 200 y mesa completa actualizada.    |

Nombre: entre 1 y 80 caracteres después de eliminar espacios exteriores. Capacidad:
entero de 1 a 20. ID: entero positivo. Estados: `available`, `occupied` y
`out_of_service`. Respuestas de error: 400 para datos inválidos, 401 sin sesión,
404 si la mesa no existe y 409 por nombre duplicado.

El repositorio usa parámetros SQL. La base refuerza unicidad, capacidad y estados
con restricciones. El servidor no devuelve SQL ni stacks; los errores internos
incluyen un identificador de petición para relacionarlos con el registro del proceso.

## Interfaz

El login y el panel son pantallas separadas. Los tres idiomas están disponibles
antes y después de entrar, y la preferencia se conserva al recargar. Se usan
`textContent` para datos externos y controles nativos con etiquetas.

Las tarjetas compactas muestran nombre, capacidad, estado y selector. Los botones
del resumen filtran las mesas; «Limpiar filtros» restablece búsqueda y estado. Las
plazas disponibles se calculan sobre todo el salón, independientemente del filtro.
Los dibujos de asientos se retiraron tras revisar su utilidad: aumentaban la altura
sin facilitar el trabajo del personal.

Se deshabilitan los controles durante las operaciones para evitar envíos repetidos.
Un 401 devuelve al login y cierra el diálogo de creación. Un fallo de red al salir
muestra un error y permite reintentar, sin aparentar una revocación que no ocurrió.
El foco vuelve al selector tras cambiar el estado si la mesa sigue visible.

## Errores encontrados y correcciones

| Síntoma y reproducción                                                             | Causa                                                                   | Corrección                                        | Regresión                                                                               |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Cargar el login o cambiar de idioma mostraba etiquetas de crear mesa.              | Selectores generales `form>label` y `form>.muted` alcanzaban el login.  | Se limitaron a `#table-form`.                     | UI comprueba etiquetas de ambos formularios en los tres idiomas.                        |
| Un login incorrecto podía provocar un error JavaScript en vez de un mensaje.       | Faltaban traducciones de autenticación y la aplicación de `data-i18n`.  | Se completaron los diccionarios y sus bindings.   | UI prueba login incorrecto y correcto.                                                  |
| Elegir un idioma y recargar volvía a español.                                      | Se leía `reservet.lang` y se escribía `reservet.language`.              | Se usa una única clave.                           | UI vuelve a importar el módulo y verifica el idioma recuperado.                         |
| Antes de iniciar sesión no se podía cambiar idioma.                                | El selector estaba dentro del panel oculto.                             | El mismo control se mueve a la pantalla activa.   | UI comprueba su presencia en el login.                                                  |
| Caducar la sesión al crear una mesa dejaba el login tapado.                        | El diálogo modal seguía abierto.                                        | Se cierra al mostrar el login.                    | UI simula 401 con el diálogo abierto.                                                   |
| Desconectar la red y salir ocultaba el panel como si el logout hubiera funcionado. | El error de red se ignoraba.                                            | Se muestra el error y se permite reintentar.      | UI cubre error de red y salida correcta.                                                |
| El panel perdía su distribución tras añadir el contenedor de autenticación.        | El nuevo contenedor interrumpía el flex del body.                       | Se define el flex en el panel y la columna móvil. | Comprobaciones de estructura; alcance de revisión visual en el informe de verificación. |
| Pedir el ID `2147483648` devolvía 500.                                             | El entero seguro de JavaScript superaba el rango integer de PostgreSQL. | Se responde 404 sin enviar ese ID a SQL.          | Integración verifica el límite.                                                         |
| Cambiar estado con teclado perdía el foco.                                         | Al renderizar se sustituía el selector enfocado.                        | Se recupera el foco si la mesa continúa visible.  | UI verifica el selector activo después del cambio.                                      |

## Pruebas y aislamiento

`npm run check` ejecuta lint, formato, tipos, pruebas y compilación. Las pruebas UI
usan JSDOM y fetch simulado. Las pruebas HTTP simulan consultas de salud; no son
una demostración de persistencia.

`npm run test:integration` compila y utiliza `TEST_DATABASE_URL`. Exige una base
terminada en `_test`, distinta de la principal. Cada suite crea un esquema aleatorio,
aplica migraciones y elimina solo ese esquema al finalizar. No trunca tablas existentes.
Su usuario debe poder crear esquemas; no necesita privilegios de superusuario.

La integración cubre login, sesión actual, cookies, protección, creación, listado,
estados, validaciones, límites, duplicados, inexistentes, revocación y caducidad.
`restart.test.js` ejecuta dos veces las migraciones y el seed, arranca el servidor
compilado, crea y modifica una mesa, termina Node y vuelve a arrancarlo. Comprueba
que tanto la mesa como la sesión persisten y que el logout sigue revocando el acceso.

## Uso de IA

Utilicé Codex como apoyo para revisar código, localizar el fallo de formularios,
explorar el diseño, ampliar pruebas y ordenar la documentación.

Una decisión corregida fue ocultar el panel ante cualquier resultado del logout.
Se contrastó con el caso de un fallo de red: ocultar la pantalla no demuestra que
el servidor haya revocado la sesión. Se cambió el comportamiento y se añadió una
prueba que comprueba el error, el reintento y la salida correcta.

## Límites del alcance

No se incluyen reservas, pagos, inventario, roles avanzados, recuperación de
contraseña ni deployment. Las sesiones caducadas se rechazan, pero no existe una
tarea programada que elimine sus filas. El modo demostración conserva cambios en
memoria; la persistencia corresponde al modo API.
