import {
  GALACTIC_CENTER_DISTANCE_KPC,
  SUN_GALACTIC_ORBIT_PERIOD_MILLION_YEARS,
  SUN_HEIGHT_ABOVE_GALACTIC_PLANE_PC,
  SUN_VERTICAL_OSCILLATION_PERIOD_MILLION_YEARS,
} from '../core/constants';
import { clamp, hashUnit } from '../core/math';
import type {
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
  horizon: HorizonSnapshot;
  lunar: LunarHorizonSnapshot;
  solar: SolarSystemSnapshot;
  cosmicAgeYears: number;
  reducedMotion: boolean;
}

const TAU = Math.PI * 2;

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

function drawStars(context: CanvasRenderingContext2D, width: number, height: number, elapsed: number) {
  context.save();
  for (let index = 0; index < 170; index += 1) {
    const x = hashUnit(`star-x-${index}`) * width;
    const y = hashUnit(`star-y-${index}`) * height;
    const radius = 0.35 + hashUnit(`star-r-${index}`) * 1.25;
    const pulse = 0.42 + 0.35 * Math.sin(elapsed * (0.2 + hashUnit(`star-p-${index}`)) + index);
    context.fillStyle = `rgba(229, 237, 255, ${clamp(pulse, 0.12, 0.82)})`;
    context.beginPath();
    context.arc(x, y, radius, 0, TAU);
    context.fill();
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
  illuminatedFraction: number,
  rotation = 0,
) {
  context.save();
  context.translate(x, y);
  context.rotate(rotation);
  context.beginPath();
  context.arc(0, 0, radius, 0, TAU);
  context.clip();
  const gradient = context.createRadialGradient(-radius * 0.35, -radius * 0.3, radius * 0.08, 0, 0, radius);
  gradient.addColorStop(0, '#fff');
  gradient.addColorStop(0.32, color);
  gradient.addColorStop(1, '#17213b');
  context.fillStyle = gradient;
  context.fillRect(-radius, -radius, radius * 2, radius * 2);
  const terminator = (illuminatedFraction * 2 - 1) * radius;
  context.fillStyle = 'rgba(1, 4, 14, 0.88)';
  context.beginPath();
  context.ellipse(terminator, 0, radius, radius * 1.04, 0, 0, TAU);
  context.fill();
  context.restore();
  context.save();
  context.strokeStyle = 'rgba(255,255,255,.28)';
  context.lineWidth = 1;
  context.beginPath();
  context.arc(x, y, radius, 0, TAU);
  context.stroke();
  context.restore();
}

function skyPoint(width: number, height: number, altitude: number, azimuth: number) {
  const horizonY = height * 0.72;
  return {
    x: (azimuth / 360) * width,
    y: horizonY - altitude / 90 * height * 0.62,
  };
}

function drawHorizonScene(frame: CanvasFrame) {
  const { context, width, height, horizon, lunar, elapsedSeconds, cosmicAgeYears } = frame;
  const earthFormationAge = 13.8e9 - 4.54e9;
  const redGiantProgress = clamp((cosmicAgeYears - (13.8e9 + 4.5e9)) / 8e8, 0, 1);
  const postEarthProgress = clamp((cosmicAgeYears - (13.8e9 + 7.5e9)) / 1e9, 0, 1);
  const sunHeight = horizon.sun.altitudeDegrees;
  const daylight = clamp((sunHeight + 18) / 24, 0, 1);
  const sky = context.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, daylight > 0.2 ? '#183d67' : '#020512');
  sky.addColorStop(0.7, daylight > 0.15 ? '#b56b58' : '#11162c');
  sky.addColorStop(1, '#080917');
  context.fillStyle = sky;
  context.fillRect(0, 0, width, height);
  context.save();
  context.globalAlpha = 1 - daylight * 0.82;
  drawStars(context, width, height * 0.74, elapsedSeconds);
  context.restore();

  context.save();
  context.strokeStyle = 'rgba(169, 194, 230, .32)';
  context.lineWidth = Math.max(7, height * 0.018);
  context.shadowColor = 'rgba(125, 155, 215, .55)';
  context.shadowBlur = 22;
  context.beginPath();
  let started = false;
  let previousX = 0;
  horizon.milkyWay.forEach((point) => {
    const projected = skyPoint(width, height, point.altitudeDegrees, point.azimuthDegrees);
    if (!started || Math.abs(projected.x - previousX) > width * 0.3) {
      context.moveTo(projected.x, projected.y);
      started = true;
    } else {
      context.lineTo(projected.x, projected.y);
    }
    previousX = projected.x;
  });
  context.stroke();
  context.restore();

  const sun = skyPoint(width, height, horizon.sun.altitudeDegrees, horizon.sun.azimuthDegrees);
  drawGlow(context, sun.x, sun.y, 18, 'rgba(255, 205, 112, .76)', daylight);
  context.fillStyle = redGiantProgress > 0.05 ? '#df6a42' : '#ffd986';
  context.beginPath();
  context.arc(sun.x, sun.y, 7 + daylight * 4 + redGiantProgress * Math.min(width, height) * 0.055, 0, TAU);
  context.fill();

  const moon = skyPoint(width, height, horizon.moon.altitudeDegrees, horizon.moon.azimuthDegrees);
  drawGlow(context, moon.x, moon.y, 11, 'rgba(182, 208, 255, .38)', 1);
  drawPhaseDisc(context, moon.x, moon.y, 9, '#dce4eb', horizon.moon.illuminatedFraction, 0.2);

  const core = skyPoint(width, height, horizon.galacticCenter.altitudeDegrees, horizon.galacticCenter.azimuthDegrees);
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
  const earthX = insetX + 16 + lunar.earth.azimuthDegrees / 360 * (lunarInsetWidth - 32);
  const earthY = lunarHorizonY - lunar.earth.altitudeDegrees / 90 * 47;
  drawGlow(context, earthX, earthY, 9, 'rgba(82, 151, 238, .4)');
  drawPhaseDisc(context, earthX, earthY, 8, '#4b91ca', 0.72, -0.2);
}

