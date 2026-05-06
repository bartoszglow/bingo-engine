# `@bglowacki/bingo-engine` — projekt biblioteki Scrabble (osobne repo, TDD, izomorficzny)

## Context

Aplikacja Bingo! (Polski Scrabble tournament app) potrzebuje rodziny konkurencji opartych o pełną planszę 15×15 + wspólny rack 7 liter. Pierwsza konkurencja: znajdź najlepsze słowo. Kolejne (najdłuższe / na czas / max punkty) bazują na tym samym silniku.

Decyzja użytkownika: **silnik powstaje od razu jako osobne repozytorium** w `~/Projects/bingo-engine/`, docelowo publikowane jako `@bglowacki/bingo-engine` na npm. Aplikacja Bingo konsumuje go w dev przez `npm link` (lub `file:` install), w prod przez `npm install` z npm registry.

Wymagania kluczowe:

- **Niezależny od aplikacji Bingo** — zero importów z aplikacji, zero wiedzy o Mongo/tRPC.
- **Dictionary-injected** — caller dostarcza słownik przy inicjalizacji silnika.
- **Oddzielony od UI** — czysta warstwa logiczna, żadnego renderowania.
- **Uniwersalny** — alfabet z punktami parametryzowany, layout planszy konfigurowalny, reguły tunable. Pierwsze targety: polski + angielski.
- **Izomorficzny** — działa na Node.js (backend tRPC) i w przeglądarce (React + Web Worker).
- **Szeroka funkcjonalność** — generowanie plansz, walidacja ruchu, scoring, solver. Pod kolejne konkurencje (longest / time / max-points) silnik daje wszystko, czego potrzebują.
- **Częściowy TDD** — validator/scorer/solver: testy przed kodem. Generator + helpers: testy w tym samym PR.
- **Open-source ready** — repo gotowe do publish (LICENSE, README, CHANGELOG, CI), aspiracja udostępnienia community.

Werdykt z researchu (potwierdzający self-build): w ekosystemie JS/TS **nie ma** open-source biblioteki spełniającej nasze kryteria (multi-alphabet validator + scorer + generator, MIT/Apache, utrzymywana, npm-instalowalna). Quackle/Macondo to GPLv3 (out), wolges-wasm wymagałby autorskiego polskiego alfabetu i nieudokumentowanego WASM API, kamilmielnik/scrabble-solver jest CC BY-NC-ND. Buduje się od zera ~1170 LOC produkcji + ~1100 LOC testów. Dziedzina dobrze opisana (Appel/Jacobson 1988, Woogles BestBot blog), więc nie szukamy innowacji algorytmicznej — tylko dobrego API i ostrego kontraktu testowego.

---

## Comparative analysis — jak inne silniki Scrabble parametryzują alfabet i layout

| Silnik | Język | License | Tile shape | Lookup score/count | Mutability | Digraphs | Source alfabetu | Blank |
|---|---|---|---|---|---|---|---|---|
| **Quackle** | C++ | GPLv3 (post-0.93) | `vector<LetterParameter>` indexed by `uint8` | array O(1) + string→idx map | runtime mutable | yes (longest-match encode) | text file `data/alphabets/*.quackle_alphabet` | sentinel `1`, blanked-letter `L+55` |
| **Macondo** | Go | GPLv3 | `[MaxSize]string` + `map[string]ML` | array O(1) score, map for parse | load-once cache | yes (`maxTileLength` for Catalan `L·L`) | CSV file | ML `0` + high-bit `\|0x80` |
| **wolges** | Rust | MIT | `Vec<Tile>` indexed by `u8`, frozen | array O(1), branchless mask | static | yes + aliases | text file `alphabets/<lang>.txt` | index `0` + high-bit `\|0x80` |
| **kamilmielnik/scrabble-solver** | TS | CC BY-NC-ND (non-commercial) | `TileConfig[]` + `Record<string,number>` | hash O(1) | per-config immutable | yes (`twoCharacterTiles`) | TS literal | top-level `blankScore`/`blanksCount` + `Tile.isBlank` |

**Co kopiujemy w naszym TS engine:**
1. **Dual layer (Macondo/wolges/Quackle):** `TileId` (small int, 0=blank) + `TileLabel` (string). Solver hot-path indeksuje typed-array przez ID; string hash tylko przy parse/serialize. Powód: solver robi 10⁵–10⁶ lookupów per board — string keying jest 3–5× wolniejsze niż array indexing.
2. **Blank = ID 0 + flag bit `0x80`** (Macondo/wolges). Jeden bajt koduje "is blank" + "represented letter". Score: `(t & BLANK_FLAG) ? 0 : scores[t]` — branchless.
3. **Frozen config** (wolges/scrabble-solver). Alfabet nigdy nie zmienia się w runtime → `Object.freeze` + `readonly` TS. JIT inline'uje.
4. **Vowel bit** (wszyscy). Tani precompute użyteczny dla solver heuristics i rack analysis.
5. **Factory + literal data exports** (scrabble-solver). Public API: `defineAlphabet({ tiles: [...] })` zwraca frozen Alphabet. Polish alphabet to plik z literałem TS, nie class.

**Co skipujemy w v1:**
- Digraphs (Welsh/Spanish/Catalan multi-codepoint tiles). Polski + angielski nie potrzebują. Projektujemy API z polem `multiCharLabels?: string[]` zarezerwowanym ale nie implementujemy parsera.
- wolges' `same_score_tile_bits` i pre-scaled equity — micro-opty pod GADDAG-builder.
- Quackle longest-match encoder — jw. nie potrzebujemy multi-char labels.
- Macondo's `maxTileLength` — nie do digraphów teraz.

---

## Polskie dane Scrabble (zweryfikowane PFS / Wikipedia)

**Distribution (100 płytek, 2 blanki):**
- 1pt: A×9, E×7, I×8, N×5, O×6, R×4, S×4, W×4, Z×5
- 2pt: C×3, D×3, K×3, L×3, M×3, P×3, T×3, **Y×4**
- 3pt: B×2, G×2, H×2, J×2, Ł×2, U×2
- 5pt: Ą, Ę, F, Ó, Ś, Ż (×1 each)
- 6pt: Ć ×1
- 7pt: Ń ×1
- 9pt: Ź ×1

**Layout** = ten sam co angielski Scrabble: 8 TWS, 17 DWS (z centrum), 12 TLS, 24 DLS. Center `[7,7]` jest DWS (centrum gry). Literaki używają innego layoutu — out of scope dla v1.

---

## Decyzje projektowe (zafiksowane)

