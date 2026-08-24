import {
  AU_KM,
  GALACTIC_CENTER_DISTANCE_KPC,
  SUN_GALACTIC_ORBIT_PERIOD_MILLION_YEARS,
  SUN_HEIGHT_ABOVE_GALACTIC_PLANE_PC,
  SUN_VERTICAL_OSCILLATION_PERIOD_MILLION_YEARS,
} from '../core/constants';
import {
  GALACTIC_BAR_ANGLE_DEGREES,
  GALACTIC_BAR_HALF_LENGTH_KPC,
  GALACTIC_DISPLAY_RADIUS_KPC,
  GALACTIC_MAJOR_ARM_GUIDES,
  GALACTIC_MEAN_ARM_PITCH_DEGREES,
  GALAXY_PARTICLE_FIELD,
  GALACTIC_SPIRAL_SEGMENTS,
  SOLAR_GALACTIC_TRAIL,
  SUN_GALACTIC_EPICYCLE_PERIOD_MILLION_YEARS,
  SUN_GALACTIC_ORBIT_PREDICTABILITY_MILLION_YEARS,
  galacticArmWidthKpc,
  majorArmPointAtRadius,
  sampleSpiralSegment,
  solarGalacticPositionAtProgress,
  type GalacticPoint,
} from '../core/galaxyModel';
import { clamp, dot, greatCircleBearingRadians, hashUnit, normalize, normalizeDegrees, smoothstep } from '../core/math';
import {
  lunarReflectance,
  lunarSurfaceGeometry,
  sampleLunarAlbedo,
  visibleLunarNormalToBody,
} from '../core/lunarSurface';
import { orbitalPositionAtTrueAnomaly } from '../core/orbits';
import {
  lambertianLight,
  rotateEquatorialBasis,
  sphereCoordinates,
  toSolarView,
} from '../core/planetSurface';
import {
  proceduralSunspotGroups,
  solarGranulation,
  solarLimbDarkening,
  topocentricSolarSurfaceFrame,
  type SolarSurfaceFrame,
} from '../core/solarSurface';
import type { SolarObservation } from '../hooks/useSolarObservation';
import type {
  CartesianPosition,
  HorizontalPosition,
  HorizonSnapshot,
  LunarHorizonSnapshot,
  SolarSystemSnapshot,
  VisibleStar,
} from '../core/types';

export interface CanvasFrame {
  context: CanvasRenderingContext2D;
  width: number;
  height: number;
  scalePosition: number;
  elapsedSeconds: number;
  realtimeOffsetSeconds: number;
  renderQuality: number;
  pixelRatio: number;
  horizon: HorizonSnapshot;
  lunar: LunarHorizonSnapshot;
  solar: SolarSystemSnapshot;
  solarObservation?: SolarObservation;
  stars: readonly VisibleStar[];
  cosmicAgeYears: number;
  reducedMotion: boolean;
}

const TAU = Math.PI * 2;
type SurfaceCanvas = HTMLCanvasElement | OffscreenCanvas;
const STAR_FIELD = Array.from({ length: 170 }, (_, index) => ({
  index,
  x: hashUnit(`star-x-${index}`),
  y: hashUnit(`star-y-${index}`),
  radius: 0.35 + hashUnit(`star-r-${index}`) * 1.25,
  luminosity: 0.28 + hashUnit(`star-l-${index}`) * 0.54,
  phase: hashUnit(`star-phase-${index}`) * TAU,
  scintillationRate: 0.8 + hashUnit(`star-p-${index}`) * 2.2,
}));
const starPathCache = new Map<string, readonly Path2D[]>();
const solarTextureCache = new Map<string, SurfaceCanvas>();

function starPaths(width: number, height: number) {
  const cacheKey = `${Math.round(width)}:${Math.round(height)}`;
  const cached = starPathCache.get(cacheKey);
  if (cached) return cached;
  const paths = Array.from({ length: 4 }, () => new Path2D());
  for (const star of STAR_FIELD) {
    const bucket = clamp(Math.floor((star.luminosity - 0.28) / 0.54 * 4), 0, 3);
    paths[bucket].moveTo(star.x * width + star.radius, star.y * height);
    paths[bucket].arc(star.x * width, star.y * height, star.radius, 0, TAU);
  }
  starPathCache.set(cacheKey, paths);
  if (starPathCache.size > 6) {
    const oldest = starPathCache.keys().next().value;
    if (oldest) starPathCache.delete(oldest);
  }
  return paths;
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}

function drawStars(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  elapsed: number,
  scintillation = 0,
) {
  context.save();
  starPaths(width, height).forEach((path, bucket) => {
    context.fillStyle = `rgba(229, 237, 255, ${0.34 + bucket * 0.14})`;
    context.fill(path);
  });
  if (scintillation) {
    for (const star of STAR_FIELD) {
      if (star.index % 7) continue;
      const pulse = scintillation * Math.sin(elapsed * star.scintillationRate + star.phase);
      if (pulse <= 0) continue;
      context.fillStyle = `rgba(245, 249, 255, ${pulse})`;
      context.beginPath();
      context.arc(star.x * width, star.y * height, star.radius * 1.08, 0, TAU);
      context.fill();
    }
  }
  context.restore();
}

function drawGlow(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  alpha = 1,
) {
  const gradient = context.createRadialGradient(x, y, radius * 0.1, x, y, radius * 3.5);
  gradient.addColorStop(0, color);
  gradient.addColorStop(0.28, color);
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  context.save();
  context.globalAlpha = alpha;
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(x, y, radius * 3.5, 0, TAU);
  context.fill();
  context.restore();
}

function solarTextureKey(
  radius: number,
  date: Date,
  frame: SolarSurfaceFrame,
  redGiantProgress: number,
): string {
  const quantizeVector = (vector: CartesianPosition) =>
    [vector.x, vector.y, vector.z].map((value) => Math.round(value * 48)).join(',');
  return [
    Math.round(radius * 4),
    Math.floor(date.getTime() / (8 * 60 * 1_000)),
    quantizeVector(frame.pole),
    quantizeVector(frame.meridian),
    Math.round(redGiantProgress * 12),
  ].join(':');
}

function renderProceduralSolarTexture(
  radius: number,
  date: Date,
  frame: SolarSurfaceFrame,
  redGiantProgress: number,
): SurfaceCanvas {
  const cacheKey = solarTextureKey(radius, date, frame, redGiantProgress);
  const cached = solarTextureCache.get(cacheKey);
  if (cached) return cached;
  const size = Math.max(28, Math.ceil(radius * 4));
  const surface: SurfaceCanvas = typeof OffscreenCanvas !== 'undefined'
    ? new OffscreenCanvas(size, size)
    : Object.assign(document.createElement('canvas'), { width: size, height: size });
  const surfaceContext = surface.getContext('2d');
  if (!surfaceContext) return surface;
  const image = surfaceContext.createImageData(size, size);
  const half = size / 2;
  const spots = proceduralSunspotGroups(date);
  const centerColor = blendColor([255, 224, 132], [255, 143, 84], redGiantProgress);
  const limbColor = blendColor([232, 103, 25], [181, 50, 31], redGiantProgress);

  for (let pixelY = 0; pixelY < size; pixelY += 1) {
    const normalY = (pixelY + 0.5 - half) / half;
    for (let pixelX = 0; pixelX < size; pixelX += 1) {
      const normalX = (pixelX + 0.5 - half) / half;
      const radiusSquared = normalX ** 2 + normalY ** 2;
      if (radiusSquared >= 1) continue;
      const mu = Math.sqrt(1 - radiusSquared);
      const normal = { x: normalX, y: normalY, z: mu };
      const { latitudeRadians, longitudeRadians } = sphereCoordinates(
        normal,
        frame.pole,
        frame.meridian,
        frame.east,
      );
      let spotShadow = 0;
      for (const spot of spots) {
        const cosineSeparation =
          Math.sin(latitudeRadians) * Math.sin(spot.latitudeRadians) +
          Math.cos(latitudeRadians) * Math.cos(spot.latitudeRadians) *
          Math.cos(longitudeRadians - spot.longitudeRadians);
        const separation = Math.acos(clamp(cosineSeparation, -1, 1));
        const normalizedSeparation = separation / spot.angularRadiusRadians;
        spotShadow = Math.max(
          spotShadow,
          Math.exp(-0.5 * normalizedSeparation ** 4) * spot.strength,
        );
      }
      const limb = solarLimbDarkening(mu);
      const granulation = solarGranulation(latitudeRadians, longitudeRadians, date);
      const brightness = limb * granulation * (1 - spotShadow * 0.76);
      const color = blendColor(limbColor, centerColor, Math.sqrt(mu));
      const index = (pixelY * size + pixelX) * 4;
      image.data[index] = Math.round(clamp(color[0] * brightness, 0, 255));
      image.data[index + 1] = Math.round(clamp(color[1] * brightness, 0, 255));
      image.data[index + 2] = Math.round(clamp(color[2] * brightness, 0, 255));
      image.data[index + 3] = Math.round(clamp((1 - radiusSquared) * size * 0.5, 0, 1) * 255);
    }
  }
  surfaceContext.putImageData(image, 0, 0);
  solarTextureCache.set(cacheKey, surface);
  if (solarTextureCache.size > 24) {
    const oldest = solarTextureCache.keys().next().value;
    if (oldest) solarTextureCache.delete(oldest);
  }
  return surface;
}

function drawSolarPhotosphere(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  date: Date,
  frame: SolarSurfaceFrame,
  northPoleBearingRadians: number,
  observation: SolarObservation | undefined,
  redGiantProgress = 0,
  atmosphericReddening = 0,
) {
  if (observation && redGiantProgress === 0) {
    // The checked-in quicklook is already cropped to the observed solar disc.
    context.save();
    context.translate(x, y);
    context.rotate(northPoleBearingRadians);
    context.beginPath();
    context.arc(0, 0, radius, 0, TAU);
    context.clip();
    context.drawImage(observation.image, -radius, -radius, radius * 2, radius * 2);
    if (atmosphericReddening > 0) {
      context.fillStyle = `rgba(226, 55, 24, ${atmosphericReddening * 0.34})`;
      context.fillRect(-radius, -radius, radius * 2, radius * 2);
    }
    context.restore();
  } else {
    const texture = renderProceduralSolarTexture(radius, date, frame, redGiantProgress);
    context.drawImage(texture, x - radius, y - radius, radius * 2, radius * 2);
  }
  context.strokeStyle = redGiantProgress > 0
    ? 'rgba(255, 117, 73, .58)'
    : 'rgba(255, 213, 107, .6)';
  context.lineWidth = Math.max(0.65, radius * 0.045);
  context.beginPath();
  context.arc(x, y, radius, 0, TAU);
  context.stroke();
}

