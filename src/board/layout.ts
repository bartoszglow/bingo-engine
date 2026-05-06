import type { BoardLayout, PremiumKind, PremiumSquare } from '../types.js';

const SIZE = 15;
const CENTER = 7;

/**
 * Reference Scrabble premium-square layout (15×15). Same as English Scrabble
 * and OSPS-tournament Polish Scrabble. Coordinates are 0-indexed.
 *
 * Counts (verified after this file): 8 TWS + 16 DWS + 12 TLS + 24 DLS + 1 center
 *                                     = 61 premium squares total.
 * Center cell `(7, 7)` is treated as DWS in classic Scrabble rules.
 */
const TWS_POSITIONS: readonly [number, number][] = [
  [0, 0], [0, 7], [0, 14],
  [7, 0],         [7, 14],
  [14, 0], [14, 7], [14, 14],
];

const DWS_POSITIONS: readonly [number, number][] = [
  // Two diagonals from each corner of the inner 13×13:
  [1, 1], [2, 2], [3, 3], [4, 4],
  [1, 13], [2, 12], [3, 11], [4, 10],
  [13, 1], [12, 2], [11, 3], [10, 4],
  [13, 13], [12, 12], [11, 11], [10, 10],
  // Center
  [CENTER, CENTER],
];

const TLS_POSITIONS: readonly [number, number][] = [
  [1, 5], [1, 9],
  [5, 1], [5, 5], [5, 9], [5, 13],
  [9, 1], [9, 5], [9, 9], [9, 13],
  [13, 5], [13, 9],
];

const DLS_POSITIONS: readonly [number, number][] = [
  [0, 3], [0, 11],
  [2, 6], [2, 8],
  [3, 0], [3, 7], [3, 14],
  [6, 2], [6, 6], [6, 8], [6, 12],
  [7, 3], [7, 11],
  [8, 2], [8, 6], [8, 8], [8, 12],
  [11, 0], [11, 7], [11, 14],
  [12, 6], [12, 8],
  [14, 3], [14, 11],
];

function buildPremiums(): PremiumSquare[] {
  const out: PremiumSquare[] = [];
  const push = (kind: PremiumKind, list: readonly [number, number][]) => {
    for (const [row, col] of list) out.push({ row, col, kind });
  };
  push('TWS', TWS_POSITIONS);
  push('DWS', DWS_POSITIONS);
  push('TLS', TLS_POSITIONS);
  push('DLS', DLS_POSITIONS);
  return out;
}

/** Classic Scrabble 15×15 layout with full premium squares. */
export const SCRABBLE_LAYOUT_15X15: BoardLayout = Object.freeze({
  size: SIZE,
  premiums: Object.freeze(buildPremiums()),
  centerStart: Object.freeze({ row: CENTER, col: CENTER }),
});

/** 15×15 layout with no premium squares (useful for casual variants). */
export const SIMPLE_LAYOUT_15X15: BoardLayout = Object.freeze({
  size: SIZE,
  premiums: Object.freeze<PremiumSquare[]>([]),
  centerStart: Object.freeze({ row: CENTER, col: CENTER }),
});
