import type { DatabaseSync } from 'node:sqlite';

/**
 * Plegado de texto para la búsqueda (DD-04, DEC-10): minúsculas, NFD y sin marcas combinantes. Es la misma función
 * para el texto buscado y para el guardado, así que «Gestión» (NFC o NFD), «GESTION» y «gestion» coinciden. La `ñ`
 * pierde su tilde (EC-48, consecuencia aceptada).
 */
export function foldSearchText(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
}

/**
 * Registra `fold_search(texto)` en la conexión. Registrarla dos veces no falla. Cada conexión que ejecute consultas
 * con ella la necesita: sin registro, SQLite responde «no such function». Los valores que no son texto pasan igual.
 */
export function registerTextSearch(db: DatabaseSync): void {
  db.function('fold_search', { deterministic: true }, (value) =>
    typeof value === 'string' ? foldSearchText(value) : value,
  );
}
