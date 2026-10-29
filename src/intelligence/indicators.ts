/** Indicadores deterministicos. Entrada: precos. Saida: numeros. Sem LLM. */

export function sma(values: readonly number[], period: number, index: number): number | null {
  if (period <= 0 || index < period - 1 || index >= values.length) return null;
  let sum = 0;
  for (let i = index - period + 1; i <= index; i++) sum += values[i]!;
  return sum / period;
}

export function stdev(values: readonly number[], period: number, index: number): number | null {
  const mean = sma(values, period, index);
  if (mean === null) return null;
  let acc = 0;
  for (let i = index - period + 1; i <= index; i++) acc += (values[i]! - mean) ** 2;
  return Math.sqrt(acc / period);
}

/** RSI de Wilder. Devolve null ate haver amostra suficiente. */
export function rsi(values: readonly number[], period = 14, index = values.length - 1): number | null {
  if (index < period) return null;
  let gain = 0, loss = 0;
  for (let i = index - period + 1; i <= index; i++) {
    const d = values[i]! - values[i - 1]!;
    if (d >= 0) gain += d; else loss -= d;
  }
  if (loss === 0) return 100;
  const rs = (gain / period) / (loss / period);
  return 100 - 100 / (1 + rs);
}

/** Retornos simples ponto a ponto. */
export function returns(values: readonly number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < values.length; i++) out.push((values[i]! - values[i - 1]!) / values[i - 1]!);
  return out;
}

/** Volatilidade anualizada a partir de retornos diarios (252 pregoes). */
export function annualizedVol(dailyReturns: readonly number[]): number {
  if (dailyReturns.length < 2) return 0;
  const mean = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
  const varc = dailyReturns.reduce((a, b) => a + (b - mean) ** 2, 0) / (dailyReturns.length - 1);
  return Math.sqrt(varc) * Math.sqrt(252);
}
