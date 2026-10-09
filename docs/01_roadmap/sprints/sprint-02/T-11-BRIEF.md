# Brief de implementación — T-11 (sin HU) · Ninguna ruta de máquina y citas de módulo al día

> Tarea sin HU del sprint-02 (`docs/01_roadmap/sprints/sprint-02.md`, T-11). Plantilla recorrida entera:
> `docs/_templates/BRIEF-IMPLEMENTACION.template.md`.

## 1. Qué hay que hacer
- **El contrato es este brief y la sección T-11 del sprint.** Criterios de done en §1.1.
- **Capa y builder:** sin capa de producto (script de `scripts/` y docs) → `web-builder`, como T-08 (R4.0: herramienta
  de verificación, más cerca de los e2e que de la API).
- **Diseño:** sin TECHNICAL_DOC (infraestructura, `docs/WORKFLOW.md` §9). Diseño en §1.2.
- **Criterios que cubre:** A-10 de `docs/10_audits/sprints/sprint-01-AUDIT.md` y la regla de rutas de máquina de la
  publicación (P6).
- **Dónde se trabaja:** la raíz del repo (el worktree de la sesión), rama `worktree-paso-3-punto-de-partida`; no
  cambies de rama. Node 24.21 en el `PATH`.
- **Lo que ya está en la rama:** T-08 (`npm run integrate`, `a335fd4`) y T-09. Suite en verde.
- **Lee solo lo que este brief nombra.**

### 1.1 Criterios de done
1. **Regla automática:** `scripts/check-machine-paths.mjs` falla (exit 1) si un fichero versionado o nuevo no ignorado
   contiene una ruta de máquina con usuario: `/Users/<nombre>/`, `/home/<nombre>/` o `C:\Users\<nombre>\` (también con
   otra letra de unidad y con `/` en lugar de `\`). Informa de cada una con `fichero:línea`, **sin imprimir la ruta** (lleva
   el nombre de usuario). Con todo limpio, imprime una línea `✔` con cuántos ficheros revisó.
2. **No da falsos positivos con lo que describe la regla:** `` `/Users/` ``, `/Users/…`, `/home/` y `C:\…` sin nombre
   detrás no cuentan (hoy aparecen en `.claude/skills/module-sync/SKILL.md` y en
   `docs/01_roadmap/sprints/sprint-02.md`).
3. **Autoprueba:** antes de mirar el repo, se prueba con casos fijos: al menos 6 positivos (las tres formas, con y
   sin comillas invertidas, dentro de una frase) y 4 negativos (los del criterio 2 y una URL `https://…/home/…`). Si la
   autoprueba falla, sale con 1. Patrón: `scripts/check-passive-effects.mjs`.
4. **`--history`:** revisa también `git log -p --all` (mensajes y diffs), como hace `scripts/check-clean.mjs`, e informa
   de los commits con coincidencias por hash corto. No entra en `check:harness`: es para preparar la publicación. Pega
   su salida en el informe (se espera que encuentre los briefs antiguos en el historial).
5. `npm run check:harness` ejecuta el modo árbol (sin `--history`), después de las comprobaciones que ya tiene.
6. **Briefs saneados (59 + 1):**
   - En los 59 `TASK-NN-BRIEF.md` de HU-01 a HU-04 (`docs/03_delivery/hu/completadas/HU-0{1,2,3,4}-*/tasks/`), la
     línea «Dónde se trabaja» pasa de «repo `` `<ruta absoluta>` ``,» a «la raíz del repo,», como ya dicen los de HU-05
     y HU-06 (`docs/03_delivery/hu/completadas/HU-05-pipeline-etapas/tasks/TASK-01-BRIEF.md:14`). El resto de la línea
     no cambia.
   - En `docs/03_delivery/hu/completadas/HU-04-inscribir-candidato/tasks/TASK-01-BRIEF.md:37`, la ruta del script del
     trigger pasa a «un script de verificación del trigger que vivió fuera del repo (ya no existe)».
   - No cambia nada más de esos ficheros.
7. **La causa, cerrada:**
   - `docs/_templates/BRIEF-IMPLEMENTACION.template.md:14` dice «la raíz del repo» en lugar de
     «repo `` `<ruta absoluta>` ``».
   - `.claude/skills/implementar-hu/SKILL.md:32` dice que la ruta absoluta va en el encargo al builder, nunca en el
     brief.
