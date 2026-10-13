# TASK-02 — Validar la fecha límite al crear, editar y publicar (calendario de Madrid)

## Metadata
- **HU:** HU-07 · **Feature:** FEAT-04
- **Scope:** backend
- **Capa:** api
- **Estado:** Completada
- **Prioridad:** Must (RF-01)
- **Complejidad:** L (2–4 h; estimada 3,5 h)

## Descripción
Completa RF-01 en `jobs`: la fecha límite tiene que ser un día real y no anterior a hoy en Europe/Madrid **solo si
cambia**, y un borrador con el plazo vencido no se publica. Para calcular «hoy en Madrid» sin importar `candidates`
(DEC-06), nace el módulo transversal de calendario.

1. **Calendario transversal** `apps/api/src/calendar.ts` (**nuevo**, ~55 líneas), con estas firmas exactas:

   ```ts
   export function madridCalendarDate(instant: string): string;            // movida tal cual de candidates/retention.ts (DEC-09)
   export function isCalendarDate(text: string): boolean;                  // /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/ + ida y vuelta UTC
   export function addCalendarDays(date: string, days: number): string;    // aritmética UTC sobre 'AAAA-MM-DD'
   export function formatCalendarDate(date: string): string;               // 'AAAA-MM-DD' → 'dd/mm/aaaa'
   export function isDeadlinePassed(deadline: string | null, today: string): boolean; // deadline !== null && deadline < today
   ```

   - Mueve `MADRID_DAY` y `madridCalendarDate` de `apps/api/src/modules/candidates/retention.ts` **sin cambiar su
     código**; `retention.ts` los importa de `../../calendar.ts`. Sin cambio de comportamiento: `retention.test.ts` lo
     vigila.
   - `isCalendarDate`: tras la expresión regular, `const d = new Date(0); d.setUTCFullYear(y, m - 1, day)` y
     `d.toISOString().slice(0, 10) === text` (vale para años < 100, donde `Date.UTC` suma 1900).
   - «Hoy» es siempre `madridCalendarDate(now().toISOString())`, con el reloj inyectado (DEC-09).
2. **Imports de tests** que pasan a `../../src/calendar.ts` (solo el import de `madridCalendarDate`):
   `apps/api/test/candidates/retention.test.ts`, `apps/api/test/candidates/seed.test.ts`,
   `apps/api/test/applications/seed-invariants.test.ts`.
3. **Reglas** (`apps/api/src/modules/jobs/rules.ts`), con `field: 'enrollmentDeadline'` y los textos de DT-01:

   ```ts
   export function enrollmentDeadlineDetails(value: string | null, today: string): ErrorDetail[]; // [] si null
   export function expiredDeadlineDetails(deadline: string | null, today: string): ErrorDetail[];
   ```

   | Situación | Mensaje (`details[].message`) |
   |---|---|
   | `!isCalendarDate(value)` (`2026-02-31`, `2026-13-01`, `13/10/2026`, `2026-10-13T00:00:00Z`, `<script>`) | «Introduce una fecha válida.» |
   | `value < today` | «La fecha límite no puede ser anterior a hoy.» |
   | `isDeadlinePassed(deadline, today)` al publicar | «La fecha límite de inscripción ya ha pasado.» |

4. **Servicio** (`apps/api/src/modules/jobs/service.ts`):
   - `create`: un solo `now()`; `today` sale de ese instante; `assertNoDetails([...salaryRangeDetails(…),
     ...enrollmentDeadlineDetails(input.enrollmentDeadline ?? null, today)])` (un único 400 con banda y fecha).
   - `updateJob` (orden DT-04 sin cambios: esquema → 404 → 409 → reglas): valida la fecha **solo si cambia** (DD-04):
     `patch.enrollmentDeadline !== undefined && patch.enrollmentDeadline !== null && patch.enrollmentDeadline !==
     current.enrollmentDeadline`. Solo entonces llama a `now()`. Los `details` de la fecha van detrás de los
     obligatorios y la banda, en el mismo `assertNoDetails`.
   - `publishJob`: el `noop` (ya publicada) sigue devolviendo la oferta **sin** llamar a `now()` (S-01), aunque su
     plazo haya vencido. Si no es `noop`: `const instant = now()`, `today = madridCalendarDate(instant.toISOString())`,
     `assertNoDetails([...missing, ...expiredDeadlineDetails(job.enrollmentDeadline, today)])` y
     `markPublished(id, instant.toISOString())` (un solo instante, DD-10).