1. **Lokalizacja: `~/Projects/bingo-engine/` jako osobne git repo** od dnia 1. Aplikacja Bingo (`~/Projects/bingo/`) konsumuje:
   - **Dev**: `npm link @bglowacki/bingo-engine` (lokalny symlink) lub `"@bglowacki/bingo-engine": "file:../bingo-engine"` w package.json — szybsza iteracja niż publish za każdą zmianą.
   - **Prod**: `npm install @bglowacki/bingo-engine` z npm registry po publishu.
2. **Nazwa npm**: `@bglowacki/bingo-engine` (scoped pod konto użytkownika `bglowacki` na npm). Scope chroni przed name conflicts i daje publish-kontrolę.
3. **Izomorficzny build**: tsup `platform: 'neutral'` → wynik działa w Node.js (backend tRPC), w przeglądarce (React component, Web Worker), w skryptach CLI (`tsx`). Egzekwujemy izomorficzność:
   - tsconfig: `lib: ["ES2022"]` (bez `dom`, bez `node`), `types: []` (kasuje `@types/node` mimo hoist).
   - ESLint: `no-restricted-imports` (banuje `node:*`, `fs`, `path`, `child_process`), `no-restricted-globals` (banuje `window`, `document`, `process`, `Buffer`, `localStorage`).
4. **Zero runtime dependencies.** Tylko `devDependencies`. `peerDependencies: {}`. Cecha sprzedażowa: "zero-dep, isomorphic, framework-agnostic". Crypto zawsze przez `globalThis.crypto.subtle` (Node 20+ i wszystkie browsery).
5. **TypeScript-first**, ESM + CJS dual publish (Next.js 15 ESM-friendly, ale CJS zachowujemy dla `tsx` skryptów + przyszłych konsumentów).
6. **Dictionary injected** — silnik nigdy nie ładuje słownika sam. Caller buduje `Dictionary` (in-memory Set, trie, Mongo+cache — jego sprawa) i przekazuje przy `createBingoEngine`. Silnik eksportuje gotowe helpery `buildSetDictionary` / `buildTrieDictionary`.
7. **Sync dictionary API w hot-pathach** — solver/walidator robią setki/tysiące lookupów na ruch. Async w solverze nie do przyjęcia perf-owo. Caller MUSI dostarczyć synchroniczny `has`/`hasPrefix`. Async warstwa (Mongo) musi być prewarmowana przez aplikację przed wywołaniem silnika.
8. **Konfigurowalne alfabety przez `defineAlphabet({tiles:[...], blankCount, blankScore})`** — public API ergonomiczne (jak scrabble-solver), wewnętrzna reprezentacja typed-array (jak Macondo/wolges).
9. **Konfigurowalne reguły** — premia pól (DLS/TLS/DWS/TWS) on/off, bingo bonus on/off + wartość, rack size, must-cover-center, must-connect-after-first.
10. **Determinizm** — engine przyjmuje `random: () => number`. Default `Math.random`, w testach mulberry32 seedowany. Eksportujemy `seededRng(seed)` publicznie — pozwala konsumentom (np. testom aplikacji) odtwarzać plansze.
11. **Polskie znaki** — iteracja przez `Array.from(s)` lub `for...of`, lowercase przez `.toLocaleLowerCase('pl-PL')`. Brak indeksowania `s[i]`. Locale w `Alphabet.locale`.
12. **Częściowy TDD** — validator/scorer/solver: testy PRZED kodem. Generator + helpers: testy w tym samym PR. Coverage gate ≥85% na critical paths.
13. **`data/scrabble-osps-test.txt`** (pełny OSPS dla testów aplikacji) NIE należy do silnika — zostaje w `data/` aplikacji Bingo. Silnik testuje się własnymi mini-słownikami (`tiny-dictionary.ts` ~50 słów + `polish-mini.ts` ~5000 najczęstszych).

---

## Final public API (`src/index.ts`)

