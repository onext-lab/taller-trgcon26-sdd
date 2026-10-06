# TASK-09 — Router, carga de datos y componentes compartidos de la web [setup]

## Metadata
- **HU:** HU-01 · **Feature:** FEAT-01
- **Scope:** frontend
- **Estado:** Completada
- **Prioridad:** Must (bloquea todas las pantallas)
- **Complejidad:** L (2–4 h; estimada 3 h)

## Descripción
Piezas transversales de la web, reutilizables por HU-02 a HU-05, sin dependencias nuevas (DEC-05):
- Router mínimo propio sobre la History API (DD-01).
- Hook `useResource` para las lecturas (cargando / error / datos + `retry`, con `AbortController`; DD-03).
- Componentes: mensajes de estado, campo de formulario accesible, diálogo de confirmación con `<dialog>` nativo (DD-05)
  y el estado de la API (lo que hoy hace `App.tsx`, que se moverá al pie en TASK-10; DD-07).
- Estilos mínimos accesibles y su importación en `main.tsx`.
- *Polyfill* de `showModal`/`close` para jsdom.

`App.tsx` **no** se toca en esta tarea (lo cambia TASK-10). Puede ir en paralelo con TASK-08 y con el backend (no
comparten ficheros).

## Archivos afectados

| Archivo | Cambio | Descripción |
|---|---|---|
| `apps/web/src/components/router.tsx` | crear | `usePath`, `navigate`, `Link`, `matchPath` y lectura del aviso de `history.state` (~80 líneas) |
| `apps/web/src/components/use-resource.ts` | crear | `useResource(load, deps)` |
| `apps/web/src/components/StatusMessages.tsx` | crear | `LoadingMessage`, `ErrorMessage` (con «Reintentar»), `Notice` |
| `apps/web/src/components/FormField.tsx` | crear | `label` + control + ayuda + error con `aria-describedby` |
| `apps/web/src/components/ConfirmDialog.tsx` | crear | `<dialog>` modal de confirmación, reutilizable |
| `apps/web/src/components/ApiHealth.tsx` | crear | «Estado de la API: …» (lógica actual de `App.tsx`) |
| `apps/web/src/styles.css` | crear | Foco visible, errores, tabla, `.visually-hidden`, textos largos |
| `apps/web/src/main.tsx` | modificar | Importa `./styles.css` |
| `apps/web/test/helpers/dialog.ts` | crear | *Polyfill* de `HTMLDialogElement.prototype.showModal`/`close` para jsdom |
| `apps/web/test/components/router.test.tsx` | crear | `Link` y `navigate` |
| `apps/web/test/components/ConfirmDialog.test.tsx` | crear | Foco inicial, cancelar y devolución del foco |

## Implementa
- RF: base de RF-01 a RF-06 (web) · RNF: RNF-05 (accesibilidad) · DT-02 (diálogo con foco inicial en «Cancelar»)
- Diseño: `plans/TECHNICAL_DOC-frontend.md` § Enfoque técnico, § Pantallas y estados (Shell, avisos, Diálogo de
  borrado, Accesibilidad), DD-01, DD-03, DD-05, DD-07, § Datos personales, § Checklist pasos 3 y 7 (parte transversal)

## Dependencias
- **Depende de:** nada
- **Bloquea:** TASK-10

## Criterios de done
- [ ] `<Link>` renderiza un `<a href>` real; el clic primario sin modificadores navega con `pushState` sin recargar; con
      Ctrl/Meta/Shift/Alt o botón no primario, **no** intercepta.
- [ ] `navigate(to, { replace?, notice? })` actualiza `usePath()` y guarda el aviso (texto fijo) en `history.state`;
      «atrás» (`popstate`) actualiza la ruta.
- [ ] `ConfirmDialog` abre con `showModal()`, foco inicial en «Cancelar»; `Escape` (evento `cancel`) y «Cancelar»
      cierran y devuelven el foco al elemento que lo abrió; con `busy`, los dos botones quedan `disabled`.
- [ ] `npm test -w apps/web -- router ConfirmDialog App.test` en verde, con **3** ficheros de test ejecutados (`App.test.tsx`
      sigue en verde sin tocarlo).
- [ ] `npm run typecheck` sin errores.
- [ ] `npx eslint apps/web/src/components apps/web/src/main.tsx apps/web/test/helpers/dialog.ts apps/web/test/components`
      sin errores.
- [ ] Commit único `feat(web): router, data hook and shared components [HU-01 TASK-09]` nombrando los ficheros.

## Notas de implementación

**Router** (DD-01, `router.tsx`, ≈ 80 líneas):
- `usePath()` con `useSyncExternalStore` sobre `popstate` (y un evento propio que dispare `navigate`).
- `navigate(to, { replace?, notice? })`: `pushState` o `replaceState`; `notice` es un **texto fijo** («Oferta creada.»,
  «Cambios guardados.», «Oferta borrada.») que viaja en `history.state` y que la pantalla de destino muestra con
  `Notice`. El diseño no nombra la función de lectura del aviso: exponla desde `router.tsx`.
