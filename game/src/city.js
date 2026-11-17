// Solmarina: the city itself. A fixed road grid with blocks between the streets;
// each block holds buildings, trees, a park or a parking lot. The layout is built
// once from a fixed seed, so every run plays the same city; only traffic and
// pedestrians are re-seeded per run.

import { BEACH, PALETTE, ROADS, WORLD } from './config.js';
import { createRandom } from './random.js';

const CITY_SEED = 20261117;

/** Named places the story and the missions point at. */
export const PLACES = {
  hideout: { x: 700, y: 1300, name: 'Rico\u2019s Hideout' },
  docks: { x: 3350, y: 1300, name: 'Portside Docks' },
  motel: { x: 420, y: 600, name: 'Palm Motel' },
  airport: { x: 3300, y: 250, name: 'Solmarina Airfield' },
  marina: { x: 1900, y: 2380, name: 'Marina Bay' },
  plaza: { x: 1500, y: 950, name: 'Coral Plaza' },
};

/** Build the city once. Returns roads, blocks, buildings, trees and spawn points. */
export function createCity() {
  const rng = createRandom(CITY_SEED);
  const buildings = [];
  const trees = [];
  const blocks = [];
  const parked = [];

  const xs = ROADS.vertical;
  const ys = ROADS.horizontal;
  const hw = ROADS.halfWidth;

  // The park: one whole block of green in the middle of town.
  const parkBlock = { col: 3, row: 2 };

  for (let col = 0; col < xs.length - 1; col += 1) {
    for (let row = 0; row < ys.length - 1; row += 1) {
      const x0 = xs[col] + hw + 14;
      const x1 = xs[col + 1] - hw - 14;
      const y0 = ys[row] + hw + 14;
      const y1 = ys[row + 1] - hw - 14;
      const block = { x0, y0, x1, y1, col, row };
      blocks.push(block);

      if (col === parkBlock.col && row === parkBlock.row) {
        block.kind = 'park';
        for (let i = 0; i < 26; i += 1) {
          trees.push({ x: rng.range(x0 + 20, x1 - 20), y: rng.range(y0 + 20, y1 - 20), r: rng.range(9, 15) });
        }
        block.pond = { x: (x0 + x1) / 2, y: (y0 + y1) / 2, r: 52 };
        continue;
      }

      // A parking lot block: flat, with a few parked cars.
      if (rng.chance(0.14)) {
        block.kind = 'parking';
        const n = rng.int(3, 5);
        for (let i = 0; i < n; i += 1) {
          parked.push({
            x: rng.range(x0 + 40, x1 - 40),
            y: rng.range(y0 + 40, y1 - 40),
            angle: rng.pick([0, Math.PI / 2]),
            type: rng.pick(['sedan', 'taxi', 'van']),
          });
        }
        for (let i = 0; i < 4; i += 1) {
          trees.push({ x: rng.range(x0 + 16, x1 - 16), y: rng.range(y0 + 16, y1 - 16), r: rng.range(8, 12) });
        }
        continue;
      }

      block.kind = 'built';
      const downtown = col >= 2 && col <= 4 && row >= 1 && row <= 3;
      const bw = (x1 - x0) / 2;
      const bh = (y1 - y0) / 2;
      // Up to four buildings per block, two by two, with a courtyard gap.
      for (let bx = 0; bx < 2; bx += 1) {
        for (let by = 0; by < 2; by += 1) {
          if (rng.chance(0.12)) continue;
          const w = bw * rng.range(0.55, 0.8);
          const h = bh * rng.range(0.55, 0.8);
          const cx = x0 + bx * bw + bw / 2;
          const cy = y0 + by * bh + bh / 2;
          buildings.push({
            x: cx - w / 2,
            y: cy - h / 2,
            w,
            h,
            color: rng.pick(PALETTE.building),
            tall: downtown && rng.chance(0.6),
          });
        }
      }
      for (let i = 0; i < 3; i += 1) {
        trees.push({ x: rng.range(x0 + 14, x1 - 14), y: rng.range(y0 + 14, y1 - 14), r: rng.range(8, 13) });
      }
    }
  }

  return { buildings, trees, blocks, parked, places: PLACES };
}

/** True when (x, y) is on a road (asphalt), not on a block or the beach. */
export function isOnRoad(x, y) {
  if (y >= BEACH.sandY) return false;
  for (const rx of ROADS.vertical) {
    if (Math.abs(x - rx) <= ROADS.halfWidth) return true;
  }
  for (const ry of ROADS.horizontal) {
    if (Math.abs(y - ry) <= ROADS.halfWidth) return true;
  }
  return false;
}

/** The nearest point on a road centreline to (x, y), plus which axis it sits on. */
export function nearestRoadPoint(x, y) {
  let best = null;
  for (const rx of ROADS.vertical) {
    const d = Math.abs(x - rx);
    if (!best || d < best.d) best = { x: rx, y, axis: 'v', d };
  }
  for (const ry of ROADS.horizontal) {
    const d = Math.abs(y - ry);
    if (!best || d < best.d) best = { x, y: ry, axis: 'h', d };
  }
  return best;
}

/** A random point on a road, for spawning traffic and pedestrians. */
export function randomRoadPoint(rng) {
  if (rng.chance(0.5)) {
    return { x: rng.pick(ROADS.vertical), y: rng.range(120, BEACH.sandY - 60) };
  }
  return { x: rng.range(140, WORLD.width - 140), y: rng.pick(ROADS.horizontal) };
}

/** True when the circle at (x, y, r) overlaps any building. */
export function hitsBuilding(city, x, y, r) {
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(y, b.y + b.h));
    if ((x - cx) ** 2 + (y - cy) ** 2 < r * r) return b;
  }
  return null;
}

/** Push a circle out of buildings; returns true when it was pushed. */
export function pushOutOfBuildings(city, body, r) {
  let pushed = false;
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(body.x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(body.y, b.y + b.h));
    const dx = body.x - cx;
    const dy = body.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r && d2 > 0.01) {
      const d = Math.sqrt(d2);
      body.x = cx + (dx / d) * r;
      body.y = cy + (dy / d) * r;
      pushed = true;
    } else if (d2 <= 0.01) {
      // Centre inside the building: push out along the shortest side.
      const left = body.x - b.x;
      const right = b.x + b.w - body.x;
      const top = body.y - b.y;
      const bottom = b.y + b.h - body.y;
      const m = Math.min(left, right, top, bottom);
      if (m === left) body.x = b.x - r;
      else if (m === right) body.x = b.x + b.w + r;
      else if (m === top) body.y = b.y - r;
      else body.y = b.y + b.h + r;
      pushed = true;
    }
  }
  return pushed;
}

/** Clamp a point inside the world, keeping it off the water. */
export function clampToWorld(body, margin) {
  body.x = Math.max(margin, Math.min(WORLD.width - margin, body.x));
  body.y = Math.max(margin, Math.min(BEACH.waterY - 30 - margin, body.y));
}
