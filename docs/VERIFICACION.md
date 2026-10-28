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

## Alcance de las verificaciones de interfaz

La suite JSDOM comprueba los flujos de login, cambio de idioma, creación, estados,
filtros, errores, caducidad y logout. También comprueba que el foco de teclado se
conserva al cambiar el estado de una mesa que continúa visible.

Se revisó en navegador una versión anterior del login y del panel, a 1440 px y
390 px. La reorganización posterior de tarjetas compactas está cubierta por pruebas
automáticas, pero su revisión visual manual no se completó por un fallo de las
herramientas de navegador. No se atribuye esa revisión a la versión actual.

## Evidencia publicada

La API pública de GitHub confirmó que [LFer2003/reservet](https://github.com/LFer2003/reservet)
es accesible públicamente y su rama predeterminada es `main`.

- Commit consultado: `278d743716b081b5bf6a8722d29a8c832d9a4fa8`.
- [Verificaciones: ejecución correcta](https://github.com/LFer2003/reservet/actions/runs/40767931435).
- [Deployment omitido](https://github.com/LFer2003/reservet/actions/runs/40767931480), conforme al alcance de las copias del candidato.

La ejecución verde corresponde a ese commit; los cambios locales de esta revisión
necesitan su propio commit y una nueva ejecución de CI para quedar cubiertos en GitHub.

## Requisitos formales de publicación

La revisión del código no sustituye estas condiciones del enunciado:

- El historial local parte de un commit inicial propio, en vez de conservar el
  historial del repositorio original. Debe resolverse antes de afirmar cumplimiento
  completo de ese requisito; esta revisión no reescribió el historial publicado.
- La consulta de PR del repositorio no mostró un PR de entrega. El enunciado pide
  un PR propio, revisado e integrado a la rama final.
- La entrega debe indicar rama y SHA finales, enlace al PR y CI correspondiente.
- Conviene completar la revisión visual del panel compacto en escritorio y móvil.

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
