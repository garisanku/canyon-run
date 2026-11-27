// flight.js — the arcade flight model for CANYON RUN.
// One file, one job: how the jet moves, stalls, lands and crashes.
// Pure numbers in, a status out; it never touches the scene or the DOM.
import { CONFIG } from './config.js';

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

function moveToward(v, target, step) {
  if (v < target) return Math.min(target, v + step);
  if (v > target) return Math.max(target, v - step);
  return v;
}

// A fresh jet sitting still: the start of every sortie.
export function createFlightState(cfg = CONFIG) {
  return {
    position: { x: 0, y: 0, z: 0 },
    heading: 0, // rad, 0 = facing -Z (north, into the canyon)
    pitch: 0, // rad, positive = nose up
    roll: 0, // rad, positive = banked right
    speed: 0, // m/s along the nose
    throttle: 0, // 0..1
    fuel: cfg.fuel.start,
    engineOut: false,
    verticalSpeed: 0, // m/s, positive = climbing
    stalled: false,
    elapsed: 0, // seconds since takeoff
  };
}

// Put the jet on the runway, nose pointing down the canyon.
export function resetForTakeoff(state, runwayX, cfg = CONFIG) {
  state.position.x = runwayX;
  state.position.y = cfg.runway.height + CONFIG.jet.groundClearance;
  state.position.z = cfg.runway.zEnd - 40;
  state.heading = 0;
  state.pitch = 0;
  state.roll = 0;
  state.speed = 0;
  state.throttle = 0;
  state.fuel = cfg.fuel.start;
  state.engineOut = false;
  state.verticalSpeed = 0;
  state.stalled = false;
  state.elapsed = 0;
}

// The direction the nose points, from heading and pitch.
export function forwardVector(state) {
  const cp = Math.cos(state.pitch);
  return {
    x: Math.sin(state.heading) * cp,
    y: Math.sin(state.pitch),
    z: -Math.cos(state.heading) * cp,
  };
}

// One simulation step. input: { pitch: -1..1, roll: -1..1, throttleUp,
// throttleDown, airbrake }. world: { groundHeight(x, z), runway }.
// Returns { status: 'flying' | 'crashed' | 'landed', reason? }.
export function stepFlight(state, input, dt, world, cfg = CONFIG) {
  const jet = cfg.jet;
  dt = Math.min(dt, 0.05);

  // Throttle: Shift spools up, Ctrl spools down.
  if (input.throttleUp) state.throttle = Math.min(1, state.throttle + 0.55 * dt);
  if (input.throttleDown) state.throttle = Math.max(0, state.throttle - 0.7 * dt);

  // Thrust, drag and the speed they settle at.
  const braking = input.airbrake;
  let thrust = state.throttle * jet.maxThrottleThrust;
  if (braking) thrust *= jet.airbrakeThrust;
  if (state.engineOut) thrust = 0;
  const drag = jet.dragCoefficient * state.speed * state.speed * (braking ? jet.airbrakeDrag : 1);
  const climbBleed = jet.climbSpeedBleed * Math.sin(state.pitch);
  state.speed = clamp(state.speed + (thrust - drag - climbBleed) * dt, 0, 150);

  // Stall: below minimum speed the wing stops flying.
  const stallRatio = state.speed / jet.minSpeed;
  state.stalled = state.speed < jet.minSpeed;
  const authority = state.stalled ? 0.5 : 1; // controls go soft in a stall

  // Pitch: stick commands the nose, then it eases back to level.
  let pitchTarget = input.pitch * jet.maxPitch;
  if (state.stalled) pitchTarget = Math.min(pitchTarget, -0.3);
  state.pitch = moveToward(state.pitch, pitchTarget, jet.pitchRate * authority * dt);
  if (!input.pitch) state.pitch = moveToward(state.pitch, 0, jet.autoLevelPitch * dt);
  if (state.stalled) state.pitch -= jet.stallNoseDrop * (1 - stallRatio) * dt;
  state.pitch = clamp(state.pitch, -0.7, 0.7);

  // Roll: stick commands the bank, then it eases back to wings-level.
  const rollTarget = input.roll * jet.maxRoll;
  state.roll = moveToward(state.roll, rollTarget, jet.rollRate * authority * dt);
  if (!input.roll) state.roll = moveToward(state.roll, 0, jet.autoLevelRoll * dt);

  // Yaw follows the bank: bank right, turn right.
  const speedFactor = clamp(state.speed / 80, 0.35, 1.1);
  state.heading += state.roll * jet.turnRate * speedFactor * dt;

  // Move along the nose; a stalled wing also sinks.
  const fwd = forwardVector(state);
  const prevY = state.position.y;
  state.position.x += fwd.x * state.speed * dt;
  state.position.y += fwd.y * state.speed * dt;
  state.position.z += fwd.z * state.speed * dt;
  if (state.stalled) state.position.y -= (jet.minSpeed - state.speed) * 0.22 * dt;
  state.verticalSpeed = (state.position.y - prevY) / Math.max(dt, 0.0001);

  // Fuel drains with throttle; empty means engine-out gliding.
  if (!state.engineOut) {
    state.fuel -= (cfg.fuel.drainBase + cfg.fuel.drainThrottle * state.throttle) * dt;
    if (state.fuel <= 0) {
      state.fuel = 0;
      state.engineOut = true;
    }
  }
  state.elapsed += dt;

  // Touchdown: on the strip, slow, gentle, wings level — but only when
  // the jet is actually coming down onto it, not while it rolls on it.
  const r = world.runway;
  const overRunway =
    Math.abs(state.position.x - r.x) < cfg.landing.halfWidth &&
    state.position.z > r.zStart &&
    state.position.z < r.zEnd;
  if (overRunway && state.position.y <= r.height + jet.groundClearance) {
    const wasAirborne = prevY > r.height + jet.groundClearance + 0.5;
    if (!wasAirborne) {
      // Takeoff roll or taxi: stay on the strip, no sink, no crash.
      state.position.y = r.height + jet.groundClearance;
      state.verticalSpeed = 0;
      return { status: 'flying' };
    }
    if (
      state.speed <= cfg.landing.maxTouchdownSpeed &&
      state.verticalSpeed > -cfg.landing.maxSinkRate &&
      Math.abs(state.roll) < cfg.landing.maxBank
    ) {
      state.position.y = r.height + jet.groundClearance;
      return { status: 'landed' };
    }
    if (state.speed > cfg.landing.maxTouchdownSpeed) {
      return { status: 'crashed', reason: 'TOO FAST FOR THE RUNWAY' };
    }
    if (state.verticalSpeed <= -cfg.landing.maxSinkRate) {
      return { status: 'crashed', reason: 'HARD LANDING' };
    }
    return { status: 'crashed', reason: 'WINGS NOT LEVEL' };
  }

  // Terrain strike, canyon wall or valley floor.
  const groundY = world.groundHeight(state.position.x, state.position.z);
  if (state.position.y <= groundY + jet.groundClearance) {
    const reason = groundY > 20 ? 'INTO THE CANYON WALL' : 'TERRAIN STRIKE';
    return { status: 'crashed', reason };
  }
  return { status: 'flying' };
}
