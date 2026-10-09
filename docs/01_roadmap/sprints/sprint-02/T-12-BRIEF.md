# Brief de implementación — T-12 (sin HU) · Autoría para publicar: `check-clean` de identidades y puerta `--publish`

> Tarea sin HU del sprint-02 (`docs/01_roadmap/sprints/sprint-02.md`, T-12). Plantilla recorrida entera:
> `docs/_templates/BRIEF-IMPLEMENTACION.template.md`.

## 1. Qué hay que hacer
- **El contrato es este brief y la sección T-12 del sprint**, con el alcance que fijó el responsable técnico el
  2026-10-09: el `.mailmap` **no se crea todavía** (falta el titular y la decisión de reescribir o no el historial: un
  `.mailmap` versionado contiene los emails que mapea). Criterios de done en §1.1.
- **Capa y builder:** sin capa de producto (scripts) → `web-builder`, como T-08 y T-11.
- **Diseño:** sin TECHNICAL_DOC (infraestructura, `docs/WORKFLOW.md` §9). Diseño en §1.2.
- **Dónde se trabaja:** la raíz del repo (el worktree de la sesión), rama `worktree-paso-3-punto-de-partida`; no
  cambies de rama. Node 24.21 y el `git` de Homebrew en el `PATH`.
- **Lo que ya está en la rama:** T-08 a T-11 (`scripts/integrate.mjs`, `scripts/check-machine-paths.mjs`). Suite en
  verde.
- **Lee solo lo que este brief nombra.**

### 1.1 Criterios de done
1. **Identidades contra la denylist:** `scripts/check-clean.mjs` revisa además, en todos los commits de todas las refs,
   el nombre y el email de autor y de committer **en bruto** (`%an`, `%ae`, `%cn`, `%ce`; sin aplicar `.mailmap`), y el
   tagger de las etiquetas anotadas, que ya entra en el cuerpo de la etiqueta. Informa como ya hace, por commit o por
   etiqueta y número de regla, **sin imprimir el término ni la identidad**.
2. **Puerta de publicación:** `node scripts/check-clean.mjs --denylist <ruta> --publish --mailmap <ruta>` hace todo lo
   del modo normal y, además, falla (exit 1) si:
   - falta `--mailmap` o el fichero no existe, con un mensaje que explica para qué sirve y que el `.mailmap` se crea
     cuando el responsable dé el titular;
   - alguna identidad en bruto (autor, committer o tagger, de todas las refs) no es una de las permitidas: los nombres y
     emails **canónicos** (la parte izquierda) de cada línea del `.mailmap` y `Claude … <noreply@anthropic.com>`. Informa
     del número de commits o etiquetas afectados y de cuántas identidades distintas fallan, **sin imprimirlas**;
   - queda algún marcador de publicación en un fichero del árbol (criterio 3), con `fichero:línea`.
   Sin `--publish`, el comportamiento actual no cambia, salvo lo que añade el criterio 1.
3. **Marcadores de publicación:** `scripts/publish-markers.mjs` exporta la lista `PUBLISH_MARKERS`
   (TITULAR, RAZON_SOCIAL y URL_MARKETPLACE, cada uno entre ángulos `<` `>`; en el código se construyen concatenando, `'<' + 'TITULAR' + '>'`, para que el
   literal no aparezca en ningún fichero del repo salvo donde se rellena, y
   en los docs se nombran sin ángulos, como aquí) y una función que devuelve sus apariciones en un texto. La usa
   `--publish` y la usará `check:harness` (criterio 5). Un marcador citado entre comillas invertidas en un doc que
   explica la regla también cuenta: los docs de la regla nombran los marcadores sin ángulos (por ejemplo, «el marcador
   TITULAR»).
4. **Autoprueba:** `node scripts/check-clean.mjs --self-test` crea un repo git temporal (`mkdtemp`) con commits de
   identidades **inventadas** (`GIT_AUTHOR_NAME`, `GIT_AUTHOR_EMAIL`, `GIT_COMMITTER_*` y una etiqueta anotada con
   `GIT_COMMITTER_*` como tagger), una denylist temporal y un `.mailmap` temporal, y comprueba:
   - el modo normal detecta un término de la denylist en un email de autor, en un nombre de committer y en el tagger;
   - `--publish` falla con una identidad fuera del `.mailmap`, pasa cuando todas están mapeadas o son de
     `noreply@anthropic.com`, falla sin `--mailmap` y falla con un marcador en el árbol;
   - ninguna salida contiene la identidad ni el término.
   No necesita `--denylist` (usa la temporal). Se borra al acabar.
