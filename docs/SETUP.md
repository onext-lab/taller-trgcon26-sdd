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
| Puertos libres | 3001 (API) y 5173 (web) | `npm run dev` y los e2e |

No hace falta Docker, ni Python, ni base de datos instalada, ni ninguna clave: la base de datos es un fichero SQLite que
crea el propio Node.

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
