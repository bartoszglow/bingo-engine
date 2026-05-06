# Usage guide

> Tutorial-style guide. For an exhaustive function-by-function reference,
> see [API.md](./API.md). For project background and design rationale, see
> [PLAN.md](./PLAN.md).

## Table of contents

1. [Installation](#installation)
2. [Concepts at a glance](#concepts-at-a-glance)
3. [Quick start](#quick-start)
4. [Working with alphabets](#working-with-alphabets)
5. [Tiles, racks, and the bag](#tiles-racks-and-the-bag)
6. [Building boards and placements](#building-boards-and-placements)
7. [Validating a placement](#validating-a-placement)
8. [Scoring a placement](#scoring-a-placement)
9. [Generating a mid-game board](#generating-a-mid-game-board)
10. [Finding all legal placements](#finding-all-legal-placements)
11. [Custom alphabets](#custom-alphabets)
12. [Custom dictionaries](#custom-dictionaries)
13. [Custom rules](#custom-rules)
14. [Using the engine in a Web Worker](#using-the-engine-in-a-web-worker)
15. [Saving and loading state](#saving-and-loading-state)
16. [Subpath imports](#subpath-imports)
17. [Reproducibility (seeded RNG)](#reproducibility-seeded-rng)

---

## Installation

```bash
npm i @bglowacki/bingo-engine
```

Requires Node.js ≥ 20 or any modern browser supporting ES2022. The package is
shipped as both ESM and CommonJS with full TypeScript types.

```ts
// ESM (recommended)
import { createBingoEngine, POLISH_ALPHABET } from '@bglowacki/bingo-engine';

// CommonJS
const { createBingoEngine, POLISH_ALPHABET } = require('@bglowacki/bingo-engine');
```

> Every API below is implemented and covered by tests. The package is pre-1.0 and may still see minor API adjustments before `1.0.0`.

---

## Concepts at a glance

| Concept | Type | What it represents |
|---|---|---|
| **Alphabet** | `Alphabet` | Letters, point values, and bag counts for one language. |
| **BoardLayout** | `BoardLayout` | Board size and premium-square positions. |
| **RuleSet** | `RuleSet` | Game-variant rules (rack size, bingo bonus, center start, …). |
| **Dictionary** | `Dictionary` | Synchronous `has`/`hasPrefix` for word lookups. |
| **Board** | `Board` | Immutable 2D grid of `PlacedTile \| null` cells. |
| **Rack / Bag** | `Rack`, `Bag` | Lists of `PlacedTile`s. |
| **PlacedTile** | `{ tileId }` | Internal tile identity (numeric id, optional blank flag). |
| **PlacementTile** | `{ letter, isBlank }` | What consumers build — readable and JSON-friendly. |
| **Placement** | `{ startRow, startCol, direction, tiles }` | A move a player wants to make. |
| **TileId** | `number` | `0` is the blank; `1..n` are letters. The high bit (`0x80`) marks a played-blank-as-letter. |

Every operation that changes state returns a **new** value — boards, racks, and
bags are immutable. This keeps the engine safe to use in Web Workers, Redux
reducers, or any environment that demands referential transparency.

---

## Quick start

> Available in **v0.1.0**.

```ts
import {
  createBingoEngine,
  POLISH_ALPHABET,
  SCRABBLE_LAYOUT_15X15,
  SCRABBLE_CLASSIC_RULES,
  buildTrieDictionary,
  seededRng,
} from '@bglowacki/bingo-engine';

// 1. Build a dictionary (any source — file, Mongo, in-memory list).
const dictionary = buildTrieDictionary(['kot', 'kotek', 'pies', 'auto', /* … */]);

// 2. Create the engine.
const engine = createBingoEngine({
  alphabet: POLISH_ALPHABET,
  layout: SCRABBLE_LAYOUT_15X15,
  rules: SCRABBLE_CLASSIC_RULES,
  dictionary,
  random: seededRng(42), // optional — for reproducibility / tests
});

// 3. Generate a believable mid-game position with shared rack.
const { board, rack } = engine.generateBoard({ moves: 10 });

// 4. Validate and score a player's move.
const placement = {
  startRow: 7, startCol: 5, direction: 'horizontal' as const,
  tiles: [
    { letter: 'k', isBlank: false },
    { letter: 'o', isBlank: false },
    { letter: 't', isBlank: false },
  ],
};

const validation = engine.validatePlacement(board, placement, rack);
if (!validation.valid) {
  console.log('rejected:', validation.reason, validation.invalidWords);
} else {
  const score = engine.scorePlacement(board, placement);
  console.log(`scored ${score.total} points (${score.bingo ? 'BINGO!' : ''})`);
  for (const w of score.words) console.log('  ·', w.word, '=', w.score);
}
```

---

## Working with alphabets

> Available **now** (step 1).

The engine ships two alphabets out of the box:

```ts
import { POLISH_ALPHABET, ENGLISH_ALPHABET } from '@bglowacki/bingo-engine';

POLISH_ALPHABET.id;     // 'pl-PL'
POLISH_ALPHABET.size;   // 33  (32 letters + 1 blank slot)
POLISH_ALPHABET.locale; // 'pl-PL'
```

Every alphabet exposes typed-array hot-path data plus a label-to-id lookup:

```ts
import {
  POLISH_ALPHABET,
  letterToTileId,
  tileIdToLetter,
  tileScore,
} from '@bglowacki/bingo-engine';

const id = letterToTileId(POLISH_ALPHABET, 'ż'); // → number
const score = tileScore(POLISH_ALPHABET, id!);   // → 5
const letter = tileIdToLetter(POLISH_ALPHABET, id!); // → 'ż'
```

`letterToTileId` is locale-aware: `letterToTileId(POLISH_ALPHABET, 'Ż')` returns
the same id as `'ż'` because the alphabet was built with `locale: 'pl-PL'`.

---

## Tiles, racks, and the bag

> Available **now** (step 2).

```ts
import {
  POLISH_ALPHABET,
  blankAs,
  blankTile,
  drawTiles,
  freshBag,
  letterTile,
  removeFromRack,
  seededRng,
  returnTiles,
} from '@bglowacki/bingo-engine';

// Build a rack manually — useful in tests.
const rack = [
  letterTile(POLISH_ALPHABET, 'k')!,
  letterTile(POLISH_ALPHABET, 'o')!,
  letterTile(POLISH_ALPHABET, 't')!,
  blankTile(),
];

// A blank played to represent a specific letter:
const blankAsZ = blankAs(POLISH_ALPHABET, 'ż')!; // tileId has BLANK_FLAG set

// Draw 7 tiles from a fresh, shuffled bag.
const random = seededRng(123);
const fullBag = freshBag(POLISH_ALPHABET);
const { drawn, bag: rest } = drawTiles(fullBag, 7, random);
// drawn.length === 7, rest.length === 93

// Try to consume some tiles from a rack (blanks act as wildcards):
const newRack = removeFromRack(rack, [letterTile(POLISH_ALPHABET, 'k')!]);
// → newRack is a NEW rack with the 'k' removed; returns undefined if the rack
//   can't provide the requested tiles even after considering blanks.

// Return tiles to the bag (e.g. when exchanging).
const expanded = returnTiles(rest, [letterTile(POLISH_ALPHABET, 'q' as never)!].filter(Boolean));
```

`removeFromRack` is the single source of truth for "can this rack play these
tiles?" — `validatePlacement` uses it internally, so consumer code rarely calls
it directly.

---

## Building boards and placements

> Available **now** (step 2).

```ts
import {
  POLISH_ALPHABET,
  SCRABBLE_LAYOUT_15X15,
  emptyBoard,
  hasNeighbour,
  isEmpty,
  letterTile,
  placeTile,
  withCells,
} from '@bglowacki/bingo-engine';

const empty = emptyBoard(SCRABBLE_LAYOUT_15X15);
isEmpty(empty); // true

// Place a single tile:
const oneMove = placeTile(empty, 7, 7, letterTile(POLISH_ALPHABET, 'k')!);

// Place several tiles atomically:
const word = withCells(empty, [
  { row: 7, col: 5, cell: letterTile(POLISH_ALPHABET, 'k')! },
  { row: 7, col: 6, cell: letterTile(POLISH_ALPHABET, 'o')! },
  { row: 7, col: 7, cell: letterTile(POLISH_ALPHABET, 't')! },
]);

// Adjacency is required for moves after the first:
hasNeighbour(word, 7, 8); // true (next to the 't')
hasNeighbour(word, 0, 0); // false
```

A `Placement` (the consumer-facing input to validation/scoring) uses string
labels:

```ts
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
```

Notice that `tiles` only lists **new** tiles being placed. If your placement
crosses an existing letter on the board (e.g. extending `KOT` into `KOTLET`),
list only the new ones (`l`, `e`, `t`); the engine reads the existing letters
from the board.

---

## Validating a placement

> Available in **v0.1.0**.

```ts
const result = engine.validatePlacement(board, placement, rack);

if (!result.valid) {
  switch (result.reason) {
    case 'empty-placement':                 break; // no tiles
    case 'out-of-bounds':                   break; // off the board
    case 'has-gap':                         break; // gap with no existing letter to fill it
    case 'overlaps-existing-different-letter': break;
    case 'first-move-not-on-center':        break;
    case 'not-connected':                   break; // doesn't touch existing tiles
    case 'rack-mismatch':                   break; // rack can't provide the tiles
    case 'word-not-in-dictionary':
    case 'crossword-not-in-dictionary':
      console.log('invalid words:', result.invalidWords);
      break;
  }
}
```

`reason` codes are stable enums — translate them to user-facing strings on the
consumer side. The engine never surfaces localized text.

---

## Scoring a placement

> Available in **v0.1.0**.

```ts
const score = engine.scorePlacement(board, placement);

score.total;       // total points including bingo bonus
score.bingo;       // boolean — was the bingo bonus applied?
for (const w of score.words) {
  w.word;          // formed word, lowercase
  w.score;         // score for this single word, premiums included
  w.cells;         // [{ row, col, letter, fromRack, isBlank }]
}
```

Scoring rules:

- Premium squares (DLS, TLS, DWS, TWS) only multiply for **newly placed** tiles
  on this turn. A premium under an existing letter is not reapplied.
- A blank tile (`isBlank: true`) is always worth 0, even on a DLS/TLS.
- Word multipliers (DWS/TWS) apply once the per-letter score is summed.
- The bingo bonus (`rules.bingoBonus`, default `50`) is added once at the end
  when `placement.tiles.length === rules.bingoSize`.

---

## Generating a mid-game board

> Available in **v0.2.0** (step 7).

```ts
const result = engine.generateBoard({
  moves: 12,           // how many self-played moves to simulate
  topPercentile: 0.30, // pick from the top 30% of scored placements (default)
  rackSize: 7,         // override rules.rackSize if you want
  finalRack: 'fresh-draw', // 'fresh-draw' | 'last-rack'
});

result.board;          // Board with N words placed
result.rack;           // Rack of 7 tiles all players will see
result.bag;            // remaining tiles in the bag
result.movesPlayed;    // [{ placement, score, word }] in order played
```

The generator is **stochastic** by default but completely reproducible if you
provide a seeded RNG (see [Reproducibility](#reproducibility-seeded-rng)).

---

## Finding all legal placements

> Available in **v0.1.0** (solver, step 6).

```ts
const all = engine.findAllPlacements(board, rack);
const top = engine.findAllPlacements(board, rack, {
  limit: 20,         // top N by `sortBy`
  sortBy: 'score',   // 'score' | 'length' | 'none'
  minWordLength: 3,
  maxWordLength: 8,
});
```

Use this to power AI hints, "best move" suggestions, or training challenges.
The solver uses the classical Appel-Jacobson anchor algorithm with cross-checks
and trie pruning — fast enough to enumerate every move on a typical mid-game
board with the full OSPS dictionary in ~100–500ms (see PLAN.md for benchmarks).

---

## Custom alphabets

> Available **now** (step 1).

Build alphabets for any language with a single literal:

```ts
import { defineAlphabet } from '@bglowacki/bingo-engine';

const ITALIAN = defineAlphabet({
  id: 'it-IT',
  locale: 'it-IT',
  blankCount: 2,
  blankScore: 0,
  tiles: [
    { label: 'a', score: 1, count: 14, isVowel: true },
    { label: 'b', score: 5, count: 3 },
    { label: 'c', score: 2, count: 6 },
    { label: 'd', score: 5, count: 3 },
    { label: 'e', score: 1, count: 11, isVowel: true },
    // … (rest of the Italian Scrabble distribution)
  ],
});
```

Notes:

- The alphabet object is `Object.freeze`d. Hot-path data lives in `Int8Array`
  (`scores`) and `Uint8Array` (`counts`) for cache-friendly access in the
  solver's inner loop.
- `defineAlphabet` validates inputs: duplicate labels throw, label collisions
  with the blank symbol throw, more than 127 letters throws (the high bit is
  reserved for the blank flag).
- `isVowel` defaults to a built-in Polish/English heuristic — for other
  languages set it explicitly per tile.
- Multi-character tiles (Welsh `ch`, Spanish `rr`) are reserved via the
  `multiCharLabels` field but not yet implemented (see PLAN.md "Out of scope").

---

## Custom dictionaries

> Available in **v0.1.0** (step 3).

The engine never loads a word list itself — you supply a `Dictionary`:

```ts
interface Dictionary {
  has(word: string): boolean;
  hasPrefix(prefix: string): boolean;
  sample?(opts: { minLength: number; maxLength: number; count: number }): readonly string[];
}
```

Two ready-made backends are bundled:

```ts
import { buildSetDictionary, buildTrieDictionary } from '@bglowacki/bingo-engine';

// Tiny dictionary, slow solver — `hasPrefix` always returns true.
const small = buildSetDictionary(['kot', 'kotek', 'pies']);

// Production dictionary — O(L) prefix lookups make the solver ~10× faster.
const fast = buildTrieDictionary(allOspsWords);
```

### Bring your own backend

If you keep words in MongoDB / SQLite / Redis with an in-memory cache, just
implement the interface:

```ts
import type { Dictionary } from '@bglowacki/bingo-engine';

class MongoCachedDictionary implements Dictionary {
  constructor(private readonly cache: Set<string>) {}
  has(word: string)        { return this.cache.has(word.toLowerCase()); }
  hasPrefix(prefix: string) { /* implement via trie or a sorted list */ }
}
```

> ⚠️ The engine's hot path requires **synchronous** lookups. Async backends
> (Mongo, HTTP) must be pre-warmed before passing the dictionary in — load all
> words into an in-memory `Set` or trie at startup, then pass that wrapper.

---

## Custom rules

> Available **now** (step 1).

Three presets ship out of the box:

```ts
import {
  SCRABBLE_CLASSIC_RULES,
  SCRABBLE_NO_BINGO_RULES,
  SCRABBLE_FREE_RULES,
} from '@bglowacki/bingo-engine';
```

Customize by spreading:

```ts
import type { RuleSet } from '@bglowacki/bingo-engine';

const wordsWithFriends: RuleSet = {
  ...SCRABBLE_CLASSIC_RULES,
  bingoBonus: 35, // WWF uses 35 instead of 50
};

const literaki: RuleSet = {
  ...SCRABBLE_CLASSIC_RULES,
  bingoBonus: 0,  // Literaki has no bingo bonus
  // Use SIMPLE_LAYOUT_15X15 (no premium squares) instead — Literaki has
  // a different premium pattern; that's a separate BoardLayout.
};
```

For training / quick games:

```ts
const oneShot: RuleSet = {
  ...SCRABBLE_CLASSIC_RULES,
  mustCoverCenterFirstMove: false,
  mustConnectAfterFirst: false,
};
```

---

## Using the engine in a Web Worker

> Available in **v0.1.0**.

The engine is designed to be Web-Worker-friendly: zero shared mutable state,
plain-object configs, no closures over caller scope. The recommended pattern
is to **construct the engine inside the worker** and only send pure data
through `postMessage`:

```ts
// main.ts
const worker = new Worker(new URL('./solver.worker.ts', import.meta.url), { type: 'module' });

worker.postMessage({
  type: 'solve',
  board: serializedBoard,   // engine.serializeBoard(...)
  rack: rackTilesArray,     // PlacedTile[] is JSON-friendly
  seed: 42,                 // any number
});

worker.onmessage = (e) => {
  if (e.data.type === 'solved') console.log(e.data.placements);
};
```

```ts
// solver.worker.ts
import {
  createBingoEngine,
  POLISH_ALPHABET,
  SCRABBLE_LAYOUT_15X15,
  SCRABBLE_CLASSIC_RULES,
  buildTrieDictionary,
  seededRng,
} from '@bglowacki/bingo-engine';

import { OSPS_WORDS } from './dictionary-bundle.js'; // pre-bundled Set

const dictionary = buildTrieDictionary(OSPS_WORDS);
const engine = createBingoEngine({
  alphabet: POLISH_ALPHABET,
  layout: SCRABBLE_LAYOUT_15X15,
  rules: SCRABBLE_CLASSIC_RULES,
  dictionary,
});

self.onmessage = (e) => {
  if (e.data.type === 'solve') {
    const board = engine.deserializeBoard(e.data.board);
    const placements = engine.findAllPlacements(board, e.data.rack);
    (self as unknown as Worker).postMessage({ type: 'solved', placements });
  }
};
```

Key points:

- The `random` callback is **not** transferable through `postMessage`. Build
  it from a numeric seed inside the worker via `seededRng(seed)`.
- `Alphabet` contains an `Int8Array`, `Uint8Array`, and a `bigint` — all
  three are fully supported by the structured-clone algorithm. You generally
  don't need to send them; just build the engine inside the worker.

---

## Saving and loading state

> Available in **v0.1.0** (step 8).

Boards are immutable read-only nested arrays — perfectly fine to write to JSON
directly. For the most compact form use the bundled serializer:

```ts
const json = JSON.stringify(engine.serializeBoard(board));
// store in DB, send over the wire, …

const board2 = engine.deserializeBoard(JSON.parse(json));
```

Alphabet, layout, and rules are static configs — store them by `id`/name
rather than serializing them whole.

---

## Subpath imports

For tree-shaking-friendly bundles, import only what you need:

```ts
// Only the alphabet API
import { defineAlphabet, POLISH_ALPHABET } from '@bglowacki/bingo-engine/alphabet';

// Only the solver's types and helpers
import { findAllPlacements } from '@bglowacki/bingo-engine/solver';

// Only the generator
import { generateBoard } from '@bglowacki/bingo-engine/generator';
```

Use this when bundle size matters (mobile, edge runtimes). Modern bundlers
already tree-shake the main entry, so this is mostly a hint to humans reading
the imports.

---

## Reproducibility (seeded RNG)

> Available in **v0.1.0**.

Every randomized operation in the engine accepts a `random: () => number`
callback. The bundled `seededRng(seed: number)` returns a deterministic
[mulberry32](https://gist.github.com/tommyettinger/46a3d40d8d80a5f86c43b1ed7b0e3e4f)
stream — the same seed always produces the same sequence:

```ts
import { seededRng, drawTiles, freshBag, POLISH_ALPHABET } from '@bglowacki/bingo-engine';

const random = seededRng(42);
const bag = freshBag(POLISH_ALPHABET);
const { drawn } = drawTiles(bag, 7, random);
// → identical `drawn` every time you run this code with seed 42
```

This is invaluable for tests and reproducing user-reported bugs (record the
seed, replay the position locally).
