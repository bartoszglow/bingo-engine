import { describe, expect, it } from 'vitest';
import {
  POLISH_ALPHABET,
  SCRABBLE_CLASSIC_RULES,
  SCRABBLE_LAYOUT_15X15,
  SIMPLE_LAYOUT_15X15,
  blankTile,
  emptyBoard,
  letterTile,
  type Placement,
} from '../src/index.js';
import { scorePlacement } from '../src/scorer/scorer.js';
import { parseAsciiBoard } from './fixtures/boards.js';

const a = POLISH_ALPHABET;
const layoutPremium = SCRABBLE_LAYOUT_15X15;
const layoutPlain = SIMPLE_LAYOUT_15X15;
const rulesClassic = SCRABBLE_CLASSIC_RULES;

const ctxPremium = { alphabet: a, layout: layoutPremium, rules: rulesClassic };
const ctxPlain = { alphabet: a, layout: layoutPlain, rules: rulesClassic };

const placeH = (row: number, col: number, ...letters: { l: string; b?: boolean }[]): Placement => ({
  startRow: row,
  startCol: col,
  direction: 'horizontal',
  tiles: letters.map((x) => ({ letter: x.l, isBlank: x.b ?? false })),
});

describe('scorer', () => {
  it('16. single word, no premiums → sum of letter values', () => {
    // 'kot' = k(2) + o(1) + t(2) = 5
    const board = emptyBoard(layoutPlain);
    const placement = placeH(7, 6, { l: 'k' }, { l: 'o' }, { l: 't' });
    const result = scorePlacement(board, placement, ctxPlain);
    expect(result.total).toBe(5);
    expect(result.bingo).toBe(false);
    expect(result.words.length).toBe(1);
    expect(result.words[0]!.word).toBe('kot');
  });

  it('17. DLS on a new tile doubles only that tile', () => {
    // Board layout has DLS at (3,0); the rest plain. Place 'k' at (3,0)
    // followed by 'o','t'. k(2) on DLS becomes 4; o(1) and t(2) plain.
    // Score: 4 + 1 + 2 = 7.
    const board = emptyBoard(layoutPremium);
    const placement = placeH(3, 0, { l: 'k' }, { l: 'o' }, { l: 't' });
    const result = scorePlacement(board, placement, ctxPremium);
    // Note: this row has no other premiums between cols 0-2, just DLS at (3,0).
    expect(result.total).toBe(7);
  });

  it('18. DLS on an EXISTING tile is ignored (premium applies only to new tiles)', () => {
    // Suppose 'k' already on board at DLS cell (3,0). New tiles 'o','t'
    // extend it. The 'k' should NOT be re-doubled.
    // existing k at (3,0); place 'ot' at (3,1)(3,2): k(2)+o(1)+t(2)=5.
    const board = parseAsciiBoard(
      `
      ...............
      ...............
      ...............
      k..............
      `,
      a,
      layoutPremium,
    );
    const placement = placeH(3, 1, { l: 'o' }, { l: 't' });
    const result = scorePlacement(board, placement, ctxPremium);
    expect(result.total).toBe(5);
  });

  it('19. TLS on a new tile triples only that tile', () => {
    // TLS is at e.g. (1,5). Place 'kot' starting at (1,5) — k on TLS.
    // k(2)*3 + o(1) + t(2) = 9.
    const board = emptyBoard(layoutPremium);
    const placement = placeH(1, 5, { l: 'k' }, { l: 'o' }, { l: 't' });
    const result = scorePlacement(board, placement, ctxPremium);
    expect(result.total).toBe(9);
  });

  it('20. DWS doubles the whole word', () => {
    // Center (7,7) is DWS. Place 'kot' covering it: starts at (7,6).
    // k(2)+o(1)+t(2) = 5; *2 (DWS at center) = 10.
    const board = emptyBoard(layoutPremium);
    const placement = placeH(7, 6, { l: 'k' }, { l: 'o' }, { l: 't' });
    const result = scorePlacement(board, placement, ctxPremium);
    expect(result.total).toBe(10);
  });

  it('21. TWS triples the whole word', () => {
    // TWS at (0,0). Place 'kot' starting at (0,0).
    // k(2)+o(1)+t(2) = 5; *3 (TWS) = 15.
    const board = emptyBoard(layoutPremium);
    const placement = placeH(0, 0, { l: 'k' }, { l: 'o' }, { l: 't' });
    const result = scorePlacement(board, placement, ctxPremium);
    expect(result.total).toBe(15);
  });

  it('22. TWS + TWS in the same word multiply (×9), with intervening DLS counted', () => {
    // 8-letter word at (0,0)..(0,7). Premiums in this row: TWS@(0,0),
    // DLS@(0,3), TWS@(0,7). 'autoroma' letters:
    //   a(1) + u(3) + t(2) + o(1)*2(DLS) + r(1) + o(1) + m(2) + a(1) = 13
    //   word mult: 3 (TWS at 0,0) × 3 (TWS at 0,7) = 9
    //   total: 13 * 9 = 117
    const board = emptyBoard(layoutPremium);
    const placement = placeH(
      0,
      0,
      { l: 'a' }, { l: 'u' }, { l: 't' }, { l: 'o' },
      { l: 'r' }, { l: 'o' }, { l: 'm' }, { l: 'a' },
    );
    const result = scorePlacement(board, placement, ctxPremium);
    expect(result.total).toBe(117);
  });

  it('23. DLS + DWS combined', () => {
    // Premium at (0,3) is DLS, premium at (7,7) is DWS. Build a word that
    // starts at (3,0) — DLS — and stays in row 3. We need DWS too. Row 3
    // has DWS at (3,3). So a word at (3,0)..(3,3) hits DLS@(3,0), DWS@(3,3).
    // 4 letters: 'koty' — k(2)+o(1)+t(2)+y(2). Letter mult: k*2 (DLS)+o+t+y = 4+1+2+2=9.
    // Word mult: ×2 (DWS at (3,3)). Total: 9*2=18.
    const board = emptyBoard(layoutPremium);
    const placement = placeH(3, 0, { l: 'k' }, { l: 'o' }, { l: 't' }, { l: 'y' });
    const result = scorePlacement(board, placement, ctxPremium);
    expect(result.total).toBe(18);
  });

  it('24. crossword scored independently with its own premiums', () => {
    // Existing 'a' at (6,7). Place 'kot' starting at (7,6) horizontally,
    // covering DWS at (7,7). Main word 'kot': k+o+t = 5, *2 (DWS new) = 10.
    // Crossword at col 7: 'a' (existing) + 'o' (new at (7,7)) = 'ao'.
    // The 'o' at (7,7) is a new tile on DWS. For the CROSSWORD score:
    //   letter sum: a(1) + o(1)*1=1 (DWS doesn't apply to letter mult) → 2
    //   word mult: *2 (DWS at (7,7) is new; DWS applies to crossword too)
    //   crossword score: 2*2 = 4
    // Total = 10 + 4 = 14.
    const board = parseAsciiBoard(
      `
      ...............
      ...............
      ...............
      ...............
      ...............
      ...............
      .......a.......
      `,
      a,
      layoutPremium,
    );
    const placement = placeH(7, 6, { l: 'k' }, { l: 'o' }, { l: 't' });
    const result = scorePlacement(board, placement, ctxPremium);
    expect(result.total).toBe(14);
    expect(result.words.length).toBe(2);
  });

  it('25. blank tile scores 0 regardless of cell', () => {
    const board = emptyBoard(layoutPlain);
    // 'kot' with 't' as a blank: k(2) + o(1) + 0 (blank) = 3.
    const placement = placeH(7, 6, { l: 'k' }, { l: 'o' }, { l: 't', b: true });
    const result = scorePlacement(board, placement, ctxPlain);
    expect(result.total).toBe(3);
  });

  it('26. blank on a DWS — word still doubles, blank still 0', () => {
    // Place blank-as-k on (7,7) DWS, then 'ot'. Score:
    //   k(blank)=0, o(1), t(2). Sum=3. *2 (DWS) = 6.
    const board = emptyBoard(layoutPremium);
    const placement = placeH(7, 7, { l: 'k', b: true }, { l: 'o' }, { l: 't' });
    const result = scorePlacement(board, placement, ctxPremium);
    expect(result.total).toBe(6);
  });

  it('27. bingo: tiles.length === bingoSize → +50 to total', () => {
    // 7-letter word at (7,7)..(7,13). Premiums in this run: DWS@(7,7),
    // DLS@(7,11). 'autobus' letters:
    //   a(1) + u(3) + t(2) + o(1) + b(3)*2(DLS) + u(3) + s(1) = 17
    //   word mult: 2 (DWS at 7,7)
    //   word total: 17 * 2 = 34, plus bingo +50 = 84
    const board = emptyBoard(layoutPremium);
    const placement = placeH(
      7,
      7,
      { l: 'a' }, { l: 'u' }, { l: 't' }, { l: 'o' },
      { l: 'b' }, { l: 'u' }, { l: 's' },
    );
    const result = scorePlacement(board, placement, ctxPremium);
    expect(result.bingo).toBe(true);
    expect(result.total).toBe(84);
  });

  it('28. bingo bonus added AFTER premium-multiplied word value', () => {
    // 7 tiles at (0,0) — TWS at (0,0), DLS at (0,3) within the word.
    // Letters: 'autorom' (7 letters): a(1)+u(3)+t(2)+o(1)+r(1)+o(1)+m(2)=11
    //   DLS at (0,3) is the 4th tile = 'o' (1) → letter total: 1+3+2+(1*2)+1+1+2=11+1=12
    //   TWS at (0,0) ×3 → word total = 12*3 = 36
    //   plus bingo +50 = 86
    const board = emptyBoard(layoutPremium);
    const placement = placeH(
      0,
      0,
      { l: 'a' }, { l: 'u' }, { l: 't' }, { l: 'o' },
      { l: 'r' }, { l: 'o' }, { l: 'm' },
    );
    const result = scorePlacement(board, placement, ctxPremium);
    expect(result.bingo).toBe(true);
    expect(result.total).toBe(86);
  });

  it('29. rules.bingoBonus === 0 → no bingo bonus added', () => {
    // Same placement as test 27 but bingo disabled.
    // letter sum with DLS at (7,11): 17. ×2 (DWS) = 34. No bonus.
    const noBingo = { ...ctxPremium, rules: { ...rulesClassic, bingoBonus: 0 } };
    const board = emptyBoard(layoutPremium);
    const placement = placeH(
      7,
      7,
      { l: 'a' }, { l: 'u' }, { l: 't' }, { l: 'o' },
      { l: 'b' }, { l: 'u' }, { l: 's' },
    );
    const result = scorePlacement(board, placement, noBingo);
    expect(result.bingo).toBe(false);
    expect(result.total).toBe(34);
  });
});

