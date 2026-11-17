// Keyboard and mouse input. Keys are held in a set; actions are edge-triggered
// (each press is reported once, then consumed), so a held key never double-fires.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_PUNCH = 8;
export const ACTION_MUTE = 16;

const KEY_ACTIONS = {
  Enter: ACTION_CONFIRM,
  ' ': ACTION_CONFIRM,
  Escape: ACTION_PAUSE,
  KeyP: ACTION_PAUSE,
  KeyE: ACTION_ENTER,
  KeyF: ACTION_PUNCH,
  KeyM: ACTION_MUTE,
};

export function createInput(canvas) {
  const keys = new Set();
  let queued = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;
  let mouseClicked = false;

  function onKeyDown(event) {
    if (event.repeat) return;
    keys.add(event.code);
    const action = KEY_ACTIONS[event.code];
    if (action) {
      queued |= action;
      event.preventDefault();
    }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
  }

  function onKeyUp(event) {
    keys.delete(event.code);
  }

  function onMouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
  }

  function onMouseDown(event) {
    mouseDown = true;
    mouseClicked = true;
    onMouseMove(event);
  }

  function onMouseUp() {
    mouseDown = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);

  function axis(neg, pos) {
    return (keys.has(pos) ? 1 : 0) - (keys.has(neg) ? 1 : 0);
  }

  return {
    /** -1/0/1 steering and throttle, from WASD or the arrow keys. */
    move() {
      return {
        x: axis('KeyA', 'KeyD') || axis('ArrowLeft', 'ArrowRight'),
        y: axis('KeyW', 'KeyS') || axis('ArrowUp', 'ArrowDown'),
      };
    },
    get run() {
      return keys.has('ShiftLeft') || keys.has('ShiftRight');
    },
    /** Edge-triggered actions since the last call; each is reported once. */
    takeActions() {
      const out = queued;
      queued = 0;
      return out;
    },
    /** Mouse position in canvas CSS pixels, for aiming. */
    mouse() {
      return { x: mouseX, y: mouseY, down: mouseDown, clicked: mouseClicked };
    },
    consumeClick() {
      mouseClicked = false;
    },
    /** True while the left mouse button is held (hold to fire). */
    get firing() {
      return mouseDown;
    },
  };
}
