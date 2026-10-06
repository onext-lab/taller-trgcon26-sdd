import { describe, expect, it } from 'vitest';
import { normalizeCandidateBody } from '../../src/modules/candidates/normalize.ts';

// Datos inventados. La normalización es pura: sin reloj ni base.

describe('normalizeCandidateBody — campos de texto', () => {
  it('EC-03 recorta el nombre y pasa el email a minúsculas', () => {
    expect(
      normalizeCandidateBody({ fullName: '  Íñigo Núñez  ', email: ' Inigo.Nunez@Example.com ' }),
    ).toEqual({ fullName: 'Íñigo Núñez', email: 'inigo.nunez@example.com' });
  });

  it('phone y summary: recortan y los vacíos pasan a null', () => {
    expect(normalizeCandidateBody({ phone: '  600 000 001 ', summary: '  Texto  ' })).toEqual({
      phone: '600 000 001',
      summary: 'Texto',
    });
    expect(normalizeCandidateBody({ phone: '   ', summary: '' })).toEqual({
      phone: null,
      summary: null,
    });
  });

  it('un campo ausente no se crea; uno de otro tipo queda intacto para el 400 del esquema', () => {
    expect(normalizeCandidateBody({ fullName: 'Ana Gil' })).toEqual({ fullName: 'Ana Gil' });
    expect(normalizeCandidateBody({ fullName: 7, email: ['a@example.com'], phone: 5 })).toEqual({
      fullName: 7,
      email: ['a@example.com'],
      phone: 5,
    });
  });

  it('un cuerpo que no es un objeto JSON se devuelve intacto', () => {
    expect(normalizeCandidateBody(null)).toBeNull();
    expect(normalizeCandidateBody('texto')).toBe('texto');
    expect(normalizeCandidateBody([1])).toEqual([1]);
    expect(normalizeCandidateBody(undefined)).toBeUndefined();
  });

  it('no muta el cuerpo recibido', () => {
    const body = { email: ' A@Example.com ', skills: [' SQL '] };
    normalizeCandidateBody(body);
    expect(body).toEqual({ email: ' A@Example.com ', skills: [' SQL '] });
  });
});

describe('normalizeCandidateBody — skills', () => {
  it('EC-12 recorta, pasa a minúsculas, quita vacías y deduplica en orden de primera aparición', () => {
    const result = normalizeCandidateBody({
      skills: ['TypeScript', 'sql', 'typescript', '   ', ' SQL ', 'Go', ''],
    });

    expect(result).toEqual({ skills: ['typescript', 'sql', 'go'] });
  });

  it('EC-12 con un solo no-texto, el array queda intacto para que Ajv dé el 400 de tipo', () => {
    const skills = ['TypeScript', 7, null, ' sql '];

    expect(normalizeCandidateBody({ skills })).toEqual({ skills });
  });

  it('un skills que no es array queda intacto', () => {
    expect(normalizeCandidateBody({ skills: 'sql' })).toEqual({ skills: 'sql' });
    expect(normalizeCandidateBody({ skills: null })).toEqual({ skills: null });
  });

  it('EC-12 un array vacío o de solo vacías queda en []', () => {
    expect(normalizeCandidateBody({ skills: [] })).toEqual({ skills: [] });
    expect(normalizeCandidateBody({ skills: [' ', ''] })).toEqual({ skills: [] });
  });
});

describe('normalizeCandidateBody — idempotencia', () => {
  it('EC-18 f(f(x)) = f(x)', () => {
    const inputs: unknown[] = [
      {
        fullName: '  Lucía Ferrer Soler ',
        email: ' Lucia.Ferrer@Example.com ',
        phone: ' ',
        summary: '  Resumen  ',
        skills: ['TypeScript', ' sql ', 'typescript', ''],
        consent: true,
      },
      { skills: ['A', 7] },
      { phone: '+34 600 000 001', summary: '' },
      null,
      [],
    ];

    for (const input of inputs) {
      const once = normalizeCandidateBody(input);
      expect(normalizeCandidateBody(once)).toEqual(once);
    }
  });
});
