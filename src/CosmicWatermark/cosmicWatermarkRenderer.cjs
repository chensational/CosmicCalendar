const {
  buildConstellationGeometryData,
  createSeededRandom,
} = require('./cosmicWatermarkGeometry.cjs');

function resolveHostSize(host){
  const width = Math.max(1, Math.floor(host?.clientWidth || host?.offsetWidth || 1));
  const height = Math.max(1, Math.floor(host?.clientHeight || host?.offsetHeight || 1));

  return { width, height };
}

function appendRendererCanvas(host, canvas){
  if (!host || !canvas || typeof host.appendChild !== 'function') return;

  canvas.setAttribute?.('aria-hidden', 'true');
  canvas.setAttribute?.('tabindex', '-1');

  if (canvas.style) {
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'none';
  }

  host.appendChild(canvas);
}

function removeRendererCanvas(host, canvas){
  if (!host || !canvas || typeof host.removeChild !== 'function') return;
  if (canvas.parentNode && canvas.parentNode !== host) return;

  try {
    host.removeChild(canvas);
  } catch (_error) {
    // Canvas cleanup is best-effort because browser extensions can detach nodes.
  }
}

function applyGroupScale(group, preset){
  const baseScale = Number(preset?.scale) || 1;
  const stretch = preset?.fitMode === 'stretch'
    ? preset.stretch || { x: 1, y: 1, z: 1 }
    : { x: 1, y: 1, z: 1 };
  const scale = {
    x: baseScale * (Number(stretch.x) || 1),
    y: baseScale * (Number(stretch.y) || 1),
    z: baseScale * (Number(stretch.z) || 1),
  };

  if (typeof group.scale?.set === 'function') {
    group.scale.set(scale.x, scale.y, scale.z);
    return scale;
  }

  if (typeof group.scale?.setScalar === 'function' && scale.x === scale.y && scale.y === scale.z) {
    group.scale.setScalar(scale.x);
  } else if (group.scale) {
    group.scale.x = scale.x;
    group.scale.y = scale.y;
    group.scale.z = scale.z;
  }

  return scale;
}

function setVector3(vector, x, y, z){
  if (typeof vector?.set === 'function') {
    vector.set(x, y, z);
    return;
  }

  if (!vector) return;
  vector.x = x;
  vector.y = y;
  vector.z = z;
}

function createCameraOrbit(preset){
  const fallbackRandom = createSeededRandom(`${preset?.seed || preset?.key || 'apollo'}:camera`);
  const random = typeof Math.random === 'function' ? Math.random : fallbackRandom;

  return {
    azimuthSpeed: Number(preset?.cameraOrbitSpeed) || 0,
    polarSpeed: Number(preset?.cameraOrbitPolarSpeed) || 0,
    radius: Number(preset?.cameraOrbitRadius) || 8.5,
    startAzimuth: random() * Math.PI * 2,
    startPolarPhase: random() * Math.PI * 2,
    target: { x: 0, y: 0, z: 0 },
  };
}

function updateCameraOrbit(camera, orbit, elapsedSeconds){
  const elapsed = Number(elapsedSeconds) || 0;
  const azimuth = orbit.startAzimuth + elapsed * orbit.azimuthSpeed;
  const polar = Math.PI * 0.5 +
    Math.sin(orbit.startPolarPhase + elapsed * orbit.polarSpeed) * Math.PI * 0.43;
  const sinPolar = Math.sin(polar);
  const position = {
    x: orbit.target.x + orbit.radius * sinPolar * Math.cos(azimuth),
    y: orbit.target.y + orbit.radius * Math.cos(polar),
    z: orbit.target.z + orbit.radius * sinPolar * Math.sin(azimuth),
  };

  setVector3(camera.position, position.x, position.y, position.z);
  camera.lookAt?.(orbit.target.x, orbit.target.y, orbit.target.z);

  return position;
}

