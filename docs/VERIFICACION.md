# Verificación de la entrega

Revisión realizada el 28 de octubre de 2026. Se separan las comprobaciones del
código local de la evidencia publicada en GitHub.

## Resultado local

Se ejecutaron `npm run check` y las suites de integración con PostgreSQL real.
También se preparó una copia independiente mediante clon local y traslado de los
cambios de trabajo, sin reutilizar `node_modules` ni `dist`. En esa copia se ejecutaron
`npm ci`, `npm run check` y `npm run test:integration` correctamente.

Resultado final: siete pruebas principales y nueve comprobaciones de integración
correctas, junto con lint, formato, tipos y compilación. También pasaron las pruebas
existentes del script de deployment, con comandos simulados y sin desplegar servicios.

La instalación de dependencias informó cero vulnerabilidades en esa ejecución.
Las credenciales se proporcionaron en la configuración local, fuera de Git.
Las pruebas usaron exclusivamente esquemas temporales de la base `_test`.

| Requisito                                  | Evidencia                                                                                                     |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| Migraciones y usuario reproducible         | `restart.test.js` ejecuta dos veces migraciones y seed sobre un esquema vacío.                                |
| Login correcto e incorrecto                | Integración HTTP con PostgreSQL real.                                                                         |
| Sesión actual, caducidad y revocación      | Integración comprueba `/me`, cookie, expiración y rechazo después de logout.                                  |
| Protección de todos los endpoints de mesas | GET, POST y PATCH sin sesión responden 401.                                                                   |
| Listar, crear y cambiar los tres estados   | Integración con comprobación de los cuerpos devueltos.                                                        |
| Validaciones, duplicados e inexistentes    | Integración comprueba 400, 409, 404 y el rango de IDs; incluye nombre de 80 caracteres y capacidades 1 y 20.  |
| Persistencia al reiniciar                  | Reinicio del servidor HTTP, otra conexión PostgreSQL y terminación/arranque de un proceso Node independiente. |
| Separación de responsabilidades            | Rutas, servicios y repositorios en los módulos auth/tables.                                                   |
| SQL y restricciones                        | Consultas parametrizadas y restricciones en migraciones, contrastadas con casos de integración.               |
| Idiomas y preferencia al recargar          | UI comprueba español, inglés, ruso y recuperación del idioma.                                                 |
| Búsqueda y filtros                         | UI comprueba búsqueda en mayúsculas, filtros del resumen y limpieza.                                          |
| Seguridad de textos y errores              | UI inserta un nombre con HTML como texto; HTTP comprueba errores JSON sin stack.                              |
| Uso de IA y registro de problemas          | README y `docs/ENTREGA.md`, con causa, corrección y prueba de regresión.                                      |
| Variables e instrucciones                  | `.env.example`, README y procedimiento de seed; `.env` no está versionado.                                    |

## Revisión de interfaz

Se revisó el panel compacto actual en navegador con PostgreSQL real en un esquema
exclusivo de pruebas. Se verificaron login, selección de API, filtros del resumen,
limpieza de filtros, creación de mesa, cambio de estado, actualización del listado
y logout. Se comprobó la navegación con Tab desde búsqueda hasta el filtro.

El panel se revisó a 1440 px en escritorio y 390 px en móvil, con español, inglés
y ruso. No se observó desbordamiento horizontal. Las capturas utilizan datos
ficticios; el usuario y el esquema de prueba se retiraron al terminar.

- [Panel de escritorio](screenshots/panel-desktop.jpg).
- [Panel móvil en ruso](screenshots/panel-mobile.jpg).

## Evidencia publicada

La API pública de GitHub confirmó que [LFer2003/reservet](https://github.com/LFer2003/reservet)
es accesible públicamente y su rama predeterminada es `main`.

- Commit consultado: `278d743716b081b5bf6a8722d29a8c832d9a4fa8`.
- [Verificaciones: ejecución correcta](https://github.com/LFer2003/reservet/actions/runs/40767931435).
- [Deployment omitido](https://github.com/LFer2003/reservet/actions/runs/40767931480), conforme al alcance de las copias del candidato.

Esa ejecución documenta el primer commit publicado. Los resultados del PR de entrega se consultan en [Verificaciones](https://github.com/LFer2003/reservet/actions/workflows/ci.yml).

## Historial y publicación

El historial original se incorporó mediante el merge
`e20407556d676dcb1ccd02d485e05b68f801900b`, que conecta el trabajo publicado con
`upstream/main` (`4c94597`). Se resolvieron los conflictos conservando la solución
revisada; no se reescribió el historial publicado ni se modificó el repositorio del evaluador.

Se comprobó con `git merge-base --is-ancestor` que tanto `upstream/main` como el
`main` publicado son antecesores de la rama de entrega.

El [PR #1](https://github.com/LFer2003/reservet/pull/1) reúne las pruebas finales,
la documentación y la integración del historial. La rama de revisión es
`codex/entrega-final` y la rama de entrega es `main`.

Para identificar el commit final después de integrar el PR:

```powershell
git switch main
git pull --ff-only origin main
git rev-parse HEAD
```

Los enlaces al PR y a Verificaciones permiten consultar la evidencia publicada y
el SHA de cada ejecución. La revisión local y las capturas corresponden al código
incluido en este PR.

## Cómo repetir la revisión

```powershell
npm ci
# Configurar DATABASE_URL y TEST_DATABASE_URL siguiendo el README.
npm run check
npm run test:integration
./tests/deploy.test.ps1
```

La aplicación principal no necesita Docker. Las pruebas del script de deployment
usan dobles de comandos, sin Docker, secretos ni servidores externos.
