import type { Direction } from '../types.js';

/** Step a row/col one cell along the given direction. */
export function step(
  row: number,
  col: number,
  direction: Direction,
): { row: number; col: number } {
  return direction === 'horizontal' ? { row, col: col + 1 } : { row: row + 1, col };
}

/** The direction perpendicular to the given one. */
export function perpendicular(direction: Direction): Direction {
  return direction === 'horizontal' ? 'vertical' : 'horizontal';
}

/** Whether `(row, col)` lies inside a `size × size` board. */
export function inBounds(row: number, col: number, size: number): boolean {
  return row >= 0 && row < size && col >= 0 && col < size;
}
