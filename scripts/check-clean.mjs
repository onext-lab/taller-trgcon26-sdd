// node scripts/check-clean.mjs --denylist <ruta>
//
// Busca términos prohibidos en el árbol de trabajo, en todo el historial (`git log -p --all`,
// mensajes incluidos), en los nombres de ramas y etiquetas y en los mensajes de las etiquetas anotadas.
// Este script no contiene términos: la lista vive fuera del repo y se pasa por argumento.
//
// Formato de la lista (una regla por línea; vacías y las que empiezan por # se ignoran):
//   i:<regex>   expresión regular de JavaScript, sin distinguir mayúsculas
//   c:<regex>   expresión regular de JavaScript, distinguiendo mayúsculas
//
// Informa de cada coincidencia con su fichero, línea o commit y el número de regla,
// SIN imprimir el término ni la línea. Sale con 1 si hay coincidencias o si falta la lista.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';

function usage(message) {
  console.error(`check-clean: ${message}`);
  console.error('Uso: node scripts/check-clean.mjs --denylist <ruta-a-la-lista>');
  process.exit(1);
}

const flagIndex = process.argv.indexOf('--denylist');
const denylistPath = flagIndex === -1 ? undefined : process.argv[flagIndex + 1];
if (!denylistPath) usage('falta --denylist <ruta>.');
if (!existsSync(denylistPath)) usage(`no existe la lista ${denylistPath}.`);

/** @type {{ n: number, line: number, re: RegExp }[]} */
const rules = [];
readFileSync(denylistPath, 'utf8')
  .split(/\r?\n/)
  .forEach((raw, index) => {
    const text = raw.trim();
    if (!text || text.startsWith('#')) return;
    const match = /^([ic]):(.+)$/.exec(text);
    if (!match)
      usage(`la línea ${index + 1} de la lista no tiene el formato i:<regex> o c:<regex>.`);
    try {
      rules.push({
        n: rules.length + 1,
        line: index + 1,
        re: new RegExp(match[2], match[1] === 'i' ? 'i' : ''),
      });
    } catch {
      usage(`la regla de la línea ${index + 1} no es una expresión regular válida.`);
    }
  });
if (rules.length === 0) usage('la lista no tiene reglas.');

function report(findings, scope) {
  const unique = [...new Set(findings)];
  if (unique.length > 0) {
    console.error(`check-clean: ${unique.length} coincidencia(s):`);
    for (const finding of unique) console.error(`  - ${finding}`);
    console.error(
      'Quita el término (o afina la regla en la lista si es un falso positivo) y repite.',
    );
    process.exit(1);
  }
  console.log(`check-clean: 0 coincidencias (${rules.length} reglas · ${scope}).`);
  process.exit(0);
}

const findings = [];
function scan(text, where) {
  for (const rule of rules) {
    if (rule.re.test(text))
      findings.push(`${where} · regla ${rule.n} (línea ${rule.line} de la lista)`);
  }
}

// --file <ruta>: revisa solo ese fichero (lo usa el hook commit-msg con el mensaje del commit).
const fileIndex = process.argv.indexOf('--file');
if (fileIndex !== -1) {
  const single = process.argv[fileIndex + 1];
  if (!single || !existsSync(single)) usage('falta el fichero de --file <ruta>.');
  readFileSync(single, 'utf8')
    .split(/\r?\n/)
    .forEach((line, i) => scan(line, `${single}:${i + 1}`));
  report(findings, single);
}

const git = (...args) =>
  execFileSync('git', args, { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 });
process.chdir(git('rev-parse', '--show-toplevel').trim());

// 1. Árbol de trabajo: ficheros versionados y nuevos no ignorados (nombre y contenido).
const files = git('ls-files', '-z', '--cached', '--others', '--exclude-standard')
  .split('\0')
  .filter(Boolean);
for (const file of new Set(files)) {
  scan(file, `árbol · ${file} (nombre del fichero)`);
  if (!existsSync(file) || !statSync(file).isFile()) continue;
  const buffer = readFileSync(file);
  if (buffer.includes(0)) continue; // binario
  buffer
    .toString('utf8')
    .split(/\r?\n/)
    .forEach((line, i) => scan(line, `árbol · ${file}:${i + 1}`));
}

// 2. Historial completo: mensajes, rutas y cada línea de cada diff, en todas las refs.
const hasCommits = (() => {
  try {
    git('rev-parse', '--verify', 'HEAD');
    return true;
  } catch {
    return false;
  }
})();
if (hasCommits) {
  const log = git('log', '-p', '--all', '--no-color', '--format=%x00COMMIT %h%n%B%x00END');
  let commit = '?';
  let file = 'mensaje';
  let inMessage = false;
  for (const line of log.split('\n')) {
    if (line.startsWith('\0COMMIT ')) {
      commit = line.slice(8);
      file = 'mensaje';
      inMessage = true;
      continue;
    }
    if (line.startsWith('\0END')) {
      inMessage = false;
      continue;
    }
    if (!inMessage && line.startsWith('diff --git ')) {
      file = line.replace(/^diff --git a\/.* b\//, '');
    }
    scan(line, `historial · commit ${commit} · ${inMessage ? 'mensaje' : file}`);
  }

  // 3. Nombres de ramas y etiquetas, y mensajes de etiquetas anotadas.
  for (const ref of git('for-each-ref', '--format=%(refname:short)').split('\n').filter(Boolean)) {
    scan(ref, `ref · ${ref} (nombre)`);
  }
  for (const tag of git('tag', '-l').split('\n').filter(Boolean)) {
    if (git('cat-file', '-t', tag).trim() === 'tag') {
      scan(git('cat-file', '-p', tag), `etiqueta · ${tag} (mensaje)`);
    }
  }
}

report(
  findings,
  `${files.length} ficheros del árbol · historial y refs${hasCommits ? '' : ' (sin commits)'}`,
);
