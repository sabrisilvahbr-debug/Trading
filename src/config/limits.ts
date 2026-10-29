/**
 * Limites rigidos do Guardiao de Risco.
 *
 * Este arquivo e a unica fonte de verdade dos limites. Nenhum agente,
 * nenhuma proposta de LLM e nenhuma rota HTTP escreve aqui em tempo de
 * execucao: o objeto e congelado na carga. Alterar limite = editar este
 * arquivo, revisar no pull request e reiniciar o processo.
 */

export interface RiskLimits {
  /** Risco maximo por operacao, como fracao do capital. */
  readonly maxRiskPerTrade: number;
  /** Exposicao bruta maxima, como fracao do capital. */
  readonly maxGrossExposure: number;
  /** Numero maximo de posicoes abertas ao mesmo tempo. */
  readonly maxOpenPositions: number;
  /** Perda diaria que congela a mesa, como fracao do capital. */
  readonly dailyStop: number;
  /** Drawdown sobre o pico que encerra a fase, como fracao do capital. */
  readonly maxDrawdown: number;
  /** Alavancagem maxima. 1 = sem alavancagem. */
  readonly maxLeverage: number;
  /** Idade maxima da cotacao para liberar envio de ordem, em milissegundos. */
  readonly maxQuoteAgeMs: number;
  /** Idade maxima do status de ordens/posicoes, em milissegundos. */
  readonly maxOrderStatusAgeMs: number;
  /** Divergencia tolerada entre duas fontes de preco, como fracao. */
  readonly maxSourceDivergence: number;
  /** Nota minima de reputacao (0-100) para integrar uma plataforma. */
  readonly minProviderReputation: number;
  /** Confianca minima de uma proposta do LLM para seguir sem escalonamento. */
  readonly minLlmConfidence: number;
}

export const LIMITS: RiskLimits = Object.freeze({
  maxRiskPerTrade: 0.01,
  maxGrossExposure: 0.6,
  maxOpenPositions: 5,
  dailyStop: 0.02,
  maxDrawdown: 0.1,
  maxLeverage: 1,
  maxQuoteAgeMs: 15_000,
  maxOrderStatusAgeMs: 2_000,
  maxSourceDivergence: 0.005,
  minProviderReputation: 70,
  minLlmConfidence: 0.7,
});

/** Custos usados em TODA simulacao e em toda decisao de entrada. */
export const COSTS = Object.freeze({
  /** Corretagem por perna, como fracao do financeiro. */
  brokerageRate: 0.0003,
  /** Corretagem minima por ordem, em BRL. */
  brokerageMinBrl: 0,
  /** Metade do spread pago na entrada e na saida, como fracao. */
  halfSpread: 0.0004,
  /** Slippage estimado por perna, como fracao. */
  slippage: 0.0003,
  /** Aliquota de day trade sobre o lucro liquido. */
  taxDayTrade: 0.2,
  /** Aliquota de swing trade sobre o lucro liquido. */
  taxSwing: 0.15,
});

export type Mode = "PAPER" | "PILOTO" | "REAL";
export type Regime = "NORMAL" | "CAUTELA" | "PAUSADO_RISCO" | "PAUSADO_MANUAL";
