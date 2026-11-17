// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the renderer
// paints what is there. The game moves between four screens: title, play,
// paused and game over.
//
// ?seed=N fixes the traffic and pedestrian pattern. ?shot=cover|mission|foot|title
// (with &seed=N) stages that scene instead of running the loop, paints it twice
// and sets window.__shotReady for a screenshot.
import { STEP } from './config.js';
import { createWorld } from './world.js';
import { ACTION_CONFIRM, ACTION_ENTER, ACTION_MUTE, ACTION_PAUSE, ACTION_PUNCH, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(seed);
const renderer = createRenderer(canvas);

function readBest() {
  return world.save ? world.save.missionsDone || 0 : 0;
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.audio.ensure();
    world.reset(world.save ? world.save.missionsDone || 0 : 0);
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Rico Vega, Solmarina. First job: the Portside Docks.');
  }

  function endGame() {
    screen = SCREEN_OVER;
    announce(world.screen === 'wasted' ? 'Wasted. Press Enter to retry.' : 'Busted. Press Enter to retry.');
  }

  function handleActions() {
    const actions = input.takeActions();
    const mouse = input.mouse();
    const clicked = mouse.clicked;
    input.consumeClick();
    if (actions & ACTION_MUTE) {
      const muted = world.audio.toggleMute();
      announce(muted ? 'Sound off.' : 'Sound on.');
    }
    // Enter / punch belong to the world step: hand them over, since this
    // call already consumed the queue.
    world.pendingActions = (world.pendingActions || 0) | (actions & (ACTION_ENTER | ACTION_PUNCH));
    if (screen === SCREEN_TITLE || screen === SCREEN_OVER) {
      if (actions & ACTION_CONFIRM || clicked) startGame();
      return;
    }
    if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP) {
        const cam = renderer.cam;
        world.step(STEP, input, input.mouse(), renderer.scale, cam.x, cam.y);
        accumulator -= STEP;
        if (world.screen === 'busted' || world.screen === 'wasted') {
          endGame();
          break;
        }
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world, screen, readBest());
  }

  // Leaving the tab pauses a running game rather than letting the city run unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Solmarina Heat. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
