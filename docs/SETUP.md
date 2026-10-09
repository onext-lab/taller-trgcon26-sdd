# Puesta a punto del portátil

Lo que necesitas antes del taller y cómo comprobarlo. Hazlo en casa: el día del taller la wifi es compartida.

## Requisitos

| Requisito | Versión | Para qué |
|---|---|---|
| **Node.js** | **24 LTS, ≥ 24.15** | API, web, tests, hooks de Claude Code y scripts |
| npm | la que trae Node 24 | instalar dependencias (workspaces) |
| git | ≥ 2.30 | ramas por HU y etiquetas por fase |
| Chromium de Playwright | el que instala `npx playwright install chromium` | e2e y QA |
| Claude Code | la última | ejecutar el flujo (skills, agentes y hooks del repo) |
| Puertos libres | 3001 (API) y 5173 (web) para `npm run dev`; 3101 (API) y 5174 (web) para los e2e | desarrollo y `npm run e2e` |

La API escucha en `API_HOST`:`API_PORT`, por defecto `127.0.0.1:3001`; un `API_HOST` vacío también cae a `127.0.0.1`
(`apps/api/src/listen-options.ts`). No la expongas a la red: no tiene login (DEC-04).

Variables de entorno que el repo lee (todas opcionales; sin ellas, los valores por defecto):

| Variable | Por defecto | Quién la lee |
|---|---|---|
| `API_HOST` · `API_PORT` | `127.0.0.1` · `3001` | La API (`apps/api/src/listen-options.ts`); `API_PORT` también el proxy `/api` de Vite (`apps/web/vite.config.ts`) y `npm run check:env` (`scripts/check-env.mjs`) |
| `WEB_PORT` | `5173` | El servidor de Vite (`apps/web/vite.config.ts`) y `npm run check:env` |
| `ATS_DB_PATH` | `data/ats.db` en la raíz del repo | La conexión de la API (`apps/api/src/db/connection.ts`) y `npm run db:reset` (`apps/api/src/db/reset.ts`), que borra ese fichero y sus `-wal` y `-shm` antes de regenerarlo. Una ruta relativa se resuelve desde el directorio del proceso (`apps/api/` con `-w apps/api`) |

Los e2e las fijan solos en `playwright.config.ts` (`data/e2e.db`, 3101 y 5174); no hace falta tocarlas para el taller.

No hace falta Docker, ni Python, ni base de datos instalada, ni ninguna clave: la base de datos es un fichero SQLite que
crea el propio Node.

**Tampoco hace falta ninguna clave de IA.** El ATS no llama a ningún modelo: arrancarlo, pasar los tests y recorrer
las etiquetas funciona sin cuenta en ningún servicio. Claude Code (con tu cuenta) solo hace falta para **repetir el
flujo** tú mismo: lanzar las skills, los agentes y los hooks del repo.

## Por qué Node 24 LTS (≥ 24.15)

