import type { Dictionary } from '../types.js';

interface BuildOptions {
  /** Override the default `Math.random` for `sample()`. */
  readonly random?: () => number;
}

/**
 * Build a Set-backed dictionary. Word lookups are O(1); prefix lookups are
 * NOT supported and always return `true`. Use this only for small dictionaries
 * (≤10k words) where the solver's pruning is not on the critical path.
 *
 * Words are stored verbatim. Callers are expected to normalize case (matching
 * their alphabet's `locale`) before constructing the dictionary AND before
 * every `has()` call. The engine itself follows that contract — see
 * `validatePlacement`.
 */
export function buildSetDictionary(
  words: Iterable<string>,
  opts: BuildOptions = {},
): Dictionary {
  const set = new Set<string>();
  const list: string[] = [];
  for (const w of words) {
    if (set.has(w)) continue;
    set.add(w);
    list.push(w);
  }

  const random = opts.random ?? Math.random;

  return {
    has(word) {
      return set.has(word);
    },
    hasPrefix() {
      // Slow-path fallback: any prefix is "possible" since we have no index.
      // Solver users should prefer `buildTrieDictionary` for real pruning.
      return true;
    },
    sample({ minLength, maxLength, count }) {
      if (count <= 0) return [];
      const eligible: string[] = [];
      for (const w of list) {
        if (w.length >= minLength && w.length <= maxLength) eligible.push(w);
      }
      const take = Math.min(count, eligible.length);
      const out: string[] = [];
      const used = new Set<number>();
      while (out.length < take) {
        const idx = Math.floor(random() * eligible.length);
        if (used.has(idx)) continue;
        used.add(idx);
        out.push(eligible[idx]!);
      }
      return out;
    },
  };
}