function planetRadius(radiusKm: number): number {
  return clamp(2.4 + Math.log10(radiusKm / 700 + 1) * 3.8, 2.6, 14);
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
  const { context, width, height, solar, elapsedSeconds } = frame;
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

  const planetScreen = new Map<string, { x: number; y: number; radius: number }>();
  solar.planets.forEach((planet) => {
    const orbit = orbitScale(planet.distanceAu);
    context.strokeStyle = planet.key === 'mercury' ? 'rgba(230, 193, 143, .34)' : 'rgba(184, 200, 229, .12)';
    context.lineWidth = planet.key === 'mercury' ? 1.2 : 0.8;
    context.beginPath();
    context.ellipse(centerX, centerY, orbit, orbit * 0.48, -0.12, 0, TAU);
    context.stroke();
  });

  const sunPulse = frame.reducedMotion ? 0 : Math.sin(elapsedSeconds * 0.7) * 1.4;
  drawGlow(context, centerX, centerY, 24 + sunPulse, 'rgba(255, 184, 73, .75)');
  const sunGradient = context.createRadialGradient(centerX - 7, centerY - 9, 2, centerX, centerY, 23);
  sunGradient.addColorStop(0, '#fff5be');
  sunGradient.addColorStop(0.5, '#ffc04a');
  sunGradient.addColorStop(1, '#b9470d');
  context.fillStyle = sunGradient;
  context.beginPath();
  context.arc(centerX, centerY, 19, 0, TAU);
  context.fill();

  solar.planets.forEach((planet) => {
    const angle = planet.eclipticLongitudeDegrees * Math.PI / 180 - 0.12;
    const orbit = orbitScale(planet.distanceAu);
    const x = centerX + Math.cos(angle) * orbit;
    const y = centerY + Math.sin(angle) * orbit * 0.48;
    const radius = planetRadius(planet.radiusKm);
    if (planet.name === 'Saturn') {
      context.strokeStyle = 'rgba(227, 213, 165, .7)';
      context.lineWidth = Math.max(1, radius * 0.25);
      context.beginPath();
      context.ellipse(x, y, radius * 1.8, radius * 0.5, -0.18, 0, TAU);
      context.stroke();
    }
    drawPlanetSurface(context, x, y, radius, planet.color, planet.name, planet.primeMeridianDegrees, Math.atan2(centerY - y, centerX - x));
    planetScreen.set(planet.key, { x, y, radius });
    context.fillStyle = 'rgba(231, 237, 249, .82)';
    context.font = '500 9px ui-monospace, SFMono-Regular, Menlo, monospace';
    context.fillText(planet.name.toUpperCase(), x + radius + 4, y - radius);
  });

  solar.satellites.forEach((satellite) => {
    const parent = planetScreen.get(satellite.parent);
    if (!parent) return;
    const vectorLength = Math.hypot(satellite.relativePositionKm.x, satellite.relativePositionKm.y) || 1;
    const localRadius = parent.radius + 4 + Math.log10(satellite.semiMajorAxisKm / 8_000 + 1) * 2.6;
    const satelliteX = parent.x + satellite.relativePositionKm.x / vectorLength * localRadius;
    const satelliteY = parent.y + satellite.relativePositionKm.y / vectorLength * localRadius * 0.58;
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
  const liveAngle = frame.reducedMotion ? 0 : elapsedSeconds * 0.012;
  const sunX = Math.cos(liveAngle) * sunOrbitRadius;
  const sunY = Math.sin(liveAngle) * sunOrbitRadius * 0.46;
  drawGlow(context, sunX, sunY, 7, 'rgba(255, 209, 103, .72)');
  context.fillStyle = '#ffe1a0';
  context.beginPath();
  context.arc(sunX, sunY, 3.4, 0, TAU);
  context.fill();
  context.restore();

  roundedRect(context, 18, 18, Math.min(358, width - 36), 62, 12);
  context.fillStyle = 'rgba(4, 7, 18, .72)';
  context.fill();
  context.fillStyle = '#b5c5da';
  context.font = '500 10px ui-monospace, SFMono-Regular, Menlo, monospace';
  context.fillText(`SUN · ${GALACTIC_CENTER_DISTANCE_KPC.toFixed(3)} KPC FROM SAGITTARIUS A*`, 30, 42);
  context.fillText(`Z ≈ +${SUN_HEIGHT_ABOVE_GALACTIC_PLANE_PC.toFixed(1)} PC · VERTICAL MODEL ≈ ${SUN_VERTICAL_OSCILLATION_PERIOD_MILLION_YEARS} MYR`, 30, 59);
  context.fillText(`TRAIL · ≈ ${loops.toFixed(1)} GALACTIC ORBITS SINCE SOLAR BIRTH`, 30, 75);
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
    const pulse = frame.reducedMotion ? 0 : Math.sin(elapsedSeconds * 0.15 + ring) * 3;
    context.strokeStyle = `rgba(132, 157, 218, ${0.19 - ring * 0.015})`;
    context.lineWidth = 1;
    context.beginPath();
    context.ellipse(centerX, centerY, maxRadius * ring / 7 + pulse, maxRadius * 0.52 * ring / 7 + pulse * 0.4, -0.15, 0, TAU);
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
