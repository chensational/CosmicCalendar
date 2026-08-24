import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PLANETS } from '../src/core/constants';
import {
  MOON_ALBEDO_BASE64,
  MOON_ALBEDO_HEIGHT,
  MOON_ALBEDO_WIDTH,
} from '../src/data/moon-albedo-embedded';
import moonAlbedoManifest from '../src/data/moon-albedo.json';
import solarImageManifest from '../src/data/sun-hmi.json';
import { greatCircleBearingRadians, shortestAngularDifference, smoothstep } from '../src/core/math';
import {
  lunarReflectance,
  lunarSurfaceGeometry,
  sampleLunarAlbedo,
  visibleLunarNormalToBody,
} from '../src/core/lunarSurface';
import { eclipticSphericalToCartesian, orbitalPositionAtTrueAnomaly } from '../src/core/orbits';
import {
  bodyFixedEquatorialBasis,
  lambertianLight,
  rotateEquatorialBasis,
  SOLAR_VIEW_BASIS,
  sphereCoordinates,
  toSolarView,
} from '../src/core/planetSurface';
import {
  satelliteSunlightFraction,
  tidallyLockedBasis,
  visibleDiscFraction,
} from '../src/core/satelliteSurface';
import {
  proceduralSunspotGroups,
  solarActivityLevel,
  solarDifferentialRotationPeriodDays,
  solarGranulation,
  solarLimbDarkening,
  solarObservationMatchesDate,
  topocentricSolarSurfaceFrame,
} from '../src/core/solarSurface';