- **Es la LTS activa** de Node.
- **La API usa `node:sqlite`**, el SQLite que viene dentro de Node: sin binarios que compilar ni dependencias nativas.
  En Node 24 está en *release candidate* (estabilidad 1.2) desde la v24.15.0, y no necesita ningún flag desde la
  v22.13.0. Fuente: [documentación de `node:sqlite` en Node 24](https://nodejs.org/docs/latest-v24.x/api/sqlite.html),
  consultada el 2026-10-06. En Node 22 sigue siendo experimental (estabilidad 1.1).
- **Node 24 ejecuta TypeScript directamente** (*type stripping*): la API arranca sin paso de compilación.
- En la v24.21.0, la que se probó, `node:sqlite` ya **no emite ningún aviso** de estabilidad al cargarse.

`package.json` lo declara en `engines.node` (`>=24.15`) y `.nvmrc` fija `24`. Además, `.npmrc` activa
`engine-strict=true`: con otra versión, `npm ci` se para con `EBADENGINE` y el mensaje «Not compatible with your
version of node/npm», en lugar de instalar y fallar después en los tests (con Node 20, la API cae con «No such
built-in module: node:sqlite»).

## Cómo instalar Node 24

Elige una de las tres vías:

- **nvm** (macOS y Linux): `nvm install 24 && nvm use 24`. En la raíz del repo basta `nvm use`, que lee `.nvmrc`.
- **fnm** (macOS, Linux y Windows): `fnm install 24 && fnm use 24`.
- **Instalador oficial**: descarga la versión **LTS 24.x** de <https://nodejs.org> e instálala.

Comprueba con `node -v`: debe empezar por `v24.` y ser **24.15.0 o superior**.

## Arranque en 3 comandos

```bash
npm ci                              # dependencias exactas del package-lock.json
npx playwright install chromium     # solo Chromium (descarga grande: hazlo antes del taller)
npm run db:reset && npm run dev     # crea data/ats.db y levanta API (:3001) y web (:5173)
```

Abre <http://127.0.0.1:5173>: tienes que ver «ATS» y «Estado de la API: ok».

`npm run db:reset` carga datos de ejemplo, todos inventados: **10 ofertas** (4 borradores, 4 publicadas y 2 cerradas) y
**30 candidatos** (10 con consentimiento vigente, 4 con el consentimiento retirado y 16 sin él, todos con email
`@example.com`) y **40 inscripciones** con su historial de cambios de etapa: 10 en cada una de tres ofertas publicadas,
ninguna en la cuarta publicada (para ver el pipeline vacío) y 5 en cada una de las dos cerradas. Las fechas de los
candidatos son **relativas al momento del reset** (altas de 3 a 148 días antes), así que ninguno nace vencido y cada
reset las desplaza; las de las inscripciones de las ofertas publicadas también (en las últimas 90 horas), y las de las
cerradas van ancladas a las fechas fijas de sus ofertas. Los candidatos con alguna inscripción abierta no tienen fecha
de fin de retención («Mientras dure el proceso»).

## Comprobación: `npm run check:env`

`npm run check:env` (`scripts/check-env.mjs`) revisa la versión de Node, que los puertos 3001 y 5173 estén libres, que
las dependencias estén instaladas y que esté el Chromium de Playwright. Si algo falla, te dice en castellano qué hacer.
Ejemplo de salida correcta:

```
Comprobando el entorno del taller…
  ✔ Node 24.21.0 (mínimo 24.15.0)
  ✔ Puerto 3001 libre (la API (Fastify))
  ✔ Puerto 5173 libre (la web (Vite))
  ✔ Dependencias instaladas (node_modules)
  ✔ Navegador Chromium de Playwright instalado

Todo listo para el taller.
```

Después, `npm run check:harness` comprueba que el kit de Claude Code (`.claude/` y `docs/`) está completo.

## Integración completa en serie

`npm run integrate` (`scripts/integrate.mjs`) ejecuta toda la verificación **uno detrás de otro**, en este orden:
`npm run typecheck`, `npm run lint`, `npm test -w apps/api`, `npm test -w apps/web`, `npm run e2e` y
`npm run check:harness`. Se para en el primer paso en rojo, te dice cuál falló y dónde está su log, y sale con un código
distinto de 0; si todo pasa, sale con 0.

- **Logs:** la salida completa de cada paso ejecutado va a `logs/integrate/<paso>.log` y la tabla de pasos, resultado y
  segundos, a `logs/integrate/summary.txt`. Se sobrescriben en cada pasada y `logs/` está en `.gitignore`.
- **Cuánto tarda:** 48,2 s en un portátil de 11 núcleos (2026-10-09): typecheck 3,7 · lint 2,9 · unitarios 15,3 · e2e
  25,1 · `check:harness` 1,2. En una máquina más modesta, cuenta con el doble o el triple.
- **Nunca la suite unitaria y los e2e a la vez:** con la CPU saturada, los tests web pueden pasar de su *timeout*
  (10 s, en `apps/web/vite.config.ts`). En serie, cada suite tiene la máquina para ella sola.

## Recorrer el taller por etiquetas

El taller se sigue saltando entre etiquetas git locales, una por fase (`docs/WORKFLOW.md` §10). Lista las que tienes
con `git tag -l`.

| Etiqueta | Qué ves | La app |
|---|---|---|
| `paso-0-kit` | El kit SDD (`.claude/`, `docs/`, `AGENTS.md`, `CLAUDE.md`) y el esqueleto del monorepo | Solo el esqueleto: «Estado de la API: ok» |
| `paso-1-discovery` | Reglas validadas, ideas, features con sus casos de uso y HU, con las preguntas y respuestas | Igual que en `paso-0-kit`: el discovery no toca código |
| `paso-2-sprint-01` | El sprint 01 entregado: 6 HU de PRD a código, reviews, auditoría y cierre | El ATS completo, con el estilo anterior al de `main` |
| `paso-3-punto-de-partida` | README, guion y este `SETUP.md`: el punto de partida del taller | El ATS completo |
| `vivo-{A,C}-{1-feature,2-prd,3-tareas,4-hecho}` | Las features en vivo fase a fase (A: supresión y retención RGPD; C: importación CSV) | Con la feature solo en `vivo-*-4-hecho` |

Para saltar a una etiqueta y volver:

```bash
git status                                            # el árbol tiene que estar limpio antes de saltar
git switch --detach paso-2-sprint-01                   # «detached HEAD»: es normal, solo vas a mirar
npm ci && npm run db:reset                             # dependencias y base de esa etiqueta
git switch main                                        # volver
npm ci && npm run db:reset
```

- **Después de cada salto, `npm ci && npm run db:reset`.** El esquema, las migraciones y el seed cambian entre
  etiquetas: con la base de otra etiqueta, la API falla o enseña datos que no tocan.
- Si has cambiado algo y quieres saltar, guárdalo en una rama tuya (`git switch -c mis-pruebas` y un commit) o
  descártalo con `git restore .`. El repo no usa `git stash`.
- Los e2e de cada etiqueta usan su propia base (`data/e2e.db`); no hace falta nada más.
- Las ramas `hu/HU-NN-slug` siguen en el repo: cada una es la historia de una HU, commit a commit (`[HU-NN TASK-NN]`).

## Versiones fijadas que conviene conocer

- **TypeScript 6.0.3, no 7.x.** `typescript-eslint` 8.71 exige `typescript < 6.1`; con la 7.x el lint deja de
  funcionar. Se sube cuando `typescript-eslint` la soporte. Detalle en
  [DECISIONS.md](07_architecture_principles/DECISIONS.md) (DEC-05).
- Todas las dependencias van fijadas sin `^`: `npm ci` instala exactamente lo mismo en todos los portátiles.

## Problemas frecuentes

| Síntoma | Qué hacer |
|---|---|
| `node -v` muestra v20 o v22 | Activa la 24: `nvm use 24` o `fnm use 24`, y abre una terminal nueva. |
| `npm ci` falla con `EBADENGINE` | La terminal usa otra versión de Node (p. ej., la que `nvm` tiene por defecto). `nvm use` en la raíz del repo (lee `.nvmrc`) o `nvm alias default 24`, y repite. |
| Los tests de la API fallan con «No such built-in module: node:sqlite» | Igual: Node anterior a la 24. `npm run check:env` lo detecta. |
| `check:env` dice que un puerto está ocupado | Cierra el `npm run dev` que tengas abierto en otra terminal. |
| Los e2e no encuentran el navegador | `npx playwright install chromium`. |
| La base de datos tiene datos raros | `npm run db:reset` la regenera desde el esquema, las migraciones y el seed. |
| `npm run e2e` falla porque el puerto 3101 o 5174 está ocupado | Cierra el proceso que lo usa. Los e2e no reutilizan servidores (`reuseExistingServer: false`) para no probar contra otra base. |
| `npm run db:reset` falla con «No such built-in module: node:sqlite» aunque `node -v` dé v24 | `npm` está lanzando otro Node (el de otra terminal o el que `nvm` tiene por defecto). Abre una terminal nueva en la raíz del repo, `nvm use` y repite. |
| Tras saltar de etiqueta, la API falla al arrancar o la web enseña datos raros | Te falta `npm ci && npm run db:reset` después del salto. |
| En macOS, `git` pide aceptar la licencia de Xcode y `npm run check:harness` falla en `git ls-files` | Acepta la licencia (`sudo xcodebuild -license`) o usa un `git` instalado con Homebrew. |
| Con la suite unitaria y los e2e a la vez, tests web fallan por *timeout* | Es la CPU saturada, no un fallo: ejecútalos uno detrás de otro con `npm run integrate` (o `npm test` y después `npm run e2e`). |

## Cómo se preparan los e2e

`npm run e2e` usa su propia base, `data/e2e.db`, y sus propios puertos (3101 la API y 5174 la web), así que se puede
lanzar con `npm run dev` abierto y nunca toca `data/ats.db`. La base se regenera (esquema, migraciones y el mismo seed:
10 ofertas, con 4 borradores, 4 publicadas y 2 cerradas, y 30 candidatos, con 10 con consentimiento vigente, 4 retirado y
16 sin él, con fechas relativas al reset, y 40 inscripciones con su historial) en el comando del `webServer` de la API, en `playwright.config.ts`
(`npm run db:reset -w apps/api && npm run start -w apps/api`). No va en un `globalSetup` porque en Playwright 1.63 el
`webServer` arranca **antes** que `globalSetup`: borrar la base entonces dejaría a la API escribiendo en ficheros ya
borrados. Con `reuseExistingServer: false` y `workers: 1`, dos ejecuciones seguidas dan el mismo resultado.

## Antes de publicar

Lo hace el responsable técnico, en este orden:

1. **Rellena los marcadores de publicación**: TITULAR, RAZON_SOCIAL y URL_MARKETPLACE (entre ángulos en los
   ficheros; la lista está en `scripts/publish-markers.mjs`). `npm run check:harness` avisa de cuántos quedan.
2. **Crea el `.mailmap` fuera del repo**, con el nombre y el email canónicos (el titular) de cada autor, committer y
   tagger. No se versiona: publicaría los emails que mapea.
3. **`node scripts/check-clean.mjs --denylist <ruta> --publish --mailmap <ruta>` en verde**: términos, identidades y
   marcadores. Si fallan las identidades, se reescriben en la copia de publicación, nunca en este repo.
4. **Después, el bundle** (`git bundle create`), desde la copia que ha pasado el paso 3.
