import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import {
  EquatorFromVector,
  Horizon,
  MakeTime,
  Observer,
  RotateVector,
  Rotation_EQJ_EQD,
  Spherical,
  VectorFromSphere,
} from 'astronomy-engine';
import { beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_LOCATION } from '../src/core/constants';
import { decodeBrightStarCatalog } from '../src/core/starCatalog';
import { getVisibleStars, relativeOpticalAirMass } from '../src/core/stars';
import type { CatalogStar } from '../src/core/types';

let catalog: readonly CatalogStar[];

beforeAll(async () => {
  const bytes = await readFile(resolve(process.cwd(), 'src/data/bright-stars.bin'));
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  catalog = decodeBrightStarCatalog(arrayBuffer);
});

describe('Bright Star Catalogue asset', () => {
  it('decodes every stellar entry and preserves the brightest stars', () => {
    expect(catalog).toHaveLength(9_096);
    const sirius = catalog.find((star) => star.hr === 2_491)!;
    expect(sirius.visualMagnitude).toBeCloseTo(-1.46, 2);
    expect(sirius.rightAscensionDegrees).toBeCloseTo(101.287, 2);
    expect(sirius.declinationDegrees).toBeCloseTo(-16.716, 2);
  });

  it('rejects a truncated catalog instead of rendering corrupted positions', () => {
    expect(() => decodeBrightStarCatalog(new ArrayBuffer(10))).toThrow(/truncated/);
  });

  it('matches the pinned provenance hash and lazy library encoding', async () => {
    const binary = await readFile(resolve(process.cwd(), 'src/data/bright-stars.bin'));
    const manifest = JSON.parse(await readFile(
      resolve(process.cwd(), 'src/data/bright-stars.json'),
      'utf8',
    ));
    expect(createHash('sha256').update(binary).digest('hex')).toBe(manifest.binarySha256);
    const { default: base64 } = await import('../src/data/bright-stars-embedded');
    expect(Buffer.from(base64, 'base64').equals(binary)).toBe(true);
  });
});

describe('catalog sky projection', () => {
  it('matches Astronomy Engine horizontal coordinates for Sirius at J2000', () => {
    const date = new Date('2000-01-01T06:00:00Z');
    const sirius = catalog.find((star) => star.hr === 2_491)!;
    const visible = getVisibleStars(date, DEFAULT_LOCATION, [sirius]);
    expect(visible).toHaveLength(1);
    const time = MakeTime(date);
    const eqd = RotateVector(
      Rotation_EQJ_EQD(time),
      VectorFromSphere(new Spherical(
        sirius.declinationDegrees,
        sirius.rightAscensionDegrees,
        1,
      ), time),
    );
    const equatorial = EquatorFromVector(eqd);
    const expected = Horizon(
      date,
      new Observer(DEFAULT_LOCATION.latitude, DEFAULT_LOCATION.longitude, DEFAULT_LOCATION.elevationMeters),
      equatorial.ra,
      equatorial.dec,
      'normal',
    );
    expect(visible[0].azimuthDegrees).toBeCloseTo(expected.azimuth, 3);
    expect(visible[0].altitudeDegrees).toBeCloseTo(expected.altitude, 1);
  });

  it('uses the Kasten–Young optical air-mass response near the horizon', () => {
    expect(relativeOpticalAirMass(90)).toBeCloseTo(1, 3);
    expect(relativeOpticalAirMass(30)).toBeGreaterThan(1.9);
    expect(relativeOpticalAirMass(0)).toBeGreaterThan(37);
    expect(relativeOpticalAirMass(-1)).toBe(Number.POSITIVE_INFINITY);
  });

  it('returns a bounded visible hemisphere after extinction', () => {
    const visible = getVisibleStars(
      new Date('2026-08-24T06:00:00Z'),
      DEFAULT_LOCATION,
      catalog,
    );
    expect(visible.length).toBeGreaterThan(2_000);
    expect(visible.length).toBeLessThan(catalog.length / 2);
    expect(visible.every((star) => star.altitudeDegrees >= 0 && star.apparentMagnitude <= 6.6)).toBe(true);
  });
});
