# Cosmic Calendar

**This moment has coordinates.** Cosmic Calendar is a location-aware observatory and calendar that moves smoothly from your horizon to the Solar System, the Milky Way, and the Laniākea flow field. It is delivered as both a reusable React component and native WidgetKit surfaces for every Apple platform that supports widgets.

![Cosmic Calendar Earth and Moon scale](docs/cosmic-calendar.png)

## What is here

- **Local horizon:** the real-time altitude and azimuth of the Sun, Moon, Galactic core, and sampled Milky Way plane for a device or manually entered location.
- **Tranquility Base:** Earth positioned above the Apollo 11 landing-site horizon using lunar libration.
- **Solar System:** all planets and 20 major satellites, physically directed illumination, IAU body rotation, procedural surface features, Saturn's ring tilt, and Mercury perihelion precession.
- **Galactic scale:** the Sun at the measured Galactic radius and height, with a modeled orbit/vertical-oscillation trail from Solar birth.
- **Cosmic scale:** a Laniākea velocity-flow visualization with a logarithmic timeline from inflation to an explicitly hypothetical heat-death horizon.
- **Calendar:** a six-week civil month with calculated lunar illumination for every day.
- **Distance console:** latitude-sensitive Earth travel, Tranquility Base, Earth/Sun, Sun/Galactic-center, and Local-Group/CMB model values, including transparent CMB-frame hierarchy estimates.
- **Apple:** shared C/Swift calculation core plus iPhone/iPad, macOS, watchOS, and visionOS app/widget targets.

## React quick start

```bash
npm install
npm run dev
```

As a library:

```tsx
import { CosmicCalendar } from '@chensational/cosmic-calendar';
import '@chensational/cosmic-calendar/styles.css';

export function Home() {
  return <CosmicCalendar />;
}
```

Optional initial coordinates never leave the component:

```tsx
<CosmicCalendar
  initialLocation={{
    latitude: 43.0731,
    longitude: -89.4012,
    elevationMeters: 270,
    label: 'Madison, Wisconsin',
  }}
/>
```

### Interaction

- Scroll **up** over the observatory to move inward: universe → Milky Way → Solar System → Earth/Moon.
- Scroll **down** to move outward.
- At the innermost boundary, continuing inward advances cosmic time toward the heat-death model.
- At the outermost boundary, continuing outward rewinds toward inflation.
- Arrow Up/Down provides the same interaction from the focused canvas.
- Reduced-motion preferences stop continuous motion while preserving every calculated view.

## Apple widgets

The checked-in `apple/CosmicCalendar.xcodeproj` contains app and WidgetKit targets for:

| Device family | App | Widgets |
| --- | --- | --- |
| iPhone / iPad | `CosmicCalendarPhone` | Home Screen, Lock Screen, StandBy |
| Mac | `CosmicCalendarMac` | Desktop and Notification Center |
| Apple Watch | `CosmicCalendarWatch` | Smart Stack and complications |
| Apple Vision Pro | `CosmicCalendarVision` | Windowed app and widgets |

Apple TV does not expose WidgetKit widget families, so it cannot host this widget. See [Apple setup and privacy](docs/APPLE.md). The native core uses the vendored C edition of Astronomy Engine and works without JavaScript, a server, or a network connection.

## Verification

```bash
npm run typecheck       # strict TypeScript
npm test                # calculation and JPL fixture tests
npm run build           # demo + ESM/CJS library bundles
npm run apple:test      # C/Swift build + standalone native verifier
```

The committed JPL fixture checks the Sun from Madison, Wisconsin at `2026-08-23T00:00:00Z`; web and native calculations agree with JPL Horizons DE441 within the documented refraction tolerance. Satellite seed states can be refreshed from JPL with `npm run ephemeris:update`.

## Scientific scope

Cosmic Calendar distinguishes **measured state**, **bounded ephemeris**, and **illustrative model**. It never presents an unknowable multi-billion-year path as an exact odometer.

- Modern Sun, Moon, and planet positions use [Astronomy Engine](https://github.com/cosinekitty/astronomy), calibrated against JPL numerical ephemerides. The UI declares a conservative 3000 BCE–3000 CE planetary display bound.
- Planetary-satellite reference states come from the [NASA/JPL Horizons API](https://ssd-api.jpl.nasa.gov/doc/horizons.html). The Moon and four Galilean satellites use integrated analytic models; the other 15 use JPL-seeded osculating Kepler propagation, clearly identified in the public data model.
- Galactic and cosmic history cannot be reconstructed as a unique trajectory. Those views are uncertainty-aware explanatory models, not astrometric ephemerides.
- “Distance traveled since formation” is not directly observable because rotation, orbits, and reference frames changed. Values therefore use cited formation ages and current-rate-equivalent integrations. Every row exposes its method.

See [Scientific method and source ledger](docs/SCIENTIFIC_METHOD.md) for constants, uncertainties, reference frames, and non-claims.

## Performance and privacy

- Canvas rendering is capped at 2× device pixel ratio and uses one visible animation loop.
- `ResizeObserver` and `IntersectionObserver` pause work offscreen.
- No texture downloads, telemetry, advertising, location API, or application server is required.
- Browser coordinates remain in local storage. Apple coordinates remain in the signed app group's `UserDefaults`.
- Production React library (including exported CosmicWatermark): approximately **59 KB gzip JavaScript + 3.5 KB gzip CSS** in the current build.

More detail: [Performance architecture](docs/PERFORMANCE.md).

## Repository map

```text
src/core/                 astronomy, satellite, time, calendar, distance models
src/components/           React UI and high-performance canvas renderer
src/CosmicWatermark/      copied Apollo CosmicWatermark components
src/data/                 pinned JPL reference state vectors
apple/                    native C/Swift core, apps, widgets, Xcode project
docs/                     methods, Apple setup, validation, requirements ledger
scripts/                  reproducible ephemeris data update
```

## License

Project code is MIT licensed. The vendored Astronomy Engine C source is also MIT licensed by Don Cross; see `NOTICE` and `apple/Sources/CAstronomyEngine/LICENSE`.
