// terrain.js — the golden-hour desert canyon for CANYON RUN.
// One file, one job: the heightfield, the river, the road, the runway,
// and every rock, cactus and hangar in the valley.
// The strip is flattened into the floor so a rolling jet never snags on noise.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { fractalNoise2D, valueNoise2D, mulberry32 } from './random.js';

// The heightfield spans z -4000..1200, so its centre sits at -1400.
export const TERRAIN_CENTER_Z = -1400;

function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

// The canyon's winding centreline: where the river, the road and the
// ring course all run. Same seed, same meander, every time.
export function centerlineX(z, cfg = CONFIG) {
  const t = cfg.terrain;
  return (
    t.meanderAmp1 * Math.sin(z * t.meanderFreq1) +
    t.meanderAmp2 * Math.sin(z * t.meanderFreq2 + t.meanderPhase2)
  );
}

// Ground height at any point: flat valley floor, steep walls, rolling mesas.
// The runway strip is flattened into the floor near the south end.
export function groundHeight(x, z, cfg = CONFIG) {
  const t = cfg.terrain;
  const d = Math.abs(x - centerlineX(z, cfg));
  const mesa = t.mesaHeight + (fractalNoise2D(x, z, cfg.seed) - 0.5) * 2 * t.mesaNoise;
  const wall = smoothstep(t.valleyHalfWidth, t.valleyHalfWidth + t.wallRun, d);
  let y = mesa * wall + (valueNoise2D(x, z, 90, cfg.seed + 7) - 0.5) * 2 * t.floorNoise * (1 - wall);
  const r = cfg.runway;
  const rx = centerlineX((r.zStart + r.zEnd) / 2, cfg);
  const ex = r.width / 2 + 30 - Math.abs(x - rx);
  const ez = Math.min(z - (r.zStart - 40), r.zEnd + 40 - z);
  const blend = smoothstep(0, 30, Math.min(ex, ez));
  return y * (1 - blend) + r.height * blend;
}

// Sandstone strata: colour bands by height, so the walls read as layered rock.
function strataColour(h, x, z, out) {
  const n = fractalNoise2D(x * 0.7, z * 0.7, 99);
  if (h < 3.5) {
    out.setRGB(0.85, 0.63, 0.4); // valley sand
  } else if (h > 46) {
    out.setRGB(0.84, 0.69, 0.51); // pale mesa top
  } else {
    const band = Math.floor(h / 7 + n * 0.6) % 2 === 0;
    if (band) out.setRGB(0.72, 0.4, 0.24); // red rock
    else out.setRGB(0.78, 0.49, 0.3); // orange rock
  }
  const shade = 0.92 + n * 0.16;
  out.r *= shade;
  out.g *= shade;
  out.b *= shade;
  return out;
}

