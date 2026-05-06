# @bglowacki/bingo-engine

> Isomorphic, dictionary-injected Scrabble engine for TypeScript.
> Validator, scorer, solver, and board generator — multi-language, zero runtime dependencies.

[![npm](https://img.shields.io/npm/v/@bglowacki/bingo-engine.svg)](https://www.npmjs.com/package/@bglowacki/bingo-engine)
[![CI](https://github.com/bartoszglow/bingo-engine/actions/workflows/ci.yml/badge.svg)](https://github.com/bartoszglow/bingo-engine/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A complete, framework-agnostic logic layer for Scrabble-like word games. Designed to power tournament apps, AI tools, mobile games, and educational platforms. Runs anywhere modern JavaScript runs — Node.js, browsers, Web Workers, edge runtimes.

## What it does

- **Validate** a tile placement on a board — connectivity, dictionary lookup, gaps, multi-word formation, blanks, premium-square interactions.
- **Score** placements with full premium-square (DLS / TLS / DWS / TWS) and bingo-bonus support, exposing a per-word breakdown.
- **Solve** — enumerate every legal move from a given rack on a given board, using the classical Appel-Jacobson anchor algorithm with cross-checks and dictionary trie pruning.
- **Generate** plausible mid-game board positions via greedy self-play (configurable randomness, reproducible with seeded RNG).
- **Pluggable alphabets** — Polish (OSPS) and English (TWL) bundled out of the box. Define custom alphabets (Italian, Spanish, German, …) with a single literal via `defineAlphabet`.
- **Pluggable dictionaries** — bring your own data source. Set-based, trie-based, or any custom backend implementing the `Dictionary` interface.
- **Pluggable rules** — premium squares on/off, bingo bonus value, rack size, center-start requirement, must-connect requirement — all configurable per game variant (Scrabble / Literaki / custom).

## Why it exists

There is currently no MIT-licensed, isomorphic, multi-language Scrabble engine on npm.

| Project | Issue |
|---|---|
| Quackle / Macondo | GPLv3 — incompatible with closed-source / SaaS use |
| wolges-wasm | MIT but no Polish out of the box, undocumented WASM API |
| kamilmielnik/scrabble-solver | CC BY-NC-ND — non-commercial use only |

This library fills that gap with a TypeScript-first, zero-dependency, framework-agnostic API. Born out of a Polish Scrabble tournament app's need for a portable, reusable engine.

## Install

```bash
npm i @bglowacki/bingo-engine
```

Requires Node.js ≥ 20 or any modern browser supporting ES2022.

## Quick start

```ts
import {
  createBingoEngine,
  POLISH_ALPHABET,
  SCRABBLE_LAYOUT_15X15,
  SCRABBLE_CLASSIC_RULES,
  buildTrieDictionary,
  seededRng,
} from '@bglowacki/bingo-engine';

// 1) Build a dictionary from your word source
const dictionary = buildTrieDictionary(['kot', 'kotek', 'pies', 'auto' /* … */]);

// 2) Create an engine instance
const engine = createBingoEngine({
  alphabet: POLISH_ALPHABET,
  layout: SCRABBLE_LAYOUT_15X15,
  rules: SCRABBLE_CLASSIC_RULES,
  dictionary,
  random: seededRng(42), // optional, for reproducibility
});

// 3) Generate a believable mid-game position
const { board, rack } = engine.generateBoard({ moves: 10 });

// 4) Validate a player's move
const placement = {
  startRow: 7,
  startCol: 5,
  direction: 'horizontal' as const,
  tiles: [
    { letter: 'k', isBlank: false },
    { letter: 'o', isBlank: false },
    { letter: 't', isBlank: false },
  ],
};
const result = engine.validatePlacement(board, placement, rack);

if (result.valid) {
  const score = engine.scorePlacement(board, placement);
  console.log(`Scored ${score.total} points`);
}
```

## Custom alphabet

```ts
import { defineAlphabet } from '@bglowacki/bingo-engine';

const ITALIAN = defineAlphabet({
  id: 'it-IT',
  blankCount: 2,
  locale: 'it-IT',
  tiles: [
    { label: 'a', score: 1, count: 14, isVowel: true },
    { label: 'b', score: 5, count: 3 },
    // …
  ],
});
```

## Architecture

- **Zero runtime dependencies.** Everything is `devDependencies` only.
- **Isomorphic by construction.** Built with `platform: 'neutral'`, no Node-only or browser-only globals.
- **Dual ESM + CJS** with full TypeScript types. Subpath exports for `./alphabet`, `./solver`, `./generator`.
- **Stateless engine instances.** All operations take the current state and return new state — easy to use in Web Workers, Redux reducers, or server-side actor systems.

## Documentation

- **[docs/API.md](./docs/API.md)** — complete API reference: every exported function, type, constant, and pre-built config with signatures, parameter tables, return types, and per-method examples.
- **[docs/USAGE.md](./docs/USAGE.md)** — tutorial-style usage guide: getting started, custom alphabets, custom dictionaries, custom rules, Web Worker integration, serialization, common patterns.
- **[docs/PLAN.md](./docs/PLAN.md)** — design plan: comparative analysis vs. Quackle / Macondo / wolges / scrabble-solver, algorithms (Appel-Jacobson with cross-checks), TDD strategy, project roadmap.
- **[CHANGELOG.md](./CHANGELOG.md)** — release history.
- **[CONTRIBUTING.md](./CONTRIBUTING.md)** — development setup and conventions.

## Status

**Pre-1.0.** The API may change before `1.0.0` is tagged. Track [CHANGELOG.md](./CHANGELOG.md) for breaking changes.

## License

MIT © Bartosz Głowacki
