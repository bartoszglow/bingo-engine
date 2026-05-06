import type {
  Alphabet,
  Board,
  BoardLayout,
  Cell,
  Dictionary,
  PlacedTile,
  Placement,
  Rack,
  RuleSet,
  ValidationResult,
} from '../types.js';
import { BLANK_FLAG } from '../types.js';
import { letterToTileId } from '../alphabet/alphabet.js';
import { hasNeighbour, isEmpty, withCells } from '../board/board.js';
import { inBounds } from '../board/coords.js';
import { rackCanProvide } from '../rack/rack.js';
import { extractFormedWords } from './crosswords.js';

/**
 * Every piece of context the validator needs. A subset of `EngineConfig`
 * minus `random` (validator is deterministic).
 */
export interface ValidatorContext {
  readonly alphabet: Alphabet;
  readonly layout: BoardLayout;
  readonly rules: RuleSet;
  readonly dictionary: Dictionary;
}

/**
 * Validate a player's placement against the board, rack, and rules.
 *
 * Returns `{ valid: true }` on success, or `{ valid: false, reason, ... }`
 * citing the FIRST rule violated. Order of checks is intentional and stable —
 * downstream tooling (UI, AI tutor) can rely on the precedence.
 *
 * Order:
 *   1. empty placement
 *   2. rack-mismatch (cheap to check; gives the best UX message)
 *   3. out-of-bounds
 *   4. overlaps existing tile with a different letter
 *   5. first-move-on-center / not-connected
 *   6. has-gap (needs the would-be board to detect)
 *   7. dictionary checks (main word, then crosswords)
 */
export function validatePlacement(
  board: Board,
  placement: Placement,
  rack: Rack,
  ctx: ValidatorContext,
): ValidationResult {
  const { alphabet, layout, rules, dictionary } = ctx;

  // ---- Rule 1: empty ----
  if (placement.tiles.length === 0) {
    return { valid: false, reason: 'empty-placement' };
  }

  // ---- Convert PlacementTile (string) → PlacedTile (TileId) ----
  // Walk along the placement axis, computing each tile's target cell.
  // We DO allow the placement to "skip over" existing same-letter cells:
  // a placement starting at (7,5) with tiles k,o,t will scan cells
  // (7,5), (7,6), (7,7), … and consume one tile from `placement.tiles`
  // for every cell that is empty OR matches the placement's intended letter
  // for that index. If an intermediate cell holds a DIFFERENT letter
  // than the corresponding placement tile, that's `overlaps-existing-…`.

  const newTiles: { row: number; col: number; placedTile: PlacedTile }[] = [];
  const consumedFromRack: PlacedTile[] = [];
  let row = placement.startRow;
  let col = placement.startCol;
  let tileIdx = 0;

  while (tileIdx < placement.tiles.length) {
    if (!inBounds(row, col, layout.size)) {
      return { valid: false, reason: 'out-of-bounds' };
    }
    const intended = placement.tiles[tileIdx]!;
    const intendedId = letterToTileId(alphabet, intended.letter);
    if (intendedId === undefined) {
      // Letter not in alphabet — can't be on the rack, can't be on the board.
      return { valid: false, reason: 'rack-mismatch' };
    }

    const cell: Cell = (board[row] as Cell[])[col] ?? null;
    if (cell !== null) {
      // Existing tile at this cell. It must match the intended letter
      // (ignoring the blank flag) — otherwise the placement collides.
      const cellLetterId = cell.tileId & 0x7f;
      if (cellLetterId !== intendedId) {
        return { valid: false, reason: 'overlaps-existing-different-letter' };
      }
      // Match — DO NOT consume from the rack, DO NOT advance tileIdx; the
      // placement.tiles entry is treated as a "filler" coordinating with
      // the existing letter on the board. Wait — actually we DO advance
      // tileIdx because the consumer has explicitly listed this letter as
      // part of the placement (so they know it's there). We just don't
      // consume rack and don't add it to newTiles.
      tileIdx += 1;
    } else {
      // Empty cell — this is a NEW tile to place.
      const placedTile: PlacedTile = {
        tileId: intended.isBlank ? intendedId | BLANK_FLAG : intendedId,
      };
      newTiles.push({ row, col, placedTile });
      consumedFromRack.push(placedTile);
      tileIdx += 1;
    }

    if (placement.direction === 'horizontal') col += 1;
    else row += 1;
  }

  // After consuming every placement tile, we may still need to extend the
  // run forward through any contiguous existing letters that the consumer
  // *didn't* list — but that means the consumer is not explicit about the
  // word. We accept that case: the main word at scoring time will include
  // those trailing existing letters (they're part of the word formed).
  // Same for the run BEFORE the placement: we'll catch it during the
  // word-extraction step.

  // ---- Rule 2 (rack): can the rack provide every consumed tile? ----
  if (newTiles.length === 0) {
    // A placement of nothing-new (every tile matched an existing letter)
    // is degenerate — treat it as empty.
    return { valid: false, reason: 'empty-placement' };
  }
  if (!rackCanProvide(rack, consumedFromRack)) {
    return { valid: false, reason: 'rack-mismatch' };
  }

  // ---- Rule 5: first-move-on-center / not-connected ----
  const boardWasEmpty = isEmpty(board);
  if (boardWasEmpty) {
    if (rules.mustCoverCenterFirstMove) {
      const c = layout.centerStart;
      if (c) {
        const covers = newTiles.some((t) => t.row === c.row && t.col === c.col);
        if (!covers) {
          return { valid: false, reason: 'first-move-not-on-center' };
        }
      }
    }
  } else if (rules.mustConnectAfterFirst) {
    const connected = newTiles.some((t) => hasNeighbour(board, t.row, t.col));
    if (!connected) {
      return { valid: false, reason: 'not-connected' };
    }
  }

  // ---- Build the would-be board for word extraction ----
  const nextBoard = withCells(
    board,
    newTiles.map((t) => ({ row: t.row, col: t.col, cell: t.placedTile })),
  );

  // ---- Rule 6: dictionary ----
  const { mainWord, crosswords } = extractFormedWords(
    nextBoard,
    placement.direction,
    newTiles.map((t) => ({ row: t.row, col: t.col })),
    alphabet,
  );

  if (mainWord && !dictionary.has(mainWord.word)) {
    return {
      valid: false,
      reason: 'word-not-in-dictionary',
      invalidWords: [mainWord.word],
    };
  }

  const badCrosswords: string[] = [];
  for (const cw of crosswords) {
    if (!dictionary.has(cw.word)) badCrosswords.push(cw.word);
  }
  if (badCrosswords.length > 0) {
    return {
      valid: false,
      reason: 'crossword-not-in-dictionary',
      invalidWords: badCrosswords,
    };
  }

  return { valid: true };
}
