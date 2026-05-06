import type { BoardLayout, PremiumKind } from '../types.js';

/**
 * Build a row-major lookup of premium-square kinds for fast O(1) access by
 * `(row, col)`. Returns `undefined` for plain cells. Built once per layout
 * and cached by the scorer.
 */
export function buildPremiumLookup(
  layout: BoardLayout,
): (row: number, col: number) => PremiumKind | undefined {
  const map = new Uint8Array(layout.size * layout.size);
  // Encoding: 0 = none, 1 = DLS, 2 = TLS, 3 = DWS, 4 = TWS.
  for (const p of layout.premiums) {
    const idx = p.row * layout.size + p.col;
    map[idx] = encodeKind(p.kind);
  }
  const decode: (PremiumKind | undefined)[] = [undefined, 'DLS', 'TLS', 'DWS', 'TWS'];
  return (row, col) => {
    if (row < 0 || row >= layout.size || col < 0 || col >= layout.size) return undefined;
    return decode[map[row * layout.size + col] ?? 0];
  };
}

function encodeKind(kind: PremiumKind): number {
  switch (kind) {
    case 'DLS':
      return 1;
    case 'TLS':
      return 2;
    case 'DWS':
      return 3;
    case 'TWS':
      return 4;
    default:
      return 0;
  }
}

/** Letter multiplier for a premium. Word multipliers return 1. */
export function letterMultiplier(kind: PremiumKind | undefined): number {
  if (kind === 'DLS') return 2;
  if (kind === 'TLS') return 3;
  return 1;
}

/** Word multiplier for a premium. Letter multipliers return 1. */
export function wordMultiplier(kind: PremiumKind | undefined): number {
  if (kind === 'DWS') return 2;
  if (kind === 'TWS') return 3;
  return 1;
}
