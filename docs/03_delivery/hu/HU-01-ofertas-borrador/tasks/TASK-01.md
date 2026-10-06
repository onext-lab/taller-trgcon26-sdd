# TASK-01 — Base transversal de la API: Ajv estricto, envelope de errores, reloj y transacciones [setup]

## Metadata
- **HU:** HU-01 · **Feature:** FEAT-01
- **Scope:** backend
- **Estado:** Pendiente
- **Prioridad:** Must (bloquea todo el backend)
- **Complejidad:** L (2–4 h; estimada 3,5 h)

## Descripción
Crea las piezas transversales de DEC-11 que usarán esta HU y las HU-02 a HU-05, sin todavía ninguna ruta de negocio:

1. Configuración de Ajv estricta en `buildApp` (sin coerción, sin quitar campos sobrantes, todos los errores).
2. `AppError` y sus factorías para los errores de dominio.
3. Un único manejador de errores (`setErrorHandler` + `setNotFoundHandler`) que construye **siempre** el envelope de
   DEC-01, también para 404 de ruta, JSON malformado, 413, 415 y 500, con mensajes en castellano por *keyword* de Ajv.
4. `trimTextFields` (recorte previo a la validación) e `idParamsSchema` (ID de ruta como texto con `pattern`).
5. Reloj inyectable `Clock` en `buildApp({ now })` (DEC-09).
6. `withTransaction(db, fn)`, que se une a una transacción en curso (DEC-06).
7. Utilidades de test `createTestApp` y `createTestClock`.

`apps/api/test/health.test.ts` y `apps/api/test/logger.test.ts` deben seguir en verde **sin tocarlos** (la firma de
`buildApp` sigue siendo compatible).

## Archivos afectados

| Archivo | Cambio | Descripción |
|---|---|---|
| `apps/api/src/clock.ts` | crear | `export type Clock = () => Date` y `export const systemClock: Clock` (~10 líneas) |
| `apps/api/src/errors.ts` | crear | `AppError`, `ErrorDetail`, `notFound(message)`, `validationError(details)` (~40) |
| `apps/api/src/http/validation.ts` | crear | `ajvOptions`, `idParamsSchema`, `type IdParams`, `trimTextFields` (~50) |
| `apps/api/src/http/error-handler.ts` | crear | `registerErrorHandling(app)` y traducción de errores de Ajv y Fastify al envelope (~120) |
| `apps/api/src/db/transaction.ts` | crear | `withTransaction(db, fn)` (~25) |
| `apps/api/src/app.ts` | modificar | `ajv: ajvOptions` en `Fastify(...)`, `registerErrorHandling(app)` **antes** de cualquier ruta, `now?: Clock` en `AppOptions` |
| `apps/api/test/helpers/test-app.ts` | crear | `createTestApp({ now? })` y `createTestClock(iso)` |
| `apps/api/test/http/error-handler.test.ts` | crear | Tests del envelope (RNF-03) y de los mensajes por *keyword* |
| `apps/api/test/db/transaction.test.ts` | crear | Tests de `withTransaction` (DD-11) |

## Implementa
- RF: base de RF-01 a RF-06 (envelope y validación) · RNF: RNF-03 · Edge cases: EC-38 (lado API: 500 en el envelope)
- Decisiones: DEC-11 (puntos 1 a 7), DEC-01, DEC-07, DEC-09
- Diseño: `plans/TECHNICAL_DOC-backend.md` § Enfoque técnico, § Contrato de API › Convenciones y Envelope de error,
  § Firmas internas, DD-01, DD-02, DD-03, DD-06, DD-10, DD-11, DD-13, § Estrategia de tests

## Dependencias
- **Depende de:** nada
- **Bloquea:** TASK-02 (y, por cadena, todo el backend)

## Criterios de done
- [ ] Una ruta `/api` inexistente responde 404 `{ error: { code: "NOT_FOUND", message: "El recurso no existe." } }`.
- [ ] JSON malformado, y cuerpo vacío con `Content-Type: application/json`, responden 400 `VALIDATION_ERROR` con
      `message` «El cuerpo de la petición no es JSON válido.» y
      `details: [{ field: "body", message: "Debe ser un objeto JSON." }]`.
- [ ] `Content-Type: application/x-www-form-urlencoded` en un `POST` responde 415 `UNSUPPORTED_MEDIA_TYPE`.
- [ ] Un error no controlado responde 500 `INTERNAL_ERROR` «Error interno. Inténtalo de nuevo.», sin *stack* ni texto
      interno en la respuesta, y queda registrado en el log con `request.log.error`.
- [ ] Los mensajes de `details` siguen la tabla de *keywords* de abajo, un elemento por campo y sin repetir el valor
      recibido.
