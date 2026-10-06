# TASK-01 — Enmienda de DEC-11.4: `details` acotado al esquema, `existingId` y `forbiddenFields`, con regresión de ofertas [setup]

## Metadata
- **HU:** HU-03 · **Feature:** FEAT-02
- **Scope:** backend
- **Capa:** api
- **Estado:** Pendiente
- **Prioridad:** Must (base de RF-01 a RF-03; RNF-08; cierra SEC-04/DP-01 de HU-01 y SEC-03 de HU-02)
- **Complejidad:** L (2–4 h; estimada 3,5 h)

## Descripción
Va **la primera** de la HU: las rutas de candidatos dependen del manejador enmendado. Pasos, **en este orden**:

1. **Regresión de ofertas antes del cambio.** Escribe `apps/api/test/jobs/error-details-regression.test.ts` y
   ejecútalo **en verde con el código actual**, antes de tocar nada de producción. Fija el mapa `field → message`
   **completo** de tres respuestas de ofertas:
   - alta (`POST /api/jobs`) con varios campos inválidos más `status` y `createdAt`;
   - edición (`PATCH /api/jobs/:id`) con varios campos inválidos más `publishedAt`;
   - listado (`GET /api/jobs?page=0&pageSize=101&status=x&q=<101 caracteres>`).
2. **La enmienda** (DD-08, DD-11):
   - `apps/api/src/http/error-handler.ts`: en `toDetails`/`fieldOf`, un error `additionalProperties` deja de nombrar
     la clave: sale como `{ field: <contexto>, message: 'Hay campos no permitidos.' }` (contexto = `body`,
     `querystring` o `params`), **uno solo** para todas las claves no declaradas (lo garantiza el `Map` por campo).
     Mensajes nuevos por *keyword*: `'false schema'` → «Campo no permitido.», `maxItems` → «Debe tener como máximo
     {limit} elementos.»; en `TYPE_MESSAGES`, `boolean` → «Debe ser verdadero o falso.» y `array` (ver Notas). Un
     `ErrorDetail` con `existingId` llega tal cual al envelope.
   - `apps/api/src/errors.ts`: `ErrorDetail.existingId?: number` y la fábrica `duplicate(...)` → `AppError('DUPLICATE',
     409, message, [{ field, message, existingId }])`.
   - `apps/api/src/http/validation.ts`: `forbiddenFields(names)` → `{ [name]: false }` para cada nombre (esquema
     `false`).
   - `apps/api/src/modules/jobs/schemas.ts`: el alta y la edición declaran con `forbiddenFields` los solo lectura `id`,
     `status`, `createdAt`, `publishedAt` y `closedAt`, para que **sigan saliendo con su nombre** y «Campo no
     permitido.» (sus 400 no cambian).
   - `apps/api/test/http/error-details.test.ts` (nuevo; `error-handler.test.ts` está en 299 líneas): «claves no
     declaradas → un elemento `body` sin nombres», «querystring desconocido → `querystring`», «esquema `false` → campo
     nombrado con «Campo no permitido.»», «`details.length` ≤ propiedades + 1 con errores mezclados», «`existingId`
     pasa al envelope».
3. **Actualizar solo las 5 aserciones de claves no declaradas** (DD-11), que pasan de `{ field: '<clave>', message:
   'Campo no permitido.' }` a `{ field: 'body' | 'querystring', message: 'Hay campos no permitidos.' }`:
   - `apps/api/test/jobs/create-adversarial.test.ts:78` (fila `foo`);
   - `apps/api/test/jobs/list.test.ts:94-97` (`sort` y `foo`);
   - `apps/api/test/jobs/list-filters-adversarial.test.ts:62` (fila `sort`);
   - `apps/api/test/http/error-handler.test.ts:238` (`extra`);
   - `apps/api/test/http/error-handler.test.ts:292` (`page`).
4. **La regresión del paso 1, de nuevo en verde**, sin tocarla.
5. **DEC-11.4 en `docs/07_architecture_principles/DECISIONS.md`**: sustituye el punto 4 de DEC-11 por el texto de
   abajo, **tal cual** lo trae el TD-backend (§ Impacto en decisiones), y añade a *Estado* «punto 4 enmendado en el
   diseño de HU-03».
6. **El mensaje del commit lista las 5 aserciones con fichero:línea** (las del paso 3).

Texto nuevo del punto 4 de DEC-11 (copiar literal):

> 4. `details` es `[{ field, message }]`, con mensajes en castellano por *keyword* y **sin repetir el valor
>    recibido**, y está **acotado al esquema**: como mucho un elemento por campo declarado en el esquema de la parte
>    validada (`body`, `querystring` o `params`) más uno para todas las claves no declaradas juntas, que sale como
>    `{ field: 'body' }` o `{ field: 'querystring' }` con «Hay campos no permitidos.» y **sin el nombre de ninguna**.
>    Los campos de solo lectura que la API nombra (`id`, fechas, estado, `retentionEndsAt`…) se declaran en el
>    esquema con el esquema `false` y salen con su nombre y «Campo no permitido.». En un 409 `DUPLICATE`, el elemento
>    lleva además `existingId` con el ID del existente (DEC-07).

## Archivos afectados

