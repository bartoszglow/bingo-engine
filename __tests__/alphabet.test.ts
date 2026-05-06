import { describe, expect, it } from 'vitest';
import {
  BLANK,
  BLANK_FLAG,
  ENGLISH_ALPHABET,
  POLISH_ALPHABET,
  defineAlphabet,
  isBlanked,
  letterToTileId,
  tileIdToLetter,
  tileScore,
  unblank,
} from '../src/index.js';

describe('defineAlphabet', () => {
  it('throws when id is missing', () => {
    expect(() =>
      defineAlphabet({
        id: '',
        tiles: [{ label: 'a', score: 1, count: 1 }],
        blankCount: 0,
      }),
    ).toThrow(/id is required/);
  });

  it('throws when no tiles given', () => {
    expect(() => defineAlphabet({ id: 'x', tiles: [], blankCount: 0 })).toThrow(
      /at least one tile/,
    );
  });

  it('throws on duplicate labels', () => {
    expect(() =>
      defineAlphabet({
        id: 'dup',
        tiles: [
          { label: 'a', score: 1, count: 1 },
          { label: 'A', score: 1, count: 1 },
        ],
        blankCount: 0,
      }),
    ).toThrow(/Duplicate tile label/);
  });

  it('throws when tile label collides with blank symbol', () => {
    expect(() =>
      defineAlphabet({
        id: 'collide',
        tiles: [{ label: '?', score: 0, count: 1 }],
        blankCount: 0,
      }),
    ).toThrow(/collides with blank symbol/);
  });

  it('throws on negative blank count', () => {
    expect(() =>
      defineAlphabet({
        id: 'neg',
        tiles: [{ label: 'a', score: 1, count: 1 }],
        blankCount: -1,
      }),
    ).toThrow(/non-negative integer/);
  });

  it('throws when alphabet exceeds BLANK_FLAG capacity', () => {
    // BLANK_FLAG = 0x80 = 128. We need >= 128 tiles to hit the cap (+1 slot for blank).
    const tiles = Array.from({ length: 128 }, (_, i) => ({
      label: `t${i}`,
      score: 1,
      count: 1,
    }));
    expect(() => defineAlphabet({ id: 'huge', tiles, blankCount: 0 })).toThrow(
      /Alphabet too large/,
    );
  });

  it('lowercases labels using the provided locale', () => {
    const a = defineAlphabet({
      id: 'pl-test',
      locale: 'pl-PL',
      tiles: [{ label: 'Ł', score: 3, count: 2 }],
      blankCount: 0,
    });
    expect(a.labels[1]).toBe('ł');
    expect(a.labelToId['ł']).toBe(1);
  });

  it('freezes the result', () => {
    const a = defineAlphabet({
      id: 'frz',
      tiles: [{ label: 'a', score: 1, count: 1 }],
      blankCount: 0,
    });
    expect(Object.isFrozen(a)).toBe(true);
    expect(Object.isFrozen(a.labels)).toBe(true);
    expect(Object.isFrozen(a.labelToId)).toBe(true);
  });

  it('marks tiles as vowels per the locale defaults', () => {
    const en = defineAlphabet({
      id: 'en-test',
      locale: 'en',
      tiles: [
        { label: 'a', score: 1, count: 1 },
        { label: 'b', score: 3, count: 1 },
      ],
      blankCount: 0,
    });
    // Tile id 1 ('a') is a vowel, tile id 2 ('b') is not.
    expect((en.vowelMask >> 1n) & 1n).toBe(1n);
    expect((en.vowelMask >> 2n) & 1n).toBe(0n);
  });
});

