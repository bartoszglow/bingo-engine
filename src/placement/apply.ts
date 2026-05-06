import type { Alphabet, Board, Cell, PlacedTile, Placement, TileId } from '../types.js';
import { BLANK_FLAG } from '../types.js';
import { letterToTileId } from '../alphabet/alphabet.js';
import { withCells } from '../board/board.js';

/**
 * Compute the row/col + new tile id for every NEW tile in a placement,
 * skipping cells that are already occupied (those are listed as filler in
 * the placement). Assumes the placement is structurally valid.
 */
export function computeNewCells(
  board: Board,
  placement: Placement,
  alphabet: Alphabet,
): { row: number; col: number; placedTile: PlacedTile }[] {
  const out: { row: number; col: number; placedTile: PlacedTile }[] = [];
  let row = placement.startRow;
  let col = placement.startCol;
  for (const intended of placement.tiles) {
    const intendedId: TileId = letterToTileId(alphabet, intended.letter)!;
    const cell: Cell = (board[row] as Cell[])[col] ?? null;
    if (cell === null) {
      out.push({
        row,
        col,
        placedTile: {
          tileId: intended.isBlank ? intendedId | BLANK_FLAG : intendedId,
        },
      });
    }
    if (placement.direction === 'horizontal') col += 1;
    else row += 1;
  }
  return out;
}

/**
 * Apply a placement to a board, returning a new board with the new tiles
 * laid down. The original board is untouched. Assumes the placement passed
 * `validatePlacement` — does not re-check.
 */
export function applyPlacement(board: Board, placement: Placement, alphabet: Alphabet): Board {
  const newCells = computeNewCells(board, placement, alphabet);
  return withCells(
    board,
    newCells.map((c) => ({ row: c.row, col: c.col, cell: c.placedTile })),
  );
}