function createFilledCircleTexture(THREE){
  if (
    typeof document === 'undefined' ||
    typeof document.createElement !== 'function' ||
    typeof THREE?.CanvasTexture !== 'function'
  ) {
    return null;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext?.('2d');
  if (!context) return null;

  context.clearRect(0, 0, canvas.width, canvas.height);
  const edge = typeof context.createRadialGradient === 'function'
    ? context.createRadialGradient(32, 32, 18, 32, 32, 26)
    : null;
  if (edge) {
    edge.addColorStop(0, 'rgba(255, 255, 255, 1)');
    edge.addColorStop(0.82, 'rgba(255, 255, 255, 1)');
    edge.addColorStop(1, 'rgba(255, 255, 255, 0)');
  }
  context.beginPath();
  context.arc(32, 32, 24, 0, Math.PI * 2);
  context.fillStyle = edge || '#FBFCFE';
  context.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function resolveStarTone(star){
  const tone = Math.round(Number(star?.tone) || 0);
  return Math.max(0, Math.min(2, tone));
}

function createStarMaterial({ THREE, materials, preset, starTexture, tone }){
  const opacityMultiplier = [0.72, 0.88, 1][tone] || 0.72;
  const starMaterial = new THREE.SpriteMaterial({
    color: preset.starColor,
    map: starTexture || null,
    transparent: true,
    opacity: Math.max(0, Math.min(1, preset.starOpacity * opacityMultiplier)),
    depthTest: false,
    depthWrite: false,
    alphaTest: starTexture ? 0.08 : 0,
  });

  materials.push(starMaterial);
  return starMaterial;
}

function resolveStars(geometryData, preset){
  if (Array.isArray(geometryData?.stars) && geometryData.stars.length > 0) {
    return geometryData.stars;
  }

  const starPositions = Array.from(geometryData?.starPositions || []);
  const starSizes = Array.from(geometryData?.starSizes || []);
  const fallbackSize = Number(preset?.starSize) || 0.058;
  const stars = [];

  for (let index = 0; index < starPositions.length; index += 3) {
    stars.push({
      x: starPositions[index],
      y: starPositions[index + 1],
      z: starPositions[index + 2],
      size: Number(starSizes[index / 3]) || fallbackSize,
    });
  }

  return stars;
}

function addStarSprites({
  THREE,
  geometryData,
  group,
  materials,
  preset,
  textures,
}){
  const stars = resolveStars(geometryData, preset);

  if (typeof THREE.Sprite === 'function' && typeof THREE.SpriteMaterial === 'function') {
    const starTexture = createFilledCircleTexture(THREE);
    if (starTexture) textures.push(starTexture);
    const starMaterialsByTone = new Map();
    const getStarMaterial = (tone) => {
      if (!starMaterialsByTone.has(tone)) {
        starMaterialsByTone.set(tone, createStarMaterial({
          THREE,
          materials,
          preset,
          starTexture,
          tone,
        }));
      }

      return starMaterialsByTone.get(tone);
    };

    stars.forEach((star) => {
      const tone = resolveStarTone(star);
      const starMaterial = getStarMaterial(tone);
      const sprite = new THREE.Sprite(starMaterial);
      const size = Math.max(0.006, Number(star.size) || Number(preset.starSize) || 0.058);

      sprite.position?.set?.(star.x, star.y, star.z);
      if (!sprite.position?.set && sprite.position) {
        sprite.position.x = star.x;
        sprite.position.y = star.y;
        sprite.position.z = star.z;
      }
      sprite.scale?.set?.(size, size, size);
      if (!sprite.scale?.set && sprite.scale) {
        sprite.scale.x = size;
        sprite.scale.y = size;
        sprite.scale.z = size;
      }
      sprite.renderOrder = 2 + tone * 0.01;
      group.add(sprite);
    });

    return;
  }

  const starGeometry = new THREE.BufferGeometry();
  const starPositionAttribute = new THREE.BufferAttribute(
    Float32Array.from(geometryData.starPositions),
    3
  );
  starGeometry.setAttribute('position', starPositionAttribute);
  const starMaterial = new THREE.PointsMaterial({
    color: preset.starColor,
    size: preset.starSize,
    sizeAttenuation: true,
    transparent: true,
    opacity: preset.starOpacity,
    depthTest: false,
    depthWrite: false,
  });
  const starPoints = new THREE.Points(starGeometry, starMaterial);
  starPoints.renderOrder = 2;
  materials.push(starMaterial);
  group.add(starPoints);
  return starGeometry;
}

function createCosmicWatermarkScene({
  THREE,
  host,
  preset,
  pixelRatio = 1,
  geometryData = buildConstellationGeometryData(preset),
}){
  if (!THREE || !host || !preset) {
    throw new Error('Cosmic watermark scene requires THREE, host, and preset.');
  }

  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: false,
    powerPreference: 'low-power',
  });
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  const group = new THREE.Group();
  const geometries = [];
  const materials = [];
  const cameraOrbit = createCameraOrbit(preset);

  renderer.setClearColor?.(0x000000, 0);
  renderer.setPixelRatio?.(Math.max(1, Math.min(1.5, Number(pixelRatio) || 1)));
  appendRendererCanvas(host, renderer.domElement);

  updateCameraOrbit(camera, cameraOrbit, 0);

  const lineGeometry = new THREE.BufferGeometry();
  const linePositionAttribute = new THREE.BufferAttribute(
    Float32Array.from(geometryData.linePositions),
    3
  );
  lineGeometry.setAttribute('position', linePositionAttribute);
  const lineMaterial = new THREE.LineBasicMaterial({
    color: preset.lineColor,
    transparent: true,
    opacity: preset.lineOpacity,
    depthTest: false,
    depthWrite: false,
  });
  const lines = new THREE.LineSegments(lineGeometry, lineMaterial);
  lines.renderOrder = 1;
  geometries.push(lineGeometry);
  materials.push(lineMaterial);
  group.add(lines);

  const textures = [];
  const starGeometry = addStarSprites({
    THREE,
    geometryData,
    group,
    materials,
    preset,
    textures,
  });
  if (starGeometry) geometries.push(starGeometry);

  group.rotation.x = preset.rotation.x;
  group.rotation.y = preset.rotation.y;
  group.rotation.z = preset.rotation.z;
  group.position.x = preset.position.x;
  group.position.y = preset.position.y;
  group.position.z = preset.position.z;
  applyGroupScale(group, preset);

  scene.add(group);

  const resize = () => {
    const { width, height } = resolveHostSize(host);
    camera.aspect = width / height;
    camera.updateProjectionMatrix?.();
    renderer.setSize?.(width, height, false);
    return { width, height };
  };

  const updateRotation = (elapsedSeconds) => {
    const elapsed = Number(elapsedSeconds) || 0;
    group.rotation.x = preset.rotation.x + elapsed * preset.rotationSpeed.x;
    group.rotation.y = preset.rotation.y + elapsed * preset.rotationSpeed.y;
    group.rotation.z = preset.rotation.z + elapsed * preset.rotationSpeed.z;
    updateCameraOrbit(camera, cameraOrbit, elapsed);
  };

  const render = () => {
    renderer.render?.(scene, camera);
  };

  const dispose = () => {
    geometries.forEach((geometry) => geometry.dispose?.());
    materials.forEach((material) => material.dispose?.());
    textures.forEach((texture) => texture.dispose?.());
    renderer.dispose?.();
    renderer.forceContextLoss?.();
    removeRendererCanvas(host, renderer.domElement);
  };

  resize();

  return {
    camera,
    cameraOrbit,
    dispose,
    group,
    render,
    resize,
    renderer,
    scene,
    updateRotation,
  };
}

module.exports = {
  applyGroupScale,
  createCameraOrbit,
  createCosmicWatermarkScene,
  createFilledCircleTexture,
  resolveHostSize,
  updateCameraOrbit,
};
