import { clamp } from './math';

const PIXELS_PER_LINE = 16;
const WHEEL_SENSITIVITY = 0.0015;
const MAX_SCALE_STEP = 0.12;

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
