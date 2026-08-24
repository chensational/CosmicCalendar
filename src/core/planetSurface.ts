import { dot, normalize } from './math';
import type { CartesianPosition } from './types';

export const SOLAR_CAMERA_ROTATION_RADIANS = -0.12;
const SOLAR_CAMERA_PLANE_COMPRESSION = 0.48;
const SOLAR_CAMERA_HEIGHT_RESPONSE = -0.72;

export const SOLAR_VIEW_BASIS = (() => {
  const cosine = Math.cos(SOLAR_CAMERA_ROTATION_RADIANS);
  const sine = Math.sin(SOLAR_CAMERA_ROTATION_RADIANS);
  const screenX = normalize({ x: cosine, y: -sine, z: 0 });
  const screenY = normalize({
    x: sine * SOLAR_CAMERA_PLANE_COMPRESSION,
    y: cosine * SOLAR_CAMERA_PLANE_COMPRESSION,
    z: SOLAR_CAMERA_HEIGHT_RESPONSE,
  });
  const towardViewer = normalize({
    x: screenX.y * screenY.z - screenX.z * screenY.y,
    y: screenX.z * screenY.x - screenX.x * screenY.z,
    z: screenX.x * screenY.y - screenX.y * screenY.x,
  });
  return { screenX, screenY, towardViewer } as const;
})();

export function toSolarView(vector: CartesianPosition): CartesianPosition {
  return {
    x: dot(vector, SOLAR_VIEW_BASIS.screenX),
    y: dot(vector, SOLAR_VIEW_BASIS.screenY),
    z: dot(vector, SOLAR_VIEW_BASIS.towardViewer),
  };
}

export function rotateEquatorialBasis(
  meridian: CartesianPosition,
  east: CartesianPosition,
  deltaDegrees: number,
) {
  const angle = deltaDegrees * Math.PI / 180;
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return {
    meridian: normalize({
      x: meridian.x * cosine + east.x * sine,
      y: meridian.y * cosine + east.y * sine,
      z: meridian.z * cosine + east.z * sine,
    }),
    east: normalize({
      x: -meridian.x * sine + east.x * cosine,
      y: -meridian.y * sine + east.y * cosine,
      z: -meridian.z * sine + east.z * cosine,
    }),
  };
}

export function sphereCoordinates(
  visibleNormal: CartesianPosition,
  poleInView: CartesianPosition,
  meridianInView: CartesianPosition,
  eastInView: CartesianPosition,
) {
  return {
    latitudeRadians: Math.asin(Math.max(-1, Math.min(1, dot(visibleNormal, poleInView)))),
    longitudeRadians: Math.atan2(
      dot(visibleNormal, eastInView),
      dot(visibleNormal, meridianInView),
    ),
  };
}

export function lambertianLight(
  visibleNormal: CartesianPosition,
  lightInView: CartesianPosition,
  ambient = 0.025,
): number {
  return ambient + Math.max(0, dot(visibleNormal, normalize(lightInView))) * (1 - ambient);
}
