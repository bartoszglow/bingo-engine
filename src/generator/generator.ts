import type {
  Alphabet,
  Bag,
  BoardLayout,
  Dictionary,
  GeneratedBoard,
  GeneratedMove,
  GeneratorOptions,
  PlacedTile,
  Rack,
  RuleSet,
} from '../types.js';
import { emptyBoard, withCells } from '../board/board.js';
import { computeNewCells } from '../placement/apply.js';
import { drawTiles, freshBag, removeFromRack, returnTiles } from '../rack/rack.js';
import { scorePlacement } from '../scorer/scorer.js';
import { findAllPlacements } from '../solver/solver.js';

export interface GeneratorContext {
  readonly alphabet: Alphabet;
  readonly layout: BoardLayout;
  readonly rules: RuleSet;
  readonly dictionary: Dictionary;
  readonly random?: () => number;
}

const DEFAULT_TOP_PERCENTILE = 0.3;
const DEFAULT_MOVES = 10;

/**
 * Generate a believable mid-game board position via greedy self-play.
 *
 * Each move:
 *   1. solve every legal placement on the current board with the current rack
 *   2. sort by score, take the top `topPercentile` (default 0.3)
 *   3. pick uniformly at random from that slice
 *   4. apply, refill rack from bag
 *
 * If the rack can't form anything, exchange tiles. Two consecutive
 * exchanges end the simulation early.
 *
 * The output board, bag, rack, and full move log are returned. With a
 * seeded `random` callback the result is fully deterministic.
 */
export function generateBoard(
  ctx: GeneratorContext,
  opts: GeneratorOptions = {},
): GeneratedBoard {
  const random = ctx.random ?? Math.random;
  const targetMoves = opts.moves ?? DEFAULT_MOVES;
  const topPercentile = opts.topPercentile ?? DEFAULT_TOP_PERCENTILE;
  const rackSize = opts.rackSize ?? ctx.rules.rackSize;

  let board = emptyBoard(ctx.layout);
  let bag: Bag = freshBag(ctx.alphabet);
  let rack: Rack;
  {
    const draw = drawTiles(bag, rackSize, random);
    rack = draw.drawn;
    bag = draw.bag;
  }

  const movesPlayed: GeneratedMove[] = [];
  let exchangesInARow = 0;

  for (let i = 0; i < targetMoves; i++) {
    const placements = findAllPlacements(board, rack, ctx, { sortBy: 'score' });
    if (placements.length === 0) {
      // Exchange rack — return current tiles to bag, draw fresh.
      if (exchangesInARow >= 2 || bag.length === 0) break;
      bag = returnTiles(bag, rack);
      const draw = drawTiles(bag, rackSize, random);
      rack = draw.drawn;
      bag = draw.bag;
      exchangesInARow++;
      continue;
    }
    exchangesInARow = 0;

    const topN = Math.max(1, Math.ceil(placements.length * topPercentile));
    const choiceIdx = Math.min(Math.floor(random() * topN), topN - 1);
    const placement = placements[choiceIdx]!;

    const breakdown = scorePlacement(board, placement, ctx);
    movesPlayed.push({
      placement,
      score: breakdown.total,
      word: breakdown.words[0]?.word ?? '',
    });

    const newCells = computeNewCells(board, placement, ctx.alphabet);
    board = withCells(
      board,
      newCells.map((c) => ({ row: c.row, col: c.col, cell: c.placedTile })),
    );

    // Remove consumed tiles from rack.
    const consumed: PlacedTile[] = newCells.map((c) => c.placedTile);
    const newRack = removeFromRack(rack, consumed);
    if (!newRack) {
      // Should never happen — solver only returns rack-feasible placements.
      break;
    }
    rack = newRack;

    // Refill from bag.
    const needed = rackSize - rack.length;
    if (needed > 0 && bag.length > 0) {
      const refill = drawTiles(bag, needed, random);
      rack = [...rack, ...refill.drawn];
      bag = refill.bag;
    }
  }

  if (opts.finalRack === 'fresh-draw' && bag.length > 0) {
    bag = returnTiles(bag, rack);
    const draw = drawTiles(bag, rackSize, random);
    rack = draw.drawn;
    bag = draw.bag;
  }

  return Object.freeze({
    board,
    bag,
    rack,
    movesPlayed: Object.freeze(movesPlayed),
  });
}

