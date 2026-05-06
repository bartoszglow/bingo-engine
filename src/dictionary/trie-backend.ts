import type { Dictionary } from '../types.js';

interface BuildOptions {
  /** Override the default `Math.random` for `sample()`. */
  readonly random?: () => number;
}

/**
 * A single trie node. `children` is keyed by a single grapheme (we use
 * `for…of` to iterate, so multi-byte UTF-16 surrogate pairs would still
 * work, though our target alphabets are all BMP). `isEnd` marks a complete
 * word terminating at this node.
 */
interface TrieNode {
  children: Map<string, TrieNode>;
  isEnd: boolean;
}

function newNode(): TrieNode {
  return { children: new Map(), isEnd: false };
}

function insert(root: TrieNode, word: string): void {
  let node = root;
  for (const ch of word) {
    let child = node.children.get(ch);
    if (!child) {
      child = newNode();
      node.children.set(ch, child);
    }
    node = child;
  }
  node.isEnd = true;
}

function findNode(root: TrieNode, str: string): TrieNode | undefined {
  let node = root;
  for (const ch of str) {
    const next = node.children.get(ch);
    if (!next) return undefined;
    node = next;
  }
  return node;
}

/**
 * Build a trie-backed dictionary. `has` and `hasPrefix` are both O(L) where
 * L is the word length. This is the recommended backend for solver pruning —
 * the Appel-Jacobson algorithm leans heavily on `hasPrefix` to abandon dead
 * branches early.
 *
 * Words are stored verbatim; callers normalize case (per alphabet locale)
 * before construction and before every lookup.
 */
export function buildTrieDictionary(
  words: Iterable<string>,
  opts: BuildOptions = {},
): Dictionary {
  const root = newNode();
  // Track inserted words for `sample()`. We could reconstruct from the trie,
  // but storing the array is far cheaper at lookup time.
  const list: string[] = [];
  const seen = new Set<string>();
  for (const w of words) {
    if (seen.has(w)) continue;
    seen.add(w);
    list.push(w);
    insert(root, w);
  }

  const random = opts.random ?? Math.random;

  return {
    has(word) {
      if (word.length === 0) return false;
      const node = findNode(root, word);
      return node !== undefined && node.isEnd;
    },
    hasPrefix(prefix) {
      // The empty prefix is a degenerate case — every dictionary contains it.
      if (prefix.length === 0) return list.length > 0;
      return findNode(root, prefix) !== undefined;
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
