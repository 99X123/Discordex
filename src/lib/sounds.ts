let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(c: AudioContext, freq: number, start: number, dur: number, vol = 0.22, type: OscillatorType = 'sine') {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, c.currentTime + start);
  gain.gain.linearRampToValueAtTime(vol, c.currentTime + start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(c.currentTime + start);
  osc.stop(c.currentTime + start + dur + 0.03);
}

export function playJoinSound() {
  const c = getCtx();
  if (!c) return;
  tone(c, 620, 0, 0.11, 0.22);
  tone(c, 930, 0.09, 0.15, 0.22);
}

export function playLeaveSound() {
  const c = getCtx();
  if (!c) return;
  tone(c, 880, 0, 0.11, 0.2);
  tone(c, 520, 0.09, 0.17, 0.2);
}

export function playPopSound() {
  const c = getCtx();
  if (!c) return;
  tone(c, 760, 0, 0.07, 0.12, 'triangle');
}

let ringTimer: number | null = null;

export function playRingTone() {
  stopRingTone();
  const c = getCtx();
  if (!c) return;
  const chime = () => {
    tone(c, 600, 0, 0.3, 0.26);
    tone(c, 470, 0.32, 0.36, 0.26);
  };
  chime();
  ringTimer = window.setInterval(chime, 1600);
}

export function stopRingTone() {
  if (ringTimer !== null) {
    clearInterval(ringTimer);
    ringTimer = null;
  }
}

export function unlockAudio() {
  getCtx();
}
