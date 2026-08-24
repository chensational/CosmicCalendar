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

### Solar photosphere

- Apparent solar diameter is calculated from the topocentric Sun range and the 695,700 km nominal radius. The IAU rotation pole is projected into the local horizontal frame, so the photosphere's north direction follows the real parallactic orientation rather than staying screen-up.
- Near the observation timestamp, the visible disc comes from the [NASA Solar Dynamics Observatory HMI continuum quicklook](https://sdo.gsfc.nasa.gov/data/). The source 256×256 JPEG is disk-cropped to 96×96 at build time, hash-pinned with its HTTP observation timestamp, refreshed by Pages every three hours, and embedded so the browser contacts no third party. The renderer refuses to use it more than 36 hours from the selected date.
- [NASA's photosphere description](https://solarscience.msfc.nasa.gov/surface.shtml) documents granulation, sunspots, limb darkening, and gaseous differential rotation; [NASA's Sun facts](https://science.nasa.gov/sun/facts/) gives the rounded 25-day equator and 36-day pole periods. The stale/historical fallback therefore combines a quadratic visible-continuum limb response, eight-minute evolving granulation, bounded active-latitude spots with growth/decay, and latitude-dependent 25–36 day rotation. These fallback active regions are physically informed but synthetic, and the UI labels them `PHYSICAL PROCEDURAL FALLBACK`.
- The solar pole and central-meridian basis follows the [IAU Working Group](https://aa.usno.navy.mil/downloads/reports/Archinaletal2011a.pdf) α₀ = 286.13°, δ₀ = 63.87°, W = 84.176° + 14.1844°d convention through Astronomy Engine. The SDO product is Earth-facing; using its tiny disc in the Solar-System overview does not claim knowledge of the unobserved far side.

### Lunar disc

- The observed Moon-to-site and Moon-to-Sun vectors are calculated topocentrically. Their dot product gives the physical solar phase angle and illuminated fraction; apparent diameter uses topocentric range rather than a geocentric constant.
- The lunar north pole and prime meridian use Astronomy Engine's IAU rotation model. The standard IAU `α₀, δ₀, W` rotation sequence maps every visible pixel into selenographic longitude/latitude, while the projected pole fixes north against the local horizon. This makes optical/physical libration visible instead of rotating a static glyph.
- Surface brightness samples a reproducible 128×64 luminance reduction of NASA SVS's [LRO/WAC CGI Moon Kit color mosaic](https://svs.gsfc.nasa.gov/4720/). Source and generated SHA-256 hashes are pinned in `src/data/moon-albedo.json`; `npm run moon:update` rebuilds the 8 KiB map.
- The terminator uses a 92/8 Lommel–Seeliger/Lambert mixture. Lommel–Seeliger single scattering is appropriate for dark particulate regolith and avoids the exaggerated limb darkening of a Lambert sphere; the [USGS ISIS photometry documentation](https://isis.astrogeology.usgs.gov/Isis2/html/photomet.html) identifies it as the lunar scattering model.
- This is global albedo at overview resolution. It does not include local LOLA elevation, cast crater shadows, atmospheric seeing, terrain occultation, or a weather-dependent sky point-spread function.

The committed Madison fixture at `2026-08-07T17:00:00Z` uses Horizons target 301 quantities 4, 10, 13, 14, 17, and 32. Against the high-precision `MOON_ME` frame, the compact result differs by approximately 0.003° in sub-observer longitude, 0.002° in latitude, 0.001 percentage point in illuminated fraction, and 0.13 arcsecond in apparent diameter.

### Naked-eye star field

- The terrestrial sky uses all 9,096 stellar records with coordinates in the [Bright Star Catalogue, Fifth Revised Edition (V/50)](https://cdsarc.cds.unistra.fr/viz-bin/cat/V/50), rather than a randomized background. The catalog is pinned as a 160 KB binary with source and artifact hashes in `src/data/bright-stars.json`; `npm run stars:update` reproduces it from CDS.
- FK5 J2000 right ascension and declination advance by the catalog's projected proper motions. Astronomy Engine rotates the resulting unit vectors through precession/nutation into true equator-of-date before the observer's sidereal rotation projects them onto the local horizon.
- Standard-atmosphere density at observer elevation scales both refraction and a nominal clear-sky extinction coefficient. Relative optical air mass follows the [Kasten–Young 1989](https://doi.org/10.1364/AO.28.004735) approximation; catalog B−V indices plus differential low-altitude reddening select restrained visible colors.
- The extinction coefficient is a representative clear-sky value, not a local weather or light-pollution measurement. Clouds, aerosols, aurora, artificial sky glow, and terrain occlusion are not modeled. Star glyph radii are visibility encodings, not angular stellar diameters.

## Apollo 11 lunar horizon

- Tranquility Base uses the LRO-derived landing coordinates **0.67409° N, 23.47298° E** published by the [NASA Apollo 11 Lunar Surface Journal](https://history.nasa.gov/wp-content/uploads/static/history/alsj/a11/a11ov.html).
- The lunar site's IAU body-fixed normal is added to the integrated Earth–Moon center vector. The resulting site-to-Earth vector is converted to altitude/azimuth with spherical local-horizon geometry; its topocentric range determines angular diameter.
- Earth illumination is calculated at Earth from its Sun and lunar-site vectors, rather than assuming it is exactly complementary to the Moon seen from an unrelated terrestrial observer.

The `2026-08-23T00:00:00Z` fixture uses Horizons target 399 from Apollo 11 coordinates on body 301. JPL returns azimuth 283.106874°, elevation 66.226714°, 23.96300% illumination, and 6532.976 arcseconds apparent diameter; the compact model is checked directly against all four quantities.

Local lunar topography is not included, so “horizon” means the reference-sphere tangent plane at the landing coordinates.

## Solar System and illumination

### Planets

- Heliocentric positions are supplied by Astronomy Engine's VSOP-based compact model. For high-precision or out-of-range work, use [JPL Horizons](https://ssd-api.jpl.nasa.gov/doc/horizons.html); JPL explicitly separates lower-accuracy fitted [approximate planetary positions](https://ssd.jpl.nasa.gov/planets/approx_pos.html) from its numerical ephemerides.
- Planet markers rotate their integrated EQJ vectors into the same fixed J2000 ecliptic frame used by JPL's 3000 BCE–3000 CE fitted Keplerian orbit guides. This avoids mixing true-ecliptic-of-date positions with J2000 axes and satellite states. The guides include eccentricity, inclination, node, and perihelion and remain contextual curves rather than a second position solver.
- Prime-meridian rotation and pole orientation use the IAU Working Group on Cartographic Coordinates and Rotational Elements formulas embedded by Astronomy Engine. The standard `R₃(W) R₁(90°−δ₀) R₃(90°+α₀)` ordering constructs the full north-pole/prime-meridian/east basis before it is transformed into the same J2000 ecliptic camera frame as the orbit scene.
- Planet discs are cached supersampled spheres. Each pixel maps through that body-fixed basis to latitude/longitude, applies recognizable procedural albedo regions (bands, storms, caps, clouds, continents), then uses a curved Lambertian terminator, limb response, and restrained material-specific specular term. These are physically lit procedural approximations, not cartographic image products.
- Saturn's rings use the IAU pole projected into the camera to derive opening angle and position angle; far and near ring halves render on opposite sides of the planet disc for correct occlusion. Ring widths and local body sizes remain exaggerated for overview legibility.
- Live surface rotation advances from that prime-meridian sample at each body's signed sidereal period. No decorative orbital or Galactic speed-up is applied: motions that are not perceptible in real time remain still, rather than being shown at an unlabeled fictional rate.
- Mercury's fitted longitude of perihelion uses the JPL secular element rate. The display separately reports the relativistic anomalous component, approximately **43 arcseconds/century**, as explained by [Einstein Online](https://www.einstein-online.info/en/spotlight/postnewton/).

### Major satellites

Twenty satellites are included: Moon; Phobos/Deimos; Io/Europa/Ganymede/Callisto; Mimas/Enceladus/Tethys/Dione/Rhea/Titan/Iapetus; Ariel/Umbriel/Titania/Oberon; Triton; and Charon.

- Moon and Galilean position/velocity states use Astronomy Engine integrated models. The remaining satellites start from pinned ICRF state vectors fetched from JPL Horizons at `2026-08-23T00:00:00Z`, then propagate with a two-body universal-variable solver using each published mean orbital scale/period.
- Every ICRF relative position, velocity, and synchronous body basis is rotated into the same J2000 ecliptic camera frame as its parent. The instantaneous orbital angular momentum supplies the pole; the prime meridian points toward the parent, matching tidal locking. One-second finite-difference tests cover all 20 returned velocities.
- Eclipse state treats the Sun and parent as finite angular discs. Analytic circle overlap yields a continuous direct-sun fraction for full illumination, penumbra, umbra, and the annular case instead of a point-Sun boolean shadow.
- Each overview moon is a cached supersampled sphere with a physically curved terminator. Restrained procedural cues follow spacecraft-observed global appearance: sulfurous Io, cracked Europa, grooved Ganymede, cratered Callisto, bright Enceladus, orange-haze Titan, two-tone Iapetus, nitrogen-frost Triton, and Charon's red pole. NASA source summaries include [Europa/Ganymede/Callisto](https://science.nasa.gov/science-research/europa-ganymede-and-callisto-surface-comparison-at-high-spatial-resolution/), [Iapetus](https://science.nasa.gov/saturn/moons/iapetus/), [Titan](https://science.nasa.gov/saturn/moons/titan/facts/), [Triton](https://science.nasa.gov/neptune/moons/triton/), and [Charon](https://science.nasa.gov/dwarf-planets/pluto/moons/charon/).
- Satellite orbit radius and disc size are locally exaggerated in the overview so every location and phase remains visible. Direction, visible terminator, synchronous orientation, and sunlight fraction are data-driven; the tiny surface cues are not cartographic mosaics.

The JPL state snapshot is reproducible with `npm run ephemeris:update`. It is current-state accurate at its reference epoch, but the two-body satellites accumulate perturbation error away from that epoch. The public `model` field distinguishes `integrated` from `jpl-reference-kepler`. JPL's [planetary satellite service](https://ssd.jpl.nasa.gov/sats/) remains the authority for spacecraft-grade epochs and complete perturbations.

## Sun in the Milky Way

| Quantity | Adopted value | Evidence |
| --- | ---: | --- |
| Galactocentric radius | 8.249 kpc | GRAVITY Collaboration: 8249 ± 9(stat) ± 45(sys) pc ([ESO paper](https://elt.eso.org/public/archives/releases/sciencepapers/eso2006/eso2006a.pdf)) |
| Height above local mid-plane | +20.8 pc | Bennett & Bovy: 20.8 ± 0.3 pc ([paper](https://arxiv.org/abs/1809.03507)) |
| Local circular speed | 233.3 km/s | Rounded from Gaia-era estimate 233 ± 7 km/s ([paper](https://arxiv.org/abs/2309.02895)) |
| Mass-weighted stellar-disc scale length | 2.15 kpc | 2.15 ± 0.14 kpc from 16,269 SEGUE G dwarfs ([Bovy & Rix](https://iopscience.iop.org/article/10.1088/0004-637X/779/2/115)) |
| Bar half-length / angle | 5.0 kpc / 30° adopted | 5.0 ± 0.2 kpc and 28°–33° from infrared red-clump surveys ([Wegg, Gerhard & Portail](https://academic.oup.com/mnras/article/450/4/4050/989881)) |
| Major-arm mean pitch | 10° | Four-arm, VLBI-maser fit; individual segments retain measured kinks and widths ([Reid et al.](https://iopscience.iop.org/article/10.3847/1538-4357/ab4a11)) |
| Azimuthal/orbital period | 224.2 Myr | 224.2 ± 22.3 Myr ([MNRAS](https://academic.oup.com/mnras/article/483/3/3971/5234256)) |
| Radial epicycle period | 163.2 Myr | 163.2 ± 16.7 Myr in the same probabilistic Galactic model |
| Vertical oscillation period | 87.8 Myr | 87.8 ± 10.6 Myr in the same probabilistic Galactic model |

The face-on canvas is a structural inference, not a photograph from outside the Galaxy. Seven solid arm segments reproduce the kink radii, before/after pitch angles, azimuth ranges, and intrinsic widths in Reid et al. Table 2. A faint four-arm guide extrapolates the paper's 10° length-weighted mean only to make the uncertain far side legible. The bar uses the midpoint of the measured angle range, and a 760-point deterministic field samples the exponential disc, bar, and young arm populations as a visibility texture—not as 760 catalogued stars.

The birth-to-present Solar trail now combines the measured current radius/height with the probabilistic model's azimuthal, radial-epicycle, and vertical periods. Present radial and vertical speeds of 10 and 7 km/s set bounded harmonic amplitudes, so the replay terminates exactly at R = 8.249 kpc and Z = +20.8 pc rather than using arbitrary screen bobbing. The cited orbit study finds the path becomes totally unpredictable within about 800 Myr because Galactic-potential uncertainty dominates. The UI therefore dashes and fades the older mean path while retaining it as the explicitly requested narrative replay; it does not claim a recoverable 4.567-billion-year worldline.

## Cosmicflows-4, probabilistic basins, and expansion

Tully et al.'s 2014 [Laniākea paper](https://arxiv.org/abs/1409.0880) introduced a watershed definition based on present peculiar-velocity flow after removing mean Hubble expansion and long-range flow. The newer Cosmicflows-4 probabilistic reconstruction materially changes the interpretation. [Valade et al.](https://arxiv.org/abs/2409.17261) find the Ophiuchus/Laniākea basin in 62% of realizations, but place the Milky Way with it only 39% of the time (38% by automated sink clustering). The Milky Way is associated with the Shapley basin 58% of the time by inspected nearby sinks, or 48% by the automated aggregate. The interface therefore no longer renders one certain Great Attractor destination.

The plotted point field comes from the complete 38,053-group machine-readable Table 4 of [Cosmicflows-4](https://doi.org/10.3847/1538-4357/ac94d8), distributed as [CDS VizieR J/ApJ/944/94](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/ApJ/944/94). `npm run cosmic-flow:update` hash-pins that source, selects the 3,800 groups inside `−180 ≤ SGX ≤ 80`, `−85 ≤ SGY ≤ 120`, and `|SGZ| ≤ 10 h⁻¹ Mpc`, then retains a deterministic hash-ranked 1,900-point display sample. Published Cartesian “velocity units” are divided by 100 to obtain `h⁻¹ Mpc`. Blue/red point color is the catalog's negative/positive **line-of-sight** peculiar velocity; it is not a reconstructed two-dimensional arrow.

Five basin markers reproduce Valade et al. Extended Data Table 2 core SGX/SGY positions, one-sigma coordinate errors, existence probabilities, and mean volumes. Dashed ellipses are the reported SGX/SGY errors. Circle **area** is proportional to mean basin volume; it is not the measured basin boundary. The two moving dashed Milky Way links encode the Table 1 association alternatives. Their phase is only a field-tracing cue—it is not velocity, a particle path, or a Big-Bang-to-present worldline. The paper explicitly notes that particles traverse only a small fraction of a present-day streamline over the age of the Universe.

At non-present timeline positions the CF4 map is dimmed rather than falsely evolved. A background scale-factor reference integrates

```text
d ln(a) / dt = H₀ sqrt(Ωᵣ a⁻⁴ + Ωₘ a⁻³ + ΩΛ)
```

with `H₀ = 67.4 km s⁻¹ Mpc⁻¹`, `Ωₘ = 0.315`, `Ωᵣ = 9.2×10⁻⁵`, flat closure, and `a = 1` at 13.8 Gyr. The main parameters follow [Planck 2018](https://arxiv.org/abs/1807.06209). The far-future branch uses the stable matter+Λ closed form. Before recombination—and especially at the inflation anchor—this is only a background extrapolation; the UI explicitly says it is not an inflation model. No historical or future CF4 velocity field is claimed.

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
- “not velocity, a particle path, or a Big-Bang worldline” for the probabilistic cosmic-flow links;
- heat death as an assumed scenario.
