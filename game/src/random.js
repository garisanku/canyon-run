// random.js — a seeded random generator for CANYON RUN.
// One file, one job: an integer seed in, a deterministic sequence out.
// Terrain, rings and scatter all draw from one stream, in a fixed order,
// so a seed rebuilds the canyon bit for bit.
// The same seed always builds the same canyon, the same ring course and
// the same scatter of rocks and cacti, so every ?shot= state is reproducible.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function nextRandom() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Deterministic 2D value noise: smooth, repeatable bumps from integer coords.
export function hashNoise2D(x, z, seed) {
  let h = (x * 374761393 + z * 668265263 + seed * 974634211) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
}

function smooth(t) {
  return t * t * (3 - 2 * t);
}

// Bilinear-interpolated value noise over a grid of the given cell size.
export function valueNoise2D(x, z, cell, seed) {
  const gx = Math.floor(x / cell);
  const gz = Math.floor(z / cell);
  const fx = smooth(x / cell - gx);
  const fz = smooth(z / cell - gz);
  const n00 = hashNoise2D(gx, gz, seed);
  const n10 = hashNoise2D(gx + 1, gz, seed);
  const n01 = hashNoise2D(gx, gz + 1, seed);
  const n11 = hashNoise2D(gx + 1, gz + 1, seed);
  const nx0 = n00 + (n10 - n00) * fx;
  const nx1 = n01 + (n11 - n01) * fx;
  return nx0 + (nx1 - nx0) * fz;
}

// Fractal noise: several octaves of value noise stacked for natural terrain.
export function fractalNoise2D(x, z, seed) {
  let sum = 0;
  let amp = 1;
  let freq = 1;
  let norm = 0;
  for (let octave = 0; octave < 4; octave++) {
    sum += amp * valueNoise2D(x * freq, z * freq, 240, seed + octave * 101);
    norm += amp;
    amp *= 0.5;
    freq *= 2.1;
  }
  return sum / norm;
}
