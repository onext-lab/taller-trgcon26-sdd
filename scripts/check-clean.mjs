// node scripts/check-clean.mjs --denylist <ruta> [--publish --mailmap <ruta> [--publish-denylist <ruta>]]  ·  node scripts/check-clean.mjs --self-test
//
// Busca términos prohibidos en el árbol de trabajo, en todo el historial (`git log -p --all`, mensajes incluidos), en
// los nombres de ramas y etiquetas, en las etiquetas anotadas y en las identidades en bruto (sin `.mailmap`) de autor,
// committer y tagger de todas las refs. Este script no contiene términos: la lista vive fuera del repo.
// Formato de la lista (una regla por línea; vacías y las que empiezan por # se ignoran):
//   i:<regex>   expresión regular de JavaScript, sin distinguir mayúsculas
//   c:<regex>   expresión regular de JavaScript, distinguiendo mayúsculas
// Informa de cada coincidencia con su fichero, línea o commit y el número de regla, SIN imprimir el término, la línea
// ni la identidad. Sale con 1 si hay coincidencias o si falta la lista.
// --publish --mailmap <ruta> (T-12 del sprint-02) es la puerta de publicación: además, falla si falta el `.mailmap`
// (vive fuera del repo), si alguna identidad en bruto no es canónica del `.mailmap` ni de Claude <noreply@anthropic.com>
// (solo dice cuántas) o si queda algún marcador de publicación en el árbol. --self-test se prueba en un repo temporal.
// --publish-denylist <ruta> (T-18; solo con --publish) añade la lista de publicación, con el mismo formato y también
// fuera del repo (los nombres de personas que solo se sustituyen en la copia que se publica). Se aplica en la misma
// pasada a todo lo que escanea la denylist y sus coincidencias son problemas de --publish, con `regla N (línea L de la
// lista de publicación)` y sin el término. Sin coincidencias, dice cuántas reglas se aplicaron.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanIdentities } from './check-clean-identities.mjs';
import {
  git,
  hasCommits,
  makeScanner,
  publishProblems,
  reportPublish,
  runSelfTest,
  scanHistory,
  scanRefs,
  scanTree,
} from './check-clean-modes.mjs';

function usage(message) {
  console.error(`check-clean: ${message}`);
  console.error(
    'Uso: node scripts/check-clean.mjs --denylist <ruta-a-la-lista> [--publish --mailmap <ruta> [--publish-denylist <ruta>]] | --self-test',
  );
  process.exit(1);
}

const argValue = (flag) => {
  const index = process.argv.indexOf(flag);
  return index === -1 ? undefined : process.argv[index + 1];
};

/** Una línea de la lista: la regla, o undefined si está vacía o es un comentario. `of` dice de qué lista es. */
function parseRule(raw, index, of) {
  const text = raw.trim();
  if (!text || text.startsWith('#')) return undefined;
  const match = /^([ic]):(.+)$/.exec(text);
  if (!match)
    usage(`la línea ${index + 1} de la lista${of} no tiene el formato i:<regex> o c:<regex>.`);
  try {
    return { line: index + 1, re: new RegExp(match[2], match[1] === 'i' ? 'i' : '') };
  } catch {
    return usage(
      `la regla de la línea ${index + 1}${of && ` de la lista${of}`} no es una expresión regular válida.`,
    );
  }
}

/**
 * @param {string} listPath
 * @param {string} [of] vacío para la denylist; ` de publicación` para la lista de publicación (sale en los errores)
 * @returns {{ n: number, line: number, re: RegExp }[]}
 */
function loadRules(listPath, of = '') {
  const rules = [];
  readFileSync(listPath, 'utf8')
    .split(/\r?\n/)
    .forEach((raw, index) => {
      const rule = parseRule(raw, index, of);
      if (rule) rules.push({ n: rules.length + 1, ...rule });
    });
  if (rules.length === 0) usage(`la lista${of} no tiene reglas.`);
  return rules;
}

