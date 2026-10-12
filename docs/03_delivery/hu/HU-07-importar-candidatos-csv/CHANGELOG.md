# Changelog — HU-07 Importar candidatos desde un CSV

Feature en vivo C del taller (FEAT-04, UC-20), rama `vivo/C`. Review: «Aprobado con observaciones» (ronda 1).

## Entradas

### 2026-10-12 — HU-07 completa (TASK-01 a TASK-09 y curado de la review)
- **API:** `POST /api/candidates/import` (DEC-13): cuerpo crudo `text/csv` en un plugin aislado con `bodyLimit` de
  1 048 576 bytes; 200 con el informe `{ dataRows, created, duplicates, invalid, notImported }`; 400 de fichero
  (formato, cabecera, separador «;» de DT-08, sin candidatos, más de 500 filas), 413 con su texto y 500 genérico.
  Parser CSV propio (`csv.ts`), validación del fichero (`import-file.ts`), reglas de fila con el mismo esquema del
  alta (`import-rows.ts`), alta todo o nada con el índice único decidiendo el duplicado (`import.ts`).
- **Web:** pantalla «Importar candidatos» (`/candidates/import`) con el enlace «Importar CSV» desde el listado;
  `postBytes` en `components/http.ts`; informe con «Ver candidato (se abre en una pestaña nueva)».
- **Migraciones:** ninguna.
- **Decisiones:** DEC-13 nueva; aclaraciones fechadas de DEC-07, DEC-08 y DEC-11.4.
- **Tests:** API 78 → 88 ficheros (1 097 → 1 193 tests); web 59 → 65 (762 → 860); e2e 47 → 49.
- **Commits:** `c2473bf` (TASK-01), `c5180fa` (TASK-06), `2e89c03` (TASK-02), `d3acb79` (TASK-07), `96ec230`
  (TASK-03), `b4b646b` (TASK-09), `bde170d` (TASK-04), `8e59e14` (TASK-08), `8b0bf31` (TASK-05) y `db8d59a` (curado).
- **Veredicto:** Aprobado con observaciones (SEC-01, DP-02 y la ratificación de PA-01 a PA-05).
