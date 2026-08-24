import { describe, expect, it } from 'vitest';
import {
  adaptiveCanvasPixelRatio,
  dampedValue,
  INITIAL_RENDER_QUALITY,
  nextAdaptiveRenderQuality,
  wheelDeltaToScaleStep,
} from '../src/core/interaction';

describe('wheel scale interaction', () => {
  it('keeps precise trackpad movement proportional', () => {
    expect(wheelDeltaToScaleStep(2)).toBeCloseTo(0.0005);
    expect(wheelDeltaToScaleStep(-2)).toBeCloseTo(-0.0005);
  });

  it('caps large wheel events so one event cannot jump scales', () => {
    expect(wheelDeltaToScaleStep(100)).toBe(0.02);
    expect(wheelDeltaToScaleStep(-100)).toBe(-0.02);
  });

  it('normalizes line and page delta modes', () => {
    expect(wheelDeltaToScaleStep(1, 1)).toBeCloseTo(0.004);
    expect(wheelDeltaToScaleStep(1, 2, 600)).toBe(0.02);
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

  it('degrades sustained slow rendering but ignores a single path-build spike', () => {
    const afterOneSlowFrame = nextAdaptiveRenderQuality(INITIAL_RENDER_QUALITY, 60);
    expect(afterOneSlowFrame.resolutionScale).toBe(1);
    const degraded = nextAdaptiveRenderQuality(afterOneSlowFrame, 60);
    expect(degraded.resolutionScale).toBeLessThan(0.8);
    let lowQuality = degraded;
    for (let frame = 0; frame < 8; frame += 1) {
      lowQuality = nextAdaptiveRenderQuality(lowQuality, 70);
    }
    expect(lowQuality.resolutionScale).toBe(0.55);
    expect(lowQuality.atmosphericFramesPerSecond).toBeLessThan(15);
  });

  it('recovers quality only after a long run of inexpensive frames', () => {
    let quality = {
      ...INITIAL_RENDER_QUALITY,
      resolutionScale: 0.55,
      atmosphericFramesPerSecond: 10,
    };
    for (let frame = 0; frame < 239; frame += 1) {
      quality = nextAdaptiveRenderQuality(quality, 5);
    }
    expect(quality.atmosphericFramesPerSecond).toBe(10);
    quality = nextAdaptiveRenderQuality(quality, 5);
    expect(quality.atmosphericFramesPerSecond).toBe(11);
  });
});
