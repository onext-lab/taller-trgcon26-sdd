// node scripts/check-clean.mjs --denylist <ruta> [--publish --mailmap <ruta>]  ·  node scripts/check-clean.mjs --self-test
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
import { execFileSync, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { devNull, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildSelfTestRepo,
  identitiesProblem,
  MAILMAP_HELP,
  scanIdentities,
  SELF_TEST_INPUTS,
  selfTestEnv,
} from './check-clean-identities.mjs';
import { PUBLISH_MARKERS, scanTreeForMarkers } from './publish-markers.mjs';

function usage(message) {
  console.error(`check-clean: ${message}`);
  console.error(
    'Uso: node scripts/check-clean.mjs --denylist <ruta-a-la-lista> [--publish --mailmap <ruta>] | --self-test',
  );
  process.exit(1);
}

const argValue = (flag) => {
  const index = process.argv.indexOf(flag);
  return index === -1 ? undefined : process.argv[index + 1];
};

/** @returns {{ n: number, line: number, re: RegExp }[]} */
function loadRules(denylistPath) {
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

const git = (...args) =>
  execFileSync('git', args, { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 });

function hasCommits() {
  try {
    git('rev-parse', '--verify', 'HEAD');
    return true;
  } catch {
    return false;
  }
}

/** 1. Árbol de trabajo: ficheros versionados y nuevos no ignorados (nombre y contenido). */
function scanTree(scan) {
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
  return files.length;
}

/** 2. Historial completo: mensajes, rutas y cada línea de cada diff, en todas las refs. */
function scanHistory(scan) {
  const log = git('log', '-p', '--all', '--no-color', '--format=%x00COMMIT %h%n%B%x00END');
  let commit = '?';
  let file = 'mensaje';
  let inMessage = false;
  for (const line of log.split('\n')) {
    if (line.startsWith('\0COMMIT ')) {
      [commit, file, inMessage] = [line.slice(8), 'mensaje', true];
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
}

/** 3. Nombres de ramas y etiquetas, y etiquetas anotadas (cabecera con el tagger y mensaje). */
function scanRefs(scan) {
  for (const ref of git('for-each-ref', '--format=%(refname:short)').split('\n').filter(Boolean)) {
    scan(ref, `ref · ${ref} (nombre)`);
  }
  for (const tag of git('tag', '-l').split('\n').filter(Boolean)) {
    if (git('cat-file', '-t', tag).trim() === 'tag') {
      scan(git('cat-file', '-p', tag), `etiqueta · ${tag} (cabecera y mensaje)`);
    }
  }
}

/** Problemas de la puerta de publicación: `.mailmap`, identidades fuera de él y marcadores en el árbol. */
function publishProblems(mailmapPath, withCommits) {
  const problems = [];
  if (!mailmapPath) problems.push(`falta --mailmap <ruta>. ${MAILMAP_HELP}`);
  else if (!existsSync(mailmapPath))
    problems.push(`no existe el fichero de --mailmap. ${MAILMAP_HELP}`);
  else if (withCommits) {
    const problem = identitiesProblem(git, readFileSync(mailmapPath, 'utf8'));
    if (problem) problems.push(problem);
  }
  for (const { where, name } of scanTreeForMarkers(process.cwd()))
    problems.push(`marcador de publicación ${name} · ${where}: rellénalo antes de publicar.`);
  return problems;
}

function reportPublish(problems) {
  if (problems.length === 0) {
    console.log('check-clean --publish: identidades y marcadores listos para publicar.');
    return 0;
  }
  console.error(`check-clean --publish: ${problems.length} problema(s) para publicar:`);
  for (const problem of problems) console.error(`  - ${problem}`);
  return 1;
}

function main() {
  const denylistPath = argValue('--denylist');
  if (!denylistPath) usage('falta --denylist <ruta>.');
  if (!existsSync(denylistPath)) usage(`no existe la lista ${denylistPath}.`);
  const rules = loadRules(denylistPath);
  const findings = [];
  const scan = (text, where) => {
    for (const rule of rules) {
      if (rule.re.test(text))
        findings.push(`${where} · regla ${rule.n} (línea ${rule.line} de la lista)`);
    }
  };
  // --file <ruta>: revisa solo ese fichero (lo usa el hook commit-msg con el mensaje del commit).
  if (process.argv.includes('--file')) {
    const single = argValue('--file');
    if (!single || !existsSync(single)) usage('falta el fichero de --file <ruta>.');
    readFileSync(single, 'utf8')
      .split(/\r?\n/)
      .forEach((line, i) => scan(line, `${single}:${i + 1}`));
    return report(findings, rules, single);
  }
  const mailmap = argValue('--mailmap');
  const mailmapPath = mailmap && !mailmap.startsWith('--') ? resolve(mailmap) : undefined;
  process.chdir(git('rev-parse', '--show-toplevel').trim());
  const fileCount = scanTree(scan);
  const withCommits = hasCommits();
  if (withCommits) {
    scanHistory(scan);
    scanRefs(scan);
    scanIdentities(git, scan);
  }
  const scope = `${fileCount} ficheros del árbol · historial, refs e identidades${withCommits ? '' : ' (sin commits)'}`;
  const code = report(findings, rules, scope);
  if (!process.argv.includes('--publish')) return code;
  return Math.max(code, reportPublish(publishProblems(mailmapPath, withCommits)));
}

// ---------- autoprueba: repo git temporal con identidades inventadas (fixture en check-clean-identities.mjs) ----------
// Casos: [qué se prueba, argumentos, código esperado, patrones de la salida]. D y C son la denylist sucia y la limpia
// (sin --denylist se usa C), M y F el .mailmap parcial y el completo, y X uno que no existe. Antes del último caso se
// deja un marcador en el árbol del repo temporal.
const SELF_CASES = [
  [
    'modo normal',
    ['--denylist', 'D'],
    1,
    [
      /autor \(email\) · regla 1 /,
      /committer \(nombre\) · regla 2 /,
      /v1 · tagger \(nombre\) · regla 3 /,
    ],
  ],
  [
    '--publish con una identidad fuera del .mailmap',
    ['--publish', '--mailmap', 'M'],
    1,
    [/1 commit\(s\) y 1 etiqueta\(s\)/, /2 identidad\(es\) distinta\(s\)/],
  ],
  ['--publish con todas mapeadas o de Claude', ['--publish', '--mailmap', 'F'], 0, [/listos/]],
  ['--publish sin --mailmap', ['--publish'], 1, [/falta --mailmap/, /titular/]],
  ['--publish con un --mailmap que no existe', ['--publish', '--mailmap', 'X'], 1, [/no existe/]],
  ['--publish con un marcador', ['--publish', '--mailmap', 'F'], 1, [/TITULAR · marca\.md:2/]],
];

function runSelfCases(tmp, repo, env) {
  const file = (name, text) => (writeFileSync(join(tmp, name), text), join(tmp, name));
  const { dirty, clean, partialMailmap, fullMailmap, leaks } = SELF_TEST_INPUTS;
  const paths = { D: file('denylist-sucia', dirty), C: file('denylist-limpia', clean) };
  paths.M = file('mailmap-parcial', partialMailmap);
  paths.F = file('mailmap-completo', fullMailmap);
  paths.X = join(tmp, 'no-existe');
  const self = fileURLToPath(import.meta.url);
  const failures = [];
  for (const [i, [label, args, wantCode, patterns]] of SELF_CASES.entries()) {
    if (i === SELF_CASES.length - 1)
      writeFileSync(join(repo, 'marca.md'), `línea\nfirma: ${PUBLISH_MARKERS[0]}\n`);
    const argv = args[0] === '--denylist' ? args : ['--denylist', 'C', ...args];
    const r = spawnSync(process.execPath, [self, ...argv.map((a) => paths[a] ?? a)], {
      cwd: repo,
      env,
      encoding: 'utf8',
    });
    const out = `${r.stdout}${r.stderr}`;
    if (r.status !== wantCode)
      failures.push(`${label}: sale con ${r.status} y se esperaba ${wantCode}`);
    for (const re of patterns)
      if (!re.test(out)) failures.push(`${label}: la salida no cumple ${re}`);
    if (leaks.some((leak) => out.toLowerCase().includes(leak.toLowerCase())))
      failures.push(`${label}: la salida contiene una identidad o un término`);
  }
  return failures;
}

function selfTest() {
  const tmp = mkdtempSync(join(tmpdir(), 'check-clean-'));
  try {
    const env = selfTestEnv(devNull);
    const repo = join(tmp, 'repo');
    mkdirSync(repo);
    const run = (identity, ...args) =>
      execFileSync('git', args, { cwd: repo, env: identity, stdio: 'pipe' });
    buildSelfTestRepo(run, (name, text) => writeFileSync(join(repo, name), text), env);
    return runSelfCases(tmp, repo, env);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

// `import.meta.main` (Node ≥ 24.2) y no comparar process.argv[1]: bajo enlaces simbólicos esa comparación falla.
if (import.meta.main === true && process.argv.includes('--self-test')) {
  const failures = selfTest();
  if (failures.length > 0) {
    for (const f of failures) console.error(`  ✘ [check-clean] autoprueba: ${f}`);
    console.error(`check-clean --self-test: ${failures.length} fallo(s).`);
    process.exit(1);
  }
  console.log(
    '  ✔ check-clean: autoprueba en un repo temporal (identidades en bruto contra la denylist, --publish con .mailmap, sin --mailmap y con marcadores; ninguna salida imprime identidades ni términos)',
  );
} else if (import.meta.main === true) {
  process.exit(main());
}