| Archivo | Cambio | Descripción |
|---|---|---|
| `apps/api/test/jobs/error-details-regression.test.ts` | crear | Paso 1: regresión de ofertas, en verde antes y después |
| `apps/api/src/http/error-handler.ts` | modificar | `additionalProperties` → un elemento de contexto sin nombre; mensajes `false schema`, `maxItems`, `boolean`, `array` |
| `apps/api/src/errors.ts` | modificar | `ErrorDetail.existingId?`; `duplicate(...)` |
| `apps/api/src/http/validation.ts` | modificar | `forbiddenFields(names)` |
| `apps/api/src/modules/jobs/schemas.ts` | modificar | `...forbiddenFields(['id','status','createdAt','publishedAt','closedAt'])` en `createJobBodySchema` y `updateJobBodySchema` |
| `apps/api/test/http/error-details.test.ts` | crear | Tests de la enmienda sobre rutas de prueba |
| `apps/api/test/jobs/create-adversarial.test.ts` | modificar | Solo la fila `foo` (línea 78) |
| `apps/api/test/jobs/list.test.ts` | modificar | Solo `sort` y `foo` (líneas 94-97) |
| `apps/api/test/jobs/list-filters-adversarial.test.ts` | modificar | Solo la fila `sort` (línea 62) |
| `apps/api/test/http/error-handler.test.ts` | modificar | Solo `extra` (línea 238) y `page` (línea 292) |
| `docs/07_architecture_principles/DECISIONS.md` | modificar | Punto 4 de DEC-11 y su *Estado* |

## Implementa
- RF: base de RF-01, RF-02 y RF-03 (409 con `existingId`, solo lectura nombrados) · RNF-08 · Edge cases: EC-59 (regla)
- Diseño: `plans/TECHNICAL_DOC-backend.md` § Enfoque técnico (pieza 3), § Reglas por campo (solo lectura), § Errores
  específicos, DD-08, DD-11, § Impacto en decisiones, § Estrategia de tests › Enmienda DEC-11.4, § Checklist B-01

## Dependencias
- **Depende de:** nada
- **Bloquea:** TASK-02 (orden fijado por el aprobador), TASK-03

## Criterios de done
- [ ] **Antes de tocar producción:** `npm test -w @ats/api -- error-details-regression` en verde (1 fichero) con el
      código actual. La salida se pega en el brief.
- [ ] Enmienda aplicada en `error-handler.ts`, `errors.ts`, `validation.ts` (`forbiddenFields`) y `jobs/schemas.ts`.
- [ ] Actualizadas **solo** las 5 aserciones: `create-adversarial.test.ts:78`, `list.test.ts:94-97`,
      `list-filters-adversarial.test.ts:62`, `error-handler.test.ts:238` y `error-handler.test.ts:292`. Ninguna otra
      línea de los tests de ofertas cambia.
- [ ] **Después del cambio:** `npm test -w @ats/api -- error-details-regression` en verde, **sin haber tocado** el
      fichero desde el paso 1.
- [ ] `npm test -w @ats/api -- error-details` en verde (2 ficheros: `error-details.test.ts` y
      `error-details-regression.test.ts`).
- [ ] Siguen en verde **sin tocarlos**: `create.test.ts`, `control-chars.test.ts`, `update.test.ts` (143-206: solo
      lectura `status`, `createdAt`, `id` con su nombre), `status-rules.test.ts`, `status-rules-adversarial.test.ts`,
      `publish.test.ts`, `close.test.ts`, `delete.test.ts`, `duplicate.test.ts`, `get.test.ts`: `npm test -w @ats/api`
      completo en verde.
- [ ] `docs/07_architecture_principles/DECISIONS.md`: punto 4 de DEC-11 con el texto literal de arriba y *Estado* con
      «punto 4 enmendado en el diseño de HU-03».
- [ ] `npm run typecheck` sin errores.
- [ ] `npx eslint apps/api/src/http/error-handler.ts apps/api/src/errors.ts apps/api/src/http/validation.ts apps/api/src/modules/jobs/schemas.ts apps/api/test/http/error-details.test.ts apps/api/test/jobs/error-details-regression.test.ts apps/api/test/jobs/create-adversarial.test.ts apps/api/test/jobs/list.test.ts apps/api/test/jobs/list-filters-adversarial.test.ts apps/api/test/http/error-handler.test.ts`
      sin errores.
- [ ] Commit único `feat(api): bound validation details to the schema (DEC-11.4 amendment) [HU-03 TASK-01]` cuyo
      cuerpo **lista las 5 aserciones con fichero:línea**:
      `apps/api/test/jobs/create-adversarial.test.ts:78`, `apps/api/test/jobs/list.test.ts:94-97`,
      `apps/api/test/jobs/list-filters-adversarial.test.ts:62`, `apps/api/test/http/error-handler.test.ts:238`,
      `apps/api/test/http/error-handler.test.ts:292`.

## Notas de implementación
- **Por qué funciona el tope** (DD-08): con `additionalProperties: false` en la raíz (DEC-07), Ajv solo produce
  `instancePath` y `missingProperty` de propiedades declaradas; el resto llega como `additionalProperties`. Al agruparlo
  todo en el contexto, los `field` posibles son «propiedades declaradas + 1».
- Una propiedad con esquema `false` da *keyword* `'false schema'` e `instancePath` `/<nombre>`: `fieldOf` ya la saca por
  `instancePath`, solo falta su mensaje.
- `skills/3` sale como `skills` (ya lo hace `instancePath.split('/')[1]`).
- `duplicate`: firma sugerida `duplicate({ field, message, existingId })`; candidatos la usará con
  `field: 'email'` y «Ya existe un candidato con este email.». Nunca lleva el email ni otro dato del existente.
- **Mensaje de `array`:** el TD-backend pide un mensaje para el tipo `array`, pero no da el texto:
  «Debe ser una lista.» (confirmado en la validación humana de las tareas, 2026-10-06).
- La web de ofertas nunca envía claves no declaradas (`apps/web/src/features/jobs/list-query.ts:28-34`): la enmienda no
  cambia nada en la web.
- `/module-sync` actualizará `docs/05_modules/ofertas/technical.md` (no es de esta tarea).
