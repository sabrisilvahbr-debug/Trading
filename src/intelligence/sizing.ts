/** Dimensionamento de posicao. Nunca "tudo na mao". */

import { LIMITS, COSTS } from "../config/limits.js";

export interface SizingInput {
  readonly capitalBrl: number;
  readonly price: number;
  readonly stopPrice: number;
  /** Volatilidade anualizada do ativo. */
  readonly annualizedVol: number;
  /** Volatilidade anual que queremos na posicao. Default 15%. */
  readonly targetVol?: number;
  /** Lote minimo da bolsa (B3 usa 1 no fracionario, 100 no lote padrao). */
  readonly lotSize?: number;
}

/**
 * Tamanho por volatilidade-alvo, limitado pelo risco por operacao.
 * Sempre devolve o MENOR dos dois, nunca a media.
 */
export function sizeByTargetVol(input: SizingInput): number {
  const { capitalBrl, price, stopPrice } = input;
  const targetVol = input.targetVol ?? 0.15;
  const lot = input.lotSize ?? 1;
  if (price <= 0 || capitalBrl <= 0) return 0;

  const volCap = input.annualizedVol > 0
    ? (capitalBrl * targetVol / input.annualizedVol) / price
    : 0;

  // O risco de uma operacao e a distancia ate o stop MAIS o atrito de ida e
  // volta. Dimensionar sem o custo produz ordem que o Guardiao recusa depois.
  const costPerShare = price * 2 * (COSTS.brokerageRate + COSTS.halfSpread + COSTS.slippage);
  const riskPerShare = Math.abs(price - stopPrice) + costPerShare;
  const riskCap = riskPerShare > 0
    ? (capitalBrl * LIMITS.maxRiskPerTrade) / riskPerShare
    : 0;

  const exposureCap = (capitalBrl * LIMITS.maxGrossExposure) / price;

  const raw = Math.min(volCap, riskCap, exposureCap);
  return Math.max(0, Math.floor(raw / lot) * lot);
}

/**
 * Fracao de Kelly conservadora: metade do Kelly cheio, teto de 25%.
 * Kelly cheio e instavel porque depende de estimar vitoria e payoff, que
 * mudam. Usamos a versao cortada e ainda assim o resultado passa pelo
 * teto de risco por operacao antes de virar ordem.
 */
export function conservativeKelly(winRate: number, payoffRatio: number): number {
  if (payoffRatio <= 0 || winRate <= 0 || winRate >= 1) return 0;
  const full = winRate - (1 - winRate) / payoffRatio;
  if (full <= 0) return 0;
  return Math.min(full * 0.5, 0.25);
}
