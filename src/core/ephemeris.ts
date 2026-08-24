import {
  Body,
  Ecliptic,
  Equator,
  EquatorFromVector,
  HelioVector,
  Horizon,
  Illumination,
  JupiterMoons,
  Libration,
  MakeTime,
  MoonPhase,
  Observer,
  RotateVector,
  RotationAxis,
  Rotation_EQJ_EQD,
  Rotation_GAL_EQJ,
  Spherical,
  VectorFromSphere,
} from 'astronomy-engine';
import satelliteReference from '../data/satellite-reference.json';
import {
  APOLLO_11_SITE,
  AU_KM,
  MAJOR_SATELLITES,
  PARENT_RADIUS_KM,
  PLANETS,
} from './constants';
import {
  clamp,
  degreesToRadians,
  dot,
  hashUnit,
  magnitude,
  normalize,
  normalizeDegrees,
  perpendicularDistanceToRay,
  shortestAngularDifference,
} from './math';
import type {
  CartesianPosition,
  HorizonSnapshot,
  HorizontalPosition,
  LunarHorizonSnapshot,
  ObserverLocation,
  PlanetState,
  SatelliteState,
  SolarSystemSnapshot,
} from './types';

const MODERN_EPHEMERIS_START_YEAR = -2999;
const MODERN_EPHEMERIS_END_YEAR = 3000;
const J2000_UNIX_MS = Date.UTC(2000, 0, 1, 12);
const SATELLITE_REFERENCE_MS = new Date(satelliteReference.referenceDate).getTime();
const APPARENT_MOTION_SAMPLE_SECONDS = 60;
const satelliteReferenceMap = new Map(
  satelliteReference.entries.map((entry) => [entry.key, entry]),
);

const asCartesian = (vector: { x: number; y: number; z: number }): CartesianPosition => ({
  x: vector.x,
  y: vector.y,
  z: vector.z,
});

function horizontalPosition(body: Body, date: Date, observer: Observer): HorizontalPosition {
  const equatorial = Equator(body, date, observer, true, true);
  const horizontal = Horizon(date, observer, equatorial.ra, equatorial.dec, 'normal');
  return {
    altitudeDegrees: horizontal.altitude,
    azimuthDegrees: horizontal.azimuth,
    distanceKm: equatorial.dist * AU_KM,
  };
}

function galacticPointOnHorizon(
  longitudeDegrees: number,
  date: Date,
  observer: Observer,
): HorizontalPosition {
  const time = MakeTime(date);
  const galacticVector = VectorFromSphere(new Spherical(0, normalizeDegrees(longitudeDegrees), 1), time);
  const eqjVector = RotateVector(Rotation_GAL_EQJ(), galacticVector);
  const eqdVector = RotateVector(Rotation_EQJ_EQD(time), eqjVector);
  const equatorial = EquatorFromVector(eqdVector);
  const horizontal = Horizon(date, observer, equatorial.ra, equatorial.dec, 'normal');
  return {
    altitudeDegrees: horizontal.altitude,
    azimuthDegrees: horizontal.azimuth,
  };
}

function withApparentMotion(
  current: HorizontalPosition,
  future: HorizontalPosition,
  sampleSeconds = APPARENT_MOTION_SAMPLE_SECONDS,
): HorizontalPosition {
  return {
    ...current,
    apparentMotion: {
      altitudeDegreesPerSecond: (future.altitudeDegrees - current.altitudeDegrees) / sampleSeconds,
      azimuthDegreesPerSecond: shortestAngularDifference(
        current.azimuthDegrees,
        future.azimuthDegrees,
      ) / sampleSeconds,
    },
  };
}

