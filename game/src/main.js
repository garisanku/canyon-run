// main.js — boot, game loop and state machine for CANYON RUN.
// One file, one job: title, playing, paused, crashed, landed — and the
// glue between the flight model, the canyon, the jet, the HUD and audio.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import {
  createFlightState,
  resetForTakeoff,
  stepFlight,
  forwardVector,
} from './flight.js';
import { buildTerrain, groundHeight } from './terrain.js';
import { buildSky } from './sky.js';
import { buildJet } from './aircraft.js';
import {
  buildRingCourse,
  nextRing,
  checkRingPass,
  ringsPassed,
  clearRingCourse,
} from './rings.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { createInput } from './input.js';
import { parseShotParams, stageShotState } from './shots.js';

const params = parseShotParams();
const cfg = { ...CONFIG, seed: params.seed };

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  cfg.camera.fovBase,
  window.innerWidth / window.innerHeight,
  0.1,
  12000
);

const sky = buildSky(scene, cfg);
const terrain = buildTerrain(scene, cfg);
const jet = buildJet();
jet.group.rotation.order = 'YXZ';
scene.add(jet.group);

const flight = createFlightState(cfg);
const world = {
  groundHeight: (x, z) => groundHeight(x, z, cfg),
  runway: {
    x: terrain.runwayX,
    zStart: cfg.runway.zStart,
    zEnd: cfg.runway.zEnd,
    halfWidth: cfg.runway.width / 2,
    height: cfg.runway.height,
  },
};

let rings = buildRingCourse(scene, cfg.seed, 1, cfg);
const hud = createHud();
const audio = createAudio();
const input = createInput();

let gameState = 'title'; // title | playing | paused | crashed | landed
let sortie = 1;
let totalScore = 0;
let sortieScore = 0;
let lowFuelWarned = false;
let engineOutWarned = false;
let shotMode = false;
let shotScore = 0;

const camPos = new THREE.Vector3();
const camTarget = new THREE.Vector3();

const overlays = {
  title: document.getElementById('title-screen'),
  pause: document.getElementById('pause-screen'),
  crash: document.getElementById('crash-screen'),
  landed: document.getElementById('landed-screen'),
};

function hideOverlays() {
  for (const key of Object.keys(overlays)) overlays[key].classList.remove('show');
}

function showOverlay(name) {
  hideOverlays();
  overlays[name].classList.add('show');
}

// Begin a sortie: fresh rings, full fuel, the jet on the runway.
function startSortie(n) {
  sortie = n;
  clearRingCourse(scene, rings);
  rings = buildRingCourse(scene, cfg.seed, n, cfg);
  resetForTakeoff(flight, terrain.runwayX, cfg);
  sortieScore = 0;
  lowFuelWarned = false;
  engineOutWarned = false;
  jet.setSmoking(false);
  audio.stopLowFuelBeep();
  hud.show();
  hideOverlays();
  gameState = 'playing';
  snapCamera();
}

function snapCamera() {
  const fwd = forwardVector(flight);
  camPos.set(
    flight.position.x - fwd.x * cfg.camera.distance,
    flight.position.y - fwd.y * cfg.camera.distance + cfg.camera.height,
    flight.position.z - fwd.z * cfg.camera.distance
  );
  camera.position.copy(camPos);
}

function updateCamera(dt) {
  const fwd = forwardVector(flight);
  const ideal = new THREE.Vector3(
    flight.position.x - fwd.x * cfg.camera.distance,
    flight.position.y - fwd.y * cfg.camera.distance + cfg.camera.height,
    flight.position.z - fwd.z * cfg.camera.distance
  );
  const minY = groundHeight(ideal.x, ideal.z, cfg) + 3;
  if (ideal.y < minY) ideal.y = minY;
  const k = 1 - Math.exp(-cfg.camera.smooth * dt);
  camPos.lerp(ideal, k);
  camera.position.copy(camPos);
  camTarget.set(
    flight.position.x + fwd.x * cfg.camera.lookAhead,
    flight.position.y + fwd.y * cfg.camera.lookAhead - 4,
    flight.position.z + fwd.z * cfg.camera.lookAhead
  );
  camera.lookAt(camTarget);
  const fov = cfg.camera.fovBase + flight.speed * cfg.camera.fovSpeed;
  if (Math.abs(camera.fov - fov) > 0.05) {
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }
}

function updateJetMesh(time) {
  jet.group.position.set(flight.position.x, flight.position.y, flight.position.z);
  jet.group.rotation.y = flight.heading;
  jet.group.rotation.x = flight.pitch;
  jet.group.rotation.z = -flight.roll;
  jet.setAfterburner(gameState === 'playing' ? flight.throttle : 0.15, time);
  jet.updateSmoke(time);
}

function updateHud() {
  const ring = nextRing(rings);
  const dist = ring
    ? Math.hypot(
        ring.x - flight.position.x,
        ring.y - flight.position.y,
        ring.z - flight.position.z
      )
    : null;
  hud.update(flight, totalScore + sortieScore, ringsPassed(rings), flight.elapsed, dist);
}

function onLanded() {
  const timeBonus = Math.max(
    0,
    Math.round((cfg.score.parTimeSeconds - flight.elapsed) * cfg.score.timeBonusPerSecond)
  );
  const landingBonus = cfg.score.landingBonus + Math.round(flight.fuel * cfg.score.fuelBonusPerUnit);
  const ringPoints = ringsPassed(rings) * cfg.score.ringPoints;
  const sortieTotal = ringPoints + timeBonus + landingBonus;
  totalScore += sortieTotal;
  document.getElementById('landed-stats').innerHTML =
    `RINGS ${ringsPassed(rings)}/${cfg.rings.count} &times; ${cfg.score.ringPoints} = ${ringPoints}<br>` +
    `TIME BONUS ${timeBonus} &nbsp;·&nbsp; LANDING BONUS ${landingBonus}<br>` +
    `<strong>SORTIE ${sortieTotal} &nbsp;·&nbsp; TOTAL ${totalScore}</strong><br>` +
    `Sortie ${sortie + 1} flies faster, with tighter rings.`;
  audio.stopLowFuelBeep();
  gameState = 'landed';
  showOverlay('landed');
}

