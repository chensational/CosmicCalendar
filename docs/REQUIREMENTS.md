# Requirement-to-evidence ledger

This ledger prevents completion from being inferred from a build alone.

| Goal requirement | Implementation evidence | Verification evidence | Status |
| --- | --- | --- | --- |
| Copy CosmicWatermark components into a folder in the current workspace | `../CosmicWatermark/` and `src/CosmicWatermark/` | Source checksums/provenance audit | Implemented |
| Public `chensational/CosmicCalendar` repository | [Public GitHub repository](https://github.com/chensational/CosmicCalendar) and workflows | GitHub visibility `PUBLIC`; main pushed | Verified |
| User location integration | `useObserverLocation`, `CosmicLocationStore` | Manual/device paths, local-only persistence | Implemented |
| Sun, Moon, and Milky Way relative to local horizon | `getHorizonSnapshot`, horizon canvas | JPL Sun fixture + 49 Galactic-plane samples | Verified |
| Earth over Apollo 11 horizon | `getLunarHorizonSnapshot`, lunar inset | Lunar distance/angular-size/altitude tests | Verified reference-sphere model |
| All planets relative to Sun | `getSolarSystemSnapshot`, Solar scene | Nine-body presence and build tests | Verified in bounded ephemeris |
| Major satellites, changing and sunlit | 20-body catalog, integrated/JPL-seeded state propagation, eclipse test, Solar scene dots | Model-count/orbit-scale tests; pinned JPL artifact | Verified with per-model limits |
| Realistic time-changing planet features | IAU prime meridians, planet-specific procedural surfaces, sun-direction terminator | Build/type tests and visual audit | Implemented; not cartographic texture imagery |
| Mercury precession | JPL secular perihelion + 42.98″/century GR excess | Century-rate unit test | Verified |
| Sun location and bob relative to Galactic core | 8.249 kpc, +20.8 pc, 224.2/87.8 Myr uncertain trail model | Published source ledger | Verified as uncertainty-aware model |
| Sun birth-to-present trail | Galactic canvas replay | Code/model source audit | Implemented; exact 4.567 Gyr backtrace is scientifically unavailable |
| Milky Way toward Great Attractor with expansion/Big Bang history | Laniākea flow field, expansion shells, explicit non-worldline label | Tully et al. source + non-claim audit | Implemented as illustrative reconstruction |
| Main animation and four scale sub-animations | Main canvas + scale rail | React production build and runtime audit | Implemented |
| Smooth scale transitions on scroll | spring target/crossfade canvas | Interaction code audit | Implemented |
| Boundary fast-forward/rewind to heat death/inflation | boundary wheel logic + logarithmic epoch control | Timeline unit tests | Verified |
| Five dynamic distance statistics | `getDistanceMetrics` + expandable live console | WGS84 latitude tests and methods ledger | Verified as current-rate-equivalent models |
| Parenthetical CMB-relative totals | same metrics with `cmbFrameDistanceKm` | hierarchy verifier in JS/Swift | Verified as labeled scalar hierarchy models |
| Apple widgets first priority | native C/Swift core, four app and widget pairs | Swift verifier; generated Xcode project; [unsigned full Xcode macOS app/widget build](https://github.com/chensational/CosmicCalendar/actions/runs/32682813440) | Verified |
| Performant React component | ESM/CJS package, one bounded Canvas loop | production bundle sizes and build | Verified |
| Performance efficiency | DPR cap, offscreen pause, reduced motion, offline data | architecture audit | Verified |