function drawPhaseDisc(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  phaseAngleDegrees: number,
  rotation = 0,
) {
  const phase = normalizeDegrees(phaseAngleDegrees) / 360;
  const waxing = phase <= 0.5;
  const terminator = Math.cos(phase * TAU) * (waxing ? 1 : -1);
  context.save();
  context.translate(x, y);
  context.rotate(rotation);
  context.beginPath();
  context.arc(0, 0, radius, 0, TAU);
  context.clip();

  const darkFace = context.createRadialGradient(-radius * 0.2, -radius * 0.22, 0, 0, 0, radius);
  darkFace.addColorStop(0, '#263044');
  darkFace.addColorStop(1, '#050812');
  context.fillStyle = darkFace;
  context.fillRect(-radius, -radius, radius * 2, radius * 2);

  context.beginPath();
  const segments = 28;
  for (let step = 0; step <= segments; step += 1) {
    const angle = -Math.PI / 2 + step / segments * Math.PI;
    const limbX = (waxing ? 1 : -1) * Math.cos(angle) * radius;
    const limbY = Math.sin(angle) * radius;
    if (step === 0) context.moveTo(limbX, limbY); else context.lineTo(limbX, limbY);
  }
  for (let step = segments; step >= 0; step -= 1) {
    const angle = -Math.PI / 2 + step / segments * Math.PI;
    context.lineTo(terminator * Math.cos(angle) * radius, Math.sin(angle) * radius);
  }
  context.closePath();
  const lightFace = context.createRadialGradient(
    (waxing ? 0.28 : -0.28) * radius,
    -radius * 0.28,
    radius * 0.05,
    0,
    0,
    radius,
  );
  lightFace.addColorStop(0, '#fff');
  lightFace.addColorStop(0.34, color);
  lightFace.addColorStop(1, '#758096');
  context.fillStyle = lightFace;
  context.fill();

  const limbShade = context.createRadialGradient(0, 0, radius * 0.58, 0, 0, radius);
  limbShade.addColorStop(0, 'rgba(0,0,0,0)');
  limbShade.addColorStop(1, 'rgba(0,0,0,.34)');
  context.fillStyle = limbShade;
  context.fillRect(-radius, -radius, radius * 2, radius * 2);
  context.restore();
  context.save();
  context.strokeStyle = 'rgba(255,255,255,.28)';
  context.lineWidth = 1;
  context.beginPath();
  context.arc(x, y, radius, 0, TAU);
  context.stroke();
  context.restore();
}

const moonTextureCache = new Map<string, SurfaceCanvas>();

function moonTextureKey(
  radius: number,
  moon: HorizonSnapshot['moon'],
  sunBearingRadians: number,
) {
  const quantize = (value: number, step: number) => Math.round(value / step) * step;
  return [
    Math.ceil(radius * 4),
    quantize(moon.subObserverLatitudeDegrees, 0.25),
    quantize(moon.subObserverLongitudeDegrees, 0.25),
    quantize(moon.northPoleBearingRadians, Math.PI / 360),
    quantize(sunBearingRadians, Math.PI / 360),
    quantize(moon.solarPhaseAngleDegrees, 0.5),
  ].join(':');
}

function renderMoonTexture(
  radius: number,
  moon: HorizonSnapshot['moon'],
  sunBearingRadians: number,
): SurfaceCanvas {
  const cacheKey = moonTextureKey(radius, moon, sunBearingRadians);
  const cached = moonTextureCache.get(cacheKey);
  if (cached) return cached;
  const size = Math.max(24, Math.ceil(radius * 4));
  const surface: SurfaceCanvas = typeof OffscreenCanvas !== 'undefined'
    ? new OffscreenCanvas(size, size)
    : Object.assign(document.createElement('canvas'), { width: size, height: size });
  const surfaceContext = surface.getContext('2d');
  if (!surfaceContext) return surface;
  const image = surfaceContext.createImageData(size, size);
  const half = size / 2;
  const geometry = lunarSurfaceGeometry(
    moon.subObserverLatitudeDegrees,
    moon.subObserverLongitudeDegrees,
    moon.northPoleBearingRadians,
    sunBearingRadians,
    moon.solarPhaseAngleDegrees,
  );
  const earthshine = 0.014 + (1 - moon.illuminatedFraction) * 0.026;

  for (let pixelY = 0; pixelY < size; pixelY += 1) {
    const normalY = (half - pixelY - 0.5) / half;
    for (let pixelX = 0; pixelX < size; pixelX += 1) {
      const normalX = (pixelX + 0.5 - half) / half;
      const radiusSquared = normalX ** 2 + normalY ** 2;
      if (radiusSquared >= 1) continue;
      const normalInView = { x: normalX, y: normalY, z: Math.sqrt(1 - radiusSquared) };
      const normalInBody = visibleLunarNormalToBody(normalInView, geometry);
      const latitude = Math.asin(clamp(normalInBody.z, -1, 1));
      const longitude = Math.atan2(normalInBody.y, normalInBody.x);
      const albedo = sampleLunarAlbedo(longitude, latitude);
      const reflectance = lunarReflectance(normalInView, geometry.lightInView, earthshine);
      const index = (pixelY * size + pixelX) * 4;
      const channelResponse = [1.025, 1, 0.955] as const;
      for (let channel = 0; channel < 3; channel += 1) {
        const albedoSrgb = clamp(albedo * channelResponse[channel], 0, 1);
        image.data[index + channel] = Math.round(
          clamp((albedoSrgb ** 2.2 * reflectance) ** (1 / 2.2) * 255, 0, 255),
        );
      }
      image.data[index + 3] = Math.round(clamp((1 - radiusSquared) * size * 0.55, 0, 1) * 255);
    }
  }
  surfaceContext.putImageData(image, 0, 0);
  moonTextureCache.set(cacheKey, surface);
  if (moonTextureCache.size > 64) {
    const oldest = moonTextureCache.keys().next().value;
    if (oldest) moonTextureCache.delete(oldest);
  }
  return surface;
}

function drawMoonSphere(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  moon: HorizonSnapshot['moon'],
  sunBearingRadians: number,
) {
  const texture = renderMoonTexture(radius, moon, sunBearingRadians);
  context.drawImage(texture, x - radius, y - radius, radius * 2, radius * 2);
  context.strokeStyle = 'rgba(225, 231, 236, .32)';
  context.lineWidth = 0.7;
  context.beginPath();
  context.arc(x, y, radius, 0, TAU);
  context.stroke();
}

function apparentPosition(position: HorizontalPosition, elapsedSeconds: number): HorizontalPosition {
  const motion = position.apparentMotion;
  if (!motion || !elapsedSeconds) return position;
  return {
    ...position,
    altitudeDegrees: position.altitudeDegrees + motion.altitudeDegreesPerSecond * elapsedSeconds,
    azimuthDegrees: normalizeDegrees(
      position.azimuthDegrees + motion.azimuthDegreesPerSecond * elapsedSeconds,
    ),
  };
}

function skyPoint(width: number, height: number, position: HorizontalPosition) {
  const horizonY = height * 0.72;
  return {
    x: (position.azimuthDegrees / 360) * width,
    y: horizonY - position.altitudeDegrees / 90 * height * 0.62,
  };
}

const CATALOG_STAR_COLORS = [
  '164, 194, 255',
  '202, 219, 255',
  '244, 244, 234',
  '255, 224, 172',
  '255, 181, 118',
] as const;

interface CatalogStarPaths {
  paths: readonly Path2D[];
  halos: readonly Path2D[];
  twinkles: readonly {
    x: number;
    y: number;
    radius: number;
    phase: number;
    relativeAirMass: number;
  }[];
}

const catalogStarPathCache = new WeakMap<readonly VisibleStar[], Map<string, CatalogStarPaths>>();

function catalogColorBucket(colorIndex: number): number {
  if (colorIndex < -0.1) return 0;
  if (colorIndex < 0.35) return 1;
  if (colorIndex < 0.8) return 2;
  if (colorIndex < 1.3) return 3;
  return 4;
}

function buildCatalogStarPaths(
  stars: readonly VisibleStar[],
  width: number,
  height: number,
): CatalogStarPaths {
  let sizeCache = catalogStarPathCache.get(stars);
  if (!sizeCache) {
    sizeCache = new Map();
    catalogStarPathCache.set(stars, sizeCache);
  }
  const sizeKey = `${Math.round(width)}:${Math.round(height)}`;
  const cached = sizeCache.get(sizeKey);
  if (cached) return cached;

  const paths = Array.from({ length: CATALOG_STAR_COLORS.length * 5 }, () => new Path2D());
  const halos = Array.from({ length: CATALOG_STAR_COLORS.length }, () => new Path2D());
  const twinkles: CatalogStarPaths['twinkles'][number][] = [];
  for (const star of stars) {
    const x = star.azimuthDegrees / 360 * width;
    const y = height * 0.72 - star.altitudeDegrees / 90 * height * 0.62;
    const colorBucket = catalogColorBucket(star.colorIndex);
    const brightnessBucket = clamp(Math.floor((6.6 - star.apparentMagnitude) / 1.4), 0, 4);
    const radius = clamp(0.28 + (6.6 - star.apparentMagnitude) * 0.12, 0.28, 1.38);
    const path = paths[colorBucket * 5 + brightnessBucket];
    path.moveTo(x + radius, y);
    path.arc(x, y, radius, 0, TAU);
    if (star.apparentMagnitude < 1.5) {
      halos[colorBucket].moveTo(x + radius * 2.8, y);
      halos[colorBucket].arc(x, y, radius * 2.8, 0, TAU);
    }
    if (star.apparentMagnitude < 2.7) {
      twinkles.push({
        x,
        y,
        radius,
        phase: hashUnit(`catalog-star-${star.hr}`) * TAU,
        relativeAirMass: star.relativeAirMass,
      });
    }
  }
  const result = { paths, halos, twinkles };
  sizeCache.set(sizeKey, result);
  return result;
}

