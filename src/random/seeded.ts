/**
 * `mulberry32` — small, fast, deterministic pseudo-random number generator.
 *
 * Returns a function with the same signature as `Math.random`: each call
 * yields a float in `[0, 1)`. The same `seed` always produces the same
 * sequence — useful for reproducible board generation, deterministic tests,
 * and replaying user-reported bugs.
 *
 * Adapted from a public-domain reference by Tommy Ettinger.
 */
export function seededRng(seed: number): () => number {
  let state = (seed | 0) >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
