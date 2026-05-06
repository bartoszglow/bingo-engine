/**
 * Dictionary backends for the Scrabble engine.
 *
 * Two ready-made implementations are exported:
 *
 * - {@link buildSetDictionary} — `O(1)` `has`, NO prefix support (all prefixes
 *   match), suitable for tiny dictionaries or test fixtures.
 * - {@link buildTrieDictionary} — `O(L)` `has` and `hasPrefix`, the recommended
 *   backend for solver pruning.
 *
 * Both backends accept any `Iterable<string>`, deduplicate input, and store
 * words verbatim. Callers normalize case (per their alphabet's `locale`)
 * before constructing the dictionary AND before each lookup. The engine
 * follows that contract internally.
 *
 * Bring your own backend by implementing the {@link Dictionary} interface
 * — useful for Mongo-backed caches, lazy-loading lexicons, or content-
 * addressable stores.
 */
export { buildSetDictionary } from './set-backend.js';
export { buildTrieDictionary } from './trie-backend.js';
