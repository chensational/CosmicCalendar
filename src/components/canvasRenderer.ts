import {
  GALACTIC_CENTER_DISTANCE_KPC,
  SUN_GALACTIC_ORBIT_PERIOD_MILLION_YEARS,
  SUN_HEIGHT_ABOVE_GALACTIC_PLANE_PC,
  SUN_VERTICAL_OSCILLATION_PERIOD_MILLION_YEARS,
} from '../core/constants';
import { clamp, greatCircleBearingRadians, hashUnit, normalizeDegrees, smoothstep } from '../core/math';
import { eclipticSphericalToCartesian, orbitalPositionAtTrueAnomaly } from '../core/orbits';
import type {
  CartesianPosition,
  HorizontalPosition,
  HorizonSnapshot,
  LunarHorizonSnapshot,
  SolarSystemSnapshot,
} from '../core/types';

export interface CanvasFrame {
  context: CanvasRenderingContext2D;
  width: number;
  height: number;
  scalePosition: number;
  elapsedSeconds: number;
  realtimeOffsetSeconds: number;
  horizon: HorizonSnapshot;
  lunar: LunarHorizonSnapshot;
  solar: SolarSystemSnapshot;
  cosmicAgeYears: number;
  reducedMotion: boolean;
}

const TAU = Math.PI * 2;
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

