// The world: everything that moves and everything that scores. The player
// walks or drives, traffic and pedestrians live their own lives, police respond
// to the wanted level, and the mission state machine drives the story.

import { BEACH, CAR, PLAYER, SAVE_KEY, STEP, WANTED, WORLD } from './config.js';
import { createCity, clampToWorld, hitsBuilding, isOnRoad, pushOutOfBuildings } from './city.js';
import { createAudio } from './audio.js';
import { createRandom, angleDiff, clamp, dist } from './random.js';
import { MISSIONS } from './missions.js';
import { collideCars, makeCar, policeWanted, spawnTrafficCar, stepPoliceCar, stepTrafficCar } from './traffic.js';
import { knockDown, spawnPed, stepPed } from './peds.js';

const PUNCH_COOLDOWN = 0.45;
const SHOT_COOLDOWN = 0.22;

export function createWorld(seed) {
  const rng = createRandom(seed);
  const city = createCity();
  const audio = createAudio();
  const world = {
    city,
    audio,
    rng,
    time: 0,
    player: null,
    cars: [],
    peds: [],
    particles: [],
    bullets: [],
    mission: null,
    missionIndex: 0,
    missionsDone: 0,
    message: '',
    messageTimer: 0,
    banner: '',
    bannerTimer: 0,
    screen: 'title',
    hideTimer: 0,
    bustTimer: 0,
    stats: { stolen: 0, hits: 0, busted: 0, wasted: 0 },
    save: null,
  };

  world.say = (text) => {
    world.message = text;
    world.messageTimer = 5;
  };
  world.showBanner = (text, seconds) => {
    world.banner = text;
    world.bannerTimer = seconds || 3;
  };

  world.addCar = (type, x, y, angle, driver) => {
    const car = makeCar(type, x, y, angle, driver, rng);
    world.cars.push(car);
    return car;
  };

  world.setWanted = (stars) => {
    world.player.wanted = clamp(stars, 0, WANTED.max);
    world.hideTimer = 0;
  };

  function loadSave() {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      world.save = raw ? JSON.parse(raw) : { money: 0, missionsDone: 0, best: 0 };
    } catch {
      world.save = { money: 0, missionsDone: 0, best: 0 };
    }
  }

  world.writeSave = () => {
    try {
      window.localStorage.setItem(
        SAVE_KEY,
        JSON.stringify({ money: world.player.money, missionsDone: world.missionsDone, best: world.save.best || 0 }),
      );
    } catch {
      // Storage can be off: progress then lasts this visit only.
    }
  };

  function resetPlayer() {
    const start = city.places.hideout;
    world.player = {
      x: start.x,
      y: start.y + 60,
      angle: -Math.PI / 2,
      health: PLAYER.health,
      money: world.save.money || 0,
      wanted: 0,
      ammo: PLAYER.pistolAmmo,
      car: null,
      punchCd: 0,
      shotCd: 0,
      speed: 0,
    };
    world.missionsDone = world.save.missionsDone || 0;
    world.missionIndex = world.missionsDone;
  }

  function seedTraffic() {
    world.cars = [];
    world.peds = [];
    for (let i = 0; i < 14; i += 1) world.cars.push(spawnTrafficCar(rng, city));
    for (const parked of city.parked) {
      const car = makeCar(parked.type, parked.x, parked.y, parked.angle, 'parked', rng);
      world.cars.push(car);
    }
    for (let i = 0; i < 26; i += 1) world.peds.push(spawnPed(rng));
  }

  world.reset = (missionIndex) => {
    loadSave();
    seedTraffic();
    world.particles = [];
    world.bullets = [];
    world.time = 0;
    world.hideTimer = 0;
    world.bustTimer = 0;
    world.message = '';
    world.banner = '';
    resetPlayer();
    if (typeof missionIndex === 'number') world.missionIndex = missionIndex;
    startMission(world.missionIndex);
  };

  function startMission(index) {
    const def = MISSIONS[index];
    if (!def) {
      world.mission = null;
      return;
    }
    world.mission = {
      def,
      index,
      stage: 0,
      timeLeft: def.timeLimit || undefined,
      marker: null,
      hold: 0,
    };
    def.setup(world);
    world.showBanner(`${def.title} — $${def.reward}`, 3.5);
    world.say(def.brief);
  }

  world.nextMission = () => {
    world.missionsDone = Math.max(world.missionsDone, world.missionIndex + 1);
    world.writeSave();
    world.missionIndex += 1;
    if (world.missionIndex < MISSIONS.length) {
      startMission(world.missionIndex);
    } else {
      world.mission = null;
      world.showBanner('Story complete — Solmarina is yours, Rico.', 6);
      world.say('Every job done. The Marlin Crew owes you one.');
    }
  };

  world.failMission = (reason) => {
    world.showBanner(`Job failed — ${reason}`, 3.5);
    world.audio.failed();
    startMission(world.missionIndex);
  };

  /** The car the player is driving, or null. */
  Object.defineProperty(world, 'playerCar', {
    get() {
      return world.player && world.player.car ? world.player.car : null;
    },
  });

  function stepPlayerFoot(dt, input) {
    const p = world.player;
    const move = input.move();
    const speed = input.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
    let mx = move.x;
    let my = move.y;
    const len = Math.hypot(mx, my);
    if (len > 0) {
      mx /= len;
      my /= len;
      p.angle = Math.atan2(my, mx);
      p.x += mx * speed * dt;
      p.y += my * speed * dt;
      p.speed = speed;
    } else {
      p.speed = 0;
    }
    pushOutOfBuildings(city, p, PLAYER.radius);
    clampToWorld(p, PLAYER.radius + 4);
  }

  function stepPlayerCar(dt, input, car) {
    const spec = CAR.types[car.type];
    const move = input.move();
    const throttle = -move.y; // W is up (forward)
    const steer = move.x;
    if (throttle > 0) {
      car.speed += spec.accel * dt;
    } else if (throttle < 0) {
      // S brakes while moving forward, and reverses once the car has stopped.
      if (car.speed > 8) car.speed -= spec.accel * 1.4 * dt;
      else car.speed = Math.max(car.speed - spec.reverse * dt, -spec.maxSpeed * 0.32);
    }
    car.speed = clamp(car.speed, -spec.maxSpeed * 0.32, spec.maxSpeed);
    if (Math.abs(car.speed) < 2 && throttle === 0) car.speed = 0;
    // Drag and rolling resistance.
    car.speed -= car.speed * 0.35 * dt;
    // Steering bites harder the faster the car goes; it flips when reversing.
    const grip = clamp(Math.abs(car.speed) / 220, 0, 1);
    car.angle += steer * 2.9 * dt * grip * (car.speed >= 0 ? 1 : -1);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    const hit = pushOutOfBuildings(city, car, CAR.length / 2 - 4);
    if (hit && Math.abs(car.speed) > 260) {
      audio.crash();
      car.damage += 2;
      car.speed *= 0.4;
      spawnSmoke(car.x, car.y, 6);
    }
    clampToWorld(car, CAR.length / 2);
    world.player.x = car.x;
    world.player.y = car.y;
    world.player.angle = car.angle;
    world.player.speed = Math.abs(car.speed);
  }

  function spawnSmoke(x, y, n) {
    for (let i = 0; i < n; i += 1) {
      world.particles.push({
        x: x + (rng.next() - 0.5) * 30,
        y: y + (rng.next() - 0.5) * 30,
        vx: (rng.next() - 0.5) * 40,
        vy: (rng.next() - 0.5) * 40,
        life: rng.range(0.4, 0.9),
        max: 0.9,
        kind: 'smoke',
      });
    }
  }

  function tryEnterCar() {
    const p = world.player;
    if (p.car) {
      const car = p.car;
      car.driver = 'parked';
      car.speed = 0;
      p.car = null;
      p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 44;
      p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 44;
      p.angle = car.angle;
      return;
    }
    let best = null;
    let bestD = PLAYER.enterRange;
    for (const car of world.cars) {
      if (car.driver === 'police' || car.driver === 'courier') continue;
      const d = dist(p.x, p.y, car.x, car.y);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    if (!best) return;
    if (best.driver === 'traffic') {
      world.stats.stolen += 1;
      world.setWanted(world.player.wanted + 1);
      world.say('Car jacked! The heat is on.');
      audio.crash();
    }
    best.driver = 'player';
    p.car = best;
  }

  function tryPunch() {
    const p = world.player;
    if (p.punchCd > 0 || p.car) return;
    p.punchCd = PUNCH_COOLDOWN;
    audio.punch();
    const px = p.x + Math.cos(p.angle) * PLAYER.punchRange;
    const py = p.y + Math.sin(p.angle) * PLAYER.punchRange;
    for (const ped of world.peds) {
      if (ped.down <= 0 && dist(px, py, ped.x, ped.y) < 26) {
        knockDown(ped, 6);
        world.setWanted(world.player.wanted + 1);
        world.say('That\u2019s assault, Rico. The cops noticed.');
        return;
      }
    }
    for (const car of world.cars) {
      if (car.driver === 'police' && dist(px, py, car.x, car.y) < 50) {
        world.setWanted(world.player.wanted + 1);
        return;
      }
    }
  }

  function tryShoot(mouse, viewScale, camX, camY) {
    const p = world.player;
    if (p.shotCd > 0 || p.ammo <= 0) return;
    p.shotCd = SHOT_COOLDOWN;
    p.ammo -= 1;
    audio.shot();
    // Aim from the player toward the mouse in world coordinates.
    const wx = camX + mouse.x / viewScale;
    const wy = camY + mouse.y / viewScale;
    const angle = Math.atan2(wy - p.y, wx - p.x);
    p.angle = angle;
    const range = 520;
    const ex = p.x + Math.cos(angle) * range;
    const ey = p.y + Math.sin(angle) * range;
    world.bullets.push({ x: p.x, y: p.y, ex, ey, life: 0.12 });
    world.particles.push({ x: p.x + Math.cos(angle) * 22, y: p.y + Math.sin(angle) * 22, vx: 0, vy: 0, life: 0.08, max: 0.08, kind: 'flash' });
    let hitSomething = false;
    for (const ped of world.peds) {
      if (ped.down > 0) continue;
      const d = Math.abs((ped.x - p.x) * Math.sin(angle) - (ped.y - p.y) * Math.cos(angle));
      const along = (ped.x - p.x) * Math.cos(angle) + (ped.y - p.y) * Math.sin(angle);
      if (d < 18 && along > 0 && along < range) {
        knockDown(ped, 8);
        world.setWanted(world.player.wanted + 1);
        hitSomething = true;
      }
    }
    for (const car of world.cars) {
      if (car.driver === 'player') continue;
      const d = Math.abs((car.x - p.x) * Math.sin(angle) - (car.y - p.y) * Math.cos(angle));
      const along = (car.x - p.x) * Math.cos(angle) + (car.y - p.y) * Math.sin(angle);
      if (d < 26 && along > 0 && along < range) {
        car.damage += 6;
        hitSomething = true;
        if (car.driver === 'police') world.setWanted(world.player.wanted + 1);
      }
    }
    if (hitSomething) spawnSmoke(ex, ey, 2);
  }

  function stepPolice(dt) {
    const p = world.player;
    const want = policeWanted(p.wanted);
    const police = world.cars.filter((c) => c.driver === 'police');
    // Spawn more police when the wanted level calls for them.
    if (police.length < want) {
      const angle = rng.range(0, Math.PI * 2);
      const car = world.addCar('police', p.x + Math.cos(angle) * 700, p.y + Math.sin(angle) * 700, angle, 'police');
      car.cruise = CAR.types.police.maxSpeed;
    }
    // Extra police leave when the heat drops.
    if (police.length > want) {
      const extra = police[police.length - 1];
      world.cars.splice(world.cars.indexOf(extra), 1);
    }
    let anyNear = false;
    for (const car of world.cars) {
      if (car.driver !== 'police') continue;
      stepPoliceCar(car, dt, p, p.car, city);
      const d = dist(car.x, car.y, p.x, p.y);
      if (d < 900) anyNear = true;
      // A slow on-foot player caught by a cop gets busted.
      if (!p.car && d < WANTED.bustRange && p.speed < 60) {
        world.bustTimer += dt;
        if (world.bustTimer > WANTED.bustTime) {
          world.stats.busted += 1;
          world.screen = 'busted';
          return;
        }
      }
    }
    if (!anyNear && p.wanted > 0) {
      world.hideTimer += dt;
      if (world.hideTimer > WANTED.hideTime) {
        world.hideTimer = 0;
        world.setWanted(p.wanted - 1);
        if (p.wanted === 0) world.say('You lost them. Clean — for now.');
      }
    } else {
      world.hideTimer = 0;
    }
    world.bustTimer = Math.max(0, world.bustTimer - dt * 0.5);
  }

  function stepTrafficAndPeds(dt) {
    const p = world.player;
    const car = p.car;
    // A threat makes nearby pedestrians flee.
    const threat = car && Math.abs(car.speed) > 300 ? { x: car.x, y: car.y, radius: 260 } : null;
    for (const c of world.cars) {
      if (c.driver === 'traffic') stepTrafficCar(c, dt, rng, world.cars);
    }
    for (const ped of world.peds) {
      stepPed(ped, dt, rng, threat);
      // A speeding car that runs a pedestrian over.
      if (car && Math.abs(car.speed) > 120 && ped.down <= 0 && dist(car.x, car.y, ped.x, ped.y) < 34) {
        knockDown(ped, 8);
        world.setWanted(p.wanted + 1);
        world.say('You ran someone over! The city saw that.');
        audio.crash();
        car.speed *= 0.7;
      }
    }
    // Car-vs-car collisions.
    for (let i = 0; i < world.cars.length; i += 1) {
      for (let j = i + 1; j < world.cars.length; j += 1) {
        const a = world.cars[i];
        const b = world.cars[j];
        if (a.driver === 'parked' && b.driver === 'parked') continue;
        if (collideCars(a, b)) {
          // Ramming the courier van counts toward its mission.
          if (a.driver === 'player' && b.driver === 'courier') {
            b.courierHits = (b.courierHits || 0) + 1;
            world.say(`Hit ${b.courierHits} of 3!`);
            audio.crash();
          } else if (b.driver === 'player' && a.driver === 'courier') {
            a.courierHits = (a.courierHits || 0) + 1;
            world.say(`Hit ${a.courierHits} of 3!`);
            audio.crash();
          } else if (a.driver === 'player' || b.driver === 'player') {
            audio.crash();
          }
        }
      }
    }
    // Cars that took too much damage smoke.
    for (const c of world.cars) {
      if (c.damage > 14 && rng.chance(0.1)) spawnSmoke(c.x, c.y, 1);
    }
  }

  function stepMission(dt) {
    if (!world.mission) return;
    const m = world.mission;
    if (m.timeLeft !== undefined && m.timeLeft > 0) {
      m.timeLeft -= dt;
    }
    const result = m.def.update(world, dt);
    if (result === 'complete') {
      const reward = m.def.reward;
      world.player.money += reward;
      world.audio.missionDone();
      world.showBanner(`${m.def.title} complete — +$${reward}`, 4);
      world.say(`Nice work. $${reward} in your pocket.`);
      world.nextMission();
    } else if (result === 'failed') {
      world.failMission('time ran out');
    }
  }

  function stepHealth() {
    const p = world.player;
    if (p.health <= 0) {
      world.stats.wasted += 1;
      world.screen = 'wasted';
    }
  }

  /** Advance the simulation one fixed step. `input` is the input device. */
  world.step = (dt, input, mouse, viewScale, camX, camY) => {
    world.time += dt;
    const p = world.player;
    p.punchCd = Math.max(0, p.punchCd - dt);
    p.shotCd = Math.max(0, p.shotCd - dt);
    if (world.messageTimer > 0) world.messageTimer -= dt;
    if (world.bannerTimer > 0) world.bannerTimer -= dt;

    const actions = input.takeActions() | (world.pendingActions || 0);
    world.pendingActions = 0;
    if (actions & 4) tryEnterCar();
    if (actions & 8) tryPunch();
    if (input.firing && !p.car) tryShoot(mouse, viewScale, camX, camY);

    if (p.car) stepPlayerCar(dt, input, p.car);
    else stepPlayerFoot(dt, input);

    stepTrafficAndPeds(dt);
    stepPolice(dt);
    stepMission(dt);
    stepHealth();

    for (const b of world.bullets) b.life -= dt;
    world.bullets = world.bullets.filter((b) => b.life > 0);
    for (const pt of world.particles) {
      pt.life -= dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
    }
    world.particles = world.particles.filter((pt) => pt.life > 0);

    // The engine hum and siren follow the chase.
    const chasing = world.cars.some((c) => c.driver === 'police');
    audio.update(dt, p.car ? Math.abs(p.car.speed) / CAR.types[p.car.type].maxSpeed : 0, chasing);

    // Keep traffic topped up if some drove off the grid.
    if (world.cars.filter((c) => c.driver === 'traffic').length < 10) {
      world.cars.push(spawnTrafficCar(rng, city));
    }
  };

  world.reset(0);
  return world;
}
