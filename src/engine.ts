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
import { extractFormedWords } from './validator/crosswords.js';
import { computeNewCells } from './placement/apply.js';
import { tileIdToLetter } from './alphabet/alphabet.js';
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

    placementsToWords: (board: Board, placement: Placement) => {
      const newCells = computeNewCells(board, placement, config.alphabet);
      const newBoard = applyPlacement(board, placement, config.alphabet);
      const { mainWord, crosswords } = extractFormedWords(
        newBoard,
        placement.direction,
        newCells.map((c) => ({ row: c.row, col: c.col })),
        config.alphabet,
      );
      const newSet = new Set<number>();
      for (const c of newCells) newSet.add(c.row * config.layout.size + c.col);
      const words = [];
      const all = mainWord ? [mainWord, ...crosswords] : crosswords;
      for (const w of all) {
        words.push({
          word: w.word,
          score: 0, // computed elsewhere via scorePlacement
          cells: w.cells.map((cc) => ({
            row: cc.row,
            col: cc.col,
            letter: tileIdToLetter(config.alphabet, cc.tileId),
            fromRack: newSet.has(cc.row * config.layout.size + cc.col),
            isBlank: (cc.tileId & 0x80) !== 0,
          })),
        });
      }
      return words;
    },

    serializeBoard: (board: Board) => serializeBoard(board),
    deserializeBoard: (data: SerializedBoard) => deserializeBoard(data, config.layout),
  });
}