export function getHorizonSnapshot(date: Date, location: ObserverLocation): HorizonSnapshot {
  const observer = new Observer(location.latitude, location.longitude, location.elevationMeters);
  const futureDate = new Date(date.getTime() + APPARENT_MOTION_SAMPLE_SECONDS * 1_000);
  const sun = withApparentMotion(
    horizontalPosition(Body.Sun, date, observer),
    horizontalPosition(Body.Sun, futureDate, observer),
  );
  const moon = withApparentMotion(
    horizontalPosition(Body.Moon, date, observer),
    horizontalPosition(Body.Moon, futureDate, observer),
  );
  const moonPhaseAngle = MoonPhase(date);
  const milkyWay = Array.from({ length: 49 }, (_, index) => {
    const longitude = index * 7.5;
    return withApparentMotion(
      galacticPointOnHorizon(longitude, date, observer),
      galacticPointOnHorizon(longitude, futureDate, observer),
    );
  });

  return {
    date,
    observer: location,
    sun,
    moon: {
      ...moon,
      phaseAngleDegrees: moonPhaseAngle,
      illuminatedFraction: (1 - Math.cos(degreesToRadians(moonPhaseAngle))) / 2,
    },
    galacticCenter: milkyWay[0],
    milkyWay,
  };
}

function lunarEarthPosition(date: Date): LunarHorizonSnapshot['earth'] {
  const libration = Libration(date);
  const siteLatitude = degreesToRadians(APOLLO_11_SITE.latitude);
  const siteLongitude = degreesToRadians(APOLLO_11_SITE.longitude);
  const earthLatitude = degreesToRadians(libration.elat);
  const earthLongitude = degreesToRadians(libration.elon);
  const deltaLongitude = earthLongitude - siteLongitude;
  const cosZenith = clamp(
    Math.sin(siteLatitude) * Math.sin(earthLatitude) +
      Math.cos(siteLatitude) * Math.cos(earthLatitude) * Math.cos(deltaLongitude),
    -1,
    1,
  );
  const altitude = 90 - Math.acos(cosZenith) * 180 / Math.PI;
  const east = Math.sin(deltaLongitude) * Math.cos(earthLatitude);
  const north = Math.cos(siteLatitude) * Math.sin(earthLatitude) -
    Math.sin(siteLatitude) * Math.cos(earthLatitude) * Math.cos(deltaLongitude);
  const earthPhaseAngle = normalizeDegrees(MoonPhase(date) + 180);

  return {
    altitudeDegrees: altitude,
    azimuthDegrees: normalizeDegrees(Math.atan2(east, north) * 180 / Math.PI),
    distanceKm: libration.dist_km,
    angularDiameterDegrees: 2 * Math.atan(6_378.137 / libration.dist_km) * 180 / Math.PI,
    phaseAngleDegrees: earthPhaseAngle,
    illuminatedFraction: (1 - Math.cos(degreesToRadians(earthPhaseAngle))) / 2,
  };
}

export function getLunarHorizonSnapshot(date: Date): LunarHorizonSnapshot {
  const futureDate = new Date(date.getTime() + APPARENT_MOTION_SAMPLE_SECONDS * 1_000);
  const earth = lunarEarthPosition(date);
  const futureEarth = lunarEarthPosition(futureDate);

  return {
    date,
    siteLatitudeDegrees: APOLLO_11_SITE.latitude,
    siteLongitudeDegrees: APOLLO_11_SITE.longitude,
    earth: {
      ...earth,
      apparentMotion: withApparentMotion(earth, futureEarth).apparentMotion,
    },
  };
}

function getPlanetState(date: Date, planet: (typeof PLANETS)[number]): PlanetState {
  const vector = HelioVector(planet.body, date);
  const ecliptic = Ecliptic(vector);
  const axis = RotationAxis(planet.body, date);
  const illumination = planet.body === Body.Earth
    ? { phase_fraction: 1, phase_angle: 0, ring_tilt: undefined }
    : Illumination(planet.body, date);

  return {
    key: planet.key,
    name: planet.name,
    color: planet.color,
    radiusKm: planet.radiusKm,
    // Preserve EQJ/ICRF orientation so satellite shadow vectors share a frame.
    heliocentricAu: asCartesian(vector),
    distanceAu: vector.Length(),
    eclipticLongitudeDegrees: ecliptic.elon,
    eclipticLatitudeDegrees: ecliptic.elat,
    illuminatedFraction: illumination.phase_fraction,
    phaseAngleDegrees: illumination.phase_angle,
    ringTiltDegrees: illumination.ring_tilt,
    primeMeridianDegrees: axis.spin,
    rotationPeriodHours: planet.rotationPeriodHours,
    orbit: planet.orbit,
  };
}

