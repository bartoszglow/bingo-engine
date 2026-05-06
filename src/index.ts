/**
 * @bglowacki/bingo-engine — Isomorphic Scrabble engine.
 *
 * Public API. See README and docs/PLAN.md for design rationale and roadmap.
 */

// ---- Types ----
export type {
  Alphabet,
  AlphabetSpec,
  Bag,
  BingoEngine,
  Board,
  BoardLayout,
  Cell,
  Dictionary,
  Direction,
  EngineConfig,
  FormedWord,
  GeneratedBoard,
  GeneratedMove,
  GeneratorOptions,
  PlacedTile,
  Placement,
  PlacementTile,
  PremiumKind,
  PremiumSquare,
  Rack,
  RuleSet,
  ScoreBreakdown,
  SerializedBoard,
  SolverOptions,
  TileId,
  TileSpec,
  ValidationReason,
  ValidationResult,
} from './types.js';

export { BLANK, BLANK_FLAG } from './types.js';

// ---- Alphabet ----
export {
  defineAlphabet,
  isBlanked,
  letterToTileId,
  tileIdToLetter,
  tileScore,
  unblank,
} from './alphabet/alphabet.js';
export { POLISH_ALPHABET } from './alphabet/polish.js';
export { ENGLISH_ALPHABET } from './alphabet/english.js';

// ---- Board layout ----
export { SCRABBLE_LAYOUT_15X15, SIMPLE_LAYOUT_15X15 } from './board/layout.js';

// ---- Rules ----
export {
  SCRABBLE_CLASSIC_RULES,
  SCRABBLE_FREE_RULES,
  SCRABBLE_NO_BINGO_RULES,
} from './rules/presets.js';

/** Library version (in sync with package.json). */
export const VERSION = '0.0.1';
