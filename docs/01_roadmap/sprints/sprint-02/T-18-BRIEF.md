# Brief de implementación — T-18 (sin HU) · `check-clean --publish` con una lista de publicación aparte

> Tarea sin HU del backlog del sprint-02 (`docs/01_roadmap/sprints/sprint-02.md`, T-18; DP-01 de
> `docs/10_audits/sprints/sprint-02-AUDIT.md` y decisión de la persona responsable del 2026-10-09). La necesita la
> publicación (T-15, paso 5). Plantilla recorrida entera: `docs/_templates/BRIEF-IMPLEMENTACION.template.md`.

## 1. Qué hay que hacer
- **El contrato es este brief y la sección T-18 del sprint.** Criterios de done en §1.1.
- **Capa y builder:** sin capa de producto (script) → `web-builder`, como T-12 y T-17, que escribieron este script.
- **Diseño:** sin TECHNICAL_DOC (opción nueva de un script del kit). Diseño en §1.2.
- **Dónde se trabaja:** la raíz del repo (el worktree de la sesión), rama `worktree-paso-3-punto-de-partida`; no
  cambies de rama. Node 24.21 y el `git` de Homebrew en el `PATH`.
- **Lo que ya está en la rama:** sprint-02 cerrado; `scripts/check-clean.mjs` (285 líneas) y
  `scripts/check-clean-identities.mjs` (175) de T-12 y T-17. Suite en verde.
- **Lee solo lo que este brief nombra.**

### 1.1 Criterios de done
1. `node scripts/check-clean.mjs --denylist <ruta> --publish --mailmap <ruta> --publish-denylist <ruta>` aplica las
   reglas de la **lista de publicación** (mismo formato que la denylist: `i:<regex>` y `c:<regex>`, vacías y `#`
   ignoradas) a **todo lo que ya escanea la denylist**: árbol (nombres y contenido), historial (`git log -p --all`,
   mensajes incluidos), nombres de refs, etiquetas anotadas e identidades en bruto. Cada coincidencia se informa con su
   sitio y `regla N (línea L de la lista de publicación)`, **sin imprimir el término, la línea ni la identidad**, y
   el comando sale con 1.
2. Con una lista de publicación que no coincide, la salida dice cuántas reglas de la lista se aplicaron y el
   comando sale con 0 si el resto de `--publish` está en verde.
3. Errores de uso, con `usage()` y salida 1: `--publish-denylist` sin `--publish`; sin ruta o con una ruta que no
   existe; una lista sin reglas o con una regla mal formada (los mismos mensajes que la denylist, diciendo que es la
   lista de publicación).
4. **Sin cambio de comportamiento** sin `--publish-denylist`: los modos `--self-test`, `--file <ruta>`, normal y
   `--publish --mailmap` dan la misma salida y el mismo código de salida que antes.
5. **Autoprueba:** al menos tres casos nuevos en `SELF_CASES` con su lista en `SELF_TEST_INPUTS`:
   - una lista de publicación que coincide con algo del repo temporal → 1, y la salida nombra la lista de publicación;
   - una que no coincide → 0, con `/listos/`;
   - `--publish-denylist` con una ruta que no existe → 1.
   La comprobación de que ninguna salida contiene términos ni identidades (`leaks`) cubre también la lista nueva:
   añade sus términos a `leaks`. **Ojo:** el último caso de `SELF_CASES` es el del marcador (`runSelfCases` escribe
   `marca.md` antes del último); los casos nuevos van **antes** de él.
6. `npx eslint --no-color --rule 'complexity: [error, 10]' --rule 'max-lines: [error, {max: 300}]' --rule 'max-lines-per-function: [error, {max: 50, skipBlankLines: true, skipComments: true}]'`
   sobre los ficheros tocados: 0 errores. Si `check-clean.mjs` no cabe en 300 líneas, los modos pasan a
   `scripts/check-clean-modes.mjs` (lo prevé el sprint), sin comprimir el código.
7. La cabecera de `check-clean.mjs` y el texto de `usage()` documentan `--publish-denylist`.

### 1.2 Diseño
- La lista de publicación se carga con `loadRules` (generalízala para que el mensaje diga qué lista es). El escaneo se
  hace **en la misma pasada** que la denylist: el `scan` prueba las dos listas y etiqueta cada coincidencia con la
  lista de la que viene, para no recorrer dos veces el historial.
- Las coincidencias de la lista de publicación cuentan como problema de `--publish`; la denylist sigue informando como
  hoy. El código de salida es el máximo de los dos.
- La lista vive fuera del repo, como la denylist; el script no contiene términos.