function drawCatalogStars(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  elapsedSeconds: number,
  stars: readonly VisibleStar[],
  reducedMotion: boolean,
  renderQuality: number,
) {
  const catalogPaths = buildCatalogStarPaths(stars, width, height);
  context.save();
  catalogPaths.halos.forEach((path, colorBucket) => {
    context.fillStyle = `rgba(${CATALOG_STAR_COLORS[colorBucket]}, .075)`;
    context.fill(path);
  });
  catalogPaths.paths.forEach((path, index) => {
    const colorBucket = Math.floor(index / 5);
    const brightnessBucket = index % 5;
    const minimumBrightnessBucket = renderQuality < 0.62 ? 2 : renderQuality < 0.82 ? 1 : 0;
    if (brightnessBucket < minimumBrightnessBucket) return;
    context.fillStyle = `rgba(${CATALOG_STAR_COLORS[colorBucket]}, ${0.35 + brightnessBucket * 0.12})`;
    context.fill(path);
  });
  if (!reducedMotion && renderQuality >= 0.7) {
    for (const star of catalogPaths.twinkles) {
      const airMassResponse = clamp((star.relativeAirMass - 1) / 8, 0, 1);
      const pulse = (0.035 + airMassResponse * 0.1) *
        (0.5 + 0.5 * Math.sin(elapsedSeconds * (1.4 + airMassResponse * 2.2) + star.phase));
      context.fillStyle = `rgba(245, 249, 255, ${pulse})`;
      context.beginPath();
      context.arc(star.x, star.y, star.radius * 1.15, 0, TAU);
      context.fill();
    }
  }
  context.restore();
}

function drawHorizonScene(frame: CanvasFrame) {
  const { context, width, height, horizon, lunar, solarObservation, stars, elapsedSeconds, realtimeOffsetSeconds, cosmicAgeYears } = frame;
  const earthFormationAge = 13.8e9 - 4.54e9;
  const sunBirthAge = 13.8e9 - 4.567e9;
  const redGiantProgress = clamp((cosmicAgeYears - (13.8e9 + 4.5e9)) / 8e8, 0, 1);
  const postEarthProgress = clamp((cosmicAgeYears - (13.8e9 + 7.5e9)) / 1e9, 0, 1);
  const animatedSun = apparentPosition(horizon.sun, realtimeOffsetSeconds);
  const animatedMoon = apparentPosition(horizon.moon, realtimeOffsetSeconds);
  const animatedMilkyWay = horizon.milkyWay.map((position) =>
    apparentPosition(position, realtimeOffsetSeconds));
  const animatedCore = animatedMilkyWay[0];
  const sunHeight = animatedSun.altitudeDegrees;
  const daylight = smoothstep(-8, 12, sunHeight);
  const twilight = smoothstep(-18, -2, sunHeight) * (1 - smoothstep(-2, 12, sunHeight));
  const sky = context.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, '#01040d');
  sky.addColorStop(0.72, '#0b1024');
  sky.addColorStop(1, '#080917');
  context.fillStyle = sky;
  context.fillRect(0, 0, width, height);
  const daylightSky = context.createLinearGradient(0, 0, 0, height);
  daylightSky.addColorStop(0, `rgba(34, 91, 151, ${daylight})`);
  daylightSky.addColorStop(0.68, `rgba(117, 151, 188, ${daylight * 0.9})`);
  daylightSky.addColorStop(1, `rgba(198, 173, 146, ${daylight * 0.55})`);
  context.fillStyle = daylightSky;
  context.fillRect(0, 0, width, height);
  const twilightSky = context.createLinearGradient(0, height * 0.2, 0, height * 0.75);
  twilightSky.addColorStop(0, 'rgba(47, 64, 111, 0)');
  twilightSky.addColorStop(1, `rgba(199, 91, 61, ${twilight * 0.82})`);
  context.fillStyle = twilightSky;
  context.fillRect(0, 0, width, height * 0.76);
  context.save();
  context.globalAlpha = 1 - smoothstep(-16, -2, sunHeight);
  if (stars.length) {
    drawCatalogStars(
      context,
      width,
      height,
      elapsedSeconds,
      stars,
      frame.reducedMotion,
      frame.renderQuality,
    );
  } else {
    drawStars(context, width, height * 0.74, elapsedSeconds, frame.reducedMotion ? 0 : 0.12);
  }
  context.restore();

  context.save();
  context.lineWidth = Math.max(7, height * 0.018);
  context.beginPath();
  let started = false;
  let previousX = 0;
  animatedMilkyWay.forEach((point) => {
    const projected = skyPoint(width, height, point);
    if (!started || Math.abs(projected.x - previousX) > width * 0.3) {
      context.moveTo(projected.x, projected.y);
      started = true;
    } else {
      context.lineTo(projected.x, projected.y);
    }
    previousX = projected.x;
  });
  // Two translucent strokes approximate the diffuse Galactic band without a
  // full-canvas shadow blur on every atmospheric animation frame.
  const bandWidth = context.lineWidth;
  context.strokeStyle = 'rgba(104, 132, 190, .13)';
  context.lineWidth = bandWidth * 2.35;
  context.stroke();
  context.strokeStyle = 'rgba(169, 194, 230, .32)';
  context.lineWidth = bandWidth;
  context.stroke();
  context.restore();

  const sun = skyPoint(width, height, animatedSun);
  if (cosmicAgeYears >= sunBirthAge) {
    drawGlow(context, sun.x, sun.y, 18, 'rgba(255, 205, 112, .76)', daylight);
    const sunRadius = clamp(
      9.3 * horizon.sun.angularDiameterDegrees / 0.533,
      8.6,
      10.2,
    ) + redGiantProgress * Math.min(width, height) * 0.055;
    const solarFrame = topocentricSolarSurfaceFrame(
      horizon.sun.subObserverLatitudeDegrees,
      horizon.sun.subObserverLongitudeDegrees,
      horizon.sun.northPoleBearingRadians,
    );
    drawSolarPhotosphere(
      context,
      sun.x,
      sun.y,
      sunRadius,
      horizon.date,
      solarFrame,
      horizon.sun.northPoleBearingRadians,
      solarObservation,
      redGiantProgress,
      1 - smoothstep(-1, 12, sunHeight),
    );
  }

  const moon = skyPoint(width, height, animatedMoon);
  drawGlow(context, moon.x, moon.y, 11, 'rgba(182, 208, 255, .38)', 1);
  const sunBearingFromMoon = greatCircleBearingRadians(
    animatedMoon.azimuthDegrees,
    animatedMoon.altitudeDegrees,
    animatedSun.azimuthDegrees,
    animatedSun.altitudeDegrees,
  );
  const moonRadius = clamp(
    9 * horizon.moon.angularDiameterDegrees / 0.518,
    8.2,
    10.2,
  );
  drawMoonSphere(
    context,
    moon.x,
    moon.y,
    moonRadius,
    horizon.moon,
    sunBearingFromMoon,
  );

  const core = skyPoint(width, height, animatedCore);
  context.fillStyle = '#ddb97a';
  context.beginPath();
  context.arc(core.x, core.y, 3, 0, TAU);
  context.fill();
  context.font = '500 11px ui-monospace, SFMono-Regular, Menlo, monospace';
  context.fillText('GALACTIC CORE', core.x + 8, core.y - 6);

  const ground = context.createLinearGradient(0, height * 0.68, 0, height);
  ground.addColorStop(0, '#111a26');
  ground.addColorStop(1, '#050711');
  context.fillStyle = ground;
  context.beginPath();
  context.moveTo(0, height * 0.74);
  for (let x = 0; x <= width; x += width / 18) {
    const ridge = Math.sin(x * 0.018) * 7 + Math.sin(x * 0.043 + 2) * 4;
    context.lineTo(x, height * 0.72 + ridge);
  }
  context.lineTo(width, height);
  context.lineTo(0, height);
  context.closePath();
  context.fill();

  if (cosmicAgeYears < earthFormationAge || postEarthProgress > 0) {
    context.fillStyle = `rgba(2, 4, 12, ${cosmicAgeYears < earthFormationAge ? 0.74 : 0.2 + postEarthProgress * 0.72})`;
    context.fillRect(0, 0, width, height);
    context.fillStyle = '#d8dfea';
    context.textAlign = 'center';
    context.font = '400 22px Georgia, Times New Roman, serif';
    context.fillText(
      cosmicAgeYears < earthFormationAge ? 'Earth has not formed yet.' : 'A terrestrial horizon is no longer physical.',
      width * 0.5,
      height * 0.48,
    );
    context.fillStyle = '#8998ae';
    context.font = '500 10px ui-monospace, SFMono-Regular, Menlo, monospace';
    context.fillText('THE TIMELINE CONTINUES; THIS LOCAL VIEW CANNOT.', width * 0.5, height * 0.48 + 24);
    context.textAlign = 'start';
  }

  const lunarInsetWidth = Math.min(240, width * 0.3);
  const insetX = width - lunarInsetWidth - 18;
  const insetY = 18;
  roundedRect(context, insetX, insetY, lunarInsetWidth, 92, 14);
  context.fillStyle = 'rgba(4, 7, 19, .72)';
  context.fill();
  context.strokeStyle = 'rgba(180, 205, 245, .16)';
  context.stroke();
  context.fillStyle = '#aab9cf';
  context.font = '600 10px ui-monospace, SFMono-Regular, Menlo, monospace';
  context.fillText('TRANQUILITY BASE HORIZON', insetX + 12, insetY + 18);
  const lunarHorizonY = insetY + 70;
  context.strokeStyle = 'rgba(207, 213, 223, .45)';
  context.beginPath();
  context.moveTo(insetX + 10, lunarHorizonY);
  context.lineTo(insetX + lunarInsetWidth - 10, lunarHorizonY);
  context.stroke();
  const animatedEarth = apparentPosition(lunar.earth, realtimeOffsetSeconds);
  const earthX = insetX + 16 + animatedEarth.azimuthDegrees / 360 * (lunarInsetWidth - 32);
  const earthY = lunarHorizonY - animatedEarth.altitudeDegrees / 90 * 47;
  drawGlow(context, earthX, earthY, 9, 'rgba(82, 151, 238, .4)');
  drawPhaseDisc(context, earthX, earthY, 8, '#4b91ca', lunar.earth.phaseAngleDegrees, -0.2);
}

function planetRadius(radiusKm: number): number {
  return clamp(2.4 + Math.log10(radiusKm / 700 + 1) * 3.8, 2.6, 14);
}

function satelliteRadius(radiusKm: number): number {
  return clamp(1.25 + Math.log10(radiusKm / 5 + 1) * 0.65, 1.4, 3.1);
}

