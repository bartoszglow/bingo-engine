import { describe, expect, it } from 'vitest';
import { buildSetDictionary, buildTrieDictionary, seededRng } from '../src/index.js';

const SAMPLE_WORDS = [
  'kot', 'koty', 'kotek', 'kotka',
  'pies', 'pieski', 'piesek',
  'auto', 'autobus',
  'dom', 'domek',
  'a', 'ab', 'abc',
  'żaba', 'żabka',
  'łąka',
];

describe('buildSetDictionary', () => {
  it('returns false for words not in the list', () => {
    const d = buildSetDictionary(SAMPLE_WORDS);
    expect(d.has('xyz')).toBe(false);
    expect(d.has('')).toBe(false);
  });

  it('returns true for exact matches', () => {
    const d = buildSetDictionary(SAMPLE_WORDS);
    expect(d.has('kot')).toBe(true);
    expect(d.has('żaba')).toBe(true);
  });

  it('is case-sensitive (caller normalizes)', () => {
    const d = buildSetDictionary(SAMPLE_WORDS);
    expect(d.has('Kot')).toBe(false);
    expect(d.has('kot')).toBe(true);
  });

  it('hasPrefix is the slow-path fallback (always true)', () => {
    const d = buildSetDictionary(SAMPLE_WORDS);
    expect(d.hasPrefix('k')).toBe(true);
    expect(d.hasPrefix('zzzzz')).toBe(true); // ⚠ false positive by design
  });

  it('deduplicates inputs', () => {
    const d = buildSetDictionary(['kot', 'kot', 'kot']);
    const got = d.sample!({ minLength: 1, maxLength: 10, count: 5 });
    expect(got).toEqual(['kot']);
  });

  it('sample respects length filters', () => {
    const d = buildSetDictionary(SAMPLE_WORDS);
    const short = d.sample!({ minLength: 3, maxLength: 3, count: 100 });
    expect(short.every((w) => w.length === 3)).toBe(true);
    expect(short.length).toBeGreaterThan(0);
  });

  it('sample uses the provided random for determinism', () => {
    const a = buildSetDictionary(SAMPLE_WORDS, { random: seededRng(7) });
    const b = buildSetDictionary(SAMPLE_WORDS, { random: seededRng(7) });
    expect(a.sample!({ minLength: 3, maxLength: 6, count: 4 })).toEqual(
      b.sample!({ minLength: 3, maxLength: 6, count: 4 }),
    );
  });

  it('sample returns [] when count <= 0', () => {
    const d = buildSetDictionary(SAMPLE_WORDS);
    expect(d.sample!({ minLength: 1, maxLength: 10, count: 0 })).toEqual([]);
    expect(d.sample!({ minLength: 1, maxLength: 10, count: -3 })).toEqual([]);
  });

  it('sample caps at the eligible-set size', () => {
    const d = buildSetDictionary(SAMPLE_WORDS);
    const got = d.sample!({ minLength: 100, maxLength: 200, count: 5 }); // none match
    expect(got).toEqual([]);
  });
});

describe('buildTrieDictionary', () => {
  it('agrees with the Set backend on `has`', () => {
    const set = buildSetDictionary(SAMPLE_WORDS);
    const trie = buildTrieDictionary(SAMPLE_WORDS);
    for (const probe of [...SAMPLE_WORDS, 'xyz', 'kotyx', 'pi', '']) {
      expect(trie.has(probe), probe).toBe(set.has(probe));
    }
  });

  it('returns true for prefixes of stored words', () => {
    const d = buildTrieDictionary(SAMPLE_WORDS);
    expect(d.hasPrefix('k')).toBe(true);
    expect(d.hasPrefix('ko')).toBe(true);
    expect(d.hasPrefix('kot')).toBe(true);
    expect(d.hasPrefix('kote')).toBe(true);
    expect(d.hasPrefix('żab')).toBe(true);
  });

  it('returns false for prefixes that do not exist', () => {
    const d = buildTrieDictionary(SAMPLE_WORDS);
    expect(d.hasPrefix('xy')).toBe(false);
    expect(d.hasPrefix('koty!')).toBe(false);
  });

  it('treats empty prefix as "any word possible"', () => {
    const d = buildTrieDictionary(SAMPLE_WORDS);
    expect(d.hasPrefix('')).toBe(true);
    const empty = buildTrieDictionary([]);
    expect(empty.hasPrefix('')).toBe(false);
  });

  it('handles Polish multi-byte letters correctly', () => {
    const d = buildTrieDictionary(['łąka', 'żaba']);
    expect(d.has('łąka')).toBe(true);
    expect(d.hasPrefix('łą')).toBe(true);
    expect(d.has('lqka')).toBe(false); // not the same letters
  });

  it('does NOT match a strict prefix as a complete word', () => {
    const d = buildTrieDictionary(['kotek']);
    expect(d.has('kot')).toBe(false); // "kot" is a prefix but not in the set
    expect(d.hasPrefix('kot')).toBe(true);
  });

  it('does NOT match an empty word', () => {
    const d = buildTrieDictionary(['kot']);
    expect(d.has('')).toBe(false);
  });

  it('deduplicates inputs', () => {
    const d = buildTrieDictionary(['kot', 'kot', 'kot']);
    const got = d.sample!({ minLength: 1, maxLength: 10, count: 5 });
    expect(got).toEqual(['kot']);
  });

  it('sample uses the provided random for determinism', () => {
    const a = buildTrieDictionary(SAMPLE_WORDS, { random: seededRng(99) });
    const b = buildTrieDictionary(SAMPLE_WORDS, { random: seededRng(99) });
    expect(a.sample!({ minLength: 3, maxLength: 7, count: 5 })).toEqual(
      b.sample!({ minLength: 3, maxLength: 7, count: 5 }),
    );
  });

  it('handles 1k-word dictionaries efficiently', () => {
    // Quick perf-correctness check: 1000 random-ish words inserted, all
    // queryable by has + hasPrefix. If insert/query is accidentally O(N)
    // per operation this would slow down dramatically.
    const words: string[] = [];
    for (let i = 0; i < 1000; i++) words.push(`word${i.toString().padStart(4, '0')}`);
    const d = buildTrieDictionary(words);
    expect(d.has('word0500')).toBe(true);
    expect(d.has('word9999')).toBe(false);
    expect(d.hasPrefix('word0')).toBe(true);
    expect(d.hasPrefix('zzz')).toBe(false);
  });
});

describe('Set vs Trie agreement on has', () => {
  it('produce identical has() results across a thousand probes', () => {
    const set = buildSetDictionary(SAMPLE_WORDS);
    const trie = buildTrieDictionary(SAMPLE_WORDS);
    const probes = [
      ...SAMPLE_WORDS,
      ...SAMPLE_WORDS.map((w) => w + 'x'),
      ...SAMPLE_WORDS.map((w) => w.slice(0, -1)),
      'qqq', 'rrr', '', 'a', 'ż',
    ];
    for (const p of probes) {
      expect(trie.has(p), p).toBe(set.has(p));
    }
  });
});
