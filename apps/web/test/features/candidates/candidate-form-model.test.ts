import { describe, expect, it } from 'vitest';
import {
  candidateToForm,
  EMPTY_FORM,
  parseSkills,
  toCreateInput,
  toPatch,
  validateCandidateForm,
  type CandidateFormValues,
} from '../../../src/features/candidates/candidate-form-model.ts';
import type { Candidate } from '../../../src/features/candidates/types.ts';

// Invented data only.
const VALID: CandidateFormValues = {
  ...EMPTY_FORM,
  fullName: 'Lucía Ferrer Soler',
  email: 'lucia.ferrer@example.com',
};

function check(overrides: Partial<CandidateFormValues>): ReturnType<typeof validateCandidateForm> {
  return validateCandidateForm({ ...VALID, ...overrides });
}

const CANDIDATE: Candidate = {
  id: 7,
  fullName: 'Lucía Ferrer Soler',
  email: 'lucia.ferrer@example.com',
  phone: '+34 600 000 001',
  summary: 'Backend con Node.',
  skills: ['typescript', 'sql'],
  createdAt: '2026-10-06T09:30:00.000Z',
  consentGivenAt: null,
  consentVersion: null,
  consentWithdrawnAt: null,
  retentionEndsAt: '2027-04-06',
};

describe('validateCandidateForm · nombre', () => {
  it('con solo nombre y email válidos no hay errores', () => {
    expect(validateCandidateForm(VALID)).toEqual({});
  });

  it.each([
    ['', 'Escribe el nombre y los apellidos.'],
    ['   ', 'Escribe el nombre y los apellidos.'],
    ['a', 'El nombre y los apellidos deben tener entre 2 y 100 caracteres.'],
    ['a'.repeat(101), 'El nombre y los apellidos deben tener entre 2 y 100 caracteres.'],
  ])('rechaza un nombre de %j (EC-10, EC-11)', (fullName, message) => {
    expect(check({ fullName }).fullName).toBe(message);
  });

  it('acepta un nombre de 2 y de 100 caracteres (EC-11)', () => {
    expect(check({ fullName: 'Ana' }).fullName).toBeUndefined();
    expect(check({ fullName: 'ab' }).fullName).toBeUndefined();
    expect(check({ fullName: 'a'.repeat(100) }).fullName).toBeUndefined();
  });

  it('cuenta puntos de código, no unidades UTF-16: 100 emojis valen y 101 no (EC-11)', () => {
    expect(check({ fullName: '🎯'.repeat(100) }).fullName).toBeUndefined();
    expect(check({ fullName: '🎯'.repeat(101) }).fullName).toBeDefined();
  });

  it('acepta «Íñigo Núñez Peñalver 🎯» (EC-03)', () => {
    expect(check({ fullName: 'Íñigo Núñez Peñalver 🎯' })).toEqual({});
  });

  it('rechaza los caracteres de control con su mensaje (EC-58)', () => {
    const message = 'No puede tener caracteres de control.';
    expect(check({ fullName: 'Lucía\u0000Ferrer' }).fullName).toBe(message);
    expect(check({ fullName: 'Lucía\nFerrer' }).fullName).toBe(message);
  });
});

describe('validateCandidateForm · email', () => {
  it.each(['ana.gil', 'ana.gil@', 'ana gil@example.com', '@example.com', 'ana@example'])(
    'rechaza «%s» con el mensaje de formato (EC-09)',
    (email) => {
      expect(check({ email }).email).toBe('Escribe un email válido, como nombre@example.com.');
    },
  );

  it('rechaza un email vacío o de espacios', () => {
    expect(check({ email: '  ' }).email).toBe('Escribe el email.');
  });

  it('acepta 254 caracteres y rechaza 255 (EC-09)', () => {
    const at = (size: number): string => `${'a'.repeat(size - '@example.com'.length)}@example.com`;
    expect(check({ email: at(254) }).email).toBeUndefined();
    expect(check({ email: at(255) }).email).toBe('El email no puede pasar de 254 caracteres.');
  });

  it('acepta otra forma del mismo email (mayúsculas y espacios): el servidor normaliza (CA-09)', () => {
    expect(check({ email: '  Lucia.Ferrer@Example.com ' })).toEqual({});
  });

  it('rechaza un carácter de control (EC-58)', () => {
    expect(check({ email: 'lucia\u007f@example.com' }).email).toBe(
      'No puede tener caracteres de control.',
    );
  });
});

