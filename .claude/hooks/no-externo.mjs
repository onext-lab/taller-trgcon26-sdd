// Hook no-externo (PreToolUse Bash).
// El repo del taller es local: sin push, sin remotos, sin descargas ad hoc y sin publicar paquetes.
// Bloquea git push, git remote add/set-url, curl, wget y npm|pnpm|yarn publish, y cualquier comando
// que lea o escriba un .env* (cat .env, source .env, echo x > .env.local…), salvo .env.example.
// Complementa permissions.deny de .claude/settings.json (doble red: si una regla no casa, la otra sí).
import { commandSegments, deny, gitArgs, programName, readHookInput } from './_lib.mjs';

const HOOK = 'no-externo';
const input = readHookInput(HOOK);
const command = input?.tool_input?.command;
if (typeof command !== 'string' || !command.trim()) process.exit(0);

/** ¿La palabra apunta a un fichero de entorno? (.env, ./apps/api/.env.local, <.env, >.env.test) */
function isEnvFile(word) {
  const name = programName(word.replace(/^[0-9]*[<>]+&?/, ''));
  return /^\.env(\..+)?$/.test(name) && name !== '.env.example';
}

function reason(words) {
  if (words.some(isEnvFile)) {
    return 'el comando lee o escribe un fichero `.env*`, que puede llevar secretos. El taller no usa secretos: documenta las variables en `.env.example` o en `docs/SETUP.md`.';
  }
  const program = programName(words[0]);
  const git = gitArgs(words);
  if (git) {
    if (git[0] === 'push')
      return '`git push`: el repo del taller no tiene remoto; la publicación la decide la persona responsable.';
    if (git[0] === 'remote' && ['add', 'set-url'].includes(git[1]))
      return '`git remote add/set-url`: el repo del taller no tiene remoto.';
    return null;
  }
  if (program === 'curl' || program === 'wget') {
    return `\`${program}\`: sin red desde Claude Code. Las dependencias se instalan con \`npm install\`; para probar la API local usa los tests (fastify.inject), Playwright o el navegador.`;
  }
  if (['npm', 'pnpm', 'yarn'].includes(program)) {
    const sub = words.slice(1).find((w) => !w.startsWith('-'));
    if (sub === 'publish') return `\`${program} publish\`: este repo no publica paquetes.`;
  }
  return null;
}

for (const words of commandSegments(command)) {
  const why = reason(words);
  if (why) {
    deny(HOOK, [
      `Comando: ${command}`,
      `Motivo: ${why}`,
      'Qué hacer: resuélvelo sin red, sin remoto y sin .env; si de verdad hace falta, pídeselo a la persona y que lo haga ella.',
    ]);
  }
}
process.exit(0);