function stumpffC(value: number): number {
  if (value > 1e-8) return (1 - Math.cos(Math.sqrt(value))) / value;
  if (value < -1e-8) return (Math.cosh(Math.sqrt(-value)) - 1) / -value;
  return 0.5 - value / 24 + value * value / 720;
}

function stumpffS(value: number): number {
  if (value > 1e-8) return (Math.sqrt(value) - Math.sin(Math.sqrt(value))) / Math.sqrt(value) ** 3;
  if (value < -1e-8) return (Math.sinh(Math.sqrt(-value)) - Math.sqrt(-value)) / Math.sqrt(-value) ** 3;
  return 1 / 6 - value / 120 + value * value / 5_040;
}

function propagateJplReferenceOrbit(
  key: string,
  semiMajorAxisKm: number,
  periodDays: number,
  date: Date,
): CartesianPosition {
  const reference = satelliteReferenceMap.get(key);
  if (!reference) {
    const elapsedDays = (date.getTime() - J2000_UNIX_MS) / 86_400_000;
    const phase = hashUnit(key) * Math.PI * 2 + elapsedDays / Math.abs(periodDays) * Math.PI * 2 * Math.sign(periodDays);
    return {
      x: Math.cos(phase) * semiMajorAxisKm,
      y: Math.sin(phase) * semiMajorAxisKm,
      z: 0,
    };
  }

  const initialPosition = reference.positionKm;
  const initialVelocity = reference.velocityKmPerSecond;
  const periodSeconds = Math.abs(periodDays) * 86_400;
  let elapsedSeconds = (date.getTime() - SATELLITE_REFERENCE_MS) / 1_000;
  elapsedSeconds = ((elapsedSeconds + periodSeconds / 2) % periodSeconds + periodSeconds) % periodSeconds - periodSeconds / 2;

  const gravitationalParameter = 4 * Math.PI ** 2 * semiMajorAxisKm ** 3 / periodSeconds ** 2;
  const radius = magnitude(initialPosition);
  const velocitySquared = dot(initialVelocity, initialVelocity);
  const radialVelocity = dot(initialPosition, initialVelocity) / radius;
  const alpha = 2 / radius - velocitySquared / gravitationalParameter;
  const squareRootMu = Math.sqrt(gravitationalParameter);
  let anomaly = squareRootMu * Math.abs(alpha) * elapsedSeconds;

  for (let iteration = 0; iteration < 18; iteration += 1) {
    const z = alpha * anomaly ** 2;
    const c = stumpffC(z);
    const s = stumpffS(z);
    const value = radius * radialVelocity / squareRootMu * anomaly ** 2 * c +
      (1 - alpha * radius) * anomaly ** 3 * s +
      radius * anomaly - squareRootMu * elapsedSeconds;
    const derivative = radius * radialVelocity / squareRootMu * anomaly * (1 - z * s) +
      (1 - alpha * radius) * anomaly ** 2 * c + radius;
    const correction = value / derivative;
    anomaly -= correction;
    if (Math.abs(correction) < 1e-9) break;
  }

  const z = alpha * anomaly ** 2;
  const f = 1 - anomaly ** 2 / radius * stumpffC(z);
  const g = elapsedSeconds - anomaly ** 3 / squareRootMu * stumpffS(z);
  return {
    x: f * initialPosition.x + g * initialVelocity.x,
    y: f * initialPosition.y + g * initialVelocity.y,
    z: f * initialPosition.z + g * initialVelocity.z,
  };
}