- [ ] `withTransaction` confirma, deshace y relanza ante error, y se une a una transacción en curso.
- [ ] `npm test -w apps/api -- error-handler transaction health logger` en verde, con **4** ficheros de test
      ejecutados.
- [ ] `npm run typecheck` sin errores.
- [ ] `npx eslint apps/api/src/clock.ts apps/api/src/errors.ts apps/api/src/http/validation.ts apps/api/src/http/error-handler.ts apps/api/src/db/transaction.ts apps/api/src/app.ts apps/api/test/helpers/test-app.ts apps/api/test/http/error-handler.test.ts apps/api/test/db/transaction.test.ts`
      sin errores.
- [ ] Ficheros ≤ 300 líneas y funciones ≤ 50 líneas.
- [ ] Commit único `feat(api): strict Ajv, error envelope, clock and transactions [HU-01 TASK-01]` nombrando los
      ficheros (`git add -- <paths>`; nunca `git add -A`).

## Notas de implementación

**Ajv (DEC-11.1, DD-02).** Con la configuración por defecto de Fastify 5.12.5, un campo desconocido se **quita en
silencio** (`removeAdditional: true`) y `"40000"` se **convierte** a entero (`coerceTypes: 'array'`). Hay que cambiarla:

```ts
// apps/api/src/http/validation.ts
export const ajvOptions = { customOptions: { coerceTypes: false, removeAdditional: false, allErrors: true } };
// apps/api/src/app.ts → Fastify({ logger, ajv: ajvOptions })
```

No añadas `ajv` ni `ajv-errors` como dependencia (DEC-05). Ajv cuenta longitudes en puntos de código (`unicode: true`
es su valor por defecto): «🎨» cuenta 1.

**IDs de ruta** (sin coerción llegan como texto; se convierten con `Number()` en la ruta):

```ts
export const idParamsSchema = { type: 'object', additionalProperties: false, required: ['id'],
  properties: { id: { type: 'string', pattern: '^[1-9][0-9]{0,14}$' } } } as const;
export type IdParams = { id: string };
```

**`trimTextFields(body, { trim, emptyToNull })`** (DD-01): genérico, para usar en un hook `preValidation`. Solo actúa si
`body` es un objeto JSON (no `null`, no array). Recorta con `String.prototype.trim` las claves de `trim` que sean
`string`; las claves de `emptyToNull` que queden `""` pasan a `null`. No toca valores que no sean `string`. En `jobs`
se usará con `trim: ['title', 'description', 'location']` y `emptyToNull: ['description', 'location']` (TASK-03).

**`AppError`** (DD-10): `code`, `statusCode`, `message` y `details?`. **Sin *parameter properties*** en el
constructor (no son sintaxis borrable con `erasableSyntaxOnly`): declara los campos y asígnalos en el cuerpo.

```ts
export interface ErrorDetail { field: string; message: string }
notFound(message)          // → AppError('NOT_FOUND', 404, message)
validationError(details)   // → AppError('VALIDATION_ERROR', 400, 'Hay campos con errores.', details)
```

**Envelope** (único sitio que lo construye: `registerErrorHandling(app)`, llamado en `buildApp` antes de registrar
módulos para que lo hereden):

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Hay campos con errores.",
             "details": [{ "field": "title", "message": "Debe tener al menos 3 caracteres." }] } }
