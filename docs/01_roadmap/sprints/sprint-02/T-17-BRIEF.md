# Brief de implementación — T-17 (sin HU) · Complejidad de `main` en `check-clean`

> Tarea sin HU del sprint-02 (`docs/01_roadmap/sprints/sprint-02.md`, T-17), arreglo de la acción A-03 de
> `docs/10_audits/sprints/sprint-02-AUDIT.md` (C-01). Plantilla recorrida entera:
> `docs/_templates/BRIEF-IMPLEMENTACION.template.md`.

## 1. Qué hay que hacer
- **El contrato es este brief y la sección T-17 del sprint.** Criterios de done en §1.1.
- **Capa y builder:** sin capa de producto (script) → `web-builder`, como T-12, que escribió este script.
- **Diseño:** sin TECHNICAL_DOC (refactor de script sin cambio de contrato). Diseño en §1.2.
- **Dónde se trabaja:** la raíz del repo (el worktree de la sesión), rama `worktree-paso-3-punto-de-partida`; no
  cambies de rama. Node 24.21 y el `git` de Homebrew en el `PATH`.
- **Lo que ya está en la rama:** T-08 a T-16; `scripts/check-clean.mjs` es de T-12 (`0993b70`). Suite en verde.
- **Lee solo lo que este brief nombra.**

### 1.1 Criterios de done
1. `npx eslint --no-color --rule 'complexity: [error, 10]' --rule 'max-lines: [error, {max: 300}]' --rule 'max-lines-per-function: [error, {max: 50, skipBlankLines: true, skipComments: true}]' scripts/check-clean.mjs scripts/check-clean-identities.mjs`
   no da ningún error. Hoy da uno: `main` (`scripts/check-clean.mjs:179`) con complejidad 11.
2. Sin cambio de comportamiento: los modos `--self-test`, `--file <ruta>`, normal (`--denylist`) y
   `--publish --mailmap` dan la misma salida y el mismo código de salida que antes. La autoprueba sigue en verde y
   cubre lo mismo.
3. El fichero sigue en 300 líneas o menos. Si no cabe, mueve funciones puras a `scripts/check-clean-identities.mjs`
   (o a un `scripts/check-clean-modes.mjs` nuevo) en lugar de comprimir el código.

### 1.2 Diseño
- Una función por modo (`runSelfTest`, `runFile`, `runScan`, que añade los problemas de `--publish`), y un `main` que
  solo lee los argumentos y despacha. Los mensajes y los códigos de salida no cambian.

## 2. Invariantes que aplican
- [x] **Decisiones:** DEC-02 (scripts en Node sin dependencias y sin red).
- [ ] Envelope de error, JSON Schema, SQLite y migraciones: no aplican.
- [x] **Datos personales:** ninguna salida imprime identidades ni términos (la autoprueba lo comprueba; no la
      debilites).
- [ ] Accesibilidad: no aplica.
- [x] **Caracteres crudos:** nada de NUL ni U+2028/U+2029.
- [x] **Reuso obligatorio:** las funciones que ya existen en `scripts/check-clean.mjs` y `scripts/check-clean-identities.mjs`.
- [x] Otros: el `--file` lo usa un hook `commit-msg` local de git; su salida no puede cambiar.

## 3. Prohibiciones
- [x] **El builder no hace commit.**
- [x] **No arregles nada fuera de alcance: repórtalo** (los bajos SEC-01, DP-02, DP-03 y DP-04 de la auditoría no son de
      esta tarea).
- [x] **Nunca** `git add -A`, `git add .`, `git stash`, `git push` ni cambios de rama.
- [x] **No toques ficheros fuera de estos:** `scripts/check-clean.mjs`, `scripts/check-clean-identities.mjs` y, si hace
      falta, `scripts/check-clean-modes.mjs` (nuevo).
- [x] **No instales dependencias.**
- [x] **No ejecutes la suite completa ni `npm run integrate`.**
- [x] **Nada de red.**

## 4. Verificación que debes PEGAR en tu informe
- [x] El `npx eslint` del criterio 1, antes y después.
- [x] `node scripts/check-clean.mjs --self-test`.
- [x] Con una denylist temporal tuya que no coincida: el modo normal, `--publish` sin `--mailmap` y `--publish` con un
      `.mailmap` temporal vacío, antes y después del cambio, con la salida y el código de salida de cada uno
      (tienen que coincidir).
- [x] `npm run check:harness`.
- [x] `npx prettier --check` sobre los ficheros tocados.
- [x] Los criterios de done 1-3, uno a uno, con su evidencia.

## 5. Permiso explícito para pararse
> Si te falta algo, si este brief contradice el sprint o la auditoría, o si un permiso te bloquea → **dilo y devuelve
> lo que tengas**, con el mensaje literal. Mejor un «no pude» con evidencia que una afirmación sin pruebas.

## 6. Aprendizaje
> Si descubres algo no obvio y duradero del repo, añádelo al final de tu informe en un bloque `APRENDIZAJE`.

## 7. Resultado de la integración
> La rellena la sesión después del builder, con la **salida real**. Ciclo de arreglo: 0/2.

Ejecutada por la sesión el 2026-10-09:

```
$ npm run integrate
typecheck verde 3,6 · lint verde 3,0 · test-api verde 6,8 · test-web verde 8,6 · e2e verde 27,0 · check-harness verde 2,4
Total 51,3 · ✔ Integración en verde.   API 1097 · web 762 · e2e 47
$ npx eslint --no-color --rule 'complexity: [error, 10]' --rule 'max-lines: [error, {max: 300}]' scripts/check-clean.mjs scripts/check-clean-identities.mjs
exit=0
$ node scripts/check-clean.mjs --denylist <denylist real>
check-clean: 0 coincidencias (56 reglas · 638 ficheros del árbol · historial, refs e identidades).
```

El builder comparó la salida y el código de salida de 12 casos (normal, `--publish` con y sin `.mailmap`, `--file` y los
errores de uso) antes y después: idénticos. `main` pasa a despachar a `runFile`, `runScan` y `runSelfTest`;
`check-clean.mjs` queda en 285 líneas. Desviación aceptada: para caber, se movió a `check-clean-identities.mjs` la tabla
de casos de la autoprueba (datos fijos, no funciones puras como decía §1.1); los casos no cambian.

- **Resultado:** verde.
- **Commit:** el de esta tarea, `[T-17]`.
