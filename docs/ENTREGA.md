# Ejecución y revisión de la solución

## Preparación local

Requisitos: Node.js 22.13 o superior compatible, npm y PostgreSQL 17. No requiere Docker.
Desde pgAdmin o psql, como administrador, ejecuta por separado:

```sql
CREATE ROLE reservet_candidate LOGIN PASSWORD 'local_candidate_password';
CREATE DATABASE reservet_candidate OWNER reservet_candidate;
CREATE DATABASE reservet_candidate_test OWNER reservet_candidate;
```

Estas credenciales son ejemplos locales. Cambia la contraseña en tu instalación y
codifica caracteres especiales en las URL. En PowerShell, desde la raíz:

```powershell
npm ci
# Solo si no tienes .env:
Copy-Item .env.example .env
# Ajusta DATABASE_URL y TEST_DATABASE_URL en .env al usuario, puerto y bases reales.
npm run db:migrate
$env:SEED_USERNAME = 'demo'
$env:SEED_PASSWORD = Read-Host 'Contraseña de demostración local (mínimo 12 caracteres)'
npm run db:seed-user
Remove-Item Env:SEED_PASSWORD
npm run dev
```

Abre http://localhost:3000 e inicia sesión con las credenciales que acabas de generar.
El seed se puede repetir: actualiza la contraseña del usuario indicado. No publiques
tu `.env`. Para comprobar la base usa `/health/db` (debe indicar `connected`).
Selecciona **Mi API local** para comprobar PostgreSQL. Demostración usa datos en
memoria y sus cambios se pierden al recargar; no sustituye la verificación del backend.

## Flujo y decisiones

1. El formulario envía usuario y contraseña a `POST /api/auth/login` en el mismo origen.
2. La ruta valida el cuerpo y llama al servicio. El repositorio consulta al usuario
   mediante SQL parametrizado. El servicio compara el hash scrypt con `timingSafeEqual`.
3. Se genera un token aleatorio de 32 bytes y se guarda únicamente su hash SHA-256
   en PostgreSQL. SHA-256 se usa para el token aleatorio, nunca para contraseñas.
4. El navegador recibe la cookie `reservet_session`, `HttpOnly`, `SameSite=Lax`,
   `Path=/`, con duración de ocho horas. `Secure` se activa con `APP_ENV=pro`;
   desarrollo local usa HTTP. `GET /api/auth/me` recupera la sesión al recargar.
5. Cada petición de mesas pasa por el middleware de autenticación. La ruta delega
   en el servicio las validaciones y en el repositorio las operaciones SQL.
6. `POST /api/auth/logout` borra la sesión del servidor y elimina la cookie.
   Reutilizar el token revocado responde 401. Un fallo de red al salir se muestra
   como error y permite reintentar. Las sesiones caducadas también responden 401.

Se eligieron sesiones persistentes para permitir revocación inmediata y conservar
el acceso al reiniciar el proceso, sin almacenar tokens en localStorage. Las tablas
tienen restricciones de nombre único, capacidad y estado. Los textos externos se
insertan con `textContent`. Los errores internos no exponen SQL ni stacks al cliente.

## Pruebas reproducibles

```powershell
npm run check
npm run test:integration
```

`check` ejecuta lint, formato, tipos, pruebas de configuración/HTTP/UI y compilación.
HTTP simula consultas de salud; UI usa JSDOM y fetch simulado. Estas pruebas no
demuestran por sí solas persistencia ni sustituyen las pruebas de integración.

`test:integration` exige `TEST_DATABASE_URL` apuntando a una base distinta de la
principal y cuyo nombre termine en `_test`. Crea un esquema aleatorio aislado,
aplica todas las migraciones, genera un usuario y ejecuta peticiones HTTP reales.
Al finalizar elimina solamente ese esquema. No trunca tablas existentes. La base
de pruebas debe existir y su usuario debe poder crear esquemas; no necesita ser
superusuario. No hace falta migrarla previamente: la suite lo hace en su esquema.

Cubre login correcto/incorrecto, cookie, sesión actual, endpoints sin autenticación,
crear/listar/cambiar los tres estados, validaciones, duplicados, inexistentes,
revocación y caducidad. Reinicia el servidor HTTP y abre otra conexión PostgreSQL
para verificar persistencia. No reinicia automáticamente el proceso Node ni el
servicio PostgreSQL: comprueba además de forma manual crear una mesa en modo API,
recargar, detener `npm run dev`, volver a arrancarlo y confirmar que continúa allí.

GitHub Actions prepara PostgreSQL 17 temporal y ejecuta ambas suites junto con las
comprobaciones existentes. No se requiere runner propio ni publicar la aplicación.

## Registro de problemas y regresiones