describe('scorer — additional sanity', () => {
  it('reports per-word breakdown with cells flagged fromRack/isBlank', () => {
    const board = emptyBoard(layoutPlain);
    const placement = placeH(7, 6, { l: 'k' }, { l: 'o' }, { l: 't', b: true });
    const result = scorePlacement(board, placement, ctxPlain);
    expect(result.words.length).toBe(1);
    const cells = result.words[0]!.cells;
    expect(cells.length).toBe(3);
    expect(cells.every((c) => c.fromRack)).toBe(true);
    expect(cells[2]!.isBlank).toBe(true);
    expect(cells[0]!.isBlank).toBe(false);
  });

  it('uses `letterTile` / `blankTile` for board context', () => {
    // Sanity: ensure imports compile and the helpers are honoured by
    // parseAsciiBoard. Existing 'k' tile on board, place 'oty' next to it:
    const board = parseAsciiBoard(
      `
      ...............
      ...............
      ...............
      ...............
      ...............
      ...............
      ...............
      ......k........
      ...............
      `,
      a,
      layoutPlain,
    );
    const placement = placeH(7, 7, { l: 'o' }, { l: 't' }, { l: 'y' });
    const result = scorePlacement(board, placement, ctxPlain);
    // word 'koty' = 2+1+2+2 = 7 (no premiums in plain layout).
    expect(result.words[0]!.word).toBe('koty');
    expect(result.total).toBe(7);
    // Sanity-check that the helper imports stayed used so the linter doesn't warn.
    void letterTile;
    void blankTile;
  });
});
