// sky.js — the golden-hour sky for CANYON RUN.
// One file, one job: gradient dome, low sun, drifting clouds, warm fog
// and the light that makes the sandstone glow at sunset.
// The sun sits low in the west, so the runway approach flies into the sunset.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { mulberry32 } from './random.js';

// A soft round blob, painted on a canvas at runtime: cloud and glow sprites.
function blobTexture(size, stops) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [at, colour] of stops) grad.addColorStop(at, colour);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Build the sky, sun, clouds, fog and lights into the scene.
// Returns an update(dt) that drifts the clouds and shimmers the sun.
export function buildSky(scene, cfg = CONFIG) {
  const sky = cfg.sky;
  const rng = mulberry32(cfg.seed + 31);

  // Gradient dome: burnt orange at the horizon, deep blue-violet overhead.
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(6000, 24, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {},
      vertexShader: `
        varying vec3 vPos;
        void main() {
          vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        varying vec3 vPos;
        void main() {
          float h = normalize(vPos).y;
          vec3 horizon = vec3(1.0, 0.62, 0.32);
          vec3 mid = vec3(0.85, 0.45, 0.35);
          vec3 zenith = vec3(0.16, 0.22, 0.45);
          vec3 col = h < 0.12
            ? mix(horizon, mid, smoothstep(0.0, 0.12, h))
            : mix(mid, zenith, smoothstep(0.12, 0.65, h));
          gl_FragColor = vec4(col, 1.0);
        }`,
    })
  );
  scene.add(dome);

  // Low sun: a bright disc with a wide warm glow around it.
  const sunDir = new THREE.Vector3(
    Math.sin(sky.sunAzimuth) * Math.cos(sky.sunElevation),
    Math.sin(sky.sunElevation),
    -Math.cos(sky.sunAzimuth) * Math.cos(sky.sunElevation)
  );
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(190, 32),
    new THREE.MeshBasicMaterial({ color: 0xffe9b8, fog: false })
  );
  sunDisc.position.copy(sunDir).multiplyScalar(5400);
  sunDisc.lookAt(0, 0, 0);
  scene.add(sunDisc);
  const glowTex = blobTexture(256, [
    [0, 'rgba(255, 214, 140, 0.9)'],
    [0.4, 'rgba(255, 160, 80, 0.35)'],
    [1, 'rgba(255, 140, 60, 0)'],
  ]);
  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, fog: false })
  );
  glow.position.copy(sunDir).multiplyScalar(5300);
  glow.scale.set(2200, 2200, 1);
  scene.add(glow);

  // Clouds: soft sprites drifting slowly across the canyon.
  const cloudTex = blobTexture(256, [
    [0, 'rgba(255, 226, 200, 0.85)'],
    [0.55, 'rgba(255, 200, 170, 0.45)'],
    [1, 'rgba(255, 190, 160, 0)'],
  ]);
  const clouds = [];
  for (let i = 0; i < 24; i++) {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: cloudTex, transparent: true, opacity: 0.45 + rng() * 0.35, depthWrite: false })
    );
    sprite.position.set(-1400 + rng() * 2800, 170 + rng() * 110, -3600 + rng() * 4600);
    const s = 220 + rng() * 320;
    sprite.scale.set(s, s * 0.42, 1);
    sprite.userData.drift = 1.5 + rng() * 2.5;
    scene.add(sprite);
    clouds.push(sprite);
  }

  // Warm haze that swallows the far canyon.
  scene.fog = new THREE.FogExp2(sky.fogColour, sky.fogDensity);

  // Low warm sun plus a soft sky bounce so nothing goes black.
  const sun = new THREE.DirectionalLight(sky.sunColour, sky.sunIntensity);
  sun.position.copy(sunDir).multiplyScalar(1000);
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(sky.hemisphereSky, sky.hemisphereGround, sky.hemisphereIntensity));

  return {
    update(dt) {
      for (const cloud of clouds) {
        cloud.position.x += cloud.userData.drift * dt;
        if (cloud.position.x > 1500) cloud.position.x = -1500;
      }
      glow.material.opacity = 0.92 + Math.sin(performance.now() * 0.0004) * 0.05;
    },
  };
}
