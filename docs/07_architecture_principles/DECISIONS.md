# Decisiones de arquitectura (DEC-NN)

Registro de las decisiones que condicionan el diseño de cualquier HU. Las consultan `/prd-writer` (sección *Decisiones
aplicables*), `/tech-design` y `/reviewer`. Una decisión nueva o un cambio abre el siguiente `DEC-NN`; las antiguas no
se borran: se marcan `Sustituida por DEC-NN`.

Formato: **Contexto · Decisión · Alternativas · Consecuencias · Estado**.

---

## DEC-01 · Stack TypeScript: Fastify, `node:sqlite` y React + Vite

- **Contexto.** Repo de taller que tiene que arrancar en portátiles ajenos (macOS, Linux y Windows) sin servicios
  externos ni binarios que compilar, y ser legible en una demo de 2 horas.
- **Decisión.** TypeScript estricto en todo el repo. API con **Fastify 5** (validación con JSON Schema por ruta y
  `fastify.inject` para tests). Persistencia con **`node:sqlite`** (`DatabaseSync`) sobre `data/ats.db`. Web con
  **React 19 + Vite**. Tests con **Vitest** (api y web) y **Playwright** solo con Chromium (e2e). La API ejecuta
  TypeScript directamente con el *type stripping* de Node 24 (sin paso de compilación).
- **Alternativas.** Express (sin validación por esquema de serie); `better-sqlite3` (binario nativo que compila en la
  instalación y falla en portátiles sin toolchain); Postgres en Docker (requisito de más para el asistente); Next.js
  (más conceptos de los que la demo necesita).
- **Consecuencias.** Requiere **Node 24 LTS ≥ 24.15** ([SETUP.md](../SETUP.md)). `node:sqlite` es síncrono: basta para
  un único usuario local. Errores de la API con envelope uniforme `{ error: { code, message, details? } }`.
- **Estado.** Aceptada (2026-10-06).

## DEC-02 · Monorepo con npm workspaces

- **Contexto.** API, web y e2e comparten versiones de TypeScript, ESLint y Prettier, y el asistente tiene que
  arrancarlo todo con un comando.
- **Decisión.** Un único repo con **npm workspaces** (`apps/api`, `apps/web`) y `e2e/` en la raíz. Scripts raíz:
  `dev`, `build`, `test`, `typecheck`, `lint`, `format`, `e2e`, `db:reset`, `check:env` y `check:harness`.
- **Alternativas.** pnpm o Turborepo (otra herramienta que instalar); dos repos (rompe la HU vertical).
- **Consecuencias.** Un solo `package-lock.json`; los comandos acotados usan `-w apps/<app>`.
- **Estado.** Aceptada (2026-10-06).

## DEC-03 · La base de datos `.db` no se versiona

- **Contexto.** Un fichero binario en git provoca conflictos en cada merge y arrastra datos de una etiqueta a otra.
- **Decisión.** Se versionan `apps/api/src/db/schema.sql`, las migraciones (`apps/api/src/db/migrations/NNN-descripcion.sql`)
  y el seed (`apps/api/src/db/seed.ts`). `npm run db:reset` regenera `data/ats.db` desde cero. `.gitignore` excluye
  `data/*.db`. Los e2e usan su propia base (`data/e2e.db`).
- **Alternativas.** Versionar la `.db` (conflictos binarios); crear el esquema desde el código en el arranque (oculta
  el historial de cambios del modelo).
- **Consecuencias.** Toda HU que cambie el modelo añade una migración nueva; nunca se edita una ya comiteada. El seed
  usa **solo datos inventados**.
- **Estado.** Aceptada (2026-10-06).

## DEC-04 · Sin login: un único rol, «reclutador»

- **Contexto.** El taller enseña el flujo SDD, no autenticación; un login añade pantallas, secretos y casos límite que
  no aportan a la demo.
- **Decisión.** No hay autenticación ni autorización por usuario. Toda la aplicación la usa un único rol,
  **«reclutador»**, que puede gestionar ofertas, candidatos e inscripciones. La API escucha solo en `127.0.0.1`.
- **Alternativas.** Login local con sesión (más superficie y más tiempo de demo); roles reclutador/administrador
  (duplica casos de uso sin enseñar nada nuevo del flujo).
