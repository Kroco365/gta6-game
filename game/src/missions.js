// The story: five jobs for Rico Vega, wheelman for the Marlin Crew in Solmarina.
// Each mission is a small state machine: setup() places what it needs, update()
// runs every step and returns 'active', 'complete' or 'failed', and objective()
// is the line the HUD shows. All places, names and the story are original.

import { dist } from './random.js';

function marker(x, y, label) {
  return { x, y, label };
}

function within(world, x, y, r) {
  const p = world.playerCar || world.player;
  return dist(p.x, p.y, x, y) < r;
}

/** Cash-drop pickup the collector mission scatters around the city. */
function cashDrop(x, y) {
  return { kind: 'cash', x, y, amount: 60, taken: false };
}

export const MISSIONS = [
  {
    id: 'first-job',
    title: 'Job 1 — First Run',
    brief: 'Marlon needs a package moved from the Portside Docks to the Palm Motel. No questions, no stops.',
    reward: 300,
    setup(world) {
      world.mission.marker = marker(world.city.places.docks.x, world.city.places.docks.y, 'Docks');
      world.mission.stage = 0;
      world.mission.hold = 0;
    },
    objective(world) {
      return world.mission.stage === 0
        ? 'Drive to the Portside Docks and pick up the package'
        : 'Deliver the package to the Palm Motel';
    },
    update(world, dt) {
      const m = world.mission;
      const target = m.stage === 0 ? world.city.places.docks : world.city.places.motel;
      if (within(world, target.x, target.y, 90)) {
        m.hold += dt;
        if (m.hold > 1.2) {
          if (m.stage === 0) {
            m.stage = 1;
            m.hold = 0;
            m.marker = marker(world.city.places.motel.x, world.city.places.motel.y, 'Motel');
            world.say('Package secured. Now the Palm Motel — and keep it quiet.');
          } else {
            return 'complete';
          }
        }
      } else {
        m.hold = 0;
      }
      return 'active';
    },
  },
  {
    id: 'hot-comet',
    title: 'Job 2 — Hot Comet',
    brief: 'A teal Comet sports car is parked by Coral Plaza. Take it — then shake the heat. Lose every star.',
    reward: 400,
    setup(world) {
      const plaza = world.city.places.plaza;
      const car = world.addCar('sports', plaza.x + 60, plaza.y + 40, 0, 'parked');
      car.marked = true;
      world.mission.carId = car.id;
      world.mission.stage = 0;
      world.mission.marker = marker(plaza.x + 60, plaza.y + 40, 'Comet');
      world.say('The Comet is parked by Coral Plaza. Get in it.');
    },
    objective(world) {
      return world.mission.stage === 0 ? 'Steal the teal Comet by Coral Plaza' : 'Lose the heat — get to 0 stars';
    },
    update(world) {
      const m = world.mission;
      if (m.stage === 0) {
        const car = world.cars.find((c) => c.id === m.carId);
        if (car && car.driver === 'player') {
          m.stage = 1;
          m.marker = null;
          world.setWanted(2);
          world.say('That\u2019s the one. Now lose them!');
        }
        return 'active';
      }
      if (world.player.wanted === 0) return 'complete';
      return 'active';
    },
  },
  {
    id: 'collector',
    title: 'Job 3 — The Collector',
    brief: 'Five drops of crew cash are stashed around town. Scoop them all up before the clock runs out.',
    reward: 500,
    timeLimit: 150,
    setup(world) {
      const spots = [
        { x: 300, y: 250 },
        { x: 2700, y: 600 },
        { x: 1100, y: 2000 },
        { x: 3100, y: 1650 },
        { x: 1900, y: 2350 },
      ];
      world.mission.drops = spots.map((s) => cashDrop(s.x, s.y));
      world.mission.left = spots.length;
      world.mission.marker = marker(spots[0].x, spots[0].y, 'Cash');
      world.say('Five drops. Grab them all — the clock is running.');
    },
    objective(world) {
      return `Collect the crew cash — ${world.mission.left} left`;
    },
    update(world, dt) {
      const m = world.mission;
      for (const drop of m.drops) {
        if (!drop.taken && within(world, drop.x, drop.y, 70)) {
          drop.taken = true;
          m.left -= 1;
          world.player.money += drop.amount;
          world.audio.cash();
          world.say(`Cash grabbed — ${m.left} to go.`);
          const next = m.drops.find((d) => !d.taken);
          m.marker = next ? marker(next.x, next.y, 'Cash') : null;
        }
      }
      if (m.left <= 0) return 'complete';
      if (m.timeLeft !== undefined) {
        m.timeLeft -= dt;
        if (m.timeLeft <= 0) return 'failed';
      }
      return 'active';
    },
  },
  {
    id: 'courier',
    title: 'Job 4 — Stop the Courier',
    brief: 'A courier is carrying the crew\u2019s ledger across town. Ram his van three times to stop it, then take the briefcase.',
    reward: 700,
    setup(world) {
      const van = world.addCar('van', 1500, 600, 0, 'courier');
      van.courierHits = 0;
      world.mission.carId = van.id;
      world.mission.stage = 0;
      world.mission.marker = marker(van.x, van.y, 'Courier');
      world.say('There\u2019s the courier van. Ram it three times to stop it.');
    },
    objective(world) {
      const van = world.cars.find((c) => c.id === world.mission.carId);
      const hits = van ? van.courierHits || 0 : 0;
      return world.mission.stage === 0
        ? `Ram the courier van — ${3 - hits} hits to go`
        : 'Grab the briefcase from the stopped van';
    },
    update(world, dt) {
      const m = world.mission;
      const van = world.cars.find((c) => c.id === m.carId);
      if (!van) return 'failed';
      m.marker = marker(van.x, van.y, 'Courier');
      if (m.stage === 0) {
        if ((van.courierHits || 0) >= 3) {
          m.stage = 1;
          van.speed = 0;
          van.driver = 'parked';
          van.courierHits = 3;
          world.mission.briefcase = { x: van.x + 50, y: van.y + 30, taken: false };
          m.marker = marker(van.x + 50, van.y + 30, 'Briefcase');
          world.say('He\u2019s stopped. Take the briefcase.');
        }
        return 'active';
      }
      const b = world.mission.briefcase;
      if (b && !b.taken && within(world, b.x, b.y, 70)) {
        b.taken = true;
        world.audio.cash();
        return 'complete';
      }
      void dt;
      return 'active';
    },
  },
  {
    id: 'getaway',
    title: 'Job 5 — The Big Getaway',
    brief: 'The whole crew\u2019s take is in your trunk and the city is at three stars. Get to Solmarina Airfield before the clock runs out.',
    reward: 1200,
    timeLimit: 180,
    setup(world) {
      world.setWanted(3);
      world.mission.marker = marker(world.city.places.airport.x, world.city.places.airport.y, 'Airfield');
      world.say('Three stars and a trunk full of cash. Drive — the airfield, now!');
    },
    objective() {
      return 'Reach Solmarina Airfield with the take';
    },
    update(world, dt) {
      const m = world.mission;
      if (within(world, world.city.places.airport.x, world.city.places.airport.y, 100)) {
        m.hold = (m.hold || 0) + dt;
        if (m.hold > 1.2) return 'complete';
      } else {
        m.hold = 0;
      }
      if (m.timeLeft !== undefined) {
        m.timeLeft -= dt;
        if (m.timeLeft <= 0) return 'failed';
      }
      return 'active';
    },
  },
];
