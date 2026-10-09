// Identidades del historial para scripts/check-clean.mjs (T-12 del sprint-02): autor y committer de cada commit de
// todas las refs y tagger de cada etiqueta anotada, siempre EN BRUTO (sin aplicar ningún `.mailmap`), y la lista de
// identidades permitidas para publicar. Las identidades son datos personales: estas funciones no imprimen nada.
// `git` es la función que lanza git en el repo (la pasa check-clean), para poder probarlas en un repo temporal.

const ANTHROPIC_NOREPLY = 'noreply@anthropic.com';

/**
 * Autor y committer de cada commit de todas las refs. `--no-use-mailmap` y los marcadores `%an`/`%ae`/`%cn`/`%ce`
 * (no `%aN`, `%aE`…) dan la identidad tal cual está en el objeto, aunque el repo tenga un `.mailmap`.
 */
export function readCommitIdentities(git) {
  const log = git('log', '--all', '--no-use-mailmap', '--format=%h%x00%an%x00%ae%x00%cn%x00%ce');
  const identities = [];
  for (const line of log.split('\n').filter(Boolean)) {
    const [hash, an, ae, cn, ce] = line.split('\0');
    identities.push({ object: `commit ${hash}`, role: 'autor', name: an, email: ae });
    identities.push({ object: `commit ${hash}`, role: 'committer', name: cn, email: ce });
  }
  return identities;
}

/** Tagger de cada etiqueta anotada (las ligeras no tienen: apuntan a commits, que ya se revisan). */
export function readTagIdentities(git) {
  const refs = git(
    'for-each-ref',
    'refs/tags',
    '--format=%(objecttype)%00%(refname:short)%00%(taggername)%00%(taggeremail:trim)',
  );
  const identities = [];
  for (const line of refs.split('\n').filter(Boolean)) {
    const [type, tag, name, email] = line.split('\0');
    if (type === 'tag') identities.push({ object: `etiqueta ${tag}`, role: 'tagger', name, email });
  }
  return identities;
}

/**
 * Parte izquierda (canónica) de cada línea de un `.mailmap`: el nombre, si lo hay, y el primer email. Formatos de git:
 * `Nombre <email>`, `<canónico> <commit>`, `Nombre <canónico> <commit>` y `Nombre <canónico> Otro <commit>`.
 * Los comentarios (`#` hasta el final de la línea) y las líneas vacías se ignoran.
 */
export function parseMailmap(text) {
  const names = new Set();
  const emails = new Set();
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    const match = /^([^<]*)<([^>]+)>/.exec(line);
    if (!match) continue;
    if (match[1].trim()) names.add(match[1].trim());
    emails.add(match[2].trim().toLowerCase());
  }
  return { names, emails };
}

/**
 * Una identidad se puede publicar si su nombre y su email son canónicos del `.mailmap` (el email, sin distinguir
 * mayúsculas, como hace git), o si es de Claude: nombre que empieza por «Claude» y email noreply@anthropic.com.
 */
export function isAllowedIdentity({ name, email }, allowed) {
  const mail = email.trim().toLowerCase();
  if (mail === ANTHROPIC_NOREPLY && /^Claude\b/.test(name.trim())) return true;
  return allowed.names.has(name.trim()) && allowed.emails.has(mail);
}

/** Cuántos commits y etiquetas tienen alguna identidad no permitida y cuántas identidades distintas fallan. */
export function checkIdentities(identities, allowed) {
  const objects = new Set();
  const distinct = new Set();
  for (const identity of identities) {
    if (isAllowedIdentity(identity, allowed)) continue;
    objects.add(identity.object);
    distinct.add(`${identity.name}\0${identity.email.toLowerCase()}`);
  }
  const commits = [...objects].filter((o) => o.startsWith('commit ')).length;
  return { commits, tags: objects.size - commits, distinct: distinct.size };
}

/** Modo normal: pasa el nombre y el email de cada identidad por `scan` (la denylist), con el commit o la etiqueta. */
export function scanIdentities(git, scan) {
  for (const id of [...readCommitIdentities(git), ...readTagIdentities(git)]) {
    scan(id.name, `identidad · ${id.object} · ${id.role} (nombre)`);
    scan(id.email, `identidad · ${id.object} · ${id.role} (email)`);
  }
}

