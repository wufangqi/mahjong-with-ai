import type { SfxId } from './types';

type WindowWithWebkitAudio = Window &
  typeof globalThis & { webkitAudioContext?: typeof AudioContext };

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const win = window as WindowWithWebkitAudio;
    const AC = win.AudioContext || win.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 1;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

type ToneOpts = {
  type?: OscillatorType;
  gain?: number;
  to?: number;
  attack?: number;
};

function tone(bus: AudioNode, freq: number, at: number, dur: number, opts: ToneOpts = {}): void {
  if (!ctx) return;
  const { type = 'sine', gain = 0.2, to, attack = 0.005 } = opts;
  const t0 = ctx.currentTime + at;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (to != null) o.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g);
  g.connect(bus);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

type NoiseOpts = {
  gain?: number;
  from?: number;
  to?: number;
  q?: number;
};

function noise(bus: AudioNode, at: number, dur: number, opts: NoiseOpts = {}): void {
  if (!ctx) return;
  const { gain = 0.3, from = 4000, to = 200, q = 1 } = opts;
  const t0 = ctx.currentTime + at;
  const len = Math.ceil(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const s = ctx.createBufferSource();
  s.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = q;
  f.frequency.setValueAtTime(from, t0);
  f.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(f);
  f.connect(g);
  g.connect(bus);
  s.start(t0);
}

function bus(gain: number): GainNode | null {
  const c = ac();
  if (!c || !master) return null;
  const g = c.createGain();
  g.gain.value = gain;
  g.connect(master);
  return g;
}

function playDraw(b: GainNode): void {
  tone(b, 660, 0, 0.08, { type: 'triangle', gain: 0.12 });
  tone(b, 880, 0.05, 0.1, { type: 'sine', gain: 0.08 });
}

function playDiscard(b: GainNode): void {
  noise(b, 0, 0.07, { gain: 0.1, from: 1800, to: 400, q: 1.2 });
  tone(b, 220, 0, 0.09, { type: 'sine', gain: 0.1, to: 140 });
}

function playChow(b: GainNode): void {
  [523.25, 587.33, 659.25].forEach((f, i) =>
    tone(b, f, i * 0.05, 0.14, { type: 'triangle', gain: 0.1 }),
  );
}

function playPung(b: GainNode): void {
  tone(b, 392, 0, 0.12, { type: 'square', gain: 0.07 });
  tone(b, 523.25, 0.06, 0.16, { type: 'triangle', gain: 0.1 });
}

function playKong(b: GainNode): void {
  [349.23, 440, 523.25, 698.46].forEach((f, i) =>
    tone(b, f, i * 0.04, 0.18, { type: 'sawtooth', gain: 0.05, attack: 0.01 }),
  );
  noise(b, 0.05, 0.2, { gain: 0.08, from: 3000, to: 600, q: 0.9 });
}

function playWin(b: GainNode): void {
  [523.25, 659.25, 783.99].forEach((f, i) =>
    tone(b, f, 0.05 + i * 0.06, 0.35, { type: 'triangle', gain: 0.1 }),
  );
}

function playSceneBasic(b: GainNode): void {
  [1046.5, 1318.5, 1568, 2093].forEach((f, i) =>
    tone(b, f, 0.18 + i * 0.07, 0.9, { type: 'triangle', gain: 0.12 }),
  );
  noise(b, 0.15, 0.5, { gain: 0.08, from: 9000, to: 4000, q: 2 });
}

function playSceneBig(b: GainNode): void {
  noise(b, 0, 0.9, { gain: 0.15, from: 300, to: 3000, q: 0.8 });
  tone(b, 55, 0.85, 1.4, { type: 'sine', gain: 0.5, to: 35 });
  [523.25, 659.25, 783.99, 1046.5].forEach((f) =>
    tone(b, f, 0.9, 2.0, { type: 'sawtooth', gain: 0.035, attack: 0.05 }),
  );
}

function playSceneTop(b: GainNode): void {
  tone(b, 220, 0, 1.0, { type: 'sawtooth', gain: 0.08, to: 55, attack: 0.02 });
  tone(b, 45, 1.0, 1.2, { type: 'sine', gain: 0.6, to: 28 });
  noise(b, 1.0, 1.0, { gain: 0.35, from: 5000, to: 100, q: 0.6 });
  [261.63, 329.63, 392, 523.25, 659.25].forEach((f) =>
    tone(b, f, 2.45, 2.2, { type: 'sawtooth', gain: 0.03, attack: 0.03 }),
  );
}

const PLAYERS: Record<SfxId, (b: GainNode) => void> = {
  draw: playDraw,
  discard: playDiscard,
  chow: playChow,
  pung: playPung,
  kong: playKong,
  win: playWin,
  scene_basic: playSceneBasic,
  scene_big: playSceneBig,
  scene_top: playSceneTop,
};

/** Play a locally synthesized one-shot. No external files. */
export function playSynthesized(id: SfxId, gain: number): void {
  const b = bus(gain);
  if (!b) return;
  PLAYERS[id](b);
}

/** Test/harness: drop cached AudioContext (jsdom / HMR). */
export function resetSynthForTests(): void {
  ctx = null;
  master = null;
}
