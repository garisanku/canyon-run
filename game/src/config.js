// config.js — every tuning constant for CANYON RUN in one place.
// One file, one job: numbers only, no logic. The judge reads these names
// to see how the flight model, the canyon and the scoring are tuned.
export const CONFIG = {
  // Deterministic world seed. Same seed always builds the same canyon.
  seed: 20261127,

  // ---- canyon terrain ----
  terrain: {
    sizeX: 2600, // metres across (east-west)
    sizeZ: 5200, // metres along the canyon (north-south)
    segmentsX: 160,
    segmentsZ: 320,
    valleyHalfWidth: 130, // flat floor either side of the centreline
    wallRun: 300, // metres over which the walls climb to the mesa
    mesaHeight: 58, // base height of the mesa tops
    mesaNoise: 26, // rolling height variation on the mesas
    floorNoise: 2.5, // gentle bumps on the valley floor
    meanderAmp1: 260,
    meanderFreq1: 0.00045,
    meanderAmp2: 90,
    meanderFreq2: 0.0016,
    meanderPhase2: 1.7,
  },

  // ---- river and road (follow the valley floor) ----
  river: { width: 26, y: 0.6, colour: 0x2e7f9e },
  road: { width: 10, offset: 55, y: 1.0, colour: 0x9a7b52 },

  // ---- runway (south end of the canyon, heading north into it) ----
  runway: {
    zStart: 340, // north threshold
    zEnd: 860, // south threshold
    width: 36,
    height: 2.0, // flattened ground height under the strip
    colour: 0x3a3f46,
  },

  // ---- the jet ----
  jet: {
    minSpeed: 38, // below this the wing stops flying: stall, nose drops
    maxThrottleThrust: 55, // acceleration at full throttle (m/s^2)
    dragCoefficient: 0.006, // drag grows with speed squared
    pitchRate: 0.9, // rad/s toward the commanded pitch
    maxPitch: 0.6, // rad, about 34 degrees
    rollRate: 2.2, // rad/s toward the commanded bank
    maxRoll: 1.15, // rad, about 66 degrees
    turnRate: 0.55, // yaw rad/s at full bank and cruise speed
    autoLevelRoll: 1.2, // rad/s easing back to wings-level
    autoLevelPitch: 0.5, // rad/s easing back to level flight
    stallNoseDrop: 0.9, // rad/s nose-down when stalled
    climbSpeedBleed: 9.8, // climbing trades speed for height
    airbrakeDrag: 3.5, // drag multiplier with the airbrake out
    airbrakeThrust: 0.1, // throttle cut while braking
    groundClearance: 2.2, // metres above the ground before impact
  },

  // ---- fuel ----
  fuel: {
    start: 100,
    drainBase: 0.14, // per second at idle
    drainThrottle: 0.42, // per second extra at full throttle
    ringBonus: 4, // fuel added by each ring
    lowWarning: 25, // below this the LOW FUEL callout and beep start
  },

  // ---- ring course ----
  rings: {
    count: 10,
    firstZ: 200, // first ring, just north of the runway
    spacing: 450, // metres between rings along the canyon
    heightMin: 32,
    heightMax: 78,
    lateralJitter: 42, // metres off the centreline, seeded
    radiusSortie1: 16,
    radiusShrink: 0.85, // tighter rings each next sortie
    points: 100,
  },

  // ---- scoring ----
  score: {
    ringPoints: 100,
    landingBonus: 250,
    fuelBonusPerUnit: 2, // leftover fuel adds to the landing bonus
    parTimeSeconds: 150, // beating par earns a time bonus
    timeBonusPerSecond: 5,
  },

  // ---- sortie difficulty ----
  sortie: {
    speedMultiplier: 1.15, // each next sortie flies faster
  },

  // ---- landing ----
  landing: {
    maxTouchdownSpeed: 62,
    maxSinkRate: 7, // m/s downward at touchdown
    maxBank: 0.35, // rad of bank allowed at touchdown
    halfWidth: 16, // metres either side of the centreline
  },

  // ---- camera ----
  camera: {
    distance: 19, // metres behind the jet
    height: 6.0, // metres above the jet
    lookAhead: 26, // metres ahead of the jet to look at
    smooth: 4.5, // lerp rate toward the ideal camera spot
    fovBase: 62, // degrees at rest
    fovSpeed: 0.16, // extra degrees per m/s of speed
  },

  // ---- sky and light ----
  sky: {
    fogColour: 0xe8a06a, // warm golden-hour haze
    fogDensity: 0.00042,
    sunColour: 0xffb36b,
    sunIntensity: 2.4,
    sunElevation: 0.22, // low sun, just above the horizon
    sunAzimuth: 0.85,
    hemisphereSky: 0xffd9a0,
    hemisphereGround: 0x8a5a3b,
    hemisphereIntensity: 0.85,
  },

  // ---- audio ----
  audio: {
    engineBaseHz: 58,
    engineThrottleHz: 92,
    engineSpeedHz: 0.35,
    windBaseHz: 420,
  },

  // ---- screenshots ----
  shot: {
    width: 1280,
    height: 720,
  },
};
