import { describe, expect, it } from 'vitest';
import {
  GALACTIC_BAR_ANGLE_DEGREES,
  GALACTIC_BAR_HALF_LENGTH_KPC,
  GALACTIC_MAJOR_ARM_GUIDES,
  GALACTIC_MEAN_ARM_PITCH_DEGREES,
  GALAXY_PARTICLE_FIELD,
  GALACTIC_SPIRAL_SEGMENTS,
  SOLAR_GALACTIC_TRAIL,
  buildGalaxyParticleField,
  galacticArmWidthKpc,
  majorArmPointAtRadius,
  sampleSpiralSegment,
  solarGalacticPositionAtProgress,
  spiralSegmentRadiusKpc,
} from '../src/core/galaxyModel';
import {
  GALACTIC_CENTER_DISTANCE_KPC,
  SUN_HEIGHT_ABOVE_GALACTIC_PLANE_PC,
} from '../src/core/constants';

describe('measured Milky Way structure', () => {
  it('preserves the Reid et al. kinked logarithmic-arm anchors', () => {
    expect(GALACTIC_SPIRAL_SEGMENTS).toHaveLength(7);
    for (const segment of GALACTIC_SPIRAL_SEGMENTS) {
      expect(spiralSegmentRadiusKpc(segment, segment.betaKinkDegrees)).toBeCloseTo(
        segment.radiusAtKinkKpc,
        12,
      );
      const sampled = sampleSpiralSegment(segment, 17);
      expect(sampled).toHaveLength(17);
      expect(sampled.every((point) => Number.isFinite(point.xKpc + point.yKpc))).toBe(true);
    }
    const scutum = GALACTIC_SPIRAL_SEGMENTS.find((segment) => segment.key === 'scutum-centaurus')!;
    expect(scutum.pitchBeforeDegrees).toBe(14.1);
    expect(scutum.pitchAfterDegrees).toBe(12.1);
  });

  it('uses the measured average pitch, arm widening, and long-bar dimensions', () => {
    expect(GALACTIC_MEAN_ARM_PITCH_DEGREES).toBe(10);
    expect(galacticArmWidthKpc(8.15)).toBeCloseTo(0.336, 12);
    expect(galacticArmWidthKpc(12.24)).toBeCloseTo(0.48324, 8);
    expect(GALACTIC_BAR_HALF_LENGTH_KPC).toBe(5);
    expect(GALACTIC_BAR_ANGLE_DEGREES).toBe(30);
    expect(GALACTIC_MAJOR_ARM_GUIDES).toHaveLength(4);
    for (const guide of GALACTIC_MAJOR_ARM_GUIDES) {
      const point = majorArmPointAtRadius(guide, 11);
      expect(Math.hypot(point.xKpc, point.yKpc)).toBeCloseTo(11, 12);
    }
  });

  it('precomputes a deterministic bounded stellar field', () => {
    expect(GALAXY_PARTICLE_FIELD).toHaveLength(760);
    expect(GALAXY_PARTICLE_FIELD.filter((particle) => particle.layer === 'disk')).toHaveLength(430);
    expect(GALAXY_PARTICLE_FIELD.filter((particle) => particle.layer === 'arm')).toHaveLength(220);
    expect(GALAXY_PARTICLE_FIELD.filter((particle) => particle.layer === 'bar')).toHaveLength(110);
    expect(buildGalaxyParticleField().slice(0, 12)).toEqual(GALAXY_PARTICLE_FIELD.slice(0, 12));
    for (const particle of GALAXY_PARTICLE_FIELD) {
      expect(Math.hypot(particle.xKpc, particle.yKpc)).toBeLessThan(17);
      expect(Math.abs(particle.zKpc)).toBeLessThan(3);
    }
  });
});

describe('uncertainty-aware Solar Galactic replay', () => {
  it('terminates at the measured present Solar position', () => {
    const present = solarGalacticPositionAtProgress(1);
    expect(present.xKpc).toBeCloseTo(0, 10);
    expect(present.yKpc).toBeCloseTo(GALACTIC_CENTER_DISTANCE_KPC, 10);
    expect(present.zKpc * 1_000).toBeCloseTo(SUN_HEIGHT_ABOVE_GALACTIC_PLANE_PC, 10);
    expect(present.lookbackMillionYears).toBe(0);
    expect(present.uncertainty).toBe(0);
  });

  it('adds bounded radial epicycles and vertical oscillation without claiming old precision', () => {
    for (let index = 0; index <= 100; index += 1) {
      const point = solarGalacticPositionAtProgress(index / 100);
      const radius = Math.hypot(point.xKpc, point.yKpc);
      expect(radius).toBeGreaterThan(GALACTIC_CENTER_DISTANCE_KPC - 0.28);
      expect(radius).toBeLessThan(GALACTIC_CENTER_DISTANCE_KPC + 0.28);
      expect(Math.abs(point.zKpc)).toBeLessThan(0.104);
    }
    expect(solarGalacticPositionAtProgress(0).uncertainty).toBe(1);
    expect(solarGalacticPositionAtProgress(1 - 800 / 4_567).uncertainty).toBeCloseTo(1, 10);
  });

  it('matches the adopted present radial and vertical Solar velocities', () => {
    const deltaMillionYears = 0.001;
    const past = solarGalacticPositionAtProgress(1 - deltaMillionYears / 4_567);
    const present = solarGalacticPositionAtProgress(1);
    const pastRadius = Math.hypot(past.xKpc, past.yKpc);
    const presentRadius = Math.hypot(present.xKpc, present.yKpc);
    const kpcPerMillionYearsPerKmPerSecond = 0.001022712165;
    const radialVelocityKmPerSecond = (presentRadius - pastRadius) / deltaMillionYears /
      kpcPerMillionYearsPerKmPerSecond;
    const verticalVelocityKmPerSecond = (present.zKpc - past.zKpc) / deltaMillionYears /
      kpcPerMillionYearsPerKmPerSecond;
    expect(radialVelocityKmPerSecond).toBeCloseTo(-10, 2);
    expect(verticalVelocityKmPerSecond).toBeCloseTo(7, 2);
  });

  it('precomputes a birth-to-present trail with exact endpoints', () => {
    expect(SOLAR_GALACTIC_TRAIL).toHaveLength(641);
    expect(SOLAR_GALACTIC_TRAIL[0].progress).toBe(0);
    expect(SOLAR_GALACTIC_TRAIL.at(-1)?.progress).toBe(1);
    expect(SOLAR_GALACTIC_TRAIL.at(-1)).toEqual(solarGalacticPositionAtProgress(1));
  });
});
