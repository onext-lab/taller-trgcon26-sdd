/**
 * Normalización del cuerpo de candidato previa al esquema (DD-03, DEC-11.3). Pura: no muta la entrada. Si el cuerpo no
 * es un objeto JSON, o un campo no es del tipo esperado, lo deja intacto para que el esquema dé el 400. Idempotente:
 * `f(f(x))` es `f(x)` (EC-18).
 */

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

/** Recortadas, en minúsculas, sin vacías y deduplicadas en orden de primera aparición. */
function normalizeSkills(skills: string[]): string[] {
  const seen = new Set<string>();
  for (const skill of skills) {
    const clean = skill.trim().toLowerCase();
    if (clean !== '') seen.add(clean);
  }
  return [...seen];
}

/** Recorta un texto y pasa a `null` el que queda vacío; cualquier otro valor, intacto. */
function trimOrNull(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

export function normalizeCandidateBody(body: unknown): unknown {
  if (!isJsonObject(body)) return body;
  const result: Record<string, unknown> = { ...body };
  const { fullName, email, phone, summary, skills } = body;
  if (typeof fullName === 'string') result.fullName = fullName.trim();
  if (typeof email === 'string') result.email = email.trim().toLowerCase();
  if (Object.hasOwn(body, 'phone')) result.phone = trimOrNull(phone);
  if (Object.hasOwn(body, 'summary')) result.summary = trimOrNull(summary);
  if (isStringArray(skills)) result.skills = normalizeSkills(skills);
  return result;
}
