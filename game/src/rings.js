// rings.js — the glowing ring course for CANYON RUN.
// One file, one job: where the rings sit, when the jet threads one,
// and what a pass is worth.
// Rings sit on the valley centreline and shrink a little each sortie,
// so later sorties ask for tighter flying.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { centerlineX } from './terrain.js';
import { mulberry32 } from './random.js';

// Build the course for a sortie: 10 rings threaded along the canyon,
// seeded so the same seed and sortie always lay the same course.
export function buildRingCourse(scene, seed, sortie = 1, cfg = CONFIG) {
  const rng = mulberry32(seed + sortie * 977);
  const radius = cfg.rings.radiusSortie1 * Math.pow(cfg.rings.radiusShrink, sortie - 1);
  const rings = [];
  for (let i = 0; i < cfg.rings.count; i++) {
    const z = cfg.rings.firstZ - i * cfg.rings.spacing;
    const x = centerlineX(z, cfg) + (rng() - 0.5) * 2 * cfg.rings.lateralJitter;
    const y = cfg.rings.heightMin + rng() * (cfg.rings.heightMax - cfg.rings.heightMin);
    const ring = new THREE.Group();
    const torus = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.9, 12, 40),
      new THREE.MeshBasicMaterial({ color: 0xffb020 })
    );
    ring.add(torus);
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(radius + 1.6, 0.5, 8, 40),
      new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0.35 })
    );
    ring.add(halo);
    ring.position.set(x, y, z);
    scene.add(ring);
    rings.push({ x, y, z, radius, passed: false, group: ring, torus, halo });
  }
  return rings;
}

// The next ring the pilot must fly through, or null when the course is done.
export function nextRing(rings) {
  for (const ring of rings) if (!ring.passed) return ring;
  return null;
}

// Did the jet cross a ring's plane inside its circle this step?
// prev and pos are the jet's positions before and after the step.
export function checkRingPass(rings, prev, pos) {
  for (const ring of rings) {
    if (ring.passed) continue;
    if (prev.z > ring.z && pos.z <= ring.z) {
      const dx = pos.x - ring.x;
      const dy = pos.y - ring.y;
      if (Math.hypot(dx, dy) < ring.radius) {
        ring.passed = true;
        ring.torus.material.color.set(0x2aff66);
        ring.halo.material.color.set(0x2aff66);
        ring.halo.material.opacity = 0.7;
        return ring;
      }
    }
  }
  return null;
}

export function ringsPassed(rings) {
  let n = 0;
  for (const ring of rings) if (ring.passed) n++;
  return n;
}

// Remove a course from the scene (a new sortie lays a fresh one).
export function clearRingCourse(scene, rings) {
  for (const ring of rings) {
    scene.remove(ring.group);
    ring.torus.geometry.dispose();
    ring.halo.geometry.dispose();
    ring.torus.material.dispose();
    ring.halo.material.dispose();
  }
  rings.length = 0;
}
