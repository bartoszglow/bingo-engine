import type { Alphabet, Bag, PlacedTile, Rack, TileId } from '../types.js';
import { BLANK } from '../types.js';

/**
 * Build a fresh bag containing every tile in the alphabet's distribution.
 * Order is alphabet-order (deterministic). Use `shuffle` + `drawTiles` to
 * get a random sample.
 */
export function freshBag(alphabet: Alphabet): Bag {
  const out: PlacedTile[] = [];
  for (let id = 0; id < alphabet.size; id++) {
    const count = alphabet.counts[id] ?? 0;
    for (let i = 0; i < count; i++) out.push({ tileId: id });
  }
  return out;
}

/**
 * Draw `count` random tiles from the bag without replacement. Returns the
 * drawn tiles plus the new bag (original bag is untouched).
 *
 * If `count` exceeds bag size, returns whatever is available (does not throw).
 */
export function drawTiles(
  bag: Bag,
  count: number,
  random: () => number = Math.random,
): { drawn: PlacedTile[]; bag: Bag } {
  if (count <= 0) return { drawn: [], bag };
  const remaining: PlacedTile[] = bag.slice();
  const drawn: PlacedTile[] = [];
  const take = Math.min(count, remaining.length);
  for (let i = 0; i < take; i++) {
    const idx = Math.floor(random() * remaining.length);
    const safeIdx = Math.min(idx, remaining.length - 1);
    drawn.push(remaining[safeIdx]!);
    remaining.splice(safeIdx, 1);
  }
  return { drawn, bag: remaining };
}

/** Append tiles to a bag, returning a new bag. */
export function returnTiles(bag: Bag, tiles: readonly PlacedTile[]): Bag {
  if (tiles.length === 0) return bag;
  return bag.concat(tiles);
}

/**
 * Try to remove `wanted` tiles from `rack`, treating blanks as wildcards.
 * Returns the new rack on success, or `undefined` if the rack does not
 * cover the request.
 *
 * Matching strategy: prefer exact `tileId` matches first (consume real
 * letters before blanks); fall back to a rack blank for any remaining
 * wanted tile that exists in the alphabet.
 */
export function removeFromRack(
  rack: Rack,
  wanted: readonly PlacedTile[],
): Rack | undefined {
  if (wanted.length === 0) return rack;
  const remaining: (PlacedTile | null)[] = rack.slice();

  for (const w of wanted) {
    // A played-blank-as-letter (high bit set) consumes a rack blank (id 0).
    // A plain letter consumes either an exact id match or a rack blank.
    const wantedBare = w.tileId & 0x7f;
    const isPlayedBlank = (w.tileId & 0x80) !== 0;

    let foundIdx = -1;
    if (!isPlayedBlank) {
      for (let i = 0; i < remaining.length; i++) {
        if (remaining[i] && remaining[i]!.tileId === wantedBare) {
          foundIdx = i;
          break;
        }
      }
    }
    if (foundIdx === -1) {
      for (let i = 0; i < remaining.length; i++) {
        if (remaining[i] && remaining[i]!.tileId === BLANK) {
          foundIdx = i;
          break;
        }
      }
    }
    if (foundIdx === -1) return undefined;
    remaining[foundIdx] = null;
  }

  return remaining.filter((t): t is PlacedTile => t !== null);
}

/**
 * True iff `rack` can produce all `wanted` tiles, treating blanks as wildcards.
 * Equivalent to `removeFromRack(rack, wanted) !== undefined` but cheaper —
 * we don't allocate the new rack.
 */
export function rackCanProvide(rack: Rack, wanted: readonly PlacedTile[]): boolean {
  return removeFromRack(rack, wanted) !== undefined;
}

/** Count tiles of a given id in the rack (ignoring the blank flag). */
export function countTile(rack: Rack, tileId: TileId): number {
  const bare = tileId & 0x7f;
  let n = 0;
  for (const t of rack) if ((t.tileId & 0x7f) === bare) n++;
  return n;
}
