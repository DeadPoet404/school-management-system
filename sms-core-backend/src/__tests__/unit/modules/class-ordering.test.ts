/**
 * Class pickers must present the academic ladder in teaching order.
 * Alphabetical sorting puts "Basic 10" before "Basic 2" and Creche after JHS.
 */
import { describe, it, expect } from 'vitest';
import { sortClassesByLadder } from '@/modules/reference/reference.routes';

const cls = (name: string, section: string | null = null) => ({
  id: name, name, section, isActive: true,
});

describe('sortClassesByLadder', () => {
  it('orders stages from Creche up to JHS', () => {
    const sorted = sortClassesByLadder([
      cls('JHS 1A', 'A'),
      cls('Creche'),
      cls('Basic 1A', 'A'),
      cls('Nursery 1A', 'A'),
      cls('KG 1A', 'A'),
    ]).map((c) => c.name);

    expect(sorted).toEqual(['Creche', 'Nursery 1A', 'KG 1A', 'Basic 1A', 'JHS 1A']);
  });

  it('sorts numerically, not lexically', () => {
    const sorted = sortClassesByLadder([
      cls('Basic 10A', 'A'),
      cls('Basic 2A', 'A'),
      cls('Basic 1A', 'A'),
    ]).map((c) => c.name);

    expect(sorted).toEqual(['Basic 1A', 'Basic 2A', 'Basic 10A']);
  });

  it('keeps section A before B within a level', () => {
    const sorted = sortClassesByLadder([
      cls('Nursery 2B', 'B'),
      cls('Nursery 2A', 'A'),
      cls('Nursery 1B', 'B'),
      cls('Nursery 1A', 'A'),
    ]).map((c) => c.name);

    expect(sorted).toEqual(['Nursery 1A', 'Nursery 1B', 'Nursery 2A', 'Nursery 2B']);
  });

  it('places unrecognised labels last without throwing', () => {
    const sorted = sortClassesByLadder([
      cls('Special Unit'),
      cls('Creche'),
      cls('JHS 3B', 'B'),
    ]).map((c) => c.name);

    expect(sorted[0]).toBe('Creche');
    expect(sorted[sorted.length - 1]).toBe('Special Unit');
  });

  it('derives the section letter from the name when the column is null', () => {
    const sorted = sortClassesByLadder([
      cls('JHS 1B'),
      cls('JHS 1A'),
    ]).map((c) => c.name);

    expect(sorted).toEqual(['JHS 1A', 'JHS 1B']);
  });

  it('does not mutate the input array', () => {
    const input = [cls('JHS 1A', 'A'), cls('Creche')];
    const copy = [...input];
    sortClassesByLadder(input);
    expect(input).toEqual(copy);
  });
});
