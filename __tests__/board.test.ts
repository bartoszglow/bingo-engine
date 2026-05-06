import { describe, expect, it } from 'vitest';
import {
  POLISH_ALPHABET,
  SCRABBLE_LAYOUT_15X15,
  SIMPLE_LAYOUT_15X15,
  emptyBoard,
  getCell,
  hasNeighbour,
  inBounds,
  isEmpty,
  letterTile,
  perpendicular,
  placeTile,
  step,
  withCell,
  withCells,
} from '../src/index.js';

const k = letterTile(POLISH_ALPHABET, 'k')!;
const o = letterTile(POLISH_ALPHABET, 'o')!;
const t = letterTile(POLISH_ALPHABET, 't')!;

describe('coords', () => {
  it('inBounds', () => {
    expect(inBounds(0, 0, 15)).toBe(true);
    expect(inBounds(14, 14, 15)).toBe(true);
    expect(inBounds(15, 0, 15)).toBe(false);
    expect(inBounds(-1, 0, 15)).toBe(false);
  });

  it('step horizontal advances col', () => {
    expect(step(7, 7, 'horizontal')).toEqual({ row: 7, col: 8 });
  });

  it('step vertical advances row', () => {
    expect(step(7, 7, 'vertical')).toEqual({ row: 8, col: 7 });
  });

  it('perpendicular flips direction', () => {
    expect(perpendicular('horizontal')).toBe('vertical');
    expect(perpendicular('vertical')).toBe('horizontal');
  });
});

describe('emptyBoard / isEmpty', () => {
  it('produces a 15×15 board of nulls', () => {
    const b = emptyBoard(SCRABBLE_LAYOUT_15X15);
    expect(b.length).toBe(15);
    expect(b[0]!.length).toBe(15);
    expect(isEmpty(b)).toBe(true);
  });

  it('reports non-empty after placement', () => {
    const b = placeTile(emptyBoard(SCRABBLE_LAYOUT_15X15), 7, 7, k);
    expect(isEmpty(b)).toBe(false);
  });

  it('honours custom layout sizes', () => {
    const tiny = emptyBoard({ ...SIMPLE_LAYOUT_15X15, size: 7, premiums: [] });
    expect(tiny.length).toBe(7);
  });
});

describe('withCell / placeTile', () => {
  it('returns a NEW board (immutability)', () => {
    const b1 = emptyBoard(SCRABBLE_LAYOUT_15X15);
    const b2 = placeTile(b1, 7, 7, k);
    expect(b2).not.toBe(b1);
    expect(getCell(b1, 7, 7)).toBeNull();
    expect(getCell(b2, 7, 7)).toEqual(k);
  });

  it('shares unmodified rows with the original', () => {
    const b1 = emptyBoard(SCRABBLE_LAYOUT_15X15);
    const b2 = withCell(b1, 7, 7, k);
    // Row 7 changed (new array); row 0 should still be the same reference.
    expect(b2[0]).toBe(b1[0]);
    expect(b2[7]).not.toBe(b1[7]);
  });

  it('throws on out-of-bounds', () => {
    const b = emptyBoard(SCRABBLE_LAYOUT_15X15);
    expect(() => withCell(b, -1, 0, k)).toThrow(/out of bounds/);
    expect(() => withCell(b, 0, 15, k)).toThrow(/out of bounds/);
  });
});

describe('withCells', () => {
  it('applies multiple changes returning one new board', () => {
    const b = emptyBoard(SCRABBLE_LAYOUT_15X15);
    const next = withCells(b, [
      { row: 7, col: 7, cell: k },
      { row: 7, col: 8, cell: o },
      { row: 7, col: 9, cell: t },
    ]);
    expect(getCell(next, 7, 7)).toEqual(k);
    expect(getCell(next, 7, 8)).toEqual(o);
    expect(getCell(next, 7, 9)).toEqual(t);
    expect(isEmpty(b)).toBe(true); // original untouched
  });

  it('does not allocate when changes is empty', () => {
    const b = emptyBoard(SCRABBLE_LAYOUT_15X15);
    expect(withCells(b, [])).toBe(b);
  });

  it('throws on out-of-bounds', () => {
    const b = emptyBoard(SCRABBLE_LAYOUT_15X15);
    expect(() => withCells(b, [{ row: 100, col: 0, cell: k }])).toThrow(/out of bounds/);
  });
});

describe('hasNeighbour', () => {
  it('returns false on an empty board', () => {
    const b = emptyBoard(SCRABBLE_LAYOUT_15X15);
    expect(hasNeighbour(b, 7, 7)).toBe(false);
  });

  it('detects orthogonal neighbours', () => {
    const b = withCell(emptyBoard(SCRABBLE_LAYOUT_15X15), 7, 7, k);
    expect(hasNeighbour(b, 6, 7)).toBe(true);
    expect(hasNeighbour(b, 8, 7)).toBe(true);
    expect(hasNeighbour(b, 7, 6)).toBe(true);
    expect(hasNeighbour(b, 7, 8)).toBe(true);
  });

  it('does not count diagonal neighbours', () => {
    const b = withCell(emptyBoard(SCRABBLE_LAYOUT_15X15), 7, 7, k);
    expect(hasNeighbour(b, 6, 6)).toBe(false);
    expect(hasNeighbour(b, 8, 8)).toBe(false);
  });

  it('handles edges/corners (out-of-bounds = empty)', () => {
    const b = withCell(emptyBoard(SCRABBLE_LAYOUT_15X15), 0, 0, k);
    expect(hasNeighbour(b, 0, 1)).toBe(true);
    expect(hasNeighbour(b, 1, 0)).toBe(true);
    // Top-left corner with no tile next to it stays empty.
    const empty = emptyBoard(SCRABBLE_LAYOUT_15X15);
    expect(hasNeighbour(empty, 0, 0)).toBe(false);
  });
});
