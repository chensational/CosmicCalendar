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
