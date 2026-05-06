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

// ---- Board ----
export { SCRABBLE_LAYOUT_15X15, SIMPLE_LAYOUT_15X15 } from './board/layout.js';
export {
  emptyBoard,
  getCell,
  hasNeighbour,
  isEmpty,
  placeTile,
  withCell,
  withCells,
} from './board/board.js';
export { inBounds, perpendicular, step } from './board/coords.js';

// ---- Rack / Bag ----
export {
  bareTileId,
  blankAs,
  blankTile,
  isPlacedBlank,
  isRackBlank,
  letterTile,
  tile,
  tileLetter,
} from './rack/tile.js';
export {
  countTile,
  drawTiles,
  freshBag,
  rackCanProvide,
  removeFromRack,
  returnTiles,
} from './rack/rack.js';

// ---- Rules ----
export {
  SCRABBLE_CLASSIC_RULES,
  SCRABBLE_FREE_RULES,
  SCRABBLE_NO_BINGO_RULES,
} from './rules/presets.js';

// ---- Dictionary ----
export { buildSetDictionary, buildTrieDictionary } from './dictionary/index.js';

// ---- Random ----
export { seededRng } from './random/seeded.js';

// ---- Validator + Scorer + Solver + Generator (standalone callable) ----
export { validatePlacement } from './validator/validator.js';
export type { ValidatorContext } from './validator/validator.js';
export { scorePlacement } from './scorer/scorer.js';
export type { ScorerContext } from './scorer/scorer.js';
export { findAllPlacements, findAnchors } from './solver/index.js';
export type { Anchor, SolverContext } from './solver/index.js';
export { generateBoard } from './generator/index.js';
export type { GeneratorContext } from './generator/index.js';

// ---- Placement application + serialization ----
export { applyPlacement, computeNewCells } from './placement/apply.js';
export { deserializeBoard, serializeBoard } from './serialize/board.js';

// ---- Engine factory (binds a config to all operations) ----
export { createBingoEngine } from './engine.js';

/** Library version (in sync with package.json). */
export const VERSION = '0.0.1';
