// Крошечные синтезированные звуки через WebAudio: без файлов, работает офлайн.
// Создаётся лениво при первом проигрывании (webview Telegram требует жеста).
// Сухой «клак» камня по деревянной доске и шуршащий сметающий звук при взятии.
let ctx: AudioContext | null = null
let muted = localStorage.getItem('goMuted') === '1'

export function isSoundOn(): boolean { return !muted }
export function setSoundOn(on: boolean): void {
  muted = !on
  localStorage.setItem('goMuted', muted ? '1' : '0')
}

function audioCtx(): AudioContext | null {
  if (muted) return null
  try {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    ctx = ctx ?? new Ctor()
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch { return null }
}

function blip(c: AudioContext, freq: number, at: number, dur: number, type: OscillatorType = 'sine', peak = 0.12): void {
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, at)
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(peak, at + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  o.connect(g); g.connect(c.destination)
  o.start(at); o.stop(at + dur + 0.02)
}

// Сухой «клак» камня: короткий шум через полосовой фильтр.
function knock(c: AudioContext, at: number, freq = 2000, dur = 0.07, peak = 0.07): void {
  const n = Math.floor(c.sampleRate * dur)
  const buf = c.createBuffer(1, n, c.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n)
  const src = c.createBufferSource()
  src.buffer = buf
  const g = c.createGain()
  g.gain.setValueAtTime(peak, at)
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  const f = c.createBiquadFilter()
  f.type = 'bandpass'
  f.frequency.value = freq
  f.Q.value = 1.4
  src.connect(f); f.connect(g); g.connect(c.destination)
  src.start(at); src.stop(at + dur)
}

export type Sfx = 'place' | 'capture' | 'pass' | 'win' | 'lose'

export function playSfx(name: Sfx): void {
  const c = audioCtx()
  if (!c) return
  const t = c.currentTime
  switch (name) {
    case 'place':
      // камень лёг на доску: сухой звонкий клак
      knock(c, t, 2100, 0.055, 0.08)
      break
    case 'capture':
      // пленных сметают с доски: россыпь клаков пониже
      for (let i = 0; i < 4; i++) knock(c, t + i * 0.045, 1500 - i * 180, 0.05, 0.05)
      break
    case 'pass':
      // мягкий нейтральный тон
      blip(c, 392, t, 0.16, 'sine', 0.05)
      break
    case 'win':
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => blip(c, f, t + i * 0.09, 0.26, 'triangle', 0.1))
      break
    case 'lose':
      [392, 311, 262, 196].forEach((f, i) => blip(c, f, t + i * 0.13, 0.26, 'sine', 0.08))
      break
  }
}
