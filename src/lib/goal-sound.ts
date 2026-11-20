/**
 * Sonido de gol sintetizado con Web Audio (sin archivos que descargar):
 * silbato del árbitro + rugido de la tribuna.
 *
 * Los navegadores no dejan sonar audio hasta que la persona toca la página,
 * así que `primeGoalSound()` deja el audio listo con el primer toque.
 */

const PREF_KEY = "copa-sonido-gol";
let ctx: AudioContext | null = null;

function context(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC(); } catch { return null; }
  }
  return ctx;
}

export function goalSoundEnabled(): boolean {
  try { return localStorage.getItem(PREF_KEY) !== "off"; } catch { return true; }
}

export function setGoalSoundEnabled(on: boolean) {
  try { localStorage.setItem(PREF_KEY, on ? "on" : "off"); } catch { /* sin almacenamiento: queda por defecto */ }
}

/** Desbloquea el audio con la primera interacción. Devuelve la función de limpieza. */
export function primeGoalSound(): () => void {
  const unlock = () => {
    const c = context();
    if (c && c.state === "suspended") c.resume().catch(() => { /* */ });
    off();
  };
  const off = () => {
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };
  window.addEventListener("pointerdown", unlock, { passive: true });
  window.addEventListener("keydown", unlock);
  return off;
}

/** Pitazo con el trino típico del silbato (vibrato rápido). */
function whistle(c: AudioContext, out: AudioNode, start: number, dur: number) {
  const osc = c.createOscillator();
  osc.type = "sine";
  osc.frequency.value = 2900;
  const lfo = c.createOscillator();
  lfo.frequency.value = 32;
  const depth = c.createGain();
  depth.gain.value = 180;
  lfo.connect(depth).connect(osc.frequency);
  const g = c.createGain();
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(0.16, start + 0.02);
  g.gain.setValueAtTime(0.16, start + dur - 0.04);
  g.gain.linearRampToValueAtTime(0, start + dur);
  osc.connect(g).connect(out);
  osc.start(start); lfo.start(start);
  osc.stop(start + dur + 0.05); lfo.stop(start + dur + 0.05);
}

/** Tribuna: ruido filtrado que crece y se apaga. */
function crowd(c: AudioContext, out: AudioNode, start: number, dur: number) {
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const band = c.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.setValueAtTime(600, start);
  band.frequency.linearRampToValueAtTime(1100, start + 0.6);
  band.frequency.linearRampToValueAtTime(700, start + dur);
  band.Q.value = 0.6;
  const g = c.createGain();
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(0.5, start + 0.5);
  g.gain.setValueAtTime(0.5, start + 1.2);
  g.gain.exponentialRampToValueAtTime(0.001, start + dur);
  src.connect(band).connect(g).connect(out);
  src.start(start);
  src.stop(start + dur);
}

export function playGoalSound() {
  if (!goalSoundEnabled()) return;
  const c = context();
  if (!c) return;
  if (c.state === "suspended") c.resume().catch(() => { /* aún sin toque del usuario */ });
  const master = c.createGain();
  master.gain.value = 0.8;
  master.connect(c.destination);
  const t = c.currentTime + 0.05;
  whistle(c, master, t, 0.18);
  whistle(c, master, t + 0.26, 0.18);
  whistle(c, master, t + 0.52, 0.7);
  crowd(c, master, t + 0.35, 3.4);
}
