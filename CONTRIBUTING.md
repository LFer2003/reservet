# Cómo trabajar en Reservet

**Español** · [English](CONTRIBUTING.en.md) · [Русский](CONTRIBUTING.ru.md)

Para la prueba técnica, el [README principal](README.md) define las tareas y la
entrega en tu propio repositorio. No necesitas Docker ni deployment; no envíes
pull requests al repositorio original. Estas convenciones son material de apoyo.

Empieza por [la guía del junior](docs/GUIA_JUNIOR.md) y las
[convenciones de arquitectura](docs/ARQUITECTURA.md).

## Flujo de trabajo

1. Define el comportamiento esperado y sus casos de error.
2. Crea una rama por tarea, por ejemplo `feat/list-tables`.
3. Ejecuta `npm ci` y `npm run check` para comprobar el punto de partida.
4. Implementa un cambio pequeño que puedas explicar.
5. Añade pruebas del comportamiento y de los errores relevantes.
6. Revisa `git diff`, ejecuta `npm run check` y documenta cómo probar la entrega.

## Convenciones

- Nombres de código y archivos en inglés; documentación en español, inglés y ruso.
- Mantén sincronizadas las tres versiones de la documentación al cambiar instrucciones.
- UTF-8, LF y dos espacios, según `.editorconfig`. Evita pasar texto multilingüe
  por herramientas que lo conviertan a otra codificación.
- TypeScript estricto en backend. Evita `any` y conversiones que oculten datos sin validar.
- Usa `const`, nombres descriptivos y funciones con una responsabilidad.
- Comenta el motivo de decisiones no evidentes, no cada instrucción.
- No añadas dependencias o capas sin explicar qué necesidad resuelven.
- No subas `.env`, credenciales, datos reales de clientes o contenido de logs.
- Añade migraciones nuevas; nunca edites una migración aplicada.
- Verifica español, inglés y ruso. No traduzcas los nombres escritos por usuarios.

## Comandos de calidad

```powershell
npm run format       # Aplica formato consistente
npm run lint         # Detecta problemas de código
npm run typecheck    # Comprueba tipos del backend y scripts
npm test             # Pruebas de configuración, HTTP e interfaz
npm run build        # Compila el backend
npm run check        # Ejecuta todas las comprobaciones, incluido formato
```

Las pruebas usan Node y JSDOM y no conectan con PostgreSQL, AWS ni proveedores
reales. JSDOM no comprueba el aspecto visual: revisa también navegador, vista
móvil y teclado. Al implementar repositorios añade pruebas de integración con
una base de pruebas separada, nunca con datos de trabajo o producción.

GitHub Actions ejecuta `npm run check` cuando el proyecto esté en GitHub.
Describe cada entrega con el problema, el resultado y la evidencia de verificación.
No desactives comprobaciones para conseguir que la entrega pase.

## Compatibilidad

TypeScript 5.9 y ESLint 9 mantienen compatibilidad con Node 22.13 y
typescript-eslint. Antes de actualizar versiones mayores, comprueba los rangos
soportados y ejecuta todas las verificaciones. No ocultes conflictos de dependencias
con `--force` o `--legacy-peer-deps`.
