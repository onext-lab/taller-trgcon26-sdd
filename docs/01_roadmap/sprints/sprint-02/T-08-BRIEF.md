# Brief de implementación — T-08 (sin HU) · Deuda de demo: integración en serie, medida y con logs

> Tarea sin HU del sprint-02 (`docs/01_roadmap/sprints/sprint-02.md`, T-08). Como no hay carpeta de HU, el brief se
> guarda en `docs/01_roadmap/sprints/sprint-02/` (decisión de la sesión, anotada en el sprint). Plantilla recorrida
> entera: `docs/_templates/BRIEF-IMPLEMENTACION.template.md`.

## 1. Qué hay que hacer
- **El contrato es este brief y la sección T-08 del sprint** (no hay `TASK-NN.md`). Criterios de done en §1.1.
- **Capa y builder:** `web` → `web-builder`. Toca la configuración de Vitest de `apps/web`, un script de `scripts/` y
  docs; la capa principal es la de la web (R4.0).
- **Diseño:** no hay TECHNICAL_DOC (refactor de infraestructura sin cambio de contrato, `docs/WORKFLOW.md` §9). El
  diseño está en §1.2.
- **Criterios que cubre:** A-02 (a), (b), (c) y (d) de `docs/10_audits/sprints/sprint-01-AUDIT.md`.
- **Dónde se trabaja:** la raíz del repo (el worktree de la sesión), rama `worktree-paso-3-punto-de-partida` (ya
  creada; no cambies de rama). Node 24.21 en el `PATH`.
- **Lo que ya está en la rama:** `5155791` (apertura del sprint-02). La suite está en verde: typecheck, lint, API 1 097,
  web 754, e2e 47 y `check:harness`.
- **Lee solo lo que este brief nombra.**

### 1.1 Criterios de done
1. `npm run integrate` ejecuta **en serie**, en este orden, `npm run typecheck`, `npm run lint`,
   `npm test -w apps/api`, `npm test -w apps/web`, `npm run e2e` y `npm run check:harness`. Nunca lanza dos a la vez.
2. Se para en el **primer paso en rojo** y sale con código ≠ 0, diciendo en castellano qué paso falló y dónde está su
   log. Si todo pasa, sale con 0.
3. Al acabar (en verde o en rojo), imprime una tabla con cada paso ejecutado, su resultado y sus segundos, y el total.
4. Guarda la salida completa de cada paso ejecutado en `logs/integrate/<paso>.log` (se sobrescriben en cada pasada) y
   la tabla en `logs/integrate/summary.txt`. `logs/` está en `.gitignore`.
5. El script se prueba a sí mismo: `node scripts/integrate.mjs --self-test` ejecuta una lista de pasos falsos
   (`node -e "process.exit(0)"` y `node -e "process.exit(1)"`) en un directorio temporal y comprueba que se para en el
   rojo, que no ejecuta los siguientes y que escribe los logs. `npm run check:harness` lo llama, como hace con
   `scripts/check-passive-effects.mjs`.
6. `apps/web/vite.config.ts` fija `test.testTimeout` en **10 000 ms**, con un comentario de dos o tres líneas que lo
   justifique con las medidas de §1.3 (no un número a ciegas).
7. Docs: una fila en la tabla de comandos de `AGENTS.md` (`npm run integrate`: integración completa en serie, con logs
   en `logs/integrate/`) y una sección corta en `docs/SETUP.md`, «Integración completa en serie», con el orden, los logs,
   la medida de §1.3 y «nunca la suite unitaria y los e2e a la vez».

### 1.2 Diseño
- `scripts/integrate.mjs`, Node sin dependencias (como los demás scripts): una lista fija de pasos `{ nombre, comando,
  args }` y una función que los ejecuta uno a uno con `spawnSync` (salida a fichero y un resumen corto por pantalla),
  exportada para que la autoprueba la reutilice con pasos falsos.
- Los e2e ya van con `workers: 1` en `playwright.config.ts`: no se toca. Vitest no se limita: con la ejecución en
  serie, cada suite tiene la máquina para ella sola.
- Un script `integrate` en el `package.json` raíz.

### 1.3 Medidas que justifican el timeout (tomadas por la sesión el 2026-10-09, portátil de 11 núcleos)
- Suite web sola: 754 tests en 10,9 s; el test más lento, 1,15 s.
- Con los 11 núcleos ocupados por bucles activos: el más lento, 1,33 s. Con 44 bucles (4× los núcleos): 1,68 s y la
  suite entera en verde.
- Web y e2e a la vez: en verde, con el más lento en 1,18 s. Los 16 timeouts de la review de HU-04 no se reproducen
  tras T-03 y T-06.
- Pasada completa en serie: 48,2 s (typecheck 3,7 · lint 2,9 · unitarios 15,3 · e2e 25,1 · harness 1,2).
- Justificación de 10 s: un portátil modesto puede ser 2-3× más lento por núcleo, lo que deja el peor test medido bajo
  carga (1,7 s) en unos 5 s, justo el *timeout* por defecto de Vitest con el que fallaron los 16 de HU-04. 10 s da el
  doble de margen sobre esa estimación y sigue cortando un test colgado en segundos, no en minutos.

