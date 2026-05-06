import { describe, expect, it } from 'vitest';
import {
  SCRABBLE_LAYOUT_15X15,
  SIMPLE_LAYOUT_15X15,
  type PremiumKind,
} from '../src/index.js';

describe('SCRABBLE_LAYOUT_15X15', () => {
  const layout = SCRABBLE_LAYOUT_15X15;

  it('is a 15×15 board', () => {
    expect(layout.size).toBe(15);
  });

  it('has the canonical premium-square counts', () => {
    const counts: Record<PremiumKind, number> = { TWS: 0, DWS: 0, TLS: 0, DLS: 0 };
    for (const p of layout.premiums) counts[p.kind]++;

    // Standard Scrabble layout (verified vs Wikipedia + Hasbro reference):
    expect(counts.TWS).toBe(8);
    expect(counts.DWS).toBe(17); // 16 + center
    expect(counts.TLS).toBe(12);
    expect(counts.DLS).toBe(24);
    expect(layout.premiums.length).toBe(8 + 17 + 12 + 24);
  });

  it('places TWS in all four corners and edge midpoints', () => {
    const tws = new Set(
      layout.premiums.filter((p) => p.kind === 'TWS').map((p) => `${p.row},${p.col}`),
    );
    const expected = ['0,0', '0,7', '0,14', '7,0', '7,14', '14,0', '14,7', '14,14'];
    for (const e of expected) expect(tws.has(e), `TWS at ${e}`).toBe(true);
  });

  it('places center as a DWS', () => {
    const center = layout.premiums.find((p) => p.row === 7 && p.col === 7);
    expect(center).toBeDefined();
    expect(center!.kind).toBe('DWS');
  });

  it('exposes the centerStart matching the actual center', () => {
    expect(layout.centerStart).toEqual({ row: 7, col: 7 });
  });

  it('has no duplicate premium positions', () => {
    const seen = new Set<string>();
    for (const p of layout.premiums) {
      const key = `${p.row},${p.col}`;
      expect(seen.has(key), `duplicate premium at ${key}`).toBe(false);
      seen.add(key);
    }
  });

  it('keeps every premium inside the 15×15 grid', () => {
    for (const p of layout.premiums) {
      expect(p.row).toBeGreaterThanOrEqual(0);
      expect(p.row).toBeLessThan(15);
      expect(p.col).toBeGreaterThanOrEqual(0);
      expect(p.col).toBeLessThan(15);
    }
  });

  it('is symmetric across both diagonals (Scrabble spec)', () => {
    const map = new Map<string, PremiumKind>();
    for (const p of layout.premiums) map.set(`${p.row},${p.col}`, p.kind);
    for (const p of layout.premiums) {
      // Rotational symmetry: (r,c) and (size-1-r, size-1-c) must match.
      const mirrorKey = `${14 - p.row},${14 - p.col}`;
      expect(map.get(mirrorKey), `rotational mirror at ${mirrorKey}`).toBe(p.kind);
      // Diagonal symmetry: (r,c) and (c,r) must match.
      const diagKey = `${p.col},${p.row}`;
      expect(map.get(diagKey), `diagonal mirror at ${diagKey}`).toBe(p.kind);
    }
  });

  it('is frozen', () => {
    expect(Object.isFrozen(layout)).toBe(true);
    expect(Object.isFrozen(layout.premiums)).toBe(true);
    expect(Object.isFrozen(layout.centerStart)).toBe(true);
  });
});

describe('SIMPLE_LAYOUT_15X15', () => {
  it('has no premium squares', () => {
    expect(SIMPLE_LAYOUT_15X15.premiums.length).toBe(0);
  });
  it('still has a center', () => {
    expect(SIMPLE_LAYOUT_15X15.centerStart).toEqual({ row: 7, col: 7 });
  });
  it('matches board size 15', () => {
    expect(SIMPLE_LAYOUT_15X15.size).toBe(15);
  });
});
