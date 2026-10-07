# TASK-14 — Pipeline y detalle frente a hostiles, dobles envíos y fugas en el navegador [adversarial]

## Metadata
- **HU:** HU-05 · **Feature:** FEAT-03
- **Scope:** test
- **Capa:** web
- **Estado:** Pendiente
- **Prioridad:** Must (RF-05, RF-06, RF-07, RF-08)
- **Complejidad:** M (1–2 h; estimada 2 h). El TD-frontend la estima en «M, ~2,5 h»; para que sea M (gate 4) sin pasar
  de 15 tareas, dos comprobaciones no hostiles van a su tarea natural (ver «Notas»)

## Descripción
W6 del diseño, en dos ficheros nuevos de `apps/web/test/features/applications/`. Si un caso destapa un bug, se arregla
en el código de producción dentro de esta tarea.

1. **`PipelineScreen.stage-adversarial.test.tsx`** (~240):
   - **Seguridad (EC-34, RNF-07):** candidato con nombre `<img src=x onerror=alert(1)>` → el enlace y los nombres
     accesibles de «Avanzar …» y «Rechazar …» lo llevan como texto; ningún `img` en el DOM.
   - **Idempotencia (EC-35, EC-41):** doble clic en «Avanzar a Entrevista» y doble clic en «Rechazar» del diálogo → **1**
     `POST` cada uno.
   - **Idempotencia (EC-10 en la web):** 200 de un reintento → éxito («Inscripción avanzada a {etapa}.»).
   - **Input inválido y seguridad (EC-01, EC-09):** 400, 403 y 200 con forma inesperada al avanzar → alerta
     `userMessage`, sin recarga.
   - **Seguridad (EC-40, RNF-06):** nota con un email inventado y HTML → ni en la URL, ni en `document.title`, ni en
     `history.state`, ni en `localStorage`/`sessionStorage`, ni en la tarjeta tras recargar.
   - **Concurrencia (EC-48):** la recarga tras una acción trae la oferta `closed` → 0 botones de tarjeta y ningún
     diálogo pintado.
2. **`ApplicationDetailScreen.adversarial.test.tsx`** (~110):
   - **Seguridad (EC-46, RNF-07):** nombre y nota con `<img src=x onerror=alert(1)>` → texto; ningún `img`; título
     «Inscripción · ATS» sin el nombre.
   - **Seguridad (EC-23):** campos `email`/`phone` de más en la respuesta → no se pintan (ningún `@` en el DOM).
   - **RNF-07:** `grep -r dangerouslySetInnerHTML apps/web/src/features/applications/` vacío (criterio de done).

## Archivos afectados

| Archivo | Cambio | Descripción |
|---|---|---|
| `apps/web/test/features/applications/PipelineScreen.stage-adversarial.test.tsx` | crear | EC-01, EC-09, EC-10, EC-34, EC-35, EC-40, EC-41, EC-48 |
| `apps/web/test/features/applications/ApplicationDetailScreen.adversarial.test.tsx` | crear | EC-23, EC-46 |
| `apps/web/src/features/applications/*.ts(x)` | modificar solo si un caso destapa un bug | Arreglo mínimo, citado en el commit |

## Implementa
- RF: RF-05, RF-06, RF-07, RF-08 · EC: EC-01, EC-09, EC-10, EC-23, EC-34, EC-35, EC-40, EC-41, EC-46, EC-48 · RNF:
  RNF-06, RNF-07
- Diseño: `plans/TECHNICAL_DOC-frontend.md` § Error paths, § Threat modeling, § Datos personales, § Estrategia de tests
  (fila `[adversarial]`), § Checklist W6

## Dependencias
- **Depende de:** TASK-10 (detalle), TASK-13 (avanzar y rechazar completos)
- **Bloquea:** nada

## Criterios de done
- [ ] `npm test -w @ats/web -- features/applications/PipelineScreen.stage-adversarial features/applications/ApplicationDetailScreen.adversarial`
      en verde con **2** ficheros, con estos nombres: «EC-34 nombre con HTML en el enlace y en los nombres accesibles:
      texto, ningún img»; «EC-35 doble clic en Avanzar = 1 POST»; «EC-41 doble clic en Rechazar del diálogo = 1 POST»;
      «EC-10 un 200 de reintento es éxito»; «EC-01/EC-09 400, 403 y forma inesperada → alerta sin recarga»; «EC-40
      nota fuera de URL, título, history.state, localStorage, sessionStorage y tarjeta»; «EC-48 la recarga trae closed:
      sin acciones ni diálogos»; «EC-46 nombre y nota con HTML como texto, título Inscripción · ATS»; «EC-23 email y
      phone de más no se pintan».
- [ ] `grep -rn dangerouslySetInnerHTML apps/web/src/features/applications/` sin resultados (RNF-07).
- [ ] `npm test -w @ats/web` en verde (sin regresiones).
- [ ] `npm run typecheck` sin errores.
- [ ] `npx eslint apps/web/test/features/applications/PipelineScreen.stage-adversarial.test.tsx apps/web/test/features/applications/ApplicationDetailScreen.adversarial.test.tsx`
      (y producción si se toca) sin errores.
- [ ] Ningún fichero tocado pasa de 300 líneas tras Prettier (`wc -l`).
- [ ] Commit único `test(web): hostile names and notes, double submits and browser leaks on stage changes [HU-05 TASK-14]`.

## Notas de implementación
- **Ajuste respecto al TD (gate 4):** «salir de la pantalla con la petición en vuelo» pasa a TASK-12 (dueña de
  `useLifetimeSignal`) y «`note` en un cambio no final o `reason` en uno no rechazado → error» (EC-45) pasa a
  `api.stage.test.ts` de TASK-09 (dueña de `isApplicationDetail`). Así esta tarea queda en M (2 h).
- `history.state` y el almacenamiento se leen tras cada paso del rechazo (abrir, escribir, enviar, recargar).
- `mockFetch` con `hang` para el doble clic; `expectFocusOn` si se aserta foco.
- Datos inventados; el email de EC-40 con `@example.com`.
