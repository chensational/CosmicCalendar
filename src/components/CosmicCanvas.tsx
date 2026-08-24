import { useEffect, useRef } from 'react';
import { adaptiveCanvasPixelRatio, dampedValue, wheelDeltaToScaleStep } from '../core/interaction';
import type { HorizonSnapshot, LunarHorizonSnapshot, SolarSystemSnapshot, VisibleStar } from '../core/types';
import { renderCosmicFrame } from './canvasRenderer';

export interface CosmicCanvasProps {
  horizon: HorizonSnapshot;
  lunar: LunarHorizonSnapshot;
  solar: SolarSystemSnapshot;
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
  const frameRef = useRef({ horizon, lunar, solar, stars, cosmicAgeYears, live, reducedMotion });
  const requestRenderRef = useRef<() => void>(() => undefined);

  targetScaleRef.current = scalePosition;
  frameRef.current = { horizon, lunar, solar, stars, cosmicAgeYears, live, reducedMotion };

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
    let transitionFrameIntervalMilliseconds = 1_000 / 30;
    let lastRenderedAt = 0;
    let lastAnimationAt = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, Math.floor(rect.width));
      height = Math.max(1, Math.floor(rect.height));
      // Keep enough backing pixels for fine orbit lines without spending Retina
      // fill-rate on more than the eye can resolve at this component size.
      const dpr = adaptiveCanvasPixelRatio(width, height, window.devicePixelRatio || 1);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      const backingPixels = canvas.width * canvas.height;
      transitionFrameIntervalMilliseconds = 1_000 / (backingPixels > 950_000 ? 24 : 30);
    };

    const draw = (timestamp: number) => {
      if (!visible || !pageVisible) return;
      const isTransitioning = Math.abs(targetScaleRef.current - displayScaleRef.current) > 0.0005;
      const frameIntervalMilliseconds = isTransitioning
        ? transitionFrameIntervalMilliseconds
        : Math.max(transitionFrameIntervalMilliseconds, 1_000 / 15);
      if (!frameRef.current.reducedMotion && timestamp - lastRenderedAt < frameIntervalMilliseconds) {
        animationFrame = window.requestAnimationFrame(draw);
        return;
      }
      const state = frameRef.current;
      const deltaSeconds = lastAnimationAt ? Math.min((timestamp - lastAnimationAt) / 1_000, 0.1) : 1 / 60;
      displayScaleRef.current = state.reducedMotion
        ? targetScaleRef.current
        : dampedValue(displayScaleRef.current, targetScaleRef.current, deltaSeconds);
      lastAnimationAt = timestamp;
      lastRenderedAt = timestamp;
      renderCosmicFrame({
        context,
        width,
        height,
        scalePosition: displayScaleRef.current,
        elapsedSeconds: state.reducedMotion ? 0 : timestamp / 1000,
        realtimeOffsetSeconds: state.live
          ? Math.max(0, Math.min((Date.now() - state.solar.date.getTime()) / 1_000, 120))
          : 0,
        ...state,
      });
      const transitioning = Math.abs(targetScaleRef.current - displayScaleRef.current) > 0.0005;
      const atmosphereIsActive = displayScaleRef.current < 0.5;
      if (visible && !state.reducedMotion && (transitioning || atmosphereIsActive)) {
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
    resizeObserver.observe(canvas);
    intersectionObserver.observe(canvas);
    document.addEventListener('visibilitychange', handleVisibility);
    requestRenderRef.current = renderOnce;
    resize();
    renderOnce();

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener('visibilitychange', handleVisibility);
      requestRenderRef.current = () => undefined;
    };
  }, []);

  useEffect(() => {
    requestRenderRef.current();
  }, [cosmicAgeYears, horizon, live, lunar, reducedMotion, scalePosition, solar, stars]);

  return (
    <canvas
      ref={canvasRef}
      className="cc-canvas"
      aria-label="Animated cosmic position visualization"
      role="img"
      tabIndex={0}
      onWheel={(event) => {
        event.preventDefault();
        onWheel(wheelDeltaToScaleStep(event.deltaY, event.deltaMode, event.currentTarget.clientHeight));
      }}
    />
  );
}
