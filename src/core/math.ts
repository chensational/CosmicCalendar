import type { CartesianPosition } from './types';

export const degreesToRadians = (degrees: number) => degrees * Math.PI / 180;
export const radiansToDegrees = (radians: number) => radians * 180 / Math.PI;

export function normalizeDegrees(value: number): number {
  return ((value % 360) + 360) % 360;
}

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function magnitude(vector: CartesianPosition): number {
  return Math.hypot(vector.x, vector.y, vector.z);
}

export function dot(a: CartesianPosition, b: CartesianPosition): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function subtract(a: CartesianPosition, b: CartesianPosition): CartesianPosition {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function normalize(vector: CartesianPosition): CartesianPosition {
  const length = magnitude(vector) || 1;
  return { x: vector.x / length, y: vector.y / length, z: vector.z / length };
}

export function perpendicularDistanceToRay(point: CartesianPosition, ray: CartesianPosition): number {
  const projection = dot(point, ray);
  const nearest = {
    x: ray.x * projection,
    y: ray.y * projection,
    z: ray.z * projection,
  };
  return magnitude(subtract(point, nearest));
}

export function hashUnit(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4_294_967_296;
}
