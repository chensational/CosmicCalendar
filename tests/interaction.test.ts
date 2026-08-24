import { describe, expect, it } from 'vitest';
import { wheelDeltaToScaleStep } from '../src/core/interaction';

describe('wheel scale interaction', () => {
  it('keeps precise trackpad movement proportional', () => {
    expect(wheelDeltaToScaleStep(2)).toBeCloseTo(0.003);
    expect(wheelDeltaToScaleStep(-2)).toBeCloseTo(-0.003);
  });

  it('caps large wheel events so one event cannot jump scales', () => {
    expect(wheelDeltaToScaleStep(100)).toBe(0.12);
    expect(wheelDeltaToScaleStep(-100)).toBe(-0.12);
  });

  it('normalizes line and page delta modes', () => {
    expect(wheelDeltaToScaleStep(1, 1)).toBeCloseTo(0.024);
    expect(wheelDeltaToScaleStep(1, 2, 600)).toBe(0.12);
  });

  it('ignores invalid input', () => {
    expect(wheelDeltaToScaleStep(Number.NaN)).toBe(0);
  });
});
