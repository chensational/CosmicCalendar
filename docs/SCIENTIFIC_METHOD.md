# Scientific method and source ledger

## Evidence classes

The interface uses three explicit evidence classes:

1. **Ephemeris:** a calculated state at a civil date inside a tested validity interval.
2. **Measured/model constant:** a published estimate with an uncertainty or source-specific definition.
3. **Illustrative history/future:** a visual explanation whose exact trajectory cannot be inferred from present observations.

This distinction matters. An exact past path relative to the CMB, a unique Milky Way worldline beginning at the Big Bang, and an exact date of heat death are not available scientific observables. The calendar renders useful models without claiming otherwise.

## Earth horizon

`getHorizonSnapshot` uses topocentric apparent equatorial coordinates, Earth precession/nutation, aberration, sidereal rotation, and standard atmospheric refraction from Astronomy Engine 2.1.19. Galactic-longitude samples are transformed from the IAU Galactic frame into equatorial-of-date and then into local horizontal coordinates.

The implementation is cross-checked against [JPL Horizons](https://ssd.jpl.nasa.gov/horizons/manual.html). The committed fixture is:

| Field | Value |
| --- | --- |
| Target | Sun (10), DE441 |
| Observer | 43.0731° N, 89.4012° W, 270 m |
| UTC | 2026-08-23 00:00:00 |
| JPL airless apparent azimuth | 278.391508° |
| JPL airless apparent elevation | 7.895707° |
| Test tolerance | 0.2° azimuth, 0.3° elevation (normal refraction enabled in product) |

Astronomy Engine intentionally trades the weight of full JPL kernels for compact client code; its author documents errors up to about 0.4 arcminute for some optimized planetary calculations. Precision is suitable for unaided-sky orientation, not spacecraft navigation or occultation timing.

### Naked-eye star field

- The terrestrial sky uses all 9,096 stellar records with coordinates in the [Bright Star Catalogue, Fifth Revised Edition (V/50)](https://cdsarc.cds.unistra.fr/viz-bin/cat/V/50), rather than a randomized background. The catalog is pinned as a 160 KB binary with source and artifact hashes in `src/data/bright-stars.json`; `npm run stars:update` reproduces it from CDS.
- FK5 J2000 right ascension and declination advance by the catalog's projected proper motions. Astronomy Engine rotates the resulting unit vectors through precession/nutation into true equator-of-date before the observer's sidereal rotation projects them onto the local horizon.
- Standard-atmosphere density at observer elevation scales both refraction and a nominal clear-sky extinction coefficient. Relative optical air mass follows the [Kasten–Young 1989](https://doi.org/10.1364/AO.28.004735) approximation; catalog B−V indices plus differential low-altitude reddening select restrained visible colors.
- The extinction coefficient is a representative clear-sky value, not a local weather or light-pollution measurement. Clouds, aerosols, aurora, artificial sky glow, and terrain occlusion are not modeled. Star glyph radii are visibility encodings, not angular stellar diameters.

## Apollo 11 lunar horizon

- Tranquility Base uses the LRO-derived landing coordinates **0.67409° N, 23.47298° E** published by the [NASA Apollo 11 Lunar Surface Journal](https://history.nasa.gov/wp-content/uploads/static/history/alsj/a11/a11ov.html).
- Astronomy Engine supplies time-dependent lunar optical libration and Earth–Moon center distance.
- The sub-Earth selenographic point is converted to altitude/azimuth with spherical local-horizon geometry. Earth angular diameter uses `2 atan(R_Earth / distance)`.

Local lunar topography is not included, so “horizon” means the reference-sphere tangent plane at the landing coordinates.

## Solar System and illumination

### Planets

- Heliocentric positions are supplied by Astronomy Engine's VSOP-based compact model. For high-precision or out-of-range work, use [JPL Horizons](https://ssd-api.jpl.nasa.gov/doc/horizons.html); JPL explicitly separates lower-accuracy fitted [approximate planetary positions](https://ssd.jpl.nasa.gov/planets/approx_pos.html) from its numerical ephemerides.
- Planet markers use those integrated ephemeris positions. Their orbit guides use JPL's 3000 BCE–3000 CE fitted J2000 Keplerian elements, including eccentricity, inclination, node, and perihelion; the guides are contextual curves rather than a second position solver.
- Prime-meridian rotation and pole orientation use the IAU Working Group on Cartographic Coordinates and Rotational Elements 2015 formulas embedded by Astronomy Engine. The full north-pole/prime-meridian/east basis is transformed into the same J2000 ecliptic camera frame as the orbit scene.
- Planet discs are cached supersampled spheres. Each pixel maps through that body-fixed basis to latitude/longitude, applies recognizable procedural albedo regions (bands, storms, caps, clouds, continents), then uses a curved Lambertian terminator, limb response, and restrained material-specific specular term. These are physically lit procedural approximations, not cartographic image products.
- Saturn's rings use the IAU pole projected into the camera to derive opening angle and position angle; far and near ring halves render on opposite sides of the planet disc for correct occlusion. Ring widths and local body sizes remain exaggerated for overview legibility.
- Live surface rotation advances from that prime-meridian sample at each body's signed sidereal period. No decorative orbital or Galactic speed-up is applied: motions that are not perceptible in real time remain still, rather than being shown at an unlabeled fictional rate.
- Mercury's fitted longitude of perihelion uses the JPL secular element rate. The display separately reports the relativistic anomalous component, approximately **43 arcseconds/century**, as explained by [Einstein Online](https://www.einstein-online.info/en/spotlight/postnewton/).

### Major satellites

Twenty satellites are included: Moon; Phobos/Deimos; Io/Europa/Ganymede/Callisto; Mimas/Enceladus/Tethys/Dione/Rhea/Titan/Iapetus; Ariel/Umbriel/Titania/Oberon; Triton; and Charon.

- Moon and Galilean states use Astronomy Engine integrated models.
- The remaining satellites start from pinned ICRF state vectors fetched from JPL Horizons at `2026-08-23T00:00:00Z`, then propagate with a two-body universal-variable solver using each published mean orbital scale/period.
- Sunlight state uses the satellite ray, parent-body radius, and Sun direction to detect parent eclipse.
- Satellite orbit size is locally exaggerated in the overview so every location remains visible; direction and sunlit state are data-driven.

The JPL state snapshot is reproducible with `npm run ephemeris:update`. It is current-state accurate at its reference epoch, but the two-body satellites accumulate perturbation error away from that epoch. The public `model` field distinguishes `integrated` from `jpl-reference-kepler`. JPL's [planetary satellite service](https://ssd.jpl.nasa.gov/sats/) remains the authority for spacecraft-grade epochs and complete perturbations.

## Sun in the Milky Way

| Quantity | Adopted value | Evidence |
| --- | ---: | --- |
| Galactocentric radius | 8.249 kpc | GRAVITY Collaboration: 8249 ± 9(stat) ± 45(sys) pc ([ESO paper](https://elt.eso.org/public/archives/releases/sciencepapers/eso2006/eso2006a.pdf)) |
| Height above local mid-plane | +20.8 pc | Bennett & Bovy: 20.8 ± 0.3 pc ([paper](https://arxiv.org/abs/1809.03507)) |
| Local circular speed | 233.3 km/s | Rounded from Gaia-era estimate 233 ± 7 km/s ([paper](https://arxiv.org/abs/2309.02895)) |
| Azimuthal/orbital period | 224.2 Myr | 224.2 ± 22.3 Myr ([MNRAS](https://academic.oup.com/mnras/article/483/3/3971/5234256)) |
| Vertical oscillation period | 87.8 Myr | 87.8 ± 10.6 Myr in the same probabilistic Galactic model |

The displayed birth-to-present trail is a circular/vertical explanatory replay. The cited orbit study finds the Sun's modeled path becomes unpredictable after about 800 Myr because Galactic-potential uncertainty dominates. A precise 4.567-billion-year backtrace is therefore impossible; the interface labels the trail as a model.

## Laniākea, Great Attractor, and expansion

The flow field is based conceptually on the peculiar-velocity basin definition in Tully et al., [“The Laniakea supercluster of galaxies”](https://www.nature.com/articles/nature13674). That reconstruction removes mean Hubble expansion and maps present peculiar-velocity flow. It does **not** provide a measured Milky Way path back to the Big Bang.

The canvas therefore combines:

- expanding comoving shells for the background cosmology;
- present-day stylized Laniākea streamlines toward the Great Attractor region;
- a gold narrative trail whose caption explicitly says it is not a unique Big-Bang worldline.

## Cosmic timeline

- Universe age: approximately **13.8 billion years** ([NASA](https://science.nasa.gov/exoplanets/what-is-the-universe/)).
- Milky Way assembly age: approximately **13.6 billion years**, while acknowledging gradual assembly ([NASA/JPL](https://spaceplace.nasa.gov/galaxies-age/en/)).
- Solar/Earth formation: approximately 4.6 billion years ago ([NASA](https://science.nasa.gov/exoplanets/what-is-the-universe/)).
- The far-future `10^14` and `10^100` year anchors are order-of-magnitude narrative landmarks. They are not predictions with calendar-date precision. The heat-death endpoint follows the user's assumed scenario; alternate vacuum-decay and cosmological models exist.

The UI interpolates **logarithmically** between named epochs, preventing the first 13.8 billion years from collapsing into an invisible fraction of a linear `10^100`-year range.

## Distance model

### Local surface paths

Earth surface speed at geodetic latitude `φ` is calculated from the WGS84 prime-vertical radius:

```text
N(φ) = a / sqrt(1 − e² sin²φ)
r_parallel = N(φ) cosφ
v_surface = 2π r_parallel / sidereal_day
```

This is why an equatorial observer accumulates more rotational path than an observer in Wisconsin. The Apollo-site surface value uses lunar mean radius, landing latitude, and the current synchronous sidereal period.

### Hierarchy and CMB frame

Adopted present speeds are Earth orbit 29.78 km/s, Moon orbit 1.022 km/s, local Galactic circular speed 233.3 km/s, and Local Group/CMB speed **627 ± 22 km/s** from the COBE dipole result ([Kogut et al.](https://arxiv.org/abs/astro-ph/9312056)). NASA's [LAMBDA archive](https://lambda.gsfc.nasa.gov/education/lambda_graphics/cmb_dipole.html) documents subsequent Solar-system dipole measurements.

The main values are path length at present rate over the relevant modeled age. Parenthetical CMB values add hierarchical scalar path lengths over that same age. This is a transparent “current-rate-equivalent” comparison, not vector displacement or a recovered historical integral. Rotation rates, orbits, Galactic potential, and peculiar velocity changed; no factual exact total exists.

## Accuracy labels to preserve

Do not remove these qualifications from downstream UI:

- planetary ephemeris validity interval;
- satellite `model` discriminator;
- “modeled,” “present-rate-equivalent,” or equivalent wording for formation-age distance totals;
- “not a unique Big-Bang worldline” for the Laniākea trail;
- heat death as an assumed scenario.
