# Aprender a desplegar tus propios proyectos

**Español** · [English](en/DEPLOYMENT.md) · [Русский](ru/DEPLOYMENT.md)

Material opcional de aprendizaje. **El deployment no forma parte de la prueba
técnica**: para entregarla, trabaja localmente y comparte tu propio repositorio
según el [README](../README.md).

Todos los recursos que configures al practicar deben pertenecer a **tu proyecto**:
repositorio, cuenta de hosting, base de datos, secretos, dominio y pipeline.
Este documento no da acceso ni instrucciones para operar la infraestructura del evaluador.

## 1. Diferencia CI y deployment

- **CI** instala dependencias y comprueba formato, tipos, pruebas y compilación.
  Puedes usar un runner alojado por GitHub; no necesitas un servidor propio.
- **Deployment** publica una versión comprobada en tu hosting y verifica que
  funcione. Requiere un destino y credenciales tuyas.

Pasar CI no publica una aplicación por sí solo. Un despliegue correcto debe
comprobar también la conexión real a su base y las rutas principales.

## 2. Empieza por CI en tu repositorio

Este proyecto ya incluye el workflow **Verificaciones**. Comprueba que se ejecute
en tu copia al subir una rama o abrir un PR. Para otro proyecto Node compatible
con los mismos scripts, un ejemplo mínimo de `.github/workflows/ci.yml` sería:

```yaml
name: CI
on: [push, pull_request]
permissions:
  contents: read
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: npm
      - run: npm ci
      - run: npm run check
```

Adapta versiones y comandos a tu proyecto y conserva el lockfile. Si tus pruebas
de integración necesitan PostgreSQL, prepara una base temporal independiente en
CI. Nunca ejecutes pruebas destructivas sobre la base publicada.

## 3. Prepara un destino que controles

Elige tu propia plataforma de hosting o servidor. Un hosting que ejecute Node.js
puede ser suficiente: **Docker no es obligatorio**. En el destino configura:

1. Tu repositorio y la rama que deseas publicar.
2. La versión de Node y el directorio de trabajo.
3. El comando de construcción: en esta base, `npm ci` y `npm run build`.
4. El comando de inicio: en esta base, `npm start`.
5. Una base PostgreSQL propia y persistente; no una base temporal de CI.
6. Las variables que necesita tu aplicación. Por ejemplo, `DATABASE_URL` como
   secreto, el `PORT` asignado por tu hosting y `HOST=0.0.0.0` si escucha por red.

Guarda secretos en la configuración segura del hosting o de tu CI. No los
incluyas en Git, imágenes, capturas ni logs. El nombre de una variable se puede
documentar en `.env.example`; su valor real no.

## 4. Separa prueba y producción

Cuando necesites dos ambientes, crea recursos independientes para cada uno:

| Recurso     | Ambiente de pruebas         | Producción                       |
| ----------- | --------------------------- | -------------------------------- |
| Aplicación  | Servicio de pruebas propio  | Servicio publicado propio        |
| Base        | Datos ficticios             | Datos operativos                 |
| Secretos    | Valores de pruebas          | Valores exclusivos de producción |
| URL         | Dirección de pruebas propia | Dirección pública propia         |
| Publicación | Validar cambios             | Publicar una versión revisada    |

Las ramas `develop` y `main` son una convención posible, no un requisito.
En tu GitHub puedes crear environments para separar secretos y restringir ramas.
Las funciones disponibles dependen del plan y de la visibilidad del repositorio.
Protege las ramas importantes con PR y verificaciones; decide quién puede publicar.

## 5. Diseña tu secuencia de publicación

Una secuencia razonable para **tu** pipeline es:

1. Ejecutar CI y detenerse si falla.
2. Construir un artefacto identificable con el SHA del commit.
3. Conservar la versión anterior y respaldar tu base si el cambio lo requiere.
4. Ejecutar las migraciones pendientes en tu base de destino.
5. Arrancar la versión comprobada en tu hosting.
6. Comprobar las rutas de salud y una operación representativa.
7. Registrar versión, resultado y URL en tu repositorio.

Con esta base, las migraciones se ejecutan con `npm run db:migrate`. Ese comando
usa `tsx`, una dependencia de desarrollo: ejecútalo en una fase de release con
las herramientas instaladas o prepara un ejecutor compilado. No asumas que estará
disponible en un runtime que instaló únicamente dependencias de producción.

Los detalles de conexión y el comando de publicación dependen de tu hosting:
usa su documentación y credenciales de alcance mínimo. Esta guía no incluye un
job de publicación listo para ejecutar contra un servidor ajeno. Si automatizas
tu despliegue, crea un workflow adaptado a tus recursos. Los archivos operativos
del repositorio original no son la plantilla de despliegue de tu solución.

## 6. Verifica y prepara recuperación

En tu URL, comprueba `/`, `/health` y `/health/db`. Revisa logs sin exponer datos
personales o secretos. Confirma persistencia después de un reinicio y separación
entre bases. HTTPS y autenticación deben configurarse antes de usar datos reales.

Si eliges un túnel, debe estar en tu propia cuenta y apuntar solo a tu servicio.
Un túnel proporciona conectividad, no autenticación de usuarios ni disponibilidad
del equipo que sirve la aplicación.

Si una migración falla, detén la publicación. Restaurar una aplicación anterior
no revierte automáticamente el esquema. Prueba la restauración de respaldos en
una base temporal y define cómo evitar pérdida de escrituras recientes.

## 7. Qué documentar en tu proyecto

- Requisitos, variables sin secretos y comandos de construcción/inicio/migración.
- Cómo se ejecutan CI y las pruebas; qué ambiente usa cada una.
- Tus URLs, reglas de publicación, verificación y recuperación.
- Limitaciones conocidas y quién administra tus recursos.

Para la prueba técnica solo necesitas los entregables del README. Esta guía es
para aprender y ampliar **tus proyectos** cuando decidas publicarlos.

## Referencias oficiales

- [CI para Node.js](https://docs.github.com/en/actions/tutorials/build-and-test-code/nodejs).
- [Deployments con GitHub Actions](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/control-deployments).
- [Environments, secretos y ramas](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments).
