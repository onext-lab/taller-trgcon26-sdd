// Hook raw-chars (PreToolUse Edit|Write|MultiEdit).
//
// Rechaza caracteres crudos invisibles que rompen herramientas del repo:
//   - NUL (U+0000) en cualquier fichero: ripgrep (y por tanto Grep, que usan los auditores)
//     trata el fichero como binario y lo deja fuera de su alcance sin ningún error.
//   - U+2028 / U+2029 en ficheros JS/TS: rompen el parser de ESLint.
// Los dos pasan los tests en verde, así que solo los para un guard como este.
// La forma correcta en un test es la secuencia de escape (barra invertida + u0000 o u2028),
// que deja el fichero en texto plano.
//
// Ningún carácter prohibido se escribe como literal en este fichero (se construyen con
// String.fromCharCode): un guard que contiene lo que prohíbe se bloquearía a sí mismo.
import { deny, readHookInput, targetPath } from './_lib.mjs';

const HOOK = 'raw-chars';
const NUL = String.fromCharCode(0x0000);
const LINE_SEP = String.fromCharCode(0x2028);
const PARA_SEP = String.fromCharCode(0x2029);
const JS_TS = /\.(ts|tsx|js|jsx|mjs|cjs)$/i;

const input = readHookInput(HOOK);
const toolInput = input?.tool_input ?? {};
const path = targetPath(input);

// Write (content), Edit (new_string) y MultiEdit (edits[].new_string).
const pieces = [
  toolInput.content,
  toolInput.new_string,
  ...(toolInput.edits ?? []).map((e) => e?.new_string),
].filter((piece) => typeof piece === 'string');
if (pieces.length === 0) process.exit(0);

const text = pieces.join('\n');
const isJsTs = JS_TS.test(path);
const findings = [];
if (text.includes(NUL)) {
  findings.push(
    '  - NUL (U+0000) crudo: hace el fichero invisible a Grep. Escríbelo como \\u0000.',
  );
}
if (isJsTs && text.includes(LINE_SEP)) {
  findings.push(
    '  - U+2028 crudo (separador de línea): rompe el parser de ESLint. Escríbelo como \\u2028.',
  );
}
if (isJsTs && text.includes(PARA_SEP)) {
  findings.push(
    '  - U+2029 crudo (separador de párrafo): rompe el parser de ESLint. Escríbelo como \\u2029.',
  );
}
if (findings.length > 0) {
  deny(HOOK, [
    `Fichero: ${path || '(sin ruta)'}`,
    ...findings,
    'Qué hacer: usa la secuencia de escape; prueba lo mismo y deja el fichero en texto plano.',
  ]);
}
process.exit(0);
