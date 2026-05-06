import type { BoardLayout, PremiumKind } from '../types.js';

const KIND_TO_CODE: Readonly<Record<PremiumKind, number>> = {
  DLS: 1,
  TLS: 2,
  DWS: 3,
  TWS: 4,
};

const CODE_TO_KIND: readonly (PremiumKind | undefined)[] = [
  undefined,
  'DLS',
  'TLS',
  'DWS',
  'TWS',
];

/**
 * Build a row-major lookup of premium-square kinds for fast O(1) access by
 * `(row, col)`. Returns `undefined` for plain cells or out-of-bounds cells.
 * Built once per scorer call.
 */
export function buildPremiumLookup(
  layout: BoardLayout,
): (row: number, col: number) => PremiumKind | undefined {
  const map = new Uint8Array(layout.size * layout.size);
  for (const p of layout.premiums) {
    map[p.row * layout.size + p.col] = KIND_TO_CODE[p.kind];
  }
  return (row, col) => {
    if (row < 0 || row >= layout.size || col < 0 || col >= layout.size) return undefined;
    return CODE_TO_KIND[map[row * layout.size + col] ?? 0];
  };
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
