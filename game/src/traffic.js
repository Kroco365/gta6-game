// Traffic and police. Traffic cars drive the road grid: each one follows a
// centreline to the next intersection, then picks a new direction at random.
// Police cars chase the player with a simple pursuit steer and try to ram them.

import { CAR, ROADS, TRAFFIC, WANTED } from './config.js';
import { pushOutOfBuildings } from './city.js';
import { angleDiff, clamp, dist } from './random.js';

const CAR_HALF = CAR.length / 2;

function randomTrafficType(rng) {
  return rng.pick(['sedan', 'sedan', 'taxi', 'van', 'sports', 'truck']);
}

/** A traffic car starting on a road point, heading along one axis. */
export function spawnTrafficCar(rng, city, point) {
  const axis = point ? 'v' : rng.chance(0.5) ? 'v' : 'h';
  const type = randomTrafficType(rng);
  let x;
  let y;
  let angle;
  if (axis === 'v') {
    x = point ? point.x : rng.pick(ROADS.vertical);
    y = point ? point.y : rng.range(140, 2200);
    angle = rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2;
  } else {
    x = point ? point.x : rng.range(140, 3400);
    y = point ? point.y : rng.pick(ROADS.horizontal);
    angle = rng.chance(0.5) ? 0 : Math.PI;
  }
  return makeCar(type, x, y, angle, 'traffic', rng);
}

export function makeCar(type, x, y, angle, driver, rng) {
  const spec = CAR.types[type];
  return {
    type,
    x,
    y,
    angle,
    speed: 0,
    driver,
    color: type === 'police' ? spec.color : spec.color,
    cruise: TRAFFIC.speed + (rng ? rng.range(-TRAFFIC.speedJitter, TRAFFIC.speedJitter) : 0),
    target: null,
    stuck: 0,
    siren: 0,
    damage: 0,
    id: Math.floor(Math.random() * 1e9),
  };
}

/** The intersection a traffic car is heading for, given its axis and direction. */
function nextIntersection(car) {
  const movingX = Math.abs(Math.cos(car.angle)) > 0.7;
  if (movingX) {
    const dir = Math.cos(car.angle) > 0 ? 1 : -1;
    const xs = ROADS.vertical.filter((x) => (dir > 0 ? x > car.x + 30 : x < car.x - 30));
    const nx = dir > 0 ? Math.min(...xs) : Math.max(...xs);
    return { x: nx, y: car.y, axis: 'h' };
  }
  const dir = Math.sin(car.angle) > 0 ? 1 : -1;
  const ys = ROADS.horizontal.filter((y) => (dir > 0 ? y > car.y + 30 : y < car.y - 30));
  const ny = dir > 0 ? Math.min(...ys) : Math.max(...ys);
  return { x: car.x, y: ny, axis: 'v' };
}

function pickNewDirection(car, rng) {
  // At an intersection: keep going, turn left or turn right (never reverse).
  const movingX = Math.abs(Math.cos(car.angle)) > 0.7;
  const forward = car.angle;
  const choices = [forward, forward + Math.PI / 2, forward - Math.PI / 2];
  car.angle = rng.pick(choices);
  car.target = null;
  void movingX;
}

/** One traffic car: cruise along its road, slow for the car ahead, turn at intersections. */
export function stepTrafficCar(car, dt, rng, cars) {
  if (!car.target) car.target = nextIntersection(car);
  const tx = car.target.x;
  const ty = car.target.y;
  const want = Math.atan2(ty - car.y, tx - car.x);
  const turn = clamp(angleDiff(car.angle, want), -2.2 * dt, 2.2 * dt);
  car.angle += turn;
  // Slow down when another car is close ahead.
  let slow = false;
  for (const other of cars) {
    if (other === car || other.driver === 'parked') continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const ahead = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
    const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
    if (ahead > 0 && ahead < 110 && side < 40) {
      slow = true;
      break;
    }
  }
  const target = slow ? 0 : car.cruise;
  car.speed += clamp(target - car.speed, -500 * dt, 260 * dt);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  if (dist(car.x, car.y, tx, ty) < 26) pickNewDirection(car, rng);
  // Off the grid (should not happen): put it back on a road.
  if (car.x < 80 || car.x > 3520 || car.y < 80 || car.y > 2240) {
    car.x = clamp(car.x, 120, 3480);
    car.y = clamp(car.y, 120, 2200);
    car.target = null;
  }
}

/** A police car chasing the player: steer at them, ram at speed, brake to stay close. */
export function stepPoliceCar(car, dt, player, playerCar, city) {
  const tx = playerCar ? playerCar.x : player.x;
  const ty = playerCar ? playerCar.y : player.y;
  const want = Math.atan2(ty - car.y, tx - car.x);
  const spec = CAR.types.police;
  const d = dist(car.x, car.y, tx, ty);
  const turnRate = 3.2;
  car.angle += clamp(angleDiff(car.angle, want), -turnRate * dt, turnRate * dt);
  const target = d > 90 ? spec.maxSpeed : spec.maxSpeed * 0.55;
  car.speed += clamp(target - car.speed, -600 * dt, 420 * dt);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.siren += dt;
  // Police cut corners across lawns and lots, but never through a building.
  if (city && pushOutOfBuildings(city, car, CAR.length / 2 - 4)) {
    car.speed *= 0.45;
  }
  // If the chase leaves the road network far behind, nudge the car back toward a road.
  if (car.x < 60 || car.x > 3540 || car.y < 60 || car.y > 2460) {
    car.x = clamp(car.x, 90, 3510);
    car.y = clamp(car.y, 90, 2430);
  }
}

/** How many police cars the wanted level calls for. */
export function policeWanted(stars) {
  return WANTED.policePerStar[Math.min(stars, WANTED.max)] || 0;
}

/** Car-vs-car collision: push apart and trade a little speed. */
export function collideCars(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.hypot(dx, dy);
  const min = CAR_HALF + 14;
  if (d >= min || d < 0.01) return false;
  const push = (min - d) / 2;
  const nx = dx / d;
  const ny = dy / d;
  a.x -= nx * push;
  a.y -= ny * push;
  b.x += nx * push;
  b.y += ny * push;
  const avg = (a.speed + b.speed) / 2;
  a.speed = avg * 0.6;
  b.speed = avg * 0.6;
  a.damage += 1;
  b.damage += 1;
  return true;
}
