# Validation record

Run all locally available gates:

```bash
npm run build
npm run apple:test
cd apple && xcodegen generate --spec project.yml
```

## Automated coverage

- JPL Horizons DE441 Sun fixture from a real topocentric observer.
- 49-point Milky Way horizon band creation.
- Apollo 11 near-side Earth altitude, distance, and angular-size bounds.
- Nine planets and all 20 selected major satellites.
- Integrated-vs-JPL-seeded satellite model labeling.
- Satellite orbital-distance scale.
- Mercury fitted perihelion secular rate and reported GR excess.
- WGS84 equator/Wisconsin/pole ordering.
- Six-week civil calendar and lunar fraction bounds.
- Big Bang/inflation through `10^100`-year logarithmic timeline.
- ESM/CJS library and static demo production builds.
- C/Swift native build and eight-check verifier.

## External-infrastructure checks

- The published [CI run](https://github.com/chensational/CosmicCalendar/actions/runs/32682813440) passed the web build/tests, C/Swift verifier, and a full unsigned Xcode build of the macOS app plus WidgetKit extension.
- GitHub Pages deployed successfully and the [live demo](https://chensational.github.io/CosmicCalendar/) returns HTTPS 200.
- Device signing, App Group registration, and installation require the repository owner's Apple Developer team.
- Browser geolocation behavior requires an HTTPS origin (or localhost) and an explicit user grant.
