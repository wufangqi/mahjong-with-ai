// 极简 WebAudio 合成音效（无需音频文件）
type WindowWithWebkitAudio = Window &
  typeof globalThis & { webkitAudioContext?: typeof AudioContext };

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;
let current: GainNode | null = null;

function ac(): AudioContext | null {
  if (!ctx) {
    const win = window as WindowWithWebkitAudio;
    const AC = win.AudioContext || win.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.55;
    const delay = ctx.createDelay();
    delay.delayTime.value = 0.16;
    const fb = ctx.createGain();
    fb.gain.value = 0.28;
    master.connect(ctx.destination);
    master.connect(delay);
    delay.connect(fb);
    fb.connect(delay);
    delay.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export function setMuted(m: boolean): void {
  muted = m;
}
export function isMuted(): boolean {
  return muted;
}

function newBus(): GainNode | null {
  stopAll();
  const c = ac();
  if (!c || !master) return null;
  const g = c.createGain();
  g.gain.value = 1;
  g.connect(master);
  current = g;
  return g;
}

export function stopAll(): void {
  if (current && ctx) {
    const g = current;
    const t = ctx.currentTime;
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.linearRampToValueAtTime(0, t + 0.08);
    setTimeout(() => g.disconnect(), 200);
  }
  current = null;
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
  if (to != null) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
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
  f.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(f);
  f.connect(g);
  g.connect(bus);
  s.start(t0);
}

export const sfx = {
  basic(): void {
    if (muted) return;
    const b = newBus();
    if (!b) return;
    [1046.5, 1318.5, 1568, 2093].forEach((f, i) =>
      tone(b, f, 0.18 + i * 0.07, 0.9, { type: 'triangle', gain: 0.12 }),
    );
    noise(b, 0.15, 0.5, { gain: 0.08, from: 9000, to: 4000, q: 2 });
  },
  big(): void {
    if (muted) return;
    const b = newBus();
    if (!b) return;
    noise(b, 0, 0.9, { gain: 0.15, from: 300, to: 3000, q: 0.8 });
    tone(b, 55, 0.85, 1.4, { type: 'sine', gain: 0.5, to: 35 });
    noise(b, 0.85, 0.6, { gain: 0.25, from: 2000, to: 150 });
    [523.25, 659.25, 783.99, 1046.5].forEach((f) =>
      tone(b, f, 0.9, 2.0, { type: 'sawtooth', gain: 0.035, attack: 0.05 }),
    );
    [1568, 2093, 2637].forEach((f, i) =>
      tone(b, f, 1.0 + i * 0.1, 1.2, { type: 'triangle', gain: 0.06 }),
    );
  },
  top(): void {
    if (muted) return;
    const b = newBus();
    if (!b) return;
    tone(b, 220, 0, 1.0, { type: 'sawtooth', gain: 0.08, to: 55, attack: 0.02 });
    tone(b, 440, 0, 1.0, { type: 'sine', gain: 0.06, to: 110 });
    tone(b, 45, 1.0, 1.2, { type: 'sine', gain: 0.6, to: 28 });
    noise(b, 1.0, 1.0, { gain: 0.35, from: 5000, to: 100, q: 0.6 });
    noise(b, 1.45, 1.0, { gain: 0.12, from: 200, to: 6000, q: 1.2 });
    tone(b, 40, 2.45, 1.4, { type: 'sine', gain: 0.6, to: 30 });
    [261.63, 329.63, 392, 523.25, 659.25].forEach((f) =>
      tone(b, f, 2.45, 2.2, { type: 'sawtooth', gain: 0.03, attack: 0.03 }),
    );
    [2093, 2637, 3136, 4186].forEach((f, i) =>
      tone(b, f, 2.5 + i * 0.06, 1.3, { type: 'triangle', gain: 0.05 }),
    );
  },
};
