import { describe, expect, it } from 'vitest';
import { buildCalendarMonth } from '../src/core/calendar';
import { DEFAULT_LOCATION } from '../src/core/constants';
import satelliteReference from '../src/data/satellite-reference.json';
import { getDistanceMetrics, earthParallelRadiusKm, earthSurfaceRotationSpeedKmPerSecond } from '../src/core/distances';
import {
  getHorizonSnapshot,
  getLunarHorizonSnapshot,
  getMercuryPerihelionLongitude,
  getSolarSystemSnapshot,
  satelliteDistanceFromParent,
} from '../src/core/ephemeris';
import { shortestAngularDifference } from '../src/core/math';

describe('Earth-local ephemeris', () => {
  it('agrees with a committed JPL Horizons DE441 Sun fixture', () => {
    // JPL Horizons API, target 10, coord@399, Madison WI, 2026-08-23T00:00Z.
    // Airless apparent: azimuth 278.391508°, elevation 7.895707°.
    const snapshot = getHorizonSnapshot(new Date('2026-08-23T00:00:00Z'), DEFAULT_LOCATION);
    expect(snapshot.sun.azimuthDegrees).toBeCloseTo(278.391508, 1);
    // Astronomy Engine's normal atmospheric refraction is intentionally enabled.
    expect(snapshot.sun.altitudeDegrees).toBeCloseTo(7.895707, 0);
    expect(snapshot.milkyWay).toHaveLength(49);
    expect(snapshot.sun.apparentMotion?.azimuthDegreesPerSecond).toBeTypeOf('number');
    expect(snapshot.moon.angularDiameterDegrees).toBeGreaterThan(0.48);
    expect(snapshot.moon.angularDiameterDegrees).toBeLessThan(0.57);
    expect(Math.abs(snapshot.moon.subObserverLatitudeDegrees)).toBeLessThan(8);
    expect(Math.abs(snapshot.moon.subObserverLongitudeDegrees)).toBeLessThan(9);
    expect(Number.isFinite(snapshot.moon.northPoleBearingRadians)).toBe(true);
  });

  it('predicts smooth apparent motion between five-second ephemeris refreshes', () => {
    const date = new Date('2026-08-23T00:00:00Z');
    const current = getHorizonSnapshot(date, DEFAULT_LOCATION);
    const tenSecondsLater = getHorizonSnapshot(new Date(date.getTime() + 10_000), DEFAULT_LOCATION);
    const motion = current.sun.apparentMotion!;
    const predictedAltitude = current.sun.altitudeDegrees + motion.altitudeDegreesPerSecond * 10;
    const predictedAzimuth = current.sun.azimuthDegrees + motion.azimuthDegreesPerSecond * 10;
    expect(predictedAltitude).toBeCloseTo(tenSecondsLater.sun.altitudeDegrees, 4);
    expect(shortestAngularDifference(predictedAzimuth, tenSecondsLater.sun.azimuthDegrees)).toBeCloseTo(0, 4);
  });

  it('matches a JPL Horizons topocentric lunar-disc fixture', () => {
    // Horizons target 301, coord@399 at Madison, 2026-08-07T17:00Z;
    // quantities 4,10,13,14,17,32 using the high-precision MOON_ME frame.
    const moon = getHorizonSnapshot(new Date('2026-08-07T17:00:00Z'), DEFAULT_LOCATION).moon;
    expect(moon.illuminatedFraction * 100).toBeCloseTo(32.58871, 2);
    expect(moon.solarPhaseAngleDegrees).toBeCloseTo(110.378835, 2);
    expect(moon.angularDiameterDegrees * 3_600).toBeCloseTo(1_970.542, 0);
    expect((moon.subObserverLongitudeDegrees + 360) % 360).toBeCloseTo(356.050569, 2);
    expect(moon.subObserverLatitudeDegrees).toBeCloseTo(-6.418505, 2);
  });

  it('places Earth above the Apollo 11 horizon on the near side', () => {
    const snapshot = getLunarHorizonSnapshot(new Date('2026-08-23T00:00:00Z'));
    expect(snapshot.earth.altitudeDegrees).toBeGreaterThan(55);
    expect(snapshot.earth.altitudeDegrees).toBeLessThan(80);
    expect(snapshot.earth.distanceKm).toBeGreaterThan(350_000);
    expect(snapshot.earth.distanceKm).toBeLessThan(410_000);
    expect(snapshot.earth.angularDiameterDegrees).toBeGreaterThan(1.7);
    const terrestrial = getHorizonSnapshot(new Date('2026-08-23T00:00:00Z'), DEFAULT_LOCATION);
    // Horizons target 399 from Apollo 11 coordinates on 301 returns
    // az 283.106874°, elevation 66.226714°, 23.96300% lit, 6532.976″.
    expect(snapshot.earth.azimuthDegrees).toBeCloseTo(283.106874, 0);
    expect(snapshot.earth.altitudeDegrees).toBeCloseTo(66.226714, 0);
    expect(snapshot.earth.illuminatedFraction * 100).toBeCloseTo(23.96300, 2);
    expect(snapshot.earth.angularDiameterDegrees * 3_600).toBeCloseTo(6_532.976, 0);
    // The two views are nearly complementary; topocentric parallax means a
    // lunar site and Madison do not observe exactly reciprocal phase angles.
    expect(snapshot.earth.illuminatedFraction + terrestrial.moon.illuminatedFraction).toBeCloseTo(1, 2);
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
    expect(snapshot.planets.every((planet) => Number.isFinite(planet.rotationPeriodHours))).toBe(true);
    expect(snapshot.planets.find((planet) => planet.key === 'mercury')?.orbit.eccentricity).toBeGreaterThan(0.2);
    for (const planet of snapshot.planets) {
      expect(Math.hypot(
        planet.heliocentricEclipticAu.x,
        planet.heliocentricEclipticAu.y,
        planet.heliocentricEclipticAu.z,
      )).toBeCloseTo(planet.distanceAu, 12);
      const northLength = Math.hypot(
        planet.axisNorthEcliptic.x,
        planet.axisNorthEcliptic.y,
        planet.axisNorthEcliptic.z,
      );
      const meridianLength = Math.hypot(
        planet.primeMeridianEcliptic.x,
        planet.primeMeridianEcliptic.y,
        planet.primeMeridianEcliptic.z,
      );
      const axisDotMeridian =
        planet.axisNorthEcliptic.x * planet.primeMeridianEcliptic.x +
        planet.axisNorthEcliptic.y * planet.primeMeridianEcliptic.y +
        planet.axisNorthEcliptic.z * planet.primeMeridianEcliptic.z;
      expect(northLength).toBeCloseTo(1, 10);
      expect(meridianLength).toBeCloseTo(1, 10);
      expect(axisDotMeridian).toBeCloseTo(0, 10);
    }
  });

  it('preserves satellite orbital scales', () => {
    const snapshot = getSolarSystemSnapshot(new Date('2026-08-23T00:00:00Z'));
    const callisto = snapshot.satellites.find((satellite) => satellite.key === 'callisto')!;
    expect(satelliteDistanceFromParent(callisto)).toBeCloseTo(callisto.semiMajorAxisKm, -4);
    expect(typeof callisto.sunlit).toBe('boolean');
    for (const satellite of snapshot.satellites) {
      expect(satellite.sunlightFraction).toBeGreaterThanOrEqual(0);
      expect(satellite.sunlightFraction).toBeLessThanOrEqual(1);
      expect(Math.hypot(
        satellite.relativePositionEclipticKm.x,
        satellite.relativePositionEclipticKm.y,
        satellite.relativePositionEclipticKm.z,
      )).toBeCloseTo(satelliteDistanceFromParent(satellite), 6);
      expect(Math.hypot(
        satellite.axisNorthEcliptic.x,
        satellite.axisNorthEcliptic.y,
        satellite.axisNorthEcliptic.z,
      )).toBeCloseTo(1, 10);
      const meridianDotPole =
        satellite.primeMeridianEcliptic.x * satellite.axisNorthEcliptic.x +
        satellite.primeMeridianEcliptic.y * satellite.axisNorthEcliptic.y +
        satellite.primeMeridianEcliptic.z * satellite.axisNorthEcliptic.z;
      expect(meridianDotPole).toBeCloseTo(0, 10);
      const positionLength = satelliteDistanceFromParent(satellite);
      const meridianTowardParent =
        satellite.primeMeridianEcliptic.x * satellite.relativePositionEclipticKm.x / positionLength +
        satellite.primeMeridianEcliptic.y * satellite.relativePositionEclipticKm.y / positionLength +
        satellite.primeMeridianEcliptic.z * satellite.relativePositionEclipticKm.z / positionLength;
      expect(meridianTowardParent).toBeCloseTo(-1, 10);
    }
  });

  it('returns satellite velocities consistent with the propagated positions', () => {
    const date = new Date('2026-08-23T00:00:00Z');
    const current = getSolarSystemSnapshot(date);
    const nextSecond = getSolarSystemSnapshot(new Date(date.getTime() + 1_000));
    for (const satellite of current.satellites) {
      const future = nextSecond.satellites.find((candidate) => candidate.key === satellite.key)!;
      const predictionErrorKm = Math.hypot(
        future.relativePositionKm.x -
          (satellite.relativePositionKm.x + satellite.relativeVelocityKmPerSecond.x),
        future.relativePositionKm.y -
          (satellite.relativePositionKm.y + satellite.relativeVelocityKmPerSecond.y),
        future.relativePositionKm.z -
          (satellite.relativePositionKm.z + satellite.relativeVelocityKmPerSecond.z),
      );
      expect(predictionErrorKm).toBeLessThan(0.05);
    }
  });

  it('preserves every pinned JPL state at the propagation epoch', () => {
    const snapshot = getSolarSystemSnapshot(new Date(satelliteReference.referenceDate));
    for (const reference of satelliteReference.entries) {
      const satellite = snapshot.satellites.find((candidate) => candidate.key === reference.key)!;
      if (satellite.model === 'integrated') continue;
      expect(satellite.relativePositionKm.x).toBeCloseTo(reference.positionKm.x, 6);
      expect(satellite.relativePositionKm.y).toBeCloseTo(reference.positionKm.y, 6);
      expect(satellite.relativePositionKm.z).toBeCloseTo(reference.positionKm.z, 6);
      expect(satellite.relativeVelocityKmPerSecond.x).toBeCloseTo(reference.velocityKmPerSecond.x, 10);
      expect(satellite.relativeVelocityKmPerSecond.y).toBeCloseTo(reference.velocityKmPerSecond.y, 10);
      expect(satellite.relativeVelocityKmPerSecond.z).toBeCloseTo(reference.velocityKmPerSecond.z, 10);
    }
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