function projectSolarVector(
  vector: CartesianPosition,
  centerX: number,
  centerY: number,
  orbitScale: (distanceAu: number) => number,
) {
  const distance = Math.hypot(vector.x, vector.y, vector.z) || 1;
  const radius = orbitScale(distance);
  const projected = toSolarView(vector);
  return {
    x: centerX + projected.x / distance * radius,
    y: centerY + projected.y / distance * radius,
  };
}

const orbitPathCache = new Map<string, ReadonlyMap<string, Path2D>>();

function solarOrbitPaths(
  planets: SolarSystemSnapshot['planets'],
  width: number,
  height: number,
  centerX: number,
  centerY: number,
  orbitScale: (distanceAu: number) => number,
) {
  const cacheKey = `${Math.round(width)}:${Math.round(height)}`;
  const cached = orbitPathCache.get(cacheKey);
  if (cached) return cached;

  const paths = new Map<string, Path2D>();
  for (const planet of planets) {
    const path = new Path2D();
    for (let step = 0; step <= 112; step += 1) {
      const point = orbitalPositionAtTrueAnomaly(planet.orbit, step / 112 * TAU);
      const projected = projectSolarVector(point, centerX, centerY, orbitScale);
      if (step === 0) path.moveTo(projected.x, projected.y);
      else path.lineTo(projected.x, projected.y);
    }
    path.closePath();
    paths.set(planet.key, path);
  }
  orbitPathCache.set(cacheKey, paths);
  if (orbitPathCache.size > 4) {
    const oldest = orbitPathCache.keys().next().value;
    if (oldest) orbitPathCache.delete(oldest);
  }
  return paths;
}

type PlanetState = SolarSystemSnapshot['planets'][number];
type SatelliteState = SolarSystemSnapshot['satellites'][number];
type RGB = readonly [number, number, number];

interface SurfaceBody {
  key: string;
  name: string;
}

interface PlanetViewFrame {
  pole: CartesianPosition;
  meridian: CartesianPosition;
  east: CartesianPosition;
  light: CartesianPosition;
}

const bodyTextureCache = new Map<string, SurfaceCanvas>();

function angularGaussian(
  longitude: number,
  latitude: number,
  centerLongitude: number,
  centerLatitude: number,
  longitudeWidth: number,
  latitudeWidth: number,
) {
  const longitudeDelta = Math.atan2(
    Math.sin(longitude - centerLongitude),
    Math.cos(longitude - centerLongitude),
  ) / longitudeWidth;
  const latitudeDelta = (latitude - centerLatitude) / latitudeWidth;
  return Math.exp(-0.5 * (longitudeDelta ** 2 + latitudeDelta ** 2));
}

function blendColor(first: RGB, second: RGB, amount: number): RGB {
  const mix = clamp(amount, 0, 1);
  return [
    first[0] + (second[0] - first[0]) * mix,
    first[1] + (second[1] - first[1]) * mix,
    first[2] + (second[2] - first[2]) * mix,
  ];
}

function surfaceMaterial(name: string, latitude: number, longitude: number): { color: RGB; specular: number } {
  const sinLatitude = Math.sin(latitude);
  const textureNoise = (
    Math.sin(longitude * 5 + Math.sin(latitude * 3) * 1.7) +
    Math.sin(longitude * 11 - latitude * 7) * 0.45 +
    Math.cos(longitude * 17 + latitude * 13) * 0.2
  ) / 1.65;

  if (name === 'Moon') {
    const albedo = sampleLunarAlbedo(longitude, latitude);
    return { color: [albedo * 257, albedo * 252, albedo * 241], specular: 0.004 };
  }
  if (name === 'Phobos' || name === 'Deimos') {
    const craterField = 0.5 + 0.5 * Math.sin(longitude * 17 + latitude * 13) *
      Math.cos(longitude * 9 - latitude * 19);
    const base: RGB = name === 'Phobos' ? [91, 75, 62] : [145, 126, 103];
    return { color: blendColor(base, [53, 47, 42], craterField * 0.42 + textureNoise * 0.12), specular: 0.004 };
  }
  if (name === 'Io') {
    let color = blendColor([224, 194, 82], [246, 227, 156], 0.35 + textureNoise * 0.18);
    const sulfur = Math.max(
      angularGaussian(longitude, latitude, -1.15, 0.35, 0.32, 0.24),
      angularGaussian(longitude, latitude, 1.65, -0.28, 0.26, 0.2),
    );
    color = blendColor(color, [142, 57, 28], sulfur * 0.9);
    return { color, specular: 0.012 };
  }
  if (name === 'Europa') {
    const lineament = Math.exp(-Math.abs(Math.sin(
      longitude * 4.5 + latitude * 7 + Math.sin(longitude * 2) * 1.3,
    )) * 11);
    const color = blendColor([215, 210, 183], [126, 75, 57], lineament * 0.72 + Math.max(0, textureNoise) * 0.08);
    return { color, specular: 0.04 };
  }
  if (name === 'Ganymede') {
    const groovedTerrain = smoothstep(-0.35, 0.5, textureNoise + Math.sin(longitude * 3 - latitude * 5) * 0.24);
    return { color: blendColor([99, 83, 73], [181, 168, 143], groovedTerrain), specular: 0.012 };
  }
  if (name === 'Callisto') {
    const brightCrater = smoothstep(0.7, 0.96,
      0.5 + 0.5 * Math.sin(longitude * 23) * Math.cos(latitude * 19));
    return { color: blendColor([66, 58, 52], [190, 181, 159], brightCrater * 0.72 + Math.max(0, textureNoise) * 0.12), specular: 0.008 };
  }
  if (name === 'Mimas') {
    const herschel = angularGaussian(longitude, latitude, 0, 0.12, 0.3, 0.3);
    return { color: blendColor([190, 190, 184], [75, 76, 77], herschel * 0.72 + textureNoise * 0.1), specular: 0.02 };
  }
  if (name === 'Enceladus') {
    const tigerStripes = latitude < -0.75
      ? Math.exp(-Math.abs(Math.sin(longitude * 8 + latitude * 3)) * 8)
      : 0;
    return { color: blendColor([239, 247, 249], [112, 161, 190], tigerStripes * 0.55), specular: 0.09 };
  }
  if (name === 'Tethys' || name === 'Dione' || name === 'Rhea') {
    const cratered = smoothstep(-0.45, 0.55, textureNoise);
    const base: RGB = name === 'Dione' ? [197, 202, 203] : name === 'Rhea' ? [172, 176, 177] : [208, 211, 207];
    return { color: blendColor(base, [108, 112, 114], cratered * 0.38), specular: 0.025 };
  }
  if (name === 'Titan') {
    const hazeBand = 0.5 + 0.5 * Math.sin(latitude * 7 + textureNoise * 0.18);
    return { color: blendColor([218, 157, 72], [142, 81, 36], hazeBand * 0.28), specular: 0.025 };
  }
  if (name === 'Iapetus') {
    const leadingHemisphere = smoothstep(-0.28, 0.28, -Math.sin(longitude));
    let color = blendColor([208, 200, 177], [48, 39, 34], leadingHemisphere * 0.93);
    color = blendColor(color, [126, 102, 82], Math.max(0, textureNoise) * 0.12);
    return { color, specular: 0.006 };
  }
  if (name === 'Ariel' || name === 'Titania' || name === 'Oberon') {
    const faulted = smoothstep(-0.5, 0.6, textureNoise + Math.sin(longitude * 8 + latitude * 5) * 0.18);
    const base: RGB = name === 'Ariel' ? [194, 203, 203] : name === 'Titania' ? [154, 156, 151] : [131, 126, 121];
    return { color: blendColor(base, [91, 91, 89], faulted * 0.35), specular: 0.02 };
  }
  if (name === 'Umbriel') {
    return { color: blendColor([83, 82, 80], [130, 132, 129], Math.max(0, textureNoise) * 0.22), specular: 0.008 };
  }
  if (name === 'Triton') {
    const nitrogenCap = smoothstep(-0.15, -0.85, sinLatitude);
    let color = blendColor([181, 142, 137], [224, 211, 204], nitrogenCap);
    color = blendColor(color, [101, 78, 75], Math.max(0, textureNoise) * 0.14);
    return { color, specular: 0.025 };
  }
  if (name === 'Charon') {
    const mordor = smoothstep(0.78, 1.18, latitude);
    return { color: blendColor([147, 143, 137], [74, 45, 42], mordor * 0.82 + textureNoise * 0.08), specular: 0.01 };
  }

  if (name === 'Earth') {
    const americas = Math.max(
      angularGaussian(longitude, latitude, -1.75, 0.35, 0.38, 0.78),
      angularGaussian(longitude, latitude, -1.15, -0.48, 0.28, 0.58),
    );
    const afroEurasia = Math.max(
      angularGaussian(longitude, latitude, 0.35, 0.18, 0.36, 0.7),
      angularGaussian(longitude, latitude, 1.25, 0.72, 0.92, 0.3),
    );
    const australia = angularGaussian(longitude, latitude, 2.35, -0.45, 0.3, 0.23);
    const greenland = angularGaussian(longitude, latitude, -0.72, 1.18, 0.25, 0.22);
    const land = smoothstep(0.34, 0.58, Math.max(americas, afroEurasia, australia, greenland) + textureNoise * 0.16);
    const vegetation = smoothstep(-0.15, 0.55, Math.cos(latitude * 1.7) + textureNoise * 0.28);
    let color = blendColor([32, 79, 139], [80, 124, 67], land * vegetation);
    color = blendColor(color, [151, 124, 77], land * (1 - vegetation) * 0.72);
    const polarIce = smoothstep(1.12, 1.45, Math.abs(latitude));
    color = blendColor(color, [224, 237, 242], polarIce);
    const clouds = smoothstep(0.58, 0.92, Math.sin(longitude * 7 + latitude * 9) * 0.5 + textureNoise * 0.36 + 0.5);
    color = blendColor(color, [235, 241, 239], clouds * 0.5);
    return { color, specular: (1 - land) * (1 - clouds) * 0.34 };
  }
  if (name === 'Jupiter') {
    const bands = 0.5 + 0.5 * Math.sin(latitude * 19 + Math.sin(latitude * 5) * 1.2 + textureNoise * 0.28);
    let color = blendColor([224, 200, 167], [139, 91, 69], bands * 0.72);
    const redSpot = angularGaussian(longitude, latitude, -1.05, -0.38, 0.28, 0.13);
    color = blendColor(color, [152, 49, 35], redSpot * 0.9);
    return { color, specular: 0.025 };
  }
  if (name === 'Saturn') {
    const bands = 0.5 + 0.5 * Math.sin(latitude * 15 + textureNoise * 0.18);
    return { color: blendColor([231, 216, 174], [169, 141, 91], bands * 0.48), specular: 0.02 };
  }
  if (name === 'Mars') {
    const darkTerrain = smoothstep(-0.15, 0.42, textureNoise +
      angularGaussian(longitude, latitude, 0.2, 0.05, 0.7, 0.38) * 0.45);
    let color = blendColor([195, 93, 57], [87, 50, 42], darkTerrain * 0.68);
    color = blendColor(color, [235, 226, 216], smoothstep(1.25, 1.5, Math.abs(latitude)));
    return { color, specular: 0.01 };
  }
  if (name === 'Mercury') {
    const crater = smoothstep(0.45, 0.9, Math.sin(longitude * 21) * Math.cos(latitude * 17) * 0.5 + 0.5);
    return { color: blendColor([176, 169, 158], [93, 88, 82], crater * 0.45 + textureNoise * 0.12), specular: 0.015 };
  }
  if (name === 'Venus') {
    const clouds = 0.5 + 0.5 * Math.sin(longitude * 8 + latitude * 11 + Math.sin(latitude * 4) * 1.8);
    return { color: blendColor([239, 218, 157], [181, 132, 71], clouds * 0.48), specular: 0.08 };
  }
  if (name === 'Uranus') {
    const bands = 0.5 + 0.5 * Math.sin(latitude * 12);
    return { color: blendColor([160, 219, 219], [115, 185, 194], bands * 0.16), specular: 0.06 };
  }
  if (name === 'Neptune') {
    const bands = 0.5 + 0.5 * Math.sin(latitude * 14 + textureNoise * 0.2);
    let color = blendColor([61, 97, 191], [38, 63, 139], bands * 0.3);
    color = blendColor(color, [24, 37, 102], angularGaussian(longitude, latitude, 0.8, -0.32, 0.32, 0.15) * 0.7);
    return { color, specular: 0.05 };
  }
  if (name === 'Pluto') {
    const heart = Math.max(
      angularGaussian(longitude, latitude, Math.PI - 0.25, 0.25, 0.32, 0.35),
      angularGaussian(longitude, latitude, -Math.PI + 0.25, 0.25, 0.32, 0.35),
    );
    return { color: blendColor([151, 119, 92], [229, 218, 196], heart * 0.9 + textureNoise * 0.12), specular: 0.01 };
  }
  return { color: [170, 170, 170], specular: 0.02 };
}

