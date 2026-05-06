import { describe, expect, it } from 'vitest';
import {
  POLISH_ALPHABET,
  SCRABBLE_CLASSIC_RULES,
  SCRABBLE_LAYOUT_15X15,
  buildTrieDictionary,
  createBingoEngine,
  letterTile,
  seededRng,
  type Placement,
  type Rack,
} from '../src/index.js';
import { TINY_POLISH_WORDS } from './fixtures/tiny-dictionary.js';

const a = POLISH_ALPHABET;
const dictionary = buildTrieDictionary(TINY_POLISH_WORDS);

const baseConfig = (seed: number) => ({
  alphabet: a,
  layout: SCRABBLE_LAYOUT_15X15,
  rules: SCRABBLE_CLASSIC_RULES,
  dictionary,
  random: seededRng(seed),
});

describe('createBingoEngine — end to end', () => {
  it('engine.emptyBoard() + engine.freshBag() + engine.drawTiles()', () => {
    const engine = createBingoEngine(baseConfig(7));
    const board = engine.emptyBoard();
    expect(board.length).toBe(15);
    const bag = engine.freshBag();
    expect(bag.length).toBe(100);
    const { drawn, bag: rest } = engine.drawTiles(bag, 7);
    expect(drawn.length).toBe(7);
    expect(rest.length).toBe(93);
  });

  it('end-to-end: place a word, validate, score, apply, then continue', () => {
    const engine = createBingoEngine(baseConfig(42));
    const board0 = engine.emptyBoard();

    const placement: Placement = {
      startRow: 7,
      startCol: 6,
      direction: 'horizontal',
      tiles: [
        { letter: 'k', isBlank: false },
        { letter: 'o', isBlank: false },
        { letter: 't', isBlank: false },
      ],
    };
    const rack: Rack = [
      letterTile(a, 'k')!,
      letterTile(a, 'o')!,
      letterTile(a, 't')!,
      letterTile(a, 'a')!,
    ];

    expect(engine.validatePlacement(board0, placement, rack).valid).toBe(true);
    const score = engine.scorePlacement(board0, placement);
    expect(score.total).toBeGreaterThan(0);
    expect(score.words.length).toBe(1);
    expect(score.words[0]!.word).toBe('kot');

    const board1 = engine.applyPlacement(board0, placement);
    expect(board1[7]![7]).not.toBeNull();
    // Original board unchanged.
    expect(board0[7]![7]).toBeNull();
  });

  it('engine.findAllPlacements + engine.generateBoard', () => {
    const engine = createBingoEngine(baseConfig(99));
    const generated = engine.generateBoard({ moves: 3 });
    expect(generated.movesPlayed.length).toBeLessThanOrEqual(3);
    expect(generated.rack.length).toBe(SCRABBLE_CLASSIC_RULES.rackSize);

    const moves = engine.findAllPlacements(generated.board, generated.rack, { limit: 5 });
    for (const m of moves) {
      expect(engine.validatePlacement(generated.board, m, generated.rack).valid).toBe(true);
    }
  });

  it('engine.placementsToWords lists main + crossword words for a placement', () => {
    const engine = createBingoEngine(baseConfig(11));
    const board = engine.emptyBoard();
    const placement: Placement = {
      startRow: 7,
      startCol: 6,
      direction: 'horizontal',
      tiles: [
        { letter: 'k', isBlank: false },
        { letter: 'o', isBlank: false },
        { letter: 't', isBlank: false },
      ],
    };
    const words = engine.placementsToWords(board, placement);
    expect(words.length).toBe(1);
    expect(words[0]!.word).toBe('kot');
  });

  it('engine.serializeBoard + deserializeBoard round-trip', () => {
    const engine = createBingoEngine(baseConfig(3));
    const board = engine.applyPlacement(engine.emptyBoard(), {
      startRow: 7,
      startCol: 7,
      direction: 'horizontal',
      tiles: [{ letter: 'a', isBlank: false }],
    });
    const ser = engine.serializeBoard(board);
    const restored = engine.deserializeBoard(ser);
    expect(restored[7]![7]).toEqual(board[7]![7]);
  });
});
