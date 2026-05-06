import { describe, expect, it } from 'vitest';
import {
  BLANK,
  BLANK_FLAG,
  POLISH_ALPHABET,
  bareTileId,
  blankAs,
  blankTile,
  countTile,
  drawTiles,
  freshBag,
  isPlacedBlank,
  isRackBlank,
  letterToTileId,
  letterTile,
  rackCanProvide,
  removeFromRack,
  returnTiles,
  tile,
} from '../src/index.js';

describe('tile builders', () => {
  it('blankTile carries id 0', () => {
    expect(blankTile().tileId).toBe(BLANK);
    expect(isRackBlank(blankTile())).toBe(true);
  });

  it('letterTile produces a tile carrying the alphabet id', () => {
    const a = letterTile(POLISH_ALPHABET, 'a')!;
    expect(a.tileId).toBe(letterToTileId(POLISH_ALPHABET, 'a'));
    expect(isPlacedBlank(a)).toBe(false);
  });

  it('letterTile returns undefined for unknown letters', () => {
    expect(letterTile(POLISH_ALPHABET, 'q')).toBeUndefined();
  });

  it('blankAs sets the BLANK_FLAG on top of the letter id', () => {
    const z = blankAs(POLISH_ALPHABET, 'ż')!;
    expect(isPlacedBlank(z)).toBe(true);
    const bare = bareTileId(z);
    expect(bare).toBe(letterToTileId(POLISH_ALPHABET, 'ż'));
    expect(z.tileId & BLANK_FLAG).toBe(BLANK_FLAG);
  });
});

describe('freshBag', () => {
  it('contains every tile of the alphabet', () => {
    const bag = freshBag(POLISH_ALPHABET);
    expect(bag.length).toBe(100);
    expect(countTile(bag, BLANK)).toBe(2);
    const a = letterToTileId(POLISH_ALPHABET, 'a')!;
    expect(countTile(bag, a)).toBe(9);
  });
});

describe('drawTiles', () => {
  it('draws the requested count without replacement', () => {
    const bag = freshBag(POLISH_ALPHABET);
    const seq = [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6];
    let i = 0;
    const rng = () => seq[i++ % seq.length] ?? 0;
    const { drawn, bag: rest } = drawTiles(bag, 7, rng);
    expect(drawn.length).toBe(7);
    expect(rest.length).toBe(93);
  });

  it('caps the draw at bag size', () => {
    const bag = freshBag(POLISH_ALPHABET);
    const { drawn, bag: rest } = drawTiles(bag, 1000);
    expect(drawn.length).toBe(100);
    expect(rest.length).toBe(0);
  });

  it('returns empty when count <= 0', () => {
    const bag = freshBag(POLISH_ALPHABET);
    expect(drawTiles(bag, 0).drawn).toEqual([]);
    expect(drawTiles(bag, -3).drawn).toEqual([]);
  });

  it('does not mutate the input bag', () => {
    const bag = freshBag(POLISH_ALPHABET);
    const before = bag.length;
    drawTiles(bag, 7);
    expect(bag.length).toBe(before);
  });
});

describe('returnTiles', () => {
  it('appends tiles to the bag', () => {
    const bag = freshBag(POLISH_ALPHABET);
    const k = letterTile(POLISH_ALPHABET, 'k')!;
    const expanded = returnTiles(bag, [k, k]);
    expect(expanded.length).toBe(102);
  });

  it('returns the same reference when adding nothing', () => {
    const bag = freshBag(POLISH_ALPHABET);
    expect(returnTiles(bag, [])).toBe(bag);
  });
});

describe('removeFromRack / rackCanProvide', () => {
  const k = letterTile(POLISH_ALPHABET, 'k')!;
  const o = letterTile(POLISH_ALPHABET, 'o')!;
  const t = letterTile(POLISH_ALPHABET, 't')!;

  it('returns rack unchanged when nothing is wanted', () => {
    const rack = [k, o, t];
    expect(removeFromRack(rack, [])).toBe(rack);
  });

  it('removes exact matches', () => {
    const rack = [k, o, t];
    const next = removeFromRack(rack, [k, o]);
    expect(next).toBeDefined();
    expect(next!.length).toBe(1);
    expect(next![0]).toEqual(t);
  });

  it('falls back to a blank when an exact letter is missing', () => {
    const rack = [k, blankTile(), t]; // no 'o' but a blank
    const next = removeFromRack(rack, [k, o, t]);
    expect(next).toBeDefined();
    expect(next!.length).toBe(0);
  });

  it('returns undefined when neither letter nor blank suffices', () => {
    const rack = [k, t];
    expect(removeFromRack(rack, [k, o, t])).toBeUndefined();
    expect(rackCanProvide(rack, [k, o, t])).toBe(false);
  });

  it('does not consume two rack tiles for one wanted', () => {
    const rack = [k, o, t];
    const next = removeFromRack(rack, [o]);
    expect(next!.length).toBe(2);
  });

  it('a played-blank-as-letter consumes a rack blank, not a real letter', () => {
    const rack = [letterTile(POLISH_ALPHABET, 'ż')!, blankTile()];
    const playedBlankZ = blankAs(POLISH_ALPHABET, 'ż')!;
    const next = removeFromRack(rack, [playedBlankZ]);
    expect(next).toBeDefined();
    // The real ż must remain; the blank was used.
    expect(next!.length).toBe(1);
    expect(isRackBlank(next![0]!)).toBe(false);
  });

  it('does not mutate the rack', () => {
    const rack = [k, o, t];
    const before = rack.slice();
    removeFromRack(rack, [k]);
    expect(rack).toEqual(before);
  });
});

describe('countTile', () => {
  it('ignores the BLANK_FLAG when counting', () => {
    const z = letterTile(POLISH_ALPHABET, 'ż')!;
    const blanked = blankAs(POLISH_ALPHABET, 'ż')!;
    const rack = [z, blanked, z];
    const id = letterToTileId(POLISH_ALPHABET, 'ż')!;
    expect(countTile(rack, id)).toBe(3);
  });
});

describe('tile()', () => {
  it('builds a PlacedTile from a raw id', () => {
    expect(tile(5)).toEqual({ tileId: 5 });
  });
});
