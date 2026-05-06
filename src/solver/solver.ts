import type {
  Alphabet,
  Board,
  BoardLayout,
  Cell,
  Dictionary,
  Placement,
  Rack,
  RuleSet,
  SolverOptions,
  TileId,
} from '../types.js';
import { BLANK } from '../types.js';
import { tileIdToLetter } from '../alphabet/alphabet.js';
import { inBounds, step } from '../board/coords.js';
import { scorePlacement } from '../scorer/scorer.js';
import { validatePlacement } from '../validator/validator.js';
import { findAnchors } from './anchors.js';

export interface SolverContext {
  readonly alphabet: Alphabet;
  readonly layout: BoardLayout;
  readonly rules: RuleSet;
  readonly dictionary: Dictionary;
}

/**
 * Find every legal placement on the board for the given rack.
 *
 * Algorithm: anchor-based DFS along each direction. For each anchor cell
 * (empty cell touching an existing tile, or the layout center on an empty
 * board) we walk back to find every valid starting offset, then DFS forward
 * substituting each rack tile (or filling existing letters), pruning by
 * `dictionary.hasPrefix`. Each terminal candidate is verified by
 * `validatePlacement` and `scorePlacement` for sorting.
 *
 * Currently a correctness-first implementation: scans every cell as a
 * potential start (filtered by anchor coverage check). Optimizations
 * (anchor-rooted enumeration with cached cross-checks) are reserved for
 * follow-up work — the public API is stable.
 */
