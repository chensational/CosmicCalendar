import { clamp } from './math';

const PIXELS_PER_LINE = 16;
const WHEEL_SENSITIVITY = 0.0005;
const MAX_SCALE_STEP = 0.04;

/** Converts wheel input to a bounded scale change without amplifying trackpad events. */
export function wheelDeltaToScaleStep(
  deltaY: number,
  deltaMode = 0,
  pageHeight = 800,
): number {
  if (!Number.isFinite(deltaY)) return 0;

  const pixelDelta = deltaMode === 1
    ? deltaY * PIXELS_PER_LINE
    : deltaMode === 2
      ? deltaY * Math.max(1, pageHeight)
      : deltaY;

  return clamp(pixelDelta * WHEEL_SENSITIVITY, -MAX_SCALE_STEP, MAX_SCALE_STEP);
}

export function dampedValue(
  current: number,
  target: number,
  deltaSeconds: number,
  response = 7,
): number {
  const boundedDelta = clamp(deltaSeconds, 0, 0.1);
  return current + (target - current) * (1 - Math.exp(-response * boundedDelta));
}

export function adaptiveCanvasPixelRatio(
  width: number,
  height: number,
  devicePixelRatio: number,
  pixelBudget = 1_250_000,
): number {
  const pixelBudgetRatio = Math.sqrt(pixelBudget / Math.max(1, width * height));
  return Math.max(0.75, Math.min(devicePixelRatio || 1, 2, pixelBudgetRatio));
}

export interface AdaptiveRenderQuality {
  resolutionScale: number;
  atmosphericFramesPerSecond: number;
  consecutiveSlowFrames: number;
  consecutiveFastFrames: number;
}

export const INITIAL_RENDER_QUALITY: AdaptiveRenderQuality = Object.freeze({
  resolutionScale: 1,
  atmosphericFramesPerSecond: 15,
  consecutiveSlowFrames: 0,
  consecutiveFastFrames: 0,
});

export function nextAdaptiveRenderQuality(
  current: AdaptiveRenderQuality,
  renderMilliseconds: number,
): AdaptiveRenderQuality {
  if (!Number.isFinite(renderMilliseconds) || renderMilliseconds < 0) return current;
  if (renderMilliseconds > 28) {
    const consecutiveSlowFrames = current.consecutiveSlowFrames + 1;
    if (consecutiveSlowFrames < 2) {
      return { ...current, consecutiveSlowFrames, consecutiveFastFrames: 0 };
    }
    if (current.resolutionScale > 0.56) {
      const resolutionScale = Math.max(0.55, current.resolutionScale * 0.78);
      return {
        resolutionScale,
        atmosphericFramesPerSecond: Math.min(
          current.atmosphericFramesPerSecond,
          resolutionScale <= 0.56 ? 10 : resolutionScale < 0.7 ? 12 : 15,
        ),
        consecutiveSlowFrames: 0,
        consecutiveFastFrames: 0,
      };
    }
    return {
      resolutionScale: current.resolutionScale,
      atmosphericFramesPerSecond: Math.max(8, current.atmosphericFramesPerSecond - 2),
      consecutiveSlowFrames: 0,
      consecutiveFastFrames: 0,
    };
  }
  if (renderMilliseconds < 12) {
    const consecutiveFastFrames = current.consecutiveFastFrames + 1;
    if (consecutiveFastFrames < 240) {
      return { ...current, consecutiveSlowFrames: 0, consecutiveFastFrames };
    }
    if (current.atmosphericFramesPerSecond < 15) {
      return {
        ...current,
        atmosphericFramesPerSecond: current.atmosphericFramesPerSecond + 1,
        consecutiveSlowFrames: 0,
        consecutiveFastFrames: 0,
      };
    }
    return {
      ...current,
      resolutionScale: Math.min(1, current.resolutionScale + 0.08),
      consecutiveSlowFrames: 0,
      consecutiveFastFrames: 0,
    };
  }
  return { ...current, consecutiveSlowFrames: 0, consecutiveFastFrames: 0 };
}