```ts
// ---- Konstrukcja ----
export interface EngineConfig {
  alphabet: Alphabet;
  layout: BoardLayout;
  rules: RuleSet;
  dictionary: Dictionary;
  random?: () => number;
}

export function createBingoEngine(config: EngineConfig): BingoEngine;

// ---- Główny obiekt ----
export interface BingoEngine {
  // Stan początkowy
  emptyBoard(): Board;
  freshBag(): Bag;
  drawTiles(bag: Bag, count: number): { drawn: Tile[]; bag: Bag };

  // Walidacja i scoring jednego ruchu
  validatePlacement(board: Board, placement: Placement, rack: Rack): ValidationResult;
  scorePlacement(board: Board, placement: Placement): ScoreBreakdown;
  applyPlacement(board: Board, placement: Placement): Board;

  // Solver — wszystkie legalne ruchy z danego rack-a
  findAllPlacements(board: Board, rack: Rack, opts?: SolverOptions): Placement[];

  // Generator pozycji — greedy self-play
  generateBoard(opts?: GeneratorOptions): GeneratedBoard;

  // Helpers
  placementsToWords(board: Board, placement: Placement): FormedWord[];
  serializeBoard(board: Board): SerializedBoard;
  deserializeBoard(data: SerializedBoard): Board;
}

// ---- Alfabet (factory + frozen output) ----
export interface TileSpec {
  label: string;          // 'a', 'ą', 'ł'
  score: number;
  count: number;
  isVowel?: boolean;
  multiCharLabels?: string[];   // zarezerwowane na v2 (digraphs); ignorowane w v1
}

export interface Alphabet {
  readonly id: string;                                          // 'pl-PL', 'en-US'
  readonly size: number;                                        // n+1 wraz z blank
  readonly labels: readonly string[];                           // labels[0]='?', labels[1..n]=litery
  readonly scores: Int8Array;                                   // scores[id] (blank=0)
  readonly counts: Uint8Array;                                  // counts[id] (counts[0]=blankCount)
  readonly vowelMask: bigint;                                   // bit i ustawiony jeśli tile i to samogłoska
  readonly labelToId: ReadonlyMap<string, TileId>;              // tylko parse/serialize
  readonly locale?: string;                                     // 'pl-PL' do toLocaleLowerCase
}

export function defineAlphabet(spec: {
  id: string;
  tiles: TileSpec[];
  blankCount: number;
  blankScore?: number;        // default 0
  locale?: string;
}): Alphabet;                  // build typed arrays, Object.freeze

export type TileId = number;   // 0 = blank, 1..n = litery
export const BLANK: TileId;
export const BLANK_FLAG: number;  // 0x80 — OR'd na blank-played-as-letter

// Inline solver hot-path helpers
export const tileScore: (a: Alphabet, t: TileId) => number;     // (t & BLANK_FLAG) ? 0 : a.scores[t]
export const isBlanked: (t: TileId) => boolean;
export const unblank:   (t: TileId) => TileId;

// Pre-built alfabety
export const POLISH_ALPHABET: Alphabet;
export const ENGLISH_ALPHABET: Alphabet;

// ---- Plansza ----
export interface BoardLayout {
  size: number;          // 15 dla klasyka
  premiums: ReadonlyArray<{ row: number; col: number; kind: 'DLS' | 'TLS' | 'DWS' | 'TWS' }>;
  centerStart?: { row: number; col: number };
}
export const SCRABBLE_LAYOUT_15X15: BoardLayout;
export const SIMPLE_LAYOUT_15X15: BoardLayout;          // bez premii

// ---- Reguły ----
export interface RuleSet {
  rackSize: number;            // 7
  bingoBonus: number;          // 50 (0 = off)
  bingoSize: number;           // 7
  mustCoverCenterFirstMove: boolean;
  mustConnectAfterFirst: boolean;
  allowDiagonal: false;        // zarezerwowane
}
export const SCRABBLE_CLASSIC_RULES: RuleSet;
export const SCRABBLE_NO_PREMIUMS_RULES: RuleSet;

// ---- Słownik ----
export interface Dictionary {
  has(word: string): boolean;
  hasPrefix(prefix: string): boolean;
  sample?(opts: { minLength: number; maxLength: number; count: number }): string[];
}
export function buildSetDictionary(words: Iterable<string>): Dictionary;     // O(1) has, hasPrefix → true (slow path)
export function buildTrieDictionary(words: Iterable<string>): Dictionary;    // O(L) hasPrefix dla solvera

// ---- Stany gry (immutable) ----
export interface PlacementTile { letter: string; isBlank: boolean; }      // public API używa stringów
export interface Tile { tileId: TileId; }                                 // internal, ale wystawiony dla power users

export type Cell = Tile | null;
export type Board = readonly (readonly Cell[])[];
export type Rack = readonly Tile[];
export type Bag = readonly Tile[];

export interface Placement {
  startRow: number;
  startCol: number;
  direction: 'horizontal' | 'vertical';
  tiles: ReadonlyArray<PlacementTile>;       // factory engine konwertuje label→TileId wewnętrznie
}

// ---- Wyniki ----
export interface ValidationResult {
  valid: boolean;
  reason?:
    | 'out-of-bounds' | 'overlaps-existing-different-letter' | 'rack-mismatch'
    | 'not-connected' | 'first-move-not-on-center' | 'has-gap'
    | 'word-not-in-dictionary' | 'crossword-not-in-dictionary' | 'empty-placement';
  invalidWords?: string[];
}
export interface ScoreBreakdown {
  total: number;
  bingo: boolean;
  words: ReadonlyArray<FormedWord>;
}
export interface FormedWord {
  word: string;
  score: number;
  cells: ReadonlyArray<{ row: number; col: number; letter: string; fromRack: boolean; isBlank: boolean }>;
}
export interface SolverOptions {
  limit?: number; sortBy?: 'score' | 'length' | 'none';
  minWordLength?: number; maxWordLength?: number;
}
export interface GeneratorOptions {
  moves?: number;                        // default 10
  topPercentile?: number;                // 0.30
  rackSize?: number;
  finalRack?: 'fresh-draw' | 'last-rack';
}
export interface GeneratedBoard {
  board: Board; bag: Bag; rack: Rack;
  movesPlayed: ReadonlyArray<{ placement: Placement; score: number; word: string }>;
}

// ---- Random ----
export function seededRng(seed: number): () => number;   // mulberry32

// ---- Helpery konwersji (dla power users) ----
export function tileIdToLetter(alphabet: Alphabet, tileId: TileId): string;
export function letterToTileId(alphabet: Alphabet, letter: string): TileId | undefined;
```

**Public API używa stringowych labels w `Placement` i `PlacementTile` (consumers nie operują na ID-kach na hot pathach UI).** Factory konwertuje label→TileId przy walidacji/scoringu — solver i hot-path wewnątrz silnika działają na ID. Helpery `tileIdToLetter`/`letterToTileId` są eksportowane dla power users (np. ktoś chce zbudować custom solver). Kompromis: ergonomia dla aplikacji, perf wewnątrz silnika.

---

## Struktura repo `~/Projects/bingo-engine/`

```
bingo-engine/
├── package.json              # name: "@bglowacki/bingo-engine"
├── tsconfig.json             # composite: false (osobne repo, nie monorepo)
├── tsconfig.build.json       # opcjonalnie pod produkcyjny build
├── tsup.config.ts            # platform: 'neutral', dual ESM+CJS+.d.ts
├── vitest.config.ts          # coverage thresholds
├── eslint.config.mjs         # no-restricted-imports/globals enforcement
├── .gitignore                # node_modules, dist, coverage, .changeset/temp
├── .npmignore                # NIE commitujemy src/ do npm (tylko dist/)
├── .nvmrc                    # 20 (Node minimum)
├── README.md                 # funkcjonalny opis projektu (od dnia 1, ready do publishu)
├── docs/
│   └── PLAN.md               # cała wiedza projektowa, comparative analysis, design decisions
├── LICENSE                   # MIT
├── CHANGELOG.md              # changesets-managed
├── CONTRIBUTING.md           # dla future contributorów
├── .changeset/               # changesets configi
│   └── config.json
├── .github/
│   └── workflows/
│       ├── ci.yml            # lint + typecheck + test + build na każdym PR
│       └── release.yml       # changesets-publish na main
├── src/
│   ├── index.ts              # public API re-exports
│   ├── types.ts              # publiczne typy + JSDoc
│   ├── alphabet/
│   │   ├── index.ts          # defineAlphabet, helpers
│   │   ├── alphabet.ts       # build typed arrays, Object.freeze
│   │   ├── polish.ts         # POLISH_ALPHABET (literal data)
│   │   └── english.ts        # ENGLISH_ALPHABET
│   ├── board/
│   │   ├── board.ts          # Board ops: clone, get/set, isEmpty, neighbors
│   │   ├── layout.ts         # premium-square layouts (literal data)
│   │   └── coords.ts         # row/col helpers, direction enum
│   ├── rack/
│   │   ├── rack.ts           # Rack/Bag operations
│   │   └── tile.ts           # Tile helpers, blank handling
│   ├── placement/
│   │   └── placement.ts      # Placement type + canonicalization
│   ├── validator/
│   │   ├── validator.ts      # validatePlacement
│   │   └── crosswords.ts     # extractCrosswords helper
│   ├── scorer/
│   │   ├── scorer.ts         # scorePlacement z premiami + bingo
│   │   └── premiums.ts       # apply premium multipliers
│   ├── solver/
│   │   ├── solver.ts         # findAllPlacements
│   │   ├── anchors.ts        # generuj anchor cells
│   │   └── enumerate.ts      # DFS enumeracja słów z trie + rack
│   ├── generator/
│   │   └── generator.ts      # greedy self-play
│   ├── dictionary/
│   │   ├── dictionary.ts     # Dictionary interface + base classes
│   │   ├── set-backend.ts    # buildSetDictionary
│   │   └── trie-backend.ts   # buildTrieDictionary
│   ├── rules/
│   │   ├── rules.ts          # RuleSet helpers
│   │   └── presets.ts        # SCRABBLE_CLASSIC_RULES etc.
│   ├── serialize/
│   │   └── board.ts          # serialize/deserialize do JSON
│   └── random/
│       └── seeded.ts         # mulberry32
└── __tests__/
    ├── alphabet.test.ts
    ├── board.test.ts
    ├── rack.test.ts
    ├── dictionary.test.ts
    ├── validator.test.ts
    ├── scorer.test.ts
    ├── solver.test.ts
    ├── generator.test.ts
    ├── serialize.test.ts
    ├── e2e.test.ts
    └── fixtures/
        ├── boards.ts          # parseAsciiBoard helper
        ├── tiny-dictionary.ts # ~50 słów do edge case'ów
        └── polish-mini.ts     # ~5000 słów PL do property tests (~50KB)
```

