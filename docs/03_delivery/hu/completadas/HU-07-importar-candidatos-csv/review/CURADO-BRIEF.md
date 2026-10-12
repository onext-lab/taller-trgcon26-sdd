# Brief de implementación — HU-07 · curado de la review (ronda 1)

> Encargo de `/reviewer HU-07`, ronda 1: tres arreglos de código antes del veredicto. Plantilla
> `docs/_templates/BRIEF-IMPLEMENTACION.template.md` recorrida entera (R1).

## 1. Qué hay que hacer
- **Capa y builder:** `api` → `api-builder`.
- **Dónde se trabaja:** la raíz del repo, rama `hu/HU-07-importar-candidatos-csv` (no cambies de rama).
- **Lo que ya está en la rama:** TASK-01 a TASK-09 comiteadas; integración completa en verde.
- **Criterios de done:**
  1. **EC-30 (RF-04, Must), parcial en la review:** un test en `apps/api/test/candidates/import-failures-adversarial.test.ts`
     que haga fallar la lectura del ID existente tras el choque del índice (`existingIdOnDuplicate` →
     `findIdByEmail`, `apps/api/src/modules/candidates/repository.ts`) y compruebe 500 `INTERNAL_ERROR` genérico, sin
     datos personales, y 0 candidatos nuevos (todo o nada). Nombre: `EC-30 falla la lectura del existente tras el
     choque del índice → 500 y 0 creados`. Sin tocar el código de producción, salvo que el test destape un bug (en ese
     caso, para y repórtalo).
  2. **Complejidad de `toAppError`** (`apps/api/src/http/error-handler.ts:38`): HU-07 la subió de ≤ 10 a 11 con el
     `payloadTooLargeMessage ?? …`. Bájala a ≤ 10 sin cambiar el comportamiento (por ejemplo, resolviendo el texto del
     413 en una función pequeña o en quien llama). `npx eslint --rule 'complexity: [error, 10]'` sobre el fichero, sin
     errores; `apps/api/test/http/` en verde sin tocar sus tests.
  3. **DP-01 (RNF-03, CA-17):** el test «RNF-03 ningún fichero nuevo…» de `apps/api/test/candidates/import-privacy.test.ts`
     comprueba también que la carpeta `data/` de la raíz del repo no gana ficheros tras una importación válida y otra
     rechazada (listado antes y después). Si el fichero pasa de 300 líneas, pártelo en un hermano.

## 2. Invariantes que aplican
- [x] **Decisiones:** DEC-07, DEC-11 (envelope, 500 genérico) y DEC-13.
- [x] **Envelope de error** sin *stack traces* ni datos personales.
- [ ] Validación con JSON Schema: no cambia.
- [x] **SQLite parametrizado**: el fallo se inyecta con el patrón existente de los tests (triggers o *stubs*), no con SQL concatenado.
- [ ] Migraciones: no aplica.
- [x] **Datos personales:** datos inventados (`@example.com`, `+34 600 000 0xx`).
- [ ] Accesibilidad: no aplica.
- [x] **Caracteres crudos:** nunca NUL ni U+2028/U+2029.
- [x] **Reuso obligatorio:** los *helpers* de fallo de `apps/api/test/helpers/` y los patrones de `import-failures-adversarial.test.ts`.

## 3. Prohibiciones
- [x] No hagas commit. No arregles nada más. Nunca `git add -A`, `git stash`, `git push` ni cambios de rama.
- [x] Solo estos ficheros: `apps/api/test/candidates/import-failures-adversarial.test.ts`,
      `apps/api/test/candidates/import-privacy.test.ts` (o su hermano) y `apps/api/src/http/error-handler.ts`.
- [x] Nada de mutaciones del código; la sesión ya las ha hecho.

## 4. Verificación que debes PEGAR
- [x] `npm test -w apps/api -- test/candidates/import-failures-adversarial.test.ts test/candidates/import-privacy.test.ts test/http`.
- [x] `npm run typecheck -w apps/api`.
- [x] `npx eslint --rule 'complexity: [error, 10]' <ficheros tocados>`.
- [x] Los 3 criterios de done, uno a uno, con su evidencia.

## 5. Permiso explícito para pararse
> Si algo no cuadra, dilo y devuelve lo que tengas.

## 6. Aprendizaje
> Bloque `APRENDIZAJE` al final del informe si descubres algo duradero.

## 7. Resultado de la integración
Ciclo de arreglo: 0/2. Ejecutada por la sesión el 2026-10-12:

```
$ npm run integrate
typecheck verde 3,0 · lint verde 2,7 · test-api verde 5,8 · test-web verde 8,0 · e2e verde 26,1 · check-harness verde 2,2
Total 47,8 · ✔ Integración en verde.   API 88/1193 · web 65/860 · e2e 49
$ npx eslint --rule 'complexity: [error, 10]' apps/api/src/http/error-handler.ts apps/api/src/modules/candidates apps/web/src/features/candidates apps/web/src/components/http.ts
exit=0
```

- EC-30: `import-failures-adversarial.test.ts` «EC-30 falla la lectura del existente tras el choque del índice → 500 y
  0 creados» (envuelve `db.prepare` solo para el `SELECT id FROM candidates WHERE email`).
- `toAppError` en complejidad 10: el texto del 413 se resuelve en el manejador y se pasa ya resuelto.
- DP-01: `data/` se lista antes y después en «RNF-03 ningún fichero nuevo de os.tmpdir() ni de data/…», que se movió al
  hermano `import-privacy-disk.test.ts` por el umbral de 300 líneas.
- **Resultado:** verde. **Commit:** el del curado, `[HU-07 review]`.
