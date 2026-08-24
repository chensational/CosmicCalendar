import { dot, hashUnit, normalize } from './math';
import type { CartesianPosition } from './types';

const DAY_MILLISECONDS = 86_400_000;
const SOLAR_CYCLE_DAYS = 11 * 365.2425;
const SOLAR_CYCLE_25_START_MS = Date.UTC(2019, 11, 1);
const IAU_SIDEREAL_RATE_RADIANS_PER_DAY = 14.1844 * Math.PI / 180;
export const SOLAR_OBSERVATION_VALIDITY_MILLISECONDS = 36 * 60 * 60 * 1_000;

export interface SolarSurfaceFrame {
  pole: CartesianPosition;
  meridian: CartesianPosition;
  east: CartesianPosition;
}

export interface ProceduralSunspotGroup {
  latitudeRadians: number;
  longitudeRadians: number;
  angularRadiusRadians: number;
  strength: number;
}

export function solarObservationMatchesDate(
  viewedDate: Date,
  observedAt: Date,
): boolean {
  const difference = Math.abs(viewedDate.getTime() - observedAt.getTime());
  return Number.isFinite(difference) && difference <= SOLAR_OBSERVATION_VALIDITY_MILLISECONDS;
}

/** NASA's rounded 25-day equator / 36-day pole rotation range. */
export function solarDifferentialRotationPeriodDays(latitudeRadians: number): number {
  return 25 + 11 * Math.sin(latitudeRadians) ** 2;
}

/** A compact visible-continuum quadratic limb-darkening approximation. */
export function solarLimbDarkening(mu: number): number {
  const boundedMu = Math.max(0, Math.min(1, mu));
  const limbDistance = 1 - boundedMu;
  return 1 - 0.58 * limbDistance - 0.12 * limbDistance ** 2;
}

/** Smooth fallback activity envelope for the approximate 11-year cycle. */
export function solarActivityLevel(date: Date): number {
  const cyclePosition = ((date.getTime() - SOLAR_CYCLE_25_START_MS) / DAY_MILLISECONDS) /
    SOLAR_CYCLE_DAYS;
  return 0.08 + 0.92 * Math.sin(Math.PI * (cyclePosition - Math.floor(cyclePosition))) ** 2;
}

/**
 * Produces continuous, bounded fallback spot groups. These are not observed
 * regions; the renderer uses them only when the dated SDO frame is stale.
 */
export function proceduralSunspotGroups(date: Date): readonly ProceduralSunspotGroup[] {
  const absoluteDay = date.getTime() / DAY_MILLISECONDS;
  const currentSlot = Math.floor(absoluteDay / 2);
  const activity = solarActivityLevel(date);
  const groups: ProceduralSunspotGroup[] = [];
  for (let slot = currentSlot - 8; slot <= currentSlot; slot += 1) {
    const seed = `solar-region-${slot}`;
    if (hashUnit(`${seed}-presence`) > 0.22 + activity * 0.65) continue;
    const startDay = slot * 2 + hashUnit(`${seed}-start`) * 1.4;
    const lifetimeDays = 5 + hashUnit(`${seed}-life`) * 11;
    const ageDays = absoluteDay - startDay;
    if (ageDays <= 0 || ageDays >= lifetimeDays) continue;
    const rawCycleProgress = (absoluteDay - SOLAR_CYCLE_25_START_MS / DAY_MILLISECONDS) /
      SOLAR_CYCLE_DAYS;
    const cycleProgress = ((rawCycleProgress % 1) + 1) % 1;
    const butterflyLatitude = (9 + 20 * (1 - Math.max(0, cycleProgress))) * Math.PI / 180;
    const latitude = butterflyLatitude * (hashUnit(`${seed}-hemisphere`) < 0.5 ? -1 : 1) +
      (hashUnit(`${seed}-latitude`) - 0.5) * 9 * Math.PI / 180;
    const differentialRate = TAU / solarDifferentialRotationPeriodDays(latitude) -
      IAU_SIDEREAL_RATE_RADIANS_PER_DAY;
    const rawLongitude = (hashUnit(`${seed}-longitude`) - 0.5) * TAU + differentialRate * ageDays;
    const longitude = Math.atan2(Math.sin(rawLongitude), Math.cos(rawLongitude));
    groups.push({
      latitudeRadians: latitude,
      longitudeRadians: longitude,
      angularRadiusRadians: (1.2 + hashUnit(`${seed}-radius`) * 3.6) * Math.PI / 180,
      strength: Math.sin(Math.PI * ageDays / lifetimeDays) * (0.58 + activity * 0.42),
    });
  }
  return groups;
}

export function solarGranulation(
  latitudeRadians: number,
  longitudeRadians: number,
  date: Date,
): number {
  const phase = date.getTime() / (8 * 60 * 1_000);
  const noise = (
    Math.sin(longitudeRadians * 71 + latitudeRadians * 43 + phase * 1.3) +
    Math.sin(longitudeRadians * 113 - latitudeRadians * 89 - phase * 0.8) * 0.55 +
    Math.cos(longitudeRadians * 47 + latitudeRadians * 137 + phase * 0.55) * 0.35
  ) / 1.9;
  return 0.965 + noise * 0.035;
}

/** Builds a screen-space body basis from topocentric solar-disc geometry. */
export function topocentricSolarSurfaceFrame(
  subObserverLatitudeDegrees: number,
  subObserverLongitudeDegrees: number,
  northPoleBearingRadians: number,
): SolarSurfaceFrame {
  const latitude = subObserverLatitudeDegrees * Math.PI / 180;
  const longitude = subObserverLongitudeDegrees * Math.PI / 180;
  const center = normalize({
    x: Math.cos(latitude) * Math.cos(longitude),
    y: Math.cos(latitude) * Math.sin(longitude),
    z: Math.sin(latitude),
  });
  const localNorth = normalize({
    x: -Math.sin(latitude) * Math.cos(longitude),
    y: -Math.sin(latitude) * Math.sin(longitude),
    z: Math.cos(latitude),
  });
  const localEast = { x: -Math.sin(longitude), y: Math.cos(longitude), z: 0 };
  const cosine = Math.cos(northPoleBearingRadians);
  const sine = Math.sin(northPoleBearingRadians);
  const screenRightBody = normalize({
    x: localEast.x * cosine + localNorth.x * sine,
    y: localEast.y * cosine + localNorth.y * sine,
    z: localEast.z * cosine + localNorth.z * sine,
  });
  const screenDownBody = normalize({
    x: localEast.x * sine - localNorth.x * cosine,
    y: localEast.y * sine - localNorth.y * cosine,
    z: localEast.z * sine - localNorth.z * cosine,
  });
  const inView = (bodyVector: CartesianPosition): CartesianPosition => ({
    x: dot(bodyVector, screenRightBody),
    y: dot(bodyVector, screenDownBody),
    z: dot(bodyVector, center),
  });
  return {
    meridian: inView({ x: 1, y: 0, z: 0 }),
    east: inView({ x: 0, y: 1, z: 0 }),
    pole: inView({ x: 0, y: 0, z: 1 }),
  };
}

const TAU = Math.PI * 2;