// A flat ribbon following the centreline: river or road.
function buildRibbon(zStart, zEnd, step, halfWidth, y, xOffset, material, scene) {
  const positions = [];
  const indices = [];
  let row = 0;
  for (let z = zStart; z <= zEnd; z += step) {
    const cx = centerlineX(z) + xOffset;
    positions.push(cx - halfWidth, y, z, cx + halfWidth, y, z);
    if (row > 0) {
      const a = (row - 1) * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    row++;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, material);
  mesh.receiveShadow = false;
  scene.add(mesh);
  return mesh;
}

// Build the whole canyon into the scene. Returns handles the game needs
// later (the windsock to wave, the runway's centre x for takeoffs).
export function buildTerrain(scene, cfg = CONFIG) {
  const rng = mulberry32(cfg.seed);
  const t = cfg.terrain;

  // Heightfield with painted strata.
  const geo = new THREE.PlaneGeometry(t.sizeX, t.sizeZ, t.segmentsX, t.segmentsZ);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colours = new Float32Array(pos.count * 3);
  const colour = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i) + TERRAIN_CENTER_Z;
    const y = groundHeight(x, z, cfg);
    pos.setY(i, y);
    pos.setZ(i, z);
    strataColour(y, x, z, colour);
    colours[i * 3] = colour.r;
    colours[i * 3 + 1] = colour.g;
    colours[i * 3 + 2] = colour.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(
    geo,
    new THREE.MeshLambertMaterial({ vertexColors: true })
  );
  scene.add(ground);

  // River and dirt road winding down the valley floor.
  buildRibbon(
    -3900, 1150, 50, cfg.river.width / 2, cfg.river.y, 0,
    new THREE.MeshLambertMaterial({ color: cfg.river.colour, emissive: 0x0e3a4a }),
    scene
  );
  buildRibbon(
    -3900, 1150, 50, cfg.road.width / 2, cfg.road.y, cfg.road.offset,
    new THREE.MeshLambertMaterial({ color: cfg.road.colour }),
    scene
  );

  // Runway strip with painted markings.
  const r = cfg.runway;
  const rx = centerlineX((r.zStart + r.zEnd) / 2, cfg);
  const strip = new THREE.Mesh(
    new THREE.PlaneGeometry(r.width, r.zEnd - r.zStart),
    new THREE.MeshLambertMaterial({ color: r.colour })
  );
  strip.rotation.x = -Math.PI / 2;
  strip.position.set(rx, r.height + 0.05, (r.zStart + r.zEnd) / 2);
  scene.add(strip);
  const paint = new THREE.MeshLambertMaterial({ color: 0xf2f2e8 });
  for (let z = r.zStart + 60; z < r.zEnd - 40; z += 60) {
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 9), paint);
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(rx, r.height + 0.1, z);
    scene.add(dash);
  }
  for (const dz of [0, 1]) {
    const z = dz === 0 ? r.zStart + 14 : r.zEnd - 14;
    for (let k = -2; k <= 2; k++) {
      const bar = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 10), paint);
      bar.rotation.x = -Math.PI / 2;
      bar.position.set(rx + k * 6, r.height + 0.1, z);
      scene.add(bar);
    }
  }

  // Windsock beside the runway, waving in the evening wind.
  const windsock = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.18, 12, 8),
    new THREE.MeshLambertMaterial({ color: 0xd8d8d8 })
  );
  pole.position.y = 6;
  windsock.add(pole);
  const sock = new THREE.Mesh(
    new THREE.ConeGeometry(0.55, 2.6, 10),
    new THREE.MeshLambertMaterial({ color: 0xff7a1a, emissive: 0x903a00 })
  );
  sock.rotation.z = Math.PI / 2;
  sock.position.set(1.4, 11.4, 0);
  windsock.add(sock);
  windsock.position.set(rx + 26, r.height, 520);
  scene.add(windsock);

  // Rocks: one instanced mesh scattered on the slopes and floor edges.
  const rockGeo = new THREE.IcosahedronGeometry(1, 0);
  const rockMat = new THREE.MeshLambertMaterial({ color: 0x8a5a3b });
  const rocks = new THREE.InstancedMesh(rockGeo, rockMat, 120);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 120; i++) {
    const z = -3900 + rng() * 5000;
    const side = rng() > 0.5 ? 1 : -1;
    const x = centerlineX(z) + side * (140 + rng() * 760);
    const s = 2 + rng() * 7;
    dummy.position.set(x, groundHeight(x, z, cfg) + s * 0.25, z);
    dummy.rotation.set(rng() * 3, rng() * 3, rng() * 3);
    dummy.scale.set(s, s * (0.6 + rng() * 0.5), s);
    dummy.updateMatrix();
    rocks.setMatrixAt(i, dummy.matrix);
  }
  scene.add(rocks);

  // Cacti: trunks and arms as three instanced meshes sharing one layout.
  const cactusCount = 80;
  const trunk = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.45, 0.55, 4.4, 8),
    new THREE.MeshLambertMaterial({ color: 0x3d7a3a }),
    cactusCount
  );
  const armGeo = new THREE.CylinderGeometry(0.26, 0.3, 1.8, 8);
  const armL = new THREE.InstancedMesh(armGeo, trunk.material, cactusCount);
  const armR = new THREE.InstancedMesh(armGeo, trunk.material, cactusCount);
  for (let i = 0; i < cactusCount; i++) {
    const z = -3800 + rng() * 4800;
    const side = rng() > 0.5 ? 1 : -1;
    const x = centerlineX(z) + side * (55 + rng() * 65);
    const y = groundHeight(x, z, cfg);
    const s = 0.8 + rng() * 0.9;
    dummy.rotation.set(0, rng() * 3, 0);
    dummy.scale.setScalar(s);
    dummy.position.set(x, y + 2.2 * s, z);
    dummy.updateMatrix();
    trunk.setMatrixAt(i, dummy.matrix);
    dummy.position.set(x - 0.95 * s, y + 2.7 * s, z);
    dummy.rotation.set(0, 0, 0.7);
    dummy.updateMatrix();
    armL.setMatrixAt(i, dummy.matrix);
    dummy.position.set(x + 0.95 * s, y + 3.1 * s, z);
    dummy.rotation.set(0, 0, -0.7);
    dummy.updateMatrix();
    armR.setMatrixAt(i, dummy.matrix);
  }
  scene.add(trunk);
  scene.add(armL);
  scene.add(armR);

  // Hangars by the runway: grey boxes with prism roofs and dark doors.
  const hangarMat = new THREE.MeshLambertMaterial({ color: 0x9aa0a8 });
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x6e7680 });
  const doorMat = new THREE.MeshLambertMaterial({ color: 0x2c3138 });
  for (let i = 0; i < 3; i++) {
    const hz = 420 + i * 140;
    const hx = rx - 62;
    const box = new THREE.Mesh(new THREE.BoxGeometry(22, 8, 28), hangarMat);
    box.position.set(hx, r.height + 4, hz);
    scene.add(box);
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(6.4, 6.4, 28, 3, 1), roofMat);
    roof.rotation.x = Math.PI / 2;
    roof.rotation.y = Math.PI / 2;
    roof.scale.set(1, 1, 0.62);
    roof.position.set(hx, r.height + 8.6, hz);
    scene.add(roof);
    const door = new THREE.Mesh(new THREE.PlaneGeometry(16, 6.5), doorMat);
    door.position.set(hx + 11.1, r.height + 3.4, hz);
    door.rotation.y = Math.PI / 2;
    scene.add(door);
  }

  return { runwayX: rx, windsock };
}
