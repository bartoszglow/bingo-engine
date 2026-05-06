/**
 * Public type surface of `@bglowacki/bingo-engine`.
 *
 * All types defined here are part of the stable public contract; submodules
 * provide implementations. Designed to be JSON-serializable / structured-clone
 * compatible so configs and game state can travel through `postMessage` to a
 * Web Worker without conversion.
 */

// ============================================================================
// Tile identity
// ============================================================================

/**
 * A `TileId` is a small non-negative integer identifying a tile within an
 * `Alphabet`. `0` is reserved for the blank tile. Letters get IDs `1..n`.
 *
 * A tile played from a blank is encoded as `id | BLANK_FLAG` (high bit set),
 * which lets a single byte carry both "this tile is a blank" and "the letter
 * it represents" — same convention used by Macondo and wolges.
 */
export type TileId = number;

/** ID of the blank tile in any alphabet. */
export const BLANK: TileId = 0;

/** Bit OR'd onto a TileId to indicate "blank played as this letter". */
export const BLANK_FLAG = 0x80;

// ============================================================================
// Alphabet
// ============================================================================

/**
 * Specification of a single tile when defining a custom alphabet.
 *
 * `multiCharLabels` is reserved for future digraph support
 * (Welsh `ch`, `ll`, Spanish `rr`, Catalan `L·L`); currently ignored.
 */
export interface TileSpec {
  readonly label: string;
  readonly score: number;
  readonly count: number;
  readonly isVowel?: boolean;
  readonly multiCharLabels?: readonly string[];
}

/**
 * Specification passed to {@link defineAlphabet} to build an `Alphabet`.
 */
export interface AlphabetSpec {
  readonly id: string;
  readonly tiles: readonly TileSpec[];
  readonly blankCount: number;
  readonly blankScore?: number;
  readonly locale?: string;
  readonly blankSymbol?: string;
}

/**
 * Frozen, JSON-friendly alphabet with hot-path data in typed arrays.
 *
 * Layout:
 * - `labels[0]` is always the blank symbol; `labels[1..size-1]` are letters.
 * - `scores[id]` returns the tile's point value (`0` for the blank).
 * - `counts[id]` returns the tile's count in a fresh bag (`counts[0]` = blanks).
 * - `vowelMask` has bit `i` set when tile id `i` is a vowel.
 * - `labelToId` maps user-facing labels (lowercased per `locale`) to `TileId`.
 *
 * The whole object is `Object.freeze`d after construction. Typed arrays are
 * frozen via the alphabet object's reference; their underlying buffers stay
 * mutable per JS spec, but external code should treat them as read-only.
 */
export interface Alphabet {
  readonly id: string;
  readonly size: number;
  readonly labels: readonly string[];
  readonly scores: Int8Array;
  readonly counts: Uint8Array;
  readonly vowelMask: bigint;
  readonly labelToId: Readonly<Record<string, TileId>>;
  readonly locale?: string;
  readonly blankSymbol: string;
}

// ============================================================================
// Board
// ============================================================================

/** Direction of a placement on the board. */
export type Direction = 'horizontal' | 'vertical';

/** Premium-square multiplier kinds. */
export type PremiumKind = 'DLS' | 'TLS' | 'DWS' | 'TWS';

/** Coordinates of a single premium square. */
export interface PremiumSquare {
  readonly row: number;
  readonly col: number;
  readonly kind: PremiumKind;
}

/**
 * Configuration of a board: side length, premium squares, optional center
 * cell that the first move must cover.
 */
export interface BoardLayout {
  readonly size: number;
  readonly premiums: readonly PremiumSquare[];
  readonly centerStart?: { readonly row: number; readonly col: number };
}

/** Internal cell representation: a placed tile or `null` for empty. */
export interface PlacedTile {
  readonly tileId: TileId;
}

export type Cell = PlacedTile | null;

/** Immutable 2D board. */
export type Board = readonly (readonly Cell[])[];

// ============================================================================
// Rack and bag
// ============================================================================

export type Rack = readonly PlacedTile[];
export type Bag = readonly PlacedTile[];

// ============================================================================
// Placement (public API uses string labels for ergonomics)
// ============================================================================

/**
 * A tile in a placement built by a consumer (e.g. UI). Uses string labels
 * rather than `TileId` for readability and easy serialization.
 */