---

## Bootstrap procedura — co robimy po ExitPlanMode

**Wszystko poza krokiem 0 wykonujemy w katalogu `~/Projects/bingo-engine/` (osobne repo, NIE wewnątrz `~/Projects/bingo/`).**

### Krok 0 — Utworzenie folderu i git init

```bash
mkdir -p ~/Projects/bingo-engine
cd ~/Projects/bingo-engine
git init -b main
```

### Krok 1 — `package.json`

```json
{
  "name": "@bglowacki/bingo-engine",
  "version": "0.0.1",
  "description": "Isomorphic, dictionary-injected, multi-language Scrabble engine: validator, scorer, solver, board generator. Zero runtime deps, ESM+CJS, TypeScript.",
  "license": "MIT",
  "author": "Bartosz Głowacki <bartosz.glow@gmail.com>",
  "type": "module",
  "sideEffects": false,
  "engines": { "node": ">=20" },
  "files": ["dist", "README.md", "LICENSE", "CHANGELOG.md"],
  "exports": {
    ".":           { "types": "./dist/index.d.ts",          "import": "./dist/index.js",          "require": "./dist/index.cjs" },
    "./alphabet":  { "types": "./dist/alphabet/index.d.ts", "import": "./dist/alphabet/index.js", "require": "./dist/alphabet/index.cjs" },
    "./solver":    { "types": "./dist/solver/index.d.ts",   "import": "./dist/solver/index.js",   "require": "./dist/solver/index.cjs" },
    "./generator": { "types": "./dist/generator/index.d.ts","import": "./dist/generator/index.js","require": "./dist/generator/index.cjs" },
    "./package.json": "./package.json"
  },
  "main":   "./dist/index.cjs",
  "module": "./dist/index.js",
  "types":  "./dist/index.d.ts",
  "scripts": {
    "build":          "tsup",
    "dev":            "tsup --watch",
    "typecheck":      "tsc --noEmit",
    "test":           "vitest run",
    "test:watch":     "vitest",
    "test:coverage":  "vitest run --coverage",
    "lint":           "eslint .",
    "lint:pkg":       "publint && attw --pack .",
    "format":         "prettier --write .",
    "prepublishOnly": "npm run typecheck && npm run lint && npm run test && npm run build && npm run lint:pkg",
    "release":        "changeset publish",
    "version":        "changeset version"
  },
  "keywords": ["scrabble", "engine", "polish", "english", "validator", "solver", "isomorphic", "typescript", "literaki"],
  "repository": { "type": "git", "url": "git+https://github.com/bglowacki/bingo-engine.git" },
  "bugs": { "url": "https://github.com/bglowacki/bingo-engine/issues" },
  "homepage": "https://github.com/bglowacki/bingo-engine#readme",
  "publishConfig": { "access": "public", "provenance": true },
  "devDependencies": {
    "@arethetypeswrong/cli":  "^0.18.0",
    "@changesets/cli":        "^2.27.0",
    "@types/node":            "^22.0.0",
    "@vitest/coverage-v8":    "^3.0.0",
    "@typescript-eslint/eslint-plugin": "^9.0.0",
    "@typescript-eslint/parser":        "^9.0.0",
    "eslint":                 "^9.0.0",
    "fast-check":             "^4.0.0",
    "prettier":               "^3.4.0",
    "publint":                "^0.3.0",
    "tsup":                   "^8.5.0",
    "typescript":             "^6.0.0",
    "vitest":                 "^3.0.0"
  },
  "peerDependencies": {},
  "dependencies": {}
}
```

### Krok 2 — `tsconfig.json`

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "target": "ES2022",
    "lib": ["ES2022"],
    "types": [],
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "isolatedModules": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "rootDir": "src",
    "outDir": "dist",
    "noEmit": true
  },
  "include": ["src", "__tests__"],
  "exclude": ["dist", "node_modules"]
}
```

### Krok 3 — `tsup.config.ts`

```ts
import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index:            "src/index.ts",
    "alphabet/index": "src/alphabet/index.ts",
    "solver/index":   "src/solver/index.ts",
    "generator/index":"src/generator/index.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  target: "es2022",
  platform: "neutral",
  outDir: "dist",
});
```

### Krok 4 — `vitest.config.ts`

```ts
import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      thresholds: {
        "src/validator/**": { lines: 85, branches: 85, functions: 90 },
        "src/scorer/**":    { lines: 85, branches: 85, functions: 90 },
        "src/solver/**":    { lines: 85, branches: 80, functions: 90 },
        "src/**":           { lines: 75, branches: 70, functions: 80 },
      },
    },
  },
});
```

### Krok 5 — `eslint.config.mjs`

```js
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

