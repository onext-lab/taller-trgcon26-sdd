# TASK-12 — Panel «Inscribir candidato» y búsqueda de candidatos

## Metadata
- **HU:** HU-04 · **Feature:** FEAT-03
- **Scope:** frontend
- **Capa:** web
- **Estado:** Pendiente
- **Prioridad:** Must (RF-08, primera mitad; RNF-05, RNF-07)
- **Complejidad:** L (2–4 h; estimada 3 h)

## Descripción
El panel en línea (no modal, DT-02, DD-02) para buscar candidatos desde el pipeline de una `published`. La acción de
inscribir de cada resultado se conecta en TASK-13: aquí cada «Inscribir» llama a un `onEnroll(candidate)` que recibe
el panel por props.

1. **`applications/use-candidate-search.ts`** (nuevo): texto controlado, error de campo, estado de la búsqueda (`idle`,
   `loading`, `success`, `error`), **un `AbortController` por búsqueda** (una nueva aborta la anterior) y `reset()`.
   Antes de pedir, `validateSearchText` (`apps/web/src/components/list-controls.ts`): con error, mensaje junto al campo,
   foco al campo y **sin petición** (EC-40). Vacío es válido (DD-07): lista los 10 más recientes.
2. **`applications/use-enroll-panel.ts`** (nuevo): abrir y cerrar (disparador, «Cerrar», `Escape` dentro del panel),
   refs del disparador y del campo, foco (al abrir → campo «Nombre o email»; al cerrar sin inscribir → «Inscribir
   candidato»), alerta del panel; compone la búsqueda. Cerrar descarta texto y resultados.
3. **`applications/EnrollPanel.tsx`** (nuevo, presentacional): `<section id="enroll-panel" aria-labelledby>` con `h2`
   «Inscribir candidato»; `<form role="search" aria-label="Buscar candidatos para inscribir" noValidate>` con
   `FormField` id `enroll-q`, *label* «Nombre o email», `input type="search" autoComplete="off"`, `button type="submit"`
   «Buscar» (Enter envía) y `button type="button"` «Cerrar»; «Buscando candidatos…» (`status`); resultados en
   `<table>` con `caption` «Resultados de la búsqueda» (Nombre, Email, Acción), hasta 10 filas en el orden de la API,
   cada fila con `button` «Inscribir» y `aria-describedby` → id de la celda del nombre (DD-11); 0 resultados →
   «Ningún candidato coincide con la búsqueda.» (`status`); `total > 10` → las 10 filas y «Hay más resultados: afina la
   búsqueda.» (`status`); error de búsqueda: 400 con `details` en `q` → junto al campo; resto → `userMessage` con
   `role="alert"` dentro del panel, **conservando lo escrito** (EC-42). Sin marca de «ya inscrito» (DT-02).
4. **`applications/PipelineScreen.tsx`**: `PipelineLoader` usa `useEnrollPanel`; el disparador gana `aria-expanded` y
   `aria-controls="enroll-panel"`; el panel se pinta solo con `open && status === 'published'` (si una recarga trae otra
   cosa, deja de pintarse y su estado se descarta).
5. **`apps/web/src/styles.css`**: `.enroll-panel`.
6. **Test** `apps/web/test/features/applications/PipelineScreen.search.test.tsx` (`expectFocusOn` en todo foco movido
   por un efecto):
   - abrir → foco en «Nombre o email» y `aria-expanded="true"`;
   - Enter y «Buscar» → `GET /api/candidates?q=ana&pageSize=10`; vacío → `GET /api/candidates?pageSize=10`;
   - «EC-41 10 resultados sin nota; 11 → nota "Hay más resultados: afina la búsqueda."; 0 → "Ningún candidato coincide
     con la búsqueda."»;
   - «EC-40 101 caracteres y un carácter de control → error junto al campo, foco en él, 0 peticiones»;
   - «EC-42 error de red al buscar → alerta en el panel y el texto se conserva»; 400 con `details` en `q` → junto al
     campo;
   - «RNF-07 Cerrar y Escape devuelven el foco a Inscribir candidato y descartan texto y resultados»;
   - cada «Inscribir» describe su fila (`aria-describedby` → nombre); todos los controles del buscador con `<label>`.

## Archivos afectados

| Archivo | Cambio | Descripción |
|---|---|---|
| `apps/web/src/features/applications/use-candidate-search.ts` | crear | Estado y validación de la búsqueda |
| `apps/web/src/features/applications/use-enroll-panel.ts` | crear | Abrir, cerrar, `Escape`, foco y alerta del panel |
| `apps/web/src/features/applications/EnrollPanel.tsx` | crear | Formulario, mensajes y tabla de resultados |
| `apps/web/src/features/applications/PipelineScreen.tsx` | modificar | Conexión del panel en `PipelineLoader` y `PipelineContent` |
| `apps/web/src/styles.css` | modificar | `.enroll-panel` |
| `apps/web/test/features/applications/PipelineScreen.search.test.tsx` | crear | RF-08 (buscar), EC-40, EC-41, EC-42, RNF-07 |

## Implementa
- RF: RF-08 (panel y búsqueda) · RNF: RNF-05 (la búsqueda no sale del estado), RNF-07 · Edge cases: EC-40, EC-41,
  EC-42 (buscar)
- Diseño: `plans/TECHNICAL_DOC-frontend.md` § Panel «Inscribir candidato», DD-02, DD-03, DD-07, DD-11, § Estrategia de
  tests (RF-08), § Checklist W3

## Dependencias
- **Depende de:** TASK-11 (comparten `PipelineScreen.tsx` y `styles.css`); la búsqueda usa `GET /api/candidates`, que
  ya existe (HU-03)
- **Bloquea:** TASK-13

## Criterios de done
- [ ] `npm test -w @ats/web -- applications/PipelineScreen` en verde, con **3** ficheros de test.
- [ ] `npm run typecheck` sin errores.
- [ ] `npx eslint apps/web/src/features/applications/use-candidate-search.ts apps/web/src/features/applications/use-enroll-panel.ts apps/web/src/features/applications/EnrollPanel.tsx apps/web/src/features/applications/PipelineScreen.tsx apps/web/test/features/applications/PipelineScreen.search.test.tsx`
      sin errores.
- [ ] Ningún fichero tocado pasa de 300 líneas tras Prettier; ningún componente ni hook de más de 50 líneas por
      función (parte `EnrollPanel` en `EnrollResults` si hace falta, en el mismo fichero).
- [ ] Commit único `feat(web): enroll panel with candidate search [HU-04 TASK-12]`.

## Notas de implementación
- **DD-03:** la búsqueda vive **solo** en el estado del hook: ni URL, ni título, ni `history.state`, ni almacenamiento;
  sin almacén de módulo (no reutilices `candidates/list-state.ts`, que además es interno de `candidates`).
- **Foco:** `expectFocusOn` (`apps/web/test/helpers/focus.ts`) en cada aserción de foco; sin tiempos fijos.
- DD-02: panel no modal, sin trampa de foco (el *Tab* puede salir); el foco al abrir y cerrar se gestiona por `ref`.
- `GET /api/candidates` devuelve también `skills`: no se pintan (RGPD §6.2).
- `mockFetch` con `hang` sirve para el estado «Buscando candidatos…».
- Datos inventados (`@example.com`).
