# Performance architecture

## React renderer

- A single Canvas 2D surface renders the active scale and cross-fades only one adjacent scale during transition.
- Backing resolution begins with device pixel ratio capped at 2 and the main scene held near a 1.25-million-pixel budget. A conservative quality controller combines synchronous render timing with the browser Long Tasks signal so deferred Canvas raster work is visible: sustained pressure can step backing resolution from 100% to 55%, transitions from 30 to 18 fps, and atmospheric motion from 15 to 8 fps. It recovers only after a long stable interval to avoid oscillation.
- Low quality tiers preserve planets, orbits, and bright catalog stars. They first omit the faintest star bucket, then the next-faintest bucket and scintillation, which cuts repeated path fills while keeping the recognizable sky.
- `IntersectionObserver` and Page Visibility stop the animation offscreen or in a background tab; `ResizeObserver` updates backing resolution only when necessary.
- Motion preference is honored. With reduced motion enabled, changes render a static frame instead of maintaining `requestAnimationFrame`.
- Transition damping is time-based rather than frame-based, so scale motion has the same timing on 24, 30, 60, and 120 Hz displays.
- Wheel input is normalized across pixel, line, and page delta modes, capped at 2% of one scale per event, and captured with a non-passive listener so interacting with the visualization does not scroll the document underneath it.
- The 9,096-record Bright Star Catalogue is a 160 KB quantized binary loaded asynchronously. Its full proper-motion/precession/horizon/extinction projection takes about 2.1 ms in the checked Chromium fixture every five seconds; only the resulting visible hemisphere is retained.
- Catalog star paths and Kepler orbit paths are generated once per state/size and reused. Space stars remain photometrically stable; only bright terrestrial stars receive altitude-sensitive scintillation.
- Astronomy is memoized by location and a five-second date bucket. Calendar and multi-billion-year distance models recalculate only when their inputs change.
- A one-minute finite-difference apparent-motion sample lets the renderer extrapolate Sun, Moon, Galactic plane, and lunar-Earth positions smoothly between five-second ephemeris buckets without invoking the astronomy engine per frame.
- The Solar System uses logarithmic orbit radii so all planets fit without unstable extreme transforms. Satellite offsets are locally exaggerated instead of increasing world-coordinate precision requirements.
- Planet surfaces rasterize into tiny 2× supersampled transparent canvases keyed by quantized pole, rotation, lighting, and screen radius. The expensive spherical lighting/albedo loop runs only on a cache miss; normal Solar frames use nine small `drawImage` calls.
- Major-satellite discs share that bounded cache. Their textures are normally only 12×12 pixels; after a state/lighting cache miss, all 20 satellites add 20 small `drawImage` calls rather than per-frame surface loops.
- The terrestrial Moon follows the same cache-first pattern. Its real 128×64 LRO luminance map occupies 8 KiB before base64 wrapping; only a roughly 36×36 supersampled disc is shaded on a quantized libration/phase cache miss, then normal frames use one `drawImage`.
- The present-day Sun uses a disk-cropped 96×96 SDO/HMI JPEG of roughly 2.3 KiB. Pages refreshes it at build time every three hours; it is embedded in the bundle, so no frame-time shading loop or third-party browser request is added. Historical/stale-date procedural solar textures are 4× supersampled, quantized to eight-minute epochs, and retained in a separate 24-entry FIFO cache.
- The Galactic scene generates its 760 deterministic visual particles, four mean arm guides, seven measured arm segments, and 641-point Solar replay once at module load. Per canvas size these collapse into 12 particle `Path2D` buckets, cached arm/dust paths, and short uncertainty-tiered trail batches. The entire fixed galaxy is then rasterized once into a DPR-aware offscreen surface (three-entry bound); normal frames draw that surface plus the revealed trail. Replay is capped at 8 fps while scale transitions retain the adaptive 18–30 fps tier.
- No third-party request occurs at runtime. The web demo makes one same-origin static catalog request; the compact SDO frame, JPL satellite seeds, and every astronomy model remain checked in or embedded at build time.

Current production output:

| Artifact | Raw | Gzip |
| --- | ---: | ---: |
| React library JS (ESM, including CosmicWatermark export) | ~236 KB | ~82 KB |
| Lazy star-catalog library chunk | ~218.5 KB | ~140 KB |
| Component CSS | ~13.5 KB | ~3.5 KB |
| Demo JS | ~348 KB | ~128 KB |
| Demo star-catalog binary | ~164 KB | n/a |

The inherited `CosmicWatermark` loads Three.js dynamically only when that optional decorative component is mounted; the main calendar stays on Canvas 2D because its vector workload remains comfortably bounded without a WebGL scene graph or texture uploads.

## Apple renderer

- Widget timelines contain five entries at 15-minute spacing and ask WidgetKit to reload at the end; the OS remains the final scheduler.
- Each entry performs deterministic local C calculations and stores only the resulting small value types.
- SwiftUI `Canvas` draws the native sky without texture assets or a render loop.
- The app asks Core Location for a one-shot kilometer-accuracy update, avoiding continuous GPS use.

## Why no Rust/WASM

A lower-level calculation core is used on Apple (the C Astronomy Engine), where it avoids JavaScript and supports native widgets. On the web, the same compact algorithms are already distributed as optimized JavaScript. Adding Rust/WASM would duplicate the ephemeris, increase download/initialization cost, and create cross-language consistency risk without solving a measured bottleneck.
