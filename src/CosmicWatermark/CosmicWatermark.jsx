// @ts-nocheck
import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { resolveCosmicWatermarkPreset } from './cosmicWatermarkPresets.cjs';
import { createCosmicWatermarkScene } from './cosmicWatermarkRenderer.cjs';
import { isAutomatedBrowserSession } from './devBrowserAuth.js';

const COSMIC_WATERMARK_SHELL_STYLE = Object.freeze({
  position: 'relative',
  isolation: 'isolate',
  minWidth: 0,
});

const COSMIC_WATERMARK_CONTENT_STYLE = Object.freeze({
  position: 'relative',
  zIndex: 1,
  minWidth: 0,
});
const COSMIC_WATERMARK_INIT_FRAME_DELAY = 4;
const COSMIC_WATERMARK_INIT_IDLE_TIMEOUT_MS = 1600;

function joinClassNames(...classNames){
  return classNames.filter(Boolean).join(' ');
}

function canUseBrowserMedia(){
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function';
}

function getReducedMotionPreference(){
  if (!canUseBrowserMedia()) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function usePrefersReducedMotion(){
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(getReducedMotionPreference);

  useEffect(() => {
    if (!canUseBrowserMedia()) return undefined;

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleChange = () => setPrefersReducedMotion(mediaQuery.matches);

    handleChange();
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }

    mediaQuery.addListener?.(handleChange);
    return () => mediaQuery.removeListener?.(handleChange);
  }, []);

  return prefersReducedMotion;
}

function getClampedDevicePixelRatio(){
  if (typeof window === 'undefined') return 1;
  return Math.max(1, Math.min(1.5, Number(window.devicePixelRatio) || 1));
}

function scheduleCosmicWatermarkInitialization(callback, { delayMs = 0 } = {}){
  if (typeof callback !== 'function' || typeof window === 'undefined') return () => {};

  let cancelled = false;
  let animationFrameId = 0;
  let fallbackTimeoutId = 0;
  let idleCallbackId = 0;
  let delayTimeoutId = 0;
  const normalizedDelayMs = Math.max(0, Number(delayMs) || 0);

  const runInitialization = () => {
    animationFrameId = 0;
    fallbackTimeoutId = 0;
    if (cancelled) return;

    if (typeof window.requestIdleCallback === 'function') {
      idleCallbackId = window.requestIdleCallback(() => {
        idleCallbackId = 0;
        if (!cancelled) callback();
      }, { timeout: COSMIC_WATERMARK_INIT_IDLE_TIMEOUT_MS });
      return;
    }

    callback();
  };

  const waitForStartupFrames = (remainingFrames) => {
    if (cancelled) return;
    if (remainingFrames <= 0) {
      if (normalizedDelayMs > 0 && typeof window.setTimeout === 'function') {
        delayTimeoutId = window.setTimeout(() => {
          delayTimeoutId = 0;
          runInitialization();
        }, normalizedDelayMs);
        return;
      }
      runInitialization();
      return;
    }

    if (typeof window.requestAnimationFrame === 'function') {
      animationFrameId = window.requestAnimationFrame(() => {
        waitForStartupFrames(remainingFrames - 1);
      });
      return;
    }

    fallbackTimeoutId = window.setTimeout(() => {
      waitForStartupFrames(remainingFrames - 1);
    }, 16);
  };

  waitForStartupFrames(COSMIC_WATERMARK_INIT_FRAME_DELAY);

  return () => {
    cancelled = true;
    if (animationFrameId && typeof window.cancelAnimationFrame === 'function') {
      window.cancelAnimationFrame(animationFrameId);
    }
    if (fallbackTimeoutId && typeof window.clearTimeout === 'function') {
      window.clearTimeout(fallbackTimeoutId);
    }
    if (delayTimeoutId && typeof window.clearTimeout === 'function') {
      window.clearTimeout(delayTimeoutId);
    }
    if (idleCallbackId && typeof window.cancelIdleCallback === 'function') {
      window.cancelIdleCallback(idleCallbackId);
    }
  };
}