- **Consecuencias.** Los PRD no declaran permisos por rol; la categoría «seguridad» de los edge cases se centra en
  exposición de datos personales, inyección, enumeración y abuso de tamaño. Si una feature necesitara roles, abriría
  un `DEC-NN` nuevo.
- **Estado.** Aceptada (2026-10-06).

## DEC-05 · Dependencias de desarrollo añadidas y TypeScript 6.0.x

- **Contexto.** El plan fija como dependencias `fastify`, `react`, `react-dom` y `vite`; en desarrollo, `typescript`,
  `vitest`, `@testing-library/react`, `jsdom`, `@playwright/test`, `eslint`, `typescript-eslint` y `prettier`, más los
  plugins imprescindibles. Cualquier otra se justifica aquí.
- **Decisión.** Se añaden, solo en desarrollo:
  - `@types/node`, `@types/react`, `@types/react-dom`: tipos de Node y React para el modo `strict`.
  - `@eslint/js` y `globals`: configuración base de ESLint *flat config* y globales de Node y navegador.
  - `@testing-library/dom`: dependencia *peer* obligatoria de `@testing-library/react` 16.
  - `eslint-plugin-react-hooks`: reglas de hooks de React (plugin imprescindible).
  - `@vitejs/plugin-react`: plugin de React para Vite (plugin imprescindible).

  Y se fija **TypeScript 6.0.3**: `typescript-eslint` 8.71 exige `typescript < 6.1`, así que la 7.x todavía no es
  compatible con el lint. Fuente: el `package.json` publicado de `typescript-eslint@8.71.1` declara
  `peerDependencies.typescript: ">=4.8.4 <6.1.0"` (`npm view typescript-eslint@8.71.1 peerDependencies`, consultado
  el 2026-10-06, cuando la última de TypeScript era la 7.0.2).
- **Alternativas.** TypeScript 7.x sin lint de tipos (perdemos `typescript-eslint`); ESLint sin plugin de hooks (deja
  pasar errores de React que la review tendría que cazar a mano).
- **Consecuencias.** Las versiones van fijadas (sin `^`) en los `package.json`. Subir TypeScript a 7.x queda pendiente
  de que `typescript-eslint` lo soporte; se hará con un `DEC-NN` nuevo.
- **Estado.** Aceptada (2026-10-06).

## DEC-06 · Colaboración entre módulos: operaciones internas en una sola transacción

- **Contexto.** El shaping de FEAT-01..03 dejó dos efectos que cruzan módulos: cerrar una oferta rechaza sus
  inscripciones activas (RV-05, S-10) y crear o cerrar inscripciones recalcula la retención del candidato (S-06).
  Las dos operaciones tienen que ser todo o nada.
- **Decisión.**
  - Cada módulo es **dueño de sus tablas**; ningún otro escribe en ellas ni las consulta con SQL.
  - Un efecto en otro módulo se pide con una **operación interna** (función exportada, no HTTP) del módulo dueño,
    que el iniciador llama **dentro de su transacción** de `node:sqlite` (`BEGIN … COMMIT`, `ROLLBACK` ante cualquier
    error).
  - Una lectura de otro módulo va por un **puerto** (interfaz) que define el módulo que la necesita y que implementa el
    dueño de los datos. Hoy hay dos:
    - **Procesos del candidato:** lo define `candidatos` (fórmula de retención, S-06) y lo implementa `inscripciones`.
    - **Estado de la oferta:** lo define `inscripciones` (inscribir solo en `published`, RV-17 y UC-14 · E1; pipeline en
      solo lectura de una oferta `closed`, S-18) y lo implementa `ofertas`.
  - Dirección de dependencias, sin ciclos: `ofertas → inscripciones → candidatos` es la dirección de las llamadas que
    compone `apps/api/src/app.ts`; los puertos los implementa el módulo de la izquierda y se conectan allí. **Ningún
    módulo importa a otro**, tampoco sus tipos: la implementación cumple el puerto por tipado estructural y `app.ts`
    lo comprueba al conectarla.
  - **Las claves foráneas entre tablas de módulos distintos son integridad referencial de la base, no un acoplamiento
    de código.** Las declara la migración del módulo dueño de la tabla que referencia (p. ej.,
    `003-create-applications.sql`: `applications.candidate_id → candidates.id` y `applications.job_id →
    job_openings.id`, con `ON DELETE RESTRICT`) y no autorizan a ningún módulo a consultar ni escribir con SQL las
    tablas de otro.
