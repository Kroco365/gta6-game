// Solmarina Heat — every tuning number and colour in one place.
// The world is a fixed 3600x2600 coastal city; the renderer scales a 1280x720
// view of it to the window, so no rule below depends on the screen size.

export const VIEW = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const WORLD = { width: 3600, height: 2600 };

/** Road grid: vertical streets (x) and horizontal avenues (y), road half-width 48. */
export const ROADS = {
  vertical: [300, 700, 1100, 1500, 1900, 2300, 2700, 3100],
  horizontal: [250, 600, 950, 1300, 1650, 2000],
  halfWidth: 48,
  lane: 24,
};

/** South edge: sand from this y, water from this y. */
export const BEACH = { sandY: 2250, waterY: 2480 };

export const PLAYER = {
  radius: 13,
  walkSpeed: 230,
  runSpeed: 330,
  health: 100,
  punchRange: 34,
  punchDamage: 25,
  pistolDamage: 34,
  pistolAmmo: 24,
  enterRange: 70,
};

export const CAR = {
  length: 64,
  width: 30,
  /** type -> handling. maxSpeed in world units/s. */
  types: {
    sedan: { maxSpeed: 540, accel: 320, reverse: 200, turn: 2.6, color: '#c94f43', name: 'Sedan' },
    taxi: { maxSpeed: 500, accel: 300, reverse: 190, turn: 2.6, color: '#f2b705', name: 'Cabbie' },
    sports: { maxSpeed: 700, accel: 430, reverse: 220, turn: 3.1, color: '#1f9d8a', name: 'Comet' },
    truck: { maxSpeed: 420, accel: 230, reverse: 160, turn: 2.0, color: '#7a6a58', name: 'Hauler' },
    van: { maxSpeed: 470, accel: 270, reverse: 180, turn: 2.3, color: '#8a94a6', name: 'Van' },
    police: { maxSpeed: 640, accel: 400, reverse: 220, turn: 3.0, color: '#1c2733', name: 'Cruiser' },
  },
};

export const TRAFFIC = { cars: 14, speed: 210, speedJitter: 50 };
export const PEDS = { count: 26, walkSpeed: 55, runSpeed: 150 };

export const WANTED = {
  max: 5,
  /** seconds out of every police car's sight before one star drops. */
  hideTime: 14,
  /** police cars per star level (index = stars). */
  policePerStar: [0, 1, 2, 3, 4, 4],
  bustRange: 46,
  /** seconds a cop must stay within bustRange of a slow on-foot player to bust them. */
  bustTime: 2.2,
};

export const PALETTE = {
  grass: '#7fae62',
  sand: '#e8d9a8',
  water: '#2f7fa8',
  waterDeep: '#256b92',
  sidewalk: '#b9b3a4',
  asphalt: '#3a3f4a',
  asphaltDark: '#33373f',
  lane: '#e8d24a',
  building: ['#e07856', '#e8a34c', '#4fa8a0', '#e8d47a', '#d96a7a', '#7a9cc6', '#c9b8a3', '#9dbb6a'],
  roof: '#2c2f36',
  tree: '#3f7a3a',
  treeDark: '#2f5c2c',
  player: '#ffd23f',
  playerDark: '#b8860b',
  ped: ['#5a6fd6', '#d65a8a', '#4fb36a', '#c9853f', '#8a5fd6', '#3fb3b0'],
  policeLight: ['#ff2a2a', '#2a6bff'],
  text: '#f4f1e6',
  muted: '#b9c0c9',
  panel: 'rgba(12, 16, 24, 0.72)',
  star: '#ffd23f',
  starEmpty: '#5a6068',
  marker: '#ff5a3c',
  cash: '#37d67a',
  health: '#3ddc5f',
  healthLow: '#ff4d4d',
  title: '#ffd23f',
  night: 'rgba(10, 14, 30, 0.18)',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where progress is kept between visits (this browser only). */
export const SAVE_KEY = 'solmarina-heat.save';

/** Mission rewards and the story's cash goal. */
export const STORY_GOAL = 3150;
