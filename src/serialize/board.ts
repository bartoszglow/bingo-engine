import type { Board, BoardLayout, Cell, PlacedTile, SerializedBoard } from '../types.js';
import { emptyBoard } from '../board/board.js';

/**
 * Serialize a Board to a JSON-friendly row-major array.
 *
 * Output is `{ size, cells: [...] }` where each cell is either `null` or
 * `{ tileId }`. Round-trips through `deserializeBoard`. Suitable for
 * storage (Mongo, localStorage, postMessage) without losing the blank flag.
 */
export function serializeBoard(board: Board): SerializedBoard {
  const size = board.length;
  const cells: (PlacedTile | null)[] = new Array(size * size);
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      cells[r * size + c] = (board[r] as Cell[])[c] ?? null;
    }
  }
  return Object.freeze({ size, cells: Object.freeze(cells) });
}

/** Inverse of {@link serializeBoard}. Builds a fresh `size×size` board. */
export function deserializeBoard(data: SerializedBoard, layout?: BoardLayout): Board {
  const size = data.size;
  if (layout && layout.size !== size) {
    throw new Error(`Serialized board size ${size} does not match layout size ${layout.size}.`);
  }
  const board = emptyBoard({ size, premiums: [] });
  const next: Cell[][] = board.map((row) => (row as Cell[]).slice());
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const cell = data.cells[r * size + c] ?? null;
      next[r]![c] = cell;
    }
  }
  return next;
}
