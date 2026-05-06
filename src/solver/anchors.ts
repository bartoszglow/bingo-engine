import type { Board, BoardLayout } from '../types.js';
import { hasNeighbour, isEmpty } from '../board/board.js';

export interface Anchor {
  readonly row: number;
  readonly col: number;
}

/**
 * Anchor cells are empty cells where the next placement must touch.
 *
 * - Empty board: only the layout's `centerStart` (or every cell if no
 *   `centerStart` is configured).
 * - Non-empty board: every empty cell with at least one orthogonal neighbour.
 *
 * Returned in row-major order (deterministic).
 */
export function findAnchors(board: Board, layout: BoardLayout): Anchor[] {
  const out: Anchor[] = [];
  if (isEmpty(board)) {
    if (layout.centerStart) {
      out.push({ row: layout.centerStart.row, col: layout.centerStart.col });
    } else {
      for (let r = 0; r < layout.size; r++) {
        for (let c = 0; c < layout.size; c++) out.push({ row: r, col: c });
      }
    }
    return out;
  }
  for (let r = 0; r < layout.size; r++) {
    for (let c = 0; c < layout.size; c++) {
      const cell = (board[r] as readonly (unknown | null)[])[c] ?? null;
      if (cell !== null) continue;
      if (hasNeighbour(board, r, c)) out.push({ row: r, col: c });
    }
  }
  return out;
}