describe('physically coherent animation geometry', () => {
  it('draws eccentric orbit guides with the Sun at a focus', () => {
    const mercury = PLANETS.find((planet) => planet.key === 'mercury')!;
    const perihelion = orbitalPositionAtTrueAnomaly(mercury.orbit, 0);
    const aphelion = orbitalPositionAtTrueAnomaly(mercury.orbit, Math.PI);
    expect(Math.hypot(perihelion.x, perihelion.y, perihelion.z)).toBeCloseTo(
      mercury.orbit.semiMajorAxisAu * (1 - mercury.orbit.eccentricity),
      10,
    );
    expect(Math.hypot(aphelion.x, aphelion.y, aphelion.z)).toBeCloseTo(
      mercury.orbit.semiMajorAxisAu * (1 + mercury.orbit.eccentricity),
      10,
    );
    expect(Math.abs(perihelion.z)).toBeGreaterThan(0);
  });

  it('preserves the distance of spherical ephemeris positions', () => {
    const vector = eclipticSphericalToCartesian(30.1, 297.4, -1.2);
    expect(Math.hypot(vector.x, vector.y, vector.z)).toBeCloseTo(30.1, 12);
  });

  it('interpolates wrapped azimuths along the short direction', () => {
    expect(shortestAngularDifference(359.9, 0.1)).toBeCloseTo(0.2, 12);
    expect(shortestAngularDifference(0.1, 359.9)).toBeCloseTo(-0.2, 12);
  });

  it('uses a continuous twilight response', () => {
    expect(smoothstep(-18, -2, -20)).toBe(0);
    expect(smoothstep(-18, -2, -10)).toBeCloseTo(0.5, 12);
    expect(smoothstep(-18, -2, 0)).toBe(1);
  });

  it('uses bounded differential rotation and visible-continuum limb darkening for the Sun', () => {
    expect(solarDifferentialRotationPeriodDays(0)).toBe(25);
    expect(solarDifferentialRotationPeriodDays(Math.PI / 2)).toBe(36);
    expect(solarLimbDarkening(1)).toBe(1);
    expect(solarLimbDarkening(0)).toBeCloseTo(0.3, 12);
    expect(solarLimbDarkening(0.5)).toBeGreaterThan(solarLimbDarkening(0));
    expect(solarActivityLevel(new Date('2026-08-24T00:00:00Z'))).toBeGreaterThanOrEqual(0.08);
    expect(solarActivityLevel(new Date('2026-08-24T00:00:00Z'))).toBeLessThanOrEqual(1);
    expect(solarGranulation(0.2, -0.7, new Date('2026-08-24T00:00:00Z'))).toBeGreaterThan(0.92);
    expect(solarGranulation(0.2, -0.7, new Date('2026-08-24T00:00:00Z'))).toBeLessThan(1.01);
  });

  it('never presents a stale solar observation as the selected-date photosphere', () => {
    const observed = new Date('2026-08-24T08:40:00Z');
    expect(solarObservationMatchesDate(new Date('2026-08-25T20:40:00Z'), observed)).toBe(true);
    expect(solarObservationMatchesDate(new Date('2026-08-25T20:40:01Z'), observed)).toBe(false);
    expect(solarObservationMatchesDate(new Date('invalid'), observed)).toBe(false);
  });

  it('keeps fallback sunspots inside active latitudes with continuous lifetimes', () => {
    const groups = proceduralSunspotGroups(new Date('2026-08-24T08:30:00Z'));
    expect(groups.length).toBeGreaterThan(0);
    for (const group of groups) {
      expect(Math.abs(group.latitudeRadians)).toBeLessThan(45 * Math.PI / 180);
      expect(Math.abs(group.longitudeRadians)).toBeLessThanOrEqual(Math.PI);
      expect(group.angularRadiusRadians).toBeGreaterThan(0);
      expect(group.strength).toBeGreaterThan(0);
      expect(group.strength).toBeLessThanOrEqual(1);
    }
  });

  it('builds an orthonormal topocentric solar surface frame', () => {
    const frame = topocentricSolarSurfaceFrame(5.2, -31.4, Math.PI / 3);
    const vectors = [frame.pole, frame.meridian, frame.east];
    for (const vector of vectors) {
      expect(Math.hypot(vector.x, vector.y, vector.z)).toBeCloseTo(1, 12);
    }
    expect(frame.pole.x * frame.meridian.x + frame.pole.y * frame.meridian.y + frame.pole.z * frame.meridian.z).toBeCloseTo(0, 12);
    expect(frame.east.x * frame.meridian.x + frame.east.y * frame.meridian.y + frame.east.z * frame.meridian.z).toBeCloseTo(0, 12);
  });

  it('orients an illuminated limb toward the Sun on the local sky sphere', () => {
    expect(greatCircleBearingRadians(0, 0, 0, 10)).toBeCloseTo(0, 12);
    expect(greatCircleBearingRadians(0, 0, 10, 0)).toBeCloseTo(Math.PI / 2, 12);
    expect(greatCircleBearingRadians(359, 0, 1, 0)).toBeCloseTo(Math.PI / 2, 12);
  });

  it('uses an orthonormal camera basis for spherical planet lighting', () => {
    const { screenX, screenY, towardViewer } = SOLAR_VIEW_BASIS;
    expect(Math.hypot(screenX.x, screenX.y, screenX.z)).toBeCloseTo(1, 12);
    expect(Math.hypot(screenY.x, screenY.y, screenY.z)).toBeCloseTo(1, 12);
    expect(screenX.x * screenY.x + screenX.y * screenY.y + screenX.z * screenY.z).toBeCloseTo(0, 12);
    expect(toSolarView(towardViewer).z).toBeCloseTo(1, 12);
  });

  it('rotates a body-fixed meridian without losing orthogonality', () => {
    const rotated = rotateEquatorialBasis({ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, 90);
    expect(rotated.meridian.y).toBeCloseTo(1, 12);
    expect(rotated.east.x).toBeCloseTo(-1, 12);
    const coordinates = sphereCoordinates(
      { x: 0, y: 0, z: 1 },
      { x: 0, y: 1, z: 0 },
      { x: 0, y: 0, z: 1 },
      { x: 1, y: 0, z: 0 },
    );
    expect(coordinates.latitudeRadians).toBeCloseTo(0, 12);
    expect(coordinates.longitudeRadians).toBeCloseTo(0, 12);
  });

  it('applies the IAU prime-meridian rotation sequence in the correct order', () => {
    const basis = bodyFixedEquatorialBasis(0, 90, 0);
    expect(basis.north.z).toBeCloseTo(1, 12);
    expect(basis.meridian.y).toBeCloseTo(1, 12);
    expect(basis.east.x).toBeCloseTo(-1, 12);
  });

  it('keeps the nightside dark under Lambertian illumination', () => {
    expect(lambertianLight({ x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 1 })).toBeCloseTo(1, 12);
    expect(lambertianLight({ x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: -1 })).toBeCloseTo(0.025, 12);
  });

  it('builds an orthonormal libration-aware lunar viewing basis', () => {
    const geometry = lunarSurfaceGeometry(6.4, -5.2, Math.PI / 5, Math.PI / 2, 90);
    const basis = [geometry.viewCenterBody, geometry.screenRightBody, geometry.screenUpBody];
    for (const vector of basis) {
      expect(Math.hypot(vector.x, vector.y, vector.z)).toBeCloseTo(1, 12);
    }
    expect(
      geometry.viewCenterBody.x * geometry.screenRightBody.x +
      geometry.viewCenterBody.y * geometry.screenRightBody.y +
      geometry.viewCenterBody.z * geometry.screenRightBody.z,
    ).toBeCloseTo(0, 12);
    expect(geometry.lightInView.x).toBeCloseTo(1, 12);
    expect(geometry.lightInView.z).toBeCloseTo(0, 12);
    const discCenter = visibleLunarNormalToBody({ x: 0, y: 0, z: 1 }, geometry);
    expect(discCenter.x).toBeCloseTo(geometry.viewCenterBody.x, 12);
    expect(discCenter.y).toBeCloseTo(geometry.viewCenterBody.y, 12);
    expect(discCenter.z).toBeCloseTo(geometry.viewCenterBody.z, 12);
  });

  it('uses real LRO albedo contrast for lunar maria and ray craters', () => {
    const tranquility = sampleLunarAlbedo(31.4 * Math.PI / 180, 8.5 * Math.PI / 180);
    const tycho = sampleLunarAlbedo(-11.2 * Math.PI / 180, -43.3 * Math.PI / 180);
    expect(tranquility).toBeLessThan(0.55);
    expect(tycho).toBeGreaterThan(0.8);
    expect(tycho - tranquility).toBeGreaterThan(0.3);
  });

  it('matches the pinned LRO-derived lunar albedo artifact', () => {
    const albedo = Buffer.from(MOON_ALBEDO_BASE64, 'base64');
    expect(albedo).toHaveLength(MOON_ALBEDO_WIDTH * MOON_ALBEDO_HEIGHT);
    expect(albedo).toHaveLength(moonAlbedoManifest.byteLength);
    expect(createHash('sha256').update(albedo).digest('hex')).toBe(moonAlbedoManifest.albedoSha256);
  });

  it('matches the timestamped NASA SDO/HMI continuum artifact', () => {
    const image = readFileSync(resolve(process.cwd(), 'src/data/sun-hmi.jpg'));
    expect(image).toHaveLength(solarImageManifest.byteLength);
    expect(image[0]).toBe(0xff);
    expect(image[1]).toBe(0xd8);
    expect(createHash('sha256').update(image).digest('hex')).toBe(solarImageManifest.sha256);
    expect(Math.abs(Date.parse(solarImageManifest.fetchedAt) - Date.parse(solarImageManifest.observedAt))).toBeLessThan(60 * 60 * 1_000);
  });

  it('uses lunar-regolith scattering instead of Lambertian limb darkening', () => {
    const limbNormal = { x: Math.sqrt(0.96), y: 0, z: 0.2 };
    const fullMoonLight = { x: 0, y: 0, z: 1 };
    expect(lunarReflectance(limbNormal, fullMoonLight)).toBeGreaterThan(0.85);
    expect(lunarReflectance({ x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: -1 })).toBeCloseTo(0.018, 12);
  });

  it('resolves umbra, penumbra, and annular transit from finite angular discs', () => {
    expect(visibleDiscFraction(1, 2, 0)).toBe(0);
    expect(visibleDiscFraction(1, 0.25, 0)).toBeCloseTo(0.9375, 12);
    expect(visibleDiscFraction(1, 1, 2)).toBe(1);
    expect(visibleDiscFraction(1, 1, 1)).toBeGreaterThan(0);
    expect(visibleDiscFraction(1, 1, 1)).toBeLessThan(1);

    const parentAtOneAu = { x: 1, y: 0, z: 0 };
    expect(satelliteSunlightFraction({ x: 384_400, y: 0, z: 0 }, parentAtOneAu, 6_378.137)).toBe(0);
    expect(satelliteSunlightFraction({ x: -384_400, y: 0, z: 0 }, parentAtOneAu, 6_378.137)).toBe(1);
    const penumbra = satelliteSunlightFraction(
      { x: 384_400, y: 4_700, z: 0 },
      parentAtOneAu,
      6_378.137,
    );
    expect(penumbra).toBeGreaterThan(0);
    expect(penumbra).toBeLessThan(1);
  });

  it('keeps a synchronous satellite meridian pointed toward its parent', () => {
    const basis = tidallyLockedBasis(
      { x: 10, y: 0, z: 0 },
      { x: 0, y: 2, z: 0 },
    );
    expect(basis.meridian.x).toBeCloseTo(-1, 12);
    expect(basis.north.z).toBeCloseTo(1, 12);
    expect(basis.east.y).toBeCloseTo(-1, 12);
    expect(basis.north.x * basis.meridian.x + basis.north.y * basis.meridian.y + basis.north.z * basis.meridian.z).toBeCloseTo(0, 12);
  });
});
