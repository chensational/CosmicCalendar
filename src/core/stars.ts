import {
  Atmosphere,
  MakeTime,
  Refraction,
  Rotation_EQJ_EQD,
  SiderealTime,
} from 'astronomy-engine';
import { clamp, degreesToRadians, normalizeDegrees, radiansToDegrees } from './math';
import type { CatalogStar, ObserverLocation, VisibleStar } from './types';

const J2000_UNIX_MS = Date.UTC(2000, 0, 1, 12);
const JULIAN_YEAR_MS = 365.25 * 86_400_000;
const DEFAULT_EXTINCTION_MAGNITUDES_PER_AIRMASS = 0.2;
const COLOR_EXCESS_PER_AIRMASS = 0.06;
const VISUAL_MAGNITUDE_LIMIT = 6.6;

function spinZ(angleDegrees: number, vector: readonly number[]) {
  const angle = degreesToRadians(angleDegrees);
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return [
    cosine * vector[0] + sine * vector[1],
    cosine * vector[1] - sine * vector[0],
    vector[2],
  ] as const;
}

export function relativeOpticalAirMass(altitudeDegrees: number): number {
  if (altitudeDegrees < 0) return Number.POSITIVE_INFINITY;
  return 1 / (
    Math.sin(degreesToRadians(altitudeDegrees)) +
    0.50572 * (altitudeDegrees + 6.07995) ** -1.6364
  );
}

export function getVisibleStars(
  date: Date,
  location: ObserverLocation,
  catalog: readonly CatalogStar[],
): readonly VisibleStar[] {
  const yearsSinceJ2000 = (date.getTime() - J2000_UNIX_MS) / JULIAN_YEAR_MS;
  const time = MakeTime(date);
  const precession = Rotation_EQJ_EQD(time).rot;
  const latitude = degreesToRadians(location.latitude);
  const longitude = degreesToRadians(location.longitude);
  const zenithUnrotated = [
    Math.cos(latitude) * Math.cos(longitude),
    Math.cos(latitude) * Math.sin(longitude),
    Math.sin(latitude),
  ];
  const northUnrotated = [
    -Math.sin(latitude) * Math.cos(longitude),
    -Math.sin(latitude) * Math.sin(longitude),
    Math.cos(latitude),
  ];
  const westUnrotated = [Math.sin(longitude), -Math.cos(longitude), 0];
  const siderealSpin = -15 * SiderealTime(time);
  const zenith = spinZ(siderealSpin, zenithUnrotated);
  const north = spinZ(siderealSpin, northUnrotated);
  const west = spinZ(siderealSpin, westUnrotated);
  const atmosphereDensity = Atmosphere(clamp(location.elevationMeters, -500, 100_000)).density;
  const extinctionCoefficient = DEFAULT_EXTINCTION_MAGNITUDES_PER_AIRMASS * atmosphereDensity;
  const visible: VisibleStar[] = [];

  for (const star of catalog) {
    const declination = star.declinationDegrees +
      star.properMotionDecArcsecondsPerYear * yearsSinceJ2000 / 3_600;
    const declinationCosine = Math.max(Math.cos(degreesToRadians(declination)), 1e-6);
    const rightAscension = normalizeDegrees(
      star.rightAscensionDegrees +
      star.properMotionRaArcsecondsPerYear * yearsSinceJ2000 / (3_600 * declinationCosine),
    );
    const rightAscensionRadians = degreesToRadians(rightAscension);
    const declinationRadians = degreesToRadians(declination);
    const eqj = [
      Math.cos(declinationRadians) * Math.cos(rightAscensionRadians),
      Math.cos(declinationRadians) * Math.sin(rightAscensionRadians),
      Math.sin(declinationRadians),
    ];
    const eqd = [
      precession[0][0] * eqj[0] + precession[1][0] * eqj[1] + precession[2][0] * eqj[2],
      precession[0][1] * eqj[0] + precession[1][1] * eqj[1] + precession[2][1] * eqj[2],
      precession[0][2] * eqj[0] + precession[1][2] * eqj[1] + precession[2][2] * eqj[2],
    ];
    const zenithComponent = eqd[0] * zenith[0] + eqd[1] * zenith[1] + eqd[2] * zenith[2];
    const northComponent = eqd[0] * north[0] + eqd[1] * north[1] + eqd[2] * north[2];
    const westComponent = eqd[0] * west[0] + eqd[1] * west[1] + eqd[2] * west[2];
    const projection = Math.hypot(northComponent, westComponent);
    const geometricAltitude = radiansToDegrees(Math.atan2(zenithComponent, projection));
    if (geometricAltitude < -0.7) continue;
    const altitudeDegrees = geometricAltitude +
      Refraction('normal', geometricAltitude) * atmosphereDensity;
    if (altitudeDegrees < 0) continue;
    const relativeAirMass = relativeOpticalAirMass(altitudeDegrees);
    const excessAirMass = Math.max(0, relativeAirMass - 1);
    const apparentMagnitude = star.visualMagnitude + extinctionCoefficient * excessAirMass;
    if (apparentMagnitude > VISUAL_MAGNITUDE_LIMIT) continue;
    const azimuthDegrees = projection > 0
      ? normalizeDegrees(-radiansToDegrees(Math.atan2(westComponent, northComponent)))
      : 0;
    visible.push({
      hr: star.hr,
      altitudeDegrees,
      azimuthDegrees,
      apparentMagnitude,
      colorIndex: clamp(
        (star.colorIndex ?? 0.45) + COLOR_EXCESS_PER_AIRMASS * atmosphereDensity * excessAirMass,
        -0.4,
        2.2,
      ),
      relativeAirMass,
    });
  }
  return visible;
}
