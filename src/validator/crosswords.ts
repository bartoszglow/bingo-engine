import type { Alphabet, Board, Cell, Direction } from '../types.js';
import { tileIdToLetter } from '../alphabet/alphabet.js';
import { inBounds, perpendicular } from '../board/coords.js';

export interface FormedWord {
  /** Lowercase string of letters, top-to-bottom or left-to-right. */
  word: string;
  /** Cells the word occupies, in reading order. */
  cells: ReadonlyArray<{ row: number; col: number; tileId: number }>;
}

/**
 * Walk along `direction` from `(row, col)` until you find an empty cell or
 * a board edge, in both directions. Returns the contiguous run of placed
 * tiles passing through `(row, col)` — empty if `(row, col)` itself is empty.
 *
 * Used to extract the perpendicular crossword formed at each newly placed
 * tile. A run of length 1 is treated as "no crossword" (a lone letter
 * doesn't form a word).
 */
export function readWord(
  board: Board,
  row: number,
  col: number,
  direction: Direction,
  alphabet: Alphabet,
): FormedWord | null {
  const size = board.length;
  if (!inBounds(row, col, size)) return null;
  const cell = (board[row] as Cell[])[col];
  if (!cell) return null;

  // Walk back to the start of the run.
  let r = row;
  let c = col;
  while (true) {
    const pr = direction === 'horizontal' ? r : r - 1;
    const pc = direction === 'horizontal' ? c - 1 : c;
    if (!inBounds(pr, pc, size)) break;
    if (!(board[pr] as Cell[])[pc]) break;
    r = pr;
    c = pc;
  }

  // Walk forward collecting the word.
  const cells: { row: number; col: number; tileId: number }[] = [];
  while (inBounds(r, c, size)) {
    const tile = (board[r] as Cell[])[c];
    if (!tile) break;
    cells.push({ row: r, col: c, tileId: tile.tileId });
    if (direction === 'horizontal') c += 1;
    else r += 1;
  }
  if (cells.length < 2) return null;

  const word = cells.map((cc) => tileIdToLetter(alphabet, cc.tileId)).join('');
  return { word, cells };
}

/**
 * Given a board AFTER a placement has been applied, return the main word
 * and every crossword formed. Inputs:
 *
 * - `board` — already includes the new tiles.
 * - `placement` direction tells us which axis is "main"; perpendicular axis
 *   is for crosswords.
 * - `placedCells` — coordinates of the NEW tiles (so we know which cells to
 *   probe for crosswords; existing tiles never form a "new" crossword).
 *
 * The main word is read along the placement direction starting from any
 * one new cell — `readWord` walks back to the run's start.
 */
export function extractFormedWords(
  board: Board,
  direction: Direction,
  placedCells: ReadonlyArray<{ row: number; col: number }>,
  alphabet: Alphabet,
): { mainWord: FormedWord | null; crosswords: FormedWord[] } {
  if (placedCells.length === 0) {
    return { mainWord: null, crosswords: [] };
  }

  // Main word — read along the placement axis starting at any new cell.
  const first = placedCells[0]!;
  const mainWord = readWord(board, first.row, first.col, direction, alphabet);

  const cross = perpendicular(direction);
  const crosswords: FormedWord[] = [];
  for (const { row, col } of placedCells) {
    const cw = readWord(board, row, col, cross, alphabet);
    if (cw) crosswords.push(cw);
  }

  return { mainWord, crosswords };
}