8. `scripts/check-machine-paths.mjs` en modo árbol da 0 coincidencias en la rama.

### 1.2 Diseño
- Node sin dependencias, como `scripts/check-clean.mjs`, del que se reutiliza la forma de listar el árbol
  (`git ls-files -z --cached --others --exclude-standard`, saltando binarios) y de recorrer el historial.
- Una función exportada `findMachinePaths(text)` → números de línea, que usan la autoprueba y el escaneo.
  Ejecución directa con `import.meta.main` (aprendizaje de T-08: comparar `process.argv[1]` falla bajo enlaces
  simbólicos).
- En `package.json`, `check:harness` encadena `node scripts/check-machine-paths.mjs` al final.

### 1.3 Ya verificado por la sesión (no hay que repetirlo)
- Las citas `fichero:línea` de `functional.md` y `technical.md` de los tres módulos son 6 y las 6 son correctas
  (`ofertas/technical.md:174, 191, 210, 211`, `candidatos/technical.md:156, 231`). Las de
  `.claude/agents/{security,datos-personales}-auditor.md` son plantillas de formato (`{módulo}`), no citas reales. Esa
  parte de T-11 queda hecha sin cambios.

## 2. Invariantes que aplican
- [x] **Decisiones:** DEC-02 (scripts en Node sin dependencias y sin red). No hay script raíz nuevo, así que la lista de
      DEC-02 no cambia.
- [ ] Envelope de error: no aplica.
- [ ] Validación con JSON Schema: no aplica.
- [ ] SQLite parametrizado: no aplica.
- [ ] Migraciones: no aplica.
- [x] **Datos personales:** el informe del script nunca imprime la ruta encontrada (lleva un nombre de usuario).
- [ ] Accesibilidad: no aplica.
- [x] **Caracteres crudos:** nada de NUL ni U+2028/U+2029 (ojo con los casos fijos de la autoprueba).
- [x] **Reuso obligatorio:** el listado del árbol y el recorrido del historial de `scripts/check-clean.mjs`; la forma de
      autoprueba de `scripts/check-passive-effects.mjs`; `import.meta.main` como en `scripts/integrate.mjs`.
- [x] Otros: mensajes en castellano de España; código en inglés.

## 3. Prohibiciones
- [x] **El builder no hace commit.**
- [x] **No arregles bugs fuera de alcance: repórtalos.**
- [x] **Nunca** `git add -A`, `git add .`, `git stash`, `git push` ni cambios de rama. **No reescribas el historial.**
- [x] **No toques ficheros fuera de estos:** `scripts/check-machine-paths.mjs` (nuevo), `package.json`, los 59 briefs
      del criterio 6, `docs/_templates/BRIEF-IMPLEMENTACION.template.md` y `.claude/skills/implementar-hu/SKILL.md`.
- [x] **No instales dependencias.**
- [x] **No ejecutes la suite completa ni `npm run integrate`.**
- [x] **Nada de red.**

## 4. Verificación que debes PEGAR en tu informe
- [x] `node scripts/check-machine-paths.mjs` (modo árbol: 0 coincidencias).
- [x] `node scripts/check-machine-paths.mjs --history` (la salida tal cual; no tiene que dar 0).
- [x] Una prueba de que detecta: crea un fichero temporal **no ignorado** con una ruta de usuario inventada
      (la carpeta de usuarios de macOS seguida de un nombre ficticio; no la escribas en ningún doc), ejecuta el modo árbol (exit 1 con `fichero:línea` y sin la ruta) y bórralo.
- [x] `npm run check:harness`.
- [x] `npx eslint scripts/check-machine-paths.mjs` y `npx prettier --check` sobre los ficheros tocados.
- [x] `git diff --stat` (61 ficheros de docs + el script + `package.json`) y `git diff -U0` de 2 briefs de muestra.
- [x] Los criterios de done 1-8, uno a uno, con su evidencia.

## 5. Permiso explícito para pararse
> Si te falta algo, si este brief contradice el sprint o la auditoría, si necesitarías instalar una dependencia o si el
> reuso obligatorio no existe → **dilo y devuelve lo que tengas**. Mejor un «no pude» con evidencia que una afirmación
> sin pruebas.

