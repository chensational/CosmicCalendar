import {
  MOON_ALBEDO_BASE64,
  MOON_ALBEDO_HEIGHT,
  MOON_ALBEDO_WIDTH,
} from '../data/moon-albedo-embedded';
import { clamp, degreesToRadians, dot, normalize, normalizeDegrees } from './math';
import type { CartesianPosition } from './types';

export interface LunarSurfaceGeometry {
  viewCenterBody: CartesianPosition;
  screenRightBody: CartesianPosition;
  screenUpBody: CartesianPosition;
  lightInView: CartesianPosition;
}

let decodedAlbedo: Uint8Array | undefined;

function decodeAlbedo(): Uint8Array {
  if (decodedAlbedo) return decodedAlbedo;
  const binary = globalThis.atob(MOON_ALBEDO_BASE64);
  decodedAlbedo = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return decodedAlbedo;
}

function scaleAndAdd(
  first: CartesianPosition,
  firstScale: number,
  second: CartesianPosition,
  secondScale: number,
): CartesianPosition {
  return {
    x: first.x * firstScale + second.x * secondScale,
    y: first.y * firstScale + second.y * secondScale,
    z: first.z * firstScale + second.z * secondScale,
  };
}

function cross(first: CartesianPosition, second: CartesianPosition): CartesianPosition {
  return {
    x: first.y * second.z - first.z * second.y,
    y: first.z * second.x - first.x * second.z,
    z: first.x * second.y - first.y * second.x,
  };
}

/**
 * Builds the body-fixed lunar basis seen by a terrestrial observer.
 * Bearings are clockwise from increasing altitude, matching the horizon view.
 */
export function lunarSurfaceGeometry(
  subObserverLatitudeDegrees: number,
  subObserverLongitudeDegrees: number,
  northPoleBearingRadians: number,
  sunBearingRadians: number,
  solarPhaseAngleDegrees: number,
): LunarSurfaceGeometry {
  const latitude = degreesToRadians(subObserverLatitudeDegrees);
  const longitude = degreesToRadians(subObserverLongitudeDegrees);
  const viewCenterBody = normalize({
    x: Math.cos(latitude) * Math.cos(longitude),
    y: Math.cos(latitude) * Math.sin(longitude),
    z: Math.sin(latitude),
  });
  const bodyNorth = { x: 0, y: 0, z: 1 };
  const projectedNorth = normalize(scaleAndAdd(
    bodyNorth,
    1,
    viewCenterBody,
    -dot(bodyNorth, viewCenterBody),
  ));
  const projectedEast = normalize(cross(projectedNorth, viewCenterBody));
  const bearingCosine = Math.cos(northPoleBearingRadians);
  const bearingSine = Math.sin(northPoleBearingRadians);
  const screenRightBody = normalize(scaleAndAdd(
    projectedEast,
    bearingCosine,
    projectedNorth,
    bearingSine,
  ));
  const screenUpBody = normalize(scaleAndAdd(
    projectedNorth,
    bearingCosine,
    projectedEast,
    -bearingSine,
  ));

  // The physical solar phase angle is 0° at full Moon and 180° at new Moon.
  const phase = degreesToRadians(clamp(solarPhaseAngleDegrees, 0, 180));
  const towardObserver = Math.cos(phase);
  const skyPlaneLength = Math.sqrt(Math.max(0, 1 - towardObserver ** 2));
  const lightInView = normalize({
    x: Math.sin(sunBearingRadians) * skyPlaneLength,
    y: Math.cos(sunBearingRadians) * skyPlaneLength,
    z: towardObserver,
  });

  return { viewCenterBody, screenRightBody, screenUpBody, lightInView };
}

export function visibleLunarNormalToBody(
  normalInView: CartesianPosition,
  geometry: LunarSurfaceGeometry,
): CartesianPosition {
  return normalize({
    x: geometry.screenRightBody.x * normalInView.x +
      geometry.screenUpBody.x * normalInView.y +
      geometry.viewCenterBody.x * normalInView.z,
    y: geometry.screenRightBody.y * normalInView.x +
      geometry.screenUpBody.y * normalInView.y +
      geometry.viewCenterBody.y * normalInView.z,
    z: geometry.screenRightBody.z * normalInView.x +
      geometry.screenUpBody.z * normalInView.y +
      geometry.viewCenterBody.z * normalInView.z,
  });
}

/** Bilinear sample of the NASA LRO/WAC equirectangular albedo mosaic. */
export function sampleLunarAlbedo(longitudeRadians: number, latitudeRadians: number): number {
  const albedo = decodeAlbedo();
  const wrappedLongitude = Math.atan2(Math.sin(longitudeRadians), Math.cos(longitudeRadians));
  const x = (wrappedLongitude / (Math.PI * 2) + 0.5) * MOON_ALBEDO_WIDTH - 0.5;
  const y = (0.5 - clamp(latitudeRadians, -Math.PI / 2, Math.PI / 2) / Math.PI) *
    MOON_ALBEDO_HEIGHT - 0.5;
  const xFloor = Math.floor(x);
  const yFloor = Math.floor(y);
  const xMix = x - xFloor;
  const yMix = y - yFloor;
  const sample = (sampleX: number, sampleY: number) => {
    const wrappedX = ((sampleX % MOON_ALBEDO_WIDTH) + MOON_ALBEDO_WIDTH) % MOON_ALBEDO_WIDTH;
    const boundedY = clamp(sampleY, 0, MOON_ALBEDO_HEIGHT - 1);
    return albedo[boundedY * MOON_ALBEDO_WIDTH + wrappedX] / 255;
  };
  const upper = sample(xFloor, yFloor) * (1 - xMix) + sample(xFloor + 1, yFloor) * xMix;
  const lower = sample(xFloor, yFloor + 1) * (1 - xMix) + sample(xFloor + 1, yFloor + 1) * xMix;
  return upper * (1 - yMix) + lower * yMix;
}

/**
 * Lunar-Lambert scattering: mostly Lommel-Seeliger single scattering with a
 * small Lambert term, suitable for the Moon's dark particulate regolith.
 */
export function lunarReflectance(
  normalInView: CartesianPosition,
  lightInView: CartesianPosition,
  earthshine = 0.018,
): number {
  const emissionCosine = Math.max(0, normalInView.z);
  const incidenceCosine = Math.max(0, dot(normalInView, normalize(lightInView)));
  if (incidenceCosine <= 0) return earthshine;
  const lommelSeeliger = 2 * incidenceCosine /
    Math.max(1e-6, incidenceCosine + emissionCosine);
  const lunarLambert = lommelSeeliger * 0.92 + incidenceCosine * 0.08;
  return earthshine + (1 - earthshine) * clamp(lunarLambert, 0, 1);
}