function planetViewFrame(
  planet: PlanetState,
  eclipticPosition: CartesianPosition,
  realtimeOffsetSeconds: number,
): PlanetViewFrame {
  const spinDelta = realtimeOffsetSeconds * 360 / (planet.rotationPeriodHours * 3_600);
  const basis = rotateEquatorialBasis(
    planet.primeMeridianEcliptic,
    planet.eastEcliptic,
    spinDelta,
  );
  return {
    pole: normalize(toSolarView(planet.axisNorthEcliptic)),
    meridian: normalize(toSolarView(basis.meridian)),
    east: normalize(toSolarView(basis.east)),
    light: normalize(toSolarView({
      x: -eclipticPosition.x,
      y: -eclipticPosition.y,
      z: -eclipticPosition.z,
    })),
  };
}

function bodyTextureKey(
  body: SurfaceBody,
  radius: number,
  frame: PlanetViewFrame,
  sunlightFraction: number,
): string {
  const quantizeVector = (vector: CartesianPosition) =>
    [vector.x, vector.y, vector.z].map((value) => Math.round(value * 72)).join(',');
  return [
    body.key,
    Math.round(radius * 4),
    quantizeVector(frame.pole),
    quantizeVector(frame.meridian),
    quantizeVector(frame.light),
    Math.round(sunlightFraction * 24),
  ].join(':');
}

function renderBodyTexture(
  body: SurfaceBody,
  radius: number,
  frame: PlanetViewFrame,
  sunlightFraction = 1,
): SurfaceCanvas {
  const cacheKey = bodyTextureKey(body, radius, frame, sunlightFraction);
  const cached = bodyTextureCache.get(cacheKey);
  if (cached) return cached;
  const size = Math.max(12, Math.ceil(radius * 4));
  const surface: SurfaceCanvas = typeof OffscreenCanvas !== 'undefined'
    ? new OffscreenCanvas(size, size)
    : Object.assign(document.createElement('canvas'), { width: size, height: size });
  const surfaceContext = surface.getContext('2d');
  if (!surfaceContext) return surface;
  const image = surfaceContext.createImageData(size, size);
  const half = size / 2;
  const viewDirection = { x: 0, y: 0, z: 1 };
  const halfLight = normalize({
    x: frame.light.x + viewDirection.x,
    y: frame.light.y + viewDirection.y,
    z: frame.light.z + viewDirection.z,
  });

  for (let pixelY = 0; pixelY < size; pixelY += 1) {
    const normalY = (pixelY + 0.5 - half) / half;
    for (let pixelX = 0; pixelX < size; pixelX += 1) {
      const normalX = (pixelX + 0.5 - half) / half;
      const radiusSquared = normalX ** 2 + normalY ** 2;
      if (radiusSquared >= 1) continue;
      const normal = { x: normalX, y: normalY, z: Math.sqrt(1 - radiusSquared) };
      const { latitudeRadians, longitudeRadians } = sphereCoordinates(
        normal,
        frame.pole,
        frame.meridian,
        frame.east,
      );
      const material = surfaceMaterial(body.name, latitudeRadians, longitudeRadians);
      const limbResponse = 0.66 + normal.z * 0.34;
      const fullIllumination = lambertianLight(normal, frame.light);
      const illumination = (0.025 + (fullIllumination - 0.025) * sunlightFraction) * limbResponse;
      const specular = material.specular * Math.max(0, dot(normal, frame.light)) *
        Math.max(0, dot(normal, halfLight)) ** 28 * sunlightFraction;
      const index = (pixelY * size + pixelX) * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        const linearAlbedo = (material.color[channel] / 255) ** 2.2;
        image.data[index + channel] = Math.round(
          clamp((linearAlbedo * illumination + specular) ** (1 / 2.2) * 255, 0, 255),
        );
      }
      image.data[index + 3] = Math.round(clamp((1 - radiusSquared) * size * 0.55, 0, 1) * 255);
    }
  }
  surfaceContext.putImageData(image, 0, 0);
  bodyTextureCache.set(cacheKey, surface);
  if (bodyTextureCache.size > 256) {
    const oldest = bodyTextureCache.keys().next().value;
    if (oldest) bodyTextureCache.delete(oldest);
  }
  return surface;
}

function drawPlanetSphere(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  planet: PlanetState,
  frame: PlanetViewFrame,
) {
  const texture = renderBodyTexture(planet, radius, frame);
  context.drawImage(texture, x - radius, y - radius, radius * 2, radius * 2);
  const atmosphereColor = planet.name === 'Earth'
    ? 'rgba(112, 187, 255, .65)'
    : planet.name === 'Venus'
      ? 'rgba(255, 224, 157, .42)'
      : planet.name === 'Neptune' || planet.name === 'Uranus'
        ? 'rgba(154, 211, 245, .3)'
        : 'rgba(255,255,255,.2)';
  context.strokeStyle = atmosphereColor;
  context.lineWidth = planet.name === 'Earth' || planet.name === 'Venus' ? 1.15 : 0.7;
  context.beginPath();
  context.arc(x, y, radius, 0, TAU);
  context.stroke();
}

function satelliteViewFrame(
  satellite: SatelliteState,
  parentEclipticPositionAu: CartesianPosition,
): PlanetViewFrame {
  const heliocentricPosition = {
    x: parentEclipticPositionAu.x + satellite.relativePositionEclipticKm.x / AU_KM,
    y: parentEclipticPositionAu.y + satellite.relativePositionEclipticKm.y / AU_KM,
    z: parentEclipticPositionAu.z + satellite.relativePositionEclipticKm.z / AU_KM,
  };
  return {
    pole: normalize(toSolarView(satellite.axisNorthEcliptic)),
    meridian: normalize(toSolarView(satellite.primeMeridianEcliptic)),
    east: normalize(toSolarView(satellite.eastEcliptic)),
    light: normalize(toSolarView({
      x: -heliocentricPosition.x,
      y: -heliocentricPosition.y,
      z: -heliocentricPosition.z,
    })),
  };
}

function drawSatelliteSphere(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  satellite: SatelliteState,
  frame: PlanetViewFrame,
) {
  const texture = renderBodyTexture(satellite, radius, frame, satellite.sunlightFraction);
  context.drawImage(texture, x - radius, y - radius, radius * 2, radius * 2);
  context.strokeStyle = satellite.name === 'Titan'
    ? 'rgba(222, 164, 80, .72)'
    : satellite.name === 'Enceladus' || satellite.name === 'Europa'
      ? 'rgba(210, 232, 241, .48)'
      : 'rgba(226, 232, 238, .3)';
  context.lineWidth = satellite.name === 'Titan' ? 0.72 : 0.45;
  context.beginPath();
  context.arc(x, y, radius, 0, TAU);
  context.stroke();
}

function drawSaturnRingHalf(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  pole: CartesianPosition,
  front: boolean,
) {
  const opening = clamp(Math.abs(pole.z), 0.075, 1);
  const rotation = Math.atan2(pole.y, pole.x) + Math.PI / 2;
  const nearSideStartsAtZero = pole.z >= 0;
  const start = front === nearSideStartsAtZero ? 0 : Math.PI;
  const end = start + Math.PI;
  const bands = [
    { radius: 2.05, width: 0.24, color: 'rgba(210, 194, 148, .52)' },
    { radius: 1.72, width: 0.3, color: 'rgba(236, 219, 171, .72)' },
    { radius: 1.38, width: 0.16, color: 'rgba(161, 142, 103, .58)' },
  ];
  context.save();
  for (const band of bands) {
    context.strokeStyle = band.color;
    context.lineWidth = Math.max(0.7, radius * band.width);
    context.beginPath();
    context.ellipse(
      x,
      y,
      radius * band.radius,
      radius * band.radius * opening,
      rotation,
      start,
      end,
    );
    context.stroke();
  }
  context.restore();
}