## 2. Invariantes que aplican
- [x] **Decisiones:** DEC-02 (scripts en Node sin dependencias y sin red).
- [ ] Envelope de error, JSON Schema, SQLite y migraciones: no aplican.
- [x] **Datos personales:** ninguna salida imprime identidades ni términos (la autoprueba lo comprueba; no la
      debilites).
- [ ] Accesibilidad: no aplica.
- [x] **Caracteres crudos:** nada de NUL ni U+2028/U+2029.
- [x] **Reuso obligatorio:** `loadRules`, `scanTree`, `scanHistory`, `scanRefs`, `scanIdentities`, `report` y el
      fixture de la autoprueba (`buildSelfTestRepo`, `SELF_TEST_INPUTS`, `SELF_CASES`).
- [x] Otros: el `--file` lo usa un hook `commit-msg` local de git; su salida no puede cambiar.

## 3. Prohibiciones
- [x] **El builder no hace commit.**
- [x] **No arregles nada fuera de alcance: repórtalo.**
- [x] **Nunca** `git add -A`, `git add .`, `git stash`, `git push` ni cambios de rama.
- [x] **No toques ficheros fuera de estos:** `scripts/check-clean.mjs`, `scripts/check-clean-identities.mjs` y, si hace
      falta, `scripts/check-clean-modes.mjs` (nuevo). Los docs (`docs/SETUP.md`, `docs/ARCHITECTURE.md`) los actualiza
      la sesión.
- [x] **No leas la denylist real ni ninguna lista de fuera del repo;** para probar, crea listas temporales tuyas en
      `os.tmpdir()` con términos inventados y bórralas al terminar.
- [x] **No instales dependencias.**
- [x] **No ejecutes la suite completa ni `npm run integrate`.**
- [x] **Nada de red.**

## 4. Verificación que debes PEGAR en tu informe
- [x] El `npx eslint` del criterio 6, después del cambio.
- [x] `node scripts/check-clean.mjs --self-test`.
- [x] Con listas temporales tuyas: el modo normal, `--publish` sin `--mailmap` y `--publish` con un `.mailmap`
      temporal vacío, **antes y después** del cambio, con la salida y el código de salida de cada uno (tienen que
      coincidir); y después, `--publish-denylist` con una lista que coincide y con otra que no, con su salida.
- [x] Los errores de uso del criterio 3, con su salida.
- [x] `npm run check:harness`.
- [x] `npx prettier --check` sobre los ficheros tocados.
- [x] Los criterios de done 1-7, uno a uno, con su evidencia.

## 5. Permiso explícito para pararse
> Si te falta algo, si este brief contradice el sprint o la auditoría, o si un permiso te bloquea → **dilo y devuelve
> lo que tengas**, con el mensaje literal. Mejor un «no pude» con evidencia que una afirmación sin pruebas.

## 6. Aprendizaje
> Si descubres algo no obvio y duradero del repo, añádelo al final de tu informe en un bloque `APRENDIZAJE`.

## 7. Resultado de la integración
> La rellena la sesión después del builder, con la **salida real**. Ciclo de arreglo: 0/2.

Ejecutada por la sesión el 2026-10-12:

```
$ npm run integrate
typecheck verde 3,8 · lint verde 3,6 · test-api verde 9,5 · test-web verde 12,6 · e2e verde 28,2 · check-harness verde 3,2
Total 61,1 · ✔ Integración en verde.   API 1097 · web 762 · e2e 47
$ node scripts/check-clean.mjs --denylist <denylist real>
check-clean: 0 coincidencias (56 reglas · 640 ficheros del árbol · historial, refs e identidades).
```

El builder comparó antes y después 7 casos (normal con y sin coincidencias, `--publish` sin `.mailmap` y con uno
vacío, `--file`, `--self-test` y sin `--denylist`): mismos códigos y misma salida, salvo el recuento del árbol (un
fichero más) y el texto de `usage()`. La autoprueba suma 4 casos (coincide, no coincide, ruta inexistente y sin
`--publish`) y cubre árbol, historial, etiqueta anotada, nombre de ref e identidad. Los modos pasan a
`scripts/check-clean-modes.mjs` (194 líneas); `check-clean.mjs` queda en 159 e `check-clean-identities.mjs` en 218.
Desviación aceptada: `--publish-denylist` con `--file` es un error de uso (la lista se habría ignorado en silencio).
La sesión documentó la opción en `docs/SETUP.md` («Antes de publicar», paso 3) y en `docs/ARCHITECTURE.md`.

- **Resultado:** verde.
- **Commit:** el de esta tarea, `[T-18]`.