## 6. Aprendizaje
> Si descubres algo no obvio y duradero del repo, añádelo al final de tu informe en un bloque `APRENDIZAJE`.

## 7. Resultado de la integración
> La rellena la sesión después del builder, con la **salida real**. Ciclo de arreglo: 0/2.

**Resultado: parcial, bloqueada en los criterios 5, 6 y 8.**

- Hechos y verificados: 1-4 (el script, con 14 casos de autoprueba, sin imprimir rutas y con `--history`) y 7 (la causa,
  cerrada en la plantilla y en `/implementar-hu`). El modo árbol encuentra justo las 60 líneas de los briefs (59 «Dónde
  se trabaja» + `HU-04 TASK-01:37`), sin falsos positivos. `--history` encuentra 59 commits (los que crearon esos
  briefs; ningún mensaje).
- **Bloqueado (criterio 6):** el clasificador de permisos de la sesión **denegó al builder** el saneado de los 59 + 1
  briefs (motivo dado: «Irreversible Local Destruction»), y la denegación cubre ese resultado por cualquier vía. La
  sesión no lo hace por otro camino: se escala a la persona responsable (2026-10-09). El builder dejó un script de
  saneado fuera del repo, sin ejecutar; la sesión lo leyó: solo cambia esas 60 líneas, con las sustituciones del
  criterio 6.
- **Criterios 5 y 8, en espera de lo anterior:** el encadenado en `check:harness` se deja fuera hasta que los briefs
  estén saneados, para no poner en rojo la integración del resto del sprint. Mientras tanto, el script se ejecuta a
  mano.

Integración ejecutada por la sesión el 2026-10-09, sin el encadenado:

```
$ npm run integrate
Paso           Resultado   Segundos
-----------------------------------
typecheck      verde            3,8
lint           verde            3,2
test-api       verde            6,0
test-web       verde            8,8
e2e            verde           27,6
check-harness  verde            1,4
-----------------------------------
Total                          50,8

✔ Integración en verde. Logs en logs/integrate/ y tabla en logs/integrate/summary.txt
$ node scripts/check-machine-paths.mjs
check:machine-paths: 60 ruta(s) de máquina con usuario:   (las 60 líneas de los briefs del criterio 6)
```

- **Commit:** `cea98f1` `[T-11]` (parcial).

**Cierre (2026-10-09, mismo día).** Desbloqueado por la persona responsable, que ejecutó ella misma el script de
saneado (opción a del escalado). Su salida: «ficheros cambiados: 59; líneas cambiadas: 60». La sesión revisó el diff
(59 ficheros, 60+/60-, solo las dos sustituciones del criterio 6), retocó la redacción de
`HU-04 TASK-01:37` («… que vivió fuera del repo y ya no existe (era la referencia de los 14 casos)») y encadenó la regla
en `check:harness` (criterio 5). Los tres ficheros que un `grep '/Users/'` aún encuentra
(`.claude/skills/module-sync/SKILL.md`, `sprint-02.md` y este brief) describen la regla sin nombre de usuario: son los
falsos positivos que el criterio 2 descarta.

```
$ node scripts/check-machine-paths.mjs
  ✔ rutas de máquina: 14 casos de autoprueba; 0 coincidencias en 634 ficheros
$ npm run check:harness
check:harness: todo en verde.
  ✔ efectos pasivos: 11 casos de autoprueba; 0 aserciones síncronas, 0 en excepciones fechadas; 2 marcas efecto-síncrono (…)
  ✔ integrate: autoprueba con pasos falsos (para en el rojo, no sigue, guarda logs y tabla)
  ✔ rutas de máquina: 14 casos de autoprueba; 0 coincidencias en 634 ficheros
$ npx prettier --check docs/03_delivery/hu/completadas/HU-0*/tasks/TASK-*-BRIEF.md
All matched files use Prettier code style!
```

El cierre solo toca docs y el encadenado de `check:harness`: no cambia código ni tests. La pasada completa
(`npm run integrate`) se ejecuta tras T-12 y T-14, que estaban en curso en el mismo árbol, y se pega en sus briefs.

- **Resultado:** verde. Criterios 1-8 cumplidos.
- **Commit:** el de cierre, `[T-11]`.
