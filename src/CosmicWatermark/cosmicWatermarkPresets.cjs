const APOLLO_COSMIC_COLORS = Object.freeze({
  navyDark: '#062441',
  navy: '#04243E',
  blue: '#1E4E79',
  teal: '#2A9D8F',
  tealDark: '#1F6F66',
  mist: '#F7F9FC',
  boundary: '#E0E6ED',
  lineMist: '#DCE8F2',
  starMist: '#FBFCFE',
  white: '#FBFCFE',
  whiteSoft: '#FBFCFE',
});

const DEFAULT_WATERMARK_MASK =
  'radial-gradient(ellipse at 84% 18%, #000 0%, rgba(0, 0, 0, 0.7) 38%, transparent 76%)';

const COSMIC_WATERMARK_DEFAULTS = Object.freeze({
  key: 'default',
  seed: 'apollo-clinical-orrery',
  density: 34,
  systemCount: 3,
  maxConnectionsPerStar: 1,
  maxEdgeLength: 1.38,
  spread: Object.freeze({ x: 3.2, y: 1.58, z: 1.62 }),
  spaceScale: 2.2,
  depth: 1.28,
  opacity: 0.28,
  starOpacity: 0.58,
  lineOpacity: 0.24,
  starSize: 0.052,
  starSizeMin: 0.032,
  starSizeMax: 0.108,
  lineGap: 0.03,
  lineInsetRatio: 0.2,
  lineLengthRatio: 0.52,
  systemRadius: 0.5,
  fitMode: 'natural',
  lineColor: APOLLO_COSMIC_COLORS.blue,
  starColor: APOLLO_COSMIC_COLORS.navyDark,
  blendMode: 'multiply',
  cameraOrbitRadius: 8.5,
  cameraOrbitSpeed: 0.024,
  cameraOrbitPolarSpeed: 0.015,
  rotation: Object.freeze({ x: -0.18, y: 0.22, z: -0.05 }),
  rotationSpeed: Object.freeze({ x: 0.008, y: 0.018, z: 0.006 }),
  position: Object.freeze({ x: 0.92, y: 0.18, z: 0 }),
  scale: 1,
  stretch: Object.freeze({ x: 1, y: 1, z: 1 }),
  mask: DEFAULT_WATERMARK_MASK,
});

const COSMIC_WATERMARK_PRESETS = Object.freeze({
  dashboard: Object.freeze({
    key: 'dashboard',
    seed: 'apollo-dashboard-observatory',
    density: 32,
    opacity: 0.27,
    lineColor: APOLLO_COSMIC_COLORS.blue,
    starColor: APOLLO_COSMIC_COLORS.navyDark,
    rotation: Object.freeze({ x: -0.12, y: 0.24, z: -0.08 }),
    rotationSpeed: Object.freeze({ x: 0.007, y: 0.016, z: 0.004 }),
    position: Object.freeze({ x: 0.86, y: 0.16, z: 0 }),
  }),
  medBuilder: Object.freeze({
    key: 'medBuilder',
    seed: 'apollo-med-builder-catalog',
    density: 38,
    opacity: 0.29,
    lineColor: APOLLO_COSMIC_COLORS.navy,
    starColor: APOLLO_COSMIC_COLORS.blue,
    rotation: Object.freeze({ x: -0.24, y: 0.32, z: 0.06 }),
    rotationSpeed: Object.freeze({ x: 0.006, y: 0.014, z: 0.004 }),
    position: Object.freeze({ x: 0.98, y: 0.08, z: 0 }),
  }),
  formularyManager: Object.freeze({
    key: 'formularyManager',
    seed: 'apollo-formulary-orbit',
    density: 36,
    opacity: 0.3,
    starOpacity: 0.62,
    lineOpacity: 0.26,
    lineColor: APOLLO_COSMIC_COLORS.tealDark,
    starColor: APOLLO_COSMIC_COLORS.navyDark,
    rotation: Object.freeze({ x: -0.16, y: 0.18, z: 0.14 }),
    rotationSpeed: Object.freeze({ x: 0.006, y: 0.015, z: 0.005 }),
    position: Object.freeze({ x: 0.9, y: 0.2, z: 0 }),
  }),
  medConceptHelper: Object.freeze({
    key: 'medConceptHelper',
    seed: 'apollo-rxnorm-index',
    density: 30,
    opacity: 0.27,
    lineColor: APOLLO_COSMIC_COLORS.blue,
    starColor: APOLLO_COSMIC_COLORS.tealDark,
    rotation: Object.freeze({ x: -0.1, y: 0.28, z: -0.12 }),
    rotationSpeed: Object.freeze({ x: 0.005, y: 0.013, z: 0.006 }),
    position: Object.freeze({ x: 0.82, y: 0.18, z: 0 }),
  }),
  settings: Object.freeze({
    key: 'settings',
    seed: 'apollo-settings-archive',
    density: 28,
    opacity: 0.26,
    lineColor: APOLLO_COSMIC_COLORS.navy,
    starColor: APOLLO_COSMIC_COLORS.tealDark,
    rotation: Object.freeze({ x: -0.2, y: 0.16, z: -0.02 }),
    rotationSpeed: Object.freeze({ x: 0.005, y: 0.012, z: 0.004 }),
    position: Object.freeze({ x: 0.88, y: 0.24, z: 0 }),
  }),
});

