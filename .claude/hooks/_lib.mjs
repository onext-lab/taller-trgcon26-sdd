// Utilidades comunes de los hooks del taller. Solo Node, sin dependencias y sin red.
//
// Contrato de hooks de Claude Code: el JSON del evento llega por stdin; exit 0 permite,
// exit 2 bloquea y el texto de stderr le llega a Claude para que sepa qué hacer.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

/** Lee y parsea el JSON del hook. Si no se entiende, avisa por stderr y devuelve null (no bloquea). */
export function readHookInput(hookName) {
  let raw;
  try {
    raw = readFileSync(0, 'utf8');
  } catch {
    return null;
  }
  if (!raw.trim()) return null;
  try {
    return JSON.parse(raw);
  } catch {
    // Un guard mudo es peor que un aviso: si cambia el contrato del hook, que se note.
    process.stderr.write(
      `[${hookName}] aviso: la entrada no es el JSON esperado; sin verificar.\n`,
    );
    return null;
  }
}

/** Bloquea la herramienta con un mensaje que dice qué hacer. */
export function deny(hookName, lines) {
  process.stderr.write(`[${hookName}] BLOQUEADO\n${lines.join('\n')}\n`);
  process.exit(2);
}

/** Rutas de fichero que toca una herramienta de edición (Write, Edit, MultiEdit, NotebookEdit). */
export function targetPath(input) {
  const toolInput = input?.tool_input ?? {};
  return toolInput.file_path ?? toolInput.path ?? toolInput.notebook_path ?? '';
}

/** Raíz del repo: la del directorio de trabajo; si no hay git, CLAUDE_PROJECT_DIR o el cwd. */
export function repoRoot(cwd = process.cwd()) {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return process.env.CLAUDE_PROJECT_DIR ?? cwd;
  }
}

/**
 * Parte un comando de shell en segmentos simples (por ;, &&, ||, |, saltos de línea, $( y `)
 * y devuelve, para cada uno, sus palabras sin asignaciones de entorno ni prefijos tipo sudo.
 * No es un parser de shell completo: ante la duda, prefiere un falso positivo a dejar pasar.
 */
export function commandSegments(command) {
  const PREFIXES = new Set([
    'sudo',
    'env',
    'command',
    'exec',
    'time',
    'nohup',
    'xargs',
    'npx',
    'then',
    'do',
    'else',
  ]);
  return command
    .split(/\|\||&&|[;|\n]|\$\(|`|\(|\)/)
    .map((segment) =>
      segment
        .trim()
        .split(/\s+/)
        .map((word) => word.replace(/^['"]|['"]$/g, ''))
        .filter(Boolean),
    )
    .map((words) => {
      let i = 0;
      while (
        i < words.length &&
        (/^[A-Za-z_][A-Za-z0-9_]*=/.test(words[i]) || PREFIXES.has(words[i]))
      )
        i++;
      return words.slice(i);
    })
    .filter((words) => words.length > 0);
}

/** Nombre del programa sin ruta ni extensión de Windows (/usr/bin/curl → curl, curl.exe → curl). */
export function programName(word) {
  return word
    .split(/[\\/]/)
    .pop()
    .replace(/\.(exe|cmd|bat)$/i, '')
    .toLowerCase();
}

/** Subcomando de git y sus argumentos, saltando opciones globales (git -C dir push → ['push']). */
export function gitArgs(words) {
  if (programName(words[0]) !== 'git') return null;
  const WITH_VALUE = new Set([
    '-C',
    '-c',
    '--git-dir',
    '--work-tree',
    '--namespace',
    '--exec-path',
  ]);
  let i = 1;
  while (i < words.length && words[i].startsWith('-')) {
    i += WITH_VALUE.has(words[i]) ? 2 : 1;
  }
  return words.slice(i);
}