function drawSolarScene(frame: CanvasFrame) {
  const { context, width, height, solar, solarObservation, elapsedSeconds, realtimeOffsetSeconds } = frame;
  const background = context.createRadialGradient(width * 0.5, height * 0.5, 0, width * 0.5, height * 0.5, width * 0.65);
  background.addColorStop(0, '#171225');
  background.addColorStop(1, '#02040c');
  context.fillStyle = background;
  context.fillRect(0, 0, width, height);
  drawStars(context, width, height, elapsedSeconds);
  const centerX = width * 0.5;
  const centerY = height * 0.49;
  const maxOrbit = Math.min(width, height) * 0.43;
  const orbitScale = (distanceAu: number) => 35 + Math.log1p(distanceAu) / Math.log(41) * (maxOrbit - 35);
  const orbitPaths = solarOrbitPaths(solar.planets, width, height, centerX, centerY, orbitScale);

  const planetScreen = new Map<string, {
    x: number;
    y: number;
    radius: number;
    eclipticPosition: CartesianPosition;
  }>();
  solar.planets.forEach((planet) => {
    context.strokeStyle = planet.key === 'mercury' ? 'rgba(230, 193, 143, .34)' : 'rgba(184, 200, 229, .12)';
    context.lineWidth = planet.key === 'mercury' ? 1.2 : 0.8;
    const path = orbitPaths.get(planet.key);
    if (path) context.stroke(path);
  });

  drawGlow(context, centerX, centerY, 24, 'rgba(255, 184, 73, .75)');
  const solarFrame: SolarSurfaceFrame = {
    pole: normalize(toSolarView(solar.sun.axisNorthEcliptic)),
    meridian: normalize(toSolarView(solar.sun.primeMeridianEcliptic)),
    east: normalize(toSolarView(solar.sun.eastEcliptic)),
  };
  const solarNorthPoleBearing = Math.atan2(solarFrame.pole.x, -solarFrame.pole.y);
  drawSolarPhotosphere(
    context,
    centerX,
    centerY,
    19,
    solar.date,
    solarFrame,
    solarNorthPoleBearing,
    solarObservation,
  );

  solar.planets.forEach((planet) => {
    const eclipticPosition = planet.heliocentricEclipticAu;
    const projected = projectSolarVector(eclipticPosition, centerX, centerY, orbitScale);
    const { x, y } = projected;
    const radius = planetRadius(planet.radiusKm);
    const viewFrame = planetViewFrame(planet, eclipticPosition, realtimeOffsetSeconds);
    if (planet.name === 'Saturn') {
      drawSaturnRingHalf(context, x, y, radius, viewFrame.pole, false);
    }
    drawPlanetSphere(context, x, y, radius, planet, viewFrame);
    if (planet.name === 'Saturn') {
      drawSaturnRingHalf(context, x, y, radius, viewFrame.pole, true);
    }
    planetScreen.set(planet.key, { x, y, radius, eclipticPosition });
    context.fillStyle = 'rgba(231, 237, 249, .82)';
    context.font = '500 9px ui-monospace, SFMono-Regular, Menlo, monospace';
    const labelDirection = x < centerX ? -1 : 1;
    context.textAlign = labelDirection < 0 ? 'right' : 'left';
    context.fillText(planet.name.toUpperCase(), x + labelDirection * (radius + 4), y - radius);
    context.textAlign = 'start';
  });

  solar.satellites.forEach((satellite) => {
    const parent = planetScreen.get(satellite.parent);
    if (!parent) return;
    const relativeView = toSolarView(satellite.relativePositionEclipticKm);
    const vectorLength = Math.hypot(relativeView.x, relativeView.y, relativeView.z) || 1;
    const localRadius = parent.radius + 4 + Math.log10(satellite.semiMajorAxisKm / 8_000 + 1) * 2.6;
    const satelliteX = parent.x + relativeView.x / vectorLength * localRadius;
    const satelliteY = parent.y + relativeView.y / vectorLength * localRadius;
    const radius = satelliteRadius(satellite.radiusKm);
    const viewFrame = satelliteViewFrame(satellite, parent.eclipticPosition);
    drawSatelliteSphere(context, satelliteX, satelliteY, radius, satellite, viewFrame);
  });

  const mercury = solar.planets[0];
  const perihelionAngle = solar.mercuryPerihelionLongitudeDegrees * Math.PI / 180 - 0.12;
  const guide = orbitScale(mercury.distanceAu) + 15;
  context.save();
  context.setLineDash([4, 4]);
  context.strokeStyle = 'rgba(255, 200, 125, .52)';
  const perihelionDirection = {
    x: Math.cos(perihelionAngle),
    y: Math.sin(perihelionAngle) * 0.48,
  };
  const perihelionDirectionLength = Math.hypot(perihelionDirection.x, perihelionDirection.y);
  context.beginPath();
  context.moveTo(
    centerX + perihelionDirection.x / perihelionDirectionLength * 28,
    centerY + perihelionDirection.y / perihelionDirectionLength * 28,
  );
  context.lineTo(centerX + Math.cos(perihelionAngle) * guide, centerY + Math.sin(perihelionAngle) * guide * 0.48);
  context.stroke();
  context.restore();

  const fullSun = solar.satellites.filter((satellite) => satellite.sunlightFraction >= 0.999).length;
  const penumbra = solar.satellites.filter((satellite) =>
    satellite.sunlightFraction > 0.001 && satellite.sunlightFraction < 0.999).length;
  const umbra = solar.satellites.length - fullSun - penumbra;
  roundedRect(context, 18, height - 139, Math.min(344, width - 36), 83, 11);
  context.fillStyle = 'rgba(4, 7, 18, .74)';
  context.fill();
  context.fillStyle = '#aab9cf';
  context.font = '500 10px ui-monospace, SFMono-Regular, Menlo, monospace';
  context.fillText(
    `${solar.satellites.length} MAJOR SATELLITES · LOCAL SCALE EXAGGERATED`,
    30,
    height - 116,
  );
  context.fillText(
    `${fullSun} FULL SUN · ${penumbra} PENUMBRA · ${umbra} UMBRA`,
    30,
    height - 99,
  );
  context.fillText(
    solarObservation
      ? `SUN · SDO/HMI CONTINUUM · ${solarObservation.observedAt.toISOString().slice(11, 16)} UTC`
      : 'SUN · PHYSICAL PROCEDURAL FALLBACK',
    30,
    height - 82,
  );
  context.fillText(`MERCURY GR EXCESS · ${solar.mercuryRelativisticPrecessionArcsecondsPerCentury.toFixed(2)}″ / CENTURY`, 30, height - 65);
}

const GALAXY_VIEW_ROTATION_RADIANS = -0.22;
const GALAXY_PLANE_COMPRESSION = 0.54;

interface GalaxyProjectedPoint {
  x: number;
  y: number;
}

interface GalaxyRenderCache {
  centerX: number;
  centerY: number;
  radius: number;
  pixelsPerKpc: number;
  barPath: Path2D;
  armGuides: readonly { path: Path2D; dustPath: Path2D; width: number }[];
  measuredSegments: readonly {
    key: string;
    name: string;
    path: Path2D;
    width: number;
    label: GalaxyProjectedPoint;
  }[];
  particlePaths: readonly Path2D[];
  trailBatches: readonly {
    path: Path2D;
    endProgress: number;
    uncertainty: number;
  }[];
  trailPoints: readonly GalaxyProjectedPoint[];
}

const galaxyRenderCache = new Map<string, GalaxyRenderCache>();

function projectGalaxyPoint(
  point: GalacticPoint,
  centerX: number,
  centerY: number,
  pixelsPerKpc: number,
): GalaxyProjectedPoint {
  const cosine = Math.cos(GALAXY_VIEW_ROTATION_RADIANS);
  const sine = Math.sin(GALAXY_VIEW_ROTATION_RADIANS);
  const rotatedX = point.xKpc * cosine - point.yKpc * sine;
  const rotatedY = point.xKpc * sine + point.yKpc * cosine;
  return {
    x: centerX + rotatedX * pixelsPerKpc,
    y: centerY + (rotatedY * GALAXY_PLANE_COMPRESSION - point.zKpc * 0.92) * pixelsPerKpc,
  };
}

function pathFromGalacticPoints(
  points: readonly GalacticPoint[],
  centerX: number,
  centerY: number,
  pixelsPerKpc: number,
): Path2D {
  const path = new Path2D();
  points.forEach((point, index) => {
    const projected = projectGalaxyPoint(point, centerX, centerY, pixelsPerKpc);
    if (index === 0) path.moveTo(projected.x, projected.y);
    else path.lineTo(projected.x, projected.y);
  });
  return path;
}

