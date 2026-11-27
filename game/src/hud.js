// hud.js — the lit instrument overlay for CANYON RUN.
// One file, one job: every gauge, tape and callout the pilot reads,
// built as DOM over the 3D view so it stays crisp at any size.
import { CONFIG } from './config.js';

function el(tag, cls, parent, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  if (parent) parent.appendChild(node);
  return node;
}

function fmtTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function compassLabel(headingDeg) {
  const dirs = ['N', '030', '060', 'E', '120', '150', 'S', '210', '240', 'W', '300', '330'];
  const idx = Math.round(headingDeg / 30) % 12;
  return dirs[idx];
}

// Build the HUD inside #hud and return its live handles.
export function createHud() {
  const root = document.getElementById('hud');

  // Top centre: score, rings, timer and the fuel gauge.
  const top = el('div', 'hud-top', root);
  el('div', 'hud-label', top, 'SCORE');
  const score = el('div', 'hud-big', top, '0');
  el('div', 'hud-label', top, 'RINGS');
  const rings = el('div', 'hud-big', top, '0/10');
  el('div', 'hud-label', top, 'TIME');
  const timer = el('div', 'hud-big', top, '00:00');
  const fuelWrap = el('div', 'fuel-wrap', top);
  el('div', 'hud-label', fuelWrap, 'FUEL');
  const fuelBar = el('div', 'fuel-bar', fuelWrap);
  const fuelFill = el('div', 'fuel-fill', fuelBar);

  // Left: airspeed tape and throttle bar.
  const left = el('div', 'hud-left', root);
  el('div', 'hud-label', left, 'AIRSPEED');
  const speed = el('div', 'hud-huge', left, '0');
  el('div', 'hud-unit', left, 'KT');
  const speedBar = el('div', 'vbar', left);
  const speedFill = el('div', 'vbar-fill', speedBar);
  el('div', 'hud-label', left, 'THR');
  const thrBar = el('div', 'vbar', left);
  const thrFill = el('div', 'vbar-fill thr', thrBar);

  // Centre: artificial horizon and heading compass tape.
  const centre = el('div', 'hud-centre', root);
  const horizon = el('div', 'horizon', centre);
  const horizonInner = el('div', 'horizon-inner', horizon);
  el('div', 'horizon-sky', horizonInner);
  el('div', 'horizon-ground', horizonInner);
  const ladder = el('div', 'pitch-ladder', horizonInner);
  for (const deg of [30, 20, 10, -10, -20, -30]) {
    const line = el('div', 'ladder-line', ladder, deg > 0 ? `+${deg}` : `${deg}`);
    line.dataset.deg = deg;
    line.style.top = `${170 - deg * 2.4}px`;
  }
  el('div', 'horizon-marker', horizon);
  const compass = el('div', 'compass', centre);
  const compassStrip = el('div', 'compass-strip', compass);
  // Ticks from -90 to 450 degrees so the tape never runs out at the wrap.
  for (let d = -90; d <= 450; d += 15) {
    const tick = el('div', 'compass-tick', compassStrip);
    if (d % 30 === 0) tick.textContent = compassLabel(((d % 360) + 360) % 360);
    tick.style.left = `${(d + 90) * 4}px`;
  }
  const heading = el('div', 'hud-huge', centre, '000°');
  el('div', 'hud-unit', centre, 'HDG');

  // Right: altitude tape and vertical speed.
  const right = el('div', 'hud-right', root);
  el('div', 'hud-label', right, 'ALTITUDE');
  const alt = el('div', 'hud-huge', right, '0');
  el('div', 'hud-unit', right, 'FT');
  const altBar = el('div', 'vbar', right);
  const altFill = el('div', 'vbar-fill', altBar);
  el('div', 'hud-label', right, 'VERT SPEED');
  const vsi = el('div', 'hud-big', right, '+0 FT/S');

  // Centre-screen callouts: RING +100, LOW FUEL, GEAR DOWN...
  const callout = el('div', 'callout', root);

  let calloutTimer = null;
  return {
    // Refresh every gauge from the live flight state. state is the flight
    // state, score/ringsCount/timerSeconds are the sortie totals.
    update(state, scoreValue, ringsCount, timerSeconds, nextRingDistance) {
      const knots = Math.round(state.speed * 1.944);
      speed.textContent = String(knots);
      speedFill.style.height = `${Math.min(100, (state.speed / 150) * 100)}%`;
      thrFill.style.height = `${Math.round(state.throttle * 100)}%`;
      const feet = Math.round(state.position.y * 3.281);
      alt.textContent = feet.toLocaleString('en-US');
      altFill.style.height = `${Math.min(100, (state.position.y / 220) * 100)}%`;
      const vsFps = Math.round(state.verticalSpeed * 3.281);
      vsi.textContent = `${vsFps >= 0 ? '+' : ''}${vsFps} FT/S`;
      const headingDeg = Math.round(((state.heading * 180) / Math.PI) % 360 + 360) % 360;
      heading.textContent = `${String(headingDeg).padStart(3, '0')}°`;
      // Horizon: rotate by bank, slide by pitch (24 px per 10 degrees).
      const pitchPx = (state.pitch * 180) / Math.PI * 2.4;
      horizonInner.style.transform = `rotate(${-state.roll}rad) translateY(${pitchPx}px)`;
      // Compass tape: 4 px per degree, centred on the current heading.
      compassStrip.style.transform = `translateX(${240 - (headingDeg + 90) * 4}px)`;
      score.textContent = String(scoreValue);
      rings.textContent = `${ringsCount}/${CONFIG.rings.count}`;
      timer.textContent = fmtTime(timerSeconds);
      const fuelPct = Math.max(0, Math.round(state.fuel));
      fuelFill.style.width = `${fuelPct}%`;
      fuelFill.className = `fuel-fill${fuelPct < 25 ? ' low' : fuelPct < 50 ? ' mid' : ''}`;
      if (nextRingDistance !== null && nextRingDistance !== undefined) {
        rings.title = `Next ring ${Math.round(nextRingDistance)} m ahead`;
      }
    },
    // A big centre-screen message that fades after a moment.
    callout(text, kind) {
      callout.textContent = text;
      callout.className = `callout show${kind ? ` ${kind}` : ''}`;
      if (calloutTimer) clearTimeout(calloutTimer);
      calloutTimer = setTimeout(() => {
        callout.className = 'callout';
      }, 1800);
    },
    hide() {
      root.style.display = 'none';
    },
    show() {
      root.style.display = '';
    },
  };
}
