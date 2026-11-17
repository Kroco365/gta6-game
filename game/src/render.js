// The renderer: a top-down camera that follows the player, the city drawn
// as sun-soaked streets and pastel blocks, and the HUD — minimap, wanted stars,
// health, money and the mission line — plus the title, pause and end screens.

import { BEACH, CAR, PALETTE, PLAYER, ROADS, VIEW, WANTED, WORLD } from './config.js';
import { clamp } from './random.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const MINIMAP = { x: 1072, y: 16, w: 192, h: 140 };

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let scale = 1;
  let camX = 0;
  let camY = 0;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(canvas.clientWidth * dpr);
    canvas.height = Math.floor(canvas.clientHeight * dpr);
    scale = Math.min(canvas.width / VIEW.width, canvas.height / VIEW.height);
  }

  function cameraFor(player) {
    const vw = canvas.width / scale;
    const vh = canvas.height / scale;
    camX = clamp(player.x - vw / 2, 0, Math.max(0, WORLD.width - vw));
    camY = clamp(player.y - vh / 2, 0, Math.max(0, WORLD.height - vh));
    return { camX, camY, scale };
  }

  function drawGround(city) {
    // Grass base, then the beach and the water at the south edge.
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(camX - 40, camY - 40, canvas.width / scale + 80, canvas.height / scale + 80);
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(camX - 40, BEACH.sandY, canvas.width / scale + 80, WORLD.height - BEACH.sandY + 40);
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(camX - 40, BEACH.waterY, canvas.width / scale + 80, WORLD.height - BEACH.waterY + 40);
    ctx.fillStyle = PALETTE.waterDeep;
    for (let x = Math.floor(camX / 90) * 90; x < camX + canvas.width / scale + 90; x += 90) {
      ctx.fillRect(x + 20, BEACH.waterY + 60, 46, 4);
    }
    // Sidewalk slabs around every block.
    ctx.fillStyle = PALETTE.sidewalk;
    for (const block of city.blocks) {
      ctx.fillRect(block.x0 - 12, block.y0 - 12, block.x1 - block.x0 + 24, block.y1 - block.y0 + 24);
    }
    // The park's pond.
    for (const block of city.blocks) {
      if (block.kind === 'park' && block.pond) {
        ctx.fillStyle = PALETTE.water;
        ctx.beginPath();
        ctx.arc(block.pond.x, block.pond.y, block.pond.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawRoads() {
    ctx.fillStyle = PALETTE.asphalt;
    for (const x of ROADS.vertical) ctx.fillRect(x - ROADS.halfWidth, -40, ROADS.halfWidth * 2, WORLD.height + 80);
    for (const y of ROADS.horizontal) ctx.fillRect(-40, y - ROADS.halfWidth, WORLD.width + 80, ROADS.halfWidth * 2);
    // Centre dashes.
    ctx.fillStyle = PALETTE.lane;
    for (const x of ROADS.vertical) {
      for (let y = Math.floor(camY / 44) * 44; y < camY + canvas.height / scale + 44; y += 44) {
        if ((y / 44) % 2 === 0) ctx.fillRect(x - 2, y, 4, 22);
      }
    }
    for (const y of ROADS.horizontal) {
      for (let x = Math.floor(camX / 44) * 44; x < camX + canvas.width / scale + 44; x += 44) {
        if ((x / 44) % 2 === 0) ctx.fillRect(x, y - 2, 22, 4);
      }
    }
  }

  function drawBuildings(city) {
    for (const b of city.buildings) {
      if (b.x + b.w < camX - 60 || b.x > camX + canvas.width / scale + 60) continue;
      if (b.y + b.h < camY - 60 || b.y > camY + canvas.height / scale + 60) continue;
      // Shadow, then the block, then a darker roof edge for tall ones.
      ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
      ctx.fillRect(b.x + 6, b.y + 8, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
      ctx.fillRect(b.x, b.y, b.w, 8);
      if (b.tall) {
        ctx.fillStyle = PALETTE.roof;
        ctx.fillRect(b.x + 10, b.y + 10, b.w - 20, b.h - 20);
        ctx.fillStyle = '#5a7ba6';
        ctx.fillRect(b.x + b.w / 2 - 12, b.y + b.h / 2 - 12, 24, 24);
      }
    }
    for (const t of city.trees) {
      if (t.x < camX - 30 || t.x > camX + canvas.width / scale + 30) continue;
      if (t.y < camY - 30 || t.y > camY + canvas.height / scale + 30) continue;
      ctx.fillStyle = PALETTE.treeDark;
      ctx.beginPath();
      ctx.arc(t.x + 2, t.y + 3, t.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.tree;
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawCar(car, flash) {
    const spec = CAR.types[car.type];
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    // Shadow.
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    roundRect(ctx, -CAR.length / 2 + 3, -CAR.width / 2 + 4, CAR.length, CAR.width, 8);
    ctx.fill();
    // Body.
    ctx.fillStyle = car.color;
    roundRect(ctx, -CAR.length / 2, -CAR.width / 2, CAR.length, CAR.width, 8);
    ctx.fill();
    // Roof and windshield.
    ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.fillRect(-8, -CAR.width / 2 + 4, 16, CAR.width - 8);
    ctx.fillStyle = '#1d2733';
    ctx.fillRect(CAR.length / 2 - 16, -CAR.width / 2 + 5, 8, CAR.width - 10);
    ctx.fillRect(-CAR.length / 2 + 6, -CAR.width / 2 + 5, 8, CAR.width - 10);
    // Headlights.
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(CAR.length / 2 - 2, -CAR.width / 2 + 3, 3, 6);
    ctx.fillRect(CAR.length / 2 - 2, CAR.width / 2 - 9, 3, 6);
    if (car.type === 'taxi') {
      ctx.fillStyle = '#222';
      ctx.font = 'bold 9px ' + 'system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('TAXI', 0, 3);
    }
    if (car.type === 'police') {
      ctx.fillStyle = '#e8e8e8';
      ctx.fillRect(-CAR.length / 2 + 2, -CAR.width / 2 + 2, CAR.length - 4, 5);
      // Flashing light bar.
      const on = Math.floor(car.siren * 4) % 2 === 0;
      ctx.fillStyle = on ? PALETTE.policeLight[0] : PALETTE.policeLight[1];
      ctx.fillRect(-6, -CAR.width / 2 - 3, 12, 6);
      if (flash) {
        ctx.fillStyle = on ? 'rgba(255, 42, 42, 0.25)' : 'rgba(42, 107, 255, 0.25)';
        ctx.beginPath();
        ctx.arc(0, 0, 52, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (car.marked) {
      ctx.strokeStyle = '#ff5a3c';
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(-CAR.length / 2 - 6, -CAR.width / 2 - 6, CAR.length + 12, CAR.width + 12);
      ctx.setLineDash([]);
    }
    ctx.restore();
    if (car.damage > 14) {
      ctx.fillStyle = 'rgba(40, 40, 40, 0.5)';
      ctx.beginPath();
      ctx.arc(car.x - 18, car.y - 10, 7, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPed(ped) {
    if (ped.down > 0) {
      // Lying on the ground.
      ctx.fillStyle = ped.color;
      ctx.beginPath();
      ctx.ellipse(ped.x, ped.y, 12, 7, ped.angle, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e8c39a';
      ctx.beginPath();
      ctx.arc(ped.x + Math.cos(ped.angle) * 13, ped.y + Math.sin(ped.angle) * 13, 5, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.beginPath();
    ctx.ellipse(ped.x, ped.y + 9, 9, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.color;
    ctx.beginPath();
    ctx.arc(ped.x, ped.y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8c39a';
    ctx.beginPath();
    ctx.arc(ped.x + Math.cos(ped.angle) * 3, ped.y + Math.sin(ped.angle) * 3 - 4, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawPlayer(world) {
    const p = world.player;
    if (p.car) return;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.beginPath();
    ctx.ellipse(2, 4, 12, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    // A white ring so the player reads at a glance, even in a crowd.
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, 15, 0, Math.PI * 2);
    ctx.stroke();
    // Jacket and head, facing the direction of travel.
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#22242a';
    ctx.beginPath();
    ctx.arc(4, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(8, -3, 2, 0, Math.PI * 2);
    ctx.arc(8, 3, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Direction tick so the player reads at a glance.
    ctx.strokeStyle = 'rgba(255, 210, 63, 0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(p.x + Math.cos(p.angle) * 14, p.y + Math.sin(p.angle) * 14);
    ctx.lineTo(p.x + Math.cos(p.angle) * 24, p.y + Math.sin(p.angle) * 24);
    ctx.stroke();
  }

  function drawMarker(marker, time) {
    if (!marker) return;
    const pulse = 1 + Math.sin(time * 5) * 0.12;
    ctx.save();
    ctx.translate(marker.x, marker.y);
    // Beacon column.
    const grad = ctx.createLinearGradient(0, -190, 0, 0);
    grad.addColorStop(0, 'rgba(255, 90, 60, 0)');
    grad.addColorStop(1, 'rgba(255, 90, 60, 0.4)');
    ctx.fillStyle = grad;
    ctx.fillRect(-14, -190, 28, 190);
    // Pulsing diamond on the ground.
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = PALETTE.marker;
    const s = 17 * pulse;
    ctx.fillRect(-s / 2, -s / 2, s, s);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(-s / 2, -s / 2, s, s);
    ctx.restore();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(marker.label, marker.x, marker.y - 200);
  }

  function drawParticles(world) {
    for (const pt of world.particles) {
      const a = clamp(pt.life / pt.max, 0, 1);
      if (pt.kind === 'smoke') {
        ctx.fillStyle = `rgba(60, 60, 60, ${0.45 * a})`;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 10 + (1 - a) * 14, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = `rgba(255, 220, 80, ${a})`;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 9 * a + 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.strokeStyle = 'rgba(255, 240, 140, 0.9)';
    ctx.lineWidth = 2;
    for (const b of world.bullets) {
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.ex, b.ey);
      ctx.stroke();
    }
  }

  function drawMinimap(world) {
    const { x, y, w, h } = MINIMAP;
    const sx = w / WORLD.width;
    const sy = h / WORLD.height;
    ctx.save();
    ctx.fillStyle = PALETTE.panel;
    roundRect(ctx, x - 6, y - 6, w + 12, h + 12, 8);
    ctx.fill();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.fillStyle = '#233020';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#5a6068';
    for (const rx of ROADS.vertical) ctx.fillRect(x + rx * sx - 1, y, 2, h);
    for (const ry of ROADS.horizontal) ctx.fillRect(x, y + ry * sy, w, 2);
    ctx.fillStyle = '#2f7fa8';
    ctx.fillRect(x, y + BEACH.waterY * sy, w, h - BEACH.waterY * sy);
    // Mission marker.
    const m = world.mission && world.mission.marker;
    if (m) {
      ctx.fillStyle = PALETTE.marker;
      ctx.beginPath();
      ctx.arc(x + m.x * sx, y + m.y * sy, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    // Police as blue dots, player as a yellow arrow.
    for (const car of world.cars) {
      if (car.driver !== 'police') continue;
      ctx.fillStyle = '#2a6bff';
      ctx.beginPath();
      ctx.arc(x + car.x * sx, y + car.y * sy, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    const p = world.player;
    ctx.save();
    ctx.translate(x + p.x * sx, y + p.y * sy);
    ctx.rotate(p.angle);
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.moveTo(7, 0);
    ctx.lineTo(-5, -5);
    ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.restore();
  }

  function drawStars(n) {
    ctx.font = '26px system-ui, sans-serif';
    ctx.textAlign = 'left';
    for (let i = 0; i < WANTED.max; i += 1) {
      ctx.fillStyle = i < n ? PALETTE.star : PALETTE.starEmpty;
      ctx.fillText('\u2605', 16 + i * 28, 52);
    }
  }

  function drawHud(world) {
    const p = world.player;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // Top-left panel: money, health, ammo.
    ctx.fillStyle = PALETTE.panel;
    roundRect(ctx, 12, 12, 250, 92, 10);
    ctx.fill();
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`$${p.money}`, 24, 40);
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText(`AMMO ${p.ammo}   ${p.car ? CAR.types[p.car.type].name.toUpperCase() : 'ON FOOT'}`, 24, 60);
    // Health bar.
    ctx.fillStyle = '#222';
    roundRect(ctx, 24, 70, 150, 12, 6);
    ctx.fill();
    ctx.fillStyle = p.health > 30 ? PALETTE.health : PALETTE.healthLow;
    roundRect(ctx, 24, 70, 150 * clamp(p.health / 100, 0, 1), 12, 6);
    ctx.fill();
    drawStars(p.wanted);
    // Speed, when driving.
    if (p.car) {
      ctx.fillStyle = PALETTE.text;
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${Math.round(Math.abs(p.car.speed) * 0.18)} mph`, VIEW.width - 16, VIEW.height - 16);
    }
    drawMinimap(world);
    // Mission line at the bottom.
    if (world.mission) {
      const m = world.mission;
      const line = m.def.objective(world);
      const timer = m.timeLeft !== undefined ? `  —  ${Math.max(0, Math.ceil(m.timeLeft))}s` : '';
      ctx.font = 'bold 16px system-ui, sans-serif';
      const tw = ctx.measureText(line + timer).width;
      ctx.fillStyle = PALETTE.panel;
      roundRect(ctx, (VIEW.width - tw) / 2 - 14, VIEW.height - 62, tw + 28, 36, 8);
      ctx.fill();
      ctx.fillStyle = PALETTE.text;
      ctx.textAlign = 'center';
      ctx.fillText(line + timer, VIEW.width / 2, VIEW.height - 38);
    }
    // Transient message above the mission line.
    if (world.messageTimer > 0) {
      ctx.font = '15px system-ui, sans-serif';
      ctx.fillStyle = '#ffe9a8';
      ctx.textAlign = 'center';
      ctx.fillText(world.message, VIEW.width / 2, VIEW.height - 78);
    }
    // Centre banner (mission complete / failed).
    if (world.bannerTimer > 0) {
      ctx.font = 'bold 30px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      const bw = ctx.measureText(world.banner).width + 48;
      roundRect(ctx, (VIEW.width - bw) / 2, 150, bw, 56, 10);
      ctx.fill();
      ctx.fillStyle = PALETTE.title;
      ctx.fillText(world.banner, VIEW.width / 2, 188);
    }
    ctx.restore();
  }

  function drawScreen(state, screen, best) {
    const w = VIEW.width;
    const h = VIEW.height;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = 'rgba(8, 10, 18, 0.72)';
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    if (screen === SCREEN_TITLE) {
      ctx.fillStyle = PALETTE.title;
      ctx.font = 'bold 84px system-ui, sans-serif';
      ctx.fillText('SOLMARINA', w / 2, 190);
      ctx.fillStyle = '#ff5a3c';
      ctx.font = 'bold 84px system-ui, sans-serif';
      ctx.fillText('HEAT', w / 2, 280);
      ctx.fillStyle = PALETTE.text;
      ctx.font = '20px system-ui, sans-serif';
      ctx.fillText('Rico Vega. Five jobs. One very hot city.', w / 2, 330);
      ctx.font = '17px system-ui, sans-serif';
      ctx.fillStyle = PALETTE.muted;
      ctx.fillText('WASD drive & walk  •  E enter / steal a car  •  Mouse aim, click to shoot  •  F punch', w / 2, 380);
      ctx.fillText('M mute  •  P pause  •  Progress saves in this browser', w / 2, 408);
      ctx.fillStyle = PALETTE.text;
      ctx.font = 'bold 24px system-ui, sans-serif';
      ctx.fillText('Press Enter or click to start', w / 2, 480);
      if (best > 0) {
        ctx.font = '17px system-ui, sans-serif';
        ctx.fillStyle = PALETTE.muted;
        ctx.fillText(`Jobs done: ${best} of 5`, w / 2, 520);
      }
    } else if (screen === SCREEN_PAUSED) {
      ctx.fillStyle = PALETTE.text;
      ctx.font = 'bold 54px system-ui, sans-serif';
      ctx.fillText('PAUSED', w / 2, 330);
      ctx.font = '18px system-ui, sans-serif';
      ctx.fillStyle = PALETTE.muted;
      ctx.fillText('Press P or Enter to keep playing', w / 2, 380);
    } else {
      const over = state.screen === 'wasted';
      ctx.fillStyle = over ? '#ff4d4d' : '#2a6bff';
      ctx.font = 'bold 64px system-ui, sans-serif';
      ctx.fillText(over ? 'WASTED' : 'BUSTED', w / 2, 300);
      ctx.fillStyle = PALETTE.text;
      ctx.font = '20px system-ui, sans-serif';
      ctx.fillText(over ? 'Rico is down. The crew picks him up — the job restarts.' : 'The cops got Rico. The job restarts.', w / 2, 350);
      ctx.font = 'bold 22px system-ui, sans-serif';
      ctx.fillText('Press Enter to retry', w / 2, 420);
    }
    ctx.restore();
  }

  return {
    get scale() {
      return scale;
    },
    get cam() {
      return { x: camX, y: camY };
    },
    resize,
    draw(world, screen, best) {
      resize();
      const { camX: cx, camY: cy } = cameraFor(world.player);
      void cx;
      void cy;
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      // The camera is the top-left of the view in world units.
      ctx.translate(-camX, -camY);
      drawGround(world.city);
      drawRoads();
      drawBuildings(world.city);
      for (const car of world.cars) drawCar(car, true);
      if (world.mission && world.mission.marker) drawMarker(world.mission.marker, world.time);
      if (world.mission && world.mission.briefcase && !world.mission.briefcase.taken) {
        const b = world.mission.briefcase;
        ctx.fillStyle = '#8a6a3a';
        ctx.fillRect(b.x - 10, b.y - 6, 20, 12);
      }
      if (world.mission && world.mission.drops) {
        for (const d of world.mission.drops) {
          if (d.taken) continue;
          ctx.fillStyle = PALETTE.cash;
          ctx.beginPath();
          ctx.arc(d.x, d.y, 12, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 12px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('$', d.x, d.y + 4);
        }
      }
      for (const ped of world.peds) drawPed(ped);
      drawPlayer(world);
      drawParticles(world);
      // HUD and screens are drawn in screen space.
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(canvas.width / VIEW.width, canvas.height / VIEW.height);
      if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) drawHud(world);
      if (screen !== SCREEN_PLAY) drawScreen(world, screen, best);
    },
  };
}