5. **Docs**: `docs/_modules.md` (línea 16, transversales) añade `apps/api/src/calendar.ts`; `docs/ARCHITECTURE.md`
   (fila «Reloj y transacciones», línea 28) añade `apps/api/src/calendar.ts` («días naturales de Europe/Madrid:
   `madridCalendarDate`, `isCalendarDate`, `addCalendarDays`, `formatCalendarDate`, `isDeadlinePassed`»).
6. **Tests**:
   - `apps/api/test/calendar.test.ts` (**crear**): `isCalendarDate` (sí: `2026-10-13`, `2028-02-29`, `0050-01-01`;
     no: `2026-02-31`, `2026-13-01`, `2027-02-29`, `" 2026-10-13"`, NUL, `''`), `addCalendarDays` (cruce de mes, de
     año, `-3`, `+14`, y por los domingos de cambio de hora 29/03 y 25/10/2026), `formatCalendarDate`
     (`2026-10-13` → `13/10/2026`), `isDeadlinePassed` (`null`, igual, anterior, posterior), `madridCalendarDate` en las
     fronteras de RNF-01 (`2026-10-13T21:59:59Z` → 13; `22:00:00Z` → 14; `2026-03-28T23:00:00Z` → 29/03;
     `2026-10-25T22:59:59Z` → 25/10; `23:00:00Z` → 26/10).
   - `apps/api/test/jobs/deadline.test.ts` (**ampliar**; reloj `2026-10-13T10:00:00Z`):
     - «CA-01 … y EC-02: 2028-02-29 → 201; 2027-02-29 → 400 «Introduce una fecha válida.»» (añade al CA-01 de TASK-01
       el bisiesto y el no bisiesto).
     - «CA-02 alta con 2026-10-12 → 400 «…anterior a hoy.» y con 2026-02-31 → 400 «Introduce una fecha válida.»; 0
       ofertas».
     - «CA-04 draft: 2026-10-12 y 2026-13-01 → 400 junto al campo; la oferta igual».
     - «CA-05 published vencida: editar descripción y reenviar 2026-10-10 → 200» (EC-08, EC-23). La oferta vencida se
       crea con el reloj en un día anterior y luego `clock.set(...)` (DD-12).
     - «EC-17 la API devuelve el 400 junto al campo (`details[0].field === 'enrollmentDeadline'`)» (cubierto por
       CA-04; nombra EC-17 en el test).
   - `apps/api/test/jobs/deadline-publish-duplicate.test.ts` (**ampliar**):
     - «CA-07 publicar con 2026-10-10 → 400 con enrollmentDeadline y sigue draft; con hoy → 200».
     - «CA-07 con un obligatorio pendiente y el plazo vencido → un único 400 con los dos `details`».
     - «S-01 publicar una ya publicada con el plazo vencido → 200 igual, sin cambios».

## Archivos afectados