export const MAILMAP_HELP =
  'El .mailmap da el nombre y el email canónicos (el titular) de cada autor, committer y tagger, y es la entrada de ' +
  'la reescritura de identidades de la copia de publicación. Vive fuera del repo, como la denylist, y se crea cuando ' +
  'el responsable técnico dé el titular.';

/** `--publish`: mensaje con cuántos commits, etiquetas e identidades distintas fallan (sin nombrarlas), o undefined. */
export function identitiesProblem(git, mailmapText) {
  const ids = [...readCommitIdentities(git), ...readTagIdentities(git)];
  const { commits, tags, distinct } = checkIdentities(ids, parseMailmap(mailmapText));
  if (distinct === 0) return undefined;
  return (
    `identidades: ${commits} commit(s) y ${tags} etiqueta(s) con un autor, committer o tagger que no es ` +
    `canónico del .mailmap ni de Claude <noreply@anthropic.com>; ${distinct} identidad(es) distinta(s). ` +
    'Añádelas al .mailmap y reescribe las identidades en la copia de publicación.'
  );
}

// ---------- fixture de la autoprueba de check-clean (identidades inventadas, dominio example.com) ----------
const ANA = { name: 'Ana Prueba', email: 'ana.zorzal@example.com' }; // término en el email de autor
const BRUNO = { name: 'Bruno Mirlo', email: 'bruno@example.com' }; // término en el nombre de committer
const CARLA = { name: 'Carla Garza', email: 'carla@example.com' }; // término en el tagger
const CLAUDE = { name: 'Claude Prueba', email: 'noreply@anthropic.com' };
const line = (p, rest = '') => `${p.name} <${p.email}>${rest}\n`;

/** Denylists y `.mailmap` de la autoprueba, y lo que ninguna salida puede contener (términos e identidades). */
export const SELF_TEST_INPUTS = {
  dirty: 'i:zorzal\nc:Mirlo\ni:garza\n',
  clean: 'c:^ESTA_REGLA_NO_COINCIDE$\n',
  partialMailmap: line(ANA),
  fullMailmap:
    `# comentario\n${line(ANA)}${line(BRUNO, ' <bruno.viejo@example.com>')}` +
    line(CARLA, ' Carla Vieja <carla.vieja@example.com>'),
  leaks: ['zorzal', 'mirlo', 'garza', ...[ANA, BRUNO, CARLA].flatMap((p) => [p.name, p.email])],
};

/** Entorno de git sin la configuración ni la identidad de quien ejecuta la autoprueba. */
export function selfTestEnv(devNull) {
  const env = { ...process.env, GIT_CONFIG_GLOBAL: devNull, GIT_CONFIG_NOSYSTEM: '1' };
  for (const key of Object.keys(env))
    if (/^GIT_(DIR|WORK_TREE|INDEX_FILE|AUTHOR_|COMMITTER_)/.test(key)) delete env[key];
  return env;
}

/**
 * Repo con un commit Ana/Bruno, otro Claude/Ana y la etiqueta anotada v1 de Carla. Versiona un `.mailmap` que mapea a
 * Bruno sobre Ana, para comprobar que las identidades se leen en bruto. `run(env, ...args)` lanza git en el repo y
 * `write(nombre, texto)` escribe un fichero en él.
 */
export function buildSelfTestRepo(run, write, env) {
  const as = (author, committer) => ({
    ...env,
    ...{ GIT_AUTHOR_NAME: author.name, GIT_AUTHOR_EMAIL: author.email },
    ...{ GIT_COMMITTER_NAME: committer.name, GIT_COMMITTER_EMAIL: committer.email },
  });
  run(env, 'init', '-q', '-b', 'main');
  write('hola.txt', 'hola\n');
  write('.mailmap', line(ANA, ` ${BRUNO.name} <${BRUNO.email}>`));
  run(env, 'add', 'hola.txt', '.mailmap');
  run(as(ANA, BRUNO), 'commit', '-q', '-m', 'primer commit');
  write('hola.txt', 'hola de nuevo\n');
  run(as(CLAUDE, ANA), 'commit', '-q', '-am', 'segundo commit');
  run(as(CARLA, CARLA), 'tag', '-a', 'v1', '-m', 'version uno');
}
