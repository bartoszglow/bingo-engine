import { describe, expect, it } from 'vitest';
import {
  SCRABBLE_CLASSIC_RULES,
  SCRABBLE_FREE_RULES,
  SCRABBLE_NO_BINGO_RULES,
} from '../src/index.js';

describe('SCRABBLE_CLASSIC_RULES', () => {
  it('matches the canonical Scrabble ruleset', () => {
    expect(SCRABBLE_CLASSIC_RULES).toMatchObject({
      rackSize: 7,
      bingoBonus: 50,
      bingoSize: 7,
      mustCoverCenterFirstMove: true,
      mustConnectAfterFirst: true,
      allowDiagonal: false,
    });
  });
  it('is frozen', () => {
    expect(Object.isFrozen(SCRABBLE_CLASSIC_RULES)).toBe(true);
  });
});

describe('SCRABBLE_NO_BINGO_RULES', () => {
  it('disables the bingo bonus but keeps everything else', () => {
    expect(SCRABBLE_NO_BINGO_RULES.bingoBonus).toBe(0);
    expect(SCRABBLE_NO_BINGO_RULES.mustCoverCenterFirstMove).toBe(true);
  });
});

describe('SCRABBLE_FREE_RULES', () => {
  it('relaxes center + connection requirements', () => {
    expect(SCRABBLE_FREE_RULES.mustCoverCenterFirstMove).toBe(false);
    expect(SCRABBLE_FREE_RULES.mustConnectAfterFirst).toBe(false);
    expect(SCRABBLE_FREE_RULES.bingoBonus).toBe(0);
  });
});