function getJupiterSatellitePositions(date: Date): Readonly<Record<string, CartesianPosition>> {
  const moons = JupiterMoons(date);
  return {
    io: { x: moons.io.x * AU_KM, y: moons.io.y * AU_KM, z: moons.io.z * AU_KM },
    europa: { x: moons.europa.x * AU_KM, y: moons.europa.y * AU_KM, z: moons.europa.z * AU_KM },
    ganymede: { x: moons.ganymede.x * AU_KM, y: moons.ganymede.y * AU_KM, z: moons.ganymede.z * AU_KM },
    callisto: { x: moons.callisto.x * AU_KM, y: moons.callisto.y * AU_KM, z: moons.callisto.z * AU_KM },
  };
}

function isSatelliteSunlit(
  relativePositionKm: CartesianPosition,
  parentHeliocentricAu: CartesianPosition,
  parentRadiusKm: number,
): boolean {
  const antiSunDirection = normalize(parentHeliocentricAu);
  const isBehindParent = dot(relativePositionKm, antiSunDirection) > 0;
  if (!isBehindParent) return true;
  return perpendicularDistanceToRay(relativePositionKm, antiSunDirection) > parentRadiusKm;
}

function getSatelliteStates(date: Date, planets: PlanetState[]): SatelliteState[] {
  const parentMap = new Map(planets.map((planet) => [planet.key, planet]));
  const jupiterPositions = getJupiterSatellitePositions(date);
  const moonVector = HelioVector(Body.Moon, date);
  const earthVector = HelioVector(Body.Earth, date);
  const exactMoonPosition = {
    x: (moonVector.x - earthVector.x) * AU_KM,
    y: (moonVector.y - earthVector.y) * AU_KM,
    z: (moonVector.z - earthVector.z) * AU_KM,
  };

  return MAJOR_SATELLITES.map((satellite) => {
    const parent = parentMap.get(satellite.parent);
    const exact = satellite.key === 'moon'
      ? exactMoonPosition
      : jupiterPositions[satellite.key];
    const relativePositionKm = exact ?? propagateJplReferenceOrbit(
      satellite.key,
      satellite.semiMajorAxisKm,
      satellite.periodDays,
      date,
    );
    const phase = satellite.key === 'moon'
      ? (1 - Math.cos(degreesToRadians(MoonPhase(date)))) / 2
      : parent?.illuminatedFraction ?? 1;

    return {
      key: satellite.key,
      name: satellite.name,
      parent: satellite.parent,
      radiusKm: satellite.radiusKm,
      semiMajorAxisKm: satellite.semiMajorAxisKm,
      relativePositionKm,
      illuminatedFraction: phase,
      sunlit: parent
        ? isSatelliteSunlit(relativePositionKm, parent.heliocentricAu, PARENT_RADIUS_KM[satellite.parent] ?? 0)
        : true,
      model: exact ? 'integrated' : 'jpl-reference-kepler',
    };
  });
}

export function getMercuryPerihelionLongitude(date: Date): number {
  const julianCenturies = (date.getTime() - J2000_UNIX_MS) / (86_400_000 * 36_525);
  return normalizeDegrees(77.45779628 + 0.16047689 * julianCenturies);
}

export function getSolarSystemSnapshot(date: Date): SolarSystemSnapshot {
  const year = date.getUTCFullYear();
  const safeDate = year >= MODERN_EPHEMERIS_START_YEAR && year <= MODERN_EPHEMERIS_END_YEAR
    ? date
    : new Date();
  const planets = PLANETS.map((planet) => getPlanetState(safeDate, planet));
  return {
    date,
    planets,
    satellites: getSatelliteStates(safeDate, planets),
    mercuryPerihelionLongitudeDegrees: getMercuryPerihelionLongitude(safeDate),
    mercuryRelativisticPrecessionArcsecondsPerCentury: 42.98,
    validity: safeDate === date ? 'ephemeris' : 'illustrative',
  };
}

export function satelliteDistanceFromParent(state: SatelliteState): number {
  return magnitude(state.relativePositionKm);
}
