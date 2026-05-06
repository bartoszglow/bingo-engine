# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-05-06

First public release. Complete Scrabble engine MVP — validator, scorer,
solver, generator, and a single-config engine factory. Polish and English
alphabets bundled. Zero runtime dependencies. ESM + CJS dual publish with
full TypeScript types.

### Added

- Initial repository bootstrap: package skeleton, TypeScript + tsup + vitest + ESLint toolchain, GitHub Actions CI/CD scaffolding, full design plan in `docs/PLAN.md`.
- Public type surface in `src/types.ts`, `defineAlphabet` factory, `POLISH_ALPHABET` (OSPS distribution) and `ENGLISH_ALPHABET` (TWL), `SCRABBLE_LAYOUT_15X15` + `SIMPLE_LAYOUT_15X15` board layouts, `SCRABBLE_CLASSIC_RULES` / `SCRABBLE_NO_BINGO_RULES` / `SCRABBLE_FREE_RULES` rule presets.
- Immutable board operations (`emptyBoard`, `withCell(s)`, `hasNeighbour`, `placeTile`), coordinate helpers (`step`, `perpendicular`, `inBounds`), tile builders (`letterTile`, `blankTile`, `blankAs`), rack/bag operations (`freshBag`, `drawTiles`, `removeFromRack`, `rackCanProvide`, `returnTiles`, `countTile`).
- Dictionary backends — `buildSetDictionary` (O(1) `has`, slow-path `hasPrefix`) and `buildTrieDictionary` (O(L) prefix lookups via shared trie). `seededRng(seed)` mulberry32 RNG.
- `validatePlacement` with nine stable reason codes (empty, OOB, overlap, gap, rack-mismatch, first-move-not-on-center, not-connected, word-not-in-dictionary, crossword-not-in-dictionary). `extractFormedWords` helper for main + crossword extraction.
- `scorePlacement` with full premium-square semantics (DLS/TLS/DWS/TWS, premiums apply only to new tiles, blanks contribute 0, multipliers compose, bingo bonus added once at end).
- Anchor-based DFS solver (`findAllPlacements`) with trie pruning via `Dictionary.hasPrefix`. `findAnchors` exposed for tooling.
- `generateBoard` greedy self-play generator with configurable top-percentile randomness, deterministic with seeded RNG.
- `applyPlacement` standalone helper, `serializeBoard` / `deserializeBoard` for state persistence (with input validation against malformed payloads), `createBingoEngine(config)` factory binding all operations to one config.
- Test suite: 156 tests across 12 files (alphabet, layout, rules, board, rack, dictionary, validator, scorer, solver, generator, serialize, e2e).
- Documentation: README quick-start, `docs/USAGE.md` with full examples, `docs/PLAN.md` design rationale + comparative analysis vs Quackle / Macondo / wolges / scrabble-solver.

[Unreleased]: https://github.com/bartoszglow/bingo-engine/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/bartoszglow/bingo-engine/releases/tag/v0.1.0
