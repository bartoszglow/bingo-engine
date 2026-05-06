import type { Alphabet, PlacedTile, TileId } from '../types.js';
import { BLANK, BLANK_FLAG } from '../types.js';
import { isBlanked, letterToTileId, tileIdToLetter, unblank } from '../alphabet/alphabet.js';

/** Build a `PlacedTile` carrying the given `TileId` (with optional blank flag). */
export function tile(tileId: TileId): PlacedTile {
  return { tileId };
}

/** Build a blank rack-tile (id 0, no flag). */
export function blankTile(): PlacedTile {
  return { tileId: BLANK };
}

/** True iff the tile is a rack blank (id exactly 0). */
export function isRackBlank(t: PlacedTile): boolean {
  return t.tileId === BLANK;
}

/**
 * Build a `PlacedTile` representing a blank played as `letter`.
 * Returns `undefined` if the letter is not in the alphabet.
 */
export function blankAs(alphabet: Alphabet, letter: string): PlacedTile | undefined {
  const id = letterToTileId(alphabet, letter);
  if (id === undefined || id === BLANK) return undefined;
  return { tileId: id | BLANK_FLAG };
}

/** Build a `PlacedTile` representing a regular letter played from rack. */
export function letterTile(alphabet: Alphabet, letter: string): PlacedTile | undefined {
  const id = letterToTileId(alphabet, letter);
  if (id === undefined || id === BLANK) return undefined;
  return { tileId: id };
}

/** Returns the displayed letter of a tile (no blank flag). */
export function tileLetter(alphabet: Alphabet, t: PlacedTile): string {
  return tileIdToLetter(alphabet, t.tileId);
}

/** True iff this `PlacedTile` is a blank-as-letter on the board. */
export function isPlacedBlank(t: PlacedTile): boolean {
  return isBlanked(t.tileId);
}

/** Strip the blank flag from a `PlacedTile`'s id. */
export function bareTileId(t: PlacedTile): TileId {
  return unblank(t.tileId);
}
