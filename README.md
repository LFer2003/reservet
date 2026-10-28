# Reservet · Gestión de mesas

**Español** · [English](README.en.md) · [Русский](README.ru.md)

Aplicación para personal de restaurante con inicio de sesión, gestión de mesas y
persistencia en PostgreSQL. Solución de la prueba técnica junior de Reservet.

[Repositorio](https://github.com/LFer2003/reservet) ·
[Verificaciones en GitHub](https://github.com/LFer2003/reservet/actions/workflows/ci.yml) ·
[Decisiones y registro de problemas](docs/ENTREGA.md) · [Verificación de entrega](docs/VERIFICACION.md) · [Enunciado original](docs/ENUNCIADO.md)

## Funcionalidades

- Login, consulta de sesión y logout con revocación en el servidor.
- Contraseñas con scrypt y sesiones PostgreSQL con caducidad de ocho horas.
- Listado y creación de mesas; estados disponible, ocupada y fuera de servicio.
- Búsqueda sin distinguir mayúsculas, filtros desde el resumen y limpieza de filtros.
- Tarjetas compactas con nombre, capacidad, estado y control para cambiarlo.
- Resumen de mesas y plazas disponibles, interfaz adaptable e idiomas español, inglés y ruso.
- Modo API con persistencia y modo demostración con datos temporales.

## Vista previa

![Panel de mesas en modo API](docs/screenshots/panel-desktop.jpg)

[Vista móvil](docs/screenshots/panel-mobile.jpg). Capturas con datos ficticios en una base de pruebas.

## Cambios realizados

El punto de partida incluía la interfaz y el esquema de mesas. Sobre esa base se
implementaron tres partes:

- **Acceso:** usuarios, seed repetible, login, sesión actual y logout. La protección
  se aplica en el servidor a todas las rutas de mesas.
- **Gestión de mesas:** listado, creación y cambio de estado conectados a PostgreSQL,
  con validaciones y respuestas para datos incorrectos, duplicados y mesas inexistentes.
- **Interfaz y pruebas:** separación del login y el panel, traducciones corregidas,
  preferencia de idioma al recargar, filtros desde el resumen y tarjetas compactas.
  Se añadieron regresiones de interfaz y pruebas con PostgreSQL real.

## Ejecución local

Requisitos: Git, Node.js 22.13 o superior compatible, npm y PostgreSQL 17.
No se necesita Docker ni desplegar la aplicación.

### 1. Clonar e instalar

```powershell
git clone https://github.com/LFer2003/reservet.git
cd reservet
npm ci
Copy-Item .env.example .env
```

Si ya existe `.env`, consérvalo y ajusta sus valores sin sobrescribirlo.

### 2. Preparar PostgreSQL

Como administrador, ejecuta estas sentencias **por separado**, con autocommit:

```sql
CREATE ROLE reservet_candidate LOGIN PASSWORD 'local_candidate_password';
CREATE DATABASE reservet_candidate OWNER reservet_candidate;
CREATE DATABASE reservet_candidate_test OWNER reservet_candidate;
```

Son credenciales de ejemplo para uso local. El usuario de la aplicación no necesita
ser superusuario. Cambia los valores si ya existen esos nombres.

### 3. Configurar variables

Ajusta `.env` a tu usuario, contraseña, puerto y nombres reales:

```dotenv
PORT=3000
HOST=127.0.0.1
APP_ENV=dev
DATABASE_URL=postgresql://reservet_candidate:local_candidate_password@localhost:5432/reservet_candidate
TEST_DATABASE_URL=postgresql://reservet_candidate:local_candidate_password@localhost:5432/reservet_candidate_test
```

Codifica caracteres especiales de la contraseña para una URL. `.env` está excluido
de Git. `TEST_DATABASE_URL` debe usar una base exclusiva, distinta de la principal,
cuyo nombre termine en `_test`.

### 4. Migrar y generar el usuario local

```powershell
npm run db:migrate
$env:SEED_USERNAME = 'demo'
$env:SEED_PASSWORD = Read-Host 'Elige una contraseña local de al menos 12 caracteres'
npm run db:seed-user
Remove-Item Env:SEED_PASSWORD
npm run dev
```

El seed es repetible: crea el usuario o actualiza su contraseña. No hay registro
público ni una contraseña universal incluida en el repositorio.

Abre [http://localhost:3000](http://localhost:3000), inicia sesión con tu usuario y
selecciona **Mi API local** para probar la persistencia. **Demostración** guarda
cambios únicamente en memoria y los pierde al recargar; no demuestra el backend.

```powershell
Invoke-RestMethod http://localhost:3000/health
Invoke-RestMethod http://localhost:3000/health/db
```

Resultados esperados: `status: ok` y `database: connected`. Para ejecutar el código
compilado, usa `npm run build` y después `npm start`.

## Pruebas

```powershell
npm run check
npm run test:integration
```

| Comando                    | Qué comprueba                                                                                                              |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `npm run check`            | ESLint, Prettier, tipos, pruebas de configuración/HTTP/UI y compilación.                                                   |
| `npm test`                 | Pruebas sin PostgreSQL real: JSDOM y fetch simulado; mocks para consultas de salud.                                        |
| `npm run test:integration` | Peticiones HTTP y PostgreSQL real en la base `_test`: autenticación, mesas, errores, revocación, caducidad y persistencia. |

La integración crea un esquema aleatorio, aplica las migraciones y elimina solo
ese esquema al terminar; no trunca tablas existentes. Su usuario necesita permiso
para crear esquemas. No hay que migrar previamente la base de pruebas.

GitHub Actions prepara PostgreSQL 17 temporal y ejecuta ambas suites, además de las
comprobaciones existentes. Los resultados están en
[Verificaciones](https://github.com/LFer2003/reservet/actions/workflows/ci.yml).

## Arquitectura y seguridad

`public/` contiene la interfaz. `src/modules/auth/` y `src/modules/tables/` separan
rutas HTTP, servicios de negocio y repositorios SQL. `migrations/` contiene el
esquema y `scripts/` las migraciones y el seed.

El login verifica scrypt y genera un token aleatorio. PostgreSQL guarda su hash;
el navegador recibe una cookie `HttpOnly`, `SameSite=Lax`, con caducidad de ocho
horas. `Secure` se activa con `APP_ENV=pro`; desarrollo local usa HTTP y mismo origen.
Cada petición de mesas valida la sesión antes de acceder al servicio y al repositorio.
Salir elimina la sesión del servidor y la cookie. No se almacenan tokens en localStorage.

El servidor valida entradas, usa SQL parametrizado y restricciones de base de datos.
Los nombres externos se insertan con `textContent`; los errores internos no exponen
SQL ni stacks. Los contratos completos y las regresiones están en [la guía](docs/ENTREGA.md).

## Decisiones técnicas

Elegí sesiones persistentes para poder revocar el acceso al cerrar sesión y
conservarlo después de reiniciar el servidor. La contraseña se deriva con scrypt;
SHA-256 se usa únicamente para guardar el hash del token aleatorio de sesión.

En la interfaz prioricé la operación del salón: el nombre, la capacidad y el estado
se leen juntos. El resumen sirve también como filtro. Los dibujos de mesas se
sustituyeron por tarjetas más compactas porque ocupaban espacio sin facilitar el uso.

El flujo de una petición es: **formulario → ruta HTTP → servicio → repositorio →
PostgreSQL**. El middleware comprueba la sesión antes de permitir las operaciones
de mesas. El [registro de cambios y errores](docs/ENTREGA.md) explica las causas y
las pruebas de regresión.

## Uso de IA

Utilicé Codex como apoyo para revisar código, depurar el login, explorar el diseño,
ampliar pruebas y organizar la documentación. Las decisiones se contrastaron con
el comportamiento de la aplicación y las pruebas automatizadas.

Una decisión que corregí fue ocultar el panel aunque fallara la petición de logout:
eso no confirma que la sesión se haya revocado. Ahora se muestra el error y se
permite reintentar; la prueba de interfaz cubre tanto el fallo como el cierre correcto.

## Alcance

La solución se centra en autenticación y gestión de mesas. Reservas, pagos,
inventario, recuperación de contraseña y despliegue no forman parte de esta prueba.
El detalle de seguridad, las limitaciones técnicas y la evidencia de validación
están en [la documentación de entrega](docs/ENTREGA.md) y en el
[informe de verificación](docs/VERIFICACION.md).