5. **`check:harness`:**
   - encadena `node scripts/check-clean.mjs --self-test`;
   - imprime un **aviso** (no un fallo: el código de salida no cambia) con el número de marcadores de publicación que
     quedan en el árbol, si hay alguno: `⚠ publicación: quedan N marcadores (los revisa check-clean --publish)`.
6. **Docs:** en `docs/07_architecture_principles/DECISIONS.md`, DEC-02, la descripción de `check:clean` añade
   `--publish --mailmap <ruta>` (aclaración fechada, como la de T-08); y una sección corta «Antes de publicar» al final
   de `docs/SETUP.md` con el orden: rellenar marcadores, `.mailmap`, `check-clean --publish` en verde y, después, el
   bundle.
7. `check-clean` sigue en 0 coincidencias en modo normal con la denylist real (la ejecuta la sesión; tú no la tienes).

### 1.2 Diseño
- `check-clean.mjs` tiene hoy 146 líneas. Si con lo nuevo pasa de 300, saca las identidades a
  `scripts/check-clean-identities.mjs` (funciones puras: leer identidades con `git log --all --format=…` y
  `for-each-ref`, y compararlas con la lista permitida), importado desde `check-clean.mjs`.
- Ejecución directa con `import.meta.main`, como `scripts/integrate.mjs`. El `--file` del hook `commit-msg` no cambia.
- En la autoprueba, `git` se lanza con `cwd` en el temporal y con `GIT_CONFIG_GLOBAL=/dev/null` y
  `GIT_CONFIG_NOSYSTEM=1`, para no depender de la configuración de quien la ejecuta.

## 2. Invariantes que aplican
- [x] **Decisiones:** DEC-02 (scripts en Node sin dependencias y sin red; lista de scripts raíz, que no cambia).
- [ ] Envelope de error: no aplica.
- [ ] Validación con JSON Schema: no aplica.
- [ ] SQLite parametrizado: no aplica.
- [ ] Migraciones: no aplica.
- [x] **Datos personales:** las identidades son datos personales: ninguna salida, log ni fichero las imprime; la
      autoprueba solo usa identidades inventadas con dominio `example.com`.
- [ ] Accesibilidad: no aplica.
- [x] **Caracteres crudos:** nada de NUL ni U+2028/U+2029 en el código (el separador `%x00` de git se usa como
      secuencia en el formato, como ya hace `check-clean`).
- [x] **Reuso obligatorio:** el recorrido del historial y de las refs de `scripts/check-clean.mjs`; la autoprueba al
      estilo de `scripts/integrate.mjs` (`mkdtemp` y borrado en `finally`).
- [x] Otros: mensajes en castellano de España; código en inglés.

## 3. Prohibiciones
- [x] **El builder no hace commit.**
- [x] **No arregles bugs fuera de alcance: repórtalos.**
- [x] **Nunca** `git add -A`, `git add .`, `git stash`, `git push` ni cambios de rama; **no reescribas el historial**
      ni toques la configuración de git del repo. Los commits de la autoprueba van solo en el repo temporal.
- [x] **No crees `.mailmap`** en el repo.
- [x] **No toques ficheros fuera de estos:** `scripts/check-clean.mjs`, `scripts/check-clean-identities.mjs` (si hace
      falta), `scripts/publish-markers.mjs` (nuevo), `scripts/check-harness.mjs` (solo el aviso del criterio 5, o hazlo
      en el encadenado de `package.json` si es más limpio), `package.json`,
      `docs/07_architecture_principles/DECISIONS.md` (solo DEC-02) y `docs/SETUP.md` (solo la sección nueva).
- [x] **No instales dependencias.**
- [x] **No ejecutes la suite completa ni `npm run integrate`.**
- [x] **Nada de red.**