## 2. Invariantes que aplican
- [x] **Decisiones:** DEC-02 (`docs/07_architecture_principles/DECISIONS.md:26`) enumera los scripts raíz:
      `integrate` se añade a esa lista, con una línea fechada (2026-10-09, T-08), sin cambiar la decisión. Los scripts de
      `scripts/` son Node sin dependencias y sin red, como `check-clean`.
- [ ] Envelope de error: no aplica (no hay API).
- [ ] Validación con JSON Schema: no aplica.
- [ ] SQLite parametrizado: no aplica.
- [ ] Migraciones: no aplica.
- [ ] Datos personales: no aplica (no hay datos; los logs son salida de tests con datos inventados).
- [ ] Accesibilidad: no aplica.
- [x] **Caracteres crudos:** nada de NUL ni U+2028/U+2029 en el script (el hook lo bloquea).
- [x] **Reuso obligatorio:** el patrón de autoprueba de `scripts/check-passive-effects.mjs` (casos fijos antes de
      trabajar) y la forma en que `package.json` encadena `check:harness`.
- [x] Otros: mensajes al usuario en castellano de España; código e identificadores en inglés.

## 3. Prohibiciones
- [x] **El builder no hace commit.**
- [x] **No arregles bugs fuera de alcance: repórtalos.** En particular, no toques tests web lentos ni los EC-39.
- [x] **Nunca** `git add -A`, `git add .`, `git stash`, `git push` ni cambios de rama.
- [x] **No toques ficheros fuera de estos:** `scripts/integrate.mjs` (nuevo), `package.json`, `apps/web/vite.config.ts`,
      `.gitignore`, `AGENTS.md`, `docs/SETUP.md` y `docs/07_architecture_principles/DECISIONS.md` (solo la lista de
      DEC-02). Si necesitas otro, dilo en el informe.
- [x] **No instales dependencias.**
- [x] **No ejecutes `npm run integrate` ni la suite completa:** la pasada la ejecuta la sesión en la integración. Tú,
      `--self-test` y tests acotados.
- [x] **Nada de red.**

## 4. Verificación que debes PEGAR en tu informe
- [x] `node scripts/integrate.mjs --self-test`.
- [x] `npm test -w apps/web -- test/App.test.tsx` (comprueba que el `testTimeout` nuevo no rompe la configuración: 1
      fichero ejecutado).
- [x] `npm run typecheck`.
- [x] `npx eslint scripts/integrate.mjs apps/web/vite.config.ts`.
- [x] `npm run check:harness`.
- [ ] `npx playwright test`: no aplica (no toca pantallas).
- [x] Los criterios de done 1-7, uno a uno, con su evidencia.

## 5. Permiso explícito para pararse
> Si te falta algo, si este brief contradice el sprint o la auditoría, si necesitarías instalar una dependencia o si el
> reuso obligatorio no existe → **dilo y devuelve lo que tengas**. Mejor un «no pude» con evidencia que una afirmación
> sin pruebas.

## 6. Aprendizaje
> Si descubres algo no obvio y duradero del repo, añádelo al final de tu informe en un bloque `APRENDIZAJE`.

## 7. Resultado de la integración
> La rellena la sesión después del builder, con la **salida real**. Ciclo de arreglo: 0/2.

Ejecutada por la sesión el 2026-10-09 con Node 24.21.0, con el propio `npm run integrate` (la pasada completa, más
amplia que los tests acotados de R2):

```
$ npm run integrate
Paso           Resultado   Segundos
-----------------------------------
typecheck      verde            3,0
lint           verde            2,7
test-api       verde            6,0
test-web       verde            8,5
e2e            verde           25,5
check-harness  verde            1,3
-----------------------------------
Total                          46,9

✔ Integración en verde. Logs en logs/integrate/ y tabla en logs/integrate/summary.txt
$ grep -E "Tests |Test Files" logs/integrate/test-api.log
 Test Files  78 passed (78)
      Tests  1097 passed (1097)
$ grep -E "Tests |Test Files" logs/integrate/test-web.log
 Test Files  59 passed (59)
      Tests  754 passed (754)
$ grep passed logs/integrate/e2e.log
  47 passed (25.2s)
$ git check-ignore logs/integrate/summary.txt
logs/integrate/summary.txt
$ npx prettier --check <los 7 ficheros tocados>
All matched files use Prettier code style!
```

`check-harness` incluye ya `node scripts/integrate.mjs --self-test` (en verde). El builder probó además 4 mutaciones
de la autoprueba sobre una copia fuera del repo (quitar el `break`, no borrar logs viejos, `return 0` en rojo y salida a
`ignore`): las 4 la ponen en rojo.

- **Resultado:** verde.
- **Commit:** el de esta tarea, `[T-08]`.
- **Fuera de alcance, para la auditoría:** los EC-39 de `PipelineScreen.reject.test.tsx` tardan ~1,1 s porque aseguran
  la ausencia del diálogo esperando a que un `findBy` caduque (lento y débil, no intermitente). Windows sin probar
  (`npm` va por la shell en win32).