export interface PlacementTile {
  readonly letter: string;
  readonly isBlank: boolean;
}

/** A placement candidate the player wants to make. */
export interface Placement {
  readonly startRow: number;
  readonly startCol: number;
  readonly direction: Direction;
  readonly tiles: readonly PlacementTile[];
}

// ============================================================================
// Rules
// ============================================================================

/**
 * Rules that govern a single game variant. `allowDiagonal` is reserved for
 * future variants (currently always `false`).
 */
export interface RuleSet {
  readonly rackSize: number;
  readonly bingoBonus: number;
  readonly bingoSize: number;
  readonly mustCoverCenterFirstMove: boolean;
  readonly mustConnectAfterFirst: boolean;
  readonly allowDiagonal: false;
}

// ============================================================================
// Dictionary (consumer-supplied)
// ============================================================================

/**
 * Word-lookup backend. Hot-path solver requires *synchronous* `has` and
 * `hasPrefix`. Async backends (Mongo, etc.) must be pre-warmed by the caller
 * before invoking the engine.
 */
export interface Dictionary {
  has(word: string): boolean;
  hasPrefix(prefix: string): boolean;
  sample?(opts: { minLength: number; maxLength: number; count: number }): readonly string[];
}

// ============================================================================
// Validation result
// ============================================================================

export type ValidationReason =
  | 'empty-placement'
  | 'out-of-bounds'
  | 'has-gap'
  | 'overlaps-existing-different-letter'
  | 'first-move-not-on-center'
  | 'not-connected'
  | 'rack-mismatch'
  | 'word-not-in-dictionary'
  | 'crossword-not-in-dictionary';

export interface ValidationResult {
  readonly valid: boolean;
  readonly reason?: ValidationReason;
  readonly invalidWords?: readonly string[];
}

// ============================================================================
// Score breakdown
// ============================================================================

export interface FormedWord {
  readonly word: string;
  readonly score: number;
  readonly cells: readonly {
    readonly row: number;
    readonly col: number;
    readonly letter: string;
    readonly fromRack: boolean;
    readonly isBlank: boolean;
  }[];
}

export interface ScoreBreakdown {
  readonly total: number;
  readonly bingo: boolean;
  readonly words: readonly FormedWord[];
}

// ============================================================================
// Solver
// ============================================================================

export interface SolverOptions {
  readonly limit?: number;
  readonly sortBy?: 'score' | 'length' | 'none';
  readonly minWordLength?: number;
  readonly maxWordLength?: number;
}

// ============================================================================
// Generator
// ============================================================================

export interface GeneratorOptions {
  readonly moves?: number;
  readonly topPercentile?: number;
  readonly rackSize?: number;
  readonly finalRack?: 'fresh-draw' | 'last-rack';
}

export interface GeneratedMove {
  readonly placement: Placement;
  readonly score: number;
  readonly word: string;
}

export interface GeneratedBoard {
  readonly board: Board;
  readonly bag: Bag;
  readonly rack: Rack;
  readonly movesPlayed: readonly GeneratedMove[];
}

// ============================================================================
// Serialization
// ============================================================================

export interface SerializedBoard {
  readonly size: number;
  /** Row-major flat array: each cell is `null` or `{ tileId }`. */
  readonly cells: readonly (PlacedTile | null)[];
}

// ============================================================================
// Engine configuration and instance
// ============================================================================

export interface EngineConfig {
  readonly alphabet: Alphabet;
  readonly layout: BoardLayout;
  readonly rules: RuleSet;
  readonly dictionary: Dictionary;
  readonly random?: () => number;
}

export interface BingoEngine {
  emptyBoard(): Board;
  freshBag(): Bag;
  drawTiles(bag: Bag, count: number): { drawn: PlacedTile[]; bag: Bag };

  validatePlacement(board: Board, placement: Placement, rack: Rack): ValidationResult;
  scorePlacement(board: Board, placement: Placement): ScoreBreakdown;
  applyPlacement(board: Board, placement: Placement): Board;

  findAllPlacements(board: Board, rack: Rack, opts?: SolverOptions): Placement[];

  generateBoard(opts?: GeneratorOptions): GeneratedBoard;

  placementsToWords(board: Board, placement: Placement): readonly FormedWord[];
  serializeBoard(board: Board): SerializedBoard;
  deserializeBoard(data: SerializedBoard): Board;
}