export function findAllPlacements(
  board: Board,
  rack: Rack,
  ctx: SolverContext,
  opts: SolverOptions = {},
): Placement[] {
  const { alphabet, layout, dictionary } = ctx;
  const size = layout.size;
  const anchors = findAnchors(board, layout);
  if (anchors.length === 0) return [];
  const anchorSet = new Set<number>();
  for (const a of anchors) anchorSet.add(a.row * size + a.col);

  const minLen = Math.max(1, opts.minWordLength ?? 1);
  const maxLen = Math.min(size, opts.maxWordLength ?? size);

  const used = new Array<boolean>(rack.length).fill(false);
  const allLetterIds: TileId[] = [];
  for (let id = 1; id < alphabet.size; id++) allLetterIds.push(id);

  const seen = new Set<string>();
  const results: { placement: Placement; score: number; length: number }[] = [];

  // Walk every potential start row/col + direction. The DFS itself only
  // continues if the prefix-so-far is a valid dictionary prefix.
  for (const dir of ['horizontal', 'vertical'] as const) {
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        // Pruning: a placement must touch at least one anchor. The leftmost
        // candidate cell is here (row, col), so we check anchor coverage
        // dynamically inside the DFS.
        dfs({
          startRow: row,
          startCol: col,
          dir,
          row,
          col,
          length: 0,
          newCount: 0,
          touchedAnchor: false,
          prefix: '',
          tilesPlaced: [],
        });
      }
    }
  }

  return finalize(results, opts);

  // ---- helpers (closures over ctx + accumulators) ----

  function dfs(state: {
    startRow: number;
    startCol: number;
    dir: 'horizontal' | 'vertical';
    row: number;
    col: number;
    length: number;
    newCount: number;
    touchedAnchor: boolean;
    prefix: string;
    tilesPlaced: { letter: string; isBlank: boolean }[];
  }): void {
    const { startRow, startCol, dir, row, col, length, newCount, touchedAnchor, prefix, tilesPlaced } = state;

    // Try emitting at this point: the placement uses tilesPlaced, and we
    // need at least one new tile and the running word to be in the
    // dictionary. Crosswords are checked by validator.
    if (length >= minLen && newCount > 0 && touchedAnchor) {
      // The "running word" is the prefix collected so far. But the actual
      // word formed on the board may extend beyond — through existing
      // letters before startCell or after current. The validator is the
      // single source of truth. For dictionary pruning we check the
      // longer-form word here only when stopping.
      const placement: Placement = {
        startRow,
        startCol,
        direction: dir,
        tiles: tilesPlaced.slice(),
      };
      const key = placementKey(placement);
      if (!seen.has(key)) {
        const valid = validatePlacement(board, placement, rack, ctx);
        if (valid.valid) {
          seen.add(key);
          const breakdown = scorePlacement(board, placement, ctx);
          results.push({
            placement,
            score: breakdown.total,
            length: tilesPlaced.length,
          });
        } else {
          // Mark seen to skip exact-duplicate retries from concurrent paths.
          seen.add(key);
        }
      }
    }

    if (length >= maxLen) return;
    if (!inBounds(row, col, size)) return;

    const cell: Cell = (board[row] as Cell[])[col] ?? null;
    const next = step(row, col, dir);
    const cellIsAnchor = anchorSet.has(row * size + col);

    if (cell !== null) {
      // Filler — must traverse the existing letter without using rack.
      const letter = tileIdToLetter(alphabet, cell.tileId);
      const newPrefix = prefix + letter;
      if (!dictionary.hasPrefix(newPrefix)) return;
      dfs({
        startRow,
        startCol,
        dir,
        row: next.row,
        col: next.col,
        length: length + 1,
        newCount,
        touchedAnchor,
        prefix: newPrefix,
        tilesPlaced: [...tilesPlaced, { letter, isBlank: false }],
      });
      return;
    }

    // Empty cell — try each unused rack tile (deduped per letter).
    const triedLetters = new Set<string>();
    for (let i = 0; i < rack.length; i++) {
      if (used[i]) continue;
      const t = rack[i]!;
      if (t.tileId === BLANK) {
        // Blank can stand in for any letter — try each.
        for (const letterId of allLetterIds) {
          const letter = alphabet.labels[letterId]!;
          const blankKey = '@' + letter;
          if (triedLetters.has(blankKey)) continue;
          triedLetters.add(blankKey);
          const newPrefix = prefix + letter;
          if (!dictionary.hasPrefix(newPrefix)) continue;
          used[i] = true;
          dfs({
            startRow,
            startCol,
            dir,
            row: next.row,
            col: next.col,
            length: length + 1,
            newCount: newCount + 1,
            touchedAnchor: touchedAnchor || cellIsAnchor,
            prefix: newPrefix,
            tilesPlaced: [...tilesPlaced, { letter, isBlank: true }],
          });
          used[i] = false;
        }
      } else {
        const letter = alphabet.labels[t.tileId]!;
        if (triedLetters.has(letter)) continue;
        triedLetters.add(letter);
        const newPrefix = prefix + letter;
        if (!dictionary.hasPrefix(newPrefix)) continue;
        used[i] = true;
        dfs({
          startRow,
          startCol,
          dir,
          row: next.row,
          col: next.col,
          length: length + 1,
          newCount: newCount + 1,
          touchedAnchor: touchedAnchor || cellIsAnchor,
          prefix: newPrefix,
          tilesPlaced: [...tilesPlaced, { letter, isBlank: false }],
        });
        used[i] = false;
      }
    }
  }

  function placementKey(p: Placement): string {
    const tiles = p.tiles.map((t) => (t.isBlank ? '*' + t.letter : t.letter)).join('');
    return `${p.direction}@${p.startRow},${p.startCol}:${tiles}`;
  }

  function finalize(
    rs: { placement: Placement; score: number; length: number }[],
    o: SolverOptions,
  ): Placement[] {
    const sortBy = o.sortBy ?? 'score';
    if (sortBy === 'score') rs.sort((a, b) => b.score - a.score);
    else if (sortBy === 'length') rs.sort((a, b) => b.length - a.length);
    const limit = o.limit ?? rs.length;
    return rs.slice(0, Math.max(0, limit)).map((r) => r.placement);
  }

}