- `<Link to>` renderiza `<a href={to}>` e intercepta **solo** el clic primario sin modificadores (enlaces reales: abren
  en pestaña nueva y funcionan con el teclado).
- `matchPath(pattern, path)` para `/jobs/:id` y `/jobs/:id/edit` (devuelve los parámetros como texto; la conversión es
  de `parseJobId`, TASK-08).
- Vite ya sirve `index.html` en cualquier ruta: `page.goto('/jobs/7')` funciona sin configuración.
- **Nunca datos personales en la URL ni en `history.state`** (regla para las HU de candidatos). La web no usa
  `localStorage`, `sessionStorage` ni *cookies*.

**`useResource(load, deps)`** (DD-03) → `{ state: 'loading' | 'error' | 'success', data, error, retry }`. Crea un
`AbortController` por carga, aborta en el desmontaje y al cambiar `deps`, e ignora respuestas obsoletas (con
`StrictMode` el efecto se ejecuta dos veces en desarrollo). Una cancelación propia no pasa a `error`. Sin caché.

**`StatusMessages.tsx`**: `LoadingMessage` → `role="status"` (p. ej. «Cargando ofertas…»); `ErrorMessage` →
`role="alert"` con el mensaje y un `<button>` «Reintentar» que llama a `retry`; `Notice` → `role="status"`.

**`FormField.tsx`**: `<label>` asociado al control; ayuda opcional; si hay error, `aria-invalid="true"` en el control y
`<p id="{campo}-error">` enlazado con `aria-describedby` (junto con la ayuda, si la hay). Componente genérico (input,
textarea o select como hijo o por *prop*: a tu elección, sin `maxLength` nativo).

**`ConfirmDialog.tsx`** (DD-05, genérico; HU-02 lo usará para cerrar ofertas): `<dialog aria-labelledby
aria-describedby>` abierto con `showModal()` (hace inerte el resto de la página). Recibe título, texto, etiqueta de
confirmación, `busy`, un posible mensaje de error (se pinta con `role="alert"` **dentro** del diálogo) y los
*callbacks*. Foco inicial en «Cancelar»; `Escape` dispara `cancel`, que cierra; al cerrar sin confirmar, el foco vuelve
al disparador. En HU-01 lo usa `DeleteJobAction` (TASK-11) con título «¿Borrar la oferta?», texto «Vas a borrar
«{título}». No se puede deshacer.» y botones «Cancelar» y «Borrar oferta».

**`ApiHealth.tsx`** (DD-07): mueve la lógica actual de `apps/web/src/App.tsx` (`fetch('/api/health')` con
`AbortController`) y pinta «Estado de la API: comprobando | ok | sin conexión» con `role="status"`, como hoy, para que
`docs/SETUP.md` y `README.md` sigan valiendo.

**`styles.css`**: texto `#1a1a1a` y errores `#b00020` sobre blanco (contraste AA); `:focus-visible { outline: 3px
solid … }`; tabla legible; `.visually-hidden`; `overflow-wrap: anywhere` en textos largos; clase para la descripción
con `white-space: pre-wrap`.

**`test/helpers/dialog.ts`**: jsdom no implementa `showModal`/`close`; el *polyfill* pone/quita el atributo `open`,
dispara `close` y permite simular `cancel`. La trampa de foco y `Escape` reales se prueban en Playwright (TASK-15).

**Tests**:
- `router.test.tsx`: `Link` sin modificadores navega; con Ctrl no; `navigate` con `notice` lo deja legible en destino.
- `ConfirmDialog.test.tsx`: foco inicial en «Cancelar»; el evento `cancel` cierra y devuelve el foco; «Cancelar» no
  llama a `onConfirm`; con `busy`, botones `disabled`.
- Consultas por rol y nombre (`getByRole('dialog', { name: '¿Borrar la oferta?' })`, `getByRole('button', { name:
  'Cancelar' })`).

## Reapertura · review ronda 1 (2026-10-06)
- **Origen:** `review/REVIEW.md` (ronda 1, `VERDICT: Requiere cambios`), §9.
- **Qué hay que hacer:** (1) `ConfirmDialog` (`apps/web/src/components/ConfirmDialog.tsx:17`) tiene 66 líneas y el umbral es 50: pártelo (p. ej., un hook para abrir/cerrar y el foco, y el JSX) sin cambiar su API ni su comportamiento. (2) DP-02: en `apps/web/test/components/router.test.tsx:108` el fixture `'Ana Pérez'` es un nombre corriente sin marca de ficción; cámbialo por un valor inequívocamente inventado (p. ej. `'Nombre Inventado'`).
- **Ficheros:** `apps/web/src/components/ConfirmDialog.tsx`, `apps/web/test/components/router.test.tsx`
- **Criterios de done:** `npm test -w apps/web -- ConfirmDialog router DeleteJobAction` en verde con 3 ficheros y el mismo número de tests que antes; `npm run typecheck`; `npx eslint` de los 2 ficheros; ninguna función de `ConfirmDialog.tsx` pasa de 50 líneas (pega su recuento).