function buildGalaxyRenderCache(width: number, height: number): GalaxyRenderCache {
  const cacheKey = `${Math.round(width)}:${Math.round(height)}`;
  const cached = galaxyRenderCache.get(cacheKey);
  if (cached) return cached;
  const centerX = width * 0.55;
  const centerY = height * 0.465;
  const radius = Math.min(width * 0.34, height * 0.43);
  const pixelsPerKpc = radius / GALACTIC_DISPLAY_RADIUS_KPC;

  const barAngle = GALACTIC_BAR_ANGLE_DEGREES * Math.PI / 180;
  const barMajor = { x: Math.sin(barAngle), y: Math.cos(barAngle) };
  const barMinor = { x: Math.cos(barAngle), y: -Math.sin(barAngle) };
  const barPoints = Array.from({ length: 81 }, (_, index): GalacticPoint => {
    const angle = index / 80 * TAU;
    const along = Math.cos(angle) * GALACTIC_BAR_HALF_LENGTH_KPC;
    const across = Math.sin(angle) * 1.08;
    return {
      xKpc: barMajor.x * along + barMinor.x * across,
      yKpc: barMajor.y * along + barMinor.y * across,
      zKpc: 0,
    };
  });
  const barPath = pathFromGalacticPoints(barPoints, centerX, centerY, pixelsPerKpc);
  barPath.closePath();

  const armGuides = GALACTIC_MAJOR_ARM_GUIDES.map((guide) => {
    const points = Array.from({ length: 181 }, (_, index) => {
      const radiusKpc = 2.55 + index / 180 * (GALACTIC_DISPLAY_RADIUS_KPC - 2.55);
      return majorArmPointAtRadius(guide, radiusKpc);
    });
    const dustPoints = Array.from({ length: 181 }, (_, index) => {
      const radiusKpc = 2.55 + index / 180 * (GALACTIC_DISPLAY_RADIUS_KPC - 2.55);
      return majorArmPointAtRadius(
        guide,
        Math.max(2.35, radiusKpc - galacticArmWidthKpc(radiusKpc) * 0.58),
      );
    });
    return {
      path: pathFromGalacticPoints(points, centerX, centerY, pixelsPerKpc),
      dustPath: pathFromGalacticPoints(dustPoints, centerX, centerY, pixelsPerKpc),
      width: galacticArmWidthKpc(9) * pixelsPerKpc,
    };
  });

  const measuredSegments = GALACTIC_SPIRAL_SEGMENTS.map((segment) => {
    const points = sampleSpiralSegment(segment, 72);
    const labelPoint = points[Math.floor(points.length * 0.72)];
    return {
      key: segment.key,
      name: segment.name,
      path: pathFromGalacticPoints(points, centerX, centerY, pixelsPerKpc),
      width: Math.max(0.9, segment.widthAtKinkKpc * pixelsPerKpc * 0.7),
      label: projectGalaxyPoint(labelPoint, centerX, centerY, pixelsPerKpc),
    };
  });

  const particlePaths = Array.from({ length: 12 }, () => new Path2D());
  const particleRadii = [0.38, 0.68, 1.05];
  for (const particle of GALAXY_PARTICLE_FIELD) {
    const projected = projectGalaxyPoint(particle, centerX, centerY, pixelsPerKpc);
    const radiusPixels = particleRadii[particle.sizeBucket] *
      (particle.layer === 'arm' ? 1.08 : 1);
    const path = particlePaths[particle.colorBucket * 3 + particle.sizeBucket];
    path.moveTo(projected.x + radiusPixels, projected.y);
    path.arc(projected.x, projected.y, radiusPixels, 0, TAU);
  }

  const trailPoints = SOLAR_GALACTIC_TRAIL.map((point) =>
    projectGalaxyPoint(point, centerX, centerY, pixelsPerKpc));
  const trailBatches: Array<{ path: Path2D; endProgress: number; uncertainty: number }> = [];
  const trailBatchSize = 14;
  for (let start = 0; start < SOLAR_GALACTIC_TRAIL.length - 1; start += trailBatchSize) {
    const end = Math.min(SOLAR_GALACTIC_TRAIL.length - 1, start + trailBatchSize);
    const batchPoints = SOLAR_GALACTIC_TRAIL.slice(Math.max(0, start - 1), end + 1);
    trailBatches.push({
      path: pathFromGalacticPoints(batchPoints, centerX, centerY, pixelsPerKpc),
      endProgress: SOLAR_GALACTIC_TRAIL[end].progress,
      uncertainty: SOLAR_GALACTIC_TRAIL[Math.floor((start + end) / 2)].uncertainty,
    });
  }

  const built = {
    centerX,
    centerY,
    radius,
    pixelsPerKpc,
    barPath,
    armGuides,
    measuredSegments,
    particlePaths,
    trailBatches,
    trailPoints,
  };
  galaxyRenderCache.set(cacheKey, built);
  if (galaxyRenderCache.size > 4) {
    const oldest = galaxyRenderCache.keys().next().value;
    if (oldest) galaxyRenderCache.delete(oldest);
  }
  return built;
}

const galaxyStaticSurfaceCache = new Map<string, SurfaceCanvas>();

function drawGalaxyStaticLayer(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  model: GalaxyRenderCache,
) {
  const { centerX, centerY, radius } = model;
  const background = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, width * 0.72);
  background.addColorStop(0, '#12101d');
  background.addColorStop(0.5, '#050713');
  background.addColorStop(1, '#01030a');
  context.fillStyle = background;
  context.fillRect(0, 0, width, height);
  drawStars(context, width, height, 0);

  context.save();
  context.translate(centerX, centerY);
  context.rotate(GALAXY_VIEW_ROTATION_RADIANS);
  context.scale(1, GALAXY_PLANE_COMPRESSION);
  const diskGradient = context.createRadialGradient(0, 0, 0, 0, 0, radius);
  diskGradient.addColorStop(0, 'rgba(196, 154, 109, .52)');
  diskGradient.addColorStop(0.14, 'rgba(115, 90, 91, .34)');
  diskGradient.addColorStop(0.35, 'rgba(53, 53, 80, .42)');
  diskGradient.addColorStop(0.7, 'rgba(20, 28, 53, .28)');
  diskGradient.addColorStop(1, 'rgba(4, 7, 18, 0)');
  context.fillStyle = diskGradient;
  context.beginPath();
  context.arc(0, 0, radius, 0, TAU);
  context.fill();
  context.strokeStyle = 'rgba(105, 125, 170, .13)';
  context.lineWidth = 1;
  context.stroke();
  context.restore();

  context.fillStyle = 'rgba(185, 126, 82, .16)';
  context.fill(model.barPath);
  context.strokeStyle = 'rgba(224, 171, 105, .28)';
  context.lineWidth = 1.1;
  context.stroke(model.barPath);

  context.save();
  context.lineCap = 'round';
  for (const arm of model.armGuides) {
    context.strokeStyle = 'rgba(112, 137, 196, .13)';
    context.lineWidth = Math.max(5, arm.width * 2.6);
    context.stroke(arm.path);
    context.strokeStyle = 'rgba(161, 178, 217, .2)';
    context.lineWidth = Math.max(1.2, arm.width * 0.72);
    context.stroke(arm.path);
  }
  for (const arm of model.armGuides) {
    context.strokeStyle = 'rgba(2, 4, 12, .48)';
    context.lineWidth = Math.max(1.25, arm.width * 0.5);
    context.stroke(arm.dustPath);
  }
  context.restore();

  const particleColors = [
    ['rgba(255, 199, 123, .34)', 'rgba(255, 205, 132, .47)', 'rgba(255, 222, 165, .62)'],
    ['rgba(225, 220, 207, .26)', 'rgba(235, 232, 221, .4)', 'rgba(247, 242, 226, .56)'],
    ['rgba(188, 208, 239, .25)', 'rgba(200, 220, 248, .42)', 'rgba(220, 235, 255, .58)'],
    ['rgba(91, 183, 231, .35)', 'rgba(103, 202, 245, .54)', 'rgba(144, 222, 255, .72)'],
  ] as const;
  model.particlePaths.forEach((path, index) => {
    const color = Math.floor(index / 3);
    const size = index % 3;
    context.fillStyle = particleColors[color][size];
    context.fill(path);
  });

  context.save();
  context.lineCap = 'round';
  model.measuredSegments.forEach((segment, index) => {
    const hues = [
      'rgba(222, 174, 113, .52)',
      'rgba(100, 206, 199, .65)',
      'rgba(104, 178, 229, .68)',
      'rgba(169, 145, 224, .62)',
      'rgba(100, 222, 213, .8)',
      'rgba(197, 205, 231, .65)',
      'rgba(121, 159, 221, .56)',
    ];
    context.strokeStyle = hues[index];
    context.lineWidth = segment.width;
    context.stroke(segment.path);
  });
  context.restore();

  drawGlow(context, centerX, centerY, 12, 'rgba(255, 198, 116, .48)');
  context.fillStyle = '#f4c27e';
  context.beginPath();
  context.arc(centerX, centerY, 2.7, 0, TAU);
  context.fill();
  context.fillStyle = 'rgba(233, 217, 192, .78)';
  context.font = '500 8px ui-monospace, SFMono-Regular, Menlo, monospace';
  context.textAlign = 'center';
  context.fillText('SAGITTARIUS A*', centerX, centerY - 13);
  context.textAlign = 'start';

  for (const segment of model.measuredSegments) {
    if (segment.key !== 'local') continue;
    context.fillStyle = 'rgba(116, 226, 214, .88)';
    context.font = '500 7px ui-monospace, SFMono-Regular, Menlo, monospace';
    context.fillText(segment.name.toUpperCase(), segment.label.x + 4, segment.label.y - 3);
  }
}

function galaxyStaticSurface(
  width: number,
  height: number,
  pixelRatio: number,
  model: GalaxyRenderCache,
): SurfaceCanvas | undefined {
  const boundedPixelRatio = clamp(pixelRatio, 0.55, 2);
  const cacheKey = `${Math.round(width)}:${Math.round(height)}:${boundedPixelRatio.toFixed(2)}`;
  const cached = galaxyStaticSurfaceCache.get(cacheKey);
  if (cached) return cached;
  const surface: SurfaceCanvas = typeof OffscreenCanvas !== 'undefined'
    ? new OffscreenCanvas(
      Math.max(1, Math.round(width * boundedPixelRatio)),
      Math.max(1, Math.round(height * boundedPixelRatio)),
    )
    : Object.assign(document.createElement('canvas'), {
      width: Math.max(1, Math.round(width * boundedPixelRatio)),
      height: Math.max(1, Math.round(height * boundedPixelRatio)),
    });
  const surfaceContext = surface.getContext('2d') as CanvasRenderingContext2D | null;
  if (!surfaceContext) return undefined;
  surfaceContext.setTransform(boundedPixelRatio, 0, 0, boundedPixelRatio, 0, 0);
  drawGalaxyStaticLayer(surfaceContext, width, height, model);
  galaxyStaticSurfaceCache.set(cacheKey, surface);
  if (galaxyStaticSurfaceCache.size > 3) {
    const oldest = galaxyStaticSurfaceCache.keys().next().value;
    if (oldest) galaxyStaticSurfaceCache.delete(oldest);
  }
  return surface;
}