describe('validateCandidateForm · teléfono (EC-13)', () => {
  it.each([
    '',
    '   ',
    '123456',
    '+123456',
    '+34 (600) 000-001',
    '1'.repeat(20),
    `+${'1'.repeat(20)}`,
  ])('acepta «%s»', (phone) => {
    expect(check({ phone }).phone).toBeUndefined();
  });

  it.each([
    '12345',
    '1'.repeat(21),
    `+${'1'.repeat(21)}`,
    '------',
    'abc123',
    '123-45a67',
    '++123456',
  ])('rechaza «%s»', (phone) => {
    expect(check({ phone }).phone).toContain('Escribe entre 6 y 20 dígitos');
  });
});

describe('validateCandidateForm · resumen', () => {
  it('acepta 2 000 caracteres y rechaza 2 001 (EC-11)', () => {
    expect(check({ summary: 'a'.repeat(2000) }).summary).toBeUndefined();
    expect(check({ summary: 'a'.repeat(2001) }).summary).toBe(
      'El resumen no puede pasar de 2 000 caracteres.',
    );
  });

  it('admite salto de línea, retorno de carro y tabulador, pero no otros controles (EC-58)', () => {
    expect(check({ summary: 'uno\ndos\r\ntres\tcuatro' }).summary).toBeUndefined();
    expect(check({ summary: 'campana\u0007' }).summary).toBe(
      'No puede tener caracteres de control.',
    );
  });
});

describe('parseSkills y validación de skills', () => {
  it('separa por comas, recorta y quita las vacías, sin minúsculas ni deduplicar (EC-12)', () => {
    expect(parseSkills('TypeScript, sql, typescript,   ')).toEqual([
      'TypeScript',
      'sql',
      'typescript',
    ]);
    expect(parseSkills('')).toEqual([]);
    expect(parseSkills(' , ,')).toEqual([]);
  });

  it('acepta una skill de 40 caracteres y rechaza 41 (EC-11)', () => {
    expect(check({ skills: 'a'.repeat(40) }).skills).toBeUndefined();
    expect(check({ skills: 'a'.repeat(41) }).skills).toBe(
      'Cada skill puede tener como máximo 40 caracteres.',
    );
  });

  it('acepta 20 skills distintas y rechaza 21 (EC-12)', () => {
    const list = (count: number): string =>
      Array.from({ length: count }, (_, index) => `skill${index}`).join(',');
    expect(check({ skills: list(20) }).skills).toBeUndefined();
    expect(check({ skills: list(21) }).skills).toBe('Indica como máximo 20 skills distintas.');
  });

  it('cuenta tras pasar a minúsculas y deduplicar: 21 que se quedan en 20 son válidas (EC-12)', () => {
    const twenty = Array.from({ length: 20 }, (_, index) => `skill${index}`);
    const skills = [...twenty, 'SKILL0'].join(', ');
    expect(parseSkills(skills)).toHaveLength(21);
    expect(check({ skills }).skills).toBeUndefined();
  });

  it('rechaza un carácter de control en una skill (EC-58)', () => {
    expect(check({ skills: 'sql, java\tscript' }).skills).toBe(
      'No puede tener caracteres de control.',
    );
  });
});

