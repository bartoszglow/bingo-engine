import type { Alphabet, AlphabetSpec, TileId } from '../types.js';
import { BLANK, BLANK_FLAG } from '../types.js';

const DEFAULT_BLANK_SYMBOL = '?';
const POLISH_VOWELS = new Set(['a', 'ą', 'e', 'ę', 'i', 'o', 'ó', 'u', 'y']);
const ENGLISH_VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);

/**
 * Build an immutable `Alphabet` from a spec. Lowercases labels via the spec's
 * `locale` (default 'en'). Throws if any tile spec is malformed (duplicate
 * label, missing fields, negative count or score, etc).
 *
 * Every label except the blank symbol becomes a `TileId` `1..n`. The result
 * is `Object.freeze`d but typed-array buffers remain mutable per JS spec —
 * callers must treat them as read-only.
 */
export function defineAlphabet(spec: AlphabetSpec): Alphabet {
  if (!spec.id) throw new Error('Alphabet.id is required.');
  if (spec.tiles.length === 0) throw new Error('Alphabet must have at least one tile.');
  if (spec.blankCount < 0 || !Number.isInteger(spec.blankCount)) {
    throw new Error('Alphabet.blankCount must be a non-negative integer.');
  }

  const blankSymbol = spec.blankSymbol ?? DEFAULT_BLANK_SYMBOL;
  const blankScore = spec.blankScore ?? 0;
  const locale = spec.locale ?? 'en';
  const lower = (s: string) => s.toLocaleLowerCase(locale);

  if (lower(blankSymbol) !== blankSymbol) {
    throw new Error(`Alphabet.blankSymbol must already be lowercase for locale '${locale}'.`);
  }

  const size = spec.tiles.length + 1;
  const labels: string[] = new Array(size);
  const scores = new Int8Array(size);
  const counts = new Uint8Array(size);
  const labelToId: Record<string, TileId> = Object.create(null);

  // Slot 0: blank
  labels[0] = blankSymbol;
  scores[0] = blankScore;
  counts[0] = spec.blankCount;
  labelToId[blankSymbol] = BLANK;

  let vowelMask = 0n;
  const seen = new Set<string>();
  for (let i = 0; i < spec.tiles.length; i++) {
    const tile = spec.tiles[i]!;
    const id = i + 1;
    const label = lower(tile.label);

    if (!label) throw new Error(`Tile #${i} has empty label.`);
    if (seen.has(label)) throw new Error(`Duplicate tile label: '${label}'.`);
    if (label === blankSymbol) throw new Error(`Tile label '${label}' collides with blank symbol.`);
    if (tile.score < -128 || tile.score > 127 || !Number.isInteger(tile.score)) {
      throw new Error(`Tile '${label}' score must be an integer in [-128, 127].`);
    }
    if (tile.count < 0 || tile.count > 255 || !Number.isInteger(tile.count)) {
      throw new Error(`Tile '${label}' count must be an integer in [0, 255].`);
    }
    if (id >= BLANK_FLAG) {
      throw new Error(
        `Alphabet too large: TileId ${id} would collide with BLANK_FLAG (${BLANK_FLAG}). Reduce tile count below ${BLANK_FLAG}.`,
      );
    }
    seen.add(label);

    labels[id] = label;
    scores[id] = tile.score;
    counts[id] = tile.count;
    labelToId[label] = id;

    const isVowel = tile.isVowel ?? defaultIsVowel(locale, label);
    if (isVowel) vowelMask |= 1n << BigInt(id);
  }

  const alphabet: Alphabet = {
    id: spec.id,
    size,
    labels: Object.freeze(labels),
    scores,
    counts,
    vowelMask,
    labelToId: Object.freeze(labelToId),
    locale,
    blankSymbol,
  };
  return Object.freeze(alphabet);
}

function defaultIsVowel(locale: string, label: string): boolean {
  if (locale.startsWith('pl')) return POLISH_VOWELS.has(label);
  return ENGLISH_VOWELS.has(label);
}

// ----------------------------------------------------------------------------
// Solver hot-path inline helpers
// ----------------------------------------------------------------------------

/** Strip the `BLANK_FLAG` from a played-blank tile id. */
export function unblank(tileId: TileId): TileId {
  return tileId & ~BLANK_FLAG;
}

/** Whether this tile id represents a blank played as a letter. */
export function isBlanked(tileId: TileId): boolean {
  return (tileId & BLANK_FLAG) !== 0;
}

/**
 * Score for a (possibly blanked) tile: returns 0 for blank tiles, otherwise
 * looks up the alphabet's `scores` array. Branchless via a mask.
 */
export function tileScore(alphabet: Alphabet, tileId: TileId): number {
  if (tileId === BLANK || (tileId & BLANK_FLAG) !== 0) return 0;
  return alphabet.scores[tileId] ?? 0;
}

/** Convert a `TileId` to its display letter (no blank flag). */
export function tileIdToLetter(alphabet: Alphabet, tileId: TileId): string {
  const id = unblank(tileId);
  return alphabet.labels[id] ?? alphabet.blankSymbol;
}

/** Look up a label, returning `undefined` if not in the alphabet. */
export function letterToTileId(alphabet: Alphabet, letter: string): TileId | undefined {
  const lower = alphabet.locale ? letter.toLocaleLowerCase(alphabet.locale) : letter.toLowerCase();
  return alphabet.labelToId[lower];
}
