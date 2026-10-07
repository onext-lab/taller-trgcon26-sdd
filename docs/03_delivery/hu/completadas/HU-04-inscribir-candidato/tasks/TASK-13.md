# TASK-13 — Inscribir desde el pipeline: aviso, alertas, recarga y foco

## Metadata
- **HU:** HU-04 · **Feature:** FEAT-03
- **Scope:** frontend
- **Capa:** web
- **Estado:** Completada
- **Prioridad:** Must (RF-08, segunda mitad; RNF-07)
- **Complejidad:** M (1–2 h; estimada 2 h)

## Descripción
Conecta el «Inscribir» de cada resultado con `POST /api/applications` y reparte el resultado entre el panel, la página
y el pipeline (DD-05, DD-06, DD-10).

1. **`applications/use-enrollment.ts`** (nuevo): `pendingId`, guarda `inFlight` por `ref` (un segundo clic no envía
   nada aunque llegue antes del render, como `use-consent-actions.ts`), `useLifetimeSignal`
   (`apps/web/src/components/use-lifetime-signal.ts`), `enrollCandidate({ jobId, candidateId })` y reparto del
   resultado en *callbacks* según `classifyEnrollError`.
2. **`applications/use-pipeline-feedback.ts`** (nuevo): aviso o alerta de la página tras inscribir y el foco sobre
   ellos (DD-10); se limpia al abrir el panel.
3. **`applications/use-enroll-panel.ts`** y **`applications/EnrollPanel.tsx`**: mientras hay una inscripción en curso,
   todos los «Inscribir», «Buscar» y «Cerrar» `disabled`, el pulsado dice «Inscribiendo…» y `Escape` no cierra.
4. **`applications/PipelineScreen.tsx`**: `PipelineLoader` conecta `useEnrollment`, `usePipelineFeedback` y
   `resource.reload()`. Resultado de inscribir:

   | Respuesta | Panel | Página | Pipeline | Foco |
   |---|---|---|---|---|
   | 201 | Se cierra y se descarta | `Notice` «Candidato inscrito.» (`role="status"`) | `reload()` → la tarjeta, la primera de «Recibida» | El aviso |
   | 409 `DUPLICATE` | Sigue abierto con texto y resultados; alerta «Este candidato ya está inscrito en la oferta.» **sin enlace** | — | `reload()` | La alerta del panel |
   | 409 `INVALID_TRANSITION` | Se cierra | Alerta «La oferta ya no está publicada: no admite inscripciones.» | `reload()` → sin «Inscribir candidato» | La alerta de la página |
   | 404 `NOT_FOUND` | Sigue abierto; alerta con el `message` de la API | — | `reload()` (si la oferta ya no existe, «Página no encontrada») | La alerta del panel |
   | Red, *timeout*, 400, 403, 413, 415, 500, respuesta no válida | Sigue abierto; alerta `userMessage(error)` sin *stack* | — | Sin recarga | La alerta del panel |

5. **Test** `apps/web/test/features/applications/PipelineScreen.enroll.test.tsx` (`expectFocusOn` en todo foco movido
   por un efecto):
   - «CA-02 POST con {"jobId":7,"candidateId":12}; aviso Candidato inscrito. con el foco; panel cerrado; recarga sin
     Cargando y la tarjeta la primera de Recibida»;
   - «CA-03 cada Inscribir envía un solo candidateId»;
   - «CA-08/EC-43 DUPLICATE → alerta en el panel sin link, texto y resultados intactos, recarga y ninguna tarjeta
     nueva»;
   - «EC-44 INVALID_TRANSITION → panel cerrado, alerta de la página con el foco, recarga sin Inscribir candidato»;
   - «404 → alerta del panel con el message de la API y recarga»;
   - en curso: botones `disabled`, «Inscribiendo…» y `Escape` no cierra (`mockFetch` con `hang`);
   - abrir el panel limpia el aviso o la alerta de la página.

## Archivos afectados

| Archivo | Cambio | Descripción |
|---|---|---|
| `apps/web/src/features/applications/use-enrollment.ts` | crear | `POST`, guarda `inFlight`, reparto del resultado |
| `apps/web/src/features/applications/use-pipeline-feedback.ts` | crear | Aviso o alerta de la página y su foco |
| `apps/web/src/features/applications/use-enroll-panel.ts` | modificar | Estado «en curso» (`disabled`, `Escape`) |
| `apps/web/src/features/applications/EnrollPanel.tsx` | modificar | «Inscribiendo…», `disabled`, alerta del panel |
| `apps/web/src/features/applications/PipelineScreen.tsx` | modificar | Conexión en `PipelineLoader` (aviso, alertas, `reload`, foco) |
| `apps/web/test/features/applications/PipelineScreen.enroll.test.tsx` | crear | CA-02, CA-03 (web), CA-08, EC-43, EC-44, 404, en curso |

## Implementa
- RF: RF-08 (inscribir) · RNF: RNF-07 (foco al aviso) · CA: CA-02, CA-03 (web), CA-08 · Edge cases: EC-07 (web),
  EC-09 (web), EC-43, EC-44
- Diseño: `plans/TECHNICAL_DOC-frontend.md` § Resultado de inscribir, § Diagrama de secuencia, DD-04, DD-05, DD-06,
  DD-10, § Estrategia de tests (RF-08), § Checklist W4

## Dependencias
- **Depende de:** TASK-04 (endpoint `POST /api/applications`), TASK-12
- **Bloquea:** TASK-14, TASK-15

## Criterios de done
- [ ] `npm test -w @ats/web -- applications/PipelineScreen` en verde, con **4** ficheros de test.
- [ ] `npm test -w @ats/web` completo en verde.
- [ ] `npm run typecheck` sin errores.
- [ ] `npx eslint apps/web/src/features/applications/use-enrollment.ts apps/web/src/features/applications/use-pipeline-feedback.ts apps/web/src/features/applications/use-enroll-panel.ts apps/web/src/features/applications/EnrollPanel.tsx apps/web/src/features/applications/PipelineScreen.tsx apps/web/test/features/applications/PipelineScreen.enroll.test.tsx`
      sin errores.
- [ ] Ningún fichero tocado pasa de 300 líneas tras Prettier; ninguna función de más de 50 líneas.
- [ ] Commit único `feat(web): enroll a candidate from the pipeline [HU-04 TASK-13]`.

## Notas de implementación
- **Foco:** `expectFocusOn` (`apps/web/test/helpers/focus.ts`) para el aviso, las alertas, el campo y el disparador. Un
  botón que pasa a `disabled` pierde el foco: por eso el foco va al mensaje (DD-10).
- **DD-05:** los dos 409 se distinguen por `code` con los textos fijos de la web; `NOT_FOUND` pinta el `message` de la
  API (no lleva datos personales); el resto, `userMessage`. `existingId` se ignora (el enlace es de HU-05).
- **DD-04:** `reload()` no pasa por `loading`, así el panel sigue montado en el 409 `DUPLICATE`.
- La alerta del 409 `DUPLICATE` no lleva ni el nombre ni el `existingId` (RNF-05).
- Datos inventados (`@example.com`).

## Nota · review ronda 1 (2026-10-07)
Se creó además `apps/web/test/features/applications/enroll-fixtures.ts` (helpers sacados del test para no pasar de
300 líneas), y el disparador «Inscribir candidato» queda deshabilitado mientras hay una inscripción en curso
(`apps/web/src/features/applications/PipelineScreen.tsx`), para que no cierre el panel a mitad del envío.