```

| HTTP | `code` | `message` | Cuándo |
|---|---|---|---|
| 400 | `VALIDATION_ERROR` | «Hay campos con errores.» | Falla el JSON Schema de `body`, `params` o `querystring`, o un `AppError` de validación del servicio |
| 400 | `VALIDATION_ERROR` | «El cuerpo de la petición no es JSON válido.» (`details: [{ field: "body", … }]`) | JSON malformado, o vacío con `Content-Type: application/json` |
| 404 | `NOT_FOUND` | el del `AppError` (p. ej. «La oferta no existe.») | `AppError` `NOT_FOUND` |
| 404 | `NOT_FOUND` | «El recurso no existe.» | Ruta o método inexistente (`setNotFoundHandler`) |
| 413 | `PAYLOAD_TOO_LARGE` | «El cuerpo de la petición es demasiado grande.» | Cuerpo > 1 MiB (`bodyLimit` por defecto) |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | «Tipo de contenido no admitido.» | `Content-Type` sin parser |
| 4xx | `BAD_REQUEST` | «La petición no es válida.» | Cualquier otro error 4xx de Fastify (mismo `statusCode`) |
| 500 | `INTERNAL_ERROR` | «Error interno. Inténtalo de nuevo.» | Cualquier otro error (SQLite incluido); `request.log.error({ err: error }, …)` |

- `details` **solo** en `VALIDATION_ERROR`, **un elemento por campo** (el primer error de ese campo).
- `field`: para `additionalProperties`, la propiedad sobrante (`params.additionalProperty`); para `required`, la que
  falta (`params.missingProperty`); si no, el primer segmento de `instancePath` sin la barra; si el error es de la parte
  entera (p. ej. `type: object` o `minProperties`), `error.validationContext` (`body`, `params` o `querystring`).
- Ningún `message` repite el valor recibido ni incluye SQL, rutas de fichero o *stack traces*. **Nunca** registres
  `request.body` en el log; solo los 500 se registran, con el objeto de error.

**Mensajes por *keyword*** (DD-03):

| Keyword | `message` |
|---|---|
| `required` | «Es obligatorio.» |
| `additionalProperties` | «Campo no permitido.» |
| `minLength` / `maxLength` | «Debe tener al menos {n} caracteres.» / «Debe tener como máximo {n} caracteres.» |
| `enum` | «Debe ser uno de estos valores: {valores no nulos separados por «, »}.» (p. ej. «…: presencial, híbrida, remota.») |
| `type` | `integer` → «Debe ser un número entero.»; `string` → «Debe ser un texto.»; `object` → «Debe ser un objeto JSON.»; otro → «Tipo de dato no válido.» |
| `exclusiveMinimum` / `minimum` / `maximum` | «Debe ser mayor que {n}.» / «Debe ser mayor o igual que {n}.» / «Debe ser menor o igual que {n}.» |
| `minProperties` | «Envía al menos un campo.» (`field: "body"`) |
| `pattern` / `format` | «Formato no válido.» |
| cualquier otro | «Valor no válido.» |

Gotchas:
- Con `type: ["integer", "null"]`, Ajv informa el tipo esperado como lista (según versión, array o cadena con comas):
  usa el primer tipo distinto de `null` para elegir el mensaje.
- JSON malformado o vacío: `details: [{ field: "body", message: "Debe ser un objeto JSON." }]` (el mismo mensaje que
  `type: object` da a un cuerpo `[]` o `"x"`). El diseño solo fijaba `field`; el `message` lo decidió el team-lead el
  2026-10-06.
- Identifica el JSON malformado y el vacío por el error de Fastify (`FST_ERR_CTP_EMPTY_JSON_BODY` para el vacío; el
  malformado llega como error 400 del parser JSON). Fíjalo con un test contra Fastify 5.12.5, no de memoria.
- Un `AppError` se traduce tal cual (`code`, `statusCode`, `message`, `details`); cualquier error sin `statusCode`
  4xx es 500.

**Reloj** (DD-06): `AppOptions { db: DatabaseSync; logger?: FastifyServerOptions['logger']; now?: Clock }`, con
`systemClock` por defecto. En esta tarea nadie lo usa aún (lo pasa TASK-03 al servicio): si ESLint marca `now` como no
usado al desestructurarlo, déjalo solo en la interfaz hasta TASK-03.

**`withTransaction<T>(db: DatabaseSync, fn: () => T): T`** (DD-11): si `db.isTransaction`, ejecuta `fn()` sin abrir
otra; si no, `db.exec('BEGIN IMMEDIATE')`, `fn()`, `COMMIT`; ante error, `ROLLBACK` y relanza el error original.

**Utilidades de test** (`apps/api/test/helpers/test-app.ts`):
- `createTestApp({ now? })` → `{ app, db }` sobre `openDatabase(':memory:')` + `migrate(db)` + `buildApp({ db, now })`.
  Quien la use cierra con `await app.close()` en `afterEach`.
- `createTestClock(iso)` → `{ now, set(iso), advance(ms) }` (para fijar y escalonar `createdAt`).
- TASK-02 añadirá `failWrites` y TASK-03 `createJob`.

**Tests** (nombres del diseño):
- `apps/api/test/http/error-handler.test.ts`: «ruta /api inexistente → 404», «JSON malformado → 400», «Content-Type no
  admitido → 415», «error no controlado → 500 sin stack ni mensaje interno y registrado en el log», «mensajes por
  keyword». Para probar Ajv sin rutas de negocio, registra en el propio test, antes de `inject`, una ruta auxiliar con
  un esquema que cubra cada *keyword*, y otra que lance un `Error('detalle interno')`. Para el log, `buildApp` con
  `logger: { ...loggerOptions, stream }` como en `apps/api/test/logger.test.ts`.
- `apps/api/test/db/transaction.test.ts`: «confirma», «deshace y relanza ante error», «se une a una transacción en
  curso» (con una tabla temporal creada en el test sobre `:memory:`).
- No uses `vi.useFakeTimers()` (congela los temporizadores de Fastify): el reloj se inyecta.
