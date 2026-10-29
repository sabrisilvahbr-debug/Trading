/** Cenarios por reamostragem dos retornos observados. Nao e previsao. */

export interface Scenarios {
  readonly p5: number;
  readonly median: number;
  readonly p95: number;
  readonly probLoss: number;
  /** VaR 95% como perda positiva (0,07 = perder 7%). */
  readonly var95: number;
  readonly horizonDays: number;
  readonly paths: number;
}

function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function project(
  dailyReturns: readonly number[],
  horizonDays = 30,
  paths = 4000,
  seed = 1,
): Scenarios {
  if (dailyReturns.length === 0) {
    return { p5: 0, median: 0, p95: 0, probLoss: 0, var95: 0, horizonDays, paths: 0 };
  }
  const rnd = mulberry32(seed);
  const out: number[] = [];
  for (let p = 0; p < paths; p++) {
    let v = 1;
    for (let d = 0; d < horizonDays; d++) {
      v *= 1 + dailyReturns[Math.floor(rnd() * dailyReturns.length)]!;
    }
    out.push(v - 1);
  }
  out.sort((a, b) => a - b);
  const q = (f: number) => out[Math.min(out.length - 1, Math.floor(f * out.length))]!;
  const p5 = q(0.05);
  return {
    p5,
    median: q(0.5),
    p95: q(0.95),
    probLoss: out.filter((x) => x < 0).length / out.length,
    var95: Math.max(0, -p5),
    horizonDays,
    paths,
  };
}