describe('toCreateInput', () => {
  it('recorta, deja las skills tal cual y manda consent: false por defecto (CA-01)', () => {
    const input = toCreateInput({
      ...EMPTY_FORM,
      fullName: ' Lucía Ferrer Soler ',
      email: 'Lucia.Ferrer@Example.com ',
      skills: 'TypeScript, sql, typescript,   ',
    });

    expect(input).toEqual({
      fullName: 'Lucía Ferrer Soler',
      email: 'Lucia.Ferrer@Example.com',
      skills: ['TypeScript', 'sql', 'typescript'],
      consent: false,
    });
  });

  it('manda consent: true si la casilla está marcada (CA-03)', () => {
    expect(toCreateInput({ ...VALID, consent: true }).consent).toBe(true);
  });

  it('omite teléfono y resumen vacíos o de espacios, y las skills vacías', () => {
    const input = toCreateInput({ ...VALID, phone: '  ', summary: '   ', skills: ' , ' });

    expect(input).toEqual({
      fullName: 'Lucía Ferrer Soler',
      email: 'lucia.ferrer@example.com',
      consent: false,
    });
  });

  it('con todo relleno lleva el teléfono y el resumen recortados y solo claves del contrato: nunca id, fechas, versión ni retentionEndsAt (EC-02, EC-59)', () => {
    const full = toCreateInput({
      ...VALID,
      phone: ' 600000001 ',
      summary: ' Texto ',
      skills: 'sql',
      consent: true,
    });

    expect(full).toMatchObject({ phone: '600000001', summary: 'Texto' });
    expect(Object.keys(full).sort()).toEqual(
      ['consent', 'email', 'fullName', 'phone', 'skills', 'summary'].sort(),
    );
  });
});

describe('candidateToForm', () => {
  it('lleva los valores actuales, con las skills separadas por comas y sin consentimiento (CA-07)', () => {
    expect(candidateToForm(CANDIDATE)).toEqual({
      fullName: 'Lucía Ferrer Soler',
      email: 'lucia.ferrer@example.com',
      phone: '+34 600 000 001',
      summary: 'Backend con Node.',
      skills: 'typescript, sql',
      consent: false,
    });
  });

  it('convierte los null en cadenas vacías', () => {
    const form = candidateToForm({ ...CANDIDATE, phone: null, summary: null, skills: [] });

    expect(form.phone).toBe('');
    expect(form.summary).toBe('');
    expect(form.skills).toBe('');
  });
});

describe('toPatch', () => {
  it('sin cambios devuelve {} (EC-26)', () => {
    expect(toPatch(CANDIDATE, candidateToForm(CANDIDATE))).toEqual({});
  });

  it('con solo espacios añadidos alrededor tampoco hay cambios', () => {
    const values = {
      ...candidateToForm(CANDIDATE),
      fullName: ' Lucía Ferrer Soler  ',
      skills: ' typescript ,sql, ',
    };

    expect(toPatch(CANDIDATE, values)).toEqual({});
  });

  it('lleva solo lo cambiado, recortado (CA-08)', () => {
    const values = { ...candidateToForm(CANDIDATE), phone: ' 600 000 002 ', summary: 'Nuevo.' };

    expect(toPatch(CANDIDATE, values)).toEqual({ phone: '600 000 002', summary: 'Nuevo.' });
  });

  it('el mismo email con otra forma es un cambio y se envía (CA-09)', () => {
    const values = { ...candidateToForm(CANDIDATE), email: ' Lucia.Ferrer@Example.com ' };

    expect(toPatch(CANDIDATE, values)).toEqual({ email: 'Lucia.Ferrer@Example.com' });
  });

  it('vaciar teléfono, resumen y skills envía null, null y [] (EC-21)', () => {
    const values = { ...candidateToForm(CANDIDATE), phone: '  ', summary: '', skills: ' , ' };

    expect(toPatch(CANDIDATE, values)).toEqual({ phone: null, summary: null, skills: [] });
  });

  it('un teléfono que ya era null y sigue vacío no es un cambio; cambiar el orden de las skills sí', () => {
    const original = { ...CANDIDATE, phone: null };
    const unchanged = { ...candidateToForm(original), phone: '' };

    expect(toPatch(original, unchanged)).toEqual({});
    expect(toPatch(original, { ...unchanged, skills: 'sql, typescript' })).toEqual({
      skills: ['sql', 'typescript'],
    });
  });

  it('nunca lleva el consentimiento ni claves fuera del contrato', () => {
    const values = { ...candidateToForm(CANDIDATE), fullName: 'Otra Persona', consent: true };

    expect(toPatch(CANDIDATE, values)).toEqual({ fullName: 'Otra Persona' });
  });
});