- **Alternativas.** Eventos en proceso (consistencia eventual y más piezas para una demo); SQL directo entre módulos
  (acoplamiento y transacciones repartidas); endpoints HTTP internos (sin transacción común).
- **Consecuencias.** Cada efecto cruzado tiene un test que inyecta un fallo y comprueba que no queda nada a medias.
  `candidatos` no importa nada de los otros dos módulos, e `inscripciones` no importa nada de `ofertas`: lee el estado
  de la oferta por su puerto. HU-04 implementa los dos puertos; hasta entonces, `ofertas` no los necesita.
- **Estado.** Aceptada (2026-10-06); ampliada con el puerto «estado de la oferta» en la revisión de paso-1; aclarada en el diseño de HU-04 (claves foráneas entre módulos; ningún módulo importa a otro).

## DEC-07 · Códigos HTTP y validación de la API

- **Contexto.** Las features reparten 400, 404 y 409 en muchos flujos; sin una convención, cada PRD los decidiría de
  una forma distinta.
- **Decisión.**
  - **400** · validación: JSON Schema estricto de Fastify (`additionalProperties: false`). Un campo desconocido o de
    solo lectura (p. ej., el fin de retención) también es 400 (S-03). `details` lista los campos con error.
  - **404** · el recurso no existe; el mensaje no incluye datos personales.
  - **409** · conflicto de estado: duplicado (con el ID del existente en `details`: RV-10, S-14), transición o
    precondición de estado no permitida (p. ej., cerrar un borrador o inscribir en una oferta no publicada) y etapa
    esperada distinta de la actual (RV-22).
  - **200** · lectura, edición y repetición idempotente de una acción ya aplicada (S-01); **201** · creación;
    **204** · borrado.
  - `error.code` en `SCREAMING_SNAKE_CASE` (`VALIDATION_ERROR`, `NOT_FOUND`, `DUPLICATE`, `INVALID_TRANSITION`,
    `STAGE_MISMATCH`…); el PRD de cada HU fija los suyos.
- **Alternativas.** 422 para validación de negocio (más códigos que explicar en la demo); 400 para todo (los tests no
  distinguen un duplicado de un dato inválido).
- **Consecuencias.** Los criterios de aceptación de los PRD citan el código esperado, y cada uno tiene su test.
- **Estado.** Aceptada (2026-10-06).

## DEC-08 · Concurrencia e idempotencia

- **Contexto.** Un único usuario local (DEC-04), pero con doble clic, reintentos y varias pestañas (S-01, S-02, RV-22,
  RV-23).
- **Decisión.**
  - **Ediciones de campos:** gana la última escritura.
  - **Transiciones de estado** (publicar, cerrar, cambiar de etapa): se comprueba el estado actual dentro de la
    transacción; si no la permite, 409.
  - **Cambio de etapa:** control optimista con la etapa esperada (RV-22).
  - **Repetición de una acción ya aplicada:** 200 sin cambios, sin tocar fechas ni crear `StageChange` (S-01; prevalece
    RV-23 sobre RV-22).
  - **Unicidad** (email del candidato, pareja candidato-oferta): la garantiza un índice único en la base, no solo una
    comprobación previa; el choque se traduce a 409.
- **Alternativas.** Versión optimista en todas las ediciones (más carga en formularios sin beneficio con un único
  usuario); bloqueos explícitos (innecesarios con `node:sqlite` síncrono).
- **Consecuencias.** Los edge cases de concurrencia e idempotencia de los PRD se prueban contra estas reglas.
- **Estado.** Aceptada (2026-10-06).

## DEC-09 · Fechas, zona horaria y reloj

- **Contexto.** La retención vence por día natural en Europe/Madrid (RV-25) y suma meses con fechas que no existen
  (S-06); los casos límite de fecha tienen que ser comprobables.
- **Decisión.**
  - Los instantes se guardan en UTC como texto ISO 8601; la interfaz los muestra en Europe/Madrid con formato
    `dd/mm/aaaa` (y la hora cuando aplique).
  - El **fin de retención** es una fecha de calendario (`AAAA-MM-DD`) de Europe/Madrid. Sumar meses a una fecha que no
    existe en el mes destino da el último día de ese mes.
  - El **reloj se inyecta** (`now()` como dependencia) en la API, para fijar la fecha en los tests.
