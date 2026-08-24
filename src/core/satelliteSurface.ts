import { AU_KM, SUN_RADIUS_KM } from './constants';
import { clamp, cross, dot, magnitude, normalize } from './math';
import type { CartesianPosition } from './types';

export { SUN_RADIUS_KM } from './constants';

/** Fraction of the luminous circular source not covered by an occultor. */
export function visibleDiscFraction(
  lightAngularRadius: number,
  occultorAngularRadius: number,
  centerSeparation: number,
): number {
  const lightRadius = Math.max(0, lightAngularRadius);
  const occultorRadius = Math.max(0, occultorAngularRadius);
  const separation = Math.max(0, centerSeparation);
  if (!lightRadius) return 0;
  if (!occultorRadius || separation >= lightRadius + occultorRadius) return 1;
  if (occultorRadius >= separation + lightRadius) return 0;
  if (lightRadius >= separation + occultorRadius) {
    return 1 - occultorRadius ** 2 / lightRadius ** 2;
  }

  const lightTerm = clamp(
    (separation ** 2 + lightRadius ** 2 - occultorRadius ** 2) /
      (2 * separation * lightRadius),
    -1,
    1,
  );
  const occultorTerm = clamp(
    (separation ** 2 + occultorRadius ** 2 - lightRadius ** 2) /
      (2 * separation * occultorRadius),
    -1,
    1,
  );
  const radical = Math.max(0,
    (-separation + lightRadius + occultorRadius) *
    (separation + lightRadius - occultorRadius) *
    (separation - lightRadius + occultorRadius) *
    (separation + lightRadius + occultorRadius));
  const overlapArea = lightRadius ** 2 * Math.acos(lightTerm) +
    occultorRadius ** 2 * Math.acos(occultorTerm) - Math.sqrt(radical) / 2;
  return clamp(1 - overlapArea / (Math.PI * lightRadius ** 2), 0, 1);
}

/** Finite-Sun eclipse response, including partial penumbra and annular transit. */
export function satelliteSunlightFraction(
  relativePositionKm: CartesianPosition,
  parentHeliocentricAu: CartesianPosition,
  parentRadiusKm: number,
): number {
  const satelliteHeliocentricKm = {
    x: parentHeliocentricAu.x * AU_KM + relativePositionKm.x,
    y: parentHeliocentricAu.y * AU_KM + relativePositionKm.y,
    z: parentHeliocentricAu.z * AU_KM + relativePositionKm.z,
  };
  const sunDirection = normalize({
    x: -satelliteHeliocentricKm.x,
    y: -satelliteHeliocentricKm.y,
    z: -satelliteHeliocentricKm.z,
  });
  const parentDirection = normalize({
    x: -relativePositionKm.x,
    y: -relativePositionKm.y,
    z: -relativePositionKm.z,
  });
  const sunAngularRadius = Math.asin(clamp(
    SUN_RADIUS_KM / magnitude(satelliteHeliocentricKm),
    0,
    1,
  ));
  const parentAngularRadius = Math.asin(clamp(
    parentRadiusKm / magnitude(relativePositionKm),
    0,
    1,
  ));
  const separation = Math.acos(clamp(dot(sunDirection, parentDirection), -1, 1));
  return visibleDiscFraction(sunAngularRadius, parentAngularRadius, separation);
}

/**
 * A synchronous satellite keeps its prime meridian pointed at its parent.
 * The instantaneous orbital angular momentum supplies its rotation pole.
 */
export function tidallyLockedBasis(
  relativePosition: CartesianPosition,
  relativeVelocity: CartesianPosition,
) {
  const meridian = normalize({
    x: -relativePosition.x,
    y: -relativePosition.y,
    z: -relativePosition.z,
  });
  let north = normalize(cross(relativePosition, relativeVelocity));
  let east = cross(north, meridian);
  if (magnitude(east) < 1e-9) {
    const fallback = Math.abs(meridian.z) < 0.9 ? { x: 0, y: 0, z: 1 } : { x: 0, y: 1, z: 0 };
    east = cross(fallback, meridian);
  }
  east = normalize(east);
  north = normalize(cross(meridian, east));
  return { north, meridian, east } as const;
}
