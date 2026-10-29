/**
 * Backtest com custos reais e separacao treino/validacao.
 *
 * Regra do projeto: estrategia sem teste fora da amostra nao existe. O
 * resultado "dentro da amostra" e impresso apenas para comparacao — o
 * numero que decide e o de fora.
 */

import { COSTS } from "../config/limits.js";
import { annualizedVol, returns } from "./indicators.js";

export interface Bar { readonly t: number; readonly close: number }

/** 1 = comprado, 0 = fora. Sem venda a descoberto por padrao. */
export type Strategy = (bars: readonly Bar[], i: number) => 0 | 1;

export interface BacktestResult {
  readonly finalEquity: number;
  readonly totalReturn: number;
  readonly maxDrawdown: number;
  readonly sharpe: number;
  readonly sortino: number;
  readonly trades: number;
  readonly costsPaidBrl: number;
  readonly buyAndHoldReturn: number;
  readonly negativeMonthsRate: number;
  readonly worstDay: number;
  readonly dailyReturns: readonly number[];
}

export function roundTripCostRate(): number {
  return 2 * (COSTS.brokerageRate + COSTS.halfSpread + COSTS.slippage);
}

export function run(bars: readonly Bar[], strategy: Strategy, capital = 10_000): BacktestResult {
  let equity = capital, position: 0 | 1 = 0, trades = 0, costs = 0, peak = capital, maxDD = 0;
  const daily: number[] = [];

  for (let i = 1; i < bars.length; i++) {
    const want = strategy(bars, i - 1); // sinal do fechamento anterior: sem olhar o futuro
    let costRate = 0;
    if (want !== position) {
      // meia volta: corretagem + meio spread + slippage de uma perna
      costRate = COSTS.brokerageRate + COSTS.halfSpread + COSTS.slippage;
      trades++;
      position = want;
    }
    const move = (bars[i]!.close - bars[i - 1]!.close) / bars[i - 1]!.close;
    const r = position * move - costRate;
    costs += equity * costRate;
    equity *= 1 + r;
    daily.push(r);
    if (equity > peak) peak = equity;
    maxDD = Math.max(maxDD, (peak - equity) / peak);
  }

  const mean = daily.reduce((a, b) => a + b, 0) / (daily.length || 1);
  const vol = annualizedVol(daily);
  const downside = daily.filter((r) => r < 0);
  const downVol = downside.length > 1 ? annualizedVol(downside) : 0;

  // meses de 21 pregoes, suficiente para a estatistica de "% de meses negativos"
  let negMonths = 0, months = 0;
  for (let i = 0; i + 21 <= daily.length; i += 21) {
    months++;
    const m = daily.slice(i, i + 21).reduce((a, b) => (1 + a) * (1 + b) - 1, 0);
    if (m < 0) negMonths++;
  }

  return {
    finalEquity: equity,
    totalReturn: equity / capital - 1,
    maxDrawdown: maxDD,
    sharpe: vol > 0 ? (mean * 252) / vol : 0,
    sortino: downVol > 0 ? (mean * 252) / downVol : 0,
    trades,
    costsPaidBrl: costs,
    buyAndHoldReturn: bars.length > 1 ? bars[bars.length - 1]!.close / bars[0]!.close - 1 : 0,
    negativeMonthsRate: months ? negMonths / months : 0,
    worstDay: daily.length ? Math.min(...daily) : 0,
    dailyReturns: daily,
  };
}

export interface Validation {
  readonly inSample: BacktestResult;
  readonly outOfSample: BacktestResult;
  /** Quanto o desempenho caiu fora da amostra. Acima de 0,5 cheira a overfitting. */
  readonly decay: number;
  readonly promoted: boolean;
  readonly reasons: readonly string[];
}

/**
 * Promove a estrategia apenas se ela sobreviver fora da amostra: retorno
 * liquido positivo, drawdown dentro do teto, e sem desabar em relacao ao
 * treino. Reprovou, fica no paper trading.
 */
export function validate(bars: readonly Bar[], strategy: Strategy, splitRatio = 0.6, capital = 10_000): Validation {
  const cut = Math.floor(bars.length * splitRatio);
  const inSample = run(bars.slice(0, cut), strategy, capital);
  const outOfSample = run(bars.slice(cut), strategy, capital);

  const decay = inSample.totalReturn > 0
    ? 1 - outOfSample.totalReturn / inSample.totalReturn
    : 0;

  const reasons: string[] = [];
  if (outOfSample.totalReturn <= 0) reasons.push("Retorno liquido fora da amostra nao e positivo.");
  if (outOfSample.maxDrawdown > 0.1) reasons.push(`Drawdown fora da amostra de ${(outOfSample.maxDrawdown * 100).toFixed(1)}% acima do teto de 10%.`);
  if (decay > 0.5) reasons.push(`Desempenho caiu ${(decay * 100).toFixed(0)}% fora da amostra: sinal de curve-fitting.`);
  if (outOfSample.sharpe > 4) reasons.push("Sharpe acima de 4 em dado diario e improvavel: revise o backtest antes de confiar.");
  if (outOfSample.trades < 10) reasons.push("Menos de 10 operacoes fora da amostra: amostra pequena demais para concluir.");

  return { inSample, outOfSample, decay, promoted: reasons.length === 0, reasons };
}

export { returns };
