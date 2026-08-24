import {
  APOLLO_11_SITE,
  EARTH_AGE_YEARS,
  EARTH_ORBITAL_SPEED_KM_S,
  EARTH_SIDEREAL_DAY_SECONDS,
  JULIAN_YEAR_SECONDS,
  LOCAL_GROUP_CMB_SPEED_KM_S,
  MILKY_WAY_AGE_YEARS,
  MOON_AGE_YEARS,
  MOON_MEAN_RADIUS_KM,
  MOON_ORBITAL_SPEED_KM_S,
  MOON_SIDEREAL_PERIOD_SECONDS,
  SUN_AGE_YEARS,
  SUN_GALACTIC_SPEED_KM_S,
  WGS84_ECCENTRICITY_SQUARED,
  WGS84_EQUATORIAL_RADIUS_KM,
} from './constants';
import { degreesToRadians } from './math';
import type { DistanceMetric } from './types';

const DISTANCE_MODEL_REFERENCE_MS = Date.UTC(2026, 7, 23);

export function earthParallelRadiusKm(latitudeDegrees: number): number {
  const latitude = degreesToRadians(latitudeDegrees);
  const primeVerticalRadius = WGS84_EQUATORIAL_RADIUS_KM /
    Math.sqrt(1 - WGS84_ECCENTRICITY_SQUARED * Math.sin(latitude) ** 2);
  return Math.abs(primeVerticalRadius * Math.cos(latitude));
}

export function earthSurfaceRotationSpeedKmPerSecond(latitudeDegrees: number): number {
  return 2 * Math.PI * earthParallelRadiusKm(latitudeDegrees) / EARTH_SIDEREAL_DAY_SECONDS;
}

export function moonSurfaceRotationSpeedKmPerSecond(latitudeDegrees: number): number {
  return 2 * Math.PI * MOON_MEAN_RADIUS_KM * Math.cos(degreesToRadians(latitudeDegrees)) /
    MOON_SIDEREAL_PERIOD_SECONDS;
}

function distanceAtConstantSpeed(speedKmPerSecond: number, ageYears: number): number {
  return speedKmPerSecond * ageYears * JULIAN_YEAR_SECONDS;
}

function cmbHierarchyDistance(speedComponents: number[], ageYears: number): number {
  return distanceAtConstantSpeed(speedComponents.reduce((sum, speed) => sum + speed, 0), ageYears);
}

