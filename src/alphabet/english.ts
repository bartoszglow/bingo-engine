import type { Alphabet, TileSpec } from '../types.js';
import { defineAlphabet } from './alphabet.js';

/**
 * Standard English Scrabble distribution (TWL / SOWPODS — same letter set).
 * 100 tiles total: 98 letters + 2 blanks.
 *
 * Source: https://en.wikipedia.org/wiki/Scrabble_letter_distributions#English
 */
const ENGLISH_TILES: readonly TileSpec[] = [
  { label: 'a', score: 1, count: 9, isVowel: true },
  { label: 'b', score: 3, count: 2 },
  { label: 'c', score: 3, count: 2 },
  { label: 'd', score: 2, count: 4 },
  { label: 'e', score: 1, count: 12, isVowel: true },
  { label: 'f', score: 4, count: 2 },
  { label: 'g', score: 2, count: 3 },
  { label: 'h', score: 4, count: 2 },
  { label: 'i', score: 1, count: 9, isVowel: true },
  { label: 'j', score: 8, count: 1 },
  { label: 'k', score: 5, count: 1 },
  { label: 'l', score: 1, count: 4 },
  { label: 'm', score: 3, count: 2 },
  { label: 'n', score: 1, count: 6 },
  { label: 'o', score: 1, count: 8, isVowel: true },
  { label: 'p', score: 3, count: 2 },
  { label: 'q', score: 10, count: 1 },
  { label: 'r', score: 1, count: 6 },
  { label: 's', score: 1, count: 4 },
  { label: 't', score: 1, count: 6 },
  { label: 'u', score: 1, count: 4, isVowel: true },
  { label: 'v', score: 4, count: 2 },
  { label: 'w', score: 4, count: 2 },
  { label: 'x', score: 8, count: 1 },
  { label: 'y', score: 4, count: 2 },
  { label: 'z', score: 10, count: 1 },
];

export const ENGLISH_ALPHABET: Alphabet = defineAlphabet({
  id: 'en-US',
  locale: 'en-US',
  tiles: ENGLISH_TILES,
  blankCount: 2,
  blankScore: 0,
});
