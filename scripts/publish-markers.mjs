#!/usr/bin/env node
// Marcadores de publicación (T-12 del sprint-02): huecos que se rellenan antes de publicar el repo (el titular, la razón
// social, la URL del marketplace y la del repo publicado). Cada marcador es el nombre en mayúsculas entre ángulos; aquí se construyen
// concatenando para que el literal no aparezca en ningún fichero del repo salvo donde se rellena, y en los docs se
// nombran sin ángulos («el marcador TITULAR»). Un marcador citado entre comillas invertidas también cuenta.
//
// Lo usan `node scripts/check-clean.mjs --publish` (falla con `fichero:línea`) y `npm run check:harness`, que con
// `node scripts/publish-markers.mjs --warn` solo avisa de cuántos quedan (sale siempre con 0).
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';

export const PUBLISH_MARKER_NAMES = ['TITULAR', 'RAZON_SOCIAL', 'URL_MARKETPLACE', 'URL_REPO'];
export const PUBLISH_MARKERS = PUBLISH_MARKER_NAMES.map((name) => '<' + name + '>');

/** Apariciones de los marcadores en un texto: línea (1-based) y nombre del marcador, sin ángulos. */
export function findPublishMarkers(text) {
  const found = [];
  text.split(/\r?\n/).forEach((line, i) => {
    PUBLISH_MARKERS.forEach((marker, m) => {
      if (line.includes(marker)) found.push({ line: i + 1, name: PUBLISH_MARKER_NAMES[m] });
    });
  });
  return found;
}

/** Marcadores en el árbol de trabajo (versionados y nuevos no ignorados, sin binarios), como `fichero:línea`. */
export function scanTreeForMarkers(cwd) {
  const git = (...args) =>
    execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 });
  const root = git('rev-parse', '--show-toplevel').trim();
  const files = git('ls-files', '-z', '--cached', '--others', '--exclude-standard', '--full-name')
    .split('\0')
    .filter(Boolean);
  const findings = [];
  for (const file of new Set(files)) {
    const path = `${root}/${file}`;
    if (!existsSync(path) || !statSync(path).isFile()) continue;
    const buffer = readFileSync(path);
    if (buffer.includes(0)) continue; // binario
    for (const { line, name } of findPublishMarkers(buffer.toString('utf8')))
      findings.push({ where: `${file}:${line}`, name });
  }
  return findings;
}

// `import.meta.main` (Node ≥ 24.2) y no comparar process.argv[1]: bajo enlaces simbólicos esa comparación falla.
if (import.meta.main === true && process.argv.includes('--warn')) {
  const count = scanTreeForMarkers(process.cwd()).length;
  if (count > 0)
    console.log(`  ⚠ publicación: quedan ${count} marcadores (los revisa check-clean --publish)`);
}