| Síntoma y reproducción                                              | Causa                                                                                                                  | Corrección y evidencia                                                                                            |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Login muestra etiquetas de crear mesa al cargar o cambiar idioma.   | Traducciones con selectores generales `form>label` y `form>.muted` alcanzaban primero el login.                        | Selectores limitados a `#table-form`; la prueba UI comprueba etiquetas de ambos formularios en los tres idiomas.  |
| Login y mensajes de error provocan errores JavaScript.              | Faltaban claves de autenticación y no se procesaban atributos `data-i18n`.                                             | Diccionarios completos y aplicación de esos atributos; UI prueba login correcto/incorrecto.                       |
| El idioma vuelve a español tras recargar.                           | Lectura de `reservet.lang` y escritura de `reservet.language`.                                                         | Una única clave; UI vuelve a importar el módulo y comprueba la preferencia.                                       |
| No se puede cambiar idioma antes de autenticarse.                   | Selector dentro del panel oculto.                                                                                      | Se mueve el mismo control a la pantalla activa; UI comprueba su presencia en el login.                            |
| Login queda tapado tras caducar sesión al crear mesa.               | El diálogo modal permanece abierto al ocultar el panel.                                                                | Se cierra al mostrar login; prueba UI simula 401 con diálogo abierto.                                             |
| Cerrar sesión aparenta funcionar aunque falle la red.               | Se ignoraba el error y se ocultaba el panel siempre.                                                                   | Se muestra error y se permite reintentar; UI cubre fallo y éxito.                                                 |
| Disposición del panel y login incorrecta tras añadir autenticación. | El contenedor nuevo interrumpió el flex del body; reglas del formulario apuntaban a un formulario anidado inexistente. | Flex en el panel, columna móvil y grid en el formulario real. Pendiente revisión visual manual en varios tamaños. |
| Un ID positivo superior al rango integer de PostgreSQL provoca 500. | Se aceptaba un entero seguro de JavaScript que excede el rango de la columna.                                          | Se trata como mesa inexistente antes de consultar PostgreSQL; integración cubre este límite.                      |
| `npm run check` fallaba por formato.                                | CSS sin formatear.                                                                                                     | Se aplica Prettier y se ejecuta de nuevo la verificación completa.                                                |

## Identidad visual

El diseño combina verde bosque, fondo cálido y tipografía editorial en los títulos.
El login incluye un plano decorativo del salón hecho con HTML/CSS, sin imágenes,
fuentes remotas ni dependencias adicionales. En móvil se simplifica para priorizar
el formulario; se respeta la preferencia de movimiento reducido del sistema.

Las tarjetas dibujan exactamente un asiento por plaza y usan texto y color para
identificar el estado. Un resumen calcula las mesas y plazas disponibles del salón
completo, independientemente de los filtros. Las pruebas UI comprueban ambos
cálculos y la cantidad de asientos en los tres idiomas. Se revisaron visualmente
login y panel a anchos de escritorio (1440 px) y móvil (390 px), incluido el panel
en ruso. Esta revisión completa la comprobación de distribución indicada arriba.

## Uso de IA y límites

Se utilizó Codex para revisar el enunciado y el código, diagnosticar la mezcla de
formularios, corregir autenticación/interfaz, diseñar el login y las tarjetas,
ampliar pruebas y redactar esta guía.
Las decisiones se contrastaron con pruebas: ocultar la interfaz tras un logout
fallido no demuestra revocación. Se corrigió ese comportamiento y se añadió una
regresión que exige mostrar el error y conservar la posibilidad de reintentar.
La persona candidata debe revisar y poder explicar el código y estas decisiones.

No se implementan reservas, pagos, roles avanzados ni recuperación de contraseña,
según el alcance. Las sesiones vencidas se rechazan pero no hay limpieza programada
de sus filas. Los tres idiomas están disponibles tanto en login como en mesas.

## Pendientes de publicación y entrega

La carpeta revisada no tiene commits ni remotos configurados. Antes de entregar,
recupera el historial del repositorio original mediante un clon y traslada tus
cambios a una rama propia; no basta con publicar esta carpeta como historial nuevo.
Conserva `.env` exclusivamente local y excluido de Git.

- Publicar en tu propio GitHub, nunca en el del evaluador.
- Abrir y revisar PR propio e integrarlo a la rama final.
- Confirmar una ejecución verde de **Verificaciones** en GitHub.
- Clonar en otra carpeta y seguir esta guía desde cero.
- Adjuntar URL del repositorio, rama final, SHA, PR y CI verde.
- Recomendado: probar también con teclado y en un teléfono físico antes de entregar.

La ejecución local de CI no constituye una ejecución publicada en GitHub. No se han
creado enlaces ni commits como parte de esta revisión.
