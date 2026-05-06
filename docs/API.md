# API Reference

> Pure reference for every exported symbol in `@bglowacki/bingo-engine@0.1.0`.
> For tutorial-style learning, start with [USAGE.md](./USAGE.md).
> For design rationale, read [PLAN.md](./PLAN.md).

Conventions used here:

- All function signatures are TypeScript. JavaScript callers can use the same calls — types disappear at runtime.
- "Returns" describes what the function evaluates to.
- "Throws" lists the exact error conditions; otherwise the function never throws.
- Examples assume:
  ```ts
  import * as engine from '@bglowacki/bingo-engine';
  ```
  but real consumers will import only what they need.

---

## Table of contents

1. [Engine factory](#engine-factory)
2. [BingoEngine instance methods](#bingoengine-instance-methods)
3. [Alphabets](#alphabets)
4. [Board operations](#board-operations)
5. [Rack and bag](#rack-and-bag)
6. [Tile builders and helpers](#tile-builders-and-helpers)
7. [Dictionary backends](#dictionary-backends)
8. [Validator](#validator)
9. [Scorer](#scorer)
10. [Solver](#solver)
11. [Generator](#generator)
12. [Placement application](#placement-application)
13. [Serialization](#serialization)
14. [Random number generator](#random-number-generator)
15. [Constants](#constants)
16. [Pre-built configurations](#pre-built-configurations)
17. [Types](#types)

---

## Engine factory

### `createBingoEngine(config)`

```ts
function createBingoEngine(config: EngineConfig): BingoEngine
```

Build a `BingoEngine` instance bound to one configuration. Every method on the returned engine is a thin wrapper around the corresponding standalone function exported by the package — call those directly when you want to vary the alphabet/dictionary/rules per call.

**Parameters**

| Name | Type | Description |
|---|---|---|
| `config.alphabet` | [`Alphabet`](#alphabet) | The alphabet used for every operation. |
| `config.layout` | [`BoardLayout`](#boardlayout) | Board size + premium squares + center cell. |
| `config.rules` | [`RuleSet`](#ruleset) | Game-variant rules (rack size, bingo bonus, etc). |
| `config.dictionary` | [`Dictionary`](#dictionary) | Synchronous word lookup backend. |
| `config.random?` | `() => number` | Optional. Deterministic RNG; defaults to `Math.random`. |

**Returns** — frozen [`BingoEngine`](#bingoengine) object.

**Example**

```ts
import {
  createBingoEngine,
  POLISH_ALPHABET,
  SCRABBLE_LAYOUT_15X15,
  SCRABBLE_CLASSIC_RULES,
  buildTrieDictionary,
  seededRng,
} from '@bglowacki/bingo-engine';

const engine = createBingoEngine({
  alphabet: POLISH_ALPHABET,
  layout: SCRABBLE_LAYOUT_15X15,
  rules: SCRABBLE_CLASSIC_RULES,
  dictionary: buildTrieDictionary(['kot', 'pies', 'auto']),
  random: seededRng(42),
});
```

---

## BingoEngine instance methods

Every method is a closure over the config you passed to `createBingoEngine`.

### `engine.emptyBoard()`

```ts
emptyBoard(): Board
```

Returns a fresh `size × size` board filled with `null`. Same as the standalone [`emptyBoard(layout)`](#emptyboardlayout) bound to the engine's layout.

```ts
const board = engine.emptyBoard();
board.length;        // 15
board[7]![7];        // null
```

### `engine.freshBag()`

```ts
freshBag(): Bag
```

Returns the full bag of tiles (alphabet's distribution flattened, blanks at `tileId: 0`).

```ts
const bag = engine.freshBag();
bag.length;          // 100 for Polish/English
```

### `engine.drawTiles(bag, count)`

```ts
drawTiles(bag: Bag, count: number): { drawn: PlacedTile[]; bag: Bag }
```

Draws `count` tiles randomly from `bag` without replacement. Uses the engine's configured `random`.

| Param | Type | Description |
|---|---|---|
| `bag` | `Bag` | Tiles still available. |
| `count` | `number` | How many to draw. Capped at `bag.length`; `<=0` returns empty. |

**Returns** `{ drawn, bag }` — drawn tiles + new bag (original bag is untouched).

```ts
const { drawn, bag: rest } = engine.drawTiles(engine.freshBag(), 7);
drawn.length;        // 7
rest.length;         // 93
```

### `engine.validatePlacement(board, placement, rack)`

```ts
validatePlacement(board: Board, placement: Placement, rack: Rack): ValidationResult
```

Validates a player's placement against the board, rack, and rules. Returns `{ valid: true }` on success or `{ valid: false, reason, invalidWords? }` on the first rule violation. See [`ValidationReason`](#validationreason) for the exhaustive enum.

```ts
const placement = {
  startRow: 7, startCol: 6, direction: 'horizontal' as const,
  tiles: [{letter:'k',isBlank:false},{letter:'o',isBlank:false},{letter:'t',isBlank:false}],
};
const rack = [/* PlacedTile[] */];
const result = engine.validatePlacement(engine.emptyBoard(), placement, rack);
if (!result.valid) console.log(result.reason);
```

### `engine.scorePlacement(board, placement)`

```ts
scorePlacement(board: Board, placement: Placement): ScoreBreakdown
```

Scores a placement assuming it's already valid. Returns `{ total, bingo, words }` with per-word breakdowns including the cells that contributed.

```ts
const score = engine.scorePlacement(board, placement);
score.total;                 // total points incl. bingo bonus
score.bingo;                 // true when 7 tiles played
score.words[0]!.word;        // 'kot'
score.words[0]!.score;       // word score with premiums
```

### `engine.applyPlacement(board, placement)`

```ts
applyPlacement(board: Board, placement: Placement): Board
```

Returns a new board with the placement's new tiles laid down. Original board is untouched.

```ts
const newBoard = engine.applyPlacement(board, placement);
```

### `engine.findAllPlacements(board, rack, opts?)`

```ts
findAllPlacements(board: Board, rack: Rack, opts?: SolverOptions): Placement[]
```

Enumerates every legal placement. See [Solver](#solver) for algorithm notes.

| Option | Type | Default |
|---|---|---|
| `limit` | `number` | unlimited |
| `sortBy` | `'score' \| 'length' \| 'none'` | `'score'` |
| `minWordLength` | `number` | `1` |
| `maxWordLength` | `number` | `layout.size` |

```ts
const top10 = engine.findAllPlacements(board, rack, { limit: 10, sortBy: 'score' });
```

### `engine.generateBoard(opts?)`

```ts
generateBoard(opts?: GeneratorOptions): GeneratedBoard
```

Greedy self-play board generator. See [Generator](#generator).

```ts
const { board, rack, movesPlayed } = engine.generateBoard({ moves: 12 });
```

### `engine.placementsToWords(board, placement)`

```ts
placementsToWords(board: Board, placement: Placement): readonly FormedWord[]
```

Returns every word formed by a placement (main + crosswords) with full per-cell breakdown. Convenience wrapper over `scorePlacement().words`.

```ts
const words = engine.placementsToWords(board, placement);
for (const w of words) console.log(`${w.word} = ${w.score}`);
```

### `engine.serializeBoard(board)`

```ts
serializeBoard(board: Board): SerializedBoard
```

Convert a `Board` to a JSON-friendly `{ size, cells: PlacedTile|null[] }`.

```ts
const json = JSON.stringify(engine.serializeBoard(board));
```

### `engine.deserializeBoard(data)`

```ts
deserializeBoard(data: SerializedBoard): Board
```

Inverse of `serializeBoard`. Validates the input shape (size, cells length, tile-id ranges) and throws on malformed payloads.

```ts
const board = engine.deserializeBoard(JSON.parse(json));
```

**Throws**

- `RangeError` if `size` not in `[1, 64]` or non-integer.
- `RangeError` if `cells.length !== size * size`.
- `RangeError` if any cell has a non-integer or negative `tileId`.
- `Error` if a `layout` was bound at engine creation and its `size` doesn't match the payload.

---

## Alphabets

### `defineAlphabet(spec)`

```ts
function defineAlphabet(spec: AlphabetSpec): Alphabet
```

Build an immutable `Alphabet` from a spec. Lowercases labels via the spec's `locale` (default `'en'`).

| `spec` field | Type | Description |
|---|---|---|
| `id` | `string` | Identifier, e.g. `'pl-PL'`. |
| `tiles` | `readonly TileSpec[]` | One entry per letter (excluding blank). |
| `blankCount` | `number` | How many blanks in the bag. |
| `blankScore?` | `number` | Score per blank tile (default `0`). |
| `locale?` | `string` | Locale for `.toLocaleLowerCase` (default `'en'`). |
| `blankSymbol?` | `string` | Default `'?'`. Must already be lowercase for the locale. |

`TileSpec` has `{ label, score, count, isVowel?, multiCharLabels? }`. `multiCharLabels` is reserved for future digraph support and currently ignored.

**Throws**

- `'Alphabet.id is required.'` if `id` empty.
- `'Alphabet must have at least one tile.'` if `tiles` empty.
- `'Alphabet.blankCount must be a non-negative integer.'`
- `'Alphabet.blankSymbol must already be lowercase for locale ...'`
- `'Tile #N has empty label.'`
- `'Duplicate tile label: "..."'`
- `'Tile label "..." collides with blank symbol.'`
- `'Tile "..." score must be an integer in [-128, 127].'`
- `'Tile "..." count must be an integer in [0, 255].'`
- `'Alphabet too large: TileId N would collide with BLANK_FLAG (128). Reduce tile count below 128.'`

**Example**

```ts
import { defineAlphabet } from '@bglowacki/bingo-engine';

const ITALIAN = defineAlphabet({
  id: 'it-IT',
  locale: 'it-IT',
  blankCount: 2,
  tiles: [
    { label: 'a', score: 1, count: 14, isVowel: true },
    { label: 'b', score: 5, count: 3 },
    // …
  ],
});
```

### `POLISH_ALPHABET`

```ts
const POLISH_ALPHABET: Alphabet
```

Standard Polish Scrabble distribution (PFS / OSPS): 32 letters + 2 blanks, 100 tiles total. `Y = 2` points (NOT 1 — common Anglo-confusion).

```ts
import { POLISH_ALPHABET } from '@bglowacki/bingo-engine';
POLISH_ALPHABET.id;          // 'pl-PL'
POLISH_ALPHABET.size;        // 33
POLISH_ALPHABET.locale;      // 'pl-PL'
```

### `ENGLISH_ALPHABET`

```ts
const ENGLISH_ALPHABET: Alphabet
```

Standard English Scrabble distribution (TWL / SOWPODS — same letter set). 26 letters + 2 blanks.

---

## Board operations

### `emptyBoard(layout)`

```ts
function emptyBoard(layout: BoardLayout): Board
```

Build an empty `size × size` board. All cells are `null`.

```ts
const board = emptyBoard(SCRABBLE_LAYOUT_15X15);
```

### `getCell(board, row, col)`

```ts
function getCell(board: Board, row: number, col: number): Cell
```

Read a cell. Throws on out-of-bounds — caller should check first.

```ts
const cell = getCell(board, 7, 7);   // null or PlacedTile
```

### `isEmpty(board)`

```ts
function isEmpty(board: Board): boolean
```

`true` iff every cell is empty. O(n²) — used at the start of generator.

```ts
isEmpty(emptyBoard(layout));   // true
```

### `withCell(board, row, col, cell)`

```ts
function withCell(board: Board, row: number, col: number, cell: Cell): Board
```

Returns a new board with one cell replaced. Throws on out-of-bounds. The original board is untouched and unchanged rows are shared by reference.

```ts
const next = withCell(board, 7, 7, { tileId: 5 });
```

### `withCells(board, changes)`

```ts
function withCells(
  board: Board,
  changes: ReadonlyArray<{ row: number; col: number; cell: Cell }>,
): Board
```

Apply many cell changes at once. Returns the same `board` reference if `changes.length === 0`.

```ts
const next = withCells(board, [
  { row: 7, col: 6, cell: { tileId: 14 } },
  { row: 7, col: 7, cell: { tileId: 17 } },
  { row: 7, col: 8, cell: { tileId: 22 } },
]);
```

### `hasNeighbour(board, row, col)`

```ts
function hasNeighbour(board: Board, row: number, col: number): boolean
```

`true` iff `(row, col)` has at least one orthogonal neighbour with a tile. Out-of-bounds cells count as empty.

```ts
hasNeighbour(board, 7, 8);   // true if (7,7) has a tile
```

### `placeTile(board, row, col, tile)`

```ts
function placeTile(board: Board, row: number, col: number, tile: PlacedTile): Board
```

Convenience: alias for `withCell` with a non-null cell.

### `inBounds(row, col, size)`

```ts
function inBounds(row: number, col: number, size: number): boolean
```

`true` iff `(row, col)` lies inside a `size × size` board.

```ts
inBounds(15, 0, 15);   // false
inBounds(0, 0, 15);    // true
```

### `step(row, col, direction)`

```ts
function step(row: number, col: number, direction: Direction): { row: number; col: number }
```

Advance one cell along the given direction.

```ts
step(7, 7, 'horizontal');   // { row: 7, col: 8 }
step(7, 7, 'vertical');     // { row: 8, col: 7 }
```

### `perpendicular(direction)`

```ts
function perpendicular(direction: Direction): Direction
```

Flip horizontal ↔ vertical.

```ts
perpendicular('horizontal');   // 'vertical'
```

---

## Rack and bag

### `freshBag(alphabet)`

```ts
function freshBag(alphabet: Alphabet): Bag
```

Build a fresh bag containing every tile in the alphabet's distribution. Order is alphabet-order (deterministic).

```ts
const bag = freshBag(POLISH_ALPHABET);   // 100 tiles
```

### `drawTiles(bag, count, random?)`

```ts
function drawTiles(
  bag: Bag,
  count: number,
  random?: () => number
): { drawn: PlacedTile[]; bag: Bag }
```

Draw `count` random tiles from the bag without replacement.

| Param | Default | Notes |
|---|---|---|
| `random` | `Math.random` | Inject `seededRng(seed)` for deterministic draws. |

If `count` exceeds bag size, returns whatever is available (does not throw). `count <= 0` returns empty.

```ts
import { freshBag, drawTiles, seededRng, POLISH_ALPHABET } from '@bglowacki/bingo-engine';
const { drawn, bag } = drawTiles(freshBag(POLISH_ALPHABET), 7, seededRng(42));
```

### `returnTiles(bag, tiles)`

```ts
function returnTiles(bag: Bag, tiles: readonly PlacedTile[]): Bag
```

Append tiles to a bag, returning a new bag. If `tiles` is empty, returns the original `bag` reference.

```ts
const expanded = returnTiles(bag, [letterTile(POLISH_ALPHABET, 'k')!]);
```

### `removeFromRack(rack, wanted)`

```ts
function removeFromRack(rack: Rack, wanted: readonly PlacedTile[]): Rack | undefined
```

Try to remove `wanted` tiles from `rack`, treating blanks as wildcards. Returns the new rack or `undefined` if the rack does not cover the request.

Matching strategy:
- Prefer exact `tileId` matches (consume real letters before blanks).
- Fall back to a rack blank for any remaining wanted tile.
- A `wanted` tile with `BLANK_FLAG` set (blank-played-as-letter) consumes a rack blank, **never** a real letter of that letter.

```ts
const rack = [letterTile(a, 'k')!, blankTile(), letterTile(a, 't')!];
const wanted = [letterTile(a, 'k')!, letterTile(a, 'o')!, letterTile(a, 't')!];
const next = removeFromRack(rack, wanted);
// next has 0 tiles; the blank stood in for 'o'
```

### `rackCanProvide(rack, wanted)`

```ts
function rackCanProvide(rack: Rack, wanted: readonly PlacedTile[]): boolean
```

`true` iff `rack` can produce all `wanted` tiles. Equivalent to `removeFromRack(...) !== undefined` but doesn't allocate.

### `countTile(rack, tileId)`

```ts
function countTile(rack: Rack, tileId: TileId): number
```

Count tiles of a given id in the rack (ignoring the blank flag).

```ts
countTile(rack, letterToTileId(POLISH_ALPHABET, 'a')!);
```

---

## Tile builders and helpers

### `tile(tileId)`

```ts
function tile(tileId: TileId): PlacedTile
```

Build a `PlacedTile` carrying the given `TileId` (with optional blank flag).

```ts
tile(5);   // { tileId: 5 }
```

### `blankTile()`

```ts
function blankTile(): PlacedTile
```

Build a blank rack-tile (id `0`, no flag).

### `letterTile(alphabet, letter)`

```ts
function letterTile(alphabet: Alphabet, letter: string): PlacedTile | undefined
```

Build a `PlacedTile` representing a regular letter played from rack. Returns `undefined` if the letter is not in the alphabet.

```ts
const k = letterTile(POLISH_ALPHABET, 'k');   // { tileId: 14 }
letterTile(POLISH_ALPHABET, 'q');             // undefined (no 'q' in Polish)
```

### `blankAs(alphabet, letter)`

```ts
function blankAs(alphabet: Alphabet, letter: string): PlacedTile | undefined
```

Build a blank-played-as-letter `PlacedTile`. Sets `BLANK_FLAG` on top of the letter id.

```ts
const blankAsZ = blankAs(POLISH_ALPHABET, 'ż');
// (blankAsZ.tileId & BLANK_FLAG) !== 0  -> true
```

### `isPlacedBlank(tile)`

```ts
function isPlacedBlank(tile: PlacedTile): boolean
```

`true` iff the tile is a blank-played-as-letter on the board.

### `isRackBlank(tile)`

```ts
function isRackBlank(tile: PlacedTile): boolean
```

`true` iff the tile is a rack blank (id exactly `0`, not played yet).

### `bareTileId(tile)`

```ts
function bareTileId(tile: PlacedTile): TileId
```

Strip the blank flag from a `PlacedTile`'s id.

### `tileLetter(alphabet, tile)`

```ts
function tileLetter(alphabet: Alphabet, tile: PlacedTile): string
```

Returns the displayed letter of a tile (no blank flag). Equivalent to `tileIdToLetter(alphabet, tile.tileId)`.

### `tileScore(alphabet, tileId)`

```ts
function tileScore(alphabet: Alphabet, tileId: TileId): number
```

Score for a (possibly blanked) tile. Returns `0` for blank tiles, otherwise looks up `alphabet.scores`.

```ts
tileScore(POLISH_ALPHABET, letterToTileId(POLISH_ALPHABET, 'ż')!);   // 5
tileScore(POLISH_ALPHABET, BLANK);                                    // 0
```

### `tileIdToLetter(alphabet, tileId)`

```ts
function tileIdToLetter(alphabet: Alphabet, tileId: TileId): string
```

Convert a `TileId` to its display letter (no blank flag).

### `letterToTileId(alphabet, letter)`

```ts
function letterToTileId(alphabet: Alphabet, letter: string): TileId | undefined
```

Look up a label, returning `undefined` if not in the alphabet. Locale-aware lowercase.

```ts
letterToTileId(POLISH_ALPHABET, 'Ł');   // same id as 'ł' (locale-aware)
letterToTileId(POLISH_ALPHABET, 'q');   // undefined
```

### `isBlanked(tileId)`

```ts
function isBlanked(tileId: TileId): boolean
```

`true` iff the high bit (`BLANK_FLAG`) is set.

### `unblank(tileId)`

```ts
function unblank(tileId: TileId): TileId
```

Strip `BLANK_FLAG` from a tile id.

```ts
unblank(0x9c);   // 0x1c
```

---

## Dictionary backends

The engine never owns a word list. Implement `Dictionary` yourself, or use one of the bundled builders.

### `buildSetDictionary(words, opts?)`

```ts
function buildSetDictionary(
  words: Iterable<string>,
  opts?: { random?: () => number },
): Dictionary
```

`Set`-backed dictionary. `has` is O(1). **`hasPrefix` always returns `true`** (slow-path fallback) — the solver becomes O(branching × length) without prefix pruning. Use only for tiny dictionaries or test fixtures.

`sample()` returns up to `count` words filtered by `[minLength, maxLength]`, picked uniformly with the supplied `random` (default `Math.random`).

```ts
const d = buildSetDictionary(['kot', 'kotek', 'pies']);
d.has('kot');            // true
d.hasPrefix('any');      // true (slow path)
d.sample!({ minLength: 3, maxLength: 5, count: 2 });   // ['kot','pies'] etc.
```

### `buildTrieDictionary(words, opts?)`

```ts
function buildTrieDictionary(
  words: Iterable<string>,
  opts?: { random?: () => number },
): Dictionary
```

Trie-backed dictionary. `has` and `hasPrefix` are both O(L) where L is the word length. **Recommended backend for the solver** — anchor-based DFS leans on `hasPrefix` to prune dead branches.

```ts
const d = buildTrieDictionary(allOspsWords);
d.hasPrefix('koz');      // true if any word starts with 'koz'
d.has('kot');            // true iff 'kot' is in the list
```

---

## Validator

### `validatePlacement(board, placement, rack, ctx)`

```ts
function validatePlacement(
  board: Board,
  placement: Placement,
  rack: Rack,
  ctx: ValidatorContext,
): ValidationResult
```

`ValidatorContext` = `{ alphabet, layout, rules, dictionary }`.

Returns `{ valid: true }` on success, or `{ valid: false, reason, invalidWords? }` on the first rule violation. Rule precedence (stable):

1. `'empty-placement'` — no tiles.
2. `'out-of-bounds'` — any tile would land off the board.
3. `'overlaps-existing-different-letter'` — a new tile collides with a non-matching cell.
4. `'rack-mismatch'` — rack can't provide the consumed tiles.
5. `'first-move-not-on-center'` — first move must cover `layout.centerStart`.
6. `'not-connected'` — subsequent move must touch existing tiles.
7. `'word-not-in-dictionary'` — main word missing.
8. `'crossword-not-in-dictionary'` — at least one crossword missing; `invalidWords` lists every bad crossword.
9. `'has-gap'` — reserved; structurally unreachable through valid placement input.

```ts
const result = validatePlacement(board, placement, rack, {
  alphabet: POLISH_ALPHABET,
  layout: SCRABBLE_LAYOUT_15X15,
  rules: SCRABBLE_CLASSIC_RULES,
  dictionary,
});
if (!result.valid) console.log('rejected:', result.reason, result.invalidWords);
```

---

## Scorer

### `scorePlacement(board, placement, ctx)`

```ts
function scorePlacement(
  board: Board,
  placement: Placement,
  ctx: ScorerContext,
): ScoreBreakdown
```

`ScorerContext` = `{ alphabet, layout, rules }` (no dictionary needed).

Premium semantics:
- DLS / TLS multiply ONLY the new tile's letter value.
- DWS / TWS multiply the entire word's value.
- Multipliers compose: `DWS × TWS = ×6`.
- Existing tiles ignore their cell's premium.
- Blank tiles always score `0`, even on DLS/TLS.
- Crosswords scored independently with their own premiums.
- Bingo bonus added once at the end if `placement.tiles.length === rules.bingoSize`.

```ts
const score = scorePlacement(board, placement, ctx);
score.total;                      // total
score.bingo;                      // boolean
score.words[0]!.cells[0]!.fromRack;   // true for new tiles
```

---

## Solver

### `findAllPlacements(board, rack, ctx, opts?)`

```ts
function findAllPlacements(
  board: Board,
  rack: Rack,
  ctx: SolverContext,
  opts?: SolverOptions,
): Placement[]
```

`SolverContext` = `{ alphabet, layout, rules, dictionary }`.

Anchor-based DFS placement enumeration with `Dictionary.hasPrefix` trie pruning. Returns every legal placement, with optional filtering and sorting:

| Option | Type | Default |
|---|---|---|
| `limit` | `number` | unlimited |
| `sortBy` | `'score' \| 'length' \| 'none'` | `'score'` |
| `minWordLength` | `number` | `1` |
| `maxWordLength` | `number` | `layout.size` |

Anchor cells: empty cells touching an existing tile. On an empty board the only anchor is `layout.centerStart` (or every cell if `centerStart` is undefined).

```ts
const top10 = findAllPlacements(board, rack, ctx, { limit: 10, sortBy: 'score' });
```

### `findAnchors(board, layout)`

```ts
function findAnchors(board: Board, layout: BoardLayout): Anchor[]
```

`Anchor` = `{ row: number; col: number }`. Returned in row-major order (deterministic). Useful for tooling (highlighting playable cells in UI).

```ts
const anchors = findAnchors(board, SCRABBLE_LAYOUT_15X15);
// On a fresh board: [{ row: 7, col: 7 }] (just the center)
```

---

## Generator

### `generateBoard(ctx, opts?)`

```ts
function generateBoard(
  ctx: GeneratorContext,
  opts?: GeneratorOptions,
): GeneratedBoard
```

`GeneratorContext` = `{ alphabet, layout, rules, dictionary, random? }`.

Greedy self-play board generator:
1. Solve every legal placement on the current board with the current rack.
2. Sort by score, take the top `topPercentile` slice.
3. Pick uniformly at random from that slice.
4. Apply, refill rack from bag.
5. Repeat for `moves` plies; abort early if two consecutive racks can't form anything.

| Option | Type | Default |
|---|---|---|
| `moves` | `number` | `10` |
| `topPercentile` | `number` | `0.30` |
| `rackSize` | `number` | `rules.rackSize` |
| `finalRack` | `'fresh-draw' \| 'last-rack'` | `'last-rack'` |

Output: `{ board, bag, rack, movesPlayed }`. With a seeded RNG (`ctx.random = seededRng(seed)`) the result is fully deterministic.

```ts
import { generateBoard, seededRng } from '@bglowacki/bingo-engine';

const result = generateBoard({
  alphabet: POLISH_ALPHABET,
  layout: SCRABBLE_LAYOUT_15X15,
  rules: SCRABBLE_CLASSIC_RULES,
  dictionary,
  random: seededRng(42),
}, { moves: 12 });

console.log('Played', result.movesPlayed.length, 'moves');
console.log('Final rack:', result.rack.length);
```

---

## Placement application

### `applyPlacement(board, placement, alphabet)`

```ts
function applyPlacement(board: Board, placement: Placement, alphabet: Alphabet): Board
```

Apply a placement to a board, returning a new board with the new tiles laid down. Original board untouched. Assumes the placement is already valid — does NOT re-check.

```ts
const nextBoard = applyPlacement(board, placement, POLISH_ALPHABET);
```

### `computeNewCells(board, placement, alphabet)`

```ts
function computeNewCells(
  board: Board,
  placement: Placement,
  alphabet: Alphabet,
): { row: number; col: number; placedTile: PlacedTile }[]
```

Returns the row/col + new tile id for every NEW tile in the placement, skipping cells already occupied (those are placement "fillers"). Useful for animation/rendering when you need to know what was newly placed.

```ts
const newCells = computeNewCells(board, placement, POLISH_ALPHABET);
for (const c of newCells) console.log(`new tile at ${c.row},${c.col}`);
```

---

## Serialization

### `serializeBoard(board)`

```ts
function serializeBoard(board: Board): SerializedBoard
```

Convert a `Board` to a JSON-friendly `{ size, cells: PlacedTile|null[] }`. Round-trips through `JSON.stringify`. Preserves the `BLANK_FLAG` on blank-as-letter tiles.

```ts
const json = JSON.stringify(serializeBoard(board));
```

### `deserializeBoard(data, layout?)`

```ts
function deserializeBoard(data: SerializedBoard, layout?: BoardLayout): Board
```

Inverse of `serializeBoard`. Validates input shape and throws on malformed payloads. Optional `layout` enforces a size match.

**Throws**

- `RangeError` if `size` not in `[1, 64]` or non-integer.
- `RangeError` if `cells.length !== size * size`.
- `RangeError` if any `cell.tileId` is non-integer or negative.
- `Error` if `layout.size !== data.size`.

```ts
const board = deserializeBoard(JSON.parse(json), SCRABBLE_LAYOUT_15X15);
```

---

## Random number generator

### `seededRng(seed)`

```ts
function seededRng(seed: number): () => number
```

Mulberry32 PRNG. Returns a function with the same signature as `Math.random` (yields a float in `[0, 1)`). The same `seed` always produces the same sequence — useful for reproducible board generation, deterministic tests, and replaying user-reported bugs.

```ts
const rng = seededRng(42);
rng();   // deterministic float
rng();   // next float in the same stream
```

---

## Constants

### `BLANK`

```ts
const BLANK: TileId = 0
```

ID of the blank tile in any alphabet.

### `BLANK_FLAG`

```ts
const BLANK_FLAG = 0x80
```

Bit OR'd onto a `TileId` to indicate "blank played as this letter".

### `VERSION`

```ts
const VERSION = '0.1.0'
```

Library version (in sync with `package.json`).

---

## Pre-built configurations

### Alphabets

- [`POLISH_ALPHABET`](#polish_alphabet) — `'pl-PL'`, OSPS distribution, 100 tiles (`Y = 2 pts`).
- [`ENGLISH_ALPHABET`](#english_alphabet) — `'en-US'`, TWL distribution, 100 tiles.

### Layouts

#### `SCRABBLE_LAYOUT_15X15`

```ts
const SCRABBLE_LAYOUT_15X15: BoardLayout
```

Classic Scrabble 15×15 layout: 8 TWS + 17 DWS (incl. center) + 12 TLS + 24 DLS. `centerStart: { row: 7, col: 7 }`.

#### `SIMPLE_LAYOUT_15X15`

```ts
const SIMPLE_LAYOUT_15X15: BoardLayout
```

15×15 with no premium squares (useful for casual variants and tests). Same `centerStart`.

### Rules

#### `SCRABBLE_CLASSIC_RULES`

```ts
const SCRABBLE_CLASSIC_RULES: RuleSet = {
  rackSize: 7, bingoBonus: 50, bingoSize: 7,
  mustCoverCenterFirstMove: true, mustConnectAfterFirst: true,
  allowDiagonal: false,
}
```

#### `SCRABBLE_NO_BINGO_RULES`

Same as classic but `bingoBonus: 0`. For pedagogical / training variants.

#### `SCRABBLE_FREE_RULES`

```ts
const SCRABBLE_FREE_RULES: RuleSet = {
  rackSize: 7, bingoBonus: 0, bingoSize: 7,
  mustCoverCenterFirstMove: false, mustConnectAfterFirst: false,
  allowDiagonal: false,
}
```

Lax variant: no center requirement, no connection requirement. Useful for testing and free-placement single-word competitions.

---

## Types

This section is a quick lookup for every exported type. See the source-of-truth in [`src/types.ts`](../src/types.ts) for full JSDoc.

### `TileId`

```ts
type TileId = number
```

Small non-negative integer identifying a tile within an `Alphabet`. `0` is the blank; letters are `1..n`. A blank played as a letter sets `BLANK_FLAG` (`0x80`).

### `Direction`

```ts
type Direction = 'horizontal' | 'vertical'
```

### `PremiumKind`

```ts
type PremiumKind = 'DLS' | 'TLS' | 'DWS' | 'TWS'
```

DLS = Double Letter Score, TLS = Triple Letter, DWS = Double Word, TWS = Triple Word.

### `Cell`

```ts
type Cell = PlacedTile | null
```

### `Board`

```ts
type Board = readonly (readonly Cell[])[]
```

Immutable 2D board. Operations return new boards.

### `Rack`, `Bag`

```ts
type Rack = readonly PlacedTile[]
type Bag = readonly PlacedTile[]
```

### `PlacedTile`

```ts
interface PlacedTile { readonly tileId: TileId }
```

Internal tile representation (numeric, hot-path friendly).

### `PlacementTile`

```ts
interface PlacementTile {
  readonly letter: string
  readonly isBlank: boolean
}
```

Consumer-facing placement input (string-keyed, JSON-friendly).

### `Placement`

```ts
interface Placement {
  readonly startRow: number
  readonly startCol: number
  readonly direction: Direction
  readonly tiles: readonly PlacementTile[]
}
```

The `tiles` array can include "filler" entries that match an existing letter on the board — those don't consume rack tiles. Example: KOT extending to KOTLET, the placement of KOTLET starting at the K's column lists `[K, O, T, L, E, T]` even though K, O, T are already on the board.

### `TileSpec`, `AlphabetSpec`, `Alphabet`

See [Alphabets](#alphabets).

### `PremiumSquare`, `BoardLayout`

```ts
interface PremiumSquare {
  readonly row: number
  readonly col: number
  readonly kind: PremiumKind
}
interface BoardLayout {
  readonly size: number
  readonly premiums: readonly PremiumSquare[]
  readonly centerStart?: { readonly row: number; readonly col: number }
}
```

### `RuleSet`

```ts
interface RuleSet {
  readonly rackSize: number
  readonly bingoBonus: number
  readonly bingoSize: number
  readonly mustCoverCenterFirstMove: boolean
  readonly mustConnectAfterFirst: boolean
  readonly allowDiagonal: false  // reserved; always false in v0.1.0
}
```

### `Dictionary`

```ts
interface Dictionary {
  has(word: string): boolean
  hasPrefix(prefix: string): boolean
  sample?(opts: { minLength: number; maxLength: number; count: number }): readonly string[]
}
```

`hasPrefix` is required (mandatory for solver pruning); a backend that doesn't index prefixes can return `true` always (slow path).

### `ValidationReason`

```ts
type ValidationReason =
  | 'empty-placement'
  | 'out-of-bounds'
  | 'has-gap'
  | 'overlaps-existing-different-letter'
  | 'first-move-not-on-center'
  | 'not-connected'
  | 'rack-mismatch'
  | 'word-not-in-dictionary'
  | 'crossword-not-in-dictionary'
```

### `ValidationResult`

```ts
interface ValidationResult {
  readonly valid: boolean
  readonly reason?: ValidationReason
  readonly invalidWords?: readonly string[]   // for dictionary failures
}
```

### `FormedWord`, `ScoreBreakdown`

```ts
interface FormedWord {
  readonly word: string
  readonly score: number
  readonly cells: readonly {
    readonly row: number
    readonly col: number
    readonly letter: string
    readonly fromRack: boolean   // true for newly placed tiles
    readonly isBlank: boolean
  }[]
}
interface ScoreBreakdown {
  readonly total: number
  readonly bingo: boolean
  readonly words: readonly FormedWord[]
}
```

### `SolverOptions`, `Anchor`

```ts
interface SolverOptions {
  readonly limit?: number
  readonly sortBy?: 'score' | 'length' | 'none'
  readonly minWordLength?: number
  readonly maxWordLength?: number
}
interface Anchor {
  readonly row: number
  readonly col: number
}
```

### `GeneratorOptions`, `GeneratedMove`, `GeneratedBoard`

```ts
interface GeneratorOptions {
  readonly moves?: number
  readonly topPercentile?: number
  readonly rackSize?: number
  readonly finalRack?: 'fresh-draw' | 'last-rack'
}
interface GeneratedMove {
  readonly placement: Placement
  readonly score: number
  readonly word: string   // the main word formed
}
interface GeneratedBoard {
  readonly board: Board
  readonly bag: Bag
  readonly rack: Rack
  readonly movesPlayed: readonly GeneratedMove[]
}
```

### `SerializedBoard`

```ts
interface SerializedBoard {
  readonly size: number
  readonly cells: readonly (PlacedTile | null)[]   // row-major
}
```

### `EngineConfig`, `BingoEngine`

See [Engine factory](#engine-factory) and [BingoEngine instance methods](#bingoengine-instance-methods).

### `ValidatorContext`, `ScorerContext`, `SolverContext`, `GeneratorContext`

Shape of the `ctx` parameter for the corresponding standalone functions. Each is a subset of `EngineConfig`:

| Type | Fields |
|---|---|
| `ValidatorContext` | `alphabet`, `layout`, `rules`, `dictionary` |
| `ScorerContext` | `alphabet`, `layout`, `rules` |
| `SolverContext` | `alphabet`, `layout`, `rules`, `dictionary` |
| `GeneratorContext` | `alphabet`, `layout`, `rules`, `dictionary`, `random?` |
