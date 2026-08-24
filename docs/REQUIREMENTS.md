# Requirement-to-evidence ledger

This ledger prevents completion from being inferred from a build alone.

| Goal requirement | Implementation evidence | Verification evidence | Status |
| --- | --- | --- | --- |
| Copy CosmicWatermark components into a folder in the current workspace | `../CosmicWatermark/` and `src/CosmicWatermark/` | Source checksums/provenance audit | Implemented |
| Public `chensational/CosmicCalendar` repository | [Public GitHub repository](https://github.com/chensational/CosmicCalendar) and workflows | GitHub visibility `PUBLIC`; main pushed | Verified |
| User location integration | `useObserverLocation`, `CosmicLocationStore` | Manual/device paths, local-only persistence | Implemented |
| Sun, Moon, and Milky Way relative to local horizon | `getHorizonSnapshot`, horizon canvas | JPL Sun fixture + 49 Galactic-plane samples | Verified |
| Realistic time-changing terrestrial Moon | embedded NASA LRO/WAC global albedo, topocentric IAU body frame, libration, apparent diameter, lunar-regolith scattering | LRO artifact hashes, JPL sub-observer/phase/diameter fixture, basis/scattering tests, browser visual audit | Verified at overview resolution; local relief shadows are not modeled |
| Realistic terrestrial stars | 9,096-record BSC5 binary, proper-motion/precession projection, extinction/color/scintillation renderer | Catalog checksum/count, Sirius coordinate comparison, hemisphere/extinction tests, Chromium visual audit | Verified within clear-sky model limits |
| Earth over Apollo 11 horizon | topocentric lunar-site vector, time-dependent IAU body frame, reciprocal physical phase | JPL Apollo-site azimuth/elevation/illumination/angular-size fixture | Verified reference-sphere model |
| All planets relative to Sun | `getSolarSystemSnapshot`, Solar scene | Nine-body presence and build tests | Verified in bounded ephemeris |
| Major satellites, changing and sunlit | 20-body catalog, integrated/JPL-seeded state propagation, eclipse test, Solar scene dots | Model-count/orbit-scale tests; pinned JPL artifact | Verified with per-model limits |
| Realistic time-changing planet features | corrected IAU body-fixed bases, supersampled spherical albedo shader, Lambert terminators, material highlights, projected/occluded Saturn rings | IAU rotation-sequence/axis/lighting tests, build/type tests, visual/performance audit | Verified procedural physical-lighting model; not cartographic texture imagery |
| Mercury precession | JPL secular perihelion + 42.98″/century GR excess | Century-rate unit test | Verified |
| Sun location and bob relative to Galactic core | 8.249 kpc, +20.8 pc, 224.2/87.8 Myr uncertain trail model | Published source ledger | Verified as uncertainty-aware model |
| Sun birth-to-present trail | Galactic canvas replay | Code/model source audit | Implemented; exact 4.567 Gyr backtrace is scientifically unavailable |
| Milky Way toward Great Attractor with expansion/Big Bang history | Laniākea flow field, expansion shells, explicit non-worldline label | Tully et al. source + non-claim audit | Implemented as illustrative reconstruction |
| Main animation and four scale sub-animations | Main canvas + scale rail | React production build and runtime audit | Implemented |
| Smooth scale transitions on scroll | normalized/capped native wheel input + spring target/crossfade canvas | interaction unit tests and browser wheel-event audit | Verified |
| Boundary fast-forward/rewind to heat death/inflation | boundary wheel logic + logarithmic epoch control | Timeline unit tests | Verified |
| Five dynamic distance statistics | `getDistanceMetrics` + expandable live console | WGS84 latitude tests and methods ledger | Verified as current-rate-equivalent models |
| Parenthetical CMB-relative totals | same metrics with `cmbFrameDistanceKm` | hierarchy verifier in JS/Swift | Verified as labeled scalar hierarchy models |
| Apple widgets first priority | native C/Swift core, four app and widget pairs | Swift verifier; generated Xcode project; unsigned full-Xcode app/widget builds across macOS, iOS/iPadOS, watchOS, and visionOS | Verified |
| Performant React component | ESM/CJS package, one bounded Canvas loop | production bundle sizes and build | Verified |
| Performance efficiency | adaptive DPR/frame/effect tiers, offscreen pause, reduced motion, lazy quantized catalog and cached paths | architecture audit, bundle output, ~2.1 ms catalog projection fixture, 4× CPU/software-Canvas mobile profile | Verified |