## 4. Verificación que debes PEGAR en tu informe
- [x] `node scripts/check-clean.mjs --self-test`.
- [x] `node scripts/check-clean.mjs --denylist <una lista temporal tuya con una regla que no coincida>` (0 coincidencias)
      y la misma con `--publish` sin `--mailmap` (exit 1 con el mensaje del criterio 2).
- [x] `node scripts/check-clean.mjs --denylist <la temporal> --publish --mailmap <un .mailmap temporal vacío>` sobre el
      repo real: **tiene que fallar** por identidades (pega la salida y confirma que no imprime ninguna identidad).
- [x] `npm run check:harness`.
- [x] `npx eslint` y `npx prettier --check` sobre los ficheros tocados.
- [x] Los criterios de done 1-7, uno a uno, con su evidencia (el 7 lo cierra la sesión).

## 5. Permiso explícito para pararse
> Si te falta algo, si este brief contradice el sprint o la auditoría, si necesitarías instalar una dependencia o si el
> reuso obligatorio no existe → **dilo y devuelve lo que tengas**. Mejor un «no pude» con evidencia que una afirmación
> sin pruebas.

## 6. Aprendizaje
> Si descubres algo no obvio y duradero del repo, añádelo al final de tu informe en un bloque `APRENDIZAJE`.

## 7. Resultado de la integración
> La rellena la sesión después del builder, con la **salida real**. Ciclo de arreglo: 0/2.

Ejecutada por la sesión el 2026-10-09, con T-13 y T-14 en el mismo árbol (sus commits van aparte):

```
$ npm run integrate
Paso           Resultado   Segundos
-----------------------------------
typecheck      verde            3,6
lint           verde            3,2
test-api       verde            7,0
test-web       verde            8,1
e2e            verde           26,1
check-harness  verde            2,7
-----------------------------------
Total                          50,7
✔ Integración en verde.
API 78/1097 · web 59/762 · e2e 47
$ tail logs/integrate/check-harness.log
  ✔ check-clean: autoprueba en un repo temporal (identidades en bruto contra la denylist, --publish con .mailmap, sin --mailmap y con marcadores; ninguna salida imprime identidades ni términos)
  ⚠ publicación: quedan 2 marcadores (los revisa check-clean --publish)
```

Criterio 7, con la denylist real y el `.mailmap` real (los dos fuera del repo):

```
$ node scripts/check-clean.mjs --denylist <denylist>
check-clean: 0 coincidencias (56 reglas · 636 ficheros del árbol · historial, refs e identidades).
$ node scripts/check-clean.mjs --denylist <denylist> --publish --mailmap <mailmap>
check-clean --publish: 3 problema(s) para publicar:
  - identidades: 208 commit(s) y 1 etiqueta(s) con un autor, committer o tagger que no es canónico del .mailmap ni de Claude <noreply@anthropic.com>; 2 identidad(es) distinta(s). …
  - marcador de publicación URL_MARKETPLACE · NOTICE:9: rellénalo antes de publicar.
  - marcador de publicación URL_MARKETPLACE · README.md:9: rellénalo antes de publicar.
exit=1
```

`--publish` falla **a propósito** hasta la reescritura de identidades de la copia de publicación (T-15) y hasta que se
rellene la URL. No imprime ninguna identidad. El builder probó 4 mutaciones de la autoprueba (lectura con mailmap en
lugar de en bruto, sin el permiso de Claude, sin detectar marcadores e imprimiendo un email) y las 4 la ponen en rojo.

- **Regla de «permitida»** (fijada por el builder): el nombre está entre los nombres canónicos del `.mailmap` y el email
  entre sus emails canónicos, o el nombre empieza por «Claude» y el email es `noreply@anthropic.com`. Con un solo
  titular canónico, emparejar nombre y email por línea no cambia nada.
- **Para la auditoría:** `scripts/check-clean.mjs` queda en 300 líneas justas y `scripts/check-harness.mjs` tiene 405
  (anterior a esta tarea), por encima del umbral de QUALITY-GATES §2. Los scripts no los mide el lint.
- **Resultado:** verde.
- **Commit:** el de esta tarea, `[T-12]`.
