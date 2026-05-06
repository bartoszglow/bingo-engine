import type {
  Alphabet,
  Board,
  BoardLayout,
  Cell,
  FormedWord,
  PlacedTile,
  Placement,
  RuleSet,
  ScoreBreakdown,
} from '../types.js';
import { BLANK_FLAG } from '../types.js';
import { letterToTileId, tileIdToLetter, tileScore } from '../alphabet/alphabet.js';
import { extractFormedWords } from '../validator/crosswords.js';
import { withCells } from '../board/board.js';
import { buildPremiumLookup, letterMultiplier, wordMultiplier } from './premiums.js';

/** Context the scorer needs. Subset of `EngineConfig` minus `dictionary`/`random`. */
export interface ScorerContext {
  readonly alphabet: Alphabet;
  readonly layout: BoardLayout;
  readonly rules: RuleSet;
}

/**
 * Score a placement by summing each formed word's value. Premium squares
 * apply ONLY to newly placed tiles; tiles already on the board ignore
 * their cell's premium for this turn. The bingo bonus (`rules.bingoBonus`)
 * is added once at the end when `placement.tiles.length === rules.bingoSize`.
 *
 * Convention: the input `placement` is structurally valid — call
 * `validatePlacement` first if you don't trust the source. The scorer does
 * NOT verify dictionary or rack constraints; it just adds points.
 *
 * The score breakdown lists every formed word, its individual score, and
 * its cells with `fromRack` / `isBlank` flags so callers can render
 * tooltips, animations, or audit trails.
 */
export function scorePlacement(
  board: Board,
  placement: Placement,
  ctx: ScorerContext,
): ScoreBreakdown {
  const { alphabet, layout, rules } = ctx;
  const premiumAt = buildPremiumLookup(layout);

  // Replicate the validator's filler-tile handling: walk the placement axis,
  // emitting either a "new" tile (for empty cells) or a "filler" hit (for
  // existing same-letter cells). The contract is that the placement is
  // structurally valid (call `validatePlacement` first) — so coordinates
  // stay in-bounds and every letter is in the alphabet.
  const newCells: { row: number; col: number; placedTile: PlacedTile }[] = [];
  let row = placement.startRow;
  let col = placement.startCol;

  for (const intended of placement.tiles) {
    const intendedId = letterToTileId(alphabet, intended.letter)!;
    const cell: Cell = (board[row] as Cell[])[col] ?? null;
    if (cell === null) {
      const placedTile: PlacedTile = {
        tileId: intended.isBlank ? intendedId | BLANK_FLAG : intendedId,
      };
      newCells.push({ row, col, placedTile });
    }
    if (placement.direction === 'horizontal') col += 1;
    else row += 1;
  }

  // Build the post-placement board so word reading is straightforward.
  const nextBoard = withCells(
    board,
    newCells.map((t) => ({ row: t.row, col: t.col, cell: t.placedTile })),
  );

  // Mark which (row,col) is "new this turn" — for premium-square eligibility.
  const newSet = new Set<number>();
  for (const c of newCells) newSet.add(c.row * layout.size + c.col);

  const { mainWord, crosswords } = extractFormedWords(
    nextBoard,
    placement.direction,
    newCells.map((t) => ({ row: t.row, col: t.col })),
    alphabet,
  );

  const formedWords: FormedWord[] = [];
  let total = 0;

  if (mainWord) {
    const scored = scoreWord(mainWord, newSet, layout.size, alphabet, premiumAt);
    formedWords.push(scored.formed);
    total += scored.formed.score;
  }
  for (const cw of crosswords) {
    const scored = scoreWord(cw, newSet, layout.size, alphabet, premiumAt);
    formedWords.push(scored.formed);
    total += scored.formed.score;
  }

  const bingo = newCells.length === rules.bingoSize && rules.bingoBonus > 0;
  if (bingo) total += rules.bingoBonus;

  return Object.freeze({
    total,
    bingo,
    words: Object.freeze(formedWords),
  });
}

type FormedCell = FormedWord['cells'] extends readonly (infer C)[] ? C : never;

function scoreWord(
  word: { word: string; cells: ReadonlyArray<{ row: number; col: number; tileId: number }> },
  newSet: Set<number>,
  boardSize: number,
  alphabet: Alphabet,
  premiumAt: (row: number, col: number) => 'DLS' | 'TLS' | 'DWS' | 'TWS' | undefined,
): { formed: FormedWord; score: number } {
  let letterTotal = 0;
  let wordMult = 1;
  const breakdown: FormedCell[] = [];

  for (const cell of word.cells) {
    const isNew = newSet.has(cell.row * boardSize + cell.col);
    const premium = isNew ? premiumAt(cell.row, cell.col) : undefined;
    const baseScore = tileScore(alphabet, cell.tileId);
    letterTotal += baseScore * letterMultiplier(premium);
    if (isNew) wordMult *= wordMultiplier(premium);

    breakdown.push({
      row: cell.row,
      col: cell.col,
      letter: tileIdToLetter(alphabet, cell.tileId),
      fromRack: isNew,
      isBlank: (cell.tileId & 0x80) !== 0,
    });
  }

  const score = letterTotal * wordMult;
  return {
    formed: { word: word.word, score, cells: breakdown },
    score,
  };
}