export function getDistanceMetrics(latitudeDegrees: number, date = new Date()): DistanceMetric[] {
  const elapsedModelYears = (date.getTime() - DISTANCE_MODEL_REFERENCE_MS) / 1_000 / JULIAN_YEAR_SECONDS;
  const earthAgeYears = Math.max(0, EARTH_AGE_YEARS + elapsedModelYears);
  const moonAgeYears = Math.max(0, MOON_AGE_YEARS + elapsedModelYears);
  const sunAgeYears = Math.max(0, SUN_AGE_YEARS + elapsedModelYears);
  const milkyWayAgeYears = Math.max(0, MILKY_WAY_AGE_YEARS + elapsedModelYears);
  const earthSurfaceSpeed = earthSurfaceRotationSpeedKmPerSecond(latitudeDegrees);
  const lunarSurfaceSpeed = moonSurfaceRotationSpeedKmPerSecond(APOLLO_11_SITE.latitude);
  const earthSurfaceDistance = distanceAtConstantSpeed(earthSurfaceSpeed, earthAgeYears);
  const lunarSurfaceDistance = distanceAtConstantSpeed(lunarSurfaceSpeed, moonAgeYears);
  const earthOrbitDistance = distanceAtConstantSpeed(EARTH_ORBITAL_SPEED_KM_S, earthAgeYears);
  const sunGalaxyDistance = distanceAtConstantSpeed(SUN_GALACTIC_SPEED_KM_S, sunAgeYears);
  const milkyWayCmbDistance = distanceAtConstantSpeed(LOCAL_GROUP_CMB_SPEED_KM_S, milkyWayAgeYears);

  return [
    {
      key: 'observer-earth',
      label: `You at ${Math.abs(latitudeDegrees).toFixed(2)}° ${latitudeDegrees >= 0 ? 'N' : 'S'}`,
      distanceKm: earthSurfaceDistance,
      cmbFrameDistanceKm: earthSurfaceDistance + cmbHierarchyDistance([
        EARTH_ORBITAL_SPEED_KM_S,
        SUN_GALACTIC_SPEED_KM_S,
        LOCAL_GROUP_CMB_SPEED_KM_S,
      ], earthAgeYears),
      currentSpeedKmPerSecond: earthSurfaceSpeed,
      method: 'WGS84 latitude-circle rotation integrated at the present sidereal rate over Earth’s modeled age.',
    },
    {
      key: 'apollo-11-site',
      label: 'Tranquility Base surface',
      distanceKm: lunarSurfaceDistance,
      cmbFrameDistanceKm: lunarSurfaceDistance + cmbHierarchyDistance([
        MOON_ORBITAL_SPEED_KM_S,
        EARTH_ORBITAL_SPEED_KM_S,
        SUN_GALACTIC_SPEED_KM_S,
        LOCAL_GROUP_CMB_SPEED_KM_S,
      ], moonAgeYears),
      currentSpeedKmPerSecond: lunarSurfaceSpeed,
      method: 'Lunar latitude-circle rotation at the present synchronous period over the Moon’s modeled age.',
    },
    {
      key: 'earth-sun',
      label: 'Earth around the Sun',
      distanceKm: earthOrbitDistance,
      cmbFrameDistanceKm: cmbHierarchyDistance([
        EARTH_ORBITAL_SPEED_KM_S,
        SUN_GALACTIC_SPEED_KM_S,
        LOCAL_GROUP_CMB_SPEED_KM_S,
      ], earthAgeYears),
      currentSpeedKmPerSecond: EARTH_ORBITAL_SPEED_KM_S,
      method: 'Mean present orbital speed integrated over Earth’s modeled age.',
    },
    {
      key: 'sun-galaxy',
      label: 'Sun around the Milky Way',
      distanceKm: sunGalaxyDistance,
      cmbFrameDistanceKm: cmbHierarchyDistance([
        SUN_GALACTIC_SPEED_KM_S,
        LOCAL_GROUP_CMB_SPEED_KM_S,
      ], sunAgeYears),
      currentSpeedKmPerSecond: SUN_GALACTIC_SPEED_KM_S,
      method: 'Local circular speed integrated over the Sun’s modeled age.',
    },
    {
      key: 'milky-way-cmb',
      label: 'Milky Way / Local Group through the CMB',
      distanceKm: milkyWayCmbDistance,
      currentSpeedKmPerSecond: LOCAL_GROUP_CMB_SPEED_KM_S,
      method: 'Local Group CMB-dipole speed used as a Milky Way proxy, integrated over the galaxy’s modeled age.',
    },
  ];
}

export function formatCosmicDistance(distanceKm: number): string {
  const units = [
    { threshold: 9.4607304725808e12, divisor: 9.4607304725808e12, suffix: 'ly' },
    { threshold: 1e12, divisor: 1e12, suffix: 'trillion km' },
    { threshold: 1e9, divisor: 1e9, suffix: 'billion km' },
    { threshold: 1e6, divisor: 1e6, suffix: 'million km' },
  ];
  const unit = units.find((candidate) => distanceKm >= candidate.threshold);
  if (!unit) return `${distanceKm.toLocaleString(undefined, { maximumFractionDigits: 0 })} km`;
  const value = distanceKm / unit.divisor;
  return `${value.toLocaleString(undefined, { maximumSignificantDigits: 5 })} ${unit.suffix}`;
}
