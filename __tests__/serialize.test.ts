import { describe, expect, it } from 'vitest';
import {
  POLISH_ALPHABET,
  SCRABBLE_LAYOUT_15X15,
  emptyBoard,
  letterTile,
  blankAs,
  placeTile,
  serializeBoard,
  deserializeBoard,
} from '../src/index.js';

const a = POLISH_ALPHABET;
const layout = SCRABBLE_LAYOUT_15X15;

describe('serialize/deserialize board', () => {
  it('round-trips an empty board', () => {
    const board = emptyBoard(layout);
    const serialized = serializeBoard(board);
    const restored = deserializeBoard(serialized, layout);
    expect(restored.length).toBe(15);
    for (const row of restored) for (const cell of row) expect(cell).toBeNull();
  });

  it('round-trips a board with placed tiles', () => {
    const k = letterTile(a, 'k')!;
    const o = letterTile(a, 'o')!;
    const t = letterTile(a, 't')!;
    let b = emptyBoard(layout);
    b = placeTile(b, 7, 7, k);
    b = placeTile(b, 7, 8, o);
    b = placeTile(b, 7, 9, t);
    const restored = deserializeBoard(serializeBoard(b), layout);
    expect(restored[7]![7]).toEqual(k);
    expect(restored[7]![8]).toEqual(o);
    expect(restored[7]![9]).toEqual(t);
    expect(restored[7]![6]).toBeNull();
  });

  it('preserves the BLANK_FLAG on blank-as-letter tiles', () => {
    const blankZ = blankAs(a, 'ż')!;
    let b = emptyBoard(layout);
    b = placeTile(b, 0, 0, blankZ);
    const restored = deserializeBoard(serializeBoard(b), layout);
    expect(restored[0]![0]!.tileId).toBe(blankZ.tileId);
    expect((restored[0]![0]!.tileId & 0x80) !== 0).toBe(true);
  });

  it('throws on size mismatch when a layout is provided', () => {
    const b = emptyBoard({ size: 5, premiums: [] });
    const ser = serializeBoard(b);
    expect(() => deserializeBoard(ser, layout)).toThrow(/does not match layout/);
  });

  it('serialized payload is JSON-friendly (round-trips through JSON)', () => {
    const k = letterTile(a, 'k')!;
    const b = placeTile(emptyBoard(layout), 7, 7, k);
    const json = JSON.stringify(serializeBoard(b));
    const parsed = JSON.parse(json);
    const restored = deserializeBoard(parsed, layout);
    expect(restored[7]![7]).toEqual(k);
  });

  it('rejects malicious or malformed payloads', () => {
    // Negative size
    expect(() => deserializeBoard({ size: -1, cells: [] })).toThrow(/Invalid serialized board size/);
    // Non-integer size
    expect(() => deserializeBoard({ size: 1.5, cells: [] })).toThrow(/Invalid serialized board size/);
    // Absurdly large size (DoS guard)
    expect(() => deserializeBoard({ size: 10_000, cells: [] })).toThrow(/Invalid serialized board size/);
    // cells array length mismatch
    expect(() => deserializeBoard({ size: 3, cells: [null, null] })).toThrow(/Invalid serialized cells/);
    // Negative tileId
    expect(() =>
      deserializeBoard({ size: 1, cells: [{ tileId: -5 }] }),
    ).toThrow(/Invalid tileId/);
    // Non-integer tileId
    expect(() =>
      deserializeBoard({ size: 1, cells: [{ tileId: 1.5 }] }),
    ).toThrow(/Invalid tileId/);
  });
});
