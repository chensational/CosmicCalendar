import {
  GALACTIC_CENTER_DISTANCE_KPC,
  SUN_AGE_YEARS,
  SUN_GALACTIC_ORBIT_PERIOD_MILLION_YEARS,
  SUN_HEIGHT_ABOVE_GALACTIC_PLANE_PC,
  SUN_VERTICAL_OSCILLATION_PERIOD_MILLION_YEARS,
} from './constants';
import { clamp, hashUnit } from './math';

const TAU = Math.PI * 2;
const DEGREES_TO_RADIANS = Math.PI / 180;
const KM_S_TO_KPC_PER_MILLION_YEARS = 0.001022712165;

export const GALACTIC_DISPLAY_RADIUS_KPC = 15;
export const GALACTIC_STELLAR_DISK_SCALE_LENGTH_KPC = 2.15;
export const GALACTIC_BAR_HALF_LENGTH_KPC = 5;
export const GALACTIC_BAR_ANGLE_DEGREES = 30;
export const GALACTIC_MEAN_ARM_PITCH_DEGREES = 10;
export const SUN_GALACTIC_EPICYCLE_PERIOD_MILLION_YEARS = 163.2;
export const SUN_GALACTIC_ORBIT_PREDICTABILITY_MILLION_YEARS = 800;
export const SUN_GALACTIC_RADIAL_SPEED_KM_S = 10;
export const SUN_GALACTIC_VERTICAL_SPEED_KM_S = 7;

export interface GalacticPoint {
  xKpc: number;
  yKpc: number;
  zKpc: number;
}

export interface GalacticSpiralSegment {
  key: string;
  name: string;
  betaStartDegrees: number;
  betaEndDegrees: number;
  betaKinkDegrees: number;
  radiusAtKinkKpc: number;
  pitchBeforeDegrees: number;
  pitchAfterDegrees: number;
  widthAtKinkKpc: number;
}

export interface GalacticMajorArmGuide {
  key: string;
  name: string;
  betaAnchorDegrees: number;
  radiusAtAnchorKpc: number;
}

export interface GalaxyParticle extends GalacticPoint {
  colorBucket: 0 | 1 | 2 | 3;
  sizeBucket: 0 | 1 | 2;
  layer: 'disk' | 'arm' | 'bar';
}

export interface SolarGalacticTrailPoint extends GalacticPoint {
  progress: number;
  lookbackMillionYears: number;
  uncertainty: number;
}

/** Reid et al. (2019), Table 2; beta=0 points from Sgr A* toward the Sun. */
export const GALACTIC_SPIRAL_SEGMENTS: readonly GalacticSpiralSegment[] = Object.freeze([
  { key: '3-kpc', name: '3-kpc', betaStartDegrees: 15, betaEndDegrees: 18, betaKinkDegrees: 15, radiusAtKinkKpc: 3.52, pitchBeforeDegrees: -4.2, pitchAfterDegrees: -4.2, widthAtKinkKpc: 0.18 },
  { key: 'norma', name: 'Norma', betaStartDegrees: 5, betaEndDegrees: 54, betaKinkDegrees: 18, radiusAtKinkKpc: 4.46, pitchBeforeDegrees: -1, pitchAfterDegrees: 19.5, widthAtKinkKpc: 0.14 },
  { key: 'scutum-centaurus', name: 'Scutum–Centaurus', betaStartDegrees: 0, betaEndDegrees: 104, betaKinkDegrees: 23, radiusAtKinkKpc: 4.91, pitchBeforeDegrees: 14.1, pitchAfterDegrees: 12.1, widthAtKinkKpc: 0.23 },
  { key: 'sagittarius-carina', name: 'Sagittarius–Carina', betaStartDegrees: 2, betaEndDegrees: 97, betaKinkDegrees: 24, radiusAtKinkKpc: 6.04, pitchBeforeDegrees: 17.1, pitchAfterDegrees: 1, widthAtKinkKpc: 0.27 },
  { key: 'local', name: 'Local arm', betaStartDegrees: -8, betaEndDegrees: 34, betaKinkDegrees: 9, radiusAtKinkKpc: 8.26, pitchBeforeDegrees: 11.4, pitchAfterDegrees: 11.4, widthAtKinkKpc: 0.31 },
  { key: 'perseus', name: 'Perseus', betaStartDegrees: -23, betaEndDegrees: 115, betaKinkDegrees: 40, radiusAtKinkKpc: 8.87, pitchBeforeDegrees: 10.3, pitchAfterDegrees: 8.7, widthAtKinkKpc: 0.35 },
  { key: 'outer', name: 'Outer', betaStartDegrees: -16, betaEndDegrees: 71, betaKinkDegrees: 18, radiusAtKinkKpc: 12.24, pitchBeforeDegrees: 3, pitchAfterDegrees: 9.4, widthAtKinkKpc: 0.65 },
]);

