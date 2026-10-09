#!/usr/bin/env node
// node scripts/check-machine-paths.mjs [--history]
//
// Comprueba que ningún fichero versionado o nuevo no ignorado lleve una ruta de máquina con usuario: la carpeta de
// usuarios de macOS (`/Users/<nombre>`), la de Linux (`/home/<nombre>`) o la de Windows (`C:\Users\<nombre>`, con
// cualquier letra de unidad y con `/` o `\`). Esas rutas llevan el nombre de usuario de quien escribió el fichero y el
// repo se publica (T-11 del sprint-02, A-10 de la auditoría del sprint-01). No cuentan las que no llevan nombre detrás
// (`/Users/`, `/Users/…`, `C:\…`) ni las que forman parte de una URL.
//
// Informa de cada coincidencia con `fichero:línea`, SIN imprimir la ruta (lleva el nombre de usuario). Antes de mirar
// el repo, se prueba a sí mismo con casos fijos. Se ejecuta en `npm run check:harness` (modo árbol).
// Con `--history` revisa además `git log -p --all` (mensajes y diffs) e informa de los commits por hash corto; no entra
// en check:harness: es para preparar la publicación.
// Sale con 1 si hay coincidencias o si falla la autoprueba.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';

// Nombre de usuario: letras y números de cualquier alfabeto, punto, guion y guion bajo. Lo que va delante de la ruta no
// puede ser parte de un nombre, de un dominio ni de otra ruta relativa.
const NAME = String.raw`[\p{L}\p{N}_][\p{L}\p{N}._-]*`;
const MACHINE_PATH = new RegExp(
  [
    String.raw`(?<![\p{L}\p{N}._~-])/(?:Users|home)/${NAME}`,
    String.raw`(?<![\p{L}\p{N}_])[A-Za-z]:[\\/]{1,2}Users[\\/]{1,2}${NAME}`,
  ].join('|'),
  'u',
);
// Las URL (`https://host/home/…`) no son rutas de máquina: se quitan antes de buscar.
const WEB_URL = /\b(?:https?|ftp):\/\/\S+/giu;

/** Líneas (1-based) de un texto con una ruta de máquina con usuario. */
export function findMachinePaths(text) {
  const found = [];
  text.split(/\r?\n/).forEach((line, i) => {
    if (MACHINE_PATH.test(line.replace(WEB_URL, ''))) found.push(i + 1);
  });
  return found;
}

// Los casos se construyen por partes para que este fichero no contenga ninguna ruta de usuario literal.
const S = '/';
const B = '\\';
const mac = (name) => `${S}Users${S}${name}${S}`;
const linux = (name) => `${S}home${S}${name}${S}`;
const win = (drive, sep, name) => `${drive}:${sep}Users${sep}${name}${sep}`;

const SELF_TEST = [
  [`${mac('lucia')}proyectos/ats`, [1]],
  [`El script vive en \`${mac('pablo.ruiz')}tmp/check.mjs\`, léelo.`, [1]],
  [`Ejecuta ${linux('ana')}repo/scripts/x.mjs antes de seguir.`, [1]],
  [`Abre \`${linux('marta_g')}ats\` en el editor.`, [1]],
  [`Copia ${win('C', B, 'Jordi')}Desktop${B}ats en la unidad.`, [1]],
  [`La ruta \`${win('D', S, 'irene-p')}ats\` también cuenta.`, [1]],
  [`"cwd": "${win('C', B + B, 'nuria')}"`, [1]],
  [`línea limpia\n${mac('ines')}\notra limpia`, [2]],
  [`Si hay una ruta absoluta (\`${S}Users${S}\`, \`${S}Users${S}…\`, \`C:${B}…\`) bloquea.`, []],
  [`Una regla contra \`${S}Users${S}\`, \`${S}home${S}\` y \`C:${B}Users${B}\`.`, []],
  [`La carpeta ${S}home${S} sin nombre detrás no cuenta.`, []],
  [`Mira https://example.com${linux('docs')}index.html y https://ejemplo.es/a/home/…`, []],
  [`El placeholder \`${S}Users${S}<nombre>${S}\` no es una ruta real.`, []],
  [`Una ruta relativa como apps/home/ana/x.ts o ./home/ana/ tampoco.`, []],
];

