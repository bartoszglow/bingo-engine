import type { RuleSet } from '../types.js';

/**
 * Classic Scrabble rules: 7-tile rack, 50-point bingo bonus on full-rack play,
 * first move must cover the center, subsequent moves must connect.
 */
export const SCRABBLE_CLASSIC_RULES: RuleSet = Object.freeze({
  rackSize: 7,
  bingoBonus: 50,
  bingoSize: 7,
  mustCoverCenterFirstMove: true,
  mustConnectAfterFirst: true,
  allowDiagonal: false as const,
});

/**
 * Like classic but with no bingo bonus. Useful for pedagogical / training
 * variants where premiums alone drive scoring.
 */
export const SCRABBLE_NO_BINGO_RULES: RuleSet = Object.freeze({
  ...SCRABBLE_CLASSIC_RULES,
  bingoBonus: 0,
});

/**
 * Extremely lax variant: no center requirement, no connection requirement,
 * no bingo bonus. Used for unit testing the validator and free-placement
 * single-word competitions.
 */
export const SCRABBLE_FREE_RULES: RuleSet = Object.freeze({
  rackSize: 7,
  bingoBonus: 0,
  bingoSize: 7,
  mustCoverCenterFirstMove: false,
  mustConnectAfterFirst: false,
  allowDiagonal: false as const,
});
