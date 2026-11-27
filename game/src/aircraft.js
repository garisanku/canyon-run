// aircraft.js — the low-poly jet for CANYON RUN.
// One file, one job: the jet built from simple 3D shapes, its glowing
// afterburner, its wingtip lights and its damage smoke.
import * as THREE from 'three';

// A soft smoke puff, painted on a canvas at runtime.
function smokeTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, 'rgba(60, 60, 60, 0.85)');
  grad.addColorStop(0.6, 'rgba(90, 90, 90, 0.4)');
  grad.addColorStop(1, 'rgba(120, 120, 120, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Build the jet. The nose points along -Z, matching the flight model.
export function buildJet() {
  const group = new THREE.Group();
  const hull = new THREE.MeshLambertMaterial({ color: 0xe8edf2, emissive: 0x2a323c });
  const dark = new THREE.MeshLambertMaterial({ color: 0x5a646e, emissive: 0x11151a });
  const glass = new THREE.MeshLambertMaterial({
    color: 0x1a2f4a, emissive: 0x2a4a6a,
  });

  // Fuselage: a tapered cylinder lying along Z.
  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.95, 6.5, 10), hull);
  fuselage.rotation.x = Math.PI / 2;
  group.add(fuselage);

  // Nose cone.
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.55, 2.2, 10), dark);
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -4.3;
  group.add(nose);

  // Glass canopy.
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.62, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), glass);
  canopy.scale.set(1, 0.72, 1.7);
  canopy.position.set(0, 0.42, -1.2);
  group.add(canopy);

  // Swept main wings: thin boxes angled back.
  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.12, 1.7), hull);
    wing.position.set(side * 2.1, -0.1, 0.7);
    wing.rotation.y = -side * 0.45;
    group.add(wing);
    // Tailplane.
    const tail = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.1, 0.9), hull);
    tail.position.set(side * 0.95, 0.05, 3.1);
    tail.rotation.y = -side * 0.4;
    group.add(tail);
    // Wingtip light: red on the left, green on the right.
    const tip = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 8, 6),
      new THREE.MeshBasicMaterial({ color: side < 0 ? 0xff2a2a : 0x2aff66 })
    );
    tip.position.set(side * 3.6, -0.1, 1.5);
    group.add(tip);
  }

  // Vertical tail fin.
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.5, 1.4), dark);
  fin.position.set(0, 0.8, 3.1);
  fin.rotation.x = -0.25;
  group.add(fin);

  // Afterburner: a glowing cone at the tail, flickering with throttle.
  const burner = new THREE.Mesh(
    new THREE.ConeGeometry(0.5, 2.6, 10),
    new THREE.MeshBasicMaterial({ color: 0xffa030, transparent: true, opacity: 0.9 })
  );
  burner.rotation.x = Math.PI / 2;
  burner.position.z = 4.4;
  group.add(burner);
  const burnerLight = new THREE.PointLight(0xff8a20, 0, 30);
  burnerLight.position.set(0, 0, 4.6);
  group.add(burnerLight);

  // Damage smoke: a dozen puffs trailing from the tail when the jet is hurt.
  const smokeTex = smokeTexture();
  const smoke = new THREE.Group();
  const puffs = [];
  for (let i = 0; i < 12; i++) {
    const puff = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: smokeTex, transparent: true, opacity: 0, depthWrite: false })
    );
    puff.position.set(0, 0, 3.5 + i * 1.2);
    puff.scale.set(2 + i * 0.5, 2 + i * 0.5, 1);
    puff.userData.phase = i / 12;
    smoke.add(puff);
    puffs.push(puff);
  }
  smoke.visible = false;
  group.add(smoke);

  return {
    group,
    // Throttle 0..1 drives the burner flame and its light.
    setAfterburner(level, time) {
      const flicker = 0.85 + Math.sin(time * 31) * 0.08 + Math.sin(time * 47) * 0.07;
      const s = Math.max(0.05, level) * flicker;
      burner.scale.set(s, s, 0.6 + level * 1.1);
      burner.material.opacity = 0.25 + level * 0.65;
      burnerLight.intensity = level * 26;
    },
    setSmoking(on) {
      smoke.visible = on;
    },
    // Animate the smoke trail; called every frame while smoking.
    updateSmoke(time) {
      if (!smoke.visible) return;
      for (const puff of puffs) {
        const cycle = (time * 0.55 + puff.userData.phase) % 1;
        puff.position.z = 3.5 + cycle * 16;
        puff.position.y = 0.4 + cycle * 3;
        puff.material.opacity = 0.7 * (1 - cycle);
        const s = 2 + cycle * 7;
        puff.scale.set(s, s, 1);
      }
    },
  };
}
