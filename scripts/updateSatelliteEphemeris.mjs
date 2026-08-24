import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const REFERENCE_ISO = process.env.REFERENCE_ISO ?? '2026-08-23T00:00:00.000Z';
const start = REFERENCE_ISO.slice(0, 16).replace('T', ' ');
const stop = new Date(new Date(REFERENCE_ISO).getTime() + 60_000).toISOString().slice(0, 16).replace('T', ' ');

const targets = [
  ['moon', '301', '399'],
  ['phobos', '401', '499'], ['deimos', '402', '499'],
  ['io', '501', '599'], ['europa', '502', '599'], ['ganymede', '503', '599'], ['callisto', '504', '599'],
  ['mimas', '601', '699'], ['enceladus', '602', '699'], ['tethys', '603', '699'], ['dione', '604', '699'],
  ['rhea', '605', '699'], ['titan', '606', '699'], ['iapetus', '608', '699'],
  ['ariel', '701', '799'], ['umbriel', '702', '799'], ['titania', '703', '799'], ['oberon', '704', '799'],
  ['triton', '801', '899'], ['charon', '901', '999'],
];

async function fetchVector([key, command, center]) {
  const parameters = new URLSearchParams({
    format: 'json',
    COMMAND: `'${command}'`,
    EPHEM_TYPE: `'VECTORS'`,
    CENTER: `'@${center}'`,
    START_TIME: `'${start}'`,
    STOP_TIME: `'${stop}'`,
    STEP_SIZE: `'1m'`,
    OUT_UNITS: `'KM-S'`,
    REF_PLANE: `'FRAME'`,
    VEC_TABLE: `'2'`,
    CSV_FORMAT: `'YES'`,
  });
  const response = await fetch(`https://ssd.jpl.nasa.gov/api/horizons.api?${parameters}`);
  if (!response.ok) throw new Error(`${key}: Horizons returned HTTP ${response.status}`);
  const payload = await response.json();
  const result = String(payload.result ?? '');
  const block = result.match(/\$\$SOE\s*\n([^\n]+)/)?.[1];
  if (!block) throw new Error(`${key}: no vector row in Horizons response`);
  const fields = block.split(',').map((field) => field.trim());
  const values = fields.slice(2, 8).map(Number);
  if (values.some((value) => !Number.isFinite(value))) throw new Error(`${key}: invalid vector values`);
  return {
    key,
    command,
    center,
    positionKm: { x: values[0], y: values[1], z: values[2] },
    velocityKmPerSecond: { x: values[3], y: values[4], z: values[5] },
  };
}

const entries = [];
// Keep request rate conservative and deterministic for JPL's public service.
for (const target of targets) {
  entries.push(await fetchVector(target));
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 120));
}

const output = {
  source: 'NASA/JPL Horizons API v1.2, DE441 and planetary satellite ephemerides',
  generatedAt: new Date().toISOString(),
  referenceDate: REFERENCE_ISO,
  referenceFrame: 'ICRF/J2000 equatorial, parent-body center, geometric state, km and km/s',
  entries,
};

const outputPath = resolve(import.meta.dirname, '../src/data/satellite-reference.json');
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(`Wrote ${entries.length} JPL satellite states to ${outputPath}`);
