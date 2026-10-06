# TASK-07 — Edición en la API y datos personales en logs y errores [adversarial]

## Metadata
- **HU:** HU-03 · **Feature:** FEAT-02
- **Scope:** test
- **Capa:** api
- **Estado:** Completada
- **Prioridad:** Must (gate 4 de RF-03; CA-32 y RNF-03 transversales a RF-01 a RF-06)
- **Complejidad:** M (1–2 h; estimada 2 h)

## Descripción
Dos ficheros hostiles, aparte de los caminos felices de TASK-04 y TASK-05:
1. `apps/api/test/candidates/update-adversarial.test.ts`: concurrencia, fallo de la base y enumeración en la edición.
2. `apps/api/test/candidates/privacy-logs.test.ts`: con el logger de la app capturado (como
   `apps/api/test/logger.test.ts`), un alta, una edición, una búsqueda con `q=lucia.ferrer@example.com`, un cambio de
   consentimiento y cada error de CA-04, CA-05, CA-06 y CA-20 no dejan nombre, email, teléfono, resumen ni `q` ni en
   las líneas de log ni en los cuerpos de error (CA-32, RNF-03).

Si un caso destapa un fallo de producción, se arregla en `apps/api/src/modules/candidates/` (como mucho 2 ciclos).

## Archivos afectados

| Archivo | Cambio | Descripción |
|---|---|---|
| `apps/api/test/candidates/update-adversarial.test.ts` | crear | CA-14, EC-22, EC-23, EC-25 |
| `apps/api/test/candidates/privacy-logs.test.ts` | crear | CA-32, RNF-03, EC-33 (`q` fuera de logs) |
| `apps/api/src/modules/candidates/{service,repository,routes}.ts` | modificar solo si un caso falla | Arreglos que destape el test |

## Implementa
- RF: RF-03 · transversal a RF-01, RF-02, RF-04 y RF-06 (CA-32) · CA: CA-14, CA-32 · Edge cases: EC-22, EC-23, EC-25,
  EC-33 (logs) · RNF-03
- Diseño: `plans/TECHNICAL_DOC-backend.md` § Error paths (EC-22, EC-23, EC-25, EC-33), § Datos personales, § Threat
  modeling (Exposición), § Estrategia de tests (CA-14, CA-32 · RNF-03), § Checklist B-07

## Dependencias
- **Depende de:** TASK-04 (edición y consentimiento), TASK-05 (búsqueda con `q`)
- **Bloquea:** nada

## Criterios de done
- [ ] EC-22: dos `PATCH` a la misma ficha → gana el último (`GET` final igual al segundo cuerpo); dos candidatos que
      pasan a la vez al mismo email libre (`Promise.all`) → uno 200 y otro 409 `DUPLICATE` con el ID del primero.
- [ ] CA-14 / EC-23: `failWrites(db, 'UPDATE', { table: 'candidates' })` → 500 `INTERNAL_ERROR` sin datos personales y
      la ficha igual que antes.
- [ ] EC-25: `PATCH` a varios IDs secuenciales inexistentes → 404 con cuerpo idéntico en todos; el 409 de email nunca
      contiene el email.
- [ ] CA-32 / RNF-03: en el log capturado y en los cuerpos de error de alta, edición, búsqueda, consentimiento, 400 de
      CA-04, 409 de CA-05, 500 de CA-06 y 400 de CA-20: 0 apariciones de «Lucía Ferrer Soler», `lucia.ferrer`, el
      teléfono, el resumen ni el texto de `q`.
- [ ] Los 500 registran el objeto de error (mensajes de `CHECK`/`UNIQUE` con nombres de columna, no valores).
- [ ] `npm test -w @ats/api -- candidates/update-adversarial candidates/privacy-logs` en verde, con **2** ficheros.
- [ ] `npm test -w @ats/api -- candidates` en verde.
- [ ] `npm run typecheck` sin errores.
- [ ] `npx eslint apps/api/test/candidates/update-adversarial.test.ts apps/api/test/candidates/privacy-logs.test.ts`
      (y los de producción que se toquen) sin errores.
- [ ] Commit único `test(api): adversarial candidate edit and personal data in logs [HU-03 TASK-07]` nombrando los
      ficheros.

## Notas de implementación
- Logger capturado: `buildApp({ db, logger: { ...loggerOptions, stream } })` con un `stream` que acumula líneas
  (patrón de `apps/api/test/logger.test.ts`). `createTestApp` no admite `logger`: monta la app con `buildApp` y una
  base `:memory:` migrada en este fichero, sin cambiar el helper.
- El logger no registra cuerpos y quita la query (`apps/api/src/logger.ts`); el `path` lleva solo IDs. El test fija
  ese comportamiento para las rutas nuevas.
- Concurrencia con `Promise.all` sobre `app.inject`: `node:sqlite` es síncrono y `BEGIN IMMEDIATE` serializa; el test
  comprueba el resultado final, no el orden de llegada.
- Datos inventados con `@example.com`.
