import { describe, expect, it } from 'vitest';
import { adaptiveCanvasPixelRatio, dampedValue, wheelDeltaToScaleStep } from '../src/core/interaction';

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

describe('animation performance controls', () => {
  it('keeps spring timing independent of display refresh rate', () => {
    const simulate = (framesPerSecond: number) => {
      let value = 0;
      for (let frame = 0; frame < framesPerSecond; frame += 1) {
        value = dampedValue(value, 1, 1 / framesPerSecond);
      }
      return value;
    };
    expect(simulate(24)).toBeCloseTo(simulate(120), 10);
  });

  it('bounds Retina backing resolution by pixel budget', () => {
    const ratio = adaptiveCanvasPixelRatio(1_177, 610, 2);
    expect(ratio).toBeGreaterThan(1);
    expect(1_177 * ratio * 610 * ratio).toBeCloseTo(1_250_000, 4);
    expect(adaptiveCanvasPixelRatio(400, 540, 3)).toBe(2);
  });
});
