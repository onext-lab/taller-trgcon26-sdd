// Escaneos y modos de scripts/check-clean.mjs (T-18 del sprint-02): árbol, historial, refs, puerta de publicación y
// autoprueba. Las funciones de escaneo reciben `scan(texto, sitio)` y no imprimen términos, líneas ni identidades.
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
import { join } from 'node:path';
import {
  buildSelfTestRepo,
  identitiesProblem,
  MAILMAP_HELP,
  SELF_CASES,
  SELF_TEST_INPUTS,
  selfTestEnv,
} from './check-clean-identities.mjs';
import { PUBLISH_MARKERS, scanTreeForMarkers } from './publish-markers.mjs';

export const git = (...args) =>
  execFileSync('git', args, { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 });

export function hasCommits() {
  try {
    git('rev-parse', '--verify', 'HEAD');
    return true;
  } catch {
    return false;
  }
}

/**
 * Un único `scan(texto, sitio)` que prueba la denylist y, en la misma pasada, la lista de publicación (si la hay),
 * para no recorrer dos veces el historial. Cada coincidencia va a la lista de la que viene, con su número de regla y
 * la línea de esa lista, nunca con el término.
 */
export function makeScanner(rules, publishRules) {
  const findings = [];
  const publishFindings = [];
  const check = (list, sink, label, text, where) => {
    for (const rule of list) {
      if (rule.re.test(text))
        sink.push(`${where} · regla ${rule.n} (línea ${rule.line} de ${label})`);
    }
  };
  const scan = (text, where) => {
    check(rules, findings, 'la lista', text, where);
    check(publishRules, publishFindings, 'la lista de publicación', text, where);
  };
  return { scan, findings, publishFindings };
}

/** 1. Árbol de trabajo: ficheros versionados y nuevos no ignorados (nombre y contenido). */
export function scanTree(scan) {
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
export function scanHistory(scan) {
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
export function scanRefs(scan) {
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
export function publishProblems(mailmapPath, withCommits) {
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

export function reportPublish(problems) {
  if (problems.length === 0) {
    console.log('check-clean --publish: identidades y marcadores listos para publicar.');
    return 0;
  }
  console.error(`check-clean --publish: ${problems.length} problema(s) para publicar:`);
  for (const problem of problems) console.error(`  - ${problem}`);
  return 1;
}

// ---------- autoprueba: repo git temporal con identidades inventadas (fixture y casos en check-clean-identities.mjs)
function runSelfCases(self, tmp, repo, env) {
  const file = (name, text) => (writeFileSync(join(tmp, name), text), join(tmp, name));
  const { dirty, clean, partialMailmap, fullMailmap, publishHit, publishClean, leaks } =
    SELF_TEST_INPUTS;
  const paths = { D: file('denylist-sucia', dirty), C: file('denylist-limpia', clean) };
  paths.M = file('mailmap-parcial', partialMailmap);
  paths.F = file('mailmap-completo', fullMailmap);
  paths.P = file('publicacion-coincide', publishHit);
  paths.Q = file('publicacion-limpia', publishClean);
  paths.X = join(tmp, 'no-existe');
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

function selfTest(self) {
  const tmp = mkdtempSync(join(tmpdir(), 'check-clean-'));
  try {
    const env = selfTestEnv(devNull);
    const repo = join(tmp, 'repo');
    mkdirSync(repo);
    const run = (identity, ...args) =>
      execFileSync('git', args, { cwd: repo, env: identity, stdio: 'pipe' });
    buildSelfTestRepo(run, (name, text) => writeFileSync(join(repo, name), text), env);
    return runSelfCases(self, tmp, repo, env);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

/** --self-test: `self` es la ruta de check-clean.mjs, que los casos lanzan como proceso aparte. */
export function runSelfTest(self) {
  const failures = selfTest(self);
  if (failures.length > 0) {
    for (const f of failures) console.error(`  ✘ [check-clean] autoprueba: ${f}`);
    console.error(`check-clean --self-test: ${failures.length} fallo(s).`);
    return 1;
  }
  console.log(
    '  ✔ check-clean: autoprueba en un repo temporal (identidades en bruto contra la denylist, --publish con .mailmap, sin --mailmap y con marcadores; ninguna salida imprime identidades ni términos)',
  );
  return 0;
}