function drawHorizonScene(frame: CanvasFrame) {
  const { context, width, height, horizon, lunar, elapsedSeconds, realtimeOffsetSeconds, cosmicAgeYears } = frame;
  const earthFormationAge = 13.8e9 - 4.54e9;
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
  drawStars(context, width, height * 0.74, elapsedSeconds, frame.reducedMotion ? 0 : 0.12);
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
  drawGlow(context, sun.x, sun.y, 18, 'rgba(255, 205, 112, .76)', daylight);
  context.fillStyle = redGiantProgress > 0.05 ? '#df6a42' : '#ffd986';
  context.beginPath();
  context.arc(sun.x, sun.y, 7 + daylight * 4 + redGiantProgress * Math.min(width, height) * 0.055, 0, TAU);
  context.fill();

  const moon = skyPoint(width, height, animatedMoon);
  drawGlow(context, moon.x, moon.y, 11, 'rgba(182, 208, 255, .38)', 1);
  const sunBearingFromMoon = greatCircleBearingRadians(
    animatedMoon.azimuthDegrees,
    animatedMoon.altitudeDegrees,
    animatedSun.azimuthDegrees,
    animatedSun.altitudeDegrees,
  );
  const canonicalBrightSide = horizon.moon.phaseAngleDegrees <= 180 ? 0 : Math.PI;
  drawPhaseDisc(
    context,
    moon.x,
    moon.y,
    9,
    '#dce4eb',
    horizon.moon.phaseAngleDegrees,
    sunBearingFromMoon - Math.PI / 2 - canonicalBrightSide,
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

function projectSolarVector(
  vector: CartesianPosition,
  centerX: number,
  centerY: number,
  orbitScale: (distanceAu: number) => number,
) {
  const distance = Math.hypot(vector.x, vector.y, vector.z) || 1;
  const radius = orbitScale(distance);
  const cameraRotation = -0.12;
  const rotatedX = vector.x * Math.cos(cameraRotation) - vector.y * Math.sin(cameraRotation);
  const rotatedY = vector.x * Math.sin(cameraRotation) + vector.y * Math.cos(cameraRotation);
  return {
    x: centerX + rotatedX / distance * radius,
    y: centerY + (rotatedY * 0.48 - vector.z * 0.72) / distance * radius,
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

function drawWrappedSpot(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  offset: number,
  color: string,
) {
  for (const wrap of [-2, 0, 2]) {
    context.fillStyle = color;
    context.beginPath();
    context.ellipse(x + offset + wrap * radius, y, radius * 0.32, radius * 0.2, -0.25, 0, TAU);
    context.fill();
  }
}

function drawSurfaceFeatures(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  name: string,
  spin: number,
) {
  const offset = ((spin % 360) / 360 - 0.5) * radius * 2;
  context.save();
  context.globalAlpha = 0.62;
  if (name === 'Earth') {
    drawWrappedSpot(context, x - radius * 0.2, y - radius * 0.2, radius, offset, '#75a97e');
    drawWrappedSpot(context, x + radius * 0.25, y + radius * 0.24, radius * 0.72, offset * 0.7, '#668f68');
    context.fillStyle = 'rgba(245,250,255,.75)';
    context.fillRect(x - radius, y - radius, radius * 2, radius * 0.14);
  } else if (name === 'Jupiter' || name === 'Saturn') {
    const tones = name === 'Jupiter' ? ['#865943', '#f0d4ad', '#b77d61', '#ead0aa'] : ['#a88f60', '#eee0b7', '#bca36f'];
    tones.forEach((tone, index) => {
      context.fillStyle = tone;
      context.fillRect(x - radius, y - radius + (index + 0.6) * radius * 2 / tones.length, radius * 2, radius * 0.18);
    });
    if (name === 'Jupiter') drawWrappedSpot(context, x, y + radius * 0.38, radius * 0.65, offset, '#9f3f2e');
  } else if (name === 'Mars') {
    drawWrappedSpot(context, x, y + radius * 0.05, radius, offset, '#603327');
    context.fillStyle = '#f0ddd1';
    context.fillRect(x - radius * 0.5, y - radius, radius, radius * 0.13);
  } else if (name === 'Mercury') {
    for (let index = 0; index < 7; index += 1) {
      const angle = hashUnit(`mercury-crater-${index}`) * TAU;
      const distance = hashUnit(`mercury-distance-${index}`) * radius * 0.7;
      context.fillStyle = index % 2 ? '#6f6860' : '#d0c6ba';
      context.beginPath();
      context.arc(x + Math.cos(angle) * distance + offset * 0.2, y + Math.sin(angle) * distance, radius * 0.09, 0, TAU);
      context.fill();
    }
  } else if (name === 'Venus') {
    context.strokeStyle = '#fff0bd';
    context.lineWidth = Math.max(0.7, radius * 0.1);
    for (let band = -2; band <= 2; band += 1) {
      context.beginPath();
      context.moveTo(x - radius, y + band * radius * 0.3);
      context.bezierCurveTo(x - radius * 0.2, y + band * radius * 0.18 + offset * 0.08, x + radius * 0.3, y + band * radius * 0.38, x + radius, y + band * radius * 0.22);
      context.stroke();
    }
  } else if (name === 'Neptune' || name === 'Uranus') {
    context.strokeStyle = name === 'Neptune' ? '#a8c4f5' : '#d7f6ef';
    context.lineWidth = Math.max(0.6, radius * 0.08);
    for (let band = -2; band <= 2; band += 1) {
      context.beginPath();
      context.moveTo(x - radius, y + band * radius * 0.3);
      context.lineTo(x + radius, y + band * radius * 0.3);
      context.stroke();
    }
    if (name === 'Neptune') drawWrappedSpot(context, x, y + radius * 0.18, radius * 0.55, offset, '#1b2d6e');
  } else if (name === 'Pluto') {
    drawWrappedSpot(context, x, y, radius * 0.8, offset, '#eee4d5');
  }
  context.restore();
}

function drawPlanetSurface(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  name: string,
  spin: number,
  lightAngle: number,
) {
  context.save();
  context.beginPath();
  context.arc(x, y, radius, 0, TAU);
  context.clip();
  const base = context.createRadialGradient(x - radius * 0.3, y - radius * 0.32, radius * 0.08, x, y, radius);
  base.addColorStop(0, '#fff');
  base.addColorStop(0.18, color);
  base.addColorStop(1, color);
  context.fillStyle = base;
  context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  drawSurfaceFeatures(context, x, y, radius, name, spin);
  const lightX = Math.cos(lightAngle);
  const lightY = Math.sin(lightAngle);
  const shadow = context.createLinearGradient(
    x + lightX * radius,
    y + lightY * radius,
    x - lightX * radius,
    y - lightY * radius,
  );
  shadow.addColorStop(0, 'rgba(0,0,0,0)');
  shadow.addColorStop(0.45, 'rgba(0,0,0,.08)');
  shadow.addColorStop(0.57, 'rgba(0,0,0,.54)');
  shadow.addColorStop(1, 'rgba(0,0,0,.9)');
  context.fillStyle = shadow;
  context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  context.restore();
  context.strokeStyle = 'rgba(255,255,255,.24)';
  context.lineWidth = 0.8;
  context.beginPath();
  context.arc(x, y, radius, 0, TAU);
  context.stroke();
}

function drawSolarScene(frame: CanvasFrame) {
  const { context, width, height, solar, elapsedSeconds, realtimeOffsetSeconds } = frame;
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

  const planetScreen = new Map<string, { x: number; y: number; radius: number }>();
  solar.planets.forEach((planet) => {
    context.strokeStyle = planet.key === 'mercury' ? 'rgba(230, 193, 143, .34)' : 'rgba(184, 200, 229, .12)';
    context.lineWidth = planet.key === 'mercury' ? 1.2 : 0.8;
    const path = orbitPaths.get(planet.key);
    if (path) context.stroke(path);
  });

  drawGlow(context, centerX, centerY, 24, 'rgba(255, 184, 73, .75)');
  const sunGradient = context.createRadialGradient(centerX - 7, centerY - 9, 2, centerX, centerY, 23);
  sunGradient.addColorStop(0, '#fff5be');
  sunGradient.addColorStop(0.5, '#ffc04a');
  sunGradient.addColorStop(1, '#b9470d');
  context.fillStyle = sunGradient;
  context.beginPath();
  context.arc(centerX, centerY, 19, 0, TAU);
  context.fill();

  solar.planets.forEach((planet) => {
    const eclipticPosition = eclipticSphericalToCartesian(
      planet.distanceAu,
      planet.eclipticLongitudeDegrees,
      planet.eclipticLatitudeDegrees,
    );
    const projected = projectSolarVector(eclipticPosition, centerX, centerY, orbitScale);
    const { x, y } = projected;
    const radius = planetRadius(planet.radiusKm);
    if (planet.name === 'Saturn') {
      context.strokeStyle = 'rgba(227, 213, 165, .7)';
      context.lineWidth = Math.max(1, radius * 0.25);
      context.beginPath();
      const ringOpening = clamp(Math.abs(planet.ringTiltDegrees ?? 12) / 28, 0.18, 0.72);
      context.ellipse(x, y, radius * 1.8, radius * ringOpening, -0.18, 0, TAU);
      context.stroke();
    }
    const physicalSpin = planet.primeMeridianDegrees +
      realtimeOffsetSeconds * 360 / (planet.rotationPeriodHours * 3_600);
    drawPlanetSurface(context, x, y, radius, planet.color, planet.name, physicalSpin, Math.atan2(centerY - y, centerX - x));
    planetScreen.set(planet.key, { x, y, radius });
    context.fillStyle = 'rgba(231, 237, 249, .82)';
    context.font = '500 9px ui-monospace, SFMono-Regular, Menlo, monospace';
    context.fillText(planet.name.toUpperCase(), x + radius + 4, y - radius);
  });

  solar.satellites.forEach((satellite) => {
    const parent = planetScreen.get(satellite.parent);
    if (!parent) return;
    const vectorLength = Math.hypot(
      satellite.relativePositionKm.x,
      satellite.relativePositionKm.y,
      satellite.relativePositionKm.z,
    ) || 1;
    const localRadius = parent.radius + 4 + Math.log10(satellite.semiMajorAxisKm / 8_000 + 1) * 2.6;
    const satelliteX = parent.x + satellite.relativePositionKm.x / vectorLength * localRadius;
    const satelliteY = parent.y + (
      satellite.relativePositionKm.y * 0.58 - satellite.relativePositionKm.z * 0.4
    ) / vectorLength * localRadius;
    const dotRadius = clamp(0.85 + Math.log10(satellite.radiusKm / 5 + 1) * 0.32, 0.9, 2.1);
    context.fillStyle = satellite.sunlit ? '#dde8f5' : '#263044';
    context.beginPath();
    context.arc(satelliteX, satelliteY, dotRadius, 0, TAU);
    context.fill();
  });

  const mercury = solar.planets[0];
  const perihelionAngle = solar.mercuryPerihelionLongitudeDegrees * Math.PI / 180 - 0.12;
  const guide = orbitScale(mercury.distanceAu) + 15;
  context.save();
  context.setLineDash([4, 4]);
  context.strokeStyle = 'rgba(255, 200, 125, .52)';
  context.beginPath();
  context.moveTo(centerX, centerY);
  context.lineTo(centerX + Math.cos(perihelionAngle) * guide, centerY + Math.sin(perihelionAngle) * guide * 0.48);
  context.stroke();
  context.restore();

  const sunlit = solar.satellites.filter((satellite) => satellite.sunlit).length;
  roundedRect(context, 18, height - 64, Math.min(326, width - 36), 44, 11);
  context.fillStyle = 'rgba(4, 7, 18, .74)';
  context.fill();
  context.fillStyle = '#aab9cf';
  context.font = '500 10px ui-monospace, SFMono-Regular, Menlo, monospace';
  context.fillText(`${solar.satellites.length} MAJOR SATELLITES · ${sunlit} SUNLIT · LOCAL ORBITS EXAGGERATED`, 30, height - 40);
  context.fillText(`MERCURY GR EXCESS · ${solar.mercuryRelativisticPrecessionArcsecondsPerCentury.toFixed(2)}″ / CENTURY`, 30, height - 25);
}

function drawGalaxyScene(frame: CanvasFrame) {
  const { context, width, height, elapsedSeconds } = frame;
  const centerX = width * 0.5;
  const centerY = height * 0.5;
  const radius = Math.min(width, height) * 0.4;
  const gradient = context.createRadialGradient(centerX, centerY, 4, centerX, centerY, radius * 1.25);
  gradient.addColorStop(0, '#c9a874');
  gradient.addColorStop(0.08, '#644f48');
  gradient.addColorStop(0.55, '#11152d');
  gradient.addColorStop(1, '#02040c');
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
  drawStars(context, width, height, elapsedSeconds);

  context.save();
  context.translate(centerX, centerY);
  context.rotate(-0.22);
  for (let arm = 0; arm < 4; arm += 1) {
    context.strokeStyle = `rgba(${160 + arm * 12}, ${170 + arm * 8}, 220, .25)`;
    context.lineWidth = radius * 0.055;
    context.shadowColor = 'rgba(102, 132, 215, .35)';
    context.shadowBlur = 18;
    context.beginPath();
    for (let step = 0; step < 180; step += 1) {
      const theta = arm * TAU / 4 + step * 0.055;
      const r = radius * 0.04 * Math.exp(0.155 * theta);
      if (r > radius) break;
      const x = Math.cos(theta) * r;
      const y = Math.sin(theta) * r * 0.46;
      if (step === 0) context.moveTo(x, y); else context.lineTo(x, y);
    }
    context.stroke();
  }
  context.restore();

  drawGlow(context, centerX, centerY, 18, 'rgba(255, 214, 143, .52)');
  const sunOrbitRadius = radius * (GALACTIC_CENTER_DISTANCE_KPC / 14);
  const loops = 4_567 / SUN_GALACTIC_ORBIT_PERIOD_MILLION_YEARS;
  context.save();
  context.translate(centerX, centerY);
  context.rotate(-0.22);
  context.strokeStyle = 'rgba(102, 221, 213, .5)';
  context.lineWidth = 1.3;
  context.beginPath();
  for (let step = 0; step <= 520; step += 1) {
    const progress = step / 520;
    const angle = -loops * TAU * (1 - progress);
    const verticalPhase = progress * 4_567 / SUN_VERTICAL_OSCILLATION_PERIOD_MILLION_YEARS * TAU;
    const bob = Math.sin(verticalPhase) * radius * 0.018;
    const orbitalDrift = sunOrbitRadius * (0.94 + progress * 0.06);
    const x = Math.cos(angle) * orbitalDrift;
    const y = Math.sin(angle) * orbitalDrift * 0.46 + bob;
    if (step === 0) context.moveTo(x, y); else context.lineTo(x, y);
  }
  context.stroke();
  // A 224 Myr Galactic orbit has no honest browser-visible real-time motion.
  // Keep the present marker at the modeled trail endpoint instead of inventing it.
  const sunX = sunOrbitRadius;
  const sunY = -SUN_HEIGHT_ABOVE_GALACTIC_PLANE_PC / 200 * radius * 0.018;
  drawGlow(context, sunX, sunY, 7, 'rgba(255, 209, 103, .72)');
  context.fillStyle = '#ffe1a0';
  context.beginPath();
  context.arc(sunX, sunY, 3.4, 0, TAU);
  context.fill();
  context.restore();

  const infoY = height - 130;
  roundedRect(context, 18, infoY, Math.min(358, width - 36), 62, 12);
  context.fillStyle = 'rgba(4, 7, 18, .72)';
  context.fill();
  context.fillStyle = '#b5c5da';
  context.font = '500 10px ui-monospace, SFMono-Regular, Menlo, monospace';
  context.fillText(`SUN · ${GALACTIC_CENTER_DISTANCE_KPC.toFixed(3)} KPC FROM SAGITTARIUS A*`, 30, infoY + 24);
  context.fillText(`Z ≈ +${SUN_HEIGHT_ABOVE_GALACTIC_PLANE_PC.toFixed(1)} PC · VERTICAL MODEL ≈ ${SUN_VERTICAL_OSCILLATION_PERIOD_MILLION_YEARS} MYR`, 30, infoY + 41);
  context.fillText(`TRAIL · ≈ ${loops.toFixed(1)} GALACTIC ORBITS SINCE SOLAR BIRTH`, 30, infoY + 57);
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
