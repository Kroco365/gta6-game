// Sound, synthesized live with WebAudio: no audio files, no network.
// Engine hum follows the car's speed, the siren wails when police chase,
// and shots, pickups and mission jingles are short oscillator bursts.

export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = 0;
  let sirenHigh = false;
  let muted = false;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      engineOsc.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(ctx.destination);
      engineOsc.start();
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'square';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(ctx.destination);
      sirenOsc.start();
      return true;
    } catch {
      return false;
    }
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (!ctx || muted) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
      gain.gain.setValueAtTime(vol || 0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + dur);
    } catch {
      // Sound is garnish: never let it break the game.
    }
  }

  function noise(dur, vol, freq) {
    if (!ctx || muted) return;
    try {
      const len = Math.floor(ctx.sampleRate * dur);
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = freq || 1800;
      const gain = ctx.createGain();
      gain.gain.value = vol || 0.2;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      src.start();
    } catch {
      // Sound is garnish.
    }
  }

  return {
    ensure,
    get muted() {
      return muted;
    },
    toggleMute() {
      muted = !muted;
      if (engineGain) engineGain.gain.value = 0;
      if (sirenGain) sirenGain.gain.value = 0;
      return muted;
    },
    /** Called every frame: engine follows speed, siren wails while police chase. */
    update(dt, speed01, chasing) {
      if (!ctx || muted) return;
      if (engineGain) {
        engineGain.gain.value = 0.02 + speed01 * 0.05;
        engineOsc.frequency.value = 55 + speed01 * 130;
      }
      if (sirenGain) {
        if (chasing) {
          sirenGain.gain.value = 0.035;
          sirenTimer += dt;
          if (sirenTimer > 0.45) {
            sirenTimer = 0;
            sirenHigh = !sirenHigh;
            sirenOsc.frequency.value = sirenHigh ? 920 : 660;
          }
        } else {
          sirenGain.gain.value = 0;
        }
      }
    },
    shot() {
      noise(0.12, 0.25, 2400);
    },
    punch() {
      noise(0.08, 0.18, 900);
    },
    crash() {
      noise(0.22, 0.3, 700);
    },
    pickup() {
      blip(880, 0.12, 'sine', 0.14, 1320);
    },
    cash() {
      blip(660, 0.09, 'triangle', 0.14);
      setTimeout(() => blip(990, 0.12, 'triangle', 0.14), 70);
    },
    missionDone() {
      [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => blip(f, 0.18, 'triangle', 0.14), i * 110));
    },
    failed() {
      blip(220, 0.4, 'sawtooth', 0.12, 110);
    },
    click() {
      blip(1200, 0.04, 'square', 0.06);
    },
  };
}