export default [
  {
    files: ["src/**/*.ts", "__tests__/**/*.ts"],
    languageOptions: { parser: tsparser, parserOptions: { project: true } },
    plugins: { '@typescript-eslint': tseslint },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ["node:*"], message: "Engine must be isomorphic." },
          { group: ["fs", "path", "os", "crypto", "child_process", "stream", "buffer", "util"], message: "Node-only modules are not allowed." },
        ],
      }],
      'no-restricted-globals': ['error',
        'window', 'document', 'navigator', 'localStorage', 'process', 'Buffer', 'global', '__dirname', '__filename',
      ],
    },
  },
  {
    files: ["__tests__/**/*.ts", "*.config.ts"],
    rules: { 'no-restricted-globals': 'off' },  // testy mogą używać process.env
  },
];
```

### Krok 6 — `.gitignore`

```
node_modules/
dist/
coverage/
.DS_Store
*.log
.env
.env.local
.tsbuildinfo
```

### Krok 7 — `.npmignore`

```
src/
__tests__/
.github/
.changeset/
*.config.ts
*.config.mjs
tsconfig*.json
.gitignore
.eslintrc*
PLAN.md
```

(Tylko `files` w package.json publikuje, ale `.npmignore` to defense-in-depth.)

### Krok 8 — `LICENSE` (MIT)

Standard MIT z imieniem Bartosz Głowacki + rok 2026.

### Krok 9 — `README.md` (pełny, ready do publishu)

Tworzymy gotowy README od pierwszego commita — opisuje czym jest paczka, co umie, jak się instaluje i używa, dlaczego powstała.

```markdown
# @bglowacki/bingo-engine

> Isomorphic, dictionary-injected Scrabble engine for TypeScript.
> Validator, scorer, solver, and board generator — multi-language, zero runtime dependencies.

