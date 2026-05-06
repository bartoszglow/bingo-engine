import type { Alphabet, TileSpec } from '../types.js';
import { defineAlphabet } from './alphabet.js';

/**
 * Standard Polish Scrabble distribution (PFS / OSPS).
 * 100 tiles total: 98 letters + 2 blanks.
 *
 * Source: https://pl.wikipedia.org/wiki/Rozk%C5%82ady_liter_w_Scrabble
 */
const POLISH_TILES: readonly TileSpec[] = [
  { label: 'a', score: 1, count: 9, isVowel: true },
  { label: 'ą', score: 5, count: 1, isVowel: true },
  { label: 'b', score: 3, count: 2 },
  { label: 'c', score: 2, count: 3 },
  { label: 'ć', score: 6, count: 1 },
  { label: 'd', score: 2, count: 3 },
  { label: 'e', score: 1, count: 7, isVowel: true },
  { label: 'ę', score: 5, count: 1, isVowel: true },
  { label: 'f', score: 5, count: 1 },
  { label: 'g', score: 3, count: 2 },
  { label: 'h', score: 3, count: 2 },
  { label: 'i', score: 1, count: 8, isVowel: true },
  { label: 'j', score: 3, count: 2 },
  { label: 'k', score: 2, count: 3 },
  { label: 'l', score: 2, count: 3 },
  { label: 'ł', score: 3, count: 2 },
  { label: 'm', score: 2, count: 3 },
  { label: 'n', score: 1, count: 5 },
  { label: 'ń', score: 7, count: 1 },
  { label: 'o', score: 1, count: 6, isVowel: true },
  { label: 'ó', score: 5, count: 1, isVowel: true },
  { label: 'p', score: 2, count: 3 },
  { label: 'r', score: 1, count: 4 },
  { label: 's', score: 1, count: 4 },
  { label: 'ś', score: 5, count: 1 },
  { label: 't', score: 2, count: 3 },
  { label: 'u', score: 3, count: 2, isVowel: true },
  { label: 'w', score: 1, count: 4 },
  { label: 'y', score: 2, count: 4, isVowel: true },
  { label: 'z', score: 1, count: 5 },
  { label: 'ź', score: 9, count: 1 },
  { label: 'ż', score: 5, count: 1 },
];

export const POLISH_ALPHABET: Alphabet = defineAlphabet({
  id: 'pl-PL',
  locale: 'pl-PL',
  tiles: POLISH_TILES,
  blankCount: 2,
  blankScore: 0,
});
