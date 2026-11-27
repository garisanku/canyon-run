// shots.js — deterministic screenshot states for CANYON RUN.
// One file, one job: read ?shot= (and ?seed=) and place the game in a
// fixed, reproducible state so every screenshot is a real render of the
// same canyon, the same jet and the same light.
import { CONFIG } from './config.js';
import { resetForTakeoff } from './flight.js';

export const SHOT_NAMES = ['start', 'play', 'rings', 'landing'];

export function parseShotParams(search = window.location.search) {
  const params = new URLSearchParams(search);
  const shot = params.get('shot');
  const seed = Number.parseInt(params.get('seed') || '', 10);
  return {
    shot: SHOT_NAMES.includes(shot) ? shot : null,
    seed: Number.isSafeInteger(seed) ? seed : CONFIG.seed,
  };
}

function markPassed(rings, count) {
  for (let i = 0; i < count && i < rings.length; i++) {
    rings[i].passed = true;
    rings[i].torus.material.color.set(0x2aff66);
    rings[i].halo.material.color.set(0x2aff66);
    rings[i].halo.material.opacity = 0.7;
  }
}

// Stage one shot: mutate the flight state and the ring course, and return
// the scoreboard values the HUD should show for this frozen moment.
export function stageShotState(name, flight, rings, runwayX, cfg = CONFIG) {
  if (name === 'start') {
    // The jet on the runway, engines spooling for takeoff.
    resetForTakeoff(flight, runwayX, cfg);
    flight.throttle = 0.75;
    flight.speed = 26;
    return { score: 0, passed: 0, callout: null };
  }
  if (name === 'play') {
    // Mid-canyon, banked into a turn, the next ring dead ahead.
    const ring = rings[2];
    markPassed(rings, 2);
    flight.position.x = ring.x - 8;
    flight.position.y = ring.y + 4;
    flight.position.z = ring.z + 150;
    flight.heading = 0.05;
    flight.pitch = 0.01;
    flight.roll = 0.3;
    flight.speed = 82;
    flight.throttle = 0.8;
    flight.fuel = 72;
    return { score: 200, passed: 2, callout: 'RING +100' };
  }
  if (name === 'rings') {
    // A close pass: the glowing ring fills the view between canyon walls.
    const ring = rings[4];
    markPassed(rings, 4);
    flight.position.x = ring.x - 3;
    flight.position.y = ring.y + 2;
    flight.position.z = ring.z + 45;
    flight.heading = 0.02;
    flight.pitch = 0;
    flight.roll = 0.12;
    flight.speed = 88;
    flight.throttle = 0.85;
    flight.fuel = 61;
    return { score: 400, passed: 4, callout: 'RING +100' };
  }
  // landing: final approach, runway ahead at sunset, gear down.
  resetForTakeoff(flight, runwayX, cfg);
  markPassed(rings, rings.length);
  flight.position.x = runwayX;
  flight.position.y = 34;
  flight.position.z = 1150;
  flight.heading = 0;
  flight.pitch = -0.06;
  flight.roll = 0;
  flight.speed = 58;
  flight.throttle = 0.35;
  flight.fuel = 31;
  return { score: 1250, passed: rings.length, callout: 'GEAR DOWN' };
}
