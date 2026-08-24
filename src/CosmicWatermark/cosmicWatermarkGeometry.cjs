function hashSeed(value){
  const text = String(value || 'apollo');
  let hash = 2166136261;

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function createSeededRandom(seed){
  let state = hashSeed(seed) || 1;

  return () => {
    state += 0x6D2B79F5;
    let next = state;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function distanceBetweenPoints(a, b){
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function clampNumber(value, fallback, min, max){
  const next = Number(value);
  if (!Number.isFinite(next)) return fallback;
  return Math.max(min, Math.min(max, next));
}

function resolveStarSizeRange(preset){
  const baseSize = clampNumber(preset?.starSize, 0.058, 0.006, 0.18);
  const min = clampNumber(preset?.starSizeMin, baseSize * 0.66, 0.006, 0.18);
  const max = Math.max(
    min,
    clampNumber(preset?.starSizeMax, baseSize * 1.58, 0.006, 0.24)
  );

  return { min, max };
}

function addEdge(edgeSet, linePositions, lineEdges, a, b, lineGap, lineInsetRatio, lineLengthRatio){
  const low = Math.min(a.index, b.index);
  const high = Math.max(a.index, b.index);
  const edgeKey = `${low}:${high}`;

  if (edgeSet.has(edgeKey)) return false;

  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = b.z - a.z;
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (!Number.isFinite(distance) || distance <= 0) return false;

  const unit = {
    x: dx / distance,
    y: dy / distance,
    z: dz / distance,
  };
  const starSafeInset = Math.max(
    0,
    (Number(a.size) || 0) * 0.58 + lineGap,
    (Number(b.size) || 0) * 0.58 + lineGap
  );
  const inset = Math.min(
    distance * 0.46,
    Math.max(starSafeInset, distance * lineInsetRatio)
  );
  let start = {
    x: a.x + unit.x * inset,
    y: a.y + unit.y * inset,
    z: a.z + unit.z * inset,
  };
  let end = {
    x: b.x - unit.x * inset,
    y: b.y - unit.y * inset,
    z: b.z - unit.z * inset,
  };
  const availableLength = Math.max(0, distance - inset * 2);
  const cappedLength = Math.min(availableLength, distance * lineLengthRatio);

  if (cappedLength < availableLength) {
    const midpoint = {
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
      z: (a.z + b.z) / 2,
    };
    const halfLength = cappedLength / 2;

    start = {
      x: midpoint.x - unit.x * halfLength,
      y: midpoint.y - unit.y * halfLength,
      z: midpoint.z - unit.z * halfLength,
    };
    end = {
      x: midpoint.x + unit.x * halfLength,
      y: midpoint.y + unit.y * halfLength,
      z: midpoint.z + unit.z * halfLength,
    };
  }

  edgeSet.add(edgeKey);
  linePositions.push(start.x, start.y, start.z, end.x, end.y, end.z);
  lineEdges.push(Object.freeze({
    startIndex: a.index,
    endIndex: b.index,
    systemIndex: a.systemIndex,
    start: Object.freeze(start),
    end: Object.freeze(end),
  }));
  return true;
}

function buildConstellationGeometryData(preset){
  const density = Math.round(Math.max(16, Math.min(140, Number(preset?.density) || 58)));
  const systemCount = Math.round(Math.max(1, Math.min(4, Number(preset?.systemCount) || 3)));
  const random = createSeededRandom(preset?.seed || preset?.key || 'apollo');
  const spaceScale = clampNumber(preset?.spaceScale, 2.2, 0.5, 4);
  const spread = {
    x: (Number(preset?.spread?.x) || 2.8) * spaceScale,
    y: (Number(preset?.spread?.y) || 1.55) * spaceScale,
    z: (Number(preset?.spread?.z) || 1.45) * spaceScale,
  };
  const depth = Number(preset?.depth) || 1.2;
  const maxEdgeLength =
    Math.max(0.5, Math.min(4, Number(preset?.maxEdgeLength) || 1.38)) * Math.max(1, Math.sqrt(spaceScale));
  const maxConnectionsPerStar = Math.max(1, Math.min(3, Math.round(Number(preset?.maxConnectionsPerStar) || 2)));
  const lineGap = clampNumber(preset?.lineGap, 0.03, 0, 0.14);
  const lineInsetRatio = clampNumber(preset?.lineInsetRatio, 0.2, 0, 0.42);
  const lineLengthRatio = clampNumber(preset?.lineLengthRatio, 0.52, 0.18, 0.82);
  const systemRadius = clampNumber(preset?.systemRadius, 0.5, 0, 0.85);
  const starSizeRange = resolveStarSizeRange(preset);
  const points = [];
  const starPositions = [];
  const starSizes = [];
  const stars = [];

  for (let systemIndex = 0; systemIndex < systemCount; systemIndex += 1) {
    const systemAngle = (Math.PI * 2 * systemIndex) / systemCount + (random() - 0.5) * 0.7;
    const centerRadius = systemCount === 1 ? 0 : systemRadius * (0.82 + random() * 0.36);
    const center = {
      x: Math.cos(systemAngle) * spread.x * centerRadius,
      y: Math.sin(systemAngle) * spread.y * centerRadius * 0.74 + (random() - 0.5) * spread.y * 0.2,
      z: (random() - 0.5) * spread.z * depth * 0.72,
    };
    const localSpread = {
      x: spread.x * (systemCount === 1 ? 1 : 0.34 + random() * 0.1),
      y: spread.y * (systemCount === 1 ? 1 : 0.42 + random() * 0.12),
      z: spread.z * (systemCount === 1 ? 1 : 0.5 + random() * 0.16),
    };

    for (let index = 0; index < density; index += 1) {
      const theta = random() * Math.PI * 2;
      const radius = Math.pow(random(), 0.58);
      const verticalBias = (random() - 0.5) * 0.34 * spaceScale;
      const size = starSizeRange.min +
        Math.pow(random(), random() > 0.9 ? 0.72 : 1.55) * (starSizeRange.max - starSizeRange.min);
      const tone = size > starSizeRange.min + (starSizeRange.max - starSizeRange.min) * 0.72
        ? 2
        : size > starSizeRange.min + (starSizeRange.max - starSizeRange.min) * 0.38
          ? 1
          : 0;
      const point = {
        index: points.length,
        systemIndex,
        tone,
        x: center.x + Math.cos(theta) * radius * localSpread.x + (random() - 0.5) * 0.18 * spaceScale,
        y: center.y + Math.sin(theta) * radius * localSpread.y + verticalBias,
        z: center.z + (random() - 0.5) * localSpread.z * depth,
        size,
      };

      points.push(point);
      starPositions.push(point.x, point.y, point.z);
      starSizes.push(point.size);
      stars.push(Object.freeze({
        x: point.x,
        y: point.y,
        z: point.z,
        size: point.size,
        tone,
        systemIndex,
      }));
    }
  }

  const edgeSet = new Set();
  const linePositions = [];
  const lineEdges = [];

  points.forEach((point, pointIndex) => {
    const nearest = [];

    points.forEach((candidate, candidateIndex) => {
      if (pointIndex === candidateIndex) return;
      if (point.systemIndex !== candidate.systemIndex) return;

      const distance = distanceBetweenPoints(point, candidate);
      if (distance <= maxEdgeLength) {
        nearest.push({ point: candidate, distance });
      }
    });

    nearest
      .sort((a, b) => a.distance - b.distance)
      .slice(0, maxConnectionsPerStar)
      .forEach(({ point: candidate }) => {
        addEdge(edgeSet, linePositions, lineEdges, point, candidate, lineGap, lineInsetRatio, lineLengthRatio);
      });
  });

  return Object.freeze({
    pointCount: points.length,
    lineCount: linePositions.length / 6,
    lineLengthRatio,
    spaceScale,
    systemCount,
    systemRadius,
    stars: Object.freeze(stars),
    starPositions: Object.freeze(starPositions),
    starSizes: Object.freeze(starSizes),
    lineEdges: Object.freeze(lineEdges),
    linePositions: Object.freeze(linePositions),
  });
}

module.exports = {
  buildConstellationGeometryData,
  createSeededRandom,
  hashSeed,
};
