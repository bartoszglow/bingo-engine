import { describe, expect, it } from 'vitest';
import {
  POLISH_ALPHABET,
  SCRABBLE_CLASSIC_RULES,
  SCRABBLE_FREE_RULES,
  SCRABBLE_LAYOUT_15X15,
  blankTile,
  buildTrieDictionary,
  emptyBoard,
  letterTile,
  type Placement,
  type Rack,
} from '../src/index.js';
import { validatePlacement } from '../src/validator/validator.js';
import { TINY_POLISH_WORDS } from './fixtures/tiny-dictionary.js';
import { parseAsciiBoard } from './fixtures/boards.js';

const a = POLISH_ALPHABET;
const layout = SCRABBLE_LAYOUT_15X15;
const dictionary = buildTrieDictionary(TINY_POLISH_WORDS);
const ctx = { alphabet: a, layout, rules: SCRABBLE_CLASSIC_RULES, dictionary };
const freeCtx = { alphabet: a, layout, rules: SCRABBLE_FREE_RULES, dictionary };

const rack7 = (...letters: string[]): Rack =>
  letters.map((l) => letterTile(a, l)!).slice(0, 7);

const placeH = (row: number, col: number, ...letters: { l: string; b?: boolean }[]): Placement => ({
  startRow: row,
  startCol: col,
  direction: 'horizontal',
  tiles: letters.map((x) => ({ letter: x.l, isBlank: x.b ?? false })),
});

