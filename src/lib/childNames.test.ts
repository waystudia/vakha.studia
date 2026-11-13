import { describe, expect, it } from 'vitest';
import { similarChildren } from './childNames';
const children = [{ public_name: 'Абдуллаев Адам' }, { public_name: 'Семёнов Абдул-Хамид' }];
describe('child name suggestions', () => {
  it('finds a typo and either input order', () => {
    expect(similarChildren(children, 'Адам Абдулаев')).toEqual([children[0]]);
  });
  it('normalizes ё, spaces and hyphens', () => {
    expect(similarChildren(children, '  Семенов Абдул‑Хамид ')).toEqual([children[1]]);
  });
  it('does not suggest unrelated names or every child for empty input', () => {
    expect(similarChildren(children, '')).toEqual([]);
    expect(similarChildren(children, 'Иванов Иса')).toEqual([]);
  });
});
