# Changelog — HU-02 Publicar, cerrar, duplicar y listar ofertas con filtros

> Lo escribe `/reviewer` al aprobar la HU. Una entrada por task entregada, en lenguaje funcional (qué puede hacer ahora
> el reclutador), no técnico.

**Veredicto:** `Aprobado con observaciones` (ronda 2, `review/REVIEW.md`; ronda 1 en `review/REVIEW-ronda-1.md`).
**Endpoints nuevos:** `POST /api/jobs/:id/publish`, `POST /api/jobs/:id/close`, `GET /api/jobs/:id/close-preview`,
`POST /api/jobs/:id/duplicate`; `GET /api/jobs` gana `status`, `q`, `page` y `pageSize`; `PATCH` y `DELETE` comprueban
el estado (409). Todas las escrituras: 403 desde otro sitio (DEC-12).
**Pantallas:** listado con filtros y paginación; ficha por estado con publicar, cerrar (con diálogo) y duplicar;
edición de una publicada y aviso de solo lectura de una cerrada.
**Migraciones:** ninguna (la 001 ya traía las columnas y los CHECK). **Seed:** 10 ofertas (4 borradores, 4 publicadas y
2 cerradas).

## Entradas

### 2026-10-06 — TASK-01 a TASK-06: la API del ciclo de vida
- **Tipo:** feature y test
- **Qué se entregó:** el reclutador publica (con aviso de lo que falta), cierra en una sola transacción (preparada para
  rechazar inscripciones en HU-05), duplica cualquier oferta, no puede editar una cerrada ni borrar una publicada, y
  busca ofertas por estado y por título sin importar tildes ni mayúsculas, con paginación. Las escrituras desde otra web
  se rechazan.
- **Archivos afectados:** `apps/api/src/http/cross-site.ts`, `apps/api/src/db/text-search.ts`,
  `apps/api/src/modules/jobs/{rules,applications-port,repository,service,routes,schemas}.ts`, `apps/api/src/db/seed.ts`
- **Commit:** `901426a`, `c9bd3c1`, `8996219`, `d1659f4`, `211315e`, `b7d4778` · review: `8e82883`, `647ba95`, `28cf878`
- **Desviaciones del PRD:** EC-49 y DT-09 (DEC-12) añadidos en el diseño y enmendados en la review (PRD v1.3)

### 2026-10-06 — TASK-07 a TASK-13: la web del ciclo de vida
- **Tipo:** feature y test
- **Qué se entregó:** filtros en la URL (estado y título), paginación con «Por página» 20/50/100, acciones de la ficha
  según el estado, diálogo de cierre con el número de inscripciones activas, publicar y duplicar con su aviso, edición de
  una publicada con los obligatorios marcados y la ficha de solo lectura de una cerrada.
- **Archivos afectados:** `apps/web/src/components/{router.tsx,use-resource.ts,ConfirmDialog.tsx}`,
  `apps/web/src/features/jobs/*`, `apps/web/src/styles.css`
- **Commit:** `fa59f93`, `e1fbc34`, `6c7e58a`, `2b9d535`, `c191da4`, `510ad14`, `f4245a3` · review: `5344036`, `e805bb6`,
  `c1d98c0`
- **Desviaciones del PRD:** ninguna (CA-18 se alineó con el PRD en la review)

### 2026-10-06 — TASK-14: recorridos e2e
- **Tipo:** test
- **Qué se entregó:** 12 recorridos nuevos (ciclo de vida y listado filtrado) sobre la base regenerada en cada ejecución.
- **Archivos afectados:** `e2e/jobs-lifecycle.spec.ts`, `e2e/jobs-list.spec.ts`, `e2e/jobs.spec.ts`
- **Commit:** `b669cc0`
- **Desviaciones del PRD:** ninguna
