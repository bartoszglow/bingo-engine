/**
 * Hand-picked Polish word list for validator/scorer/solver tests.
 * Includes:
 *   - common 2-3 letter cores so crosswords work
 *   - prefixes/suffixes/extensions to make solver scenarios non-trivial
 *   - polish-character words to verify locale-aware handling
 *
 * Keep it small (≤100 words). Property tests use `polish-mini.ts` instead.
 */
export const TINY_POLISH_WORDS: readonly string[] = [
  // 2 letters
  'ad', 'as', 'al', 'an', 'at', 'bo', 'co', 'do', 'go', 'ja', 'ku', 'mu', 'na', 'no', 'on', 'po', 'to', 'ty', 'tu', 'wy', 'za',
  // 3 letters (common stems)
  'kot', 'pies', 'dom', 'rok', 'ryk', 'tor', 'rak', 'ser', 'sok', 'tom', 'ten', 'jak',
  // 4 letters
  'koty', 'piec', 'pole', 'plan', 'most', 'nora', 'okno',
  // 5 letters
  'kotek', 'pieca', 'autor', 'praca',
  // polish-char specific
  'łódź', 'łódka', 'żaba', 'żabka', 'łąka', 'ćma', 'ćmy', 'śnieg', 'mały',
  // crossword-friendly extensions
  'or', 'ar', 'er',
];