function selfTest() {
  return SELF_TEST.filter(
    ([text, want]) => JSON.stringify(findMachinePaths(text)) !== JSON.stringify(want),
  ).map(
    ([text, want]) => `autoprueba: el caso «${caseLabel(text)}» debía dar ${JSON.stringify(want)}`,
  );
}

// En el fallo de la autoprueba tampoco se imprime la ruta: solo el principio de la frase.
const caseLabel = (text) => text.replace(MACHINE_PATH, '<ruta>').split('\n')[0].slice(0, 40);

const git = (...args) =>
  execFileSync('git', args, { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 });

/** Árbol de trabajo: ficheros versionados y nuevos no ignorados, saltando binarios (como check-clean). */
function scanTree() {
  const files = [
    ...new Set(
      git('ls-files', '-z', '--cached', '--others', '--exclude-standard')
        .split('\0')
        .filter(Boolean),
    ),
  ];
  const findings = [];
  for (const file of files) {
    if (!existsSync(file) || !statSync(file).isFile()) continue;
    const buffer = readFileSync(file);
    if (buffer.includes(0)) continue; // binario
    for (const n of findMachinePaths(buffer.toString('utf8'))) findings.push(`${file}:${n}`);
  }
  return { files: files.length, findings };
}

/** Historial completo (`git log -p --all`): commits por hash corto, con el mensaje o los ficheros afectados. */
function scanHistory() {
  /** @type {Map<string, Set<string>>} */
  const byCommit = new Map();
  const log = git('log', '-p', '--all', '--no-color', '--format=%x00COMMIT %h%n%B%x00END');
  let commit = '?';
  let file = 'mensaje';
  let inMessage = false;
  for (const line of log.split('\n')) {
    if (line.startsWith('\0COMMIT ')) {
      [commit, file, inMessage] = [line.slice(8), 'mensaje', true];
      continue;
    }
    if (line.startsWith('\0END')) inMessage = false;
    else if (!inMessage && line.startsWith('diff --git ')) {
      file = line.replace(/^diff --git a\/.* b\//, '');
    }
    if (findMachinePaths(line).length === 0) continue;
    if (!byCommit.has(commit)) byCommit.set(commit, new Set());
    byCommit.get(commit).add(inMessage ? 'mensaje' : file);
  }
  return byCommit;
}

function hasCommits() {
  try {
    git('rev-parse', '--verify', 'HEAD');
    return true;
  } catch {
    return false;
  }
}

function reportHistory(byCommit) {
  if (byCommit.size === 0) {
    console.log(
      '  ✔ rutas de máquina (historial): 0 commits con coincidencias en git log -p --all',
    );
    return 0;
  }
  console.error(
    `check:machine-paths: ${byCommit.size} commit(s) del historial con rutas de máquina:`,
  );
  for (const [commit, where] of byCommit) {
    const list = [...where];
    const shown = list.slice(0, 5).join(', ');
    const more = list.length > 5 ? ` y ${list.length - 5} más` : '';
    console.error(`  - ${commit} · ${shown}${more}`);
  }
  return 1;
}

function main() {
  const failures = selfTest();
  if (failures.length > 0) {
    for (const f of failures) console.error(`  ✘ [rutas de máquina] ${f}`);
    console.error(
      `check:machine-paths: la autoprueba falla (${failures.length}); no se mira el repo.`,
    );
    return 1;
  }
  process.chdir(git('rev-parse', '--show-toplevel').trim());
  const tree = scanTree();
  let code = 0;
  if (tree.findings.length > 0) {
    console.error(`check:machine-paths: ${tree.findings.length} ruta(s) de máquina con usuario:`);
    for (const f of tree.findings) console.error(`  ✘ ${f}`);
    console.error(
      'Usa una ruta relativa a la raíz del repo (la absoluta va en el encargo, nunca en un fichero).',
    );
    code = 1;
  } else {
    console.log(
      `  ✔ rutas de máquina: ${SELF_TEST.length} casos de autoprueba; 0 coincidencias en ${tree.files} ficheros`,
    );
  }
  if (process.argv.includes('--history') && hasCommits()) {
    code = Math.max(code, reportHistory(scanHistory()));
  }
  return code;
}

// `import.meta.main` (Node ≥ 24.2) y no comparar process.argv[1]: bajo enlaces simbólicos esa comparación falla.
if (import.meta.main === true) process.exit(main());
