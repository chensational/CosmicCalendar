import catalogUrl from '../data/bright-stars.bin?url';
import type { CatalogStar } from './types';

declare const __COSMIC_CALENDAR_LIBRARY__: boolean;

const MAGIC = 'CCSC';
const HEADER_SIZE = 12;
const VERSION = 1;
const RECORD_SIZE = 18;
const MISSING_COLOR_INDEX = -32_768;
let catalogPromise: Promise<readonly CatalogStar[]> | undefined;

export function decodeBrightStarCatalog(buffer: ArrayBuffer): readonly CatalogStar[] {
  if (buffer.byteLength < HEADER_SIZE) throw new Error('Bright Star Catalogue header is truncated.');
  const view = new DataView(buffer);
  const magic = String.fromCharCode(...new Uint8Array(buffer, 0, 4));
  const version = view.getUint16(4, true);
  const count = view.getUint16(6, true);
  const recordSize = view.getUint16(8, true);
  if (magic !== MAGIC || version !== VERSION || recordSize !== RECORD_SIZE) {
    throw new Error(`Unsupported Bright Star Catalogue encoding: ${magic} v${version}/${recordSize}.`);
  }
  if (buffer.byteLength !== HEADER_SIZE + count * recordSize) {
    throw new Error('Bright Star Catalogue length does not match its header.');
  }

  return Array.from({ length: count }, (_, index) => {
    const offset = HEADER_SIZE + index * recordSize;
    const encodedColorIndex = view.getInt16(offset + 12, true);
    return {
      hr: view.getUint16(offset, true),
      rightAscensionDegrees: view.getUint32(offset + 2, true) / 10_000,
      declinationDegrees: view.getInt32(offset + 6, true) / 10_000,
      visualMagnitude: view.getInt16(offset + 10, true) / 100,
      colorIndex: encodedColorIndex === MISSING_COLOR_INDEX ? undefined : encodedColorIndex / 100,
      properMotionRaArcsecondsPerYear: view.getInt16(offset + 14, true) / 1_000,
      properMotionDecArcsecondsPerYear: view.getInt16(offset + 16, true) / 1_000,
    };
  });
}

export function loadBrightStarCatalog(): Promise<readonly CatalogStar[]> {
  catalogPromise ??= (__COSMIC_CALENDAR_LIBRARY__
    ? import('../data/bright-stars-embedded').then(({ default: base64 }) => {
      const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
      return decodeBrightStarCatalog(bytes.buffer);
    })
    : fetch(catalogUrl).then(async (response) => {
      if (!response.ok) throw new Error(`Bright Star Catalogue failed to load: HTTP ${response.status}.`);
      return decodeBrightStarCatalog(await response.arrayBuffer());
    }));
  return catalogPromise;
}
