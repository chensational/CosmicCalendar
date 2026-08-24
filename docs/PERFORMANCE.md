# Performance architecture

## React renderer

- A single Canvas 2D surface renders the active scale and cross-fades only one adjacent scale during transition.
- Device pixel ratio is capped at 2 to bound fill rate on Retina/HiDPI screens.
- `IntersectionObserver` stops the animation offscreen; `ResizeObserver` updates backing resolution only when necessary.
- Motion preference is honored. With reduced motion enabled, changes render a static frame instead of maintaining `requestAnimationFrame`.
- Astronomy is memoized by location and a five-second date bucket. Calendar and multi-billion-year distance models recalculate only when their inputs change.
- The Solar System uses logarithmic orbit radii so all planets fit without unstable extreme transforms. Satellite offsets are locally exaggerated instead of increasing world-coordinate precision requirements.
- No texture or ephemeris network request occurs at runtime. The JPL satellite seed is a compact checked-in JSON artifact.

Current production output:

| Artifact | Raw | Gzip |
| --- | ---: | ---: |
| React library JS (ESM, including CosmicWatermark export) | ~183 KB | ~59 KB |
| Component CSS | ~13.5 KB | ~3.5 KB |
| Demo JS | ~290 KB | ~100 KB |

The inherited `CosmicWatermark` loads Three.js dynamically only when that optional decorative component is mounted; the main calendar does not require WebGL or Three.js.

## Apple renderer

- Widget timelines contain five entries at 15-minute spacing and ask WidgetKit to reload at the end; the OS remains the final scheduler.
- Each entry performs deterministic local C calculations and stores only the resulting small value types.
- SwiftUI `Canvas` draws the native sky without texture assets or a render loop.
- The app asks Core Location for a one-shot kilometer-accuracy update, avoiding continuous GPS use.

## Why no Rust/WASM

A lower-level calculation core is used on Apple (the C Astronomy Engine), where it avoids JavaScript and supports native widgets. On the web, the same compact algorithms are already distributed as optimized JavaScript. Adding Rust/WASM would duplicate the ephemeris, increase download/initialization cost, and create cross-language consistency risk without solving a measured bottleneck.
