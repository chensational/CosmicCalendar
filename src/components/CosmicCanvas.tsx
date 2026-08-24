import { useEffect, useRef } from 'react';
import {
  adaptiveCanvasPixelRatio,
  dampedValue,
  INITIAL_RENDER_QUALITY,
  nextAdaptiveRenderQuality,
  wheelDeltaToScaleStep,
} from '../core/interaction';
import type { HorizonSnapshot, LunarHorizonSnapshot, SolarSystemSnapshot, VisibleStar } from '../core/types';
import type { SolarObservation } from '../hooks/useSolarObservation';
import { renderCosmicFrame } from './canvasRenderer';

export interface CosmicCanvasProps {
  horizon: HorizonSnapshot;
  lunar: LunarHorizonSnapshot;
  solar: SolarSystemSnapshot;
  solarObservation?: SolarObservation;
  stars: readonly VisibleStar[];
  scalePosition: number;
  cosmicAgeYears: number;
  live: boolean;
  reducedMotion: boolean;
  onWheel: (deltaY: number) => void;
}

export function CosmicCanvas({
  horizon,
  lunar,
  solar,
  solarObservation,
  stars,
  scalePosition,
  cosmicAgeYears,
  live,
  reducedMotion,
  onWheel,
}: CosmicCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const targetScaleRef = useRef(scalePosition);
  const displayScaleRef = useRef(scalePosition);
  const frameRef = useRef({ horizon, lunar, solar, solarObservation, stars, cosmicAgeYears, live, reducedMotion });
  const requestRenderRef = useRef<() => void>(() => undefined);
  const onWheelRef = useRef(onWheel);

  targetScaleRef.current = scalePosition;
  frameRef.current = { horizon, lunar, solar, solarObservation, stars, cosmicAgeYears, live, reducedMotion };
  onWheelRef.current = onWheel;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d', { alpha: false, desynchronized: true });
    if (!context) return;
    let animationFrame = 0;
    let visible = true;
    let pageVisible = !document.hidden;
    let width = 1;
    let height = 1;
    let basePixelRatio = 1;
    let quality = { ...INITIAL_RENDER_QUALITY };
    let backingResolutionDirty = false;
    let transitionFrameIntervalMilliseconds = 1_000 / 30;
    let lastRenderedAt = 0;
    let lastAnimationAt = 0;
    let recentLongTaskCount = 0;
    let longTaskResetTimer = 0;

    const adoptQuality = (nextQuality: typeof quality) => {
      if (nextQuality.resolutionScale !== quality.resolutionScale) {
        backingResolutionDirty = true;
      }
      quality = nextQuality;
      canvas.dataset.renderScale = quality.resolutionScale.toFixed(2);
      canvas.dataset.atmosphereFps = String(quality.atmosphericFramesPerSecond);
    };

    const applyBackingResolution = () => {
      const dpr = Math.max(0.55, basePixelRatio * quality.resolutionScale);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      const backingPixels = canvas.width * canvas.height;
      const transitionFramesPerSecond = quality.resolutionScale < 0.7
        ? 18
        : backingPixels > 950_000 ? 24 : 30;
      transitionFrameIntervalMilliseconds = 1_000 / transitionFramesPerSecond;
      canvas.dataset.renderScale = quality.resolutionScale.toFixed(2);
      canvas.dataset.atmosphereFps = String(quality.atmosphericFramesPerSecond);
      backingResolutionDirty = false;
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, Math.floor(rect.width));
      height = Math.max(1, Math.floor(rect.height));
      // Keep enough backing pixels for fine orbit lines without spending Retina
      // fill-rate on more than the eye can resolve at this component size.
      basePixelRatio = adaptiveCanvasPixelRatio(width, height, window.devicePixelRatio || 1);
      applyBackingResolution();
    };

    const draw = (timestamp: number) => {
      if (!visible || !pageVisible) return;
      const isTransitioning = Math.abs(targetScaleRef.current - displayScaleRef.current) > 0.0005;
      const galaxyReplayIsActive = displayScaleRef.current > 1.5 && displayScaleRef.current < 2.5;
      const continuousFramesPerSecond = galaxyReplayIsActive
        ? Math.min(8, quality.atmosphericFramesPerSecond)
        : quality.atmosphericFramesPerSecond;
      const frameIntervalMilliseconds = isTransitioning
        ? transitionFrameIntervalMilliseconds
        : Math.max(
          transitionFrameIntervalMilliseconds,
          1_000 / continuousFramesPerSecond,
        );
      if (!frameRef.current.reducedMotion && timestamp - lastRenderedAt < frameIntervalMilliseconds) {
        animationFrame = window.requestAnimationFrame(draw);
        return;
      }
      const state = frameRef.current;
      const deltaSeconds = lastAnimationAt ? Math.min((timestamp - lastAnimationAt) / 1_000, 0.1) : 1 / 60;
      displayScaleRef.current = state.reducedMotion
        ? targetScaleRef.current
        : dampedValue(displayScaleRef.current, targetScaleRef.current, deltaSeconds);
      if (backingResolutionDirty) applyBackingResolution();
      lastAnimationAt = timestamp;
      lastRenderedAt = timestamp;
      const renderStartedAt = performance.now();
      renderCosmicFrame({
        context,
        width,
        height,
        scalePosition: displayScaleRef.current,
        elapsedSeconds: state.reducedMotion ? 0 : timestamp / 1000,
        realtimeOffsetSeconds: state.live
          ? Math.max(0, Math.min((Date.now() - state.solar.date.getTime()) / 1_000, 120))
          : 0,
        renderQuality: quality.resolutionScale,
        pixelRatio: canvas.width / width,
        ...state,
      });
      const renderMilliseconds = performance.now() - renderStartedAt;
      canvas.dataset.renderMilliseconds = renderMilliseconds.toFixed(1);
      adoptQuality(nextAdaptiveRenderQuality(quality, renderMilliseconds));
      const transitioning = Math.abs(targetScaleRef.current - displayScaleRef.current) > 0.0005;
      const sceneHasContinuousMotion = displayScaleRef.current < 0.5 ||
        (displayScaleRef.current > 1.5 && displayScaleRef.current < 2.5);
      if (visible && !state.reducedMotion && (transitioning || sceneHasContinuousMotion)) {
        animationFrame = window.requestAnimationFrame(draw);
      }
    };

    const renderOnce = () => {
      window.cancelAnimationFrame(animationFrame);
      lastRenderedAt = 0;
      lastAnimationAt = 0;
      animationFrame = window.requestAnimationFrame(draw);
    };
    const resizeObserver = new ResizeObserver(() => {
      resize();
      renderOnce();
    });
    const intersectionObserver = new IntersectionObserver((entries) => {
      visible = entries.some((entry) => entry.isIntersecting);
      if (visible) renderOnce(); else window.cancelAnimationFrame(animationFrame);
    });
    const handleVisibility = () => {
      pageVisible = !document.hidden;
      if (pageVisible && visible) renderOnce(); else window.cancelAnimationFrame(animationFrame);
    };
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      onWheelRef.current(wheelDeltaToScaleStep(event.deltaY, event.deltaMode, canvas.clientHeight));
    };
    const longTaskObserver = typeof PerformanceObserver !== 'undefined' &&
      PerformanceObserver.supportedEntryTypes?.includes('longtask')
      ? new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!visible || !pageVisible) continue;
          recentLongTaskCount += entry.duration >= 100 ? 2 : 1;
          window.clearTimeout(longTaskResetTimer);
          longTaskResetTimer = window.setTimeout(() => { recentLongTaskCount = 0; }, 5_000);
          if (recentLongTaskCount < 2) continue;
          recentLongTaskCount = 0;
          // Long Tasks include deferred Canvas rasterization that is not visible
          // in the synchronous render call timing above.
          adoptQuality(nextAdaptiveRenderQuality(
            nextAdaptiveRenderQuality(quality, entry.duration),
            entry.duration,
          ));
        }
      })
      : undefined;
    resizeObserver.observe(canvas);
    intersectionObserver.observe(canvas);
    document.addEventListener('visibilitychange', handleVisibility);
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    longTaskObserver?.observe({ type: 'longtask', buffered: false });
    requestRenderRef.current = renderOnce;
    resize();
    renderOnce();

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener('visibilitychange', handleVisibility);
      canvas.removeEventListener('wheel', handleWheel);
      longTaskObserver?.disconnect();
      window.clearTimeout(longTaskResetTimer);
      requestRenderRef.current = () => undefined;
    };
  }, []);

  useEffect(() => {
    requestRenderRef.current();
  }, [cosmicAgeYears, horizon, live, lunar, reducedMotion, scalePosition, solar, solarObservation, stars]);

  return (
    <canvas
      ref={canvasRef}
      className="cc-canvas"
      aria-label="Animated cosmic position visualization"
      role="img"
      tabIndex={0}
    />
  );
}