function onCrashed(reason) {
  audio.thud();
  audio.stopLowFuelBeep();
  jet.setSmoking(true);
  document.getElementById('crash-reason').textContent = reason;
  document.getElementById('crash-stats').textContent =
    `Rings ${ringsPassed(rings)}/${cfg.rings.count} · Score ${totalScore + sortieScore}`;
  gameState = 'crashed';
  showOverlay('crash');
}

function stepGame(dt, time) {
  const inputVector = input.read(dt);
  const prev = { ...flight.position };
  const result = stepFlight(flight, inputVector, dt, world, cfg);

  const passed = checkRingPass(rings, prev, flight.position);
  if (passed) {
    sortieScore += cfg.score.ringPoints;
    flight.fuel = Math.min(100, flight.fuel + cfg.fuel.ringBonus);
    audio.chime();
    hud.callout(`RING +${cfg.score.ringPoints}`, 'good');
  }

  if (flight.fuel < cfg.fuel.lowWarning && !lowFuelWarned) {
    lowFuelWarned = true;
    hud.callout('LOW FUEL', 'warn');
    audio.startLowFuelBeep();
  }
  if (flight.fuel >= cfg.fuel.lowWarning && lowFuelWarned) {
    lowFuelWarned = false;
    audio.stopLowFuelBeep();
  }
  if (flight.engineOut && !engineOutWarned) {
    engineOutWarned = true;
    hud.callout('ENGINE OUT — GLIDING', 'warn');
  }
  if (flight.stalled && flight.speed > 5) {
    hud.callout('STALL — NOSE DOWN', 'warn');
  }

  audio.update(flight.throttle, flight.speed, flight.stalled);
  if (result.status === 'landed') onLanded();
  else if (result.status === 'crashed') onCrashed(result.reason);
}

// ---- buttons and keys ----
document.getElementById('btn-fly').addEventListener('click', () => {
  audio.unlock();
  startSortie(1);
});
document.getElementById('btn-resume').addEventListener('click', () => {
  gameState = 'playing';
  hideOverlays();
});
document.getElementById('btn-again').addEventListener('click', () => startSortie(sortie));
document.getElementById('btn-next').addEventListener('click', () => startSortie(sortie + 1));
window.addEventListener('pointerdown', () => audio.unlock(), { once: true });
window.addEventListener('keydown', () => audio.unlock(), { once: true });
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---- boot ----
resetForTakeoff(flight, terrain.runwayX, cfg);
snapCamera();
hud.hide();
showOverlay('title');

// Deterministic screenshot states: stage, render, freeze.
if (params.shot) {
  shotMode = true;
  const staged = stageShotState(params.shot, flight, rings, terrain.runwayX, cfg);
  shotScore = staged.score;
  totalScore = 0;
  sortieScore = staged.score;
  hud.show();
  hideOverlays();
  gameState = 'playing';
  updateJetMesh(1.0);
  updateCamera(1);
  updateHud();
  if (staged.callout) hud.callout(staged.callout, 'good');
  renderer.render(scene, camera);
  window.__shotReady = true;
}

const clock = new THREE.Clock();
let shotRendered = false;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const time = clock.elapsedTime;

  if (input.takeAction('mute')) {
    audio.setMuted(!audio.isMuted());
  }

  if (shotMode) {
    // Frozen frame: render the staged state, never advance the sim.
    if (!shotRendered) {
      shotRendered = true;
      renderer.render(scene, camera);
      window.__shotReady = true;
    }
    return;
  }

  if (input.takeAction('pause') && (gameState === 'playing' || gameState === 'paused')) {
    if (gameState === 'playing') {
      gameState = 'paused';
      showOverlay('pause');
    } else {
      gameState = 'playing';
      hideOverlays();
    }
  }
  if (input.takeAction('restart') && gameState !== 'title') {
    startSortie(gameState === 'landed' ? sortie + 1 : sortie);
  }
  if (input.takeAction('start')) {
    if (gameState === 'title') startSortie(1);
    else if (gameState === 'landed') startSortie(sortie + 1);
    else if (gameState === 'crashed') startSortie(sortie);
  }

  if (gameState === 'playing') {
    stepGame(dt, time);
    updateHud();
  } else if (gameState === 'title') {
    // Gentle sway on the title screen while the jet waits on the runway.
    const sway = Math.sin(time * 0.12) * 0.12;
    const fwd = forwardVector(flight);
    camera.position.set(
      flight.position.x - fwd.x * cfg.camera.distance + Math.sin(sway) * 6,
      flight.position.y + cfg.camera.height + 1.5,
      flight.position.z - fwd.z * cfg.camera.distance
    );
    camera.lookAt(flight.position.x, flight.position.y + 1, flight.position.z - 20);
  }

  if (gameState === 'playing' || gameState === 'crashed' || gameState === 'landed') {
    updateCamera(gameState === 'playing' ? dt : 0.016);
  }
  sky.update(dt);
  updateJetMesh(time);
  renderer.render(scene, camera);
}

animate();

// Probe handle for play-testing: the game's live state, nothing more.
window.__game = {
  flight,
  get rings() {
    return rings;
  },
  get state() {
    return gameState;
  },
  get score() {
    return totalScore + sortieScore;
  },
  startSortie,
};