- **Alternativas.** Guardar en hora local (ambigüedad en los cambios de hora); librerías de fechas (dependencia más:
  `Intl` y aritmética propia bastan).
- **Consecuencias.** Hay tests de frontera de fecha (cambio de día entre UTC y Madrid, 31/08 + 6 meses, año bisiesto)
  sin depender del reloj real.
- **Estado.** Aceptada (2026-10-06).

## DEC-10 · Listados: paginación y búsqueda

- **Contexto.** Ofertas y candidatos se listan con filtros y paginación (RV-08, RV-14, S-04).
- **Decisión.** Parámetros `page` (desde 1) y `pageSize` (por defecto 20, máximo 100; más de 100 da 400). Respuesta
  `{ items, total, page, pageSize }`. La búsqueda de texto ignora mayúsculas y tildes (normalización Unicode NFD sin
  diacríticos) en el servidor. Orden estable con desempate por ID. Los listados devuelven solo los campos de la lista,
  no la ficha completa (minimización, `docs/RGPD.md` §6).
- **Alternativas.** Paginación por cursor (innecesaria con el volumen del taller); búsqueda en el cliente (no escala y
  obliga a enviar datos personales de más).
- **Consecuencias.** Los dos listados comparten forma de respuesta y tests de frontera (página vacía, 20 y 21
  elementos, `pageSize` 100 y 101).
- **Estado.** Aceptada (2026-10-06).

## DEC-11 · Convenciones de validación y errores de la API

- **Contexto.** DEC-07 pide un esquema estricto (un campo desconocido o de solo lectura da 400) y S-03 pide recortar
  los espacios antes de validar. **La configuración de Ajv que Fastify 5 trae por defecto no lo cumple, y en
  silencio**: con `removeAdditional: true` quita los campos desconocidos sin dar error (un `status: "published"` en el
  alta desaparecería y se crearía el borrador), y con `coerceTypes: 'array'` acepta `"40000"` como entero. Lo comprobó
  el diseño de HU-01 ejecutando Fastify 5.12.5 en Node 24: sin cambiarla, EC-02, EC-11 y EC-34 de su PRD fallarían.
  Además, la web muestra el `message` de la API junto a cada campo.
- **Decisión.**
  1. Ajv con `coerceTypes: false`, `removeAdditional: false` y `allErrors: true`.
  2. Los numéricos de `params` y `querystring` se declaran como `string` con `pattern` y se convierten en la ruta.
  3. Los textos se recortan en el hook `preValidation`; un texto opcional que queda vacío pasa a `null`.
  4. `details` es `[{ field, message }]`, con mensajes en castellano por *keyword* y **sin repetir el valor
     recibido**, y está **acotado al esquema**: como mucho un elemento por campo declarado en el esquema de la parte
     validada (`body`, `querystring` o `params`) más uno para todas las claves no declaradas juntas, que sale como
     `{ field: 'body' }` o `{ field: 'querystring' }` con «Hay campos no permitidos.» y **sin el nombre de ninguna**.
     Los campos de solo lectura que la API nombra (`id`, fechas, estado, `retentionEndsAt`…) se declaran en el
     esquema con el esquema `false` y salen con su nombre y «Campo no permitido.». En un 409 `DUPLICATE`, el elemento
     lleva además `existingId` con el ID del existente (DEC-07).
  5. Códigos adicionales a los de DEC-07: `INTERNAL_ERROR` (500), `PAYLOAD_TOO_LARGE` (413),
     `UNSUPPORTED_MEDIA_TYPE` (415) y `BAD_REQUEST` (otros 4xx). Todos en el envelope de DEC-01, sin *stack traces*.
  6. Reloj `Clock = () => Date` inyectado en `buildApp({ now })` (concreta DEC-09).
  7. Transacciones con `withTransaction(db, fn)`, que se une a una en curso (concreta DEC-06).
  8. **Caracteres de control:** los textos rechazan con 400 los caracteres de control C0 (U+0000-U+001F) y DEL
     (U+007F); los textos largos (descripción de una oferta, resumen de un candidato) admiten salto de línea,
     retorno de carro y tabulador. Añadido en la review de HU-01: un NUL embebido pasaba Ajv (que cuenta puntos
     de código) y hacía fallar el `CHECK` de longitud de SQLite (cuyo `length()` corta en el NUL), así que la
     API respondía 500 en lugar de 400.