/** Four-arm extrapolation anchors; measured segments above remain authoritative. */
export const GALACTIC_MAJOR_ARM_GUIDES: readonly GalacticMajorArmGuide[] = Object.freeze([
  { key: 'norma-outer', name: 'Norma–Outer', betaAnchorDegrees: 18, radiusAtAnchorKpc: 4.46 },
  { key: 'scutum-centaurus', name: 'Scutum–Centaurus', betaAnchorDegrees: 23, radiusAtAnchorKpc: 4.91 },
  { key: 'sagittarius-carina', name: 'Sagittarius–Carina', betaAnchorDegrees: 24, radiusAtAnchorKpc: 6.04 },
  { key: 'perseus', name: 'Perseus', betaAnchorDegrees: 40, radiusAtAnchorKpc: 8.87 },
]);

export function galacticPolarPoint(
  radiusKpc: number,
  betaRadians: number,
  zKpc = 0,
): GalacticPoint {
  return {
    xKpc: Math.sin(betaRadians) * radiusKpc,
    yKpc: Math.cos(betaRadians) * radiusKpc,
    zKpc,
  };
}

export function spiralSegmentRadiusKpc(
  segment: GalacticSpiralSegment,
  betaDegrees: number,
): number {
  const pitchDegrees = betaDegrees <= segment.betaKinkDegrees
    ? segment.pitchBeforeDegrees
    : segment.pitchAfterDegrees;
  const betaOffsetRadians = (betaDegrees - segment.betaKinkDegrees) * DEGREES_TO_RADIANS;
  return segment.radiusAtKinkKpc * Math.exp(
    -betaOffsetRadians * Math.tan(pitchDegrees * DEGREES_TO_RADIANS),
  );
}

export function sampleSpiralSegment(
  segment: GalacticSpiralSegment,
  samples = 64,
): readonly GalacticPoint[] {
  return Array.from({ length: Math.max(2, samples) }, (_, index) => {
    const betaDegrees = segment.betaStartDegrees +
      (segment.betaEndDegrees - segment.betaStartDegrees) * index / (Math.max(2, samples) - 1);
    return galacticPolarPoint(
      spiralSegmentRadiusKpc(segment, betaDegrees),
      betaDegrees * DEGREES_TO_RADIANS,
    );
  });
}

export function galacticArmWidthKpc(radiusKpc: number): number {
  return clamp((336 + 36 * (radiusKpc - 8.15)) / 1_000, 0.12, 0.72);
}

export function majorArmPointAtRadius(
  guide: GalacticMajorArmGuide,
  radiusKpc: number,
): GalacticPoint {
  const betaRadians = guide.betaAnchorDegrees * DEGREES_TO_RADIANS -
    Math.log(radiusKpc / guide.radiusAtAnchorKpc) /
      Math.tan(GALACTIC_MEAN_ARM_PITCH_DEGREES * DEGREES_TO_RADIANS);
  return galacticPolarPoint(radiusKpc, betaRadians);
}

function gaussianHash(key: string): number {
  const first = Math.max(1e-9, hashUnit(`${key}-u`));
  const second = hashUnit(`${key}-v`);
  return Math.sqrt(-2 * Math.log(first)) * Math.cos(TAU * second);
}

function diskRadius(key: string): number {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const first = Math.max(1e-9, hashUnit(`${key}-r1-${attempt}`));
    const second = Math.max(1e-9, hashUnit(`${key}-r2-${attempt}`));
    const radius = -GALACTIC_STELLAR_DISK_SCALE_LENGTH_KPC * Math.log(first * second);
    if (radius <= GALACTIC_DISPLAY_RADIUS_KPC) return radius;
  }
  return GALACTIC_DISPLAY_RADIUS_KPC * 0.98;
}

