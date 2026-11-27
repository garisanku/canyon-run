// input.js — keyboard and mouse for CANYON RUN.
// One file, one job: read the pilot's hands and turn them into one
// control vector plus edge-triggered actions (pause, restart, mute).
// Mouse steering is a nudge, not a yoke: it decays, so the keyboard
// stays the primary control.
// Arrow keys or WASD pitch and roll, Shift/Ctrl throttle, Space airbrake,
// R restart, P pause, M mute, Enter starts a sortie.

const KEYMAP = {
  ArrowUp: 'pitchUp',
  KeyW: 'pitchUp',
  ArrowDown: 'pitchDown',
  KeyS: 'pitchDown',
  ArrowLeft: 'rollLeft',
  KeyA: 'rollLeft',
  ArrowRight: 'rollRight',
  KeyD: 'rollRight',
  ShiftLeft: 'throttleUp',
  ShiftRight: 'throttleUp',
  ControlLeft: 'throttleDown',
  ControlRight: 'throttleDown',
  Space: 'airbrake',
};

const ACTION_KEYS = {
  KeyP: 'pause',
  KeyR: 'restart',
  KeyM: 'mute',
  Enter: 'start',
};

export function createInput() {
  const held = new Set();
  const pressed = new Set();
  let mousePitch = 0; // gentle pitch nudge from mouse movement
  let mouseRoll = 0; // gentle roll nudge from mouse movement

  function onKeyDown(e) {
    if (KEYMAP[e.code] || ACTION_KEYS[e.code]) e.preventDefault();
    if (e.repeat) return;
    held.add(e.code);
    if (ACTION_KEYS[e.code]) pressed.add(ACTION_KEYS[e.code]);
  }

  function onKeyUp(e) {
    held.delete(e.code);
  }

  function onMouseMove(e) {
    // Small steering nudges from the mouse; they decay on their own.
    mouseRoll = clamp(mouseRoll + e.movementX * 0.004, -0.6, 0.6);
    mousePitch = clamp(mousePitch - e.movementY * 0.004, -0.6, 0.6);
  }

  function clamp(v, lo, hi) {
    return Math.min(hi, Math.max(lo, v));
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('mousemove', onMouseMove);

  return {
    // The control vector for this frame: pitch and roll in -1..1.
    read(dt) {
      mousePitch = moveToward(mousePitch, 0, dt * 1.4);
      mouseRoll = moveToward(mouseRoll, 0, dt * 1.4);
      const pitch =
        (held.has('ArrowUp') || held.has('KeyW') ? 1 : 0) -
        (held.has('ArrowDown') || held.has('KeyS') ? 1 : 0) +
        mousePitch;
      const roll =
        (held.has('ArrowRight') || held.has('KeyD') ? 1 : 0) -
        (held.has('ArrowLeft') || held.has('KeyA') ? 1 : 0) +
        mouseRoll;
      return {
        pitch: clamp(pitch, -1, 1),
        roll: clamp(roll, -1, 1),
        throttleUp: held.has('ShiftLeft') || held.has('ShiftRight'),
        throttleDown: held.has('ControlLeft') || held.has('ControlRight'),
        airbrake: held.has('Space'),
      };
    },

    // True once when the action key was pressed since the last check.
    takeAction(name) {
      if (pressed.has(name)) {
        pressed.delete(name);
        return true;
      }
      return false;
    },

    // Any key or click counts as "the pilot is here" for audio unlock.
    unlock() {
      window.addEventListener('pointerdown', () => {}, { once: true });
    },
  };
}

function moveToward(v, target, step) {
  if (v < target) return Math.min(target, v + step);
  if (v > target) return Math.max(target, v - step);
  return v;
}
