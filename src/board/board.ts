import type { Board, BoardLayout, Cell, PlacedTile } from '../types.js';
import { inBounds } from './coords.js';

/** Build an empty `size × size` board. All cells are `null`. */
export function emptyBoard(layout: BoardLayout): Board {
  const rows: Cell[][] = new Array(layout.size);
  for (let r = 0; r < layout.size; r++) {
    rows[r] = new Array(layout.size).fill(null);
  }
  return rows;
}

/** Read a cell. Throws on out-of-bounds — caller should check first. */
export function getCell(board: Board, row: number, col: number): Cell {
  const r = board[row];
  if (!r) throw new RangeError(`Row ${row} out of bounds for board.`);
  const cell = r[col];
  if (cell === undefined) throw new RangeError(`Column ${col} out of bounds for board.`);
  return cell;
}

/** True iff every cell is empty. O(n²) — only used at start of generator. */
export function isEmpty(board: Board): boolean {
  for (const row of board) for (const cell of row) if (cell !== null) return false;
  return true;
}

/**
 * Return a new board with one cell replaced. Original board is untouched.
 * Throws on out-of-bounds.
 */
export function withCell(board: Board, row: number, col: number, cell: Cell): Board {
  const size = board.length;
  if (!inBounds(row, col, size)) {
    throw new RangeError(`(${row}, ${col}) out of bounds for ${size}×${size} board.`);
  }
  const next: Cell[][] = new Array(size);
  for (let r = 0; r < size; r++) {
    if (r === row) {
      const newRow = (board[r] as Cell[]).slice();
      newRow[col] = cell;
      next[r] = newRow;
    } else {
      next[r] = board[r] as Cell[];
    }
  }
  return next;
}

/**
 * Apply many cell changes at once and return one new board. Throws if any
 * change is out of bounds.
 */
export function withCells(
  board: Board,
  changes: ReadonlyArray<{ row: number; col: number; cell: Cell }>,
): Board {
  if (changes.length === 0) return board;
  const size = board.length;
  // Mutate fresh copy of every dirtied row to share the rest with `board`.
  const next: Cell[][] = new Array(size);
  for (let r = 0; r < size; r++) next[r] = board[r] as Cell[];
  const dirty = new Set<number>();
  for (const { row, col, cell } of changes) {
    if (!inBounds(row, col, size)) {
      throw new RangeError(`(${row}, ${col}) out of bounds for ${size}×${size} board.`);
    }
    if (!dirty.has(row)) {
      next[row] = (board[row] as Cell[]).slice();
      dirty.add(row);
    }
    (next[row] as Cell[])[col] = cell;
  }
  return next;
}

/**
 * Whether `(row, col)` has at least one orthogonal neighbour with a tile.
 * Out-of-bounds cells count as empty.
 */
export function hasNeighbour(board: Board, row: number, col: number): boolean {
  const size = board.length;
  const at = (r: number, c: number): Cell => {
    if (!inBounds(r, c, size)) return null;
    return (board[r] as Cell[])[c] ?? null;
  };
  return (
    at(row - 1, col) !== null ||
    at(row + 1, col) !== null ||
    at(row, col - 1) !== null ||
    at(row, col + 1) !== null
  );
}

/** Convenience: place a single tile and return a new board. */
export function placeTile(
  board: Board,
  row: number,
  col: number,
  tile: PlacedTile,
): Board {
  return withCell(board, row, col, tile);
}
