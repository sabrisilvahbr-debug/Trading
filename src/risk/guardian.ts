/**
 * Guardiao de Risco — agente 9.
 *
 * Funcao pura: recebe a intencao de ordem, o estado da carteira e o contexto
 * de mercado, devolve APROVADO ou RECUSADO com o motivo. Nao faz I/O, nao
 * chama LLM, nao le configuracao de fora de LIMITS. Tudo que decide pode ser
 * reproduzido em teste.
 */

import { LIMITS, COSTS, type RiskLimits, type Mode } from "../config/limits.js";
import type { OrderIntent, PortfolioState } from "../types/messages.js";

export interface MarketContext {
  /** Idade da cotacao usada, em ms. */
  readonly quoteAgeMs: number;
  /** Idade do status de posicoes, em ms. */
  readonly statusAgeMs: number;
  /** Divergencia relativa entre as duas fontes de preco. */
  readonly sourceDivergence: number;
  /** Mercado em halt / leilao / circuit breaker. */
  readonly halted: boolean;
  /** Dentro da janela de negociacao configurada. */
  readonly withinTradingHours: boolean;
  readonly mode: Mode;
}

export type Verdict =
  | { readonly approved: true; readonly notional: number; readonly riskBrl: number }
  | { readonly approved: false; readonly code: RejectCode; readonly message: string };

export type RejectCode =
  | "SEM_STOP" | "QUANTIDADE_INVALIDA" | "DADO_VELHO" | "STATUS_VELHO"
  | "DIVERGENCIA_FONTES" | "MERCADO_PARADO" | "FORA_DO_HORARIO"
  | "RISCO_POR_OPERACAO" | "EXPOSICAO" | "POSICOES" | "STOP_DIARIO"
  | "DRAWDOWN" | "ALAVANCAGEM" | "CUSTO_MAIOR_QUE_ALVO";

/** Custo total estimado de abrir e fechar a posicao, como fracao do financeiro. */
export function roundTripCostRate(): number {
  return 2 * (COSTS.brokerageRate + COSTS.halfSpread + COSTS.slippage);
}

export function evaluate(
  intent: OrderIntent,
  portfolio: PortfolioState,
  market: MarketContext,
  limits: RiskLimits = LIMITS,
): Verdict {
  const reject = (code: RejectCode, message: string): Verdict => ({ approved: false, code, message });

  if (!Number.isFinite(intent.quantity) || intent.quantity <= 0) {
    return reject("QUANTIDADE_INVALIDA", "Quantidade precisa ser um numero positivo.");
  }
  if (!Number.isFinite(intent.stopPrice) || intent.stopPrice <= 0) {
    return reject("SEM_STOP", "Ordem sem preco de stop valido nao e aceita.");
  }

  // --- qualidade do dado: antes de qualquer conta de dinheiro ---
  if (market.quoteAgeMs > limits.maxQuoteAgeMs) {
    return reject("DADO_VELHO", `Cotacao com ${market.quoteAgeMs} ms, acima do teto de ${limits.maxQuoteAgeMs} ms.`);
  }
  if (market.statusAgeMs > limits.maxOrderStatusAgeMs) {
    return reject("STATUS_VELHO", `Status de posicoes com ${market.statusAgeMs} ms, acima do teto de ${limits.maxOrderStatusAgeMs} ms.`);
  }
  if (market.sourceDivergence > limits.maxSourceDivergence) {
    return reject("DIVERGENCIA_FONTES", `Fontes divergem ${(market.sourceDivergence * 100).toFixed(2)}%, acima de ${(limits.maxSourceDivergence * 100).toFixed(2)}%.`);
  }
  if (market.halted) return reject("MERCADO_PARADO", "Mercado em halt ou circuit breaker.");
  if (!market.withinTradingHours) return reject("FORA_DO_HORARIO", "Fora da janela de negociacao configurada.");

  // --- estado da carteira ---
  const dayLossRate = portfolio.dayPnlBrl < 0 ? Math.abs(portfolio.dayPnlBrl) / portfolio.capitalBrl : 0;
  if (dayLossRate >= limits.dailyStop) {
    return reject("STOP_DIARIO", `Stop diario atingido: ${(dayLossRate * 100).toFixed(2)}% do capital.`);
  }
  const drawdown = portfolio.peakEquityBrl > 0
    ? (portfolio.peakEquityBrl - portfolio.equityBrl) / portfolio.peakEquityBrl
    : 0;
  if (drawdown >= limits.maxDrawdown) {
    return reject("DRAWDOWN", `Drawdown de ${(drawdown * 100).toFixed(2)}% atingiu o teto de ${(limits.maxDrawdown * 100).toFixed(0)}%.`);
  }
  if (portfolio.openPositions >= limits.maxOpenPositions && intent.side === "BUY") {
    return reject("POSICOES", `Ja ha ${portfolio.openPositions} posicoes abertas, teto de ${limits.maxOpenPositions}.`);
  }

  // --- conta da ordem ---
  const notional = intent.quantity * intent.referencePrice;
  const riskPerShare = Math.abs(intent.referencePrice - intent.stopPrice);
  const riskBrl = riskPerShare * intent.quantity + notional * roundTripCostRate();
  const riskRate = riskBrl / portfolio.capitalBrl;

  if (riskRate > limits.maxRiskPerTrade) {
    return reject("RISCO_POR_OPERACAO", `Risco de ${(riskRate * 100).toFixed(2)}% do capital, acima do teto de ${(limits.maxRiskPerTrade * 100).toFixed(2)}%.`);
  }

  // O custo de ida e volta precisa ser menor que o ganho alvo implicito no stop.
  // Se so o atrito ja come o movimento esperado, a operacao nao nasce.
  if (notional * roundTripCostRate() >= riskPerShare * intent.quantity) {
    return reject("CUSTO_MAIOR_QUE_ALVO", "Custo de ida e volta maior que a distancia ate o stop: a operacao nao se paga.");
  }

  if (intent.side === "BUY") {
    const newExposure = portfolio.grossExposureBrl + notional;
    if (newExposure / portfolio.capitalBrl > limits.maxGrossExposure) {
      return reject("EXPOSICAO", `Exposicao iria a ${(newExposure / portfolio.capitalBrl * 100).toFixed(1)}%, acima do teto de ${(limits.maxGrossExposure * 100).toFixed(0)}%.`);
    }
    const leverage = (portfolio.grossExposureBrl + notional) / portfolio.equityBrl;
    if (leverage > limits.maxLeverage || portfolio.borrowedBrl > 0) {
      return reject("ALAVANCAGEM", `Alavancagem de ${leverage.toFixed(2)}x acima do teto de ${limits.maxLeverage}x.`);
    }
  }

  return { approved: true, notional, riskBrl };
}

/**
 * No modo REAL, aprovacao do Guardiao nao basta: a ordem ainda espera o
 * "sim" explicito do dono da conta. Esta funcao existe para que esse passo
 * seja parte do tipo, e nao da boa vontade de quem escreve o executor.
 */
export function requiresHumanApproval(mode: Mode): boolean {
  return mode === "REAL";
}