| Archivo | Acción | Descripción |
|---|---|---|
| `apps/api/src/calendar.ts` | Crear | Utilidades de día natural de Madrid (DD-02) |
| `apps/api/src/modules/candidates/retention.ts` | Modificar | Quita `MADRID_DAY` y `madridCalendarDate`; los importa de `../../calendar.ts` |
| `apps/api/src/modules/jobs/rules.ts` | Modificar | `enrollmentDeadlineDetails`, `expiredDeadlineDetails` y los 3 textos de DT-01 |
| `apps/api/src/modules/jobs/service.ts` | Modificar | `create`, `updateJob` (solo si cambia), `publishJob` (un instante) |
| `apps/api/test/calendar.test.ts` | Crear | Unitarios de `calendar.ts` |
| `apps/api/test/candidates/retention.test.ts` | Modificar | Import de `madridCalendarDate` |
| `apps/api/test/candidates/seed.test.ts` | Modificar | Import de `madridCalendarDate` |
| `apps/api/test/applications/seed-invariants.test.ts` | Modificar | Import de `madridCalendarDate` |
| `apps/api/test/jobs/deadline.test.ts` | Modificar | CA-01 (validación), CA-02, CA-04, CA-05, EC-02, EC-08, EC-17 |
| `apps/api/test/jobs/deadline-publish-duplicate.test.ts` | Modificar | CA-07 y S-01 con plazo vencido |
| `docs/_modules.md` | Modificar | `apps/api/src/calendar.ts` como transversal (línea 16) |
| `docs/ARCHITECTURE.md` | Modificar | Fila «Reloj y transacciones» (línea 28) |

## Implementa
- RF: RF-01 (reglas de día, «no anterior a hoy» solo si cambia, publicar con el plazo vencido) · CA: CA-01, CA-02,
  CA-04, CA-05, CA-07 · Edge cases: EC-02, EC-08, EC-17 (parte API), EC-23 (parte API) · RNF-01 (cálculo del día)
- Diseño: `plans/TECHNICAL_DOC-backend.md` § Contrato de API («Reglas del servicio», «Por endpoint»), § Firmas
  internas, DD-02, DD-03, DD-04, DD-10, DD-12, § Checklist de implementación (puntos 1 y 3)

## Dependencias
- **Depende de:** TASK-01
- **Bloquea:** TASK-03, TASK-05, TASK-06

## Criterios de done
- [ ] `npm test -w apps/api -- calendar jobs/deadline candidates/retention candidates/seed applications/seed-invariants`
      en verde (6 ficheros de test).
- [ ] `npm test -w apps/api -- module-boundaries` en verde (sin tocarlo: `../../calendar.ts` no es `modules/`).
- [ ] `npm run typecheck` sin errores.
- [ ] `npx eslint apps/api/src/calendar.ts apps/api/src/modules/candidates/retention.ts apps/api/src/modules/jobs/rules.ts apps/api/src/modules/jobs/service.ts apps/api/test/calendar.test.ts apps/api/test/jobs/deadline.test.ts apps/api/test/jobs/deadline-publish-duplicate.test.ts apps/api/test/candidates/retention.test.ts apps/api/test/candidates/seed.test.ts apps/api/test/applications/seed-invariants.test.ts`
      sin errores.
- [ ] Ningún fichero pasa de 300 líneas ni ninguna función de 50 (lo mide `npm run lint`).
- [ ] Commit único `feat(api): validate enrollment deadline on create, edit and publish [HU-07 TASK-02]`.

## Notas de implementación
- Un número u otro tipo en el campo lo para el JSON Schema («Debe ser un texto.»); más de 32 caracteres, «Debe tener
  como máximo 32 caracteres.». No los cambies (DD-03); los prueba TASK-05.
- En `updateJob`, `null` nunca se valida (quitar el plazo siempre se puede en `draft` y `published`); una `closed` da
  409 antes de llegar a las reglas (EC-09, lo prueba TASK-05).
- No llames a `now()` en el `noop` de publicar (S-01, como hoy) ni en un `PATCH` que no cambia la fecha: el instante
  solo se pide cuando hace falta.
- Comparar `'AAAA-MM-DD'` como texto es correcto (orden lexicográfico = cronológico con 4 dígitos de año).
- `seed.ts` todavía no usa `addCalendarDays`: lo usa TASK-04.