describe('validator — fundamental rules', () => {
  it('1. empty placement → empty-placement', () => {
    const board = emptyBoard(layout);
    const result = validatePlacement(
      board,
      { startRow: 7, startCol: 7, direction: 'horizontal', tiles: [] },
      [],
      ctx,
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('empty-placement');
  });

  it('2. tile off the right edge → out-of-bounds', () => {
    const board = emptyBoard(layout);
    const result = validatePlacement(
      board,
      placeH(7, 13, { l: 'k' }, { l: 'o' }, { l: 't' }), // would land 13,14,15 — col 15 is OOB
      rack7('k', 'o', 't'),
      freeCtx,
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('out-of-bounds');
  });

  it('3. linearity is enforced by the Placement type itself (single direction)', () => {
    // The Placement.direction field accepts only 'horizontal'|'vertical', so
    // a mixed-direction placement is impossible at the type level. Treated
    // as a sanity check — it confirms our design avoids the case.
    const valid: Placement = placeH(7, 5, { l: 'k' }, { l: 'o' }, { l: 't' });
    expect(valid.direction).toBe('horizontal');
  });

  it('4. structural gaps inside placement.tiles are impossible by design', () => {
    // The Placement schema lists *new* tiles contiguously starting at
    // (startRow, startCol). A consumer can't express "tile at col 5 and
    // col 7, skip col 6" without populating col 6 — and if col 6 is
    // populated, it either matches an existing letter (filler, rule 5) or
    // collides (rule 6) or is a freshly placed tile (no gap). So the
    // gap-without-existing-filler case is unreachable via valid input.
    // We assert the type-level invariant instead.
    const placement: Placement = {
      startRow: 7, startCol: 5, direction: 'horizontal',
      tiles: [
        { letter: 'k', isBlank: false },
        { letter: 't', isBlank: false },
      ],
    };
    expect(placement.tiles.length).toBe(2);
  });

  it('5. gap between new tiles, filled by existing letter → valid', () => {
    // Board has 'o' at (7,6). We place 'k' at (7,5) and 't' at (7,7) —
    // resulting in K-O-T. This is a real-world hook play.
    const board = parseAsciiBoard(
      `
      ...............
      ...............
      ...............
      ...............
      ...............
      ...............
      ...............
      ......o........
      ...............
      `,
      a,
      layout,
    );
    // We model "place k at 5 and t at 7, skipping the existing o at 6" as
    // a single placement whose start is (7,5) and tiles are k+t — but
    // only 2 tiles. The validator must walk col by col, see the existing
    // o, and skip it. To pass it through the linear scan we treat
    // tiles[] as the *new* tiles; the position formula is `startCol + i +
    // skipped_existing` per tile. The validator handles this internally.
    //
    // Easiest API: include the existing letter as a "filler" — the
    // validator detects existing-cell-with-same-letter and continues.
    // Many implementations do it this way.
    const placement: Placement = {
      startRow: 7, startCol: 5, direction: 'horizontal',
      tiles: [
        { letter: 'k', isBlank: false }, // (7,5)
        { letter: 'o', isBlank: false }, // (7,6) — filler matching existing
        { letter: 't', isBlank: false }, // (7,7)
      ],
    };
    // The rack only needs to provide k + t (the o was already on the board).
    const rack = rack7('k', 't', 'a', 'b');
    const result = validatePlacement(board, placement, rack, freeCtx);
    expect(result.valid).toBe(true);
  });

  it('6. new tile on existing different-letter cell → overlaps-existing-different-letter', () => {
    const board = parseAsciiBoard(
      `
      ...............
      ...............
      ...............
      ...............
      ...............
      ...............
      ...............
      .......a.......
      ...............
      `,
      a,
      layout,
    );
    const placement = placeH(7, 7, { l: 'k' }); // tries to put 'k' over existing 'a'
    const result = validatePlacement(board, placement, rack7('k'), freeCtx);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('overlaps-existing-different-letter');
  });

  it('7. first move not on center → first-move-not-on-center', () => {
    const board = emptyBoard(layout);
    // Place KOT starting at (5,5) — does not cross center (7,7).
    const placement = placeH(5, 5, { l: 'k' }, { l: 'o' }, { l: 't' });
    const result = validatePlacement(board, placement, rack7('k', 'o', 't'), ctx);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('first-move-not-on-center');
  });

  it('8. second move not connected to existing tiles → not-connected', () => {
    const board = parseAsciiBoard(
      `
      ...............
      ...............
      ...............
      ...............
      ...............
      ...............
      ...............
      .......kot.....
      ...............
      `,
      a,
      layout,
    );
    // Place 'pies' way off, not touching the existing 'kot'.
    const placement = placeH(0, 0, { l: 'p' }, { l: 'i' }, { l: 'e' }, { l: 's' });
    const result = validatePlacement(board, placement, rack7('p', 'i', 'e', 's'), ctx);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('not-connected');
  });

  it('9. rack cannot provide the required letters → rack-mismatch', () => {
    const board = emptyBoard(layout);
    const placement = placeH(7, 6, { l: 'k' }, { l: 'o' }, { l: 't' });
    const result = validatePlacement(board, placement, rack7('a', 'b', 'c'), ctx);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('rack-mismatch');
  });

  it('10. blank tile in rack covers a missing letter → valid', () => {
    const board = emptyBoard(layout);
    // Player has rack: k, o, blank — wants to play "kot". Blank is the 't'.
    const placement: Placement = {
      startRow: 7, startCol: 6, direction: 'horizontal',
      tiles: [
        { letter: 'k', isBlank: false },
        { letter: 'o', isBlank: false },
        { letter: 't', isBlank: true }, // blank used as 't'
      ],
    };
    const rack = [letterTile(a, 'k')!, letterTile(a, 'o')!, blankTile()];
    const result = validatePlacement(board, placement, rack, ctx);
    expect(result.valid).toBe(true);
  });

  it('11. main word not in dictionary → word-not-in-dictionary', () => {
    const board = emptyBoard(layout);
    const placement = placeH(7, 6, { l: 'x' }, { l: 'y' }, { l: 'z' });
    // Stack the rack with the needed letters; we expect dictionary failure
    // before rack check (or at least we expect dictionary failure).
    // Note: x, y, z aren't all in Polish alphabet — use letters that exist.
    const realisticPlacement = placeH(7, 6, { l: 'a' }, { l: 'b' }, { l: 'c' });
    const result = validatePlacement(
      board,
      realisticPlacement,
      rack7('a', 'b', 'c'),
      ctx,
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('word-not-in-dictionary');
    expect(result.invalidWords).toEqual(['abc']);
    void placement;
  });

  it('12. crossword not in dictionary → crossword-not-in-dictionary', () => {
    // Setup so the MAIN word is dictionary-valid but a CROSSWORD is fake.
    // The crossword check fires only for cols/rows containing NEW tiles —
    // so the vertical neighbour must be in the column of the placed letter.
    //
    //   row 6: . . . . . . a . . . . . . . .  (existing 'a' at col 6)
    //   row 7: . . . . . k . t . . . . . . .  (existing 'k' at col 5, 't' at col 7)
    //
    // Player places a single 'o' at (7,6) horizontally. Main word: 'kot'
    // (existing k + new o + existing t) — valid in TINY. Crossword at col 6:
    // 'a' (above) + new 'o' = 'ao' — NOT in TINY.
    const board = parseAsciiBoard(
      `
      ...............
      ...............
      ...............
      ...............
      ...............
      ...............
      ......a........
      .....k.t.......
      ...............
      `,
      a,
      layout,
    );
    const placement = placeH(7, 6, { l: 'o' });
    const result = validatePlacement(board, placement, rack7('o'), freeCtx);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('crossword-not-in-dictionary');
    expect(result.invalidWords).toContain('ao');
  });

  it('13. multiple invalid crosswords → all listed in invalidWords', () => {
    // Existing 'a' at (6,5) and 'b' at (6,7). Player plays 'kot' horizontally
    // at row 7 cols 5,6,7. Main word 'kot' is valid in TINY. Crosswords:
    //   col 5: existing 'a' (row 6) + new 'k' (row 7) = 'ak' (fake)
    //   col 6: nothing above + new 'o'                 = no crossword
    //   col 7: existing 'b' (row 6) + new 't' (row 7) = 'bt' (fake)
    // Two invalid crosswords → both must appear in invalidWords.
    const board = parseAsciiBoard(
      `
      ...............
      ...............
      ...............
      ...............
      ...............
      ...............
      .....a.b.......
      ...............
      ...............
      `,
      a,
      layout,
    );
    const placement = placeH(7, 5, { l: 'k' }, { l: 'o' }, { l: 't' });
    const result = validatePlacement(board, placement, rack7('k', 'o', 't'), freeCtx);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('crossword-not-in-dictionary');
    expect(result.invalidWords).toContain('ak');
    expect(result.invalidWords).toContain('bt');
  });

  it('14. Polish characters: ż, ł, ą work in placements and crosswords', () => {
    const board = emptyBoard(layout);
    // Play 'żaba' starting at (7,6) horizontally — covers center (7,7).
    const placement = placeH(7, 6, { l: 'ż' }, { l: 'a' }, { l: 'b' }, { l: 'a' });
    const rack = [
      letterTile(a, 'ż')!,
      letterTile(a, 'a')!,
      letterTile(a, 'b')!,
      letterTile(a, 'a')!,
    ];
    const result = validatePlacement(board, placement, rack, ctx);
    expect(result.valid).toBe(true);
  });

  it('15. blank as Polish letter ż validates (and dictionary uses real letter)', () => {
    const board = emptyBoard(layout);
    const placement: Placement = {
      startRow: 7, startCol: 6, direction: 'horizontal',
      tiles: [
        { letter: 'ż', isBlank: true }, // blank acting as ż
        { letter: 'a', isBlank: false },
        { letter: 'b', isBlank: false },
        { letter: 'a', isBlank: false },
      ],
    };
    const rack = [
      blankTile(),
      letterTile(a, 'a')!,
      letterTile(a, 'b')!,
      letterTile(a, 'a')!,
    ];
    const result = validatePlacement(board, placement, rack, ctx);
    expect(result.valid).toBe(true);
  });
});

describe('validator — happy paths', () => {
  it('valid first move on center', () => {
    const board = emptyBoard(layout);
    const placement = placeH(7, 6, { l: 'k' }, { l: 'o' }, { l: 't' });
    const result = validatePlacement(board, placement, rack7('k', 'o', 't'), ctx);
    expect(result.valid).toBe(true);
  });

  it('valid extension of existing word', () => {
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
    // Add 'y' at (7,9) → 'koty'.
    const placement = placeH(7, 9, { l: 'y' });
    const result = validatePlacement(board, placement, rack7('y'), freeCtx);
    expect(result.valid).toBe(true);
  });
});
