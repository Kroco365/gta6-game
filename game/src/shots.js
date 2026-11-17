// The screenshot scenes behind ?shot=cover|mission|foot|title. Each one plays
// the real rules forward from a fresh world for a fixed number of steps, steered
// by a simple autopilot, so the frame is what a short game really looks like
// and the same seed always gives the same frame.

import { STEP } from './config.js';
import { SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

/** A fake input that just drives forward — the shots' autopilot. */
function autopilotInput(steer) {
  return {
    move() {
      return { x: steer || 0, y: -1 };
    },
    get run() {
      return false;
    },
    takeActions() {
      return 0;
    },
    get firing() {
      return false;
    },
  };
}

function stepWorld(world, seconds, steer) {
  const input = autopilotInput(steer);
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    world.step(STEP, input, { x: 640, y: 360 }, 1, 0, 0);
    if (world.screen === 'busted' || world.screen === 'wasted') break;
  }
}

/** Put the player in the nearest traffic car and drive it. */
function jackNearestCar(world) {
  const p = world.player;
  let best = null;
  let bestD = Infinity;
  for (const car of world.cars) {
    if (car.driver !== 'traffic') continue;
    const d = (car.x - p.x) ** 2 + (car.y - p.y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  if (!best) return null;
  best.driver = 'player';
  p.car = best;
  return best;
}

/** Remove traffic cars inside a rectangle, so a staged drive has a clear road. */
function clearPath(world, x0, x1, y0, y1) {
  world.cars = world.cars.filter(
    (c) => !(c.driver === 'traffic' && c.x > x0 && c.x < x1 && c.y > y0 && c.y < y1),
  );
}

/**
 * Set `world` to the named scene and return the screen to draw over it and
 * the jobs-done count to show. Names: cover, mission, foot, title.
 */
export function stageShot(name, world) {
  if (name === 'cover') {
    // A chase downtown: the player in a sports car, two cruisers behind,
    // two stars on the HUD, the city rushing past.
    world.reset(1);
    const car = world.addCar('sports', 1500, 1300, 0, 'player');
    car.speed = 480;
    world.player.car = car;
    world.player.x = car.x;
    world.player.y = car.y;
    world.setWanted(2);
    // Two cruisers close behind, still in frame when the shot is taken.
    world.addCar('police', 1500 - 140, 1300 + 26, 0, 'police');
    world.addCar('police', 1500 - 210, 1300 - 30, 0, 'police');
    clearPath(world, 1000, 2800, 1200, 1400);
    stepWorld(world, 1.2, 0);
    return { screen: SCREEN_PLAY, best: 1 };
  }
  if (name === 'mission') {
    // Job 3 in progress: cash drops on the ground, the marker beacon ahead,
    // the player driving for the next drop with the clock running.
    world.reset(2);
    const car = jackNearestCar(world);
    if (car) {
      // Line the player up on the avenue heading east, straight at the first drop.
      car.x = 150;
      car.y = 250;
      car.angle = 0;
      car.speed = 0;
      world.player.x = car.x;
      world.player.y = car.y;
      clearPath(world, 100, 1600, 200, 300);
    }
    stepWorld(world, 2.0, 0);
    return { screen: SCREEN_PLAY, best: 2 };
  }
  if (name === 'foot') {
    // On foot by Marina Bay: the player standing by a taxi to steal,
    // pedestrians strolling, the beach and the water behind them.
    world.reset(0);
    world.player.x = 1900;
    world.player.y = 2075;
    world.player.angle = -Math.PI / 2;
    world.addCar('taxi', 1900, 2000, Math.PI / 2, 'parked');
    const idle = {
      move() {
        return { x: 0, y: 0 };
      },
      get run() {
        return false;
      },
      takeActions() {
        return 0;
      },
      get firing() {
        return false;
      },
    };
    for (let i = 0; i < Math.floor(2 / STEP); i += 1) {
      world.step(STEP, idle, { x: 640, y: 360 }, 1, 0, 0);
    }
    return { screen: SCREEN_PLAY, best: 0 };
  }
  // Title: a lively city behind the start screen.
  world.reset(0);
  stepWorld(world, 4, 0);
  return { screen: SCREEN_TITLE, best: world.missionsDone };
}

export { SCREEN_OVER, SCREEN_PAUSED };