function coerceFiniteNumber(value, fallback){
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function mergeVector(base, override){
  if (typeof override === 'number') {
    return {
      x: base.x,
      y: override,
      z: base.z,
    };
  }

  if (!override || typeof override !== 'object') return { ...base };

  return {
    x: coerceFiniteNumber(override.x, base.x),
    y: coerceFiniteNumber(override.y, base.y),
    z: coerceFiniteNumber(override.z, base.z),
  };
}

function omitUndefinedValues(source = {}){
  return Object.entries(source).reduce((acc, [key, value]) => {
    if (value !== undefined) acc[key] = value;
    return acc;
  }, {});
}

function buildFallbackWatermarkSeed(presetKey){
  const cleanPresetKey = String(presetKey || '').trim();
  if (!cleanPresetKey || cleanPresetKey === COSMIC_WATERMARK_DEFAULTS.key) {
    return COSMIC_WATERMARK_DEFAULTS.seed;
  }

  return `apollo-${cleanPresetKey}-constellation`;
}

function resolveWatermarkSeed({ cleanOverrides, namedPreset, presetKey }){
  const overrideSeed = String(cleanOverrides.seed || '').trim();
  if (overrideSeed) return overrideSeed;

  const namedSeed = String(namedPreset.seed || '').trim();
  if (namedSeed) return namedSeed;

  return buildFallbackWatermarkSeed(presetKey);
}

function buildWatermarkSignature(preset){
  return [
    preset.key,
    preset.seed,
    preset.density,
    preset.systemCount,
    preset.systemRadius,
    preset.maxConnectionsPerStar,
    preset.maxEdgeLength,
    preset.spread.x,
    preset.spread.y,
    preset.spread.z,
    preset.spaceScale,
    preset.depth,
    preset.opacity,
    preset.starOpacity,
    preset.lineOpacity,
    preset.starSize,
    preset.starSizeMin,
    preset.starSizeMax,
    preset.lineGap,
    preset.lineInsetRatio,
    preset.lineLengthRatio,
    preset.systemRadius,
    preset.lineColor,
    preset.starColor,
    preset.blendMode,
    preset.fitMode,
    preset.cameraOrbitRadius,
    preset.cameraOrbitSpeed,
    preset.cameraOrbitPolarSpeed,
    preset.rotation.x,
    preset.rotation.y,
    preset.rotation.z,
    preset.rotationSpeed.x,
    preset.rotationSpeed.y,
    preset.rotationSpeed.z,
    preset.position.x,
    preset.position.y,
    preset.position.z,
    preset.scale,
    preset.stretch.x,
    preset.stretch.y,
    preset.stretch.z,
  ].join('|');
}

function resolveCosmicWatermarkPreset(constellation, overrides = {}){
  const presetKey = typeof constellation === 'string' && constellation.trim()
    ? constellation.trim()
    : COSMIC_WATERMARK_DEFAULTS.key;
  const namedPreset = COSMIC_WATERMARK_PRESETS[presetKey] || {};
  const cleanOverrides = omitUndefinedValues(overrides);
  const resolvedKey = namedPreset.key || presetKey || COSMIC_WATERMARK_DEFAULTS.key;
  const merged = {
    ...COSMIC_WATERMARK_DEFAULTS,
    ...namedPreset,
    ...cleanOverrides,
    key: resolvedKey,
    seed: resolveWatermarkSeed({ cleanOverrides, namedPreset, presetKey: resolvedKey }),
    spread: {
      ...COSMIC_WATERMARK_DEFAULTS.spread,
      ...(namedPreset.spread || {}),
      ...(cleanOverrides.spread || {}),
    },
    stretch: mergeVector(
      { ...COSMIC_WATERMARK_DEFAULTS.stretch, ...(namedPreset.stretch || {}) },
      cleanOverrides.stretch
    ),
    rotation: mergeVector(
      { ...COSMIC_WATERMARK_DEFAULTS.rotation, ...(namedPreset.rotation || {}) },
      cleanOverrides.rotation
    ),
    rotationSpeed: mergeVector(
      { ...COSMIC_WATERMARK_DEFAULTS.rotationSpeed, ...(namedPreset.rotationSpeed || {}) },
      cleanOverrides.rotationSpeed
    ),
    position: mergeVector(
      { ...COSMIC_WATERMARK_DEFAULTS.position, ...(namedPreset.position || {}) },
      cleanOverrides.position
    ),
  };

  merged.density = Math.round(Math.max(16, Math.min(140, coerceFiniteNumber(merged.density, COSMIC_WATERMARK_DEFAULTS.density))));
  merged.systemCount = Math.round(Math.max(1, Math.min(4, coerceFiniteNumber(merged.systemCount, COSMIC_WATERMARK_DEFAULTS.systemCount))));
  merged.maxConnectionsPerStar = Math.round(Math.max(1, Math.min(3, coerceFiniteNumber(merged.maxConnectionsPerStar, COSMIC_WATERMARK_DEFAULTS.maxConnectionsPerStar))));
  merged.maxEdgeLength = Math.max(0.5, Math.min(4, coerceFiniteNumber(merged.maxEdgeLength, COSMIC_WATERMARK_DEFAULTS.maxEdgeLength)));
  merged.spaceScale = Math.max(0.5, Math.min(4, coerceFiniteNumber(merged.spaceScale, COSMIC_WATERMARK_DEFAULTS.spaceScale)));
  merged.opacity = Math.max(0, Math.min(1, coerceFiniteNumber(merged.opacity, COSMIC_WATERMARK_DEFAULTS.opacity)));
  merged.starOpacity = Math.max(0, Math.min(1, coerceFiniteNumber(merged.starOpacity, COSMIC_WATERMARK_DEFAULTS.starOpacity)));
  merged.lineOpacity = Math.max(0, Math.min(1, coerceFiniteNumber(merged.lineOpacity, COSMIC_WATERMARK_DEFAULTS.lineOpacity)));
  merged.starSize = Math.max(0.006, Math.min(0.18, coerceFiniteNumber(merged.starSize, COSMIC_WATERMARK_DEFAULTS.starSize)));
  merged.starSizeMin = Math.max(0.006, Math.min(0.18, coerceFiniteNumber(merged.starSizeMin, merged.starSize * 0.66)));
  merged.starSizeMax = Math.max(
    merged.starSizeMin,
    Math.min(0.24, coerceFiniteNumber(merged.starSizeMax, merged.starSize * 1.58))
  );
  merged.lineGap = Math.max(0, Math.min(0.14, coerceFiniteNumber(merged.lineGap, COSMIC_WATERMARK_DEFAULTS.lineGap)));
  merged.lineInsetRatio = Math.max(
    0,
    Math.min(0.42, coerceFiniteNumber(merged.lineInsetRatio, COSMIC_WATERMARK_DEFAULTS.lineInsetRatio))
  );
  merged.lineLengthRatio = Math.max(
    0.18,
    Math.min(0.82, coerceFiniteNumber(merged.lineLengthRatio, COSMIC_WATERMARK_DEFAULTS.lineLengthRatio))
  );
  merged.systemRadius = Math.max(
    0,
    Math.min(0.85, coerceFiniteNumber(merged.systemRadius, COSMIC_WATERMARK_DEFAULTS.systemRadius))
  );
  merged.depth = Math.max(0.2, Math.min(4, coerceFiniteNumber(merged.depth, COSMIC_WATERMARK_DEFAULTS.depth)));
  merged.cameraOrbitRadius = Math.max(3, Math.min(18, coerceFiniteNumber(merged.cameraOrbitRadius, COSMIC_WATERMARK_DEFAULTS.cameraOrbitRadius)));
  merged.cameraOrbitSpeed = Math.max(0, Math.min(0.18, coerceFiniteNumber(merged.cameraOrbitSpeed, COSMIC_WATERMARK_DEFAULTS.cameraOrbitSpeed)));
  merged.cameraOrbitPolarSpeed = Math.max(0, Math.min(0.18, coerceFiniteNumber(merged.cameraOrbitPolarSpeed, COSMIC_WATERMARK_DEFAULTS.cameraOrbitPolarSpeed)));
  merged.scale = Math.max(0.5, Math.min(8, coerceFiniteNumber(merged.scale, COSMIC_WATERMARK_DEFAULTS.scale)));
  merged.stretch = {
    x: Math.max(0.1, Math.min(32, coerceFiniteNumber(merged.stretch.x, COSMIC_WATERMARK_DEFAULTS.stretch.x))),
    y: Math.max(0.1, Math.min(8, coerceFiniteNumber(merged.stretch.y, COSMIC_WATERMARK_DEFAULTS.stretch.y))),
    z: Math.max(0.1, Math.min(8, coerceFiniteNumber(merged.stretch.z, COSMIC_WATERMARK_DEFAULTS.stretch.z))),
  };
  merged.fitMode = merged.fitMode === 'stretch' ? 'stretch' : 'natural';
  merged.blendMode = merged.blendMode || COSMIC_WATERMARK_DEFAULTS.blendMode;
  merged.mask = merged.mask || DEFAULT_WATERMARK_MASK;
  merged.signature = buildWatermarkSignature(merged);

  return Object.freeze(merged);
}

module.exports = {
  APOLLO_COSMIC_COLORS,
  COSMIC_WATERMARK_DEFAULTS,
  COSMIC_WATERMARK_PRESETS,
  DEFAULT_WATERMARK_MASK,
  resolveCosmicWatermarkPreset,
};