- **Alternativas.** Compilar los validadores con `ajv` como dependencia directa, o `ajv-errors` para los mensajes (una
  dependencia más en los dos casos, DEC-05); validar en los servicios (duplica las reglas del esquema).
- **Consecuencias.** Toda ruta nueva declara sus numéricos de `params` y `querystring` como texto con `pattern` (p. ej.,
  `page` y `pageSize` en HU-02). Ningún servicio construye respuestas de error: lanza un error tipado y un único
  manejador lo traduce. Las HU siguientes reutilizan el manejador de errores, el recorte, `withTransaction` y las
  utilidades de test. Cada HU con esquema estricto tiene un test de «campo desconocido → 400» y otro de «número como
  texto → 400».
- **Estado.** Aceptada (2026-10-06), en el diseño de HU-01; punto 8 añadido en la review de HU-01 (ronda 1);
  punto 4 enmendado en el diseño de HU-03.

## DEC-12 · Escrituras desde otro sitio: 403 por `Sec-Fetch-Site`

- **Contexto.** El ATS no tiene login (DEC-04) y su API escucha en `127.0.0.1`. Al diseñar HU-02 apareció que publicar,
  cerrar y duplicar una oferta son `POST` **sin cuerpo**: para el navegador son peticiones «simples», que se envían sin
  *preflight* de CORS. Cualquier página que el reclutador abra en otra pestaña podría lanzarlas contra
  `http://127.0.0.1:3001` (CSRF) y cerrar ofertas sin que él lo sepa. `PATCH`, `DELETE` y los `POST` con JSON ya exigen
  *preflight*, y sin cabeceras CORS el navegador los bloquea. Un `POST` simple con cuerpo `text/plain` sí llega, pero
  Fastify lo entrega como texto y la API lo rechaza con 400 (el esquema exige un objeto JSON, o `rejectBody` en las
  acciones sin cuerpo); `application/x-www-form-urlencoded` y `multipart/form-data` dan 415 (DEC-11.5).
- **Decisión.** La API rechaza con **403 `CROSS_SITE_REQUEST`** («Petición no permitida desde otro sitio.», en el
  envelope de DEC-01 y sin datos) **toda petición cuyo método no sea `GET`, `HEAD` ni `OPTIONS`** si la cabecera
  `Sec-Fetch-Site`, en minúsculas y sin espacios, no vale `same-origin` ni `none`. Si la cabecera falta (tests con
  `fastify.inject`, clientes que no son navegador), se deja pasar. Se aplica en un único hook registrado en `buildApp`
  antes de los módulos, y lo fijan tests de `cross-site`, `same-site` y de un método de escritura no listado.
  - **Por qué `same-site` no basta en local.** «Mismo sitio» compara el dominio registrable, no el puerto: cualquier
    otra aplicación servida en otro puerto de `127.0.0.1` o `localhost` (otro servidor de desarrollo, una herramienta
    local) llega como `same-site` y podría lanzar las mismas peticiones. La web del ATS siempre llega como
    `same-origin`, porque va por el proxy de Vite.
  - **Por qué una lista de métodos seguros y no de métodos de escritura.** Así un método nuevo (`PUT`) que añada otra HU
    queda protegido sin tocar el hook.
- **Alternativas.** Token CSRF (exige sesión, que no hay); comprobar `Origin` o `Referer` (más casos que explicar y
  `Origin` falta en algunos `POST` simples); exigir un `Content-Type` JSON en las acciones (rompe la convención de
  «sin cuerpo» de HU-02 y no protege otras escrituras futuras); aceptar `same-site` (deja abierto el caso de otro puerto
  local).
- **Consecuencias.** La web no cambia. Cada HU que añada escrituras hereda la protección sin hacer nada. Un navegador
  antiguo sin `Sec-Fetch-Site` no estaría protegido; se acepta para un taller local.
- **Estado.** Aceptada (2026-10-06), en el diseño de HU-02 (OD-01); enmendada en la review de HU-02 (ronda 1): lista de
  métodos seguros, `same-site` rechazado y código `CROSS_SITE_REQUEST` nombrado.
