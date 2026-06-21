// Маленький детерминированный ГСЧ (mulberry32) и перемешивание по seed.
// Один и тот же seed даёт один и тот же результат: важно для воспроизводимости
// и тестов. В «Го» стартовая доска пустая, а ГСЧ нужен лишь чтобы честно бросить
// жребий, кому достанутся чёрные камни (они ходят первыми).

export type Rng = () => number

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Перемешивание Фишера-Йейтса на месте.
export function shuffle<T>(arr: T[], rng: Rng): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

export function randomSeed(): number {
  return (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0
}
