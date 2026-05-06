import type { Alphabet, Board, BoardLayout, Cell } from '../../src/index.js';
import { emptyBoard, letterTile } from '../../src/index.js';

/**
 * Parse a multi-line ASCII art representation into a Board.
 *
 * - Each non-empty line is one row.
 * - `.` (or space) means empty cell.
 * - Any other single character is treated as a tile of that letter.
 *
 * The result is padded to `layout.size` × `layout.size` if the input is
 * smaller; longer inputs throw.
 */
export function parseAsciiBoard(
  ascii: string,
  alphabet: Alphabet,
  layout: BoardLayout,
): Board {
  // Trim BOTH leading and trailing whitespace per line so template-literal
  // indentation in tests doesn't bleed into the board. Inside an ASCII row
  // we use '.' for empty cells, never spaces.
  const lines = ascii
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length > layout.size) {
    throw new Error(`Board has ${lines.length} rows, expected ≤ ${layout.size}.`);
  }

  let board = emptyBoard(layout);
  const next: Cell[][] = board.map((row) => (row as Cell[]).slice());

  for (let r = 0; r < lines.length; r++) {
    const line = lines[r]!;
    const chars = Array.from(line);
    if (chars.length > layout.size) {
      throw new Error(`Row ${r} has ${chars.length} cells, expected ≤ ${layout.size}.`);
    }
    for (let c = 0; c < chars.length; c++) {
      const ch = chars[c]!;
      if (ch === '.' || ch === ' ') {
        next[r]![c] = null;
        continue;
      }
      const t = letterTile(alphabet, ch);
      if (!t) throw new Error(`Unknown letter '${ch}' at row ${r}, col ${c}.`);
      next[r]![c] = t;
    }
  }
  board = next;
  return board;
}

/**
 * Render a Board back to ASCII for snapshot-friendly assertions and debugging.
 */
export function renderAsciiBoard(board: Board, alphabet: Alphabet): string {
  return board
    .map((row) =>
      row
        .map((cell) => (cell === null ? '.' : alphabet.labels[cell.tileId & 0x7f] ?? '.'))
        .join(''),
    )
    .join('\n');
}
