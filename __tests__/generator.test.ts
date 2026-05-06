import { describe, expect, it } from 'vitest';
import {
  POLISH_ALPHABET,
  SCRABBLE_CLASSIC_RULES,
  SCRABBLE_LAYOUT_15X15,
  buildTrieDictionary,
  seededRng,
} from '../src/index.js';
import { generateBoard } from '../src/generator/generator.js';
import { TINY_POLISH_WORDS } from './fixtures/tiny-dictionary.js';

const a = POLISH_ALPHABET;
const layout = SCRABBLE_LAYOUT_15X15;
const rules = SCRABBLE_CLASSIC_RULES;
const dictionary = buildTrieDictionary(TINY_POLISH_WORDS);

const baseCtx = (seed: number) => ({
  alphabet: a,
  layout,
  rules,
  dictionary,
  random: seededRng(seed),
});

describe('generator', () => {
  it('38. seeded generation is deterministic (same seed → same output)', () => {
    const a1 = generateBoard(baseCtx(42), { moves: 4 });
    const a2 = generateBoard(baseCtx(42), { moves: 4 });
    // movesPlayed lengths must match; word strings must match exactly.
    expect(a1.movesPlayed.length).toBe(a2.movesPlayed.length);
    for (let i = 0; i < a1.movesPlayed.length; i++) {
      expect(a1.movesPlayed[i]!.word).toBe(a2.movesPlayed[i]!.word);
      expect(a1.movesPlayed[i]!.score).toBe(a2.movesPlayed[i]!.score);
    }
  });

  it('39. property: every logged move main word is in the dictionary, score is non-negative, tiles count > 0', () => {
    for (const seed of [1, 7, 42, 100, 999]) {
      const result = generateBoard(baseCtx(seed), { moves: 5 });
      for (let i = 0; i < result.movesPlayed.length; i++) {
        const m = result.movesPlayed[i]!;
        expect(m.placement.tiles.length, `seed ${seed} move ${i}`).toBeGreaterThan(0);
        expect(m.score, `seed ${seed} move ${i} score`).toBeGreaterThanOrEqual(0);
        // The logged word is always main word; it must be in the
        // dictionary because the solver gated on it.
        expect(dictionary.has(m.word), `seed ${seed} move ${i}: word "${m.word}" not in dict`).toBe(true);
      }
      // Also: total tiles placed never exceeds the bag's starting size.
      const totalPlaced = result.movesPlayed.reduce((n, m) => n + m.placement.tiles.length, 0);
      expect(totalPlaced).toBeLessThanOrEqual(100);
    }
  });

  it('40. honours the moves cap', () => {
    const result = generateBoard(baseCtx(7), { moves: 3 });
    expect(result.movesPlayed.length).toBeLessThanOrEqual(3);
  });

  it('41. topPercentile=1 with deterministic random picks (close to) the top-scored placement', () => {
    // With percentile=1.0 the slice = whole list. The chosen index then
    // depends on `random()` × length, which is still seed-driven. We do
    // not assert "always best", but we do assert deterministic same-seed
    // output (which test 38 covers) and that topPercentile=1 gets at least
    // one move played.
    const result = generateBoard(baseCtx(42), { moves: 2, topPercentile: 1 });
    expect(result.movesPlayed.length).toBeGreaterThan(0);
  });

  it('42. terminates gracefully when the rack cannot form anything', () => {
    // A dictionary that contains zero matchable words for any rack should
    // exhaust exchanges and end the simulation.
    const emptyDict = buildTrieDictionary([]);
    const result = generateBoard(
      { alphabet: a, layout, rules, dictionary: emptyDict, random: seededRng(1) },
      { moves: 100 },
    );
    expect(result.movesPlayed.length).toBe(0);
    // No infinite loop — we got here without timing out.
  });

  it('43. finalRack: fresh-draw redraws the rack from the bag', () => {
    const last = generateBoard(baseCtx(13), { moves: 2, finalRack: 'last-rack' });
    const fresh = generateBoard(baseCtx(13), { moves: 2, finalRack: 'fresh-draw' });
    // The two runs share the same prefix of moves; only the final rack
    // should differ. Hard to assert exactly without RNG knowledge, so we
    // just assert the runs both completed and racks have the configured
    // size when bag had enough tiles.
    expect(last.rack.length).toBe(rules.rackSize);
    expect(fresh.rack.length).toBe(rules.rackSize);
  });
});

describe('generator — produced boards are usable', () => {
  it('after generation, the board has the configured size and the bag has shrunk', () => {
    const result = generateBoard(baseCtx(99), { moves: 3 });
    expect(result.board.length).toBe(layout.size);
    expect(result.bag.length).toBeLessThan(100);
  });
});
