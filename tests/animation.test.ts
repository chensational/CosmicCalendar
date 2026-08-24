import { describe, expect, it } from 'vitest';
import { PLANETS } from '../src/core/constants';
import { greatCircleBearingRadians, shortestAngularDifference, smoothstep } from '../src/core/math';
import { eclipticSphericalToCartesian, orbitalPositionAtTrueAnomaly } from '../src/core/orbits';

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

  it('orients an illuminated limb toward the Sun on the local sky sphere', () => {
    expect(greatCircleBearingRadians(0, 0, 0, 10)).toBeCloseTo(0, 12);
    expect(greatCircleBearingRadians(0, 0, 10, 0)).toBeCloseTo(Math.PI / 2, 12);
    expect(greatCircleBearingRadians(359, 0, 1, 0)).toBeCloseTo(Math.PI / 2, 12);
  });
});