[![npm](https://img.shields.io/npm/v/@bglowacki/bingo-engine.svg)](https://www.npmjs.com/package/@bglowacki/bingo-engine)
[![CI](https://github.com/bglowacki/bingo-engine/actions/workflows/ci.yml/badge.svg)](https://github.com/bglowacki/bingo-engine/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## What it does

A complete logic layer for Scrabble-like games:

- **Validate** a tile placement on a board (connectivity, dictionary lookup, gaps, multi-word formation).
- **Score** placements with full premium-square (DLS/TLS/DWS/TWS) and bingo-bonus support.
- **Solve** — enumerate every legal move from a given rack on a given board (Appel-Jacobson anchor algorithm).
- **Generate** plausible mid-game board positions via greedy self-play (configurable randomness).
- **Pluggable alphabets** — Polish (OSPS) and English (TWL) bundled; define your own with `defineAlphabet`.
- **Pluggable dictionaries** — bring your own data source. Set-based, trie-based, or custom backend.
- **Pluggable rules** — premium squares on/off, bingo bonus, rack size, center start, all configurable.

## Why it exists

There's no MIT-licensed, isomorphic, multi-language Scrabble engine on npm. Quackle and Macondo are GPLv3 (incompatible with closed source). wolges-wasm is MIT but lacks Polish out of the box and has minimal docs. kamilmielnik/scrabble-solver is CC BY-NC-ND (non-commercial only). This library fills the gap with a TypeScript-first, zero-dependency, framework-agnostic API.

## Install

\`\`\`bash
npm i @bglowacki/bingo-engine
\`\`\`

Requires Node.js ≥ 20 or any modern browser.

## Quick start

\`\`\`ts
import {
  createBingoEngine,
  POLISH_ALPHABET,
  SCRABBLE_LAYOUT_15X15,
  SCRABBLE_CLASSIC_RULES,
  buildTrieDictionary,
  seededRng,
} from '@bglowacki/bingo-engine';

const dictionary = buildTrieDictionary(['kot', 'kotek', 'pies', 'auto', /* … */]);

const engine = createBingoEngine({
  alphabet: POLISH_ALPHABET,
  layout:   SCRABBLE_LAYOUT_15X15,
  rules:    SCRABBLE_CLASSIC_RULES,
  dictionary,
  random:   seededRng(42),
});

// Generate a believable mid-game position
const { board, rack } = engine.generateBoard({ moves: 10 });

// Validate a player's move
const result = engine.validatePlacement(board, {
  startRow: 7, startCol: 5, direction: 'horizontal',
  tiles: [{ letter: 'k', isBlank: false }, { letter: 'o', isBlank: false }, { letter: 't', isBlank: false }],
}, rack);

if (result.valid) {
  const score = engine.scorePlacement(board, placement);
  console.log(\`Scored \${score.total} points\`);
}
\`\`\`

## Custom alphabet

\`\`\`ts
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
\`\`\`

## API reference

See [docs/](./docs) for the full API documentation, design rationale, and comparative analysis vs. Quackle / Macondo / wolges / scrabble-solver.

## Status

Pre-1.0 — API may change before `1.0.0`. Follow [CHANGELOG.md](./CHANGELOG.md) for breaking changes.

## License

MIT © Bartosz Głowacki
```

### Krok 10 — `.changeset/config.json`

```json
{
  "$schema": "https://unpkg.com/@changesets/config@3.0.0/schema.json",
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "fixed": [],
  "linked": [],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": []
}
```

### Krok 11 — `.github/workflows/ci.yml`

```yaml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: 'npm' }
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run test:coverage
      - run: npm run build
      - run: npm run lint:pkg
```

### Krok 12 — `.github/workflows/release.yml`

```yaml
name: Release
on: { push: { branches: [main] } }
permissions: { contents: write, id-token: write, pull-requests: write }
jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: 'npm', registry-url: 'https://registry.npmjs.org' }
      - run: npm ci
      - run: npm run build
      - uses: changesets/action@v1
        with:
          publish: npm run release
          version: npm run version
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### Krok 13 — Pierwsza instalacja + sanity check

```bash
npm install
npx tsc --noEmit         # bez kodu — sprawdzenie configu
npx eslint .             # sprawdzenie configu
git add -A
git commit -m "chore: bootstrap repo (package.json, tsconfig, tsup, vitest, eslint, CI)"
```

### Krok 14 — `docs/PLAN.md`

Tworzymy folder `docs/` i kopiujemy aktualny plan jako żywy projektowy artefakt (cała wiedza zgromadzona dotychczas: comparative analysis, Polish data, design decisions, algorithms, TDD plan, bootstrap procedure).

```bash
mkdir -p docs
cp /Users/bartoszglowacki/.claude/plans/kolega-przetestowa-aplikacj-i-streamed-aurora.md docs/PLAN.md
git add docs/PLAN.md
git commit -m "docs: add docs/PLAN.md with full design + research notes"
```

### Krok 15 — Utworzenie prywatnego repo na GitHub

Wymaga `gh` CLI uwierzytelnionego pod kontem GitHub Bartosza (uwierzytelnienie zostało zrobione w poprzednim taska — `gh auth login`).

```bash
cd ~/Projects/bingo-engine
gh repo create bingo-engine --private --source=. --remote=origin --push --description "Isomorphic, dictionary-injected Scrabble engine for TypeScript"
```

Powinien wykonać: utworzenie prywatnego repo `<github-user>/bingo-engine`, dodać remote `origin`, pushnąć branch `main`.

Sanity check po stworzeniu:
```bash
gh repo view --web    # otwiera repo w przeglądarce
git remote -v         # potwierdza origin
git push -u origin main
```

### Krok 16 — Krótka notka w aplikacji Bingo

W repo `~/Projects/bingo/` dodajemy jednolinijkową notkę w `CLAUDE.md`, że docelowo do silnika Scrabble używamy `@bglowacki/bingo-engine` (osobne repo `~/Projects/bingo-engine/`). NIE migrujemy żadnego kodu w tym kroku — to jest oddzielny task po dostarczeniu silnika.

```bash
cd ~/Projects/bingo
# Edycja CLAUDE.md: w sekcji "Decisions already locked" dodać linię:
# "- **Scrabble board engine**: silnik wyniesiony do osobnego repo `~/Projects/bingo-engine/` (npm: `@bglowacki/bingo-engine`). Integracja z `GameModule` jest oddzielnym taskiem po dostarczeniu v0.1.0 silnika."
git add CLAUDE.md
git commit -m "docs: note that Scrabble board logic lives in @bglowacki/bingo-engine repo"
```

### Krok 17 — Implementacja idzie zgodnie z planem implementacji niżej.

---

## Algorytmy (krytyczne ścieżki)

### Walidator (`validator/validator.ts`)
1. Granice: każda nowa płytka w `[0, size)`.
2. Linearność: wszystkie nowe w jednym wierszu LUB jednej kolumnie.
3. Brak luk: między min a max indeksem nowych — każda komórka albo nowa płytka, albo istniejąca litera.
4. Brak konfliktów: nowa płytka nie nadpisuje istniejącej innej litery.
5. Connectivity (jeśli `mustConnectAfterFirst` i nie pierwszy ruch): co najmniej jedna nowa płytka sąsiaduje (4-kierunkowo) z istniejącą.
6. Pierwszy ruch: jeśli `mustCoverCenterFirstMove` i board pusty — placement musi pokrywać `layout.centerStart`.
7. Rack feasibility: multiset nowych liter ⊆ multiset rack-a (z obsługą blanków: blank pasuje do dowolnej litery, value=0).
8. Słownik: główne słowo + każde crossword utworzone przez nową płytkę → `dictionary.has`. Lista nieprawidłowych słów w `invalidWords`.

### Scorer (`scorer/scorer.ts`)
- Dla każdego utworzonego słowa: suma `(tileScore × letterPremium) × wordPremium`.
- Premie z planszy liczą się TYLKO dla nowo postawionych płytek tej tury (premie używane wcześniej są nieaktywne).
- Blank ma value 0 (z `tileScore` mask) niezależnie od litery którą reprezentuje.
- Bingo: `placement.tiles.length === rules.bingoSize` → +`rules.bingoBonus`.

### Solver (`solver/solver.ts`) — anchor-based, klasyczny Appel-Jacobson 1988
- **Anchors**: na niepustym boardzie — każda pusta komórka sąsiadująca z istniejącą literą. Na pustym — tylko `layout.centerStart`.
- Dla każdego anchor + każdy kierunek (h/v): generuj słowa schodząc DFS-em po trie, z pruning przez `hasPrefix`.
- **Cross-checks** (Appel-Jacobson optimization): dla każdej pustej komórki precompute set liter, które tworzą valid crossword w prostopadłym kierunku. To pozwala odrzucić placementy bez sprawdzania słownika dla każdej krzyżówki — tylko jednorazowy bitset lookup.
- Każde dotknięcie liścia trie + crossword bitset valid → emit Placement.
- `Dictionary.hasPrefix` mandatory; backend `Set` daje `() => true` (slow fallback z ostrzeżeniem w docstring).

### Generator (`generator/generator.ts`) — greedy self-play
1. `board = emptyBoard()`, `bag = freshBag()`, `rack = drawTiles(bag, 7)`.
2. Pętla `n = 0..moves`:
   a. `placements = findAllPlacements(...)` posortowane po score.
   b. Pusto → wymień rack (zwróć do bag, dobierz nowy). Dwie wymiany pod rząd → break.
   c. Wybierz losowo z top-`opts.topPercentile`% (default 30%).
   d. Apply, dobierz brakujące płytki z bag.
3. Zwróć `{ board, bag, rack, movesPlayed }`.

Top-30% randomization to konkretna rekomendacja z Woogles BestBot — czysto chciwe boardy wyglądają sztucznie ("AI gra sam ze sobą"); ten poziom losowości daje pozycje nie do odróżnienia od amatorskiej gry ludzkiej.

---

## Strategia testowa — częściowy TDD

| Moduł | Tryb | Powód |
|---|---|---|
| `validator/` | **TDD-first** | API i reason-codes są kontraktem. Każdy `reason` = co najmniej 1 czerwony test przed kodem. |
| `scorer/` | **TDD-first** | Wartości matematyczne, deterministyczne. Każdy typ premii + bingo = jeden czerwony test. |
| `solver/` | **TDD-first dla correctness, test-after dla optymalizacji** | Kontrakt: "dla rack X i boardu Y zwróć dokładnie zbiór Z". Pruning dopisujemy z testami regresyjnymi. |
| `generator/` | **Test-after** | Output stochastyczny. Testy oparte o invariants (każdy ruch waliduje się), nie konkretne wartości. |
| `alphabet/`, `board/`, `rack/`, `placement/`, `dictionary/`, `serialize/`, `random/` | **Test-after w tym samym PR** | Mechanika; przewidywalność niska, ale zakres mały. Test musi istnieć przed mergem. |
| `index.ts` (factory + e2e) | **Test-after** | Sklejka, którą testujemy przez e2e scenariusze. |

### Reguły operacyjne

- **Każdy PR** (prod files + tests) musi mieć ≥1 czerwony test, który po wprowadzeniu kodu zmienił się w zielony. Brak — review odrzuca.
- **Coverage gate**: ≥85% line coverage na `validator/`, `scorer/`, `solver/`. ≥75% na pozostałych. <75% blokuje merge przez CI.
- **Każdy `reason` z `ValidationResult` ma dedykowany test.** Brak testu dla nowego reason-u = błąd review.
- **Każdy bug znaleziony po dostarczeniu silnika rozpoczyna się od czerwonego testu odtwarzającego błąd**, dopiero potem fix.
- **Tabela zachowań (behavioral matrix) dla validatora** w `validator.test.ts` jako data-driven test (`describe.each([...cases])`). Każdy nowy edge case = nowy wiersz tabeli.
- **Snapshot tests dla solvera** dozwolone tylko na małym fixture (≤30 placements) z deterministycznym RNG.
- **Property tests** przez `fast-check` — generator i solver weryfikujemy invariantami nad randomizowanym inputem.

### Kolejność testów per moduł (15+14+8+6 testów najpierw)

#### `validator.test.ts` (15 testów PRZED `validator.ts`)
1. Empty placement → `reason: 'empty-placement'`.
2. Single tile out of bounds → `reason: 'out-of-bounds'`.
3. Linearność z definicji typu `Placement` (sanity check).
4. Gap między nowymi płytkami bez istniejącej w środku → `reason: 'has-gap'`.
5. Gap z istniejącą literą wypełniającą → `valid: true`.
6. Nowa płytka na istniejącej innej literze → `reason: 'overlaps-existing-different-letter'`.
7. Pierwszy ruch nie pokrywający centrum → `reason: 'first-move-not-on-center'`.
8. Drugi ruch izolowany → `reason: 'not-connected'`.
9. Rack nie pokrywa nowych liter → `reason: 'rack-mismatch'`.
10. Blank w rack-u zastępujący zwykłą literę → `valid: true`.
11. Słownik nie zna głównego słowa → `reason: 'word-not-in-dictionary'`, `invalidWords: ['xxx']`.
12. Krzyżówka nie w słowniku → `reason: 'crossword-not-in-dictionary'`, `invalidWords: ['ab']`.
13. Wiele krzyżówek, część niepoprawna → `invalidWords` zawiera wszystkie złe.
14. Polskie znaki: `ą`, `ó`, `ż`, `ź`, `ń`, `ł` — placement i krzyżówki przechodzą lookup poprawnie.
15. Blank reprezentujący polski znak (`ż`) — value=0, słownikowo traktowany jak `ż`.

#### `scorer.test.ts` (14 testów PRZED `scorer.ts`)
16. Pojedyncze słowo bez premii.
17. DLS na nowej płytce — tylko ta płytka × 2.
18. DLS na istniejącej płytce — premium IGNOROWANY (premie liczą się tylko dla nowych).
19. TLS na nowej.
20. DWS — całe słowo × 2.
21. TWS — całe słowo × 3.
22. DWS + TWS w jednym słowie — multipliers się mnożą (×6).
23. DLS + DWS w jednym słowie.
24. Krzyżówka liczona osobno z własnymi premiami.
25. Blank value=0 niezależnie od pozycji.
26. Blank na DWS — ×2 dla 0 = 0 (ale słowo nadal ×2).
27. Bingo — `tiles.length === bingoSize` → +50 do total.
28. Bingo + premia — premia liczy się PRZED bingo; bingo dolicza się raz na końcu.
29. `bingoBonus: 0` → bingo nie dodaje nic.

#### `solver.test.ts` (8 correctness PRZED `solver.ts`)
30. Pusty board, rack `[k,o,t]`, dictionary `{kot}` → znajduje placement `kot` na centrum w obu kierunkach.
31. Pusty board, rack `[k,o,t]`, dictionary `{kot, kto, ok}` → znajduje wszystkie poprawne placementy.
32. Niepusty board z `kot`, rack `[a,r]` → znajduje extensions (wszystkie crossword-valid).
33. Anchor coverage: solver nie próbuje placementów które nie dotykają anchor cell-a.
34. Pruning przez `hasPrefix`: solver z `Set`-backendem (no pruning) i `Trie`-backendem zwracają TEN SAM ZBIÓR placementów; tylko Trie jest <X ms.
35. `limit: 10` → zwraca 10 placementów posortowanych po score.
36. `sortBy: 'length'` → posortowane po długości.
37. Rack z dwoma blankami — solver enumeruje obie pozycje blanków.
+ **Property test** (fast-check, 50 iteracji): dla losowej kombinacji board+rack z `polish-mini` — każdy zwrócony placement przechodzi `validatePlacement === valid`.

#### `generator.test.ts` (test-after, 6 testów)
38. Wygenerowany board (seed=42) jest deterministyczny — snapshot.
39. **Property test (kluczowy)**: 100 iteracji z różnymi seedami → każdy ruch w `movesPlayed` waliduje się jako legalny placement w stanie boardu sprzed niego.
40. Liczba ruchów ≤ `opts.moves`.
41. `topPercentile: 1.0` → wybiera zawsze top score (deterministyczny mimo random).
42. Generator nie wpada w infinite loop gdy rack pusty (bag exhausted) — kończy gracefully.
43. Final rack = ostatni rack po `moves` ruchach (przy `finalRack: 'last-rack'`).

### Fixtures

- `tiny-dictionary.ts` — ~50 słów ręcznie wybranych pokrywających edge case'y. Validator/scorer/solver-correctness.
- `polish-mini.ts` — ~5000 najczęstszych polskich słów. Property tests + perf tests. Commitowany (~50KB).
- `boards.ts` — ASCII helper:
  ```ts
  export const board = parseAsciiBoard(`
    ...............
    ...............
    .......k.......
    .......o.......
    .....pies......
    ...............
  `);
  ```
  Krytyczny dla czytelności testów validatora/solvera.

---

## Plan implementacji (każdy krok = osobny PR z testami)

| # | Krok | Tryb | LOC prod | LOC test |
|---|---|---|---|---|
| 0 | **Bootstrap repo** (kroki z sekcji "Bootstrap procedura" wyżej) | jednorazowy | 0 | 0 |
| 1 | **Typy + presets** (`types.ts`, `alphabet/polish.ts`, `alphabet/english.ts`, `board/layout.ts`, `rules/presets.ts`) — `defineAlphabet` factory | test-after | ~180 | ~80 |
| 2 | **Board ops + Rack/Bag** | test-after | ~140 | ~120 |
| 3 | **Dictionary backends** | test-after | ~120 | ~80 |
| 4 | **Validator** (15 testów PRZED) | **TDD-first** | ~180 | ~250 |
| 5 | **Scorer** (14 testów PRZED) | **TDD-first** | ~80 | ~150 |
| 6 | **Solver** (8 testów + property PRZED, optymalizacje after) | **TDD-first** | ~250 | ~200 |
| 7 | **Generator** (6 testów w tym samym PR, property mandatory) | test-after | ~120 | ~120 |
| 8 | **Public engine + serialize + random** (`index.ts`, `serialize/*`, `random/*`) | test-after | ~100 | ~100 |

**Suma**: ~1170 LOC produkcji + ~1100 LOC testów. Testy większe niż prod — świadomy trade-off pod TDD i regression coverage. 3–4 dni pełnego skupienia.

Pierwsza wersja "0.1.0" dostarczana po ukończeniu kroków 1–6 (bez generatora). Wystarczy do zbudowania ręcznie wstawianych plansz testowych w aplikacji + walidacji ruchów. Generator dochodzi w 0.2.0.

---

## Reference: future integration into Bingo app (NIE jest częścią tego planu)

> **Heads-up:** integracja silnika z aplikacją Bingo (modyfikacje `src/server/games/`, UI, `GameModule` rejestracja) to **oddzielny task po dostarczeniu silnika** — nie jest objęta tym planem. Sekcja niżej tylko dla future reference, by zilustrować jak konsumpcja będzie wyglądała.

### Dev (linkowanie lokalne)

W `~/Projects/bingo-engine/` jednorazowo:
```bash
npm run build
npm link
```

W `~/Projects/bingo/`:
```bash
npm link @bglowacki/bingo-engine
```

Lub, alternatywnie, w `~/Projects/bingo/package.json`:
```json
"@bglowacki/bingo-engine": "file:../bingo-engine"
```
i `npm install`. Cena: trzeba ręcznie `npm install` po każdym build silnika.

**Tip**: `npm run dev` w silniku (tsup watch) + `npm link` → zmiany propagują się natychmiast w aplikacji.

### Prod (po publishu)

```bash
cd ~/Projects/bingo
npm install @bglowacki/bingo-engine
```

Aplikacja Bingo importuje:
```ts
import {
  createBingoEngine, POLISH_ALPHABET, SCRABBLE_LAYOUT_15X15,
  SCRABBLE_CLASSIC_RULES, buildTrieDictionary,
} from '@bglowacki/bingo-engine';
```

### Pierwsza publikacja

```bash
cd ~/Projects/bingo-engine
# Login pod kontem bglowacki
npm login
# Verify scope ownership
npm whoami    # → bglowacki
# Pre-publish gates
npm run prepublishOnly
# Publish (provenance via OIDC w CI; lokalnie bez)
npm publish --access public
```

Po pierwszym publishu: kolejne wydania przez Changesets (PR z `.changeset/*.md` → merge → CI publishes).

---

## Out of scope (świadomie odłożone)

- **Integracja z `GameModule`** w aplikacji Bingo — oddzielny plan po dostarczeniu silnika.
- **UI 15×15 + rack** — oddzielny plan.
- **Spectator widget** dla planszy — oddzielny plan.
- **Heuristic AI** (leave value, equity, look-ahead) — generator zostaje przy greedy + randomizacja.
- **Digraphs / multi-codepoint tiles** (Welsh/Spanish/Catalan) — `multiCharLabels?` zarezerwowane w API, nieimplementowane.
- **GADDAG** zamiast trie — trie wystarczy dla naszych obciążeń.
- **DAWG / minimalizacja trie** — optymalizacja pamięciowa, jeśli pomiary pokażą problem.
- **Multi-language i18n komunikatów błędów silnika** — zwracamy `reason` jako enum. Tłumaczenie po stronie aplikacji.
- **Wymiana płytek (exchange) jako prawidłowy "ruch"** w generatorze — implementujemy tylko placement-y. Exchange w generatorze tylko jako fallback gdy rack pusty.
- **Persistencja stanu silnika** — silnik jest stateless funkcyjnie. Aplikacja serializuje sobie `Board` przez `serializeBoard` i trzyma w Mongo Mixed.
- **Source-mode dev export condition** (jak Zod `@zod/source`) — opt-in później jeśli rebuild churn będzie problemem.
- **WebAssembly fast-path** — nie planujemy, czysty TS jest wystarczający.
- **Persistence-aware solver** (z partial state cache) — premature optimization.

---

## Verification

Przed pierwszym publishem (`v0.1.0`):

1. `npm run typecheck && npm run lint && npm run test:coverage && npm run build` — wszystko zielone.
2. `npm run lint:pkg` — `publint` + `attw` (Are The Types Wrong) zielone.
3. Coverage thresholds przechodzą.
4. **Browser compatibility check**: `npm run build`, potem prosty test `<script type="module">import('./dist/index.js').then(...)</script>` w pustej stronie HTML — silnik się ładuje, `createBingoEngine` działa z testowym alfabetem + trie. Potwierdza izomorficzność.
5. **Smoke test ręczny** (skrypt `scripts/scrabble-smoke.ts` w repo silnika lub w aplikacji Bingo):
   - Załaduj OSPS z Mongo (po stronie aplikacji) lub mini-słownik (po stronie silnika) do `Set<string>`.
   - `buildTrieDictionary` z tego Set-a; zmierz czas budowy + RAM.
   - `createBingoEngine({ alphabet: POLISH_ALPHABET, ..., dictionary, random: seededRng(42) })`.
   - `engine.generateBoard({ moves: 12 })` 10 razy — średni czas, dump ASCII reprezentacji każdej planszy do konsoli, ręczna weryfikacja realizmu.
   - Dla każdej wygenerowanej planszy: `engine.findAllPlacements(board, rack, { limit: 20, sortBy: 'score' })` — zmierz czas (cel: <500ms na typowym boardzie z OSPS-trie).
6. **Independence check**: `grep -r "from 'node:\|require('fs')\|require('path')" src/` → musi zwrócić pusto. ESLint to wymusza w CI.
7. **Web Worker test** (jeśli zdecydujemy się robić — patrz "Decyzje do potwierdzenia"): załaduj silnik w Web Workerze, wykonaj `generateBoard` przez `postMessage` → odbierz wynik. Brak crashy = pass.
8. **Dry-run publish**: `npm publish --dry-run` → zweryfikować co trafia do paczki (tylko `dist/`, README, LICENSE, CHANGELOG, package.json).

---

## Decyzje do potwierdzenia (formularz pytań — pozostały 3)

Po zmianie strategii (osobne repo, scoped pod `@bglowacki`, MIT) zostały trzy otwarte kwestie:

1. **Web Worker support** — czy silnik MA być projektowany pod uruchamianie w Web Workerze (solver na pełnym OSPS na frontendzie może blokować main thread >100ms)? Wpływa na constraints (zero shared mutable state, configi serializowalne do JSON).

2. **Blank tile representation w PUBLIC API** — typed-array internal (`TileId`, blank=0, `|0x80` flag) jest ustalony. Pytanie o public API:
   - `{letter: string, isBlank: boolean}` (clarity, łatwa serializacja, polecane)
   - `{tileId: TileId}` (performance, wymaga `alphabet.labels[id]` przy odczycie)
   - Hybryda — public types używają `{letter, isBlank}`, eksportowane helpers `tileIdToLetter`/`letterToTileId` dla power users

3. **Pierwsza decyzja co publikujemy w v0.1.0** — czy włącznie z `solver` i `generator` (kompletny MVP, dłuższy time-to-publish), czy tylko `validator` + `scorer` + `alphabet/board/rack/dictionary` (minimalny userful surface, pierwszy publish szybciej, generator w 0.2.0)? Wpływa na to, kiedy aplikacja Bingo może zacząć integrację.
