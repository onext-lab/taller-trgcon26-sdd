# Arquitectura del ATS

Backbone corto del ATS de ejemplo. Las decisiones que lo fijan están en
[DECISIONS.md](07_architecture_principles/DECISIONS.md); el detalle de cada módulo, en `docs/05_modules/{módulo}/`
(lo crea `/module-sync` con la primera HU de cada módulo).

## Qué es

Un **ATS** (*applicant tracking system*) mínimo para un equipo de selección: publicar ofertas, dar de alta candidatos,
inscribirlos en ofertas y moverlos por las etapas del proceso. Lo usa un único rol, el **reclutador**, sin login
(DEC-04). Todos los datos son inventados.

## Piezas

```
navegador ──► apps/web (React + Vite, :5173) ──/api (proxy de Vite)──► apps/api (Fastify, :3001) ──► data/ats.db (node:sqlite)
                                                                         ▲
e2e/ (Playwright, Chromium) ── levanta api :3101 + web :5174 ────────────┘   (con data/e2e.db regenerada)
```

| Pieza | Ruta | Responsabilidad |
|---|---|---|
| API | `apps/api/src/` | Rutas REST bajo `/api`, validación con JSON Schema, reglas de negocio y acceso a datos |
| Arranque de la API | `apps/api/src/app.ts`, `apps/api/src/server.ts`, `apps/api/src/listen-options.ts` | `buildApp({ db, logger?, now? })` para tests (`fastify.inject`); `server.ts` escucha donde dice `listen-options.ts` (`127.0.0.1:3001` salvo `API_HOST`/`API_PORT`) |
| Errores y validación | `apps/api/src/http/`, `apps/api/src/errors.ts` | Manejador único del envelope, opciones de Ajv y recorte previo (DEC-11); `AppError` de los servicios |
| Reloj y transacciones | `apps/api/src/clock.ts`, `apps/api/src/db/transaction.ts` | `Clock` inyectado (DEC-09) y `withTransaction`, que se une a una en curso (DEC-06) |
| Base de datos | `apps/api/src/db/` | `connection.ts`, `schema.sql`, `migrations/`, `migrate.ts`, `seed.ts`, `reset.ts` |
| Web | `apps/web/src/` | Pantallas por feature; router y cliente HTTP propios y componentes compartidos en `apps/web/src/components/` |
| E2E | `e2e/` | Smokes y flujos en Chromium, en los puertos 3101 (API) y 5174 (web) sobre `data/e2e.db`, que el `webServer` regenera en cada ejecución |
| Scripts | `scripts/` | `dev`, `check:env`, `check:harness`, `next-id` |

## Módulos

| Módulo (docs) | Código API | Código web | Entidades |
|---|---|---|---|
| ofertas | `apps/api/src/modules/jobs/` | `apps/web/src/features/jobs/` | `JobOpening` (`draft` → `published` → `closed`) |
| candidatos | `apps/api/src/modules/candidates/` | `apps/web/src/features/candidates/` | `Candidate` (contacto, resumen, skills, consentimiento, fin de retención) |
| inscripciones | `apps/api/src/modules/applications/` | `apps/web/src/features/applications/` | `Application` (`received → screening → interview → offer → hired \| rejected`), `StageChange` |

Las carpetas de módulo se crean con la primera HU que las necesite. El mapa vivo está en [_modules.md](_modules.md).

## Convenciones

- **Capas en la API, por módulo:** `routes.ts` (rutas y JSON Schema) → `service.ts` (reglas de negocio) →
  `repository.ts` (SQL con sentencias preparadas). Las rutas no tocan SQL; los repositorios no conocen HTTP.
- **Errores:** envelope uniforme `{ error: { code, message, details? } }` con códigos estables: los de DEC-07
  (`VALIDATION_ERROR`, `NOT_FOUND`, `DUPLICATE`, `INVALID_TRANSITION`, `STAGE_MISMATCH`…) y los de DEC-11
  (`INTERNAL_ERROR`, `PAYLOAD_TOO_LARGE`, `UNSUPPORTED_MEDIA_TYPE`, `BAD_REQUEST`). Nunca *stack traces* ni datos
  personales en la respuesta.
- **Fechas:** ISO 8601 en UTC (`2026-10-22T09:30:00.000Z`) en la API y en SQLite.
- **IDs:** enteros autoincrementales de SQLite.
- **Esquema:** cada cambio de modelo es una migración nueva en `apps/api/src/db/migrations/` (DEC-03).
- **Web:** una carpeta por feature con sus componentes, su cliente de API y sus tests; los componentes reutilizables,
  en `apps/web/src/components/`. Accesibilidad: roles y etiquetas que Testing Library y Playwright usan como selectores.
- **Datos personales:** se tratan según [RGPD.md](RGPD.md): minimización, retención y supresión.