function resolveCanvasConstellationEntries({
  canvasClassName,
  canvasStyle,
  constellation,
  constellationSet,
  preset,
  presetOverrides,
}){
  if (!Array.isArray(constellationSet) || constellationSet.length === 0) {
    return [{
      blendMode: undefined,
      canvasClassName,
      canvasStyle,
      key: preset.key,
      preset,
    }];
  }

  return constellationSet
    .filter(Boolean)
    .map((entry, index) => {
      const entryConstellation = entry.constellation || constellation;
      const entryOverrides = entry.overrides && typeof entry.overrides === 'object'
        ? entry.overrides
        : {};
      const entryPreset = resolveCosmicWatermarkPreset(entryConstellation, {
        ...presetOverrides,
        ...entryOverrides,
      });

      return {
        blendMode: entry.blendMode,
        canvasClassName: joinClassNames(canvasClassName, entry.canvasClassName),
        canvasStyle: entry.canvasStyle || canvasStyle,
        key: `${entryPreset.key}-${index}`,
        preset: entryPreset,
      };
    });
}

function CosmicWatermarkCanvas({
  blendMode,
  canvasClassName,
  canvasStyle,
  initializationDelayMs = 0,
  preset,
}){
  const hostRef = useRef(null);
  const prefersReducedMotion = usePrefersReducedMotion();
  const hostStyle = useMemo(() => ({
    position: 'absolute',
    inset: 0,
    zIndex: 2,
    pointerEvents: 'none',
    overflow: 'hidden',
    opacity: preset.opacity,
    contain: 'paint',
    mixBlendMode: blendMode || preset.blendMode || 'multiply',
    maskImage: preset.mask,
    WebkitMaskImage: preset.mask,
    ...canvasStyle,
  }), [blendMode, canvasStyle, preset.blendMode, preset.mask, preset.opacity]);

  useEffect(() => {
  const host = hostRef.current;
  if (!host || isAutomatedBrowserSession()) return undefined;

  let controller = null;
  let disposed = false;
    let frameId = 0;
    let visibleInViewport = true;
    let documentVisible = typeof document === 'undefined' || document.visibilityState !== 'hidden';
    let resizeObserver = null;
    let intersectionObserver = null;
    let removeResizeFallback = null;

    const stopLoop = () => {
      if (frameId && typeof window !== 'undefined') {
        window.cancelAnimationFrame(frameId);
      }
      frameId = 0;
    };

    const renderStaticFrame = () => {
      if (!controller) return;
      controller.resize();
      controller.updateRotation(0);
      controller.render();
    };

    const shouldAnimate = () =>
      !disposed &&
      !prefersReducedMotion &&
      visibleInViewport &&
      documentVisible &&
      typeof window !== 'undefined' &&
      typeof window.requestAnimationFrame === 'function';

    const tick = (timestamp) => {
      if (!controller || !shouldAnimate()) {
        frameId = 0;
        return;
      }

      controller.updateRotation(timestamp / 1000);
      controller.render();
      frameId = window.requestAnimationFrame(tick);
    };

    const startLoop = () => {
      if (!controller) return;
      if (!shouldAnimate()) {
        stopLoop();
        renderStaticFrame();
        return;
      }
      if (!frameId) frameId = window.requestAnimationFrame(tick);
    };

    const handleResize = () => {
      renderStaticFrame();
      startLoop();
    };

    const handleVisibilityChange = () => {
      documentVisible = typeof document === 'undefined' || document.visibilityState !== 'hidden';
      if (!documentVisible) {
        stopLoop();
        return;
      }
      startLoop();
    };

  const cancelDeferredInitialization = scheduleCosmicWatermarkInitialization(() => {
    import('three')
      .then((THREE) => {
        if (disposed || !hostRef.current) return;

        controller = createCosmicWatermarkScene({
          THREE,
          host,
          preset,
          pixelRatio: getClampedDevicePixelRatio(),
        });

        if (typeof ResizeObserver === 'function') {
          resizeObserver = new ResizeObserver(handleResize);
          resizeObserver.observe(host);
        } else if (typeof window !== 'undefined') {
          window.addEventListener('resize', handleResize);
          removeResizeFallback = () => window.removeEventListener('resize', handleResize);
        }

        if (typeof IntersectionObserver === 'function') {
          intersectionObserver = new IntersectionObserver((entries) => {
            visibleInViewport = entries.some((entry) => entry.isIntersecting);
            if (!visibleInViewport) {
              stopLoop();
              return;
            }
            startLoop();
          });
          intersectionObserver.observe(host);
        }

        if (typeof document !== 'undefined') {
          document.addEventListener('visibilitychange', handleVisibilityChange);
        }

        renderStaticFrame();
        startLoop();
      })
 .catch(() => {
 // The watermark is decorative; a graphics-load failure must not block Apollo workflows.
 });
 }, { delayMs: initializationDelayMs });

 return () => {
 disposed = true;
 cancelDeferredInitialization();
 stopLoop();
 resizeObserver?.disconnect();
 intersectionObserver?.disconnect();
      removeResizeFallback?.();
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
      controller?.dispose();
    };
  }, [initializationDelayMs, prefersReducedMotion, preset]);

  return (
    <div
      ref={hostRef}
      aria-hidden="true"
      className={joinClassNames('apollo-cosmic-watermark-canvas', canvasClassName)}
      data-cosmic-watermark-canvas={preset.key}
      style={hostStyle}
    />
  );
}