export function buildGalaxyParticleField(): readonly GalaxyParticle[] {
  const particles: GalaxyParticle[] = [];
  for (let index = 0; index < 430; index += 1) {
    const key = `galaxy-disk-${index}`;
    const radius = diskRadius(key);
    const beta = hashUnit(`${key}-beta`) * TAU;
    const zScale = 0.22 + 0.08 * radius / GALACTIC_CENTER_DISTANCE_KPC;
    const z = Math.sign(hashUnit(`${key}-z-sign`) - 0.5) *
      -Math.log(Math.max(1e-6, hashUnit(`${key}-z`))) * zScale;
    particles.push({
      ...galacticPolarPoint(radius, beta, z),
      colorBucket: hashUnit(`${key}-color`) < 0.48 ? 0 : hashUnit(`${key}-color`) < 0.84 ? 1 : 2,
      sizeBucket: hashUnit(`${key}-size`) < 0.72 ? 0 : hashUnit(`${key}-size`) < 0.94 ? 1 : 2,
      layer: 'disk',
    });
  }
  for (let index = 0; index < 220; index += 1) {
    const key = `galaxy-arm-${index}`;
    const guide = GALACTIC_MAJOR_ARM_GUIDES[index % GALACTIC_MAJOR_ARM_GUIDES.length];
    const radius = 2.7 + hashUnit(`${key}-radius`) * (GALACTIC_DISPLAY_RADIUS_KPC - 2.7);
    const point = majorArmPointAtRadius(guide, radius);
    const beta = Math.atan2(point.xKpc, point.yKpc);
    const width = galacticArmWidthKpc(radius);
    const radialOffset = gaussianHash(`${key}-offset`) * width;
    const azimuthOffset = gaussianHash(`${key}-azimuth`) * width / Math.max(radius, 1) * 0.42;
    particles.push({
      ...galacticPolarPoint(radius + radialOffset, beta + azimuthOffset, gaussianHash(`${key}-z`) * 0.045),
      colorBucket: 3,
      sizeBucket: hashUnit(`${key}-size`) < 0.64 ? 0 : hashUnit(`${key}-size`) < 0.9 ? 1 : 2,
      layer: 'arm',
    });
  }
  const barAngle = GALACTIC_BAR_ANGLE_DEGREES * DEGREES_TO_RADIANS;
  const barMajor = { x: Math.sin(barAngle), y: Math.cos(barAngle) };
  const barMinor = { x: Math.cos(barAngle), y: -Math.sin(barAngle) };
  for (let index = 0; index < 110; index += 1) {
    const key = `galaxy-bar-${index}`;
    const along = (hashUnit(`${key}-along`) * 2 - 1) * GALACTIC_BAR_HALF_LENGTH_KPC;
    const taper = Math.sqrt(Math.max(0, 1 - (along / GALACTIC_BAR_HALF_LENGTH_KPC) ** 2));
    const across = gaussianHash(`${key}-across`) * 0.62 * taper;
    particles.push({
      xKpc: barMajor.x * along + barMinor.x * across,
      yKpc: barMajor.y * along + barMinor.y * across,
      zKpc: gaussianHash(`${key}-z`) * (0.18 + 0.38 * (1 - Math.abs(along) / GALACTIC_BAR_HALF_LENGTH_KPC)),
      colorBucket: 0,
      sizeBucket: hashUnit(`${key}-size`) < 0.58 ? 0 : hashUnit(`${key}-size`) < 0.9 ? 1 : 2,
      layer: 'bar',
    });
  }
  return particles;
}

export function solarGalacticPositionAtProgress(progress: number): SolarGalacticTrailPoint {
  const boundedProgress = clamp(progress, 0, 1);
  const solarAgeMillionYears = SUN_AGE_YEARS / 1e6;
  const lookbackMillionYears = solarAgeMillionYears * (1 - boundedProgress);
  const radialOmega = TAU / SUN_GALACTIC_EPICYCLE_PERIOD_MILLION_YEARS;
  const radialAmplitudeKpc = SUN_GALACTIC_RADIAL_SPEED_KM_S *
    KM_S_TO_KPC_PER_MILLION_YEARS / radialOmega;
  const radiusKpc = GALACTIC_CENTER_DISTANCE_KPC +
    radialAmplitudeKpc * Math.sin(radialOmega * lookbackMillionYears);
  const beta = -lookbackMillionYears /
    SUN_GALACTIC_ORBIT_PERIOD_MILLION_YEARS * TAU;

  const verticalOmega = TAU / SUN_VERTICAL_OSCILLATION_PERIOD_MILLION_YEARS;
  const presentZKpc = SUN_HEIGHT_ABOVE_GALACTIC_PLANE_PC / 1_000;
  const presentVerticalVelocityKpcPerMillionYears = SUN_GALACTIC_VERTICAL_SPEED_KM_S *
    KM_S_TO_KPC_PER_MILLION_YEARS;
  const verticalAmplitudeKpc = Math.hypot(
    presentZKpc,
    presentVerticalVelocityKpcPerMillionYears / verticalOmega,
  );
  const presentVerticalPhase = Math.atan2(
    presentZKpc,
    presentVerticalVelocityKpcPerMillionYears / verticalOmega,
  );
  const zKpc = verticalAmplitudeKpc * Math.sin(
    presentVerticalPhase - verticalOmega * lookbackMillionYears,
  );
  return {
    ...galacticPolarPoint(radiusKpc, beta, zKpc),
    progress: boundedProgress,
    lookbackMillionYears,
    uncertainty: clamp(
      lookbackMillionYears / SUN_GALACTIC_ORBIT_PREDICTABILITY_MILLION_YEARS,
      0,
      1,
    ),
  };
}

export function buildSolarGalacticTrail(samples = 641): readonly SolarGalacticTrailPoint[] {
  return Array.from({ length: Math.max(2, samples) }, (_, index) =>
    solarGalacticPositionAtProgress(index / (Math.max(2, samples) - 1)));
}

export const GALAXY_PARTICLE_FIELD = Object.freeze(buildGalaxyParticleField());
export const SOLAR_GALACTIC_TRAIL = Object.freeze(buildSolarGalacticTrail());
