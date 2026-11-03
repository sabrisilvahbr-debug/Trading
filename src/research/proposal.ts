/**
 * Ponte entre a pesquisa (skills do ai-trading-claude) e o Guardiao.
 *
 * A analise chega como texto de LLM. Este modulo trata tudo como dado nao
 * confiavel: so aceita um objeto com formato exato, descarta campos extras,
 * recusa confianca baixa e recalcula a quantidade em codigo. O preco e o stop
 * que o LLM sugere viram APENAS referencia; quem decide se a ordem existe e o
 * Guardiao, depois, com dado de mercado fresco.
 */

import { LIMITS } from "../config/limits.js";
import { sizeByTargetVol } from "../intelligence/sizing.js";
import type { OrderIntent, Side } from "../types/messages.js";

/** Codigo de acao da B3: quatro letras e um a dois digitos (PETR4, VALE3, BBAS3, ...). */
const B3_TICKER = /^[A-Z]{4}\d{1,2}$/;

export interface RawProposal {
  readonly symbol: unknown;
  readonly side: unknown;
  readonly entry: unknown;
  readonly stop: unknown;
  readonly confidence: unknown;
  readonly dataUsed: unknown;
  readonly rejectedAlternatives: unknown;
  readonly reason: unknown;
}

export type ProposalResult =
  | { readonly kind: "ordem"; readonly intent: OrderIntent; readonly confidence: number; readonly dataUsed: readonly string[] }
  | { readonly kind: "escalado"; readonly reason: string }
  | { readonly kind: "rejeitado"; readonly reason: string };

export interface ProposalContext {
  readonly capitalBrl: number;
  /** Volatilidade anualizada medida em codigo a partir de precos reais. */
  readonly annualizedVol: number;
  readonly correlationId: string;
}

const KEYS = ["symbol", "side", "entry", "stop", "confidence", "dataUsed", "rejectedAlternatives", "reason"] as const;

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.length > 0 && v.every((x) => typeof x === "string" && x.trim().length > 0);
}

/**
 * Valida o objeto bruto. Nao confia em tipo, nao aceita campos a mais e nao
 * completa campos faltando.
 */
export function parseProposal(input: unknown):
  | { readonly ok: true; readonly value: RawProposal }
  | { readonly ok: false; readonly reason: string } {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, reason: "A proposta precisa ser um objeto JSON." };
  }
  const obj = input as Record<string, unknown>;
  const extra = Object.keys(obj).filter((k) => !(KEYS as readonly string[]).includes(k));
  if (extra.length > 0) return { ok: false, reason: `Campos nao previstos: ${extra.join(", ")}.` };
  for (const k of KEYS) {
    if (!(k in obj)) return { ok: false, reason: `Campo obrigatorio ausente: ${k}.` };
  }
  return { ok: true, value: obj as unknown as RawProposal };
}

/**
 * Transforma a proposta em intencao de ordem, ou em escalonamento, ou em recusa.
 * Nunca devolve ordem com quantidade vinda do LLM.
 */
export function toOrderIntent(input: unknown, ctx: ProposalContext): ProposalResult {
  const parsed = parseProposal(input);
  if (!parsed.ok) return { kind: "rejeitado", reason: parsed.reason };
  const p = parsed.value;

  if (typeof p.symbol !== "string" || !B3_TICKER.test(p.symbol)) {
    return { kind: "rejeitado", reason: "Ticker fora do formato da B3 (4 letras e 1-2 digitos)." };
  }
  if (p.side !== "BUY" && p.side !== "SELL") {
    return { kind: "rejeitado", reason: "Lado precisa ser BUY ou SELL." };
  }
  const side: Side = p.side;
  const entry = p.entry, stop = p.stop;
  if (typeof entry !== "number" || !Number.isFinite(entry) || entry <= 0) {
    return { kind: "rejeitado", reason: "Preco de entrada invalido." };
  }
  if (typeof stop !== "number" || !Number.isFinite(stop) || stop <= 0) {
    return { kind: "rejeitado", reason: "Stop invalido. Sem stop nao ha ordem." };
  }
  if (side === "BUY" && stop >= entry) return { kind: "rejeitado", reason: "Em compra, o stop precisa estar abaixo da entrada." };
  if (side === "SELL" && stop <= entry) return { kind: "rejeitado", reason: "Em venda, o stop precisa estar acima da entrada." };

  if (typeof p.confidence !== "number" || !Number.isFinite(p.confidence) || p.confidence < 0 || p.confidence > 1) {
    return { kind: "rejeitado", reason: "Confianca precisa ser um numero entre 0 e 1." };
  }
  if (!isStringArray(p.dataUsed)) {
    return { kind: "rejeitado", reason: "Sem registro de dados usados: a proposta nao e auditavel." };
  }
  if (!isStringArray(p.rejectedAlternatives)) {
    return { kind: "rejeitado", reason: "Faltam alternativas descartadas." };
  }
  if (typeof p.reason !== "string" || p.reason.trim().length === 0) {
    return { kind: "rejeitado", reason: "Falta o motivo da proposta." };
  }

  // Confianca abaixo do piso nao vira ordem: escala para o Diretor e para voce.
  if (p.confidence < LIMITS.minLlmConfidence) {
    return {
      kind: "escalado",
      reason: `Confianca ${p.confidence.toFixed(2)} abaixo de ${LIMITS.minLlmConfidence}. Escalado para o Diretor; a acao padrao e nao operar.`,
    };
  }

  // Quantidade sempre pelo codigo, nunca pelo texto do LLM.
  const quantity = sizeByTargetVol({
    capitalBrl: ctx.capitalBrl,
    price: entry,
    stopPrice: stop,
    annualizedVol: ctx.annualizedVol,
  });
  if (quantity <= 0) {
    return { kind: "rejeitado", reason: "Capital ou risco insuficiente para uma unidade com esse stop." };
  }

  const intent: OrderIntent = {
    symbol: p.symbol,
    side,
    quantity,
    referencePrice: entry,
    stopPrice: stop,
    reason: `[pesquisa] ${p.reason}`,
    correlationId: ctx.correlationId,
  };
  return { kind: "ordem", intent, confidence: p.confidence, dataUsed: p.dataUsed as string[] };
}