function drawGalaxyScene(frame: CanvasFrame) {
  const { context, width, height, elapsedSeconds, cosmicAgeYears, reducedMotion, pixelRatio } = frame;
  const model = buildGalaxyRenderCache(width, height);
  const { centerX, centerY, radius, pixelsPerKpc } = model;
  const staticSurface = galaxyStaticSurface(width, height, pixelRatio, model);
  if (staticSurface) context.drawImage(staticSurface, 0, 0, width, height);
  else drawGalaxyStaticLayer(context, width, height, model);

  const presentCosmicAgeYears = 13.8e9;
  const sunBirthCosmicAgeYears = presentCosmicAgeYears - 4.567e9;
  const selectedSolarProgress = clamp(
    (cosmicAgeYears - sunBirthCosmicAgeYears) / 4.567e9,
    0,
    1,
  );
  const selectedHistoricalEpoch = Math.abs(cosmicAgeYears - presentCosmicAgeYears) > 1e6;
  const replayCycle = (elapsedSeconds % 22) / 22;
  const replayProgress = selectedHistoricalEpoch
    ? selectedSolarProgress
    : reducedMotion ? 1 : smoothstep(0.035, 0.82, replayCycle);
  const sunExists = cosmicAgeYears >= sunBirthCosmicAgeYears;

  if (sunExists) {
    context.save();
    context.lineCap = 'round';
    for (const batch of model.trailBatches) {
      if (batch.endProgress > replayProgress + 0.022) break;
      if (batch.uncertainty >= 0.99) {
        context.setLineDash([2, 5]);
        context.strokeStyle = 'rgba(76, 155, 157, .11)';
        context.lineWidth = 0.75;
      } else {
        context.setLineDash([]);
        context.strokeStyle = `rgba(91, 224, 212, ${0.22 + (1 - batch.uncertainty) * 0.5})`;
        context.lineWidth = 0.8 + (1 - batch.uncertainty) * 0.75;
      }
      context.stroke(batch.path);
    }
    context.restore();

    const tracerIndex = Math.round(replayProgress * (model.trailPoints.length - 1));
    const tracer = model.trailPoints[tracerIndex];
    if (!selectedHistoricalEpoch && replayProgress < 0.995) {
      context.fillStyle = 'rgba(102, 238, 221, .94)';
      context.beginPath();
      context.arc(tracer.x, tracer.y, 2.2, 0, TAU);
      context.fill();
    }

    const markerProgress = selectedHistoricalEpoch ? selectedSolarProgress : 1;
    const markerModel = solarGalacticPositionAtProgress(markerProgress);
    const marker = projectGalaxyPoint(markerModel, centerX, centerY, pixelsPerKpc);
    drawGlow(context, marker.x, marker.y, 6.5, 'rgba(255, 209, 103, .7)');
    context.fillStyle = '#ffe1a0';
    context.beginPath();
    context.arc(marker.x, marker.y, 3.1, 0, TAU);
    context.fill();
    context.fillStyle = 'rgba(255, 226, 163, .9)';
    context.font = '600 8px ui-monospace, SFMono-Regular, Menlo, monospace';
    context.textAlign = 'right';
    context.fillText(
      selectedHistoricalEpoch ? 'SUN · SELECTED EPOCH' : 'SUN · NOW',
      marker.x - 7,
      marker.y + 10,
    );
    context.textAlign = 'start';
  }

  const loops = 4_567 / SUN_GALACTIC_ORBIT_PERIOD_MILLION_YEARS;
  const infoY = height - 151;
  roundedRect(context, 18, infoY, Math.min(440, width - 36), 83, 12);
  context.fillStyle = 'rgba(4, 7, 18, .78)';
  context.fill();
  context.fillStyle = '#b5c5da';
  const compactInfo = width < 560;
  context.font = `500 ${compactInfo ? 8 : 9}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  const infoLines = compactInfo
    ? [
      `BAR ${GALACTIC_BAR_HALF_LENGTH_KPC.toFixed(1)} KPC · ${GALACTIC_BAR_ANGLE_DEGREES}° · 4-ARM GUIDE ≈${GALACTIC_MEAN_ARM_PITCH_DEGREES}°`,
      `SUN R ${GALACTIC_CENTER_DISTANCE_KPC.toFixed(3)} KPC · Z +${SUN_HEIGHT_ABOVE_GALACTIC_PLANE_PC.toFixed(1)} PC · ≈${loops.toFixed(1)} ORBITS`,
      `PERIODS ${SUN_GALACTIC_ORBIT_PERIOD_MILLION_YEARS} / ${SUN_GALACTIC_EPICYCLE_PERIOD_MILLION_YEARS} / ${SUN_VERTICAL_OSCILLATION_PERIOD_MILLION_YEARS} MYR`,
      `SOLID = MASER DATA · DASHED >${SUN_GALACTIC_ORBIT_PREDICTABILITY_MILLION_YEARS / 1_000} GYR`,
    ]
    : [
      `BAR · ${GALACTIC_BAR_HALF_LENGTH_KPC.toFixed(1)} KPC HALF-LENGTH · ${GALACTIC_BAR_ANGLE_DEGREES}° · 4 ARMS ≈ ${GALACTIC_MEAN_ARM_PITCH_DEGREES}°`,
      `SUN · R ${GALACTIC_CENTER_DISTANCE_KPC.toFixed(3)} KPC · Z +${SUN_HEIGHT_ABOVE_GALACTIC_PLANE_PC.toFixed(1)} PC · ≈ ${loops.toFixed(1)} ORBITS`,
      `MEAN PERIODS · AZ ${SUN_GALACTIC_ORBIT_PERIOD_MILLION_YEARS} · RADIAL ${SUN_GALACTIC_EPICYCLE_PERIOD_MILLION_YEARS} · VERTICAL ${SUN_VERTICAL_OSCILLATION_PERIOD_MILLION_YEARS} MYR`,
      `MASER SEGMENTS SOLID · 4-ARM GUIDE EXTRAPOLATED · REPLAY >${SUN_GALACTIC_ORBIT_PREDICTABILITY_MILLION_YEARS / 1_000} GYR DASHED`,
    ];
  infoLines.forEach((line, index) => context.fillText(line, 30, infoY + 20 + index * 17));

  if (cosmicAgeYears < 2e8) {
    context.fillStyle = 'rgba(2, 4, 12, .84)';
    context.fillRect(0, 0, width, height);
    context.fillStyle = '#d8dfea';
    context.textAlign = 'center';
    context.font = '400 22px Georgia, Times New Roman, serif';
    context.fillText('The Milky Way has not assembled yet.', width * 0.5, height * 0.48);
    context.textAlign = 'start';
  }
}

function drawUniverseScene(frame: CanvasFrame) {
  const { context, width, height, elapsedSeconds, cosmicAgeYears } = frame;
  const centerX = width * 0.46;
  const centerY = height * 0.5;
  const maxRadius = Math.min(width, height) * 0.56;
  const background = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, maxRadius);
  background.addColorStop(0, '#1b1433');
  background.addColorStop(0.45, '#080b1c');
  background.addColorStop(1, '#02030a');
  context.fillStyle = background;
  context.fillRect(0, 0, width, height);
  drawStars(context, width, height, elapsedSeconds);

  for (let ring = 1; ring <= 7; ring += 1) {
    context.strokeStyle = `rgba(132, 157, 218, ${0.19 - ring * 0.015})`;
    context.lineWidth = 1;
    context.beginPath();
    context.ellipse(centerX, centerY, maxRadius * ring / 7, maxRadius * 0.52 * ring / 7, -0.15, 0, TAU);
    context.stroke();
  }

  const attractorX = width * 0.78;
  const attractorY = height * 0.34;
  drawGlow(context, attractorX, attractorY, 26, 'rgba(199, 111, 199, .42)');
  context.fillStyle = '#d8a3d5';
  context.beginPath();
  context.arc(attractorX, attractorY, 5, 0, TAU);
  context.fill();
  context.fillStyle = '#d8c1dd';
  context.font = '600 10px ui-monospace, SFMono-Regular, Menlo, monospace';
  context.fillText('GREAT ATTRACTOR REGION', attractorX + 12, attractorY - 7);

  context.save();
  context.strokeStyle = 'rgba(122, 209, 210, .38)';
  context.lineWidth = 1.2;
  for (let stream = 0; stream < 26; stream += 1) {
    const startX = hashUnit(`flow-x-${stream}`) * width;
    const startY = hashUnit(`flow-y-${stream}`) * height;
    const bend = (hashUnit(`flow-b-${stream}`) - 0.5) * height * 0.35;
    context.beginPath();
    context.moveTo(startX, startY);
    context.bezierCurveTo(
      startX + (attractorX - startX) * 0.38,
      startY + bend,
      attractorX - width * 0.1,
      attractorY - bend * 0.2,
      attractorX,
      attractorY,
    );
    context.stroke();
  }
  context.restore();

  const ageLog = Math.log10(Math.max(cosmicAgeYears, 1e-36));
  const nowLog = Math.log10(13.8e9);
  const expansion = clamp((ageLog + 36) / (nowLog + 36), 0.015, 1);
  const trailEndX = centerX + (attractorX - centerX) * expansion;
  const trailEndY = centerY + (attractorY - centerY) * expansion;
  context.strokeStyle = '#f0c97a';
  context.lineWidth = 2.2;
  context.beginPath();
  context.moveTo(centerX, centerY);
  context.bezierCurveTo(centerX + width * 0.08, centerY + height * 0.1, trailEndX - width * 0.08, trailEndY + height * 0.08, trailEndX, trailEndY);
  context.stroke();
  drawGlow(context, trailEndX, trailEndY, 7, 'rgba(255, 205, 116, .7)');
  context.fillStyle = '#ffdda0';
  context.beginPath();
  context.arc(trailEndX, trailEndY, 3.5, 0, TAU);
  context.fill();

  roundedRect(context, 18, height - 62, Math.min(440, width - 36), 42, 11);
  context.fillStyle = 'rgba(4, 7, 18, .76)';
  context.fill();
  context.fillStyle = '#aab9cf';
  context.font = '500 10px ui-monospace, SFMono-Regular, Menlo, monospace';
  context.fillText('FLOW FIELD · LANIĀKEA RECONSTRUCTION · NOT A UNIQUE BIG-BANG WORLDLINE', 30, height - 37);
  context.fillText('COSMIC EXPANSION IS SHOWN IN COMOVING COORDINATES', 30, height - 23);
}

const sceneRenderers = [drawHorizonScene, drawSolarScene, drawGalaxyScene, drawUniverseScene] as const;

export function renderCosmicFrame(frame: CanvasFrame): void {
  const { context, width, height, scalePosition } = frame;
  context.clearRect(0, 0, width, height);
  const lower = Math.floor(clamp(scalePosition, 0, 3));
  const upper = Math.ceil(clamp(scalePosition, 0, 3));
  const fraction = clamp(scalePosition - lower, 0, 1);
  const drawScene = (index: number, alpha: number, scale: number) => {
    context.save();
    context.globalAlpha = alpha;
    context.translate(width / 2, height / 2);
    context.scale(scale, scale);
    context.translate(-width / 2, -height / 2);
    sceneRenderers[index](frame);
    context.restore();
  };
  if (lower === upper) {
    drawScene(lower, 1, 1);
  } else {
    drawScene(lower, 1 - fraction, 1 + fraction * 0.08);
    drawScene(upper, fraction, 0.92 + fraction * 0.08);
  }
  const vignette = context.createRadialGradient(width * 0.5, height * 0.48, height * 0.2, width * 0.5, height * 0.5, Math.max(width, height) * 0.7);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,.56)');
  context.fillStyle = vignette;
  context.fillRect(0, 0, width, height);
}