describe('POLISH_ALPHABET', () => {
  const a = POLISH_ALPHABET;

  it('has 32 letters + 1 blank slot', () => {
    expect(a.size).toBe(33);
  });

  it('totals 100 tiles in the bag (98 letters + 2 blanks)', () => {
    let total = 0;
    for (let i = 0; i < a.size; i++) total += a.counts[i] ?? 0;
    expect(total).toBe(100);
    expect(a.counts[0]).toBe(2); // blanks
  });

  it('has the canonical scoring values', () => {
    const expectScore = (label: string, score: number) => {
      const id = letterToTileId(a, label);
      expect(id, `id of '${label}'`).toBeDefined();
      expect(a.scores[id!]).toBe(score);
    };
    // Spot-check the harder ones
    expectScore('a', 1);
    expectScore('y', 2); // famously NOT 1 in Polish Scrabble
    expectScore('ą', 5);
    expectScore('ć', 6);
    expectScore('ń', 7);
    expectScore('ź', 9);
    expectScore('ż', 5);
    expectScore('ó', 5);
  });

  it('marks Polish vowels via the vowel mask', () => {
    const vowels = ['a', 'ą', 'e', 'ę', 'i', 'o', 'ó', 'u', 'y'];
    for (const v of vowels) {
      const id = letterToTileId(a, v)!;
      expect((a.vowelMask >> BigInt(id)) & 1n, `vowel mask for '${v}'`).toBe(1n);
    }
    const consonants = ['b', 'c', 'ć', 'k', 'ł', 'ń', 'ś', 'ż', 'ź', 'r'];
    for (const c of consonants) {
      const id = letterToTileId(a, c)!;
      expect((a.vowelMask >> BigInt(id)) & 1n, `vowel mask for '${c}'`).toBe(0n);
    }
  });
});

describe('ENGLISH_ALPHABET', () => {
  const a = ENGLISH_ALPHABET;

  it('has 26 letters + 1 blank slot', () => {
    expect(a.size).toBe(27);
  });

  it('totals 100 tiles in the bag (98 letters + 2 blanks)', () => {
    let total = 0;
    for (let i = 0; i < a.size; i++) total += a.counts[i] ?? 0;
    expect(total).toBe(100);
    expect(a.counts[0]).toBe(2);
  });

  it('has canonical scores', () => {
    const expectScore = (label: string, score: number) => {
      const id = letterToTileId(a, label);
      expect(id).toBeDefined();
      expect(a.scores[id!]).toBe(score);
    };
    expectScore('e', 1);
    expectScore('q', 10);
    expectScore('z', 10);
    expectScore('j', 8);
  });
});

describe('blank handling helpers', () => {
  it('BLANK is 0', () => {
    expect(BLANK).toBe(0);
  });

  it('BLANK_FLAG sets the high bit', () => {
    expect(BLANK_FLAG).toBe(0x80);
  });

  it('isBlanked detects the flag', () => {
    expect(isBlanked(0)).toBe(false);
    expect(isBlanked(5)).toBe(false);
    expect(isBlanked(5 | BLANK_FLAG)).toBe(true);
  });

  it('unblank strips the flag', () => {
    const id = 7;
    expect(unblank(id | BLANK_FLAG)).toBe(id);
    expect(unblank(id)).toBe(id);
  });

  it('tileScore returns 0 for blank and blanked-letter tiles', () => {
    const a = POLISH_ALPHABET;
    const aId = letterToTileId(a, 'a')!;
    expect(tileScore(a, BLANK)).toBe(0);
    expect(tileScore(a, aId)).toBe(1);
    expect(tileScore(a, aId | BLANK_FLAG)).toBe(0);
  });

  it('tileIdToLetter handles regular and blanked tiles', () => {
    const a = POLISH_ALPHABET;
    const lId = letterToTileId(a, 'ł')!;
    expect(tileIdToLetter(a, lId)).toBe('ł');
    expect(tileIdToLetter(a, lId | BLANK_FLAG)).toBe('ł');
    expect(tileIdToLetter(a, BLANK)).toBe(a.blankSymbol);
  });

  it('letterToTileId handles uppercase input via locale-aware lowercase', () => {
    const a = POLISH_ALPHABET;
    expect(letterToTileId(a, 'A')).toBe(letterToTileId(a, 'a'));
    expect(letterToTileId(a, 'Ł')).toBe(letterToTileId(a, 'ł'));
    expect(letterToTileId(a, 'unknown')).toBeUndefined();
  });
});