/** Imprime las coincidencias (o el resumen en verde) y devuelve el código de salida. */
function report(findings, rules, scope) {
  const unique = [...new Set(findings)];
  if (unique.length > 0) {
    console.error(`check-clean: ${unique.length} coincidencia(s):`);
    for (const finding of unique) console.error(`  - ${finding}`);
    console.error(
      'Quita el término (o afina la regla en la lista si es un falso positivo) y repite.',
    );
    return 1;
  }
  console.log(`check-clean: 0 coincidencias (${rules.length} reglas · ${scope}).`);
  return 0;
}

/** --publish-denylist <ruta>: sus reglas, o [] si no se pasa. Solo tiene sentido con --publish y sin --file. */
function loadPublishRules() {
  if (!process.argv.includes('--publish-denylist')) return [];
  if (!process.argv.includes('--publish'))
    usage('--publish-denylist solo se usa junto con --publish.');
  if (process.argv.includes('--file')) usage('--publish-denylist no se combina con --file.');
  const listPath = argValue('--publish-denylist');
  if (!listPath || listPath.startsWith('--'))
    usage('falta la ruta de --publish-denylist <ruta> (la lista de publicación).');
  if (!existsSync(listPath)) usage(`no existe la lista de publicación ${listPath}.`);
  return loadRules(listPath, ' de publicación');
}

/** --file <ruta>: revisa solo ese fichero (lo usa el hook commit-msg con el mensaje del commit). */
function runFile({ rules, scan, findings }) {
  const single = argValue('--file');
  if (!single || !existsSync(single)) usage('falta el fichero de --file <ruta>.');
  readFileSync(single, 'utf8')
    .split(/\r?\n/)
    .forEach((line, i) => scan(line, `${single}:${i + 1}`));
  return report(findings, rules, single);
}

/** Puerta de publicación: `.mailmap`, identidades, marcadores y las coincidencias de la lista de publicación. */
function runPublish({ publishRules, publishFindings }, mailmapPath, withCommits) {
  const hits = [...new Set(publishFindings)];
  if (publishRules.length > 0 && hits.length === 0)
    console.log(
      `check-clean --publish: 0 coincidencias de la lista de publicación (${publishRules.length} reglas aplicadas).`,
    );
  return reportPublish([...publishProblems(mailmapPath, withCommits), ...hits]);
}

/** Árbol, historial, refs e identidades; con --publish, además la puerta de publicación. */
function runScan(ctx) {
  const mailmap = argValue('--mailmap');
  const mailmapPath = mailmap && !mailmap.startsWith('--') ? resolve(mailmap) : undefined;
  process.chdir(git('rev-parse', '--show-toplevel').trim());
  const fileCount = scanTree(ctx.scan);
  const withCommits = hasCommits();
  if (withCommits) {
    scanHistory(ctx.scan);
    scanRefs(ctx.scan);
    scanIdentities(git, ctx.scan);
  }
  const scope = `${fileCount} ficheros del árbol · historial, refs e identidades${withCommits ? '' : ' (sin commits)'}`;
  const code = report(ctx.findings, ctx.rules, scope);
  if (!process.argv.includes('--publish')) return code;
  return Math.max(code, runPublish(ctx, mailmapPath, withCommits));
}

/** Lee los argumentos y despacha al modo: --self-test, --file o el escaneo completo (con o sin --publish). */
function main() {
  if (process.argv.includes('--self-test')) return runSelfTest(fileURLToPath(import.meta.url));
  const denylistPath = argValue('--denylist');
  if (!denylistPath) usage('falta --denylist <ruta>.');
  if (!existsSync(denylistPath)) usage(`no existe la lista ${denylistPath}.`);
  const rules = loadRules(denylistPath);
  const publishRules = loadPublishRules();
  const ctx = { rules, publishRules, ...makeScanner(rules, publishRules) };
  return (process.argv.includes('--file') ? runFile : runScan)(ctx);
}

// `import.meta.main` (Node ≥ 24.2) y no comparar process.argv[1]: bajo enlaces simbólicos esa comparación falla.
if (import.meta.main === true) process.exit(main());