function CosmicWatermark({
  blendMode,
  canvasClassName,
  canvasStyle,
  cameraOrbitPolarSpeed,
  cameraOrbitRadius,
  cameraOrbitSpeed,
  children,
  className,
  constellation,
  constellationSet,
  contentStyle,
  contentClassName,
  density,
  depth,
  disabled = false,
  fitMode,
  initializationDelayMs = 0,
  lineGap,
  lineInsetRatio,
  lineLengthRatio,
  lineColor,
  lineOpacity,
  mask,
  maxConnectionsPerStar,
  maxEdgeLength,
  opacity,
  position,
  rotation,
  rotationSpeed,
  scale,
  spaceScale,
  spread,
  starColor,
  starOpacity,
  starSize,
  starSizeMin,
  starSizeMax,
  stretch,
  style,
  systemCount,
  systemRadius,
}){
  const presetOverrides = useMemo(() => ({
    cameraOrbitPolarSpeed,
    cameraOrbitRadius,
    cameraOrbitSpeed,
    density,
    depth,
    fitMode,
    lineGap,
    lineInsetRatio,
    lineLengthRatio,
    lineColor,
    lineOpacity,
    mask,
    maxConnectionsPerStar,
    maxEdgeLength,
    opacity,
    position,
    rotation,
    rotationSpeed,
    scale,
    spaceScale,
    spread,
    starColor,
    starOpacity,
    starSize,
    starSizeMin,
    starSizeMax,
    stretch,
    systemCount,
    systemRadius,
  }), [
    cameraOrbitPolarSpeed,
    cameraOrbitRadius,
    cameraOrbitSpeed,
    density,
    depth,
    fitMode,
    lineGap,
    lineInsetRatio,
    lineLengthRatio,
    lineColor,
    lineOpacity,
    mask,
    maxConnectionsPerStar,
    maxEdgeLength,
    opacity,
    position,
    rotation,
    rotationSpeed,
    scale,
    spaceScale,
    spread,
    starColor,
    starOpacity,
    starSize,
    starSizeMin,
    starSizeMax,
    stretch,
    systemCount,
    systemRadius,
  ]);
  const preset = useMemo(() => resolveCosmicWatermarkPreset(constellation, presetOverrides), [
    constellation,
    presetOverrides,
  ]);
  const canvasEntries = useMemo(() => resolveCanvasConstellationEntries({
    canvasClassName,
    canvasStyle,
    constellation,
    constellationSet,
    preset,
    presetOverrides,
  }), [
    canvasClassName,
    canvasStyle,
    constellation,
    constellationSet,
    preset,
    presetOverrides,
  ]);

  return (
    <div
      className={joinClassNames('apollo-cosmic-watermark', className)}
      data-cosmic-watermark={preset.key}
      style={{
        ...COSMIC_WATERMARK_SHELL_STYLE,
        ...style,
      }}
    >
      <div
        className={joinClassNames('apollo-cosmic-watermark-content', contentClassName)}
        style={{
          ...COSMIC_WATERMARK_CONTENT_STYLE,
          ...contentStyle,
        }}
      >
        {children}
      </div>
      {!disabled && canvasEntries.map((entry) => (
        <CosmicWatermarkCanvas
          key={entry.key}
        blendMode={entry.blendMode || blendMode}
        canvasClassName={entry.canvasClassName}
        canvasStyle={entry.canvasStyle}
        initializationDelayMs={initializationDelayMs}
        preset={entry.preset}
      />
      ))}
    </div>
  );
}

export {
  CosmicWatermarkCanvas,
  scheduleCosmicWatermarkInitialization,
  usePrefersReducedMotion,
};

export default memo(CosmicWatermark);
