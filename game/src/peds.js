// Pedestrians. They stroll the sidewalks, wait at corners, and run when
// something scary happens nearby: a speeding car, a gunshot, a body on the ground.

import { BEACH, PALETTE, PEDS, ROADS } from './config.js';
import { dist } from './random.js';

function sidewalkPoint(rng) {
  // A point just off a road edge (on the sidewalk), inside the city.
  if (rng.chance(0.5)) {
    const x = rng.pick(ROADS.vertical) + rng.pick([-ROADS.halfWidth - 12, ROADS.halfWidth + 12]);
    return { x, y: rng.range(140, BEACH.sandY - 60) };
  }
  const y = rng.pick(ROADS.horizontal) + rng.pick([-ROADS.halfWidth - 12, ROADS.halfWidth + 12]);
  return { x: rng.range(140, 3460), y };
}

export function spawnPed(rng) {
  const p = sidewalkPoint(rng);
  return {
    x: p.x,
    y: p.y,
    angle: rng.range(0, Math.PI * 2),
    speed: 0,
    target: sidewalkPoint(rng),
    state: 'walk',
    color: rng.pick(PALETTE.ped),
    wait: 0,
    down: 0,
    fleeX: 0,
    fleeY: 0,
  };
}

/**
 * One pedestrian. `threat` is {x, y, radius} or null: inside it they run away.
 * Returns 'down' when this ped was just knocked over (the caller scores it).
 */
export function stepPed(ped, dt, rng, threat) {
  if (ped.down > 0) {
    ped.down -= dt;
    return null;
  }
  if (threat && dist(ped.x, ped.y, threat.x, threat.y) < threat.radius) {
    ped.state = 'flee';
    ped.fleeX = ped.x - threat.x;
    ped.fleeY = ped.y - threat.y;
  }
  if (ped.state === 'flee') {
    const d = Math.hypot(ped.fleeX, ped.fleeY) || 1;
    ped.angle = Math.atan2(ped.fleeY / d, ped.fleeX / d);
    ped.speed = PEDS.runSpeed;
    ped.x += Math.cos(ped.angle) * ped.speed * dt;
    ped.y += Math.sin(ped.angle) * ped.speed * dt;
    ped.x = Math.max(80, Math.min(3520, ped.x));
    ped.y = Math.max(80, Math.min(BEACH.sandY - 20, ped.y));
    if (threat && dist(ped.x, ped.y, threat.x, threat.y) > threat.radius * 2.2) ped.state = 'walk';
    return null;
  }
  if (ped.wait > 0) {
    ped.wait -= dt;
    ped.speed = 0;
    return null;
  }
  const dx = ped.target.x - ped.x;
  const dy = ped.target.y - ped.y;
  const d = Math.hypot(dx, dy);
  if (d < 14) {
    ped.target = sidewalkPoint(rng);
    if (rng.chance(0.25)) ped.wait = rng.range(1, 4);
    ped.speed = 0;
    return null;
  }
  ped.angle = Math.atan2(dy, dx);
  ped.speed = PEDS.walkSpeed * rng.range(0.8, 1.2);
  ped.x += Math.cos(ped.angle) * ped.speed * dt;
  ped.y += Math.sin(ped.angle) * ped.speed * dt;
  return null;
}

/** Knock a pedestrian down (car hit or bullet): they stay down a while. */
export function knockDown(ped, seconds) {
  ped.down = seconds;
  ped.state = 'walk';
  ped.speed = 0;
}
