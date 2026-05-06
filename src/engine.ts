import type {
  Bag,
  BingoEngine,
  Board,
  EngineConfig,
  GeneratorOptions,
  Placement,
  Rack,
  SerializedBoard,
  SolverOptions,
} from './types.js';
import { drawTiles, freshBag } from './rack/rack.js';
import { emptyBoard } from './board/board.js';
import { validatePlacement } from './validator/validator.js';
import { scorePlacement } from './scorer/scorer.js';
import { findAllPlacements } from './solver/solver.js';
import { generateBoard } from './generator/generator.js';
import { applyPlacement } from './placement/apply.js';
import { deserializeBoard, serializeBoard } from './serialize/board.js';

/**
 * Build a `BingoEngine` instance bound to a single configuration. Every
 * method on the returned engine is a thin wrapper around the corresponding
 * standalone function exported by the package — call those directly when
 * you want to vary the alphabet/dictionary/rules per call.
 */
export function createBingoEngine(config: EngineConfig): BingoEngine {
  const random = config.random ?? Math.random;

  return Object.freeze({
    emptyBoard: () => emptyBoard(config.layout),
    freshBag: () => freshBag(config.alphabet),
    drawTiles: (bag: Bag, count: number) => drawTiles(bag, count, random),

    validatePlacement: (board: Board, placement: Placement, rack: Rack) =>
      validatePlacement(board, placement, rack, config),
    scorePlacement: (board: Board, placement: Placement) =>
      scorePlacement(board, placement, config),
    applyPlacement: (board: Board, placement: Placement) =>
      applyPlacement(board, placement, config.alphabet),

    findAllPlacements: (board: Board, rack: Rack, opts?: SolverOptions) =>
      findAllPlacements(board, rack, config, opts),

    generateBoard: (opts?: GeneratorOptions) =>
      generateBoard({ ...config, random }, opts),

    placementsToWords: (board: Board, placement: Placement) =>
      scorePlacement(board, placement, config).words,

    serializeBoard: (board: Board) => serializeBoard(board),
    deserializeBoard: (data: SerializedBoard) => deserializeBoard(data, config.layout),
  });
}
