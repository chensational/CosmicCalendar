import { describe, expect, it } from 'vitest';
import { buildCalendarMonth } from '../src/core/calendar';
import { DEFAULT_LOCATION } from '../src/core/constants';
import { getDistanceMetrics, earthParallelRadiusKm, earthSurfaceRotationSpeedKmPerSecond } from '../src/core/distances';
import {
  getHorizonSnapshot,
  getLunarHorizonSnapshot,
  getMercuryPerihelionLongitude,
  getSolarSystemSnapshot,
  satelliteDistanceFromParent,
} from '../src/core/ephemeris';

describe('Earth-local ephemeris', () => {
  it('agrees with a committed JPL Horizons DE441 Sun fixture', () => {
    // JPL Horizons API, target 10, coord@399, Madison WI, 2026-08-23T00:00Z.
    // Airless apparent: azimuth 278.391508°, elevation 7.895707°.
    const snapshot = getHorizonSnapshot(new Date('2026-08-23T00:00:00Z'), DEFAULT_LOCATION);
    expect(snapshot.sun.azimuthDegrees).toBeCloseTo(278.391508, 1);
    // Astronomy Engine's normal atmospheric refraction is intentionally enabled.
    expect(snapshot.sun.altitudeDegrees).toBeCloseTo(7.895707, 0);
    expect(snapshot.milkyWay).toHaveLength(49);
  });

  it('places Earth above the Apollo 11 horizon on the near side', () => {
    const snapshot = getLunarHorizonSnapshot(new Date('2026-08-23T00:00:00Z'));
    expect(snapshot.earth.altitudeDegrees).toBeGreaterThan(55);
    expect(snapshot.earth.altitudeDegrees).toBeLessThan(80);
    expect(snapshot.earth.distanceKm).toBeGreaterThan(350_000);
    expect(snapshot.earth.distanceKm).toBeLessThan(410_000);
    expect(snapshot.earth.angularDiameterDegrees).toBeGreaterThan(1.7);
  });
});

describe('solar-system model', () => {
  it('returns every planet and 20 named major satellites', () => {
    const snapshot = getSolarSystemSnapshot(new Date('2026-08-23T00:00:00Z'));
    expect(snapshot.planets.map((planet) => planet.key)).toEqual([
      'mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto',
    ]);
    expect(snapshot.satellites).toHaveLength(20);
    expect(snapshot.satellites.filter((satellite) => satellite.model === 'integrated').map((satellite) => satellite.key)).toEqual([
      'moon', 'io', 'europa', 'ganymede', 'callisto',
    ]);
    expect(snapshot.satellites.filter((satellite) => satellite.model === 'jpl-reference-kepler')).toHaveLength(15);
    expect(snapshot.planets.find((planet) => planet.key === 'earth')?.distanceAu).toBeCloseTo(1, 1);
    expect(snapshot.planets.find((planet) => planet.key === 'neptune')?.distanceAu).toBeGreaterThan(29);
  });

  it('preserves satellite orbital scales', () => {
    const snapshot = getSolarSystemSnapshot(new Date('2026-08-23T00:00:00Z'));
    const callisto = snapshot.satellites.find((satellite) => satellite.key === 'callisto')!;
    expect(satelliteDistanceFromParent(callisto)).toBeCloseTo(callisto.semiMajorAxisKm, -4);
    expect(typeof callisto.sunlit).toBe('boolean');
  });

  it('advances Mercury perihelion using the JPL fitted secular rate', () => {
    const atJ2000 = getMercuryPerihelionLongitude(new Date('2000-01-01T12:00:00Z'));
    const aCenturyLater = getMercuryPerihelionLongitude(new Date('2100-01-01T12:00:00Z'));
    expect(atJ2000).toBeCloseTo(77.45779628, 7);
    expect(aCenturyLater - atJ2000).toBeCloseTo(0.16047689, 3);
  });
});

describe('distance and calendar models', () => {
  it('uses WGS84 latitude geometry so an equatorial observer travels farther', () => {
    expect(earthParallelRadiusKm(0)).toBeCloseTo(6_378.137, 3);
    expect(earthSurfaceRotationSpeedKmPerSecond(0)).toBeGreaterThan(earthSurfaceRotationSpeedKmPerSecond(43.0731));
    expect(earthSurfaceRotationSpeedKmPerSecond(90)).toBeCloseTo(0, 8);
    expect(getDistanceMetrics(0)[0].distanceKm).toBeGreaterThan(getDistanceMetrics(43.0731)[0].distanceKm);
  });

  it('builds a complete six-week lunar calendar', () => {
    const days = buildCalendarMonth(new Date('2026-08-01T12:00:00Z'));
    expect(days).toHaveLength(42);
    expect(days.filter((day) => day.inMonth)).toHaveLength(31);
    expect(days.every((day) => day.moonIlluminatedFraction >= 0 && day.moonIlluminatedFraction <= 1)).toBe(true);
  });
});
