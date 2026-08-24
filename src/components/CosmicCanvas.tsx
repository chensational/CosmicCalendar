import { useEffect, useRef } from 'react';
import { wheelDeltaToScaleStep } from '../core/interaction';
import type { HorizonSnapshot, LunarHorizonSnapshot, SolarSystemSnapshot } from '../core/types';
import { renderCosmicFrame } from './canvasRenderer';

export interface CosmicCanvasProps {
  horizon: HorizonSnapshot;
  lunar: LunarHorizonSnapshot;
  solar: SolarSystemSnapshot;
  scalePosition: number;
  cosmicAgeYears: number;
  reducedMotion: boolean;
  onWheel: (deltaY: number) => void;
}

export function CosmicCanvas({
  horizon,
  lunar,
  solar,
  scalePosition,
  cosmicAgeYears,
  reducedMotion,
  onWheel,
}: CosmicCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const targetScaleRef = useRef(scalePosition);
  const displayScaleRef = useRef(scalePosition);
  const frameRef = useRef({ horizon, lunar, solar, cosmicAgeYears, reducedMotion });

  targetScaleRef.current = scalePosition;
  frameRef.current = { horizon, lunar, solar, cosmicAgeYears, reducedMotion };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) return;
    let animationFrame = 0;
    let visible = true;
    let width = 1;
    let height = 1;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, Math.floor(rect.width));
      height = Math.max(1, Math.floor(rect.height));
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = (timestamp: number) => {
      const state = frameRef.current;
      displayScaleRef.current += (targetScaleRef.current - displayScaleRef.current) *
        (state.reducedMotion ? 1 : 0.1);
      renderCosmicFrame({
        context,
        width,
        height,
        scalePosition: displayScaleRef.current,
        elapsedSeconds: state.reducedMotion ? 0 : timestamp / 1000,
        ...state,
      });
      if (visible && !state.reducedMotion) animationFrame = window.requestAnimationFrame(draw);
    };

    const renderOnce = () => {
      window.cancelAnimationFrame(animationFrame);
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
    resizeObserver.observe(canvas);
    intersectionObserver.observe(canvas);
    resize();
    renderOnce();

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!reducedMotion) return;
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d', { alpha: false });
    if (!canvas || !context) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    displayScaleRef.current = scalePosition;
    renderCosmicFrame({
      context,
      width: rect.width,
      height: rect.height,
      scalePosition,
      elapsedSeconds: 0,
      horizon,
      lunar,
      solar,
      cosmicAgeYears,
      reducedMotion,
    });
  }, [cosmicAgeYears, horizon, lunar, reducedMotion, scalePosition, solar]);

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
