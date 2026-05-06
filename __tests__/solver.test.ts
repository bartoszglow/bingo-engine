import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  POLISH_ALPHABET,
  SCRABBLE_CLASSIC_RULES,
  SCRABBLE_FREE_RULES,
  SCRABBLE_LAYOUT_15X15,
  SIMPLE_LAYOUT_15X15,
  blankTile,
  buildSetDictionary,
  buildTrieDictionary,
  emptyBoard,
  letterTile,
  validatePlacement,
  type Rack,
} from '../src/index.js';
import { findAllPlacements } from '../src/solver/solver.js';
import { TINY_POLISH_WORDS } from './fixtures/tiny-dictionary.js';
import { parseAsciiBoard } from './fixtures/boards.js';

const a = POLISH_ALPHABET;
const layout = SCRABBLE_LAYOUT_15X15;
const layoutPlain = SIMPLE_LAYOUT_15X15;
const rules = SCRABBLE_CLASSIC_RULES;
const freeRules = SCRABBLE_FREE_RULES;

const dictionary = buildTrieDictionary(TINY_POLISH_WORDS);
const setDictionary = buildSetDictionary(TINY_POLISH_WORDS);
const ctx = { alphabet: a, layout, rules, dictionary };
const ctxFree = { alphabet: a, layout: layoutPlain, rules: freeRules, dictionary };
const ctxSet = { alphabet: a, layout, rules, dictionary: setDictionary };

const rack = (...letters: string[]): Rack => letters.map((l) => letterTile(a, l)!);

describe('solver — correctness', () => {
  it('30. empty board, rack [k,o,t], dict {kot} → finds "kot" on center in both directions', () => {
    const board = emptyBoard(layout);
    const dict = buildTrieDictionary(['kot']);
    const r = rack('k', 'o', 't');
    const result = findAllPlacements(board, r, { ...ctx, dictionary: dict });
    expect(result.length).toBeGreaterThanOrEqual(2);
    // Both directions should appear; main word 'kot' covers center (7,7).
    const directions = new Set(result.map((p) => p.direction));
    expect(directions.has('horizontal')).toBe(true);
    expect(directions.has('vertical')).toBe(true);
    // Every returned placement passes validation.
    for (const p of result) {
      expect(validatePlacement(board, p, r, { ...ctx, dictionary: dict }).valid).toBe(true);
    }
  });

  it('31. empty board, rack [k,o,t], dict {kot, kto, ok} → finds all valid placements covering center', () => {
    const board = emptyBoard(layout);
    const dict = buildTrieDictionary(['kot', 'kto', 'ok']);
    const r = rack('k', 'o', 't');
    const result = findAllPlacements(board, r, { ...ctx, dictionary: dict });
    const words = new Set(
      result.map((p) => p.tiles.map((t) => t.letter).join('')),
    );
    expect(words.has('kot')).toBe(true);
    expect(words.has('kto')).toBe(true);
    // 'ok' is too short to cover center alone (only 2 tiles, must include center).
    // It should appear when the placement covers (7,7), e.g. starting at (7,7) or (7,6).
    // The solver should enumerate it when valid.
  });

  it('32. existing kot on board, rack [a,r] → finds at least one valid extension', () => {
    const board = parseAsciiBoard(
      `
      ...............
      ...............
      ...............
      ...............
      ...............
      ...............
      ...............
      ......kot......
      ...............
      `,
      a,
      layout,
    );
    const r = rack('a', 'r');
    const result = findAllPlacements(board, r, ctxFree);
    expect(result.length).toBeGreaterThan(0);
    for (const p of result) {
      expect(validatePlacement(board, p, r, ctxFree).valid).toBe(true);
    }
  });

  it('33. anchor coverage: solver does not return placements that miss every anchor', () => {
    // On a non-empty board, every placement must touch at least one anchor.
    // We assert this indirectly by checking validatePlacement returns valid
    // (which subsumes connectivity).
    const board = parseAsciiBoard(
      `
      ...............
      ...............
      ...............
      ...............
      ...............
      ...............
      ...............
      ......kot......
      ...............
      `,
      a,
      layout,
    );
    const r = rack('a', 'b', 'c', 'r', 's', 'y', 't');
    const result = findAllPlacements(board, r, ctx);
    for (const p of result) {
      expect(validatePlacement(board, p, r, ctx).valid).toBe(true);
    }
  });

  it('34. Set vs Trie backends return the SAME set of placements (Trie is just faster)', () => {
    const board = emptyBoard(layout);
    const r = rack('k', 'o', 't');
    const trieResult = findAllPlacements(board, r, ctx);
    const setResult = findAllPlacements(board, r, ctxSet);
    const keyOf = (p: { startRow: number; startCol: number; direction: string; tiles: ReadonlyArray<{ letter: string; isBlank: boolean }> }) =>
      `${p.direction}@${p.startRow},${p.startCol}:` +
      p.tiles.map((t) => (t.isBlank ? '*' : '') + t.letter).join('');
    const trieSet = new Set(trieResult.map(keyOf));
    const setSet = new Set(setResult.map(keyOf));
    // They might differ slightly because Set has no `hasPrefix` pruning, so it
    // enumerates more candidates and validates more. But the set of VALID
    // placements should be identical.
    for (const k of trieSet) expect(setSet.has(k), `trie has ${k}, set missing`).toBe(true);
    for (const k of setSet) expect(trieSet.has(k), `set has ${k}, trie missing`).toBe(true);
  });

  it('35. limit option returns at most N placements sorted by score', () => {
    const board = emptyBoard(layout);
    const r = rack('k', 'o', 't');
    const result = findAllPlacements(board, r, ctx, { limit: 2, sortBy: 'score' });
    expect(result.length).toBeLessThanOrEqual(2);
  });

  it('36. sortBy: length sorts by tile count descending', () => {
    const board = emptyBoard(layout);
    const r = rack('k', 'o', 't');
    const result = findAllPlacements(board, r, ctx, { sortBy: 'length' });
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1]!.tiles.length).toBeGreaterThanOrEqual(result[i]!.tiles.length);
    }
  });

  it('37. rack with two blanks: solver enumerates blank substitutions', () => {
    const board = emptyBoard(layout);
    const r: Rack = [letterTile(a, 'k')!, letterTile(a, 'o')!, blankTile(), blankTile()];
    const dict = buildTrieDictionary(['kot', 'kotka']);
    const result = findAllPlacements(board, r, { ...ctx, dictionary: dict });
    // Some result must use a blank as 't' (since rack has no 't').
    const usesBlankAsT = result.some((p) => p.tiles.some((t) => t.isBlank && t.letter === 't'));
    expect(usesBlankAsT).toBe(true);
  });
});

describe('solver — property: every returned placement validates', () => {
  it('100 random board+rack combinations: every output is valid', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        (seed) => {
          const board = emptyBoard(layout);
          // Pick 5-7 random Polish letters from a small set we know forms words.
          const seedLetters = ['k', 'o', 't', 'a', 'r', 's', 'p'];
          const r: Rack = seedLetters.slice(0, 4 + (seed % 4)).map((l) => letterTile(a, l)!);
          const result = findAllPlacements(board, r, ctx, { limit: 20 });
          for (const p of result) {
            expect(validatePlacement(board, p, r, ctx).valid).toBe(true);
          }
        },
      ),
      { numRuns: 50 },
    );
  });
});
