import { degreesToRadians } from './math';
import type { CartesianPosition, OrbitalElements } from './types';

/**
 * Returns a J2000-ecliptic point on the Kepler ellipse. The live planet marker is
 * still supplied by Astronomy Engine; this is used only to draw a coherent guide.
 */
export function orbitalPositionAtTrueAnomaly(
  orbit: OrbitalElements,
  trueAnomalyRadians: number,
): CartesianPosition {
  const inclination = degreesToRadians(orbit.inclinationDegrees);
  const ascendingNode = degreesToRadians(orbit.ascendingNodeDegrees);
  const argumentPerihelion = degreesToRadians(
    orbit.longitudePerihelionDegrees - orbit.ascendingNodeDegrees,
  );
  const argumentLatitude = argumentPerihelion + trueAnomalyRadians;
  const radius = orbit.semiMajorAxisAu * (1 - orbit.eccentricity ** 2) /
    (1 + orbit.eccentricity * Math.cos(trueAnomalyRadians));
  const cosNode = Math.cos(ascendingNode);
  const sinNode = Math.sin(ascendingNode);
  const cosLatitude = Math.cos(argumentLatitude);
  const sinLatitude = Math.sin(argumentLatitude);
  const cosInclination = Math.cos(inclination);

  return {
    x: radius * (cosNode * cosLatitude - sinNode * sinLatitude * cosInclination),
    y: radius * (sinNode * cosLatitude + cosNode * sinLatitude * cosInclination),
    z: radius * sinLatitude * Math.sin(inclination),
  };
}

export function eclipticSphericalToCartesian(
  radius: number,
  longitudeDegrees: number,
  latitudeDegrees: number,
): CartesianPosition {
  const longitude = degreesToRadians(longitudeDegrees);
  const latitude = degreesToRadians(latitudeDegrees);
  const planarRadius = radius * Math.cos(latitude);
  return {
    x: planarRadius * Math.cos(longitude),
    y: planarRadius * Math.sin(longitude),
    z: radius * Math.sin(latitude),
  };
}
