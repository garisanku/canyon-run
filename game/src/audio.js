// audio.js — procedural WebAudio for CANYON RUN.
// One file, one job: every sound is synthesized, no audio files.
// Engine drone, wind, ring chime, low-fuel beep and crash thud.
import { CONFIG } from './config.js';

// White noise loop, the raw material for wind and the crash thud.
function noiseBuffer(ctx, seconds) {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineSub = null;
  let engineGain = null;
  let engineFilter = null;
  let windSource = null;
  let windGain = null;
  let windFilter = null;
  let muted = false;
  let beepTimer = null;

  const api = {
    // Call from a user gesture: browsers only allow audio after one.
    unlock() {
      if (ctx) {
        if (ctx.state === 'suspended') ctx.resume();
        return;
      }
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.8;
      master.connect(ctx.destination);

      // Engine: a sawtooth drone plus a sub sine, through a lowpass.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = CONFIG.audio.engineBaseHz;
      engineSub = ctx.createOscillator();
      engineSub.type = 'sine';
      engineSub.frequency.value = CONFIG.audio.engineBaseHz / 2;
      engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter);
      engineSub.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      engineSub.start();

      // Wind: looped noise through a bandpass that opens with speed.
      windSource = ctx.createBufferSource();
      windSource.buffer = noiseBuffer(ctx, 2);
      windSource.loop = true;
      windFilter = ctx.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = CONFIG.audio.windBaseHz;
      windFilter.Q.value = 0.6;
      windGain = ctx.createGain();
      windGain.gain.value = 0;
      windSource.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(master);
      windSource.start();
    },

    // Throttle and speed drive the engine note and the wind rush.
    update(throttle, speed, stalled) {
      if (!ctx) return;
      const t = ctx.currentTime;
      const hz =
        CONFIG.audio.engineBaseHz +
        throttle * CONFIG.audio.engineThrottleHz +
        speed * CONFIG.audio.engineSpeedHz;
      engineOsc.frequency.setTargetAtTime(hz, t, 0.08);
      engineSub.frequency.setTargetAtTime(hz / 2, t, 0.08);
      engineFilter.frequency.setTargetAtTime(320 + throttle * 900, t, 0.1);
      const engineLevel = stalled ? 0.05 : 0.05 + throttle * 0.16;
      engineGain.gain.setTargetAtTime(engineLevel, t, 0.1);
      windFilter.frequency.setTargetAtTime(
        CONFIG.audio.windBaseHz + speed * 6,
        t,
        0.1
      );
      windGain.gain.setTargetAtTime(Math.min(0.22, speed * 0.0022), t, 0.15);
    },

    // Two-note chime when the jet threads a ring.
    chime() {
      if (!ctx) return;
      const t = ctx.currentTime;
      for (const [offset, freq] of [
        [0, 659.25],
        [0.09, 987.77],
      ]) {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.0001, t + offset);
        gain.gain.exponentialRampToValueAtTime(0.28, t + offset + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + offset + 0.5);
        osc.connect(gain);
        gain.connect(master);
        osc.start(t + offset);
        osc.stop(t + offset + 0.55);
      }
    },

    // Short warning beep, repeated while fuel is low.
    startLowFuelBeep() {
      if (!ctx || beepTimer) return;
      beepTimer = setInterval(() => {
        if (muted) return;
        const t = ctx.currentTime;
        const osc = ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.value = 880;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.12, t + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
        osc.connect(gain);
        gain.connect(master);
        osc.start(t);
        osc.stop(t + 0.16);
      }, 900);
    },

    stopLowFuelBeep() {
      if (beepTimer) {
        clearInterval(beepTimer);
        beepTimer = null;
      }
    },

    // Crash thud: a noise burst under a falling low sine.
    thud() {
      if (!ctx) return;
      const t = ctx.currentTime;
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer(ctx, 0.4);
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.5, t);
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
      noise.connect(noiseGain);
      noiseGain.connect(master);
      noise.start(t);
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(120, t);
      osc.frequency.exponentialRampToValueAtTime(38, t + 0.35);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.5, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
      osc.connect(gain);
      gain.connect(master);
      osc.start(t);
      osc.stop(t + 0.45);
    },

    setMuted(m) {
      muted = m;
      if (master) master.gain.value = m ? 0 : 0.8;
    },

    isMuted() {
      return muted;
    },
  };
  return api;
}
